import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.core.cache import cache

from api.models import PatternMemorizationGameState, User, ChallengeMembership

# --- Cache key ---
def _ready_key(game_state_id: int) -> str:
    return f"pm_ready_{game_state_id}"

def _started_key(game_state_id: int) -> str:
    return f"pm_started_{game_state_id}"


class PatternMemorizationConsumer(AsyncWebsocketConsumer):
    """
      connect → lobby_state → player_ready → counting → game_start → pattern_sequence
    """

    async def connect(self):

        self.game_state_id = int(self.scope['url_route']['kwargs']['game_state_id'])
        self.group_name = f'pattern_{self.game_state_id}'
        self.user: User = self.scope['user']

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

         # testing purposes
        if hasattr(self.channel_layer, "_receive"):
            self.channel_layer.receive = self.channel_layer._receive

        # lobby state
        started = cache.get(_started_key(self.game_state_id)) or False
        ready_count = len(cache.get(_ready_key(self.game_state_id)) or [])
        expected_count = await self._get_expected_count()

        await self.send(text_data=json.dumps({
            "type": "lobby_state",
            "started": started,
            "ready_count": ready_count,
            "expected_count": expected_count,
        }))
        

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get("type")

        if msg_type == "player_ready":
            await self._handle_player_ready()

    # ---------------- HANDLERS ----------------

    async def _handle_player_ready(self):
        ready_set = set(cache.get(_ready_key(self.game_state_id)) or [])
        ready_set.add(self.user.id)
        cache.set(_ready_key(self.game_state_id), list(ready_set), timeout=3600)

        expected = await self._get_expected_count()
        print(f"[DEBUG] ready_count={len(ready_set)}, expected={expected}", flush=True)

        if expected > 0 and len(ready_set) >= expected:
            cache.set(_started_key(self.game_state_id), True, timeout=3600)

            # counting
            for t in [3, 2, 1]:
                # print(f"[DEBUG] lobby.countdown → {t}", flush=True)
                await self.channel_layer.group_send(self.group_name, {
                    "type": "lobby.countdown",
                    "seconds": t,
                })
                await asyncio.sleep(1)

            # game start
            await self.channel_layer.group_send(self.group_name, {
                "type": "game.start",
            })
            print("[DEBUG] group_send → game.start has been sent", flush=True)

    async def lobby_countdown(self, event):
        await self.send(text_data=json.dumps({
            "type": "lobby_countdown",
            "seconds": event["seconds"],
        }))

    async def game_start(self, event):
        print("[DEBUG] >>> enter game_start handler", flush=True)
        game_state = await sync_to_async(PatternMemorizationGameState.objects.get)(id=self.game_state_id)
        current_round = game_state.current_round
        sequence = game_state.pattern_sequence[current_round - 1]

        print(f"[DEBUG] send pattern_sequence round={current_round}, seq={sequence}", flush=True)
        await self.send(text_data=json.dumps({
            "type": "pattern_sequence",
            "round_number": current_round,
            "sequence": sequence,
        }))

    # ---------------- HELPERS ----------------

    @sync_to_async
    def _get_expected_count(self):
        try:
            gs = PatternMemorizationGameState.objects.select_related("challenge").get(id=self.game_state_id)
        except PatternMemorizationGameState.DoesNotExist:
            return 0

        return ChallengeMembership.objects.filter(challengeID=gs.challenge).count()
