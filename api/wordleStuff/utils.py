from api.models import GameCategory, WordleGameState, Challenge, WordleGamePlayer, Game, WordleMove
import random
from django.db import transaction
from asgiref.sync import sync_to_async
from api.words_array import words

MAX_ATTEMPTS = 5  # frontend also defines 5 rows


@transaction.atomic
def get_or_create_game_wordle(challenge_id, user):
    """
    Create or reuse a WordleGameState for a given challenge.
    Ensure the user is recorded as a player.
    """
    challenge = Challenge.objects.get(id=challenge_id)
    is_multiplayer = challenge.groupID is not None

    # Ensure the game category exists
    category, _ = GameCategory.objects.get_or_create(
        categoryName="Word Games",
        defaults={"skilllevel": 1}
    )

    # Ensure the base Wordle Game exists (fixed id=30)
    game, _ = Game.objects.update_or_create(
        id=30,
        defaults={
            "name": "Wordle",
            "category": category,
            "isMultiplayer": is_multiplayer,
        }
    )

    # Check if a WordleGameState already exists
    game_state = WordleGameState.objects.filter(challenge=challenge).first()

    if not game_state:
        target_word = random.choice(words).upper()
        puzzle = ["_"] * len(target_word)     # initial empty puzzle
        solution = list(target_word)          # solution stored as list of chars

        game_state = WordleGameState.objects.create(
            game=game,
            challenge=challenge,
            puzzle=puzzle,
            solution=solution,
            answer=target_word,               # keep string version for debugging
        )
        print(f"[WORDLE][create] chall={challenge.id} gs={game_state.id} answer={target_word}", flush=True)

    # Ensure user is recorded as a player
    WordleGamePlayer.objects.get_or_create(
        gameState=game_state,
        player=user,
        defaults={'accuracyCount': 0, 'inaccuracyCount': 0, 'color': None}
    )

    return {
        "game_state_id": game_state.id,
        "puzzle": game_state.puzzle,
        "is_multiplayer": is_multiplayer,
        "answer": game_state.answer,  # ⚠️ for debugging only
    }


@transaction.atomic
def validate_wordle_move_sync(game_state_id, user, guess, row):
    """
    Sync function: Validate a Wordle guess and return feedback, correctness, completion, and scores.
    """
    game_state = WordleGameState.objects.get(id=game_state_id)
    solution = game_state.solution
    guess = guess.upper()

    feedback = []
    solution_chars = solution.copy()

    # Step 1: mark exact matches
    for i, char in enumerate(guess):
        if i < len(solution) and char == solution[i]:
            feedback.append({"letter": char, "result": "correct"})
            solution_chars[i] = None
        else:
            feedback.append({"letter": char, "result": "absent"})

    # Step 2: mark misplaced letters (present but wrong position)
    for i, f in enumerate(feedback):
        if f["result"] == "absent" and f["letter"] in solution_chars:
            feedback[i]["result"] = "present"
            solution_chars[solution_chars.index(f["letter"])] = None

    # Save the move
    WordleMove.objects.update_or_create(
        gameState=game_state,
        player=user,
        row=row,
        defaults={"guess": guess}
    )

    # Update player stats
    player_record, _ = WordleGamePlayer.objects.get_or_create(
        gameState=game_state,
        player=user,
        defaults={'accuracyCount': 0, 'inaccuracyCount': 0}
    )

    is_correct = guess == "".join(solution)

    if is_correct:
        player_record.accuracyCount += 1
    else:
        player_record.inaccuracyCount += 1
    player_record.save()

    # Check if game is complete
    is_complete = is_correct or (row >= MAX_ATTEMPTS - 1)

    # Score rule: earlier correct guesses get higher score
    score_awarded = 0
    if is_correct:
        base_score = 100 // MAX_ATTEMPTS
        score_awarded = 100 - (row * base_score)

    # Debug log
    print(
        f"[WORDLE][validate] gs={game_state_id} user={user.username} row={row} "
        f"guess={guess} solution={''.join(solution)} correct={is_correct} complete={is_complete} "
        f"score_awarded={score_awarded}",
        flush=True
    )

    # Leaderboard: dynamically compute score for each player
    scores = []
    players = WordleGamePlayer.objects.filter(gameState=game_state)

    for p in players:
        last_move = WordleMove.objects.filter(gameState=game_state, player=p.player).order_by("-row").first()
        if p.accuracyCount > 0 and last_move:
            base_score = 100 // MAX_ATTEMPTS
            score = 100 - last_move.row * base_score
        else:
            score = 0
        scores.append({
            "username": p.player.username,
            "score": score,
        })

    # Sort leaderboard by score descending
    scores = sorted(scores, key=lambda x: x["score"], reverse=True)

    return {
        "feedback": feedback,
        "is_correct": is_correct,
        "is_complete": is_complete,
        "score_awarded": score_awarded,
        "scores": scores,
    }


# Async wrappers for websocket usage
validate_wordle_move = sync_to_async(validate_wordle_move_sync, thread_sensitive=True)
get_or_create_game_wordle_async = sync_to_async(get_or_create_game_wordle, thread_sensitive=True)
