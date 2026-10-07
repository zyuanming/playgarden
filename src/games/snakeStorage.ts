// SPDX-License-Identifier: GPL-3.0-only
import {
  parseSnake,
  serializeSnake,
  type SnakeState,
} from "../vendor/snake/core";
export const SNAKE_SAVE = "playgarden.snake.v1.round";
export const SNAKE_BEST = "playgarden.snake.v1.best";
function bestValue(raw: string | null) {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 252 ? n : 0;
}
export function loadSnake() {
  try {
    return {
      state: parseSnake(localStorage.getItem(SNAKE_SAVE)),
      best: bestValue(localStorage.getItem(SNAKE_BEST)),
      available: true,
    };
  } catch {
    return { state: null, best: 0, available: false };
  }
}
export function saveSnake(state: SnakeState, best: number) {
  let highest = Math.max(best, state.score),
    available = true,
    canRead = true;
  try {
    highest = Math.max(highest, bestValue(localStorage.getItem(SNAKE_BEST)));
  } catch {
    available = false;
    canRead = false;
  }
  if (canRead)
    try {
      localStorage.setItem(SNAKE_BEST, String(highest));
    } catch {
      available = false;
    }
  try {
    localStorage.setItem(SNAKE_SAVE, serializeSnake(state));
  } catch {
    available = false;
  }
  return { best: highest, available };
}
