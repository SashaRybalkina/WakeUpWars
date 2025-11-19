"""
/**
 * @file apps.py
 * @description Django application configuration for the API module.
 * Loads signal handlers when the app is ready.
 */
"""

from django.apps import AppConfig

class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'
    def ready(self):
        import api.signals