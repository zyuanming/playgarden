// SPDX-License-Identifier: GPL-3.0-only
import type { WordLadderLevel } from "./wordLadderLevels";

export type WordLadderState = { path: string[] };
export type WordLadderStep = { state: WordLadderState; error: string | null };
export const createWordLadderState = (level: WordLadderLevel): WordLadderState => ({ path: [level.start] });
export const currentLadderWord = (state: WordLadderState): string => state.path[state.path.length - 1];
export const ladderSolved = (level: WordLadderLevel, state: WordLadderState): boolean => currentLadderWord(state) === level.target;

export function letterDistance(left: string, right: string): number {
  if (left.length !== right.length) return Infinity;
  let changed = 0;
  for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) changed++;
  return changed;
}

/** Any local-wordbook route is legal, including detours and revisiting a word. */
export function stepWordLadder(level: WordLadderLevel, state: WordLadderState, input: string): WordLadderStep {
  if (ladderSolved(level, state)) return { state, error: "已经抵达终点，点“重来”可再试另一条路线。" };
  const word = input.trim().toUpperCase();
  if (!new RegExp(`^[A-Z]{${level.start.length}}$`).test(word)) {
    return { state, error: `请输入 ${level.start.length} 个英文字母；这关不能增减或调换字母位置。` };
  }
  const distance = letterDistance(currentLadderWord(state), word);
  if (distance === 0) return { state, error: "还是同一个词。每步恰好换一个字母。" };
  if (distance !== 1) return { state, error: `这次换了 ${distance} 个字母。每步只能换一个，先找一个中间词。` };
  if (!level.book.some(entry => entry.word === word)) {
    return { state, error: `${word} 不在本关词本里。请从下方公开词本中选择；不是判断它在词典中是否存在。` };
  }
  return { state: { path: [...state.path, word] }, error: null };
}

export function undoWordLadder(state: WordLadderState): WordLadderState {
  return state.path.length > 1 ? { path: state.path.slice(0, -1) } : state;
}

/** Bounded BFS over this level's small, visible wordbook, from the current word.
 * Only a next step and remaining distance are exposed, never an authored route.
 */
export function ladderHint(level: WordLadderLevel, from: string): { next: string; remaining: number } | null {
  if (from === level.target) return null;
  const queue: { word: string; next: string; distance: number }[] = [{ word: from, next: "", distance: 0 }];
  const visited = new Set([from]);
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    for (const candidate of level.book) {
      if (visited.has(candidate.word) || letterDistance(current.word, candidate.word) !== 1) continue;
      const next = current.next || candidate.word;
      const distance = current.distance + 1;
      if (candidate.word === level.target) return { next, remaining: distance };
      visited.add(candidate.word);
      queue.push({ word: candidate.word, next, distance });
    }
  }
  return null;
}
