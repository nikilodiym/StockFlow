import uuid
from django.conf import settings
from django.db import models
class Warehouse(models.Model):
 name=models.CharField(max_length=120); code=models.CharField(max_length=30,unique=True); address=models.CharField(max_length=240,blank=True); active=models.BooleanField(default=True)
 def __str__(self): return self.name
class Membership(models.Model):
 ROLE=[('worker','Комірник'),('manager','Менеджер складу'),('admin','Адміністратор')]
 user=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE,related_name='memberships'); warehouse=models.ForeignKey(Warehouse,on_delete=models.CASCADE,related_name='memberships'); role=models.CharField(max_length=20,choices=ROLE,default='worker')
 class Meta: unique_together=('user','warehouse')
class Product(models.Model):
 UNIT=[('шт','шт'),('кг','кг'),('упак','упак')]
 sku=models.CharField(max_length=64,unique=True); barcode=models.CharField(max_length=80,blank=True,db_index=True); name=models.CharField(max_length=240,db_index=True); category=models.CharField(max_length=120,blank=True); unit=models.CharField(max_length=12,choices=UNIT,default='шт'); stock=models.DecimalField(max_digits=12,decimal_places=3,default=0); min_stock=models.DecimalField(max_digits=12,decimal_places=3,default=0); price=models.DecimalField(max_digits=12,decimal_places=2,default=0); updated_at=models.DateTimeField(auto_now=True); active=models.BooleanField(default=True)
 class Meta: ordering=['name']
 def __str__(self): return f'{self.name} ({self.sku})'
class Document(models.Model):
 TYPES=[('receipt','Прихід'),('writeoff','Списання'),('inventory','Інвентаризація'),('transfer','Переміщення')]
 STATUSES=[('draft','Чернетка'),('posted','Проведено'),('synced','Синхронізовано')]
 id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); type=models.CharField(max_length=20,choices=TYPES); status=models.CharField(max_length=20,choices=STATUSES,default='draft'); warehouse=models.ForeignKey(Warehouse,on_delete=models.PROTECT,related_name='documents'); destination=models.ForeignKey(Warehouse,on_delete=models.PROTECT,null=True,blank=True,related_name='incoming_transfers'); created_by=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT); device_id=models.CharField(max_length=120,blank=True); client_id=models.UUIDField(null=True,blank=True,unique=True); note=models.TextField(blank=True); version=models.PositiveIntegerField(default=1); created_at=models.DateTimeField(auto_now_add=True); updated_at=models.DateTimeField(auto_now=True); synced_at=models.DateTimeField(null=True,blank=True)
 class Meta: ordering=['-created_at']
class DocumentLine(models.Model):
 document=models.ForeignKey(Document,on_delete=models.CASCADE,related_name='lines'); product=models.ForeignKey(Product,on_delete=models.PROTECT); quantity=models.DecimalField(max_digits=12,decimal_places=3); expected_quantity=models.DecimalField(max_digits=12,decimal_places=3,null=True,blank=True); unit=models.CharField(max_length=12,default='шт')
 class Meta: unique_together=('document','product')
class SyncEvent(models.Model):
 user=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE); device_id=models.CharField(max_length=120); client_id=models.UUIDField(unique=True); entity_type=models.CharField(max_length=40); entity_id=models.CharField(max_length=80); result=models.CharField(max_length=20); detail=models.JSONField(default=dict); created_at=models.DateTimeField(auto_now_add=True)
