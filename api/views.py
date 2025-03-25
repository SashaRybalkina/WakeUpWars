from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

HARDCODED_USERS = [
    {"username": "gloria", "password": "wakeUp123"},
]

@csrf_exempt
def login_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')

        for user in HARDCODED_USERS:
            if user['username'] == username:
                if user['password'] == password:
                    return JsonResponse({'success': True, 'username': username})
                else:
                    return JsonResponse({'success': False, 'error': 'Incorrect password'}, status=401)

        return JsonResponse({'success': False, 'error': 'Username does not exist'}, status=404)

    return JsonResponse({'error': 'Invalid request method'}, status=405)

@csrf_exempt
def register_view(request):
    if request.method == 'POST':
        return JsonResponse({'error': 'Registration is disabled for hardcoded users'}, status=403)

    return JsonResponse({'error': 'Invalid request method'}, status=405)

def hello_world(request):
    return JsonResponse({'message': 'Hello from Django!'})