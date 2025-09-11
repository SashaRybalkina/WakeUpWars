from api.models import GameCategory, WordleGameState, Challenge, WordleGamePlayer, User, Game, WordleMove
from sudoku import Sudoku
import time
import random
from django.db import transaction
from asgiref.sync import sync_to_async
from api.words_array import words


def get_or_create_game_wordle(challenge_id, user):
    # make sure the challenge exists
    challenge = Challenge.objects.get(id=challenge_id)
    is_multiplayer = challenge.groupID is not None

    # ensure the base Game + Category exist
    category, _ = GameCategory.objects.get_or_create(
        categoryName="Word Games",
        defaults={"skilllevel": 1}  # or whatever default makes sense for your model
    )

    game, _ = Game.objects.update_or_create(
        id=30,  # fixed id for Wordle
        defaults={
            "name": "Wordle",
            "category": category,
            "solution": "white",
            "isMultiplayer": is_multiplayer,
        }
    )

    # see if a WordleGameState already exists for this challenge
    game_state = WordleGameState.objects.filter(challenge=challenge).first()

    if not game_state:
        target_word = random.choice(words).upper()
        print(f"Creating new Wordle game state for challenge {challenge.id} with word {target_word}")

        game_state = WordleGameState.objects.create(
            game=game,
            challenge=challenge,
            puzzle=target_word,
            solution=target_word,
        )

    # link the user as a player in this game state
    WordleGamePlayer.objects.get_or_create(
        gameState=game_state,
        player=user,
        defaults={'accuracyCount': 0, 'inaccuracyCount': 0}
    )

    # return info for frontend
    return {
        "game_state_id": game_state.id,
        "puzzle": "_" * len(game_state.puzzle),
        "is_multiplayer": is_multiplayer,
    }
    

def validate_wordle_move(game_state_id, user, guess, row):
    game_state = WordleGameState.objects.get(id=game_state_id)
    solution = game_state.solution.upper()
    guess = guess.upper()

    feedback = []
    solution_chars = list(solution)

    # Mark exact matches first
    for i, char in enumerate(guess):
        if i < len(solution) and char == solution[i]:
            feedback.append({"letter": char, "result": "correct"})
            solution_chars[i] = None
        else:
            feedback.append({"letter": char, "result": "absent"})

    # Mark misplaced (yellow)
    for i, f in enumerate(feedback):
        if f["result"] == "absent" and f["letter"] in solution_chars:
            feedback[i]["result"] = "present"
            solution_chars[solution_chars.index(f["letter"])] = None

    # Save move
    WordleMove.objects.update_or_create(
        gameState=game_state,
        player=user,
        row=row,
        defaults={"guess": guess}
    )

    # Update accuracy stats
    player_record, _ = WordleGamePlayer.objects.get_or_create(
        gameState=game_state,
        player=user,
        defaults={'accuracyCount': 0, 'inaccuracyCount': 0}
    )

    if guess == solution:
        player_record.accuracyCount += 1
    else:
        player_record.inaccuracyCount += 1
    player_record.save()

    # Check completion
    is_complete = guess == solution

    # Build scores leaderboard
    scores = [
        {
            "username": p.player.username,
            "accuracy": p.accuracyCount,
            "inaccuracy": p.inaccuracyCount,
        }
        for p in WordleGamePlayer.objects.filter(gameState=game_state)
    ]

    return {
        "feedback": feedback,
        "is_correct": guess == solution,
        "is_complete": is_complete,
        "scores": scores,
    }