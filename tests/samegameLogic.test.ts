import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createSameGameState, getSameGameHint, isSameGameBoard, isSameGameSolved,
  playSameGame, removeSameGameGroup, samegameCanonicalKey, samegameGroup,
  samegameGroups, undoSameGame, type SameGameLevel,
} from '../src/games/samegameLogic';
import { samegameChapters, samegameLevels } from '../src/games/samegameLevels';

type Proof = {
  id: string; board: number[]; solution: number[]; canonicalKey: string;
  metrics: { certificateMixedChoices: number; certificateForcedSafeChoices: number; openingDelayedTraps: number; certificateGravityMergeMoves: number; certificateColumnMergeMoves: number; allLargestOpeningGroupsLose: boolean; reachableStates: number; winningStates: number; losingStates: number; peakFrontier: number; greedyLargestClears: boolean };
  openingOutcomes: { index: number; size: number; outcome: string }[];
};
const campaign = JSON.parse(readFileSync('docs/samegame/campaign.json', 'utf8')) as { levels: Proof[] };
const fixture = (board: number[], width: number, height: number): SameGameLevel => ({ id: 'fixture', title: 'fixture', chapter: 0, colors: 4, board, width, height });

function mirrorOccupied(board: number[], width: number, height: number): number[] {
  const used = Array.from({ length: width }, (_, x) => board.some((v, i) => i % width === x && v >= 0)).filter(Boolean).length;
  return board.map((_, i) => i % width < used ? board[Math.floor(i / width) * width + used - 1 - i % width] : -1);
}

describe('Same Game pure rules', () => {
  it('uses orthogonal connectivity, never diagonals or row wrap', () => {
    expect(samegameGroup([0, 1, 1, 0], 2, 2, 0)).toEqual([0]);
    expect(samegameGroups([0, 1, 1, 0], 2, 2)).toEqual([]);
    expect(samegameGroup([0, 0, 1, 0, 1, 1], 3, 2, 0)).toEqual([0, 1, 3]);
  });
  it('drops every column downward after removal without mutating the input', () => {
    const board = [0,1,2,3, 0,1,2,3, 1,2,0,0, 1,2,0,0];
    expect(removeSameGameGroup(board, 4, 4, 0)).toEqual([-1,1,2,3, -1,1,2,3, 1,2,0,0, 1,2,0,0]);
    expect(board).toEqual([0,1,2,3, 0,1,2,3, 1,2,0,0, 1,2,0,0]);
  });
  it('shifts empty columns left and preserves fixed dimensions with right padding', () => {
    const board = [0,1,2,3, 0,1,2,3, 0,1,2,3];
    expect(removeSameGameGroup(board, 4, 3, 1)).toEqual([0,2,3,-1, 0,2,3,-1, 0,2,3,-1]);
  });
  it('creates contacts through falling tiles without automatically removing them', () => {
    expect(removeSameGameGroup([0,1,0, 1,1,2, 0,2,2], 3, 3, 1)).toEqual([-1,-1,0, 0,-1,2, 0,2,2]);
  });
  it('rejects singletons, empty cells, invalid indices, dimensions, and corrupted values', () => {
    const board = [0,1,-1,1];
    for (const index of [-1, 4, 1.5, NaN, Infinity, 0, 2]) expect(removeSameGameGroup(board, 2, 2, index)).toBeNull();
    expect(samegameGroups([0,0], 2, 2)).toEqual([]);
    expect(samegameGroup([0,0], 0, 2, 0)).toEqual([]);
    expect(samegameGroups([4,4,0,0], 2, 2)).toEqual([]);
    expect(isSameGameBoard([0,0], 7, 1)).toBe(false);
    expect(isSameGameBoard(['0',0], 2, 1)).toBe(false);
    expect(isSameGameBoard(null, 2, 2)).toBe(false);
    expect(isSameGameBoard(Array(4), 2, 2)).toBe(false);
    expect(() => createSameGameState(fixture([0], 2, 2))).toThrow();
  });
  it('records exactly one immutable history entry for one legal group and allows pre-completion undo', () => {
    const level = fixture([0,1,0,1], 2, 2);
    const original = createSameGameState(level);
    expect(original.board).not.toBe(level.board);
    const next = playSameGame(original, level, 0);
    expect(next.board).toEqual([1,-1,1,-1]);
    expect(next.history).toEqual([[0,1,0,1]]);
    expect(next.history[0]).not.toBe(original.board);
    expect(playSameGame(next, level, 1)).toBe(next);
    expect(undoSameGame(next)).toEqual(original);
    expect(undoSameGame(original)).toBe(original);
  });
  it('wins only when every tile is gone and locks moves and undo after completion', () => {
    const level = fixture([0,0,0,0], 2, 2);
    const won = playSameGame(createSameGameState(level), level, 0);
    expect(isSameGameSolved(won.board)).toBe(true);
    expect(isSameGameSolved([-1,0,-1,-1])).toBe(false);
    expect(isSameGameSolved([])).toBe(false);
    expect(isSameGameSolved(Array(4))).toBe(false);
    expect(playSameGame(won, level, 0)).toBe(won);
    expect(undoSameGame(won)).toBe(won);
    expect(getSameGameHint(level, won.board).kind).toBe('complete');
  });
  it('distinguishes a proved dead end from exhausted search', () => {
    const level = fixture([0,1,0,1], 2, 2);
    expect(getSameGameHint(level, level.board, 0).kind).toBe('unavailable');
    expect(getSameGameHint(level, level.board, 1).kind).toBe('move');
    expect(getSameGameHint(level, [0,1,1,0], 0).kind).toBe('dead-end');
    expect(getSameGameHint(level, [0,0,1,-1], 10).kind).toBe('dead-end');
    expect(getSameGameHint(level, [9,9,9,9]).kind).toBe('unavailable');
  });
});

