from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Sum,F
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Product,Document,Warehouse,Membership,SyncEvent
from .serializers import ProductSerializer,DocumentSerializer,WarehouseSerializer,MembershipSerializer
from .permissions import IsManagerOrAdmin, IsAdmin
from .services import apply_document_stock
class HealthView(APIView):
 permission_classes=[AllowAny]
 def get(self,request): return Response({'status':'ok','service':'StockFlow API','time':timezone.now()})
class LoginView(APIView):
 permission_classes=[AllowAny]
 def post(self,request):
  user=authenticate(request,username=request.data.get('email',''),password=request.data.get('password',''))
  if not user: return Response({'detail':'Невірний email або пароль'},status=401)
  refresh=RefreshToken.for_user(user); memberships=Membership.objects.filter(user=user).select_related('warehouse')
  return Response({'access':str(refresh.access_token),'refresh':str(refresh),'user':{'id':user.id,'email':user.email or user.username,'name':user.get_full_name() or user.username,'memberships':MembershipSerializer(memberships,many=True).data}})
class ProductViewSet(viewsets.ModelViewSet):
 queryset=Product.objects.filter(active=True); serializer_class=ProductSerializer; permission_classes=[IsManagerOrAdmin]; filterset_fields=['category','unit']; search_fields=['name','sku','barcode']; ordering_fields=['name','stock','updated_at']
class WarehouseViewSet(viewsets.ModelViewSet): queryset=Warehouse.objects.filter(active=True); serializer_class=WarehouseSerializer; permission_classes=[IsAdmin]
class MembershipViewSet(viewsets.ModelViewSet): queryset=Membership.objects.select_related('user','warehouse'); serializer_class=MembershipSerializer; permission_classes=[IsAdmin]
class DocumentViewSet(viewsets.ModelViewSet):
 queryset=Document.objects.select_related('warehouse','created_by').prefetch_related('lines__product'); serializer_class=DocumentSerializer; filterset_fields=['type','status','warehouse']; ordering_fields=['created_at','updated_at']
 @transaction.atomic
 def perform_create(self,serializer):
  obj=serializer.save()
  if obj.status=='posted': apply_document_stock(obj)
 @transaction.atomic
 def perform_update(self,serializer):
  was_posted=serializer.instance.status=='posted'
  obj=serializer.save()
  if obj.status=='posted' and not was_posted: apply_document_stock(obj)
class SyncView(APIView):
 @transaction.atomic
 def post(self,request):
  device_id=request.data.get('device_id','unknown'); results=[]
  for item in request.data.get('changes',[]):
   client_id=item.get('client_id')
   if not client_id: results.append({'client_id':None,'status':'rejected','reason':'client_id required'}); continue
   old=SyncEvent.objects.filter(client_id=client_id).first()
   if old: results.append({'client_id':str(client_id),'status':'accepted','entity_id':old.entity_id,'duplicate':True}); continue
   try:
    with transaction.atomic():
     data=item['document']; local_version=data.get('version',1); existing=Document.objects.filter(pk=data.get('id')).first()
     if existing and existing.version!=local_version:
      results.append({'client_id':str(client_id),'status':'conflict','server_version':existing.version,'server':DocumentSerializer(existing).data,'local':data}); continue
     data['client_id']=client_id; data['status']='synced'
     data['lines']=[{k:v for k,v in line.items() if k in ('product','quantity','expected_quantity','unit')} for line in data.get('lines',[])]
     serializer=DocumentSerializer(existing,data=data,partial=bool(existing),context={'request':request})
     serializer.is_valid(raise_exception=True); obj=serializer.save(device_id=device_id)
     apply_document_stock(obj)
     SyncEvent.objects.create(user=request.user,device_id=device_id,client_id=client_id,entity_type='document',entity_id=str(obj.pk),result='accepted')
     results.append({'client_id':str(client_id),'status':'accepted','entity_id':str(obj.pk),'version':obj.version})
   except Exception as exc: results.append({'client_id':str(client_id),'status':'rejected','reason':str(exc)[:240]})
  return Response({'results':results,'server_time':timezone.now()})
class DashboardView(APIView):
 def get(self,request):
  products=Product.objects.filter(active=True); docs=Document.objects.all(); low=products.filter(stock__lte=F('min_stock'))
  return Response({'products_count':products.count(),'stock_units':products.aggregate(total=Sum('stock'))['total'] or 0,'low_stock_count':low.count(),'documents_today':docs.filter(created_at__date=timezone.localdate()).count(),'active_workers':Membership.objects.filter(user__is_active=True).values('user').distinct().count(),'recent_documents':DocumentSerializer(docs[:6],many=True).data,'low_stock':ProductSerializer(low[:8],many=True).data})

