export const BASE_URL = 'https://3a72-2601-681-5400-4f70-385c-8bb1-60b9-7c2c.ngrok-free.app';

export const endpoints = {
  login: `${BASE_URL}/api/login/`,
  register: `${BASE_URL}/api/register/`,
  groups: `${BASE_URL}/api/groups/`,
  messages: (userId: number) => `${BASE_URL}/api/messages/${userId}/`,
  profile: (userId: number) => `${BASE_URL}/api/profile/${userId}/`,
  sudoku: (difficulty: string) => `${BASE_URL}/api/sudoku/generate/?difficulty=${difficulty}`,
};

export const fetchSudokuFromAPI = async (difficulty = 'easy') => {
  const timestamp = new Date().getTime(); // avoid cache
  try {
    const response = await fetch(
      `${BASE_URL}/api/sudoku/generate/?difficulty=${difficulty}&t=${timestamp}`,
      {
        method: 'GET', 
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    const data = await response.json();
    return {
      puzzle: data.puzzle,
      solution: data.solution,
    };
  } catch (err) {
    console.error('Failed to fetch Sudoku from API:', err);
    return {
      puzzle: Array(9).fill(Array(9).fill(0)),  // fallback 空棋盤
      solution: Array(9).fill(Array(9).fill(0)),
    };
  }
};

