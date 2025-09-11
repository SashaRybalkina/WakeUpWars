import json
import random
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from api.wordleStuff.utils import validate_wordle_move
from api.models import WordleGameState, WordleGamePlayer, WordleMove, User


class WordleConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.game_state_id = self.scope['url_route']['kwargs']['game_state_id']
        self.group_name = f'wordle_{self.game_state_id}'
        self.user = self.scope['user']

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Add player record
        await self.add_player()

        existing_players = await self.get_existing_players()
        for player in existing_players:
            await self.send(text_data=json.dumps({
                'type': 'player_joined',
                'player': player['username'],
            }))

        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'player.joined',
                'player': self.user.username,
            }
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)

        if data['type'] == 'make_move':
            row = data['index']      # which attempt (0–5)
            guess = data['value']    # the guessed word

            # Store the move in DB if needed
            await self.save_move(row, guess)

            # Broadcast to all players
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'broadcast.move',
                    'row': row,
                    'guess': guess,
                }
            )

    # Handlers for group messages
    async def broadcast_move(self, event):
        await self.send(text_data=json.dumps({
            'type': 'broadcast_move',
            'row': event['row'],
            'guess': event['guess'],
        }))

    async def player_joined(self, event):
        if event['player'] != self.user.username:
            await self.send(text_data=json.dumps({
                'type': 'player_joined',
                'player': event['player'],
            }))

    async def game_complete(self, event):
        await self.send(text_data=json.dumps({
            'type': 'game_complete',
            'scores': event['scores'],
        }))

    # Database helpers
    @sync_to_async
    def add_player(self):
        game_state = WordleGameState.objects.get(id=self.game_state_id)
        WordleGamePlayer.objects.get_or_create(
            gameState=game_state,
            player=self.user,
            defaults={'accuracyCount': 0, 'inaccuracyCount': 0}
        )
        
    @sync_to_async
    def save_move(self, row, guess):
        game_state = WordleGameState.objects.get(id=self.game_state_id)
        WordleGamePlayer.objects.get_or_create(
            gameState=game_state,
            player=self.user,
            defaults={'accuracyCount': 0, 'inaccuracyCount': 0}
        )
        WordleMove.objects.update_or_create(
            gameState=game_state,
            player=self.user,
            row=row,
            defaults={"guess": guess}
        )

    @sync_to_async
    def get_existing_players(self):
        players = (
            WordleGamePlayer.objects
            .filter(gameState__id=self.game_state_id)
            .exclude(player=self.user)
            .select_related('player')
        )
        return [{'username': p.player.username} for p in players]