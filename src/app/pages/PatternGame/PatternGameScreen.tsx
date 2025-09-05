import React, { useEffect, useState, useCallback } from 'react';
import { endpoints, BASE_URL } from '../../api';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ImageBackground,
  ActivityIndicator,
} from 'react-native';

// Must match backend utils.ALLOWED_ELEMENTS
const COLORS = ['red', 'blue', 'green', 'yellow'];

/** ---------- WS types (consumers.py multiplayer) ---------- */
type WsLobbyState = {
  type: 'lobby_state';
  started: boolean;
  ready_count: number;
  expected_count: number;
};
type WsLobbyCountdown = {
  type: 'lobby_countdown';
  seconds: number;
};
type WsPatternSequence = {
  type: 'pattern_sequence';
  round_number: number;
  sequence: string[];
};
type WsAnswerResult = {
  type: 'answer_result';
  is_correct: boolean;
  is_complete: boolean;
  round_score?: number;
  error?: string;
};
type WsGameOver = {
  type: 'game_over';
  scores: { username: string; rounds_completed: number; score: number }[];
};
type WsIncoming =
  | WsLobbyState
  | WsLobbyCountdown
  | WsPatternSequence
  | WsAnswerResult
  | WsGameOver;


/***********REST type responses**************/
type CreateResp = {
  success: boolean;
  game_state_id: number;
  current_round: number;
  max_rounds: number;
  is_multiplayer: boolean;
  pattern_sequence?: string[][];
  error?: string;
};

type ValidateResp = {
  success: boolean;
  result: 'correct' | 'incorrect';
  round_score: number;
  is_complete: boolean;
  current_round?: number; 
  scores?: { username: string; rounds_completed: number; score: number }[];
  error?: string;
};

type Props = { route: any; navigation: any };

const getCsrf = async (): Promise<string> => {
  const r = await fetch(endpoints.csrfToken, { credentials: 'include' });
  const { csrfToken } = await r.json();
  return csrfToken;
};

// --- testing purposes only ---
const ensureSession = async (username: string, password: string) => {
  // 1) 先拿 CSRF
  const r1 = await fetch(endpoints.csrfToken, { credentials: 'include' });
  const { csrfToken: csrf1 } = await r1.json();

  // 2) login（會設置 sessionid，可能也會刷新 csrftoken）
  const loginRes = await fetch(endpoints.login, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf1 },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });
  const lj = await loginRes.json();
  if (!loginRes.ok || !lj?.success) {
    throw new Error(lj?.error || 'Login failed');
  }

  // 3) 再拿一次最新 CSRF（保險）
  const r2 = await fetch(endpoints.csrfToken, { credentials: 'include' });
  const { csrfToken: csrf2 } = await r2.json();
  return csrf2 as string;
};
// --------------------------------------

