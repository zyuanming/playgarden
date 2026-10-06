import { createSameGameState, removeSameGameGroup, samegameGroups, type SameGameLevel, type SameGameState } from './samegameLogic';
export const SAMEGAME_RESUME_KEY = 'playgarden.samegame.v1';
const equal = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
/** Validate every saved move from the original board; corrupted saves never award a win. */
export function parseSameGameRound(raw: string | null, level: SameGameLevel): SameGameState {
  const initial = createSameGameState(level);
  try {
    const value = JSON.parse(raw || 'null');
    const valid = (board: unknown): board is number[] => Array.isArray(board) && board.length === level.width * level.height && board.every(v => Number.isInteger(v) && v >= -1 && v < level.colors);
    if (value?.version !== 1 || value.id !== level.id || !valid(value.board) || !Array.isArray(value.history) || value.history.length > Math.floor(initial.board.length / 2) || !value.history.every(valid)) return initial;
    const chain: number[][] = [...value.history, value.board];
    if (!equal(chain[0], initial.board)) return initial;
    for (let i = 1; i < chain.length; i++) {
      if (!samegameGroups(chain[i - 1], level.width, level.height).some(group => {
        const result = removeSameGameGroup(chain[i - 1], level.width, level.height, group[0]);
        return result !== null && equal(result, chain[i]);
      })) return initial;
    }
    return { board: value.board.slice(), history: value.history.map((b: number[]) => b.slice()) };
  } catch { return initial; }
}
export function loadSameGameRound(index: number, level: SameGameLevel): SameGameState {
  try { return parseSameGameRound(localStorage.getItem(`${SAMEGAME_RESUME_KEY}.round.${index}`), level); } catch { return createSameGameState(level); }
}
export function saveSameGameRound(index: number, level: SameGameLevel, state: SameGameState): boolean {
  try { localStorage.setItem(`${SAMEGAME_RESUME_KEY}.round.${index}`, JSON.stringify({ version: 1, id: level.id, ...state })); return true; } catch { return false; }
}
