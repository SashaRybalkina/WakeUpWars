import { endpoints } from '../api';

export type CreateGameResponse = {
  game_id: number;
  puzzle: number[][];
  is_multiplayer: boolean;
};