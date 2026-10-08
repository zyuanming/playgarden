// SPDX-License-Identifier: GPL-3.0-only
import type { WordLadderLevel } from "./wordLadderLevels";
import { createWordLadderState, stepWordLadder, type WordLadderState } from "./wordLadderLogic";

export const WORD_LADDER_RESUME_KEY = "playgarden.word-ladder.v1";
const MAX_SAVED_STEPS = 4096;

/** Restore only witnessed legal steps. Saved boards, step counts and win flags
 * have no authority. Invalid or truncated histories restart the whole round.
 */
export function parseWordLadderRound(raw: string | null, level: WordLadderLevel): WordLadderState {
  const initial = createWordLadderState(level);
  try {
    if (!raw || raw.length > 40000) return initial;
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || saved.id !== level.id || !Array.isArray(saved.steps) || saved.steps.length > MAX_SAVED_STEPS) return initial;
    let state = initial;
    for (const word of saved.steps) {
      if (typeof word !== "string" || !/^[A-Z]{3,4}$/.test(word)) return initial;
      const result = stepWordLadder(level, state, word);
      if (result.error) return initial;
      state = result.state;
    }
    return state;
  } catch { return initial; }
}

export function loadWordLadderRound(index: number, level: WordLadderLevel): WordLadderState {
  try { return parseWordLadderRound(localStorage.getItem(`${WORD_LADDER_RESUME_KEY}.round.${index}`), level); }
  catch { return createWordLadderState(level); }
}

export function saveWordLadderRound(index: number, level: WordLadderLevel, state: WordLadderState): boolean {
  try {
    if (state.path.length - 1 > MAX_SAVED_STEPS) return false;
    localStorage.setItem(`${WORD_LADDER_RESUME_KEY}.round.${index}`, JSON.stringify({ version: 1, id: level.id, steps: state.path.slice(1) }));
    return true;
  } catch { return false; }
}
