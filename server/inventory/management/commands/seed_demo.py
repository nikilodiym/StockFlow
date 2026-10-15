from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from inventory.models import Warehouse,Membership,Product
class Command(BaseCommand):
 def handle(self,*args,**opts):
  U=get_user_model(); user=U.objects.filter(username__in=['admin@gmail.com','admin@stockflow.local']).first(); user=user or U(); user.username='admin@gmail.com'; user.email='admin@gmail.com'; user.first_name='Олена'; user.last_name='Коваль'; user.is_staff=True; user.is_superuser=True; user.set_password('admin'); user.save()
  w,_=Warehouse.objects.get_or_create(code='KYIV-01',defaults={'name':'Центральний склад','address':'Київ'}); Membership.objects.get_or_create(user=user,warehouse=w,defaults={'role':'admin'})
  rows=[('DRK-001','4820000000011','Вода мінеральна 1.5 л','Напої','шт',128,24,22.50),('DRK-002','4820000000012','Сік апельсиновий 1 л','Напої','шт',42,18,58),('FOO-001','4820000000013','Кава зернова 1 кг','Бакалія','упак',18,8,349),('FOO-002','4820000000014','Рис довгозернистий 1 кг','Бакалія','упак',7,12,64.9),('HOM-001','4820000000015','Рушники паперові 2 шт','Господарчі товари','упак',34,10,42)]
  for sku,barcode,name,cat,unit,stock,mn,price in rows: Product.objects.update_or_create(sku=sku,defaults={'barcode':barcode,'name':name,'category':cat,'unit':unit,'stock':stock,'min_stock':mn,'price':price})
  self.stdout.write(self.style.SUCCESS('Demo data ready: admin@gmail.com / admin'))
