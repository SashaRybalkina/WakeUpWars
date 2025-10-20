import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from api.models import UserNotification, User

class UserNotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user_id = self.scope['url_route']['kwargs'].get('user_id')
        if not self.user_id:
            await self.close()
            return
        self.room_groupname = f'notifications{self.user_id}'
        await self.channel_layer.group_add(
            self.room_groupname,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_groupname,
            self.channel_name
        )

    async def receive(self, text_data):
        # Optionally handle client-initiated events (e.g., mark as read)
        pass