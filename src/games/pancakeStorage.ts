import { createPancakeState, flipPancakes, isPancakeSolved, isPancakeStack, PANCAKE_SAVE_LIMIT, type PancakeLevel, type PancakeState } from './pancakeLogic.ts';
export const PANCAKE_RESUME_KEY = 'playgarden.pancake.v1';
const equal = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
/** Validate the entire chain from the original stack; corrupted saves cannot award a win. */
export function parsePancakeRound(raw: string | null, level: PancakeLevel): PancakeState {
  const initial = createPancakeState(level);
  try {
    if (!raw || raw.length > 200000) return initial;
    const value = JSON.parse(raw);
    const valid = (a: unknown): a is number[] => isPancakeStack(a) && a.length === level.stack.length;
    if (value?.version !== 1 || value.id !== level.id || !valid(value.stack)
      || !Number.isSafeInteger(value.moves) || value.moves < 0 || value.moves > PANCAKE_SAVE_LIMIT
      || !Array.isArray(value.history) || value.history.length > PANCAKE_SAVE_LIMIT
      || value.history.length !== value.moves || !value.history.every(valid)) return initial;
    const chain: number[][] = [...value.history, value.stack];
    if (!equal(chain[0], initial.stack)) return initial;
    // A solved state must be reached by a witnessed final move, never inserted alone.
    if (isPancakeSolved(value.stack) && !value.history.length) return initial;
    for (let i = 1; i < chain.length; i++) {
      if (isPancakeSolved(chain[i - 1])) return initial;
      if (!Array.from({ length: level.stack.length - 1 }, (_, k) => k + 2).some(k => equal(flipPancakes(chain[i - 1], k)!, chain[i]))) return initial;
    }
    return { stack: [...value.stack], history: value.history.map((a: number[]) => [...a]), moves: value.moves };
  } catch { return initial; }
}
export function loadPancakeRound(index: number, level: PancakeLevel): PancakeState {
  try { return parsePancakeRound(localStorage.getItem(`${PANCAKE_RESUME_KEY}.round.${index}`), level); } catch { return createPancakeState(level); }
}
export function savePancakeRound(index: number, level: PancakeLevel, state: PancakeState): boolean {
  if (state.moves > PANCAKE_SAVE_LIMIT) return false;
  try { localStorage.setItem(`${PANCAKE_RESUME_KEY}.round.${index}`, JSON.stringify({version:1,id:level.id,...state})); return true; } catch { return false; }
}
