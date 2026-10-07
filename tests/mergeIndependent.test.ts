import { describe, expect, it } from "vitest";
import {
  MERGE_HISTORY_LIMIT,
  createMergeState,
  isMergeGameOver,
  legalMergeMoves,
  mergeLine,
  mergeMove,
  nextMergeSeed,
  nextMergeValue,
  restoreMergeState,
  slideMergeBoard,
  spawnMergeTile,
  undoMerge,
  validMergeBoard,
  type MergeDirection,
  type MergeState,
} from "../src/games/mergeLogic";

const directions: MergeDirection[] = ["up", "right", "down", "left"];
const vectors: Record<MergeDirection, readonly [number, number]> = {
  up: [-1, 0],
  right: [0, 1],
  down: [1, 0],
  left: [0, -1],
};

/**
 * Independent oracle: walk individual cells toward the chosen edge, one step at
 * a time, and lock a destination after a collision. This deliberately does not
 * compact lines, pair adjacent entries, or call any production merge helper.
 */
function referenceMove(input: readonly number[], direction: MergeDirection) {
  const board = [...input];
  const sources = input.map((value, index) => (value ? [index] : []));
  const collided = new Set<number>();
  const [dy, dx] = vectors[direction];
  const cells = Array.from({ length: 16 }, (_, index) => index).sort(
    (a, b) =>
      (Math.floor(b / 4) - Math.floor(a / 4)) * dy +
      ((b % 4) - (a % 4)) * dx,
  );
  let score = 0;
  for (const source of cells) {
    if (board[source] === 0) continue;
    let at = source;
    while (true) {
      const row = Math.floor(at / 4) + dy;
      const column = (at % 4) + dx;
      if (row < 0 || row > 3 || column < 0 || column > 3) break;
      const next = row * 4 + column;
      if (board[next] === 0) {
        board[next] = board[at];
        sources[next] = sources[at];
        board[at] = 0;
        sources[at] = [];
        at = next;
      } else if (board[next] === board[at] && !collided.has(next)) {
        board[next] += board[at];
        score += board[next];
        sources[next] = [...sources[next], ...sources[at]];
        board[at] = 0;
        sources[at] = [];
        collided.add(next);
        break;
      } else break;
    }
  }
  return {
    board,
    score,
    changed: board.some((value, index) => value !== input[index]),
    sources,
  };
}

function sum(board: readonly number[]) {
  return board.reduce((total, value) => total + value, 0);
}

// Each a + a -> 2a collision increases this potential by precisely 2a.
function scorePotential(board: readonly number[]) {
  return board.reduce(
    (total, value) => total + (value === 0 ? 0 : value * Math.log2(value)),
    0,
  );
}

function verifyMove(board: readonly number[], direction: MergeDirection) {
  const before = [...board];
  const expected = referenceMove(board, direction);
  const actual = slideMergeBoard(board, direction);
  const context = `${direction}: ${JSON.stringify(board)}`;
  expect(actual.board, context).toEqual(expected.board);
  expect(actual.score, context).toBe(expected.score);
  expect(actual.changed, context).toBe(expected.changed);
  const expectedMotion = expected.sources.flatMap((sources, to) =>
    sources.map((from) => ({
      from,
      to,
      value: board[from],
      merged: sources.length === 2,
    })),
  );
  expect(
    [...actual.motion].sort((a, b) => a.from - b.from),
    `${context}: each original tile has exactly one correct motion`,
  ).toEqual(expectedMotion.sort((a, b) => a.from - b.from));
  expect(board, `${context}: input must stay unchanged`).toEqual(before);
  expect(validMergeBoard(actual.board), context).toBe(true);
  expect(sum(actual.board), `${context}: tile mass`).toBe(sum(board));
  expect(actual.score, `${context}: score potential`).toBe(
    scorePotential(actual.board) - scorePotential(board),
  );
  const tilesBefore = board.filter(Boolean).length;
  const tilesAfter = actual.board.filter(Boolean).length;
  expect(tilesAfter, context).toBeLessThanOrEqual(tilesBefore);
  expect(tilesAfter, `${context}: no tile can merge twice`).toBeGreaterThanOrEqual(
    Math.ceil(tilesBefore / 2),
  );
  if (!expected.changed) {
    expect(actual.score, `${context}: no-op has no score`).toBe(0);
    expect(actual.board, `${context}: no-op has no spawn`).toEqual(board);
  }
  return expected;
}

