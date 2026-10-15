from rest_framework import serializers
from .models import Warehouse,Membership,Product,Document,DocumentLine
class WarehouseSerializer(serializers.ModelSerializer):
 class Meta: model=Warehouse; fields='__all__'
class MembershipSerializer(serializers.ModelSerializer):
 warehouse_name=serializers.CharField(source='warehouse.name',read_only=True); user_email=serializers.CharField(source='user.email',read_only=True)
 class Meta: model=Membership; fields=['id','user','user_email','warehouse','warehouse_name','role']
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
