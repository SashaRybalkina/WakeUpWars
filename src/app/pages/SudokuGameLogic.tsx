import { getSudoku } from 'sudoku-gen';

type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export const generateSudokuGame = (difficulty: Difficulty = 'easy') => {
  const { puzzle, solution } = getSudoku(difficulty);

  const puzzleArray = puzzle.split('').map((char) => (char === '-' ? 0 : parseInt(char)));
  const solutionArray = solution.split('').map((char) => parseInt(char));

  solutionArray.forEach((_, i) => {
    if (i % 9 === 0) {
      console.log(solutionArray.slice(i, i + 9).join(' '));
    }
  });

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