describe('original Same Game campaign', () => {
  it('has 100 original stable IDs and five balanced chapters with no certificate in runtime data', () => {
    expect(samegameLevels).toHaveLength(100);
    expect(samegameChapters).toHaveLength(5);
    expect(new Set(samegameLevels.map(l => l.id)).size).toBe(100);
    expect(samegameLevels.map(l => l.id)).toEqual(campaign.levels.map(l => l.id));
    expect(samegameLevels[0].id).toBe('samegame-001');
    expect(samegameLevels.at(-1)?.id).toBe('samegame-100');
    for (let chapter = 0; chapter < 5; chapter++) expect(samegameLevels.filter(l => l.chapter === chapter)).toHaveLength(20);
    for (const level of samegameLevels) {
      expect(level.width).toBeLessThanOrEqual(6);
      expect(level.height).toBeLessThanOrEqual(7);
      expect(level.board).toHaveLength(level.width * level.height);
      expect(level.board.every(c => c >= 0 && c < level.colors)).toBe(true);
      expect(level).not.toHaveProperty('solution');
      expect(level).not.toHaveProperty('trace');
    }
  });
  it('has no color-relabel or packed-horizontal-reflection duplicate', () => {
    const keys = samegameLevels.map(l => samegameCanonicalKey(l.board, l.width, l.height));
    expect(new Set(keys).size).toBe(100);
    expect(keys).toEqual(campaign.levels.map(l => l.canonicalKey));
  });
  it('enforces measured chapter challenge and teaching thresholds beyond board size', () => {
    for (let i = 0; i < campaign.levels.length; i++) {
      const m = campaign.levels[i].metrics;
      const chapter = samegameLevels[i].chapter + 1;
      expect(m.winningStates + m.losingStates).toBe(m.reachableStates);
      expect(m.certificateMixedChoices).toBeGreaterThanOrEqual([0,1,3,4,6,8][chapter]);
      if (chapter >= 2) {
        expect(m.openingDelayedTraps).toBeGreaterThanOrEqual(chapter < 4 ? 1 : 2);
        expect(m.certificateGravityMergeMoves).toBeGreaterThan(0);
        expect(m.greedyLargestClears).toBe(false);
      }
      if (chapter >= 3) expect(m.certificateColumnMergeMoves).toBeGreaterThan(0);
      if (chapter >= 4) expect(m.certificateForcedSafeChoices).toBeGreaterThanOrEqual(chapter === 4 ? 3 : 4);
    }
    for (let chapter = 2; chapter <= 5; chapter++) {
      const strict = campaign.levels.filter((l, i) => samegameLevels[i].chapter + 1 === chapter && l.metrics.allLargestOpeningGroupsLose);
      expect(strict.length).toBeGreaterThanOrEqual(chapter < 4 ? 5 : 10);
    }
  });

  for (const [index, level] of samegameLevels.entries()) {
    it(`${level.id}: certificate legally clears and reflection commutes with each transition`, () => {
      const proof = campaign.levels[index];
      expect(level.board).toEqual(proof.board);
      let state = createSameGameState(level);
      for (const selected of proof.solution) {
        const before = state.board;
        const mirrored = mirrorOccupied(before, level.width, level.height);
        const used = Array.from({ length: level.width }, (_, x) => before.some((v, i) => i % level.width === x && v >= 0)).filter(Boolean).length;
        const mirroredIndex = Math.floor(selected / level.width) * level.width + used - 1 - selected % level.width;
        const mirrorAfter = removeSameGameGroup(mirrored, level.width, level.height, mirroredIndex);
        expect(samegameGroup(before, level.width, level.height, selected).length).toBeGreaterThan(1);
        state = playSameGame(state, level, selected);
        expect(state.board).not.toBe(before);
        expect(mirrorAfter).not.toBeNull();
        expect(samegameCanonicalKey(state.board, level.width, level.height)).toBe(samegameCanonicalKey(mirrorAfter!, level.width, level.height));
      }
      expect(state.board.every(value => value === -1)).toBe(true);
      expect(state.board).toHaveLength(level.width * level.height);
      expect(state.history).toHaveLength(proof.solution.length);
    });
    it(`${level.id}: current-board hint supplies a legal clearing continuation`, () => {
      let board = [...level.board];
      for (let step = 0; step < Math.floor(level.board.length / 2); step++) {
        if (isSameGameSolved(board)) break;
        const hint = getSameGameHint(level, board);
        expect(hint.kind).toBe('move');
        if (hint.kind !== 'move') throw new Error(`${level.id}: ${hint.reason}`);
        const next = removeSameGameGroup(board, level.width, level.height, hint.index);
        expect(next).not.toBeNull();
        board = next!;
      }
      expect(isSameGameSolved(board)).toBe(true);
    });
  }
  it('proves losing opening alternatives without misusing the initial certificate', () => {
    for (const index of [0,19,20,39,40,59,60,79,80,99]) {
      const level = samegameLevels[index];
      for (const outcome of campaign.levels[index].openingOutcomes) {
        const next = removeSameGameGroup(level.board, level.width, level.height, outcome.index)!;
        const hint = getSameGameHint(level, next, 30000);
        expect(['unavailable']).not.toContain(hint.kind);
        expect(hint.kind === 'dead-end').toBe(outcome.outcome === 'losing');
      }
    }
  });
});
