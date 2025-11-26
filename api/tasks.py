"""
/**
 * @file tasks.py
 * @description Celery tasks for opening and closing join windows,
 * creating game states, handling zero-fill scoring, and broadcasting
 * join-window updates to websocket groups.
 */
"""

from datetime import date, timedelta
import logging

from asgiref.sync import async_to_sync
from celery import shared_task, uuid
from channels.layers import get_channel_layer
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db.models import F
from django.utils import timezone

from api.patternMem.utils import get_or_create_pattern_game as pattern_init
from api.sudokuStuff.utils import get_or_create_game as sudoku_init
from api.typingRaceStuff.utils import get_or_create_typing_race_game as typing_init
from api.wordleStuff.utils import get_or_create_game_wordle as wordle_init

from .models import (
    Challenge,
    ChallengeMembership,
    Game,
    GamePerformance,
    GameSchedule,
    GameScheduleGameAssociation,
    PatternMemorizationGamePlayer,
    PatternMemorizationGameState,
    SudokuGamePlayer,
    SudokuGameState,
    TypingRaceGamePlayer,
    TypingRaceGameState,
    WordleGamePlayer,
    WordleGameState,
)

# ---------- helper ----------
def _normalize_game_code(game_code: str) -> str:
    code = (game_code or "").strip().lower().replace(" ", "").replace("-", "").replace("_", "")
    alias = {
        "sudoku": "sudoku",
        "wordle": "wordle",
        "pattern": "pattern",
        "patternmemorization": "pattern",
        "typing": "typing",
        "typingrace": "typing",
    }
    return alias.get(code, code)


def _game_state_model(game_code):
    code = _normalize_game_code(game_code)
    return {
        "sudoku": SudokuGameState,
        "wordle": WordleGameState,
        "pattern": PatternMemorizationGameState,
        "typing": TypingRaceGameState,
    }[code]

User = get_user_model()
logger = logging.getLogger(__name__)

# A. fire at alarm-time
@shared_task
def open_join_window(challenge_id, game_id, game_code, user_id=None):
    """
    Opens the join window for a game at alarm time.
    Helpers now use proper get_or_create with unique constraints to prevent race conditions.
    """
    code = _normalize_game_code(game_code)
    Model = _game_state_model(code)
    ch = Challenge.objects.get(pk=challenge_id)
    
    # Get the game to determine if it's multiplayer or singleplayer
    try:
        game = Game.objects.get(pk=game_id)
        is_multiplayer = bool(getattr(game, 'isMultiplayer', False))
        print(f"[open-join-window] Game '{game.name}' (id={game_id}) is_multiplayer={is_multiplayer}")
    except Game.DoesNotExist:
        print(f"[open-join-window] Game {game_id} not found, defaulting to multiplayer")
        is_multiplayer = True
    
    if is_multiplayer:
        # MULTIPLAYER LOGIC: Create one shared game state
        print(f"[open-join-window] Creating multiplayer game state")
        
        # Get user (assume user_id is passed in from collaborative setup)
        user = None
        if user_id is not None:
            try:
                user = User.objects.get(pk=user_id)
                print(f"[open-join-window] Using provided user_id={user_id}, user={user.username}")
            except User.DoesNotExist:
                user = None
                print(f"[open-join-window] Provided user_id={user_id} not found")
        else:
            print(f"[open-join-window] No user_id provided, using fallback logic")
        
        # Fallback to initiator or first member if no user_id
        if user is None:
            user = getattr(ch, "initiator", None)
            if user:
                print(f"[open-join-window] Using challenge initiator: {user.username} (id={user.id})")
        if user is None:
            first_uid = ChallengeMembership.objects.filter(challengeID=ch).values_list("uID_id", flat=True).first()
            if first_uid:
                user = User.objects.filter(pk=first_uid).first()
                if user:
                    print(f"[open-join-window] Using first member: {user.username} (id={user.id})")
        if user is None:
            user = User.objects.order_by("id").first()
            if user:
                print(f"[open-join-window] Using first user in system: {user.username} (id={user.id})")
        
        # Create single multiplayer game state
        _create_single_game_state(ch, game, user, code)
        
    else:
        # SINGLEPLAYER LOGIC: Create game state for specific user or all participants
        if user_id is not None:
            # SPECIFIC USER: Create game state only for the specified user (new individual alarm approach)
            try:
                specific_user = User.objects.get(pk=user_id)
                print(f"[open-join-window] Creating singleplayer game for specific user {specific_user.username} (id={user_id})")
                _create_single_game_state(ch, game, specific_user, code)
            except User.DoesNotExist:
                print(f"[open-join-window] Specific user {user_id} not found, skipping")
        else:
            # ALL PARTICIPANTS: Create separate game states for each participant (legacy approach)
            print(f"[open-join-window] Creating singleplayer game states for each participant")
            
            # Get all challenge participants
            participant_ids = list(
                ChallengeMembership.objects.filter(challengeID=ch)
                                        .values_list("uID_id", flat=True)
            )
            print(f"[open-join-window] Singleplayer participants: {participant_ids}")
            
            # Create separate game state for each participant
            for participant_id in participant_ids:
                try:
                    participant_user = User.objects.get(pk=participant_id)
                    print(f"[open-join-window] Creating singleplayer game for user {participant_user.username} (id={participant_id})")
                    _create_single_game_state(ch, game, participant_user, code)
                except User.DoesNotExist:
                    print(f"[open-join-window] Participant {participant_id} not found, skipping")


