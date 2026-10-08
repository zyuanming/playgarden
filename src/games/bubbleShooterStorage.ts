// SPDX-License-Identifier: GPL-3.0-only
import type { BubbleLevel } from "./bubbleShooterLevels";
import { bubbleAngle, createBubbleState, replayBubbleShots, type BubbleState } from "./bubbleShooterLogic";
export const BUBBLE_RESUME_KEY = "playgarden.bubble-shooter.v1";
export function loadBubbleRound(index: number, level: BubbleLevel): { state: BubbleState; aim: number } {
  const fallback = { state: createBubbleState(level), aim: 0 };
  try {
    const raw = localStorage.getItem(`${BUBBLE_RESUME_KEY}.round.${index}`);
    if (!raw || raw.length > 4096) return fallback;
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || saved.id !== level.id || !Array.isArray(saved.history) || typeof saved.aim !== "number" || !Number.isFinite(saved.aim) || Math.abs(saved.aim) > 74) return fallback;
    const state = replayBubbleShots(level, saved.history);
    return state ? { state, aim: bubbleAngle(saved.aim) } : fallback;
  } catch { return fallback; }
}
export function saveBubbleRound(index: number, level: BubbleLevel, state: BubbleState, aim: number): boolean {
  try { localStorage.setItem(`${BUBBLE_RESUME_KEY}.round.${index}`, JSON.stringify({ version: 1, id: level.id, history: state.history, aim })); return true; }
  catch { return false; }
}
