import json
from datetime import date, timedelta
from django.utils import timezone
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.core.cache import cache

from api.models import (
    TypingRaceGameState,
    TypingRaceGamePlayer,
    User,
    GamePerformance,
    ChallengeMembership
)
from api.typingRaceStuff.utils import (
    apply_progress_update_async,
    compute_leaderboard_snapshot,
    save_scores_async,
)

# ====== Cache Helpers ======
def _conns_key(game_id: int):
    """Cache key to store online player IDs for this game."""
    return f"typing_conns_{game_id}"

def _saved_key(game_id: int):
    """Cache key to mark that scores have been saved."""
    return f"typing_scores_saved_{game_id}"

CACHE_TTL = 3600  # 1 hour cache timeout

# ====== TypingRaceConsumer ======
class TypingRaceConsumer(AsyncWebsocketConsumer):
    """
    Complete WebSocket consumer for Typing Race.
    Includes lobby, progress sync, and game completion broadcast.
    """

    async def connect(self):
        """Handle new WebSocket connection."""
        self.game_state_id = int(self.scope["url_route"]["kwargs"]["game_state_id"])
        self.room_group_name = f"typing_{self.game_state_id}"
        self.user: User = self.scope["user"]

        if not self.user.is_authenticated:
            await self.close()
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # --- Add player to cache ---
        conns = set(cache.get(_conns_key(self.game_state_id)) or [])
        conns.add(self.user.id)
        cache.set(_conns_key(self.game_state_id), list(conns), timeout=CACHE_TTL)

        # --- Add player to DB ---
        await self._add_player()

        # --- Broadcast updated lobby state ---
        await self._broadcast_lobby_state()

        # --- Send initial connection success to client ---
        await self.send_json({
            "type": "connection_success",
            "message": f"Connected as {self.user.username}",
        })

    async def disconnect(self, close_code):
        """Handle player disconnect."""
        username = self.user.username
        print(f"[TypingRace][DISCONNECT] user={username}")

        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

        # Remove from cache
        conns = set(cache.get(_conns_key(self.game_state_id)) or [])
        if self.user.id in conns:
            conns.remove(self.user.id)
        cache.set(_conns_key(self.game_state_id), list(conns), timeout=CACHE_TTL)

        # Auto save 0 score if unfinished
        await self._save_zero_score_if_needed()

        # Broadcast updated lobby/player list
        await self._broadcast_lobby_state()

        # Cleanup if no players left
        if not conns:
            cache.delete(_conns_key(self.game_state_id))
            cache.delete(_saved_key(self.game_state_id))
            print(f"[TypingRace][CLEANUP] Cache cleared for game_state={self.game_state_id}")

    async def receive(self, text_data):
        """Handle incoming messages from client."""
        data = json.loads(text_data)
        msg_type = data.get("type")

        # === Player ready to start ===
        if msg_type == "start_game":
            await self._handle_start_game()

        # === Player progress update ===
        elif msg_type == "progress_update":
            total_typed = data.get("total_typed", 0)
            total_errors = data.get("total_errors", 0)
            await self._handle_progress_update(total_typed, total_errors)

        # === Player finished ===
        elif msg_type == "game_finished":
            await self._handle_game_finished()

    # ==========================================================
    # 🧩 Internal Handlers
    # ==========================================================

    async def _handle_start_game(self):
        """When host or timer triggers game start."""
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "join_window_closed"}
        )

    async def _handle_progress_update(self, total_typed, total_errors):
        """Update player progress and broadcast new leaderboard."""
        await apply_progress_update_async(self.game_state_id, self.user, total_typed, total_errors)
        leaderboard = await sync_to_async(compute_leaderboard_snapshot)(self.game_state_id)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "leaderboard_update",
                "leaderboard": leaderboard,
            }
        )

    async def _handle_game_finished(self):
        """Mark player as finished and broadcast final leaderboard if all done."""
        leaderboard = await sync_to_async(compute_leaderboard_snapshot)(self.game_state_id)

        # Check if everyone finished
        all_done = all(p["is_completed"] for p in leaderboard)
        winner = None
        if all_done:
            sorted_lb = sorted(leaderboard, key=lambda x: x["score"], reverse=True)
            winner = sorted_lb[0]["username"] if sorted_lb else None

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "game_complete",
                    "leaderboard": sorted_lb,
                }
            )

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "leaderboard_update",
                "leaderboard": leaderboard,
                "winner": winner,
            }
        )

    # ==========================================================
    # 🧠 Group Event Handlers (Messages broadcasted to everyone)
    # ==========================================================
    async def leaderboard_update(self, event):
        await self.send_json({
            "type": "leaderboard_update",
            "leaderboard": event.get("leaderboard", []),
            "winner": event.get("winner"),
        })

    async def game_complete(self, event):
        await self.send_json({
            "type": "game_complete",
            "leaderboard": event.get("leaderboard", []),
        })

    async def join_window_closed(self, event):
        await self.send_json({"type": "join_window_closed"})

    # ==========================================================
    # 🧩 Helper Methods
    # ==========================================================
    async def _add_player(self):
        """Ensure player exists in TypingRaceGamePlayer table."""
        gs = await sync_to_async(TypingRaceGameState.objects.get)(id=self.game_state_id)
        await sync_to_async(TypingRaceGamePlayer.objects.get_or_create)(
            gameState=gs,
            player=self.user,
        )

    async def _broadcast_lobby_state(self):
        """Send updated lobby info to all connected clients."""
        conns = set(cache.get(_conns_key(self.game_state_id)) or [])
        ready_count = len(conns)

        try:
            gs = await sync_to_async(TypingRaceGameState.objects.get)(id=self.game_state_id)
            expected_count = await sync_to_async(ChallengeMembership.objects.filter(challengeID=gs.challenge).count)()
        except Exception:
            expected_count = ready_count

        message = {
            "type": "lobby_state",
            "created_at": timezone.now().isoformat(),
            "join_deadline_at": (timezone.now() + timedelta(seconds=15)).isoformat(),
            "server_now": timezone.now().isoformat(),
            "ready_count": ready_count,
            "expected_count": expected_count,
            "online_ids": list(conns),
        }

        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "lobby_state", **message},
        )

    async def lobby_state(self, event):
        """Send lobby_state updates to each client."""
        await self.send_json({
            "type": "lobby_state",
            "created_at": event.get("created_at"),
            "join_deadline_at": event.get("join_deadline_at"),
            "server_now": event.get("server_now"),
            "ready_count": event.get("ready_count"),
            "expected_count": event.get("expected_count"),
            "online_ids": event.get("online_ids"),
        })

    @sync_to_async
    def _save_zero_score_if_needed(self):
        """If a player disconnects early, save a 0 score."""
        gs = TypingRaceGameState.objects.select_related("challenge", "game").get(id=self.game_state_id)
        today = date.today()

        exists = GamePerformance.objects.filter(
            challenge=gs.challenge,
            game=gs.game,
            user=self.user,
            date=today
        ).exists()

        if not exists:
            GamePerformance.objects.update_or_create(
                challenge=gs.challenge,
                game=gs.game,
                user=self.user,
                date=today,
                defaults={"score": 0, "auto_generated": True}
            )
            print(f"[TypingRace][SCORE] Auto-saved 0 for {self.user.username}")
