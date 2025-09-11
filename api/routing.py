from django.urls import re_path
from api.sudokuStuff import consumers
from api.wordleStuff import consumers as wc
from api.patternMem.consumers import PatternMemorizationConsumer

websocket_urlpatterns = [
    re_path(r'ws/sudoku/(?P<game_state_id>\d+)/$', consumers.SudokuConsumer.as_asgi()),
    re_path(r'ws/wordle/(?P<game_state_id>\d+)/$', wc.WordleConsumer.as_asgi()),
    re_path(r'ws/pattern/(?P<game_state_id>\d+)/$', PatternMemorizationConsumer.as_asgi()),
]