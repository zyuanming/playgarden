import { newSlantState, slantWon, type SlantPuzzle, type SlantState, type SlantValue } from './slantLogic';
export const SLANT_RESUME_KEY = 'playgarden.slant.v1';
export function parseSlantRound(raw: string | null, p: SlantPuzzle): SlantState {
  try {
    const value = JSON.parse(raw || 'null');
    const valid = (a: unknown): a is SlantValue[] => Array.isArray(a) && a.length === p.width * p.height && a.every(v => v === -1 || v === 0 || v === 1);
    if (value?.version !== 1 || !valid(value.board) || !Array.isArray(value.history) || value.history.length > 250 || !value.history.every(valid) || !Number.isInteger(value.moves) || value.moves < 0) return newSlantState(p);
    return { board: value.board, history: value.history, moves: value.moves };
  } catch { return newSlantState(p); }
}
export function loadSlantRound(level: number, p: SlantPuzzle): SlantState {
  try { return parseSlantRound(localStorage.getItem(`${SLANT_RESUME_KEY}.round.${level}`), p); } catch { return newSlantState(p); }
}
export function saveSlantRound(level: number, state: SlantState, puzzle: SlantPuzzle): boolean {
  try { localStorage.setItem(`${SLANT_RESUME_KEY}.round.${level}`, JSON.stringify({ version: 1, ...state, history: slantWon(puzzle, state.board) ? [] : state.history })); return true; } catch { return false; }
}
