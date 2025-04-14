import { fetchSudokuFromAPI } from '../api';

type Difficulty = 'easy' | 'medium' | 'hard';

export const generateSudokuGame = async (difficulty: Difficulty = 'easy') => {
  
  const { puzzle, solution } = await fetchSudokuFromAPI(difficulty);

  // Flatten/transform the 2D arrays to 1D arrays
  const flatten = (board: number[][]): number[] =>
    board.flat(); 

  const puzzleArray = flatten(puzzle);
  const solutionArray = flatten(solution);

  return {
    puzzle: puzzleArray,     
    solution: solutionArray, 
  };
};


export const isGameComplete = (board: string[]): boolean => {
  return board.every((val) => /^[1-9]$/.test(val));
};


export const isCorrectSolution = (board: string[], solution: number[]): boolean => {
  return board.every((val, idx) => parseInt(val) === solution[idx]);
};