def _create_single_game_state(challenge, game, user, code):
    """
    Helper function to create a single game state and schedule its close_join_window task.
    """
    print(f"[create-game-state] Creating {code} game for user {user.username} (id={user.id}) in challenge {challenge.id}")
    
    # Use current time as alarm_datetime
    alarm_datetime = timezone.now()
    
    # Call helper functions which now use proper get_or_create
    if code == "sudoku":
        gs_dict = sudoku_init(challenge.id, user, allow_join=False, alarm_datetime=alarm_datetime)
        gs = SudokuGameState.objects.get(pk=gs_dict["game_state_id"])
        Model = SudokuGameState
    elif code == "wordle":
        gs_dict = wordle_init(challenge.id, user, allow_join=False, alarm_datetime=alarm_datetime)
        gs = WordleGameState.objects.get(pk=gs_dict["game_state_id"])
        Model = WordleGameState
    elif code == "pattern":
        gs_dict = pattern_init(challenge.id, user, allow_join=False, alarm_datetime=alarm_datetime)
        gs = PatternMemorizationGameState.objects.get(pk=gs_dict["game_state_id"])
        Model = PatternMemorizationGameState
    elif code == "typing":
        gs_dict = typing_init(challenge.id, user, allow_join=False)
        gs = TypingRaceGameState.objects.get(pk=gs_dict["game_state_id"])
        Model = TypingRaceGameState
    else:
        print(f"[create-game-state] Unknown game code: {code}")
        return  # unknown game type
    
    print(f"[create-game-state] Created {Model.__name__} id={gs.id} for user {user.username}")
    
    # Schedule close_join_window task (refresh stale or missing deadline)
    now = timezone.now()
    if not gs.join_deadline_at or gs.join_deadline_at <= now:
        window = int(getattr(settings, "JOIN_WINDOW_SECONDS", 20) or 20)
        gs.join_deadline_at = now + timedelta(seconds=window)
        gs.save(update_fields=["join_deadline_at"])
    
    logger.info(
        "[join-window] scheduling close for %s id=%s at %s (now=%s)",
        Model.__name__, gs.id, gs.join_deadline_at, now
    )
    close_join_window.apply_async(
        args=[Model.__name__, gs.id],
        eta=gs.join_deadline_at,
        taREDACTEDid=f"close-{Model.__name__}-{gs.id}-{uuid()}",
    )
    # Prevent duplicate scheduling by consumers
    cache.add(f"pm_deadline_scheduled_{gs.id}", True, timeout=3600)
    
    print(f"[create-game-state] Scheduled close_join_window for {Model.__name__} id={gs.id} at {gs.join_deadline_at}")
    return gs

