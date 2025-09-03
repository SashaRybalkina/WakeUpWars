import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRoute, NavigationProp } from '@react-navigation/native';
import { endpoints, BASE_URL } from '../../api';
import { useUser } from '../../context/UserContext';

// Component props type
type Props = {
  navigation: NavigationProp<any>;
};

// Define possible colors for the pattern
const COLORS = ["red", "blue", "green", "yellow"];

const PatternGameScreen: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { challengeId, challName, whichChall } = route.params as {
    challengeId: number;
    challName: string;
    whichChall: string;
  };

  const { user } = useUser();
  const [socket, setSocket] = useState<WebSocket | null>(null);

  // Game-related state
  const [gameStateId, setGameStateId] = useState<number | null>(null);
  const [readyCount, setReadyCount] = useState<number>(0);
  const [expectedCount, setExpectedCount] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentPattern, setCurrentPattern] = useState<string[]>([]);
  const [playerSequence, setPlayerSequence] = useState<string[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [gameOver, setGameOver] = useState<boolean>(false);

  // 🔁 Function: Initialize the game
  const initGame = async () => {
    try {
      // Get CSRF token
      const token = await fetch(`${BASE_URL}/api/csrf-token/`, {
        credentials: 'include',
      });
      const tokenData = await token.json();
      const csrfToken = tokenData.csrfToken;

      // Call backend to create new pattern game
      const res = await fetch(endpoints.createPatternGame, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ challenge_id: challengeId }),
      });

      const data = await res.json();
      console.log("Pattern game created:", data);

      setGameStateId(data.game_state_id);

      // 📡 Setup WebSocket
      const ws = new WebSocket(
        `${BASE_URL.replace(/^http/, 'ws')}/ws/pattern/${data.game_state_id}/`
      );

      ws.onopen = () => console.log("[WS] Connected to pattern game");

      ws.onmessage = (event) => {
        // 👇 FIX: Tell TypeScript this is a string
        const msg = JSON.parse(event.data as string) as any;

        console.log("[WS] message:", msg);

        // Handle different types of WebSocket messages
        switch (msg.type) {
          case "lobby_state":
            setReadyCount(msg.ready_count);
            setExpectedCount(msg.expected_count);
            break;
          case "lobby_countdown":
            setCountdown(msg.seconds);
            break;
          case "pattern_sequence":
            setCurrentPattern(msg.sequence);
            setPlayerSequence([]); // Reset player's input
            break;
          case "answer_result":
            if (!msg.is_correct) {
              Alert.alert("❌ Wrong", "Your sequence was incorrect.");
            }
            break;
          case "game_over":
            setGameOver(true);
            setScores(msg.scores);
            Alert.alert("🏁 Game Over", JSON.stringify(msg.scores));
            break;
          default:
            console.warn("Unknown WebSocket message type:", msg);
        }
      };

      ws.onerror = (err) => console.error("[WS] error:", err);
      ws.onclose = () => console.log("[WS] closed");

      setSocket(ws);
    } catch (err) {
      console.error("Init pattern game failed", err);
    }
  };

  // 👇 Called when player clicks "I'm ready"
  const sendReady = () => {
    if (socket) {
      socket.send(JSON.stringify({ type: "player_ready" }));
    }
  };

  // 👇 Called when player selects a color
  const addColor = (color: string) => {
    setPlayerSequence((prev) => [...prev, color]);
  };

  // 👇 Submit the player's sequence
  const submitAnswer = () => {
    if (socket && gameStateId) {
      socket.send(
        JSON.stringify({
          type: "player_answer",
          round_number: 1, // 🔧 TODO: Replace with real round number
          sequence: playerSequence,
        })
      );
    }
  };

  // 🔁 useEffect: Called on component mount
  useEffect(() => {
    initGame();
    return () => {
      if (socket) socket.close();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pattern Game</Text>

      {/* Lobby waiting info */}
      {!gameOver && (
        <Text>
          Waiting for players: {readyCount}/{expectedCount}
        </Text>
      )}

      {/* Countdown before game starts */}
      {countdown !== null && <Text>⏳ Starting in: {countdown}</Text>}

      {/* Show the pattern to remember */}
      <View style={styles.patternRow}>
        {currentPattern.map((c, i) => (
          <View
            key={i}
            style={[styles.patternBox, { backgroundColor: c }]}
          />
        ))}
      </View>

      {/* Player's current input */}
      <Text>Your input: {playerSequence.join(", ")}</Text>
      <View style={styles.colorRow}>
        {COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.colorButton, { backgroundColor: c }]}
            onPress={() => addColor(c)}
          />
        ))}
      </View>

      {/* Action buttons */}
      <TouchableOpacity style={styles.btn} onPress={sendReady}>
        <Text style={styles.btnText}>I'm Ready</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btn} onPress={submitAnswer}>
        <Text style={styles.btnText}>Submit</Text>
      </TouchableOpacity>

      {/* Game over: show scores */}
      {gameOver && (
        <View>
          <Text>🎉 Final Scores:</Text>
          {scores.map((s, i) => (
            <Text key={i}>
              {s.username}: {s.score}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

// 🎨 Styles
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 20 },
  btn: { marginTop: 10, padding: 10, backgroundColor: "skyblue", borderRadius: 8 },
  btnText: { fontSize: 16, fontWeight: "bold" },
  patternRow: { flexDirection: "row", marginVertical: 10 },
  patternBox: { width: 40, height: 40, margin: 5 },
  colorRow: { flexDirection: "row", marginTop: 10 },
  colorButton: { width: 50, height: 50, margin: 5, borderRadius: 8 },
});

export default PatternGameScreen;
