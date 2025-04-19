export const BASE_URL = 'https://35fd-216-162-223-194.ngrok-free.app';

export const endpoints = {
  login: `${BASE_URL}/api/login/`,
  register: `${BASE_URL}/api/register/`,
  groups: `${BASE_URL}/api/groups/`,
  messages: (userId: number) => `${BASE_URL}/api/messages/${userId}/`,
  profile: (userId: number) => `${BASE_URL}/api/profile/${userId}/`,
  createSudokuGame: `${BASE_URL}/api/sudoku/create/`,
  validateSudokuMove: `${BASE_URL}/api/sudoku/validate/`,
};

