from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from drf_spectacular.views import SpectacularAPIView,SpectacularSwaggerView
from inventory.views import LoginView,HealthView,SyncView,DashboardView
urlpatterns=[path('django-admin/',admin.site.urls),path('api/health/',HealthView.as_view()),path('api/auth/login/',LoginView.as_view()),path('api/auth/refresh/',TokenRefreshView.as_view()),path('api/sync/',SyncView.as_view()),path('api/dashboard/',DashboardView.as_view()),path('api/',include('inventory.urls')),path('api/schema/',SpectacularAPIView.as_view(),name='schema'),path('api/docs/',SpectacularSwaggerView.as_view(url_name='schema'),name='swagger-ui')]