# B. fire 2 minutes later
@shared_task
def close_join_window(model_name, gs_id):
    Model = globals()[model_name]
    gs = Model.objects.select_related("challenge", "game").get(pk=gs_id)
    logger.info(
        "[join-window] executing close for %s id=%s at %s (deadline=%s)",
        model_name, gs_id, timezone.now(), getattr(gs, "join_deadline_at", None)
    )
    if gs.joins_closed:
        print(f"[join-window] Game {gs_id} already has joins_closed=True")
        # Check if absent player scoring was already done by this task
        absent_scoring_key = f"absent_scoring_done_{model_name}_{gs_id}"
        if cache.get(absent_scoring_key):
            print(f"[join-window] Absent player scoring already completed for {gs_id}, skipping")
            return
        else:
            print(f"[join-window] Absent player scoring not done yet, proceeding with scoring logic")
    else:
        print(f"[join-window] Game {gs_id} joins_closed=False, proceeding normally")  

    today = timezone.localdate()
    
    # Determine if this is a multiplayer game based on Game.isMultiplayer
    try:
        is_multiplayer = bool(getattr(gs.game, 'isMultiplayer', False))
    except Exception:
        is_multiplayer = False
    
    # Determine if this is a personal challenge (groupID is null AND not public)
    is_personal_challenge = gs.challenge.groupID is None and not gs.challenge.isPublic
    
    # For singleplayer games, only consider the intended user
    intended_user_id = getattr(gs, 'user_id', None)
    
    if not is_multiplayer and not is_personal_challenge and intended_user_id:
        # SINGLEPLAYER GROUP/PUBLIC CHALLENGE: Only consider the intended user
        participant_ids = {intended_user_id}
        print(f"[join-window] Singleplayer game - only considering intended user: participant_ids={participant_ids}")
    else:
        # MULTIPLAYER OR PERSONAL CHALLENGE: Consider all participants
        participant_ids = set(
            ChallengeMembership.objects.filter(challengeID=gs.challenge)
                                    .values_list("uID_id", flat=True)
        )
        print(f"[join-window] Multiplayer/Personal game - all participants: participant_ids={participant_ids}")

    # Get users who already have GamePerformance entries
    if not is_multiplayer and not is_personal_challenge and intended_user_id:
        # SINGLEPLAYER GROUP/PUBLIC CHALLENGE: Only check if intended user has existing performance
        existing_ids = set(
            GamePerformance.objects.filter(
                challenge=gs.challenge,
                game=gs.game,
                date=today,
                user_id=intended_user_id  # Only check intended user
            ).values_list("user_id", flat=True)
        )
        print(f"[join-window] Singleplayer existing_ids (intended user only): {existing_ids}")
    else:
        # MULTIPLAYER OR PERSONAL CHALLENGE: Check all participants
        existing_ids = set(
            GamePerformance.objects.filter(
                challenge=gs.challenge,
                game=gs.game,
                date=today
            ).values_list("user_id", flat=True)
        )
        print(f"[join-window] Multiplayer/Personal existing_ids (all participants): {existing_ids}")

    # Get users who joined the game (connected or have DB player records)
    present_ids = set()
    if model_name == 'TypingRaceGameState':
        connected_ids = set(cache.get(f"typing_conns_{gs.id}") or [])
        db_player_ids = set(
            TypingRaceGamePlayer.objects.filter(game_state=gs.id).values_list("player_id", flat=True)
        )
        print(f"[join-window] TypingRace connected_ids={connected_ids}, db_player_ids={db_player_ids}")
        present_ids = connected_ids.union(db_player_ids)
    elif model_name == 'PatternMemorizationGameState':
        connected_ids = set(cache.get(f"pm_conns_{gs.id}") or [])
        db_player_ids = set(
            PatternMemorizationGamePlayer.objects.filter(game_state=gs.id).values_list("player_id", flat=True)
        )
        print(f"[join-window] Pattern connected_ids={connected_ids}, db_player_ids={db_player_ids}")
        present_ids = connected_ids.union(db_player_ids)
    elif model_name == 'WordleGameState':
        connected_ids = set(cache.get(f"wordle_conns_{gs.id}") or [])
        db_player_ids = set(
            WordleGamePlayer.objects.filter(gameState=gs.id).values_list("player_id", flat=True)
        )
        print(f"[join-window] Wordle connected_ids={connected_ids}, db_player_ids={db_player_ids}")
        present_ids = connected_ids.union(db_player_ids)
    elif model_name == 'SudokuGameState':
        connected_ids = set(cache.get(f"sdk_conns_{gs.id}") or [])
        db_player_ids = set(
            SudokuGamePlayer.objects.filter(gameState=gs.id).values_list("player_id", flat=True)
        )
        print(f"[join-window] Sudoku connected_ids={connected_ids}, db_player_ids={db_player_ids}")
        present_ids = connected_ids.union(db_player_ids)
    
    print(f"[join-window] present_ids (joined game)={present_ids}")

    # Calculate absent players (those who didn't join the game)
    absent_ids = (participant_ids - existing_ids) - present_ids
    print(f"[join-window] absent_ids={absent_ids}")

    if is_personal_challenge:
        # Personal Challenge Logic
        print(f"[join-window] Personal challenge detected")
        
        owner_id = getattr(gs, 'user_id', None)
        print(f"[join-window] Personal challenge owner_id={owner_id}")
        print(f"[join-window] Personal challenge present_ids={present_ids}")
        print(f"[join-window] Personal challenge absent_ids={absent_ids}")
        
        if owner_id:
            # Check if owner joined their own game
            if owner_id in present_ids:
                print(f"[join-window] Personal challenge owner {owner_id} joined game, waiting for completion")
            else:
                # Owner didn't join their own game, give them 0
                print(f"[join-window] Personal challenge owner {owner_id} was absent, giving 0 score")
                GamePerformance.objects.get_or_create(
                    challenge=gs.challenge,
                    game=gs.game,
                    user_id=owner_id,
                    date=today,
                    defaults={"score": 0, "auto_generated": True},
                )
        
        # For personal challenges, do NOT give 0 scores to other participants
        # Personal challenges are individual - only the owner should be scored
        # Other participants will have their own separate personal challenge instances
        print(f"[join-window] Personal challenge: ignoring other participants, only owner matters")
                
    elif is_multiplayer:
        # Multiplayer Game Logic (Group/Public Challenges)
        print(f"[join-window] Multiplayer game detected")
        
        # For multiplayer games, give 0 scores to all absent players immediately
        # Absent = participants who didn't join the game (not in present_ids)
        multiplayer_absent_ids = participant_ids - present_ids
        print(f"[join-window] Multiplayer absent calculation: participant_ids={participant_ids}, present_ids={present_ids}")
        print(f"[join-window] Multiplayer absent_ids={multiplayer_absent_ids}")
        
        for uid in multiplayer_absent_ids:
            # Only give 0 score if they don't already have a score
            if uid not in existing_ids:
                print(f"[join-window] Multiplayer participant {uid} was absent, giving 0 score")
                GamePerformance.objects.get_or_create(
                    challenge=gs.challenge,
                    game=gs.game,
                    user_id=uid,
                    date=today,
                    defaults={"score": 0, "auto_generated": True},
                )
            else:
                print(f"[join-window] Multiplayer participant {uid} was absent but already has a score, skipping")
    else:
        # Singleplayer Game Logic (Group/Public Challenges)
        print(f"[join-window] Singleplayer game detected")
        print(f"[join-window] Singleplayer present_ids={present_ids}")
        # For singleplayer games in group/public challenges:
        # Each singleplayer game instance is for a specific user (gs.user_id)
        # We should ONLY consider the intended user, not all challenge participants
        
        intended_user_id = getattr(gs, 'user_id', None)
        print(f"[join-window] Singleplayer intended_user_id={intended_user_id}")
        
        if intended_user_id:
            # Only check if the intended user joined their own game
            if intended_user_id in present_ids:
                print(f"[join-window] Singleplayer user {intended_user_id} joined their game, waiting for completion")
            else:
                print(f"[join-window] Singleplayer user {intended_user_id} was absent from their own game, giving 0 score")
                GamePerformance.objects.get_or_create(
                    challenge=gs.challenge,
                    game=gs.game,
                    user_id=intended_user_id,
                    date=today,
                    defaults={"score": 0, "auto_generated": True},
                )
        else:
            print(f"[join-window] Singleplayer game has no intended user, skipping absent player logic")
        
        # IMPORTANT: Do NOT give 0 scores to other challenge participants
        # Each participant will have their own separate singleplayer game instance
        # Other participants should be completely ignored by this game instance

    # Mark absent player scoring as completed
    absent_scoring_key = f"absent_scoring_done_{model_name}_{gs_id}"
    cache.set(absent_scoring_key, True, timeout=3600)  # Cache for 1 hour
    print(f"[join-window] Marked absent scoring as completed for {gs_id}")
    
    gs.joins_closed = True
    gs.save(update_fields=["joins_closed"])

    # Notify connected clients via Channels to auto-start
    # Broadcast join window closed (best-effort)
    try:
        prefix = {
            'SudokuGameState': 'sudoku',
            'WordleGameState': 'wordle',
            'PatternMemorizationGameState': 'pattern',
            'TypingRaceGameState': 'typing',
        }[model_name]
        group = f"{prefix}_{gs.id}"
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            group,
            {
                'type': 'join_window_closed',
                'server_now': timezone.now().isoformat(),
            }
        )
        logger.info("Passing......")
    except Exception:
        logger.exception("Failed to broadcast join_window_closed for %s %s", model_name, gs_id)