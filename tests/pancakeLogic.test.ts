import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createPancakeState, flipPancakes, getPancakeHint, isPancakeSolved,
  isPancakeStack, pancakeDistance, pancakeRank, playPancake, undoPancake,
  PANCAKE_SAVE_LIMIT, type PancakeLevel,
} from '../src/games/pancakeLogic';
import { pancakeChapters, pancakeLevels } from '../src/games/pancakeLevels';
import { pancakeDistances } from '../src/games/pancakeDistances';

type Proof = PancakeLevel & { solution: number[]; features: { optimalOpenings: number[]; greedyMoves: number; breakpoints: number } };
const campaign = JSON.parse(readFileSync('docs/pancake/campaign.json', 'utf8')) as { schemaVersion: number; levels: Proof[] };
const fixture: PancakeLevel = { id: 'fixture', title: 'fixture', chapter: 0, stack: [2, 3, 1], minMoves: 2 };
// Independent oracle, deliberately does not call the runtime reversal or rank functions.
const reversePrefix = (stack: readonly number[], count: number) => stack.map((_, i) => stack[i < count ? count - 1 - i : i]);
const solved = (stack: readonly number[]) => stack.every((size, index) => size === index + 1);
const factorial = (n: number): number => n < 2 ? 1 : n * factorial(n - 1);

function independentDistances(n: number) {
  const goal = Array.from({ length: n }, (_, i) => i + 1);
  const queue = [goal], distances = new Map([[goal.join(','), 0]]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const stack = queue[cursor], distance = distances.get(stack.join(','))!;
    for (let count = 2; count <= n; count++) {
      const next = reversePrefix(stack, count), key = next.join(',');
      if (!distances.has(key)) { distances.set(key, distance + 1); queue.push(next); }
    }
  }
  return { queue, distances };
}

describe('Pancake prefix-reversal rules', () => {
  it('reverses only the selected top prefix, preserves the suffix, and never mutates input', () => {
    const input = Object.freeze([3, 1, 4, 2]);
    expect(flipPancakes(input, 3)).toEqual([4, 1, 3, 2]);
    expect(flipPancakes(input, 4)).toEqual([2, 4, 1, 3]);
    expect(input).toEqual([3, 1, 4, 2]);
    for (let count = 2; count <= input.length; count++) {
      const next = flipPancakes(input, count)!;
      expect(next.slice(count)).toEqual(input.slice(count));
      expect(flipPancakes(next, count)).toEqual(input);
      expect(next).not.toBe(input);
    }
  });

  it('rejects invalid lengths, holes, duplicates, missing sizes and non-integer flips', () => {
    const invalid: unknown[] = [null, {}, [], [1, 2], Array(3), [1, , 3], [1, 1, 3], [0, 2, 3], [1, 2, 4], [true, 2, 3], ['1', 2, 3], [1, 2, 3.5], [1, NaN, 3], [1, Infinity, 3], Array.from({ length: 9 }, (_, i) => i + 1)];
    for (const stack of invalid) {
      expect(isPancakeStack(stack)).toBe(false);
      expect(isPancakeSolved(stack as number[])).toBe(false);
      expect(pancakeRank(stack as number[])).toBe(-1);
      expect(pancakeDistance(stack as number[])).toBeNull();
      expect(flipPancakes(stack as number[], 2)).toBeNull();
      expect(getPancakeHint(stack as number[]).kind).toBe('unavailable');
    }
    const original = createPancakeState(fixture);
    for (const count of [-1, 0, 1, 4, 2.5, NaN, Infinity]) {
      expect(flipPancakes(original.stack, count)).toBeNull();
      expect(playPancake(original, count)).toBe(original);
    }
    expect(() => createPancakeState({ ...fixture, stack: [1, 1, 3] })).toThrow('Invalid pancake level');
  });

  it('records one immutable move, supports undo before completion, and counts every real flip', () => {
    const initial = createPancakeState(fixture), next = playPancake(initial, 2);
    expect(initial.stack).not.toBe(fixture.stack);
    expect(next.stack).toEqual([3, 2, 1]);
    expect(next.history).toEqual([initial.stack]);
    expect(next.history[0]).not.toBe(initial.stack);
    expect(next.moves).toBe(1);
    expect(undoPancake(next)).toEqual(initial);
    expect(undoPancake(initial)).toBe(initial);
    expect(initial).toEqual({ stack: fixture.stack, history: [], moves: 0 });
    const twice = playPancake(next, 2);
    expect(twice.stack).toEqual(initial.stack);
    expect(twice.moves).toBe(2);
    expect(twice.history).toHaveLength(2);
  });

  it('wins from the actual sorted permutation and locks moves and undo after completion', () => {
    const initial = createPancakeState(fixture), won = playPancake(playPancake(initial, 2), 3);
    expect(won.stack).toEqual([1, 2, 3]);
    expect(isPancakeSolved(won.stack)).toBe(true);
    expect(isPancakeSolved([3, 2, 1])).toBe(false);
    for (let count = 2; count <= won.stack.length; count++) expect(playPancake(won, count)).toBe(won);
    expect(undoPancake(won)).toBe(won);
    expect(getPancakeHint(won.stack).kind).toBe('complete');
  });

  it('allows a genuine longer-than-optimal solution instead of treating the target as a move cap', () => {
    let state = createPancakeState(fixture);
    for (const count of [2, 2, 2, 3]) state = playPancake(state, count);
    expect(state.moves).toBe(4);
    expect(state.moves).toBeGreaterThan(fixture.minMoves);
    expect(isPancakeSolved(state.stack)).toBe(true);
    expect(PANCAKE_SAVE_LIMIT).toBe(4096);
  });
});

