import json
import random
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from api.sudokuStuff.utils import validate_sudoku_move
from api.models import SudokuGameState, SudokuGamePlayer, User
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from api.models import GamePerformance
from asgiref.sync import sync_to_async
from django.core.cache import cache

ALL_COLORS = [
    'hotpink', 'coral', 'orange', 'lawngreen', 'aqua',
    'deepskyblue', 'mediumorchid', 'mediumvioletred',
    'magenta', 'thistle', 'powderblue',
]

def _conns_key(game_state_id: int) -> str:
    return f"sdk_conns_{game_state_id}"

class SudokuConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """
        Enforce 2-minute join window and block after game end.
        Close codes:
        4001 – JOINS_CLOSED   4002 – GAME_ENDED
        """
        self.game_state_id = int(self.scope["url_route"]["kwargs"]["game_state_id"])
        self.group_name = f"sudoku_{self.game_state_id}"
        self.user: User = self.scope["user"]

        if not self.user.is_authenticated:
            await self.close()
            return

        # ─── join-window gating ─────────────────────────────
        gs: SudokuGameState = await sync_to_async(
            SudokuGameState.objects.select_related("challenge", "game").get
        )(id=self.game_state_id)

        now = timezone.now()
        if not gs.join_deadline_at:
            gs.join_deadline_at = (gs.created_at or now) + timezone.timedelta(minutes=2)
            await sync_to_async(gs.save)(update_fields=["join_deadline_at"])

        if gs.joins_closed or now > gs.join_deadline_at:
            await self.close(code=4001)
            return

        ended = await sync_to_async(
            GamePerformance.objects.filter(
                challenge=gs.challenge, game=gs.game, date=timezone.localdate()
            ).exists
        )()
        if ended:
            gs.joins_closed = True
            await sync_to_async(gs.save)(update_fields=["joins_closed"])
            await self.close(code=4002)
            return
        # ────────────────────────────────────────────────────

        await self.accept()
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        # Track online users for this game
        conns = set(cache.get(_conns_key(self.game_state_id)) or [])
        conns.add(self.user.id)
        cache.set(_conns_key(self.game_state_id), list(conns), timeout=3600)
        # await self.channel_layer.group_add(self.group_name, self.channel_name)
        # await self.accept()

        # Assign a color and notify others
        self.color = await self.assign_color()
        
        existing_players = await self.get_existing_players()

        for player in existing_players:
            await self.send(text_data=json.dumps({
                'type': 'player_joined',
                'player': player['username'],
                'color': player['color'],
            }))

        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'player.joined',
                'player': self.user.username,
                'color': self.color,
            }
        )

        # Send initial lobby state so client can compute remaining time locally
        expected_count = await self._get_expected_count()
        conns = set(cache.get(_conns_key(self.game_state_id)) or [])
        await self.send(text_data=json.dumps({
            'type': 'lobby_state',
            'created_at': (gs.created_at or now).isoformat() if gs.created_at else now.isoformat(),
            'join_deadline_at': gs.join_deadline_at.isoformat() if gs.join_deadline_at else None,
            'server_now': timezone.now().isoformat(),
            'ready_count': len(conns),
            'expected_count': expected_count,
        }))

        # Also broadcast lobby state to others so their counters update
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'lobby.state',
                'created_at': (gs.created_at or now).isoformat() if gs.created_at else now.isoformat(),
                'join_deadline_at': gs.join_deadline_at.isoformat() if gs.join_deadline_at else None,
                'server_now': timezone.now().isoformat(),
                'ready_count': len(conns),
                'expected_count': expected_count,
            }
        )

    async def disconnect(self, close_code):
        # remove from online users and notify others
        conns = set(cache.get(_conns_key(self.game_state_id)) or [])
        if self.user.id in conns:
            conns.remove(self.user.id)
        cache.set(_conns_key(self.game_state_id), list(conns), timeout=3600)
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'player.left',
                'player': self.user.username,
            }
        )
        # broadcast updated lobby state after someone leaves
        expected_count = await self._get_expected_count()
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'lobby.state',
                'created_at': timezone.now().isoformat(),
                'join_deadline_at': None,
                'server_now': timezone.now().isoformat(),
                'ready_count': len(conns),
                'expected_count': expected_count,
            }
        )
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)

        if data['type'] == 'make_move':
            index = data['index']
            value = data['value']

            result = await validate_sudoku_move(self.game_state_id, self.user, index, value)
            row, col = divmod(index, 9)

            if result['is_correct']:
                # Broadcast move
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        'type': 'broadcast.move',
                        'cell': index,
                        'value': value,
                        'color': self.color,
                        'valid': result['is_correct'],
                    }
                )

                # If the game is now complete, broadcast that too
                if result['is_complete']:
                    await self.channel_layer.group_send(
                        self.group_name,
                        {
                            'type': 'game.complete',
                            # 'completed_by': self.user.username,
                            'scores': result['scores'],
                        }
                    )

                    
            # only broadcast incorrect move to myself
            else:
                await self.send(text_data=json.dumps({
                    'type': 'broadcast_move',
                    'cell': index,
                    'value': value,
                    'color': self.color,
                    'valid': result['is_correct'],
            }))
        elif data['type'] == 'start_game':
            # Close immediately if at least 1 online player (start even solo)
            conns = set(cache.get(_conns_key(self.game_state_id)) or [])
            if len(conns) >= 1:
                await self._close_joins_and_broadcast()
                

    # Handlers for broadcasting
    async def broadcast_move(self, event):
        await self.send(text_data=json.dumps({
            'type': 'broadcast_move',
            'cell': event['cell'],
            'value': event['value'],
            'color': event['color'],
            'valid': event['valid'],
        }))

    # async def player_joined(self, event):
    #     if event['player'] != self.user.username:
    #         await self.send(text_data=json.dumps({
    #             'type': 'player_joined',
    #             'player': event['player'],
    #             'color': event['color'],
    #         }))

    async def player_joined(self, event):
        await self.send(text_data=json.dumps({
            'type': 'player_joined',
            'player': event['player'],
            'color': event['color'],
        }))

    async def lobby_state(self, event):
        await self.send(text_data=json.dumps({
            'type': 'lobby_state',
            'created_at': event.get('created_at'),
            'join_deadline_at': event.get('join_deadline_at'),
            'server_now': event.get('server_now'),
            'ready_count': event.get('ready_count'),
            'expected_count': event.get('expected_count'),
        }))

    async def player_left(self, event):
        await self.send(text_data=json.dumps({
            'type': 'player_left',
            'player': event['player'],
        }))


    async def game_complete(self, event):
        await self.send(text_data=json.dumps({
            'type': 'game_complete',
            # 'completedBy': event['completed_by'],
            'scores': event['scores'],
        }))

    async def join_window_closed(self, event):
        # Background task or another peer closed the join window
        await self.send(text_data=json.dumps({
            'type': 'join_window_closed',
            'server_now': event.get('server_now'),
        }))

    # Color assignment (thread-safe)
    @sync_to_async
    def assign_color(self):
        try:
            game_state = SudokuGameState.objects.get(id=self.game_state_id)

            player_record, created = SudokuGamePlayer.objects.get_or_create(
                gameState=game_state,
                player=self.user,
                defaults={'accuracyCount': 0, 'inaccuracyCount': 0}
            )

            if player_record.color:
                return player_record.color

            taken_colors = (
                SudokuGamePlayer.objects
                .filter(gameState=game_state)
                .exclude(player=self.user)
                .values_list('color', flat=True)
            )

            available_colors = [c for c in ALL_COLORS if c not in taken_colors]
            assigned_color = random.choice(available_colors) if available_colors else 'black'
            player_record.color = assigned_color
            player_record.save()
            return assigned_color

        except ObjectDoesNotExist:
            return 'black'


    @sync_to_async
    def get_existing_players(self):
        # Only include players who are currently online for this game
        conns = set(cache.get(_conns_key(self.game_state_id)) or [])
        if not conns:
            return []
        players = (
            SudokuGamePlayer.objects
            .filter(gameState__id=self.game_state_id, player_id__in=conns)
            .exclude(player=self.user)
            .select_related('player')
        )
        return [{'username': p.player.username, 'color': p.color} for p in players if p.color]

    @sync_to_async
    def _get_expected_count(self):
        try:
            from api.models import ChallengeMembership
            gs = SudokuGameState.objects.select_related('challenge').get(id=self.game_state_id)
        except SudokuGameState.DoesNotExist:
            return 1
        if gs.challenge and gs.challenge.groupID_id is not None:
            n = ChallengeMembership.objects.filter(challengeID=gs.challenge).count()
            return max(1, n)
        return 1

    @sync_to_async
    def _can_start_now(self) -> bool:
        # at least 2 players connected/known to this game
        count = SudokuGamePlayer.objects.filter(gameState_id=self.game_state_id).count()
        return count >= 2

    @sync_to_async
    def _close_joins_and_broadcast(self):
        try:
            gs = SudokuGameState.objects.get(id=self.game_state_id)
            if not gs.joins_closed:
                gs.joins_closed = True
                gs.save(update_fields=['joins_closed'])
        except SudokuGameState.DoesNotExist:
            return
        # broadcast to group
        from asgiref.sync import async_to_sync
        async_to_sync(self.channel_layer.group_send)(
            self.group_name,
            {
                'type': 'join.window.closed',
                'server_now': timezone.now().isoformat(),
            }
        )

