from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers
from .models import Warehouse,Membership,Product,Document,DocumentLine
User=get_user_model()
class WarehouseSerializer(serializers.ModelSerializer):
 class Meta: model=Warehouse; fields='__all__'
class MembershipSerializer(serializers.ModelSerializer):
 warehouse_name=serializers.CharField(source='warehouse.name',read_only=True); user_email=serializers.CharField(source='user.email',read_only=True)
 class Meta: model=Membership; fields=['id','user','user_email','warehouse','warehouse_name','role']
class UserSerializer(serializers.ModelSerializer):
 """Admin-managed staff account: creating one also grants a role on a warehouse."""
 email=serializers.EmailField(max_length=150); name=serializers.CharField(write_only=True,required=False,allow_blank=True,max_length=150)
 password=serializers.CharField(write_only=True,required=False,style={'input_type':'password'})
 role=serializers.ChoiceField(choices=Membership.ROLE,write_only=True,required=False); warehouse=serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(active=True),write_only=True,required=False)
 memberships=MembershipSerializer(many=True,read_only=True)
 class Meta: model=User; fields=['id','email','name','password','role','warehouse','is_active','memberships','date_joined','last_login']; read_only_fields=['date_joined','last_login']
 def to_representation(self,instance):
  data=super().to_representation(instance); data['name']=instance.get_full_name() or instance.username; return data
 def validate_email(self,value):
  value=value.strip().lower(); taken=User.objects.filter(username__iexact=value)|User.objects.filter(email__iexact=value)
  if self.instance: taken=taken.exclude(pk=self.instance.pk)
  if taken.exists(): raise serializers.ValidationError('Користувач з таким email вже існує')
  return value
 def validate(self,attrs):
  if not self.instance:
   missing={f:'Обов’язкове поле' for f in ('password','role','warehouse') if not attrs.get(f)}
   if missing: raise serializers.ValidationError(missing)
  request=self.context.get('request')
  if self.instance and request and self.instance.pk==request.user.pk and attrs.get('is_active') is False: raise serializers.ValidationError({'is_active':'Не можна заблокувати власний акаунт'})
  if attrs.get('password'):
   email=attrs.get('email') or getattr(self.instance,'email','')
   probe=self.instance or User(username=email,email=email,first_name=attrs.get('name',''))
   try: validate_password(attrs['password'],probe)
   except DjangoValidationError as exc: raise serializers.ValidationError({'password':list(exc.messages)})
  return attrs
 @staticmethod
 def _set_name(user,name):
  first,_,last=(name or '').strip().partition(' '); user.first_name=first[:150]; user.last_name=last.strip()[:150]
 @transaction.atomic
 def create(self,validated_data):
  user=User(username=validated_data['email'],email=validated_data['email'],is_active=validated_data.get('is_active',True)); self._set_name(user,validated_data.get('name')); user.set_password(validated_data['password']); user.save()
  Membership.objects.create(user=user,warehouse=validated_data['warehouse'],role=validated_data['role'])
  return user
 @transaction.atomic
 def update(self,instance,validated_data):
  if 'email' in validated_data: instance.username=instance.email=validated_data['email']
  if 'name' in validated_data: self._set_name(instance,validated_data['name'])
  if 'is_active' in validated_data: instance.is_active=validated_data['is_active']
  if validated_data.get('password'): instance.set_password(validated_data['password'])
  instance.save()
  role,warehouse=validated_data.get('role'),validated_data.get('warehouse')
  if warehouse: Membership.objects.update_or_create(user=instance,warehouse=warehouse,defaults={'role':role or 'worker'})
  elif role: instance.memberships.update(role=role)
  return instance
class ProductSerializer(serializers.ModelSerializer):
 class Meta: model=Product; fields='__all__'; read_only_fields=['updated_at']
class LineSerializer(serializers.ModelSerializer):
 product_name=serializers.CharField(source='product.name',read_only=True); sku=serializers.CharField(source='product.sku',read_only=True); barcode=serializers.CharField(source='product.barcode',read_only=True)
 class Meta: model=DocumentLine; fields=['id','product','product_name','sku','barcode','quantity','expected_quantity','unit']
class DocumentSerializer(serializers.ModelSerializer):
 lines=LineSerializer(many=True); warehouse_name=serializers.CharField(source='warehouse.name',read_only=True); created_by_name=serializers.CharField(source='created_by.get_full_name',read_only=True)
 class Meta: model=Document; fields=['id','type','status','warehouse','warehouse_name','destination','created_by','created_by_name','device_id','client_id','note','version','created_at','updated_at','synced_at','lines']; read_only_fields=['created_by','version','synced_at']
 def create(self,validated_data):
  lines=validated_data.pop('lines'); doc=Document.objects.create(created_by=self.context['request'].user,**validated_data)
  for line in lines: DocumentLine.objects.create(document=doc,**line)
  return doc
 def update(self,instance,validated_data):
  lines=validated_data.pop('lines',None)
  for key,value in validated_data.items(): setattr(instance,key,value)
  instance.version+=1; instance.save()
  if lines is not None:
   instance.lines.all().delete()
   for line in lines: DocumentLine.objects.create(document=instance,**line)
  return instance
