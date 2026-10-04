// SPDX-License-Identifier: MIT
import { describe, it, expect, vi } from "vitest";
import { symmetryRepairLevels } from "../src/games/symmetryRepairLevels";
import { probabilityBagLevels } from "../src/games/probabilityBagLevels";
import {
  createSymmetryState,
  editSymmetry,
  symmetryCost,
  symmetryConflicts,
  symmetryImage,
  symmetryOrbits,
  symmetryWon,
  undoSymmetry,
  searchSymmetryHint,
  symmetryHintSteps,
  validSymmetryLevel,
  type SymmetryLevel,
  type SymmetryCell,
} from "../src/games/symmetryRepairLogic";
import {
  bagCost,
  bagEventProbability,
  bagWon,
  createBagState,
  changeBagCount,
  undoBag,
  rational,
  rationalEqual,
  searchBagHint,
  bagHintSteps,
  validBagLevel,
  type BagCounts,
  type BagEvent,
} from "../src/games/probabilityBagLogic";
import { runLabSearch } from "../src/games/symmetryProbabilityRound";
import {
  independentBagSolutions,
  independentBagValid,
  independentEventCounts,
  independentSymmetrySolutions,
  independentSymmetryValid,
} from "./symmetryProbabilityOracle";
describe("Symmetry Repair authored public constraints", () => {
  it.each(symmetryRepairLevels.map((l, i) => [i + 1, l] as const))(
    "level %i has independently verified choices and reachable legal solution",
    (_, l) => {
      expect(validSymmetryLevel(l)).toBe(true);
      expect(symmetryWon(l, l.initial)).toBe(false);
      const solutions = independentSymmetrySolutions(l);
      expect(solutions.length).toBeGreaterThan(0);
      for (const b of solutions) expect(symmetryWon(l, b)).toBe(true);
      const target = solutions[0];
      let state = createSymmetryState(l);
      for (let i = 0; i < target.length; i++) {
        if (state.board[i] !== target[i])
          state = editSymmetry(l, state, i, target[i]);
        expect(symmetryCost(l, state.board)).toBeLessThanOrEqual(l.budget);
      }
      expect(independentSymmetryValid(l, state.board)).toBe(true);
      expect(editSymmetry(l, state, 0, 0)).toBe(state);
      expect(undoSymmetry(l, state)).toBe(state);
      const hint = searchSymmetryHint(l, l.initial);
      expect(hint.status).toBe("found");
      if (hint.status === "found") {
        const distances = solutions.map(
          (b) => b.filter((v, i) => v !== l.initial[i]).length,
        );
        expect(hint.changes).toBe(Math.min(...distances));
        expect(
          editSymmetry(l, createSymmetryState(l), hint.index, hint.value),
        ).not.toEqual(createSymmetryState(l));
      }
    },
  );
  it("accepts multiple valid patterns instead of comparing a hidden picture", () => {
    const answers = independentSymmetrySolutions(symmetryRepairLevels[1]);
    expect(answers.length).toBeGreaterThan(1);
    for (const answer of answers)
      expect(symmetryWon(symmetryRepairLevels[1], answer)).toBe(true);
  });
  it("matches an independent direct coordinate oracle for every 3×3 binary pattern", () => {
    for (const l of symmetryRepairLevels.filter((l) => l.size === 3))
      for (let bits = 0; bits < 512; bits++) {
        const b = Array.from(
          { length: 9 },
          (_, i) => ((bits >> i) & 1) as SymmetryCell,
        );
        expect(symmetryWon(l, b)).toBe(independentSymmetryValid(l, b));
      }
  });
  it("computes composed orbits and quarter-turns, reports conflict without treating ? as empty", () => {
    const l = symmetryRepairLevels[10];
    expect(symmetryOrbits(l).some((o) => o.length === 8)).toBe(true);
    expect(symmetryImage(0, 5, "quarterTurn")).toBe(4);
    expect(
      symmetryConflicts(
        {
          ...symmetryRepairLevels[0],
          initial: [1, null, null, 0, 0, 0, 0, 0, 0],
        },
        [1, null, null, 0, 0, 0, 0, 0, 0],
      ).size,
    ).toBe(0);
  });
  it("rejects invalid edits, restores net budget with undo and searches actual mistaken state", () => {
    const l = symmetryRepairLevels[0],
      initial = createSymmetryState(l);
    expect(editSymmetry(l, initial, 0, 0)).toBe(initial);
    expect(editSymmetry(l, initial, -1, 1)).toBe(initial);
    const changed = editSymmetry(l, initial, 1, 1);
    expect(changed).not.toBe(initial);
    expect(undoSymmetry(l, changed)).toEqual(initial);
    const hint = searchSymmetryHint(l, changed.board);
    expect(hint.status).toBe("found");
    if (hint.status === "found") {
      const d = Math.min(
        ...independentSymmetrySolutions(l).map(
          (b) => b.filter((v, i) => v !== changed.board[i]).length,
        ),
      );
      expect(hint.changes).toBe(d);
    }
    const tight = { ...l, budget: 0 };
    expect(editSymmetry(tight, createSymmetryState(tight), 1, 1).board).toEqual(
      l.initial,
    );
  });
  it("honestly distinguishes bounded search, solved, and contradictory locked clues", () => {
    const l = symmetryRepairLevels[0];
    expect(searchSymmetryHint(l, l.initial, 0).status).toBe("budget");
    expect(
      searchSymmetryHint(l, independentSymmetrySolutions(l)[0]).status,
    ).toBe("solved");
    const impossible: SymmetryLevel = {
      ...l,
      initial: [1, 0, 0, 0, 0, 0, 0, 0, 0],
      locked: [0, 2],
    };
    expect(searchSymmetryHint(impossible, impossible.initial).status).toBe(
      "none",
    );
    expect(validSymmetryLevel({ ...l, size: 6 })).toBe(false);
  });
});
describe("Probability Bag exact elementary oracle", () => {
  it.each(probabilityBagLevels.map((l, i) => [i + 1, l] as const))(
    "level %i has independent physical-token solution and exact search",
    (_, l) => {
      expect(validBagLevel(l)).toBe(true);
      expect(bagWon(l, l.initial)).toBe(false);
      const solutions = independentBagSolutions(l);
      expect(solutions.length).toBeGreaterThan(0);
      for (const solution of solutions) expect(bagWon(l, solution)).toBe(true);
      for (let a = 0; a <= l.size; a++)
        for (let b = 0; b <= l.size - a; b++) {
          const c: BagCounts = [a, b, l.size - a - b];
          expect(bagWon(l, c)).toBe(independentBagValid(l, c));
        }
      const hint = searchBagHint(l, l.initial);
      expect(hint.status).toBe("found");
      if (hint.status === "found")
        expect(hint.distance).toBe(
          Math.min(
            ...solutions.map((c) =>
              c.reduce((s, n, i) => s + Math.abs(n - l.initial[i]), 0),
            ),
          ),
        );
    },
  );
  it("agrees with distinguishable-token enumeration for every event and small composition", () => {
    const events: BagEvent[] = [
      ...probabilityBagLevels.flatMap((l) => l.targets.map((t) => t.event)),
      { kind: "conditional", colors: [0, 1], given: [1, 2] },
    ];
    for (let a = 0; a < 5; a++)
      for (let b = 0; b < 4; b++)
        for (let c = 0; c < 3; c++)
          for (const event of events) {
            const counts: BagCounts = [a, b, c];
            const [good, total] = independentEventCounts(counts, event),
              p = bagEventProbability(counts, event);
            if (!total) expect(p).toBeNull();
            else {
              expect(p).not.toBeNull();
              expect(p![0] * total).toBe(p![1] * good);
            }
          }
  });
  it("distinguishes replacement, no replacement, fixed order, both orders, and zero conditioning", () => {
    expect(
      bagEventProbability([1, 1, 0], {
        kind: "pair",
        rule: "same",
        replacement: false,
      }),
    ).toEqual([0, 1]);
    expect(
      bagEventProbability([1, 1, 0], {
        kind: "pair",
        rule: "same",
        replacement: true,
      }),
    ).toEqual([1, 2]);
    expect(
      bagEventProbability([2, 3, 1], {
        kind: "pair",
        rule: "ordered",
        replacement: false,
        colors: [0, 1],
      }),
    ).toEqual([1, 5]);
    expect(
      bagEventProbability([2, 3, 1], {
        kind: "pair",
        rule: "oneEach",
        replacement: false,
        colors: [0, 1],
      }),
    ).toEqual([2, 5]);
    expect(
      bagEventProbability([0, 0, 6], {
        kind: "conditional",
        colors: [0],
        given: [0, 1],
      }),
    ).toBeNull();
    expect(
      bagEventProbability([1, 0, 0], {
        kind: "pair",
        rule: "same",
        replacement: false,
      }),
    ).toBeNull();
    expect(rational(0, 7)).toEqual([0, 1]);
    expect(rational(8, 12)).toEqual([2, 3]);
    expect(rationalEqual([2, 4], [1, 2])).toBe(true);
    expect(rationalEqual(null, [0, 1])).toBe(false);
  });
  it("preserves integer capacity, reversible history and completed immutability", () => {
    const l = probabilityBagLevels[0],
      s = createBagState(l);
    expect(changeBagCount(l, s, 0, 0)).toBe(s);
    expect(changeBagCount(l, s, -1, 1)).toBe(s);
    const added = changeBagCount(l, s, 0, 1);
    expect(undoBag(l, added)).toEqual(s);
    const full = { counts: [0, 0, 6] as BagCounts, history: [] };
    expect(changeBagCount(l, full, 0, 1)).toBe(full);
    const finished = {
      counts: independentBagSolutions(l)[0],
      history: [s.counts],
    };
    expect(changeBagCount(l, finished, 1, -1)).toBe(finished);
    expect(undoBag(l, finished)).toBe(finished);
    expect(bagCost(probabilityBagLevels[8], [2, 3, 4])).toBe(16);
  });
  it("searches from a full incorrect bag by removing first, and reports limits honestly", () => {
    const l = probabilityBagLevels[0],
      hint = searchBagHint(l, [0, 0, 6]);
    expect(hint.status).toBe("found");
    if (hint.status === "found") {
      expect(hint.color).toBe(2);
      expect(hint.delta).toBe(-1);
    }
    expect(searchBagHint(l, l.initial, 0).status).toBe("budget");
    expect(
      searchBagHint({ ...l, budget: 0, costs: [1, 1, 1] }, l.initial).status,
    ).toBe("none");
  });
});
describe("reject malformed bag state shapes", () => {
  it("requires exactly three counts even when a shortened vector matches a fraction", () => {
    const shortened = [3, 3] as unknown as BagCounts;
    expect(bagWon(probabilityBagLevels[0], shortened)).toBe(false);
    expect(
      bagEventProbability(shortened, { kind: "single", colors: [0] }),
    ).toBeNull();
  });
});
describe("cooperative hints cancel queued work", () => {
  it("cancels before start, midway, and supports normal completion", async () => {
    vi.useFakeTimers();
    try {
      const abort = new AbortController();
      const p = runLabSearch(
        symmetryHintSteps(
          symmetryRepairLevels[3],
          symmetryRepairLevels[3].initial,
        ),
        abort.signal,
      );
      abort.abort();
      await expect(p).resolves.toBeNull();
      expect(vi.getTimerCount()).toBe(0);
      const middle = new AbortController();
      const p2 = runLabSearch(
        bagHintSteps(
          probabilityBagLevels[11],
          probabilityBagLevels[11].initial,
        ),
        middle.signal,
      );
      await vi.advanceTimersByTimeAsync(0);
      middle.abort();
      await expect(p2).resolves.toBeNull();
      expect(vi.getTimerCount()).toBe(0);
      const done = new AbortController();
      const p3 = runLabSearch(
        bagHintSteps(probabilityBagLevels[0], probabilityBagLevels[0].initial),
        done.signal,
      );
      await vi.runAllTimersAsync();
      expect((await p3)?.status).toBe("found");
    } finally {
      vi.useRealTimers();
    }
  });
});
