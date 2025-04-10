export const BASE_URL = 'https://29f7-136-38-171-186.ngrok-free.app';

export const endpoints = {
  login: `${BASE_URL}/api/login/`,
  register: `${BASE_URL}/api/register/`,
  groups: `${BASE_URL}/api/groups/`,
  messages: (userId: number) => `${BASE_URL}/api/messages/${userId}/`,
  profile: (userId: number) => `${BASE_URL}/api/profile/${userId}/`,
};