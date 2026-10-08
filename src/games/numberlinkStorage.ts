// SPDX-License-Identifier: GPL-3.0-only
import type { NumberlinkLevel } from "./numberlinkLevels";
import { createNumberlinkState, replayNumberlinkActions, type NumberlinkState } from "./numberlinkLogic";
export const NUMBERLINK_RESUME_KEY = "playgarden.numberlink.v1";
/** A board or win flag from storage is never trusted; only legal actions are replayed. */
export function parseNumberlinkRound(raw: string | null, level: NumberlinkLevel): NumberlinkState {
  try {
    if (!raw || raw.length > 400000) return createNumberlinkState(level);
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || saved.id !== level.id || !Array.isArray(saved.history)) return createNumberlinkState(level);
    return replayNumberlinkActions(level, saved.history) ?? createNumberlinkState(level);
  } catch { return createNumberlinkState(level); }
}
export function loadNumberlinkRound(index: number, level: NumberlinkLevel): NumberlinkState {
  try { return parseNumberlinkRound(localStorage.getItem(`${NUMBERLINK_RESUME_KEY}.round.${index}`), level); }
  catch { return createNumberlinkState(level); }
}
export function saveNumberlinkRound(index: number, level: NumberlinkLevel, state: NumberlinkState): boolean {
  try { localStorage.setItem(`${NUMBERLINK_RESUME_KEY}.round.${index}`, JSON.stringify({ version: 1, id: level.id, history: state.history })); return true; }
  catch { return false; }
}
