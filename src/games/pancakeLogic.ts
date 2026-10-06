import { pancakeDistances } from './pancakeDistances.ts';
/** Original prefix-reversal rules. Arrays are ordered from the top of the stack. */
export interface PancakeLevel { id: string; title: string; chapter: number; stack: number[]; minMoves: number }
export interface PancakeState { stack: number[]; history: number[][]; moves: number }
const factorial = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];
export const PANCAKE_SAVE_LIMIT = 4096;
export function isPancakeStack(value: unknown): value is number[] {
  return Array.isArray(value) && value.length >= 3 && value.length <= 8
    && Array.from(value).every(v => Number.isInteger(v) && v >= 1 && v <= value.length)
    && new Set(value).size === value.length;
}
export function pancakeRank(stack: readonly number[]): number {
  if (!isPancakeStack(stack)) return -1;
  let rank = 0;
  for (let i = 0; i < stack.length; i++) for (let j = i + 1; j < stack.length; j++) if (stack[j] < stack[i]) rank += factorial[stack.length - i - 1];
  return rank;
}
export function flipPancakes(stack: readonly number[], count: number): number[] | null {
  if (!isPancakeStack(stack) || !Number.isInteger(count) || count < 2 || count > stack.length) return null;
  return [...stack.slice(0, count).reverse(), ...stack.slice(count)];
}
export function isPancakeSolved(stack: readonly number[]): boolean {
  return isPancakeStack(stack) && stack.every((v, i) => v === i + 1);
}
export function pancakeDistance(stack: readonly number[]): number | null {
  const rank = pancakeRank(stack);
  return rank < 0 ? null : Number(pancakeDistances[stack.length][rank]);
}
export function createPancakeState(level: PancakeLevel): PancakeState {
  if (!isPancakeStack(level.stack)) throw new Error('Invalid pancake level');
  return { stack: [...level.stack], history: [], moves: 0 };
}
export function playPancake(state: PancakeState, count: number): PancakeState {
  if (isPancakeSolved(state.stack)) return state;
  const next = flipPancakes(state.stack, count);
  return next ? { stack: next, history: [...state.history, [...state.stack]], moves: state.moves + 1 } : state;
}
export function undoPancake(state: PancakeState): PancakeState {
  if (!state.history.length || isPancakeSolved(state.stack)) return state;
  return { stack: [...state.history[state.history.length - 1]], history: state.history.slice(0, -1), moves: state.moves - 1 };
}
export type PancakeHint = { kind: 'move'; count: number; distance: number; reason: string } | { kind: 'complete' | 'unavailable'; reason: string };
/** Exact indexed table: at most seven candidate flips, with no unbounded UI search. */
export function getPancakeHint(stack: readonly number[]): PancakeHint {
  const distance = pancakeDistance(stack);
  if (distance === null) return { kind: 'unavailable', reason: '这叠煎饼的数据无效，请重来。' };
  if (distance === 0) return { kind: 'complete', reason: '已经排成小在上、大在下了！' };
  for (let count = 2; count <= stack.length; count++) {
    const next = flipPancakes(stack, count)!;
    if (pancakeDistance(next) === distance - 1) return { kind: 'move', count, distance, reason: `精确最短距离表：当前还需至少 ${distance} 次。翻上方 ${count} 片后，还需至少 ${distance - 1} 次。先看预览，再决定是否采用。` };
  }
  return { kind: 'unavailable', reason: '暂时没有找到可靠提示，可以继续尝试或撤销。' };
}
