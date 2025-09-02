# ws_smoke_test.py
import os
import sys
import asyncio
import time

# --- logging（讓 Channels/consumer 的 log 也印到 console）---
import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stdout,
)

# 1) 設定 Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "myserver.settings")
import django
django.setup()

# 2) 用 InMemory channel layer（避免需要 Redis）
from django.conf import settings
settings.CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

# 3) 匯入需要的 model / utils / application
from django.contrib.auth import get_user_model
from api.models import GameCategory, Game, Challenge, ChallengeMembership
from api.patternMem.utils import get_or_create_pattern_game
from channels.testing import WebsocketCommunicator
from myserver.asgi import application
from asgiref.sync import sync_to_async

User = get_user_model()

# 小工具：等到指定 type 的訊息；一路把收到的訊息都列印出來，方便 debug
async def wait_for_types(comm, wanted_types, total_timeout=12.0, per_msg_timeout=1.5, max_msgs=100):
    start = time.monotonic()
    seen = []
    while time.monotonic() - start < total_timeout and len(seen) < max_msgs:
        try:
            msg = await comm.receive_json_from(timeout=per_msg_timeout)
            print("[DEBUG From test] 收到：", msg)
            seen.append(msg)
            if msg.get("type") in wanted_types:
                return msg, seen
        except asyncio.TimeoutError:
            # 短暫沒訊息就繼續等，直到 total_timeout
            pass
    print("⚠️ wait_for_types 超時，期間內所收集的訊息：")
    for i, m in enumerate(seen, 1):
        print(f"  #{i}: {m}")
    raise asyncio.TimeoutError(f"Did not receive any of {wanted_types} within {total_timeout}s")


async def smoke_min_flow():
    print("=== 測試：最小流程（ready → 倒數 → game_start → pattern_sequence） ===")

    # 使用/建立一個測試使用者
    try:
        u = await sync_to_async(User.objects.get)(username="ws_user_min")
    except User.DoesNotExist:
        u = await sync_to_async(User.objects.create_user)(username="ws_user_min", password="x")

    # 準備類別與遊戲（get_or_create 避免重複）
    cat, _ = await sync_to_async(GameCategory.objects.get_or_create)(
        categoryName="Memory", isMultiplayer=True
    )
    game, _ = await sync_to_async(Game.objects.get_or_create)(
        name="Pattern Memorization", category=cat
    )
    # 準備挑戰（get_or_create，避免多筆同名引發 MultipleObjectsReturned）
    chall, _ = await sync_to_async(Challenge.objects.get_or_create)(
        name="Ch-min",
        defaults={"startDate": "2025-01-01", "endDate": "2025-01-10"}
    )

    # ⭐ 確保這個使用者在這個挑戰裡（關鍵，讓 expected_count > 0）
    await sync_to_async(ChallengeMembership.objects.get_or_create)(
        challengeID=chall,
        uID=u
    )

    # 取得或建立此挑戰對應的 pattern 遊戲狀態
    payload = await sync_to_async(get_or_create_pattern_game)(
        challenge_id=chall.id,
        user=u
    )
    gs_id = payload["game_state_id"]

    # 建立 WebSocket 連線 & 模擬已登入使用者
    comm = WebsocketCommunicator(application, f"/ws/pattern/{gs_id}/")
    comm.scope["user"] = u

    connected, _ = await comm.connect()
    print("連線結果 connected =", connected)
    assert connected

    # 先收初始化訊息（應會有 lobby_state）
    try:
        init1 = await comm.receive_json_from(timeout=2.0)
        print("[init] 收到：", init1)
    except Exception:
        print("⚠️ 沒有在 2 秒內收到初始化訊息（lobby_state），請檢查 consumer.connect()")
        await comm.disconnect()
        return

    # 送出 ready → 期待收到 3..2..1 的 lobby_countdown，之後 game_start 會觸發 pattern_sequence
    await comm.send_json_to({"type": "player_ready"})

    # 你可以先看到一串 lobby_countdown（非必要），直接等 pattern_sequence 即可
    # msg, seen = await wait_for_types(
    #     comm,
    #     wanted_types={"pattern_sequence"},
    #     total_timeout=12.0,   # 給足夠時間跑 3 秒倒數 + 處理
    #     per_msg_timeout=5.0
    # )

    # 成功拿到當前 round 的序列
    sequence = msg["sequence"]
    round_number = msg["round_number"]
    print(f"[OK] 收到第 {round_number} 回合序列：", sequence)

    await comm.disconnect()
    print("=== 測試完成 ===\n")


async def main():
    await smoke_min_flow()

if __name__ == "__main__":
    asyncio.run(main())
