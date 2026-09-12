from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health),
    path("me/", views.me),
    path("documents/", views.documents),
    path("documents/upload/", views.upload_document),
    path("documents/<int:pk>/", views.document_detail),
    path("chunks/", views.chunks),
    path("query/", views.query),
    path("admin/tokens/", views.admin_tokens),
    path("admin/tokens/<int:pk>/", views.admin_token_deactivate),
    path("bot/status/", views.bot_status),
    path("bot/activate/", views.bot_activate),
    path("bot/stop/", views.bot_stop),
]