function allLines() {
  const values = [0, 2, 4, 8, 16];
  return Array.from({ length: values.length ** 4 }, (_, code) => {
    const line: number[] = [];
    for (let cell = 0; cell < 4; cell++) {
      line.push(values[code % values.length]);
      code = Math.floor(code / values.length);
    }
    return line;
  });
}

// Test data uses a different generator from the game's LCG.
function testRandom(initial: number) {
  let state = initial >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

describe("independent classic 2048 rules", () => {
  it.each([
    [[2, 2, 4, 0], [4, 4, 0, 0], 4],
    [[2, 2, 2, 2], [4, 4, 0, 0], 8],
    [[4, 0, 4, 4], [8, 4, 0, 0], 8],
    [[2, 2, 2, 0], [4, 2, 0, 0], 4],
    [[4, 4, 8, 8], [8, 16, 0, 0], 24],
    [[4, 2, 2, 4], [4, 4, 4, 0], 4],
    [[0, 2, 0, 2], [4, 0, 0, 0], 4],
    [[0, 0, 0, 0], [0, 0, 0, 0], 0],
  ] as const)("locks new merges for %j", (input, output, score) => {
    const actual = mergeLine(Object.freeze([...input]));
    expect(actual.line).toEqual(output);
    expect(actual.score).toBe(score);
    const reference = referenceMove([...input, ...Array(12).fill(0)], "left");
    expect(reference.board.slice(0, 4)).toEqual(output);
    expect(reference.score).toBe(score);
    expect(reference.sources.every((sources) => sources.length <= 2)).toBe(true);
  });

  it("exhausts all 625 four-cell lines through the public line API", () => {
    for (const line of allLines()) {
      const frozen = Object.freeze([...line]);
      const expected = referenceMove([...line, ...Array(12).fill(0)], "left");
      const actual = mergeLine(frozen);
      expect(actual.line, JSON.stringify(line)).toEqual(
        expected.board.slice(0, 4),
      );
      expect(actual.score, JSON.stringify(line)).toBe(expected.score);
      expect(frozen).toEqual(line);
    }
  });

  it.each(directions)(
    "exhausts all 625 lines in every board lane moving %s",
    (direction) => {
      for (const line of allLines()) {
        for (let lane = 0; lane < 4; lane++) {
          const board = Array<number>(16).fill(0);
          for (let cell = 0; cell < 4; cell++) {
            const index =
              direction === "left" || direction === "right"
                ? lane * 4 + cell
                : cell * 4 + lane;
            board[index] = line[cell];
          }
          verifyMove(Object.freeze(board), direction);
        }
      }
    },
  );

  it("matches 1,000 independent seeded boards in all four directions", () => {
    const random = testRandom(0x2048cafe);
    const values = [
      0, 0, 0, 0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096,
    ];
    for (let sample = 0; sample < 1000; sample++) {
      const board = Object.freeze(
        Array.from({ length: 16 }, () => values[random() % values.length]),
      );
      const legal: MergeDirection[] = [];
      for (const direction of directions) {
        if (verifyMove(board, direction).changed) legal.push(direction);
      }
      expect(legalMergeMoves(board), `seeded board ${sample}`).toEqual(legal);
      expect(isMergeGameOver(board), `seeded board ${sample}`).toBe(
        legal.length === 0,
      );
    }
  }, 20000);

  it("continues merging beyond 2048 rather than treating the milestone as game over", () => {
    const board = Object.freeze([
      2048, 2048, 4096, 4096, ...Array(12).fill(0),
    ]);
    expect(isMergeGameOver(board)).toBe(false);
    expect(legalMergeMoves(board)).toContain("left");
    const moved = slideMergeBoard(board, "left");
    expect(moved.board).toEqual([
      4096, 8192, 0, 0, ...Array(12).fill(0),
    ]);
    expect(moved.score).toBe(12288);
    expect(moved.changed).toBe(true);
    const second = slideMergeBoard(
      [8192, 8192, 16384, 0, ...Array(12).fill(0)],
      "left",
    );
    expect(second.board.slice(0, 4)).toEqual([16384, 16384, 0, 0]);
    expect(second.score).toBe(16384);
  });

  it("distinguishes a full locked board from horizontal or vertical merge opportunities", () => {
    const locked = Object.freeze([
      2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2,
    ]);
    expect(legalMergeMoves(locked)).toEqual([]);
    expect(isMergeGameOver(locked)).toBe(true);
    for (const direction of directions) verifyMove(locked, direction);
    const horizontal = [...locked];
    horizontal[0] = 4;
    expect(legalMergeMoves(horizontal)).toContain("left");
    expect(isMergeGameOver(horizontal)).toBe(false);
    const vertical = [...locked];
    vertical[4] = 2;
    expect(legalMergeMoves(vertical)).toContain("up");
    expect(isMergeGameOver(vertical)).toBe(false);
    const gap = [...locked];
    gap[0] = 0;
    expect(isMergeGameOver(gap)).toBe(false);
  });

  it("accepts only sixteen actual cells containing zero or exact safe powers of two", () => {
    expect(validMergeBoard(Array(16).fill(0))).toBe(true);
    for (let exponent = 1; exponent <= 52; exponent++) {
      expect(validMergeBoard([2 ** exponent, ...Array(15).fill(0)])).toBe(true);
    }
    for (const invalid of [
      1, -2, 3, 6, 0.5, NaN, Infinity, 2 ** 53, 2 ** 52 - 1, 2 ** 51 + 1,
    ]) {
      expect(
        validMergeBoard([invalid, ...Array(15).fill(0)]),
        String(invalid),
      ).toBe(false);
    }
    for (const board of [
      [], Array(15).fill(0), Array(17).fill(0), Array(16),
    ]) {
      expect(validMergeBoard(board)).toBe(false);
    }
    const sparse = Array(16).fill(0);
    delete sparse[7];
    expect(validMergeBoard(sparse)).toBe(false);
  });

  it("rejects malformed moves without mutating the supplied board", () => {
    for (const board of [
      Object.freeze([2, 2]),
      Object.freeze([3, ...Array(15).fill(0)]),
    ]) {
      expect(validMergeBoard(board)).toBe(false);
      expect(legalMergeMoves(board)).toEqual([]);
      for (const direction of directions) {
        const actual = slideMergeBoard(board, direction);
        expect(actual.board).toEqual(board);
        expect(actual.changed).toBe(false);
        expect(actual.score).toBe(0);
      }
    }
    const board = Object.freeze([2, 2, 0, 0, ...Array(12).fill(0)]);
    const actual = slideMergeBoard(board, "diagonal" as MergeDirection);
    expect(actual.board).toEqual(board);
    expect(actual.changed).toBe(false);
    expect(actual.score).toBe(0);
  });
});

describe("independent classic 2048 spawning", () => {
  it("adds exactly one 2 or 4 in an empty cell and preserves every existing tile", () => {
    const random = testRandom(0x5eed2048);
    for (let sample = 0; sample < 1000; sample++) {
      const board = Object.freeze(
        Array.from({ length: 16 }, () =>
          random() % 3 ? 2 ** (1 + (random() % 12)) : 0,
        ),
      );
      const seed = random();
      const original = [...board];
      const spawned = spawnMergeTile(board, seed);
      expect(spawnMergeTile(board, seed)).toEqual(spawned);
      expect(board).toEqual(original);
      if (board.every(Boolean)) {
        expect(spawned.board).toEqual(board);
        expect(spawned.index).toBeNull();
        expect(spawned.seed).toBe(seed);
      } else {
        expect(spawned.index).not.toBeNull();
        const index = spawned.index!;
        expect(Number.isInteger(index)).toBe(true);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(16);
        expect(board[index]).toBe(0);
        expect([2, 4]).toContain(spawned.board[index]);
        expect(spawned.board[index]).toBe(nextMergeValue(seed));
        expect(spawned.seed).toBe(nextMergeSeed(seed));
        expect(spawned.board.filter(Boolean)).toHaveLength(
          board.filter(Boolean).length + 1,
        );
        expect(sum(spawned.board) - sum(board)).toBe(spawned.board[index]);
        for (let cell = 0; cell < 16; cell++) {
          if (cell !== index) expect(spawned.board[cell]).toBe(board[cell]);
        }
      }
      expect(validMergeBoard(spawned.board)).toBe(true);
    }
  });

  it("fills every possible single remaining empty cell without changing a full board", () => {
    const full = Array.from(
      { length: 16 },
      (_, index) => 2 ** (1 + (index % 10)),
    );
    for (let empty = 0; empty < 16; empty++) {
      const board = [...full];
      board[empty] = 0;
      const spawned = spawnMergeTile(Object.freeze(board), empty * 193 + 7);
      expect(spawned.index).toBe(empty);
      expect(spawned.board.filter(Boolean)).toHaveLength(16);
    }
    const frozen = Object.freeze(full);
    const spawned = spawnMergeTile(frozen, 17);
    expect(spawned.board).toEqual(full);
    expect(spawned.seed).toBe(17);
    expect(spawned.index).toBeNull();
  });

  it("has a deterministic unsigned seed stream and approximately 90/10 tile values", () => {
    let seed = 0x2048;
    let fours = 0;
    for (let sample = 0; sample < 10000; sample++) {
      const value = nextMergeValue(seed);
      expect([2, 4]).toContain(value);
      if (value === 4) fours++;
      const next = nextMergeSeed(seed);
      expect(nextMergeSeed(seed)).toBe(next);
      expect(Number.isInteger(next)).toBe(true);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThanOrEqual(0xffffffff);
      seed = next;
    }
    expect(fours).toBeGreaterThan(800);
    expect(fours).toBeLessThan(1200);
  });
});

function gameplaySnapshot(state: MergeState) {
  return {
    board: [...state.board],
    seed: state.seed,
    score: state.score,
    moves: state.moves,
  };
}

function freezeState(state: MergeState) {
  Object.freeze(state.board);
  state.tiles.forEach(Object.freeze);
  Object.freeze(state.tiles);
  state.motion.forEach(Object.freeze);
  Object.freeze(state.motion);
  Object.freeze(state.mergedIds);
  state.history.forEach((snapshot) => {
    Object.freeze(snapshot.board);
    Object.freeze(snapshot);
  });
  Object.freeze(state.history);
  return Object.freeze(state);
}

function verifyTileIdentities(state: MergeState) {
  expect(state.tiles).toHaveLength(state.board.filter(Boolean).length);
  expect(new Set(state.tiles.map((tile) => tile.id)).size).toBe(
    state.tiles.length,
  );
  expect(new Set(state.tiles.map((tile) => tile.index)).size).toBe(
    state.tiles.length,
  );
  for (const tile of state.tiles) {
    expect(Number.isInteger(tile.id)).toBe(true);
    expect(tile.id).toBeGreaterThan(0);
    expect(tile.id).toBeLessThan(state.nextId);
    expect(tile.value).toBe(state.board[tile.index]);
    expect(tile.value).toBeGreaterThan(0);
  }
}

function verifyStateMove(state: MergeState, direction: MergeDirection) {
  const before = gameplaySnapshot(state);
  const expected = referenceMove(state.board, direction);
  const oldTiles = new Map(state.tiles.map((tile) => [tile.index, tile]));
  const oldIds = new Set(state.tiles.map((tile) => tile.id));
  const actual = mergeMove(freezeState(state), direction);
  expect(gameplaySnapshot(state)).toEqual(before);
  if (!expected.changed) {
    expect(actual).toBe(state);
    return actual;
  }
  expect(actual).not.toBe(state);
  expect(actual.moves).toBe(state.moves + 1);
  expect(actual.score).toBe(state.score + expected.score);
  expect(actual.seed).toBe(nextMergeSeed(state.seed));
  expect(actual.spawned).not.toBeNull();
  const spawned = actual.spawned!;
  expect(expected.board[spawned]).toBe(0);
  const expectedBoard = [...expected.board];
  expectedBoard[spawned] = nextMergeValue(state.seed);
  expect(actual.board).toEqual(expectedBoard);
  expect(actual.history).toHaveLength(
    Math.min(state.history.length + 1, MERGE_HISTORY_LIMIT),
  );
  expect(actual.history.at(-1)).toEqual(before);
  expect(actual.history.slice(0, -1)).toEqual(
    state.history.slice(-(MERGE_HISTORY_LIMIT - 1)),
  );

  verifyTileIdentities(actual);
  const newTiles = new Map(actual.tiles.map((tile) => [tile.index, tile]));
  const mergedIds: number[] = [];
  for (let destination = 0; destination < 16; destination++) {
    const sources = expected.sources[destination];
    if (sources.length === 0) continue;
    const tile = newTiles.get(destination)!;
    if (sources.length === 1) {
      expect(tile.id).toBe(oldTiles.get(sources[0])!.id);
    } else {
      expect(sources).toHaveLength(2);
      expect(oldIds.has(tile.id)).toBe(false);
      mergedIds.push(tile.id);
    }
  }
  expect(oldIds.has(newTiles.get(spawned)!.id)).toBe(false);
  expect(actual.mergedIds).toEqual(mergedIds);
  expect(actual.nextId).toBe(state.nextId + mergedIds.length + 1);
  const expectedMotion = expected.sources.flatMap((sources, to) =>
    sources.map((from) => ({
      from,
      to,
      value: state.board[from],
      merged: sources.length === 2,
      id: oldTiles.get(from)!.id,
    })),
  );
  expect([...actual.motion].sort((a, b) => a.from - b.from)).toEqual(
    expectedMotion.sort((a, b) => a.from - b.from),
  );
  return actual;
}

describe("independent classic 2048 state and identity invariants", () => {
  it("initializes exactly two seeded tiles and no progress or animation state", () => {
    for (const seed of [0, 1, 2048, 0x7fffffff, 0xffffffff]) {
      const state = createMergeState(seed);
      expect(createMergeState(seed)).toEqual(state);
      expect(state.board.filter(Boolean)).toHaveLength(2);
      expect(
        state.board
          .filter(Boolean)
          .every((value) => value === 2 || value === 4),
      ).toBe(true);
      expect(state.seed).toBe(nextMergeSeed(nextMergeSeed(seed)));
      expect(state.score).toBe(0);
      expect(state.moves).toBe(0);
      expect(state.history).toEqual([]);
      expect(state.motion).toEqual([]);
      expect(state.mergedIds).toEqual([]);
      verifyTileIdentities(state);
    }
  });

  it("preserves the whole state and consumes nothing for no-op or invalid directions", () => {
    const state = restoreMergeState({
      board: [2, 0, 0, 0, ...Array(12).fill(0)],
      seed: 17,
      score: 128,
      moves: 9,
    });
    verifyStateMove(state, "up");
    verifyStateMove(state, "left");
    expect(mergeMove(state, "diagonal" as MergeDirection)).toBe(state);
    expect(undoMerge(state)).toBe(state);
    verifyStateMove(state, "right");
  });

  it("keeps unmerged tile IDs stable and gives both merged and spawned tiles new IDs", () => {
    const state = restoreMergeState({
      board: [2, 2, 4, 0, 0, 8, 0, 0, 16, 16, 32, 32, 0, 0, 64, 0],
      seed: 93,
      score: 44,
      moves: 6,
    });
    for (const direction of directions) verifyStateMove(state, direction);
  });

  it("allows real state moves after 2048, then undoes and deterministically replays them", () => {
    const start = restoreMergeState({
      board: [2048, 2048, 4096, 4096, ...Array(12).fill(0)],
      seed: 92817,
      score: 50000,
      moves: 900,
    });
    const moved = verifyStateMove(start, "left");
    expect(moved.score).toBe(62288);
    expect(moved.board).toContain(8192);
    expect(moved.moves).toBe(901);
    const next = verifyStateMove(moved, "down");
    expect(next.moves).toBe(902);
    const undone = undoMerge(freezeState(next));
    expect(gameplaySnapshot(undone)).toEqual(gameplaySnapshot(moved));
    expect(undone.motion).toEqual([]);
    expect(undone.mergedIds).toEqual([]);
    expect(undone.spawned).toBeNull();
    expect(gameplaySnapshot(verifyStateMove(undone, "down"))).toEqual(
      gameplaySnapshot(next),
    );
    const restored = undoMerge(freezeState(undone));
    expect(gameplaySnapshot(restored)).toEqual(gameplaySnapshot(start));
    expect(restored.history).toEqual([]);
    verifyTileIdentities(restored);
  });

  it("preserves gameplay and identity invariants through seeded play and bounded undo history", () => {
    const random = testRandom(0x51512048);
    let checkedMoves = 0;
    let reachedHistoryLimit = false;
    for (let game = 0; game < 12; game++) {
      let state = createMergeState(random());
      const previousPositions = [gameplaySnapshot(state)];
      for (let turn = 0; turn < 128; turn++) {
        const legal = directions.filter(
          (direction) => referenceMove(state.board, direction).changed,
        );
        if (legal.length === 0) {
          expect(isMergeGameOver(state.board)).toBe(true);
          break;
        }
        const direction = legal[random() % legal.length];
        state = verifyStateMove(state, direction);
        previousPositions.push(gameplaySnapshot(state));
        checkedMoves++;
        if (state.history.length === MERGE_HISTORY_LIMIT)
          reachedHistoryLimit = true;
      }
      const available = state.history.length;
      for (let step = 1; step <= available; step++) {
        state = undoMerge(freezeState(state));
        expect(gameplaySnapshot(state)).toEqual(
          previousPositions[previousPositions.length - 1 - step],
        );
        verifyTileIdentities(state);
      }
      expect(state.history).toEqual([]);
      expect(undoMerge(state)).toBe(state);
    }
    expect(checkedMoves).toBeGreaterThan(300);
    expect(reachedHistoryLimit).toBe(true);
  }, 20000);
});
