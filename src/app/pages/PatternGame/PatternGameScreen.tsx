import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ImageBackground,
} from 'react-native';

// Available colors
const COLORS = ['red', 'blue', 'green', 'yellow'];

const PatternGameScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [pattern, setPattern] = useState<string[]>([]);
  const [playerInput, setPlayerInput] = useState<string[]>([]);
  const [showingPattern, setShowingPattern] = useState(false);
  const [level, setLevel] = useState(1);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);

  // Generate new pattern every time level increases
  useEffect(() => {
    const newPattern = generatePattern(level);
    setPattern(newPattern);
    setPlayerInput([]);
    setShowingPattern(true);
    animatePattern(newPattern);
  }, [level]);

  // Generate random pattern
  const generatePattern = (len: number): string[] => {
    return Array.from({ length: len }, () => COLORS[Math.floor(Math.random() * COLORS.length)]) as string[];
  };

  // Animate the pattern
  const animatePattern = async (patternToShow: string[]) => {
    for (let i = 0; i < patternToShow.length; i++) {
      setHighlightIndex(i);
      await new Promise(res => setTimeout(res, 600));
      setHighlightIndex(null);
      await new Promise(res => setTimeout(res, 200));
    }
    setShowingPattern(false);
  };

  // Handle player's button press
  const handlePress = (color: string) => {
    if (showingPattern) return;

    const newInput = [...playerInput, color];
    setPlayerInput(newInput);

    const currentIndex = newInput.length - 1;
    if (newInput[currentIndex] !== pattern[currentIndex]) {
      Alert.alert('❌ Incorrect', 'You pressed the wrong color. Game Over!');
      setLevel(1);
      return;
    }

    if (newInput.length === pattern.length) {
      Alert.alert('✅ Correct!', 'Get ready for the next round.');
      setTimeout(() => setLevel(level + 1), 1000);
    }
  };

  return (
    <ImageBackground
      source={require('../../images/cgpt.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        {/* Exit Button */}
        <TouchableOpacity style={styles.exitButton} onPress={() => navigation.goBack()}>
          <Text style={styles.exitText}>Exit</Text>
        </TouchableOpacity>

        <Text style={styles.title}>🧠 Pattern Memory Game</Text>
        <Text style={styles.subtitle}>Level: {level}</Text>

        {/* Pattern display */}
        <View style={styles.patternRow}>
          {pattern.map((color, index) => (
            <View
              key={index}
              style={[
                styles.patternBox,
                { backgroundColor: color },
                highlightIndex === index && styles.highlightBox,
              ]}
            />
          ))}
        </View>

        {/* Player input */}
        <Text style={styles.subtitle}>Your Input: {playerInput.join(', ')}</Text>

        {/* Color buttons */}
        <View style={styles.colorRow}>
          {COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              style={[styles.colorButton, { backgroundColor: color }]}
              onPress={() => handlePress(color)}
            />
          ))}
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
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
  exitText: {
    fontWeight: 'bold',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: 'white',
    marginBottom: 10,
  },
  patternRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  patternBox: {
    width: 50,
    height: 50,
    margin: 5,
    borderRadius: 6,
    opacity: 0.5,
  },
  highlightBox: {
    borderWidth: 3,
    borderColor: 'white',
    opacity: 1,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  colorButton: {
    width: 60,
    height: 60,
    margin: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'black',
  },
});

export default PatternGameScreen;
