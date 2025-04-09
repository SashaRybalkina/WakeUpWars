from django.urls import path
from .views import LoginView, RegisterView, GroupListView, HelloWorldView, UserProfileView

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('register/', RegisterView.as_view(), name='register'),
    path('groups/', GroupListView.as_view(), name='group-list'),
    path('hello/', HelloWorldView.as_view(), name='hello'),
    path('profile/<int:user_id>/', UserProfileView.as_view(), name='user-profile'),
]
