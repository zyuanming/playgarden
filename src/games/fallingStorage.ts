// SPDX-License-Identifier: GPL-3.0-only
import {
  parseFalling,
  serializeFalling,
  type FallingState,
} from "../vendor/falling/core";
export const FALLING_SAVE = "playgarden.falling.v1.round";
export const FALLING_BEST = "playgarden.falling.v1.best";
function bestValue(raw: string | null) {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 1e9 ? n : 0;
}
export function loadFalling() {
  try {
    return {
      state: parseFalling(localStorage.getItem(FALLING_SAVE)),
      best: bestValue(localStorage.getItem(FALLING_BEST)),
      available: true,
    };
  } catch {
    return { state: null, best: 0, available: false };
  }
}
export function saveFalling(state: FallingState, best: number) {
  let highest = Math.max(best, state.score),
    available = true,
    canRead = true;
  try {
    highest = Math.max(highest, bestValue(localStorage.getItem(FALLING_BEST)));
  } catch {
    available = false;
    canRead = false;
  }
  if (canRead)
    try {
      localStorage.setItem(FALLING_BEST, String(highest));
    } catch {
      available = false;
    }
  try {
    localStorage.setItem(FALLING_SAVE, serializeFalling(state));
  } catch {
    available = false;
  }
  return { best: highest, available };
}
