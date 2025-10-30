from datetime import date, timedelta
from django.utils import timezone
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from asgiref.sync import sync_to_async
from django.core.cache import cache

from api.models import (
    TypingRaceGameState,
    TypingRaceGamePlayer,
    User,
    GamePerformance,
    ChallengeMembership
)
from api.typingRaceStuff.utils import apply_progress_update_async


def _conns_key(game_id: int): return f"typing_conns_{game_id}"
def _saved_key(game_id: int): return f"typing_scores_saved_{game_id}"
CACHE_TTL = 3600


class TypingRaceConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.game_id = int(self.scope["url_route"]["kwargs"]["game_id"])
        self.room_group_name = f"typing_{self.game_id}"
        self.user: User = self.scope["user"]

        if not self.user.is_authenticated:
            await self.close()
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        conns = set(cache.get(_conns_key(self.game_id)) or [])
        conns.add(self.user.id)
        cache.set(_conns_key(self.game_id), list(conns), timeout=CACHE_TTL)

        await self._add_player()
        await self._broadcast_lobby_state()

        await self.send_json({
            "type": "connection_success",
            "message": f"Connected as {self.user.username}",
        })

    async def disconnect(self, close_code):
        username = self.user.username
        print(f"[TypingRace][DISCONNECT] user={username}")

        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

        conns = set(cache.get(_conns_key(self.game_id)) or [])
        if self.user.id in conns:
            conns.remove(self.user.id)
        cache.set(_conns_key(self.game_id), list(conns), timeout=CACHE_TTL)

        await self._save_zero_score_if_needed()
        await self._broadcast_lobby_state()

        if not conns:
            cache.delete(_conns_key(self.game_id))
            cache.delete(_saved_key(self.game_id))
            print(f"[TypingRace][CLEANUP] Cache cleared for game_id={self.game_id}")

    async def receive_json(self, data):
        msg_type = data.get("type")

        if msg_type == "start_game":
            await self._handle_start_game()
        elif msg_type == "progress_update":
            await self._handle_progress_update(
                data.get("total_typed", 0), data.get("total_errors", 0)
            )
        elif msg_type == "game_finished":
            await self._handle_game_finished()

    async def _handle_start_game(self):
        await self.channel_layer.group_send(
            self.room_group_name, {"type": "join_window_closed"}
        )
        await self.send_json({"type": "join_window_closed"})

    async def _handle_progress_update(self, total_typed, total_errors):
        result = await apply_progress_update_async(self.game_id, self.user, total_typed, total_errors)
        leaderboard = result.get("scores", [])
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "leaderboard_update", "leaderboard": leaderboard},
        )

    async def _handle_game_finished(self):
        try:
            gs = await sync_to_async(TypingRaceGameState.objects.get)(id=self.game_id)
            all_players = await sync_to_async(list)(
                TypingRaceGamePlayer.objects.filter(game_state=gs)
            )
            leaderboard = [
                {
                    "username": p.player.username,
                    "score": round(p.final_score, 2),
                    "progress": round(p.progress, 2),
                    "accuracy": round(p.accuracy, 2),
                    "is_completed": p.is_completed,
                } for p in all_players
            ]

            all_done = all(p.is_completed for p in all_players)
            if all_done and leaderboard:
                sorted_lb = sorted(leaderboard, key=lambda x: x["score"], reverse=True)
                winner = sorted_lb[0]["username"]
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "game_complete",
                        "leaderboard": sorted_lb,
                        "winner": winner,
                        "is_complete": True,
                    },
                )

        except Exception as e:
            print(f"[TypingRace][ERROR] in game_finished: {e}")
            await self.send_json({
                "type": "error",
                "message": f"Game finish failed: {str(e)}"
            })

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
            "winner": event.get("winner"),
            "is_complete": event.get("is_complete", True),
        })

    async def join_window_closed(self, event):
        await self.send_json({"type": "join_window_closed"})

    async def _add_player(self):
        gs = await sync_to_async(TypingRaceGameState.objects.get)(id=self.game_id)
        await sync_to_async(TypingRaceGamePlayer.objects.get_or_create)(
            game_state=gs, player=self.user,
        )

    async def _broadcast_lobby_state(self):
        conns = set(cache.get(_conns_key(self.game_id)) or [])
        ready_count = len(conns)
        try:
            gs = await sync_to_async(TypingRaceGameState.objects.get)(id=self.game_id)
            expected_count = await sync_to_async(
                ChallengeMembership.objects.filter(challengeID=gs.challenge).count
            )()
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
        await self.channel_layer.group_send(self.room_group_name, message)

    async def lobby_state(self, event):
        await self.send_json(event)

    @sync_to_async
    def _save_zero_score_if_needed(self):
        gs = TypingRaceGameState.objects.select_related("challenge", "game").get(id=self.game_id)
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
