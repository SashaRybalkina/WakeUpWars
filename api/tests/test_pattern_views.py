# tests/test_pattern_views.py
import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from api.models import Challenge, Game, GameCategory

User = get_user_model()

@pytest.mark.django_db
def test_create_pattern_game_view():
    client = APIClient()

    user = User.objects.create_user(username="alice", password="pw")
    client.force_authenticate(user=user)

    cat = GameCategory.objects.create(categoryName="Memory", isMultiplayer=True)
    Game.objects.create(name="Pattern Memorization", category=cat)

    challenge = Challenge.objects.create(name="Ch", startDate="2025-01-01", endDate="2025-01-10")

    resp = client.post("/api/pattern/create/", {"challenge_id": challenge.id}, format="json")
    
    assert resp.status_code == 200

@pytest.mark.django_db
def test_validate_pattern_move_view():
    client = APIClient()
    user = User.objects.create_user(username="bob", password="pw")
    client.force_authenticate(user=user)

    cat = GameCategory.objects.create(categoryName="Memory", isMultiplayer=True)
    Game.objects.create(name="Pattern Memorization", category=cat)
    challenge = Challenge.objects.create(name="Ch2", startDate="2025-01-01", endDate="2025-01-10")

    from api.patternMem.utils import get_or_create_pattern_game
    payload = get_or_create_pattern_game(challenge.id, user)

    game_state_id = payload["game_state_id"]
    first_round_sequence = payload["pattern_sequence"][0]

    resp = client.post("/api/pattern/validate/", {
        "game_state_id": game_state_id,
        "round_number": 1,
        "player_sequence": first_round_sequence
    }, format="json")

    assert resp.status_code == 200
    assert resp.json()["success"] is True

# pytest -s -vv api/tests/test_pattern_views.py