const PatternGameScreen: React.FC<Props> = ({ route, navigation }) => {
  /*
  // testing purpose only -------- Route params（可帶 dev 參數跳過整個導覽鏈）--------
  const routeChallengeId: number | undefined = route?.params?.challengeId;
  const devAutoLogin: boolean = !!route?.params?.devAutoLogin; // e.g. true
  const devUser: string = route?.params?.devUser ?? 'ap1';
  const devPass: string = route?.params?.devPass ?? 'ap1';
  const devChallengeId: number | undefined = route?.params?.devChallengeId;

  // 最終要使用的 challengeId（先取正常參數，再取 dev，再 fallback 41）
  const challengeId = routeChallengeId ?? devChallengeId ?? 41;
  */
  
  // -------- Route param --------
  const challengeId: number | undefined = route?.params?.challengeId;

  // -------- Game state --------
  const [loading, setLoading] = useState(true);
  const [gameStateId, setGameStateId] = useState<number | null>(null);
  const [level, setLevel] = useState<number>(1);
  const [maxRounds, setMaxRounds] = useState<number>(5);
  const [patternSeq, setPatternSeq] = useState<string[][]>([]); // full pattern per round

  // -------- UI state --------
  const [showingPattern, setShowingPattern] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [playerInput, setPlayerInput] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // calculate the current expected length of the pattern
  // to prevent submitting too-short answers
  const expectedLen = patternSeq[level - 1]?.length ?? 0;

  // Small sleep helper
  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  // Play a round by highlighting colors
  const playRound = useCallback(
    async (roundNumber: number, fullSeq: string[][] = patternSeq) => {
      const seq = fullSeq[roundNumber - 1] || [];
      if (!seq.length) return;
      setShowingPattern(true);
      setPlayerInput([]);
      for (const color of seq) {
        const idx = COLORS.indexOf(color);
        setHighlightIndex(idx >= 0 ? idx : null);
        await sleep(600);
        setHighlightIndex(null);
        await sleep(200);
      }
      setShowingPattern(false);
    },
    [patternSeq]
  );

  // Init: create/reuse a game and autoplay current round
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        if (challengeId == null) throw new Error('Missing challengeId');

        /*
        // testing purposes only: auto-login once (using cookies session) -----------------------
        if (devAutoLogin) {
          await ensureSession(devUser, devPass);
        }
        // --------------------------- 
        */

        const csrf = await getCsrf();
        const res = await fetch(endpoints.patternCreate, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
          credentials: 'include',
          body: JSON.stringify({ challenge_id: challengeId }),
        });
        const j: CreateResp = await res.json();
        if (!res.ok || !j.success) throw new Error(j?.error || 'create failed');

        setGameStateId(j.game_state_id);
        setLevel(j.current_round);
        setMaxRounds(j.max_rounds);

        if (Array.isArray(j.pattern_sequence)) {
          setPatternSeq(j.pattern_sequence);
          // autoplay round
          await playRound(j.current_round, j.pattern_sequence);
        } else {
          Alert.alert('Missing pattern', 'pattern_sequence not provided by server.');
        }
      } catch (e: any) {
        Alert.alert('Init Error', e?.message ?? 'Failed to init pattern game');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);

  // Re-sync helper if round mismatch or server says "Round closed"
  const resyncFromServer = useCallback(async () => {
    try {
      if (challengeId == null) return;
      const csrf = await getCsrf();
      const res = await fetch(endpoints.patternCreate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        credentials: 'include',
        body: JSON.stringify({ challenge_id: challengeId }),
      });
      const j: CreateResp = await res.json();
      if (!res.ok || !j.success) throw new Error(j?.error || 'resync failed');

      setGameStateId(j.game_state_id);
      setLevel(j.current_round);
      setMaxRounds(j.max_rounds);
      if (Array.isArray(j.pattern_sequence)) {
        setPatternSeq(j.pattern_sequence);
        await playRound(j.current_round, j.pattern_sequence);
      }
    } catch (e: any) {
      Alert.alert('Resync Error', e?.message ?? 'Failed to resync');
    }
  }, [challengeId, playRound]);

  // Handle color taps (just build input; submit with button)
  const handlePress = (color: string) => {
    if (showingPattern || submitting) return;
    setPlayerInput((prev) => [...prev, color]);
  };

  // Submit the player's attempt for current round
  const submitAnswer = async () => {
    if (showingPattern || submitting) return;
    if (!gameStateId) {
      Alert.alert('Error', 'Missing game_state_id');
      return;
    }

    // Optional: require exact length before submit (避免一定錯)
    const expectedLen = patternSeq[level - 1]?.length ?? 0;
    if (expectedLen > 0 && playerInput.length !== expectedLen) {
      Alert.alert('Incomplete', `This round needs ${expectedLen} taps.`);
      return;
    }

    try {
      setSubmitting(true);
      const csrf = await getCsrf();
      const res = await fetch(endpoints.patternValidate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        credentials: 'include',
        body: JSON.stringify({
          game_state_id: gameStateId,
          round_number: level, // strict sync with server
          player_sequence: playerInput,
        }),
      });
      const j: ValidateResp = await res.json();

      if (!res.ok) {
        Alert.alert('Validate Error', j?.error ?? 'Failed to validate');
        setPlayerInput([]);
        await resyncFromServer();
        return;
      }

      if (j.success && j.result === 'correct') {
        if (j.is_complete) {
          Alert.alert('🎉 Finished', `Great job! +${j.round_score}`, [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('✅ Correct', `+${j.round_score}`);
          const nextRound =
            typeof j.current_round === 'number' && j.current_round > level
              ? j.current_round
              : level + 1;
          setLevel(nextRound);
          setPlayerInput([]);
          await playRound(nextRound); // autoplay next round
        }
      } else {
        Alert.alert('❌ Incorrect', 'Try again!');
        setPlayerInput([]);
        await playRound(level); // replay current round
      }
    } catch (e: any) {
      Alert.alert('Network Error', e?.message ?? 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ImageBackground source={require('../../images/cgpt.png')} style={styles.background} resizeMode="cover">
        <View style={styles.container}>
          <ActivityIndicator />
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require('../../images/cgpt.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        {/* Exit */}
        <TouchableOpacity style={styles.exitButton} onPress={() => navigation.goBack()}>
          <Text style={styles.exitText}>Exit</Text>
        </TouchableOpacity>

        <Text style={styles.title}>🧠 Pattern Memory Game</Text>
        <Text style={styles.subtitle}>Round: {level}/{maxRounds}</Text>

        {/* Palette (highlight while playing) */}
        <View style={styles.patternRow}>
          {COLORS.map((c, i) => (
            <View
              key={c}
              style={[
                styles.patternBox,
                { backgroundColor: c },
                highlightIndex === i && styles.highlightBox,
              ]}
            />
          ))}
        </View>

        {/* Controls */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <TouchableOpacity
            style={[styles.smallBtn, showingPattern && { opacity: 0.5 }]}
            onPress={() => playRound(level)}
            disabled={showingPattern || submitting}
          >
            <Text style={styles.smallBtnText}>{showingPattern ? 'Playing...' : 'Replay Round'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.smallBtn, (showingPattern || playerInput.length === 0) && { opacity: 0.5 }]}
            onPress={() => setPlayerInput([])}
            disabled={showingPattern || playerInput.length === 0 || submitting}
          >
            <Text style={styles.smallBtnText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.smallBtnPrimary,
              (showingPattern || submitting || playerInput.length === 0) && { opacity: 0.6 },
            ]}
            onPress={submitAnswer}
            disabled={showingPattern || submitting || playerInput.length === 0}
          >
            <Text style={styles.smallBtnPrimaryText}>{submitting ? 'Submitting...' : 'Submit'}</Text>
          </TouchableOpacity>
        </View>

        {/* Player input preview */}
        <Text style={styles.subtitle}>Your Input: {playerInput.join(', ')}</Text>

        {/* Color buttons */}
        <View style={styles.colorRow}>
          {COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.colorButton,
                { backgroundColor: c, opacity: showingPattern ? 0.6 : 1 },
              ]}
              disabled={showingPattern || submitting}
              onPress={() => handlePress(c)}
            />
          ))}
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  exitButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'white',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    zIndex: 10,
  },
  exitText: { fontWeight: 'bold' },
  title: { fontSize: 30, fontWeight: 'bold', color: 'white', marginBottom: 10 },
  subtitle: { fontSize: 18, color: 'white', marginBottom: 10 },
  patternRow: { flexDirection: 'row', marginBottom: 20 },
  patternBox: { width: 50, height: 50, margin: 5, borderRadius: 6, opacity: 0.85 },
  highlightBox: { borderWidth: 3, borderColor: 'white' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  colorButton: { width: 70, height: 70, margin: 10, borderRadius: 12, borderWidth: 2, borderColor: 'black' },
  smallBtn: { backgroundColor: 'white', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  smallBtnText: { fontWeight: '600' },
  smallBtnPrimary: { backgroundColor: '#0ea5e9', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  smallBtnPrimaryText: { color: 'white', fontWeight: '700' },
});

export default PatternGameScreen;
