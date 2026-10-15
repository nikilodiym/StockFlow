from django.contrib import admin
from .models import Warehouse,Membership,Product,Document,DocumentLine,SyncEvent
admin.site.register([Warehouse,Membership,Product,Document,DocumentLine,SyncEvent])
