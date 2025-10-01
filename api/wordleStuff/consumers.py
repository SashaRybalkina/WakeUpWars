import json
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from api.wordleStuff.utils import validate_wordle_move_async, get_or_create_game_wordle_async
from api.models import WordleGameState, WordleGamePlayer, User


class WordleConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.game_state_id = int(self.scope['url_route']['kwargs']['game_state_id'])
        self.group_name = f'wordle_{self.game_state_id}'
        self.user: User = self.scope['user']

        print(f"[WebSocket][CONNECT] user={self.user.username} joining game_state={self.game_state_id}")

        # Join the group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Ensure player record exists
        await self.add_player()
        print(f"[WebSocket][PLAYER] Added {self.user.username} into game_state={self.game_state_id}")

        # Send existing players (excluding self) back to the frontend
        existing_players = await self.get_existing_players()
        print(f"[WebSocket][EXISTING PLAYERS] for {self.user.username}: {[p['username'] for p in existing_players]}")
        for player in existing_players:
            await self.send(text_data=json.dumps({
                'type': 'player_joined',
                'player': player['username'],
            }))

        # Broadcast: notify others that a new player has joined
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'player.joined',
                'player': self.user.username,
            }
        )
        print(f"[WebSocket][BROADCAST] {self.user.username} joined game_state={self.game_state_id}")

    async def disconnect(self, close_code):
        print(f"[WebSocket][DISCONNECT] user={self.user.username} left game_state={self.game_state_id} (code={close_code})")
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        print(f"[WebSocket][RECEIVE] from {self.user.username}: {data}")

        if data['type'] == 'make_move':
            row = data.get('row')
            guess = data.get('guess')
            print(f"[WebSocket][MOVE] {self.user.username} guessed '{guess}' at row={row} in game_state={self.game_state_id}")

            # Validate the move
            result = await validate_wordle_move_async(self.game_state_id, self.user, guess, row)
            print(f"[WebSocket][RESULT] {self.user.username} -> correct={result['is_correct']} complete={result['is_complete']} scores={result['scores']}")

            # Send result back to the player
            await self.send(text_data=json.dumps({
                'type': 'move_result',
                'row': row,
                'guess': guess,
                'feedback': result['feedback'],
                'is_correct': result['is_correct'],
                'is_complete': result['is_complete'],
                'scores': result['scores'],
            }))
            print(f"[WebSocket][SEND] move_result sent to {self.user.username}")

            # Broadcast the move to other players
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'broadcast.move',
                    'player': self.user.username,
                    'row': row,
                    'guess': guess,
                    'evaluation': result['feedback'],
                }
            )
            print(f"[WebSocket][BROADCAST] move from {self.user.username} -> others in game_state={self.game_state_id}")

            # If the game is complete, broadcast the leaderboard
            if result['is_complete']:
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        'type': 'game.complete',
                        'scores': result['scores'],
                    }
                )
                print(f"[WebSocket][GAME COMPLETE] game_state={self.game_state_id}, scores={result['scores']}")

    # --- Group event handlers ---

    async def broadcast_move(self, event):
        if event['player'] != self.user.username:  
            print(f"[WebSocket][RECEIVE BROADCAST] {self.user.username} got move from {event['player']}: {event}")
            await self.send(text_data=json.dumps({
                'type': 'broadcast_move',
                'player': event['player'],
                'row': event['row'],
                'guess': event['guess'],
                'evaluation': event['evaluation'],
            }))

    async def player_joined(self, event):
        if event['player'] != self.user.username:
            print(f"[WebSocket][PLAYER JOINED] {self.user.username} notified about {event['player']} joining")
            await self.send(text_data=json.dumps({
                'type': 'player_joined',
                'player': event['player'],
            }))

    async def game_complete(self, event):
        print(f"[WebSocket][GAME COMPLETE EVENT] {self.user.username} received scores: {event['scores']}")
        await self.send(text_data=json.dumps({
            'type': 'game_complete',
            'scores': event['scores'],
        }))

    # --- Database helpers ---
    @sync_to_async
    def add_player(self):
        game_state = WordleGameState.objects.get(id=self.game_state_id)
        WordleGamePlayer.objects.get_or_create(
            gameState=game_state,
            player=self.user,
            defaults={'accuracyCount': 0, 'inaccuracyCount': 0}
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