describe('Exact Pancake distances independently verified', () => {
  for (let n = 3; n <= 8; n++) it(`matches independent reverse BFS for all ${factorial(n)} permutations of ${n} pancakes`, () => {
    const { queue, distances } = independentDistances(n), ranks = new Set<number>();
    expect(queue).toHaveLength(factorial(n));
    expect(pancakeDistances[n]).toHaveLength(factorial(n));
    const actualDistances: (number | null)[] = [], expectedDistances: number[] = [];
    for (const stack of queue) {
      ranks.add(pancakeRank(stack));
      actualDistances.push(pancakeDistance(stack));
      expectedDistances.push(distances.get(stack.join(','))!);
    }
    expect(actualDistances).toEqual(expectedDistances);
    expect([...ranks].sort((a, b) => a - b)).toEqual(Array.from({ length: factorial(n) }, (_, i) => i));
  });
});

describe('Original 120-level Pancake campaign', () => {
  it('keeps stable unique IDs, six teaching chapters and certificates outside runtime level data', () => {
    expect(campaign.schemaVersion).toBe(1);
    expect(pancakeLevels).toHaveLength(120);
    expect(campaign.levels).toHaveLength(120);
    expect(pancakeChapters).toHaveLength(6);
    expect(pancakeChapters.map(chapter => chapter.count)).toEqual([8, 12, 18, 24, 26, 32]);
    expect(pancakeLevels.map(level => level.id)).toEqual(Array.from({ length: 120 }, (_, i) => `pancake-${String(i + 1).padStart(3, '0')}`));
    expect(new Set(pancakeLevels.map(level => level.stack.join(','))).size).toBe(120);
    for (let chapter = 0; chapter < 6; chapter++) {
      expect(pancakeLevels.filter(level => level.chapter === chapter)).toHaveLength(pancakeChapters[chapter].count);
      expect(pancakeChapters[chapter].lesson.length).toBeGreaterThan(20);
    }
    for (const level of pancakeLevels) {
      expect(isPancakeStack(level.stack)).toBe(true);
      expect(solved(level.stack)).toBe(false);
      expect(level).not.toHaveProperty('solution');
      expect(level).not.toHaveProperty('trace');
      expect(level).not.toHaveProperty('features');
    }
  });

  for (const [index, level] of pancakeLevels.entries()) {
    it(`${level.id}: legally replays every prefix reversal and independently checks the final order`, () => {
      const proof = campaign.levels[index];
      expect(proof.id).toBe(level.id);
      expect(proof.stack).toEqual(level.stack);
      expect(proof.minMoves).toBe(level.minMoves);
      expect(proof.solution).toHaveLength(level.minMoves);
      expect(pancakeDistance(level.stack)).toBe(level.minMoves);
      let state = createPancakeState(level);
      for (const [step, count] of proof.solution.entries()) {
        expect(Number.isInteger(count)).toBe(true);
        expect(count).toBeGreaterThanOrEqual(2);
        expect(count).toBeLessThanOrEqual(level.stack.length);
        expect(solved(state.stack)).toBe(false);
        const before = state.stack, expected = reversePrefix(before, count);
        state = playPancake(state, count);
        expect(state.stack).toEqual(expected);
        expect(state.stack.slice(count)).toEqual(before.slice(count));
        expect(state.moves).toBe(step + 1);
        expect(pancakeDistance(state.stack)).toBe(level.minMoves - step - 1);
      }
      expect(state.stack).toEqual(Array.from({ length: level.stack.length }, (_, i) => i + 1));
      expect(state.history).toHaveLength(proof.solution.length);
      expect(isPancakeSolved(state.stack)).toBe(true);
    });

    it(`${level.id}: current-state hints repair every opening alternative, without mutating input`, () => {
      const optimalOpenings: number[] = [];
      for (let opening = 2; opening <= level.stack.length; opening++) {
        let stack = reversePrefix(level.stack, opening);
        const distance = pancakeDistance(stack)!;
        if (distance === level.minMoves - 1) optimalOpenings.push(opening);
        for (let remaining = distance; remaining > 0; remaining--) {
          const original = [...stack], hint = getPancakeHint(stack);
          expect(stack).toEqual(original);
          expect(hint.kind).toBe('move');
          if (hint.kind !== 'move') throw new Error(`${level.id}: ${hint.reason}`);
          expect(hint.distance).toBe(remaining);
          expect(hint.reason).toContain('精确最短距离表');
          stack = reversePrefix(stack, hint.count);
          expect(pancakeDistance(stack)).toBe(remaining - 1);
        }
        expect(solved(stack)).toBe(true);
        expect(getPancakeHint(stack).kind).toBe('complete');
      }
      expect(optimalOpenings).toEqual(campaign.levels[index].features.optimalOpenings);
    });
  }
});
