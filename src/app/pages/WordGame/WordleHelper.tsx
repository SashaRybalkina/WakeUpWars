import { endpoints } from '../../api';
import { words } from './words_array';

export type LetterStatus = 'correct' | 'present' | 'absent';

const validWords = words;

export type CreateGameResponse = {
  game_id: number;
  puzzle: number[][];
  is_multiplayer: boolean;
};

export interface GuessResult {
  letter: string;
  status: LetterStatus;
}

export function evaluateGuess(guess: string, solution: string): GuessResult[] {
  const result: GuessResult[] = [];
  const solutionLetters = solution.split('');
  const guessLetters = guess.split('');

  const taken = Array(5).fill(false);

  for (let i = 0; i < 5; i++) {
    if (guessLetters[i] === solutionLetters[i]) {
      result[i] = {
        letter: guessLetters[i],
        status: 'correct',
      };
      taken[i] = true;
    } else {
      result[i] = {
        letter: guessLetters[i],
        status: 'absent',
      };
    }
  }

  for (let i = 0; i < 5; i++) {
    if (result[i].status === 'correct') continue;

    const letter = guessLetters[i];
    const foundIndex = solutionLetters.findIndex(
      (l, idx) => l === letter && !taken[idx],
    );

    if (foundIndex !== -1) {
      result[i].status = 'present';
      taken[foundIndex] = true;
    }
  }

  return result;
}

export function isWinningGuess(guess: string, solution: string): boolean {
  return guess.toLowerCase() === solution.toLowerCase();
}

export function randomWord(): string {
  const randomIndex = Math.floor(Math.random() * validWords.length);
  return (validWords[randomIndex] + '').toUpperCase();
}