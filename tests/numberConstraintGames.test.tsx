// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as THREE from "three";
import FutoshikiGarden from "../src/games/FutoshikiGarden";
import SkylineGarden from "../src/games/SkylineGarden";
import SkylineScene from "../src/games/SkylineScene";
import type { GameProps } from "../src/lib/types";
import {
  CONSTRAINT_NODE_LIMIT,
  constraintInput,
  createConstraintState,
  futoshikiCandidates,
  futoshikiConflicts,
  futoshikiLevels,
  futoshikiSolutions,
  getFutoshikiHint,
  isFutoshikiSolved,
  latinConflicts,
  latinPermutations,
  solveFutoshiki,
  undoConstraint,
  validFutoshikiLevel,
  validInequalities,
  validLatinValues,
  type FutoshikiLevel,
  type Inequality,
} from "../src/games/futoshikiLogic";
import {
  getSkylineHint,
  isSkylineSolved,
  skylineCandidates,
  skylineClueState,
  skylineConflicts,
  skylineLevels,
  skylineLine,
  skylineLineOptions,
  skylineSolutions,
  solveSkyline,
  validSkylineLevel,
  visibleBuildings,
  type SkylineClues,
  type SkylineLevel,
  type SkylineSide,
} from "../src/games/skylineLogic";
const rendererState = vi.hoisted(() => ({
  fail: false,
  instances: [] as {
    domElement: HTMLCanvasElement;
    dispose: ReturnType<typeof vi.fn>;
    forceContextLoss: ReturnType<typeof vi.fn>;
    renderLists: { dispose: ReturnType<typeof vi.fn> };
    render: ReturnType<typeof vi.fn>;
  }[],
}));
vi.mock("three", async (importOriginal) => {
  const original = await importOriginal<typeof import("three")>();
  return {
    ...original,
    WebGLRenderer: class {
      domElement = document.createElement("canvas");
      dispose = vi.fn();
      forceContextLoss = vi.fn();
      renderLists = { dispose: vi.fn() };
      render = vi.fn();
      setPixelRatio = vi.fn();
      setSize = vi.fn();
      constructor() {
        if (rendererState.fail) throw new Error("WebGL unavailable");
        rendererState.instances.push(this);
      }
    },
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  rendererState.fail = false;
  rendererState.instances.length = 0;
});
function props(overrides: Partial<GameProps> = {}): GameProps {
  return {
    level: 0,
    paused: false,
    resetToken: 0,
    hintToken: 0,
    undoToken: 0,
    onComplete: vi.fn(),
    onStatus: vi.fn(),
    ...overrides,
  };
}
function cell(index: number): HTMLButtonElement {
  return document.querySelector(`[data-constraint-cell="${index}"]`)!;
}
function boardValues(): number[] {
  return [...document.querySelectorAll("[data-constraint-cell]")].map((e) =>
    Number(e.getAttribute("data-value")),
  );
}
const sides: SkylineSide[] = ["top", "right", "bottom", "left"];

/** Independent row-by-row enumeration: no production solver/validator/visibility helpers. */
function independentCount(
  size: number,
  givens: readonly number[],
  inequalities: readonly Inequality[] = [],
  clues?: SkylineClues,
  limit = 2,
): { count: number; nodes: number; first: number[] } {
  function seen(line: readonly number[]) {
    return line.filter((v, i) => line.slice(0, i).every((prior) => prior < v))
      .length;
  }
  const permutations: number[][] = [];
  function permute(prefix: number[]) {
    if (prefix.length === size) {
      permutations.push(prefix);
      return;
    }
    for (let v = 1; v <= size; v++)
      if (!prefix.includes(v)) permute([...prefix, v]);
  }
  permute([]);
  const options = Array.from({ length: size }, (_, r) =>
    permutations.filter(
      (p) =>
        p.every(
          (v, c) => !givens[r * size + c] || givens[r * size + c] === v,
        ) &&
        inequalities.every(
          ({ less, greater }) =>
            Math.floor(less / size) !== r ||
            Math.floor(greater / size) !== r ||
            p[less % size] < p[greater % size],
        ) &&
        (!clues ||
          ((!clues.left[r] || seen(p) === clues.left[r]) &&
            (!clues.right[r] || seen([...p].reverse()) === clues.right[r]))),
    ),
  );
  const columnOptions = Array.from({ length: size }, (_, c) =>
    permutations.filter(
      (p) =>
        !clues ||
        ((!clues.top[c] || seen(p) === clues.top[c]) &&
          (!clues.bottom[c] || seen([...p].reverse()) === clues.bottom[c])),
    ),
  );
  let count = 0,
    nodes = 0;
  let first: number[] = [];
  const rows: number[][] = [];
  function visit(row: number) {
    if (count >= limit) return;
    if (++nodes > 1000000)
      throw new Error(
        "Independent test enumeration exceeded its explicit bound",
      );
    if (row === size) {
      count++;
      if (!first.length) first = rows.flat();
      return;
    }
    for (const option of options[row]) {
      if (option.some((v, c) => rows.some((p) => p[c] === v))) continue;
      rows.push(option);
      const partial = rows.flat();
      if (
        inequalities.every(
          ({ less, greater }) =>
            less >= partial.length ||
            greater >= partial.length ||
            partial[less] < partial[greater],
        ) &&
        columnOptions.every((domain, c) =>
          domain.some((p) => rows.every((r, i) => r[c] === p[i])),
        )
      )
        visit(row + 1);
      rows.pop();
      if (count >= limit) return;
    }
  }
  visit(0);
  return { count, nodes, first };
}

describe("24 original number-constraint level certificates", () => {
  it("has distinct progressive 3×3, 4×4 and 5×5 layouts with copied solution exports", () => {
    for (const levels of [futoshikiLevels, skylineLevels]) {
      expect(levels).toHaveLength(12);
      expect(levels.map((l) => l.size)).toEqual([
        3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5,
      ]);
      expect(new Set(levels.map((l) => JSON.stringify(l))).size).toBe(12);
    }
    expect(futoshikiSolutions).toEqual(futoshikiLevels.map((l) => l.solution));
    expect(skylineSolutions).toEqual(skylineLevels.map((l) => l.solution));
    expect(futoshikiSolutions[0]).not.toBe(futoshikiLevels[0].solution);
  });
  for (const [index, level] of futoshikiLevels.entries()) {
    it(`Futoshiki ${index + 1}: independent unique count, inequality necessity, and current-board hint path`, () => {
      const hidden = { ...level, solution: [] };
      const external = independentCount(
        level.size,
        level.givens,
        level.inequalities,
      );
      expect(external.count).toBe(1);
      expect(external.first).toEqual(level.solution);
      expect(independentCount(level.size, level.givens).count).toBe(2);
      const result = solveFutoshiki(hidden);
      expect(result.status).toBe("complete");
      expect(result.solutions).toEqual([level.solution]);
      expect(result.nodes).toBeLessThan(CONSTRAINT_NODE_LIMIT);
      expect(
        level.inequalities.some(
          (edge) => Math.abs(edge.less - edge.greater) === level.size,
        ),
      ).toBe(true);
      expect(
        level.inequalities.some(
          (edge) => Math.abs(edge.less - edge.greater) === 1,
        ),
      ).toBe(true);
      for (const { less, greater } of level.inequalities)
        expect(level.solution[less]).toBeLessThan(level.solution[greater]);
      let board = [...level.givens];
      while (board.includes(0)) {
        const hint = getFutoshikiHint(hidden, board);
        expect(hint?.kind).toBe("deduction");
        expect(hint!.value).toBe(level.solution[hint!.index]);
        expect(futoshikiCandidates(hidden, board, hint!.index)).toEqual([
          hint!.value,
        ]);
        board[hint!.index] = hint!.value;
      }
      expect(isFutoshikiSolved(hidden, board)).toBe(true);
      expect(getFutoshikiHint(hidden, board)).toBeNull();
    });
  }
  for (const [index, level] of skylineLevels.entries()) {
    it(`Skyline ${index + 1}: independent unique count and all four sightlines without the stored answer`, () => {
      const hidden = { ...level, solution: [] };
      const external = independentCount(
        level.size,
        level.givens,
        [],
        level.clues,
      );
      expect(external.count).toBe(1);
      expect(external.first).toEqual(level.solution);
      const result = solveSkyline(hidden);
      expect(result.status).toBe("complete");
      expect(result.solutions).toEqual([level.solution]);
      expect(result.nodes).toBeLessThan(CONSTRAINT_NODE_LIMIT);
      for (const side of sides)
        for (let i = 0; i < level.size; i++)
          if (level.clues[side][i]) {
            expect(
              visibleBuildings(skylineLine(level, level.solution, side, i)),
            ).toBe(level.clues[side][i]);
            expect(skylineClueState(level, level.solution, side, i)).toBe(
              "satisfied",
            );
          }
      let board = [...level.givens];
      while (board.includes(0)) {
        const hint = getSkylineHint(hidden, board);
        expect(hint?.kind).toBe("deduction");
        expect(hint!.value).toBe(level.solution[hint!.index]);
        expect(skylineCandidates(hidden, board, hint!.index)).toEqual([
          hint!.value,
        ]);
        board[hint!.index] = hint!.value;
      }
      expect(isSkylineSolved(hidden, board)).toBe(true);
      expect(getSkylineHint(hidden, board)).toBeNull();
    });
  }
  it("records bounded solver work on all authored empty states", () => {
    const records = [
      ...futoshikiLevels.map((l, i) => ({
        game: "futoshiki",
        level: i + 1,
        result: solveFutoshiki(l),
      })),
      ...skylineLevels.map((l, i) => ({
        game: "skyline",
        level: i + 1,
        result: solveSkyline(l),
      })),
    ];
    const worst = Math.max(...records.map((r) => r.result.nodes));
    expect(worst).toBeLessThan(1000);
    console.info(
      `Number-constraint solver worst authored search: ${worst} nodes. ${records.map((r) => `${r.game[0]}${r.level}:${r.result.nodes}`).join(" ")}`,
    );
  });
});

describe("exact constraints, contradictions, input validation, and solver limits", () => {
  it("counts strict record heights from both directions, never height sums", () => {
    expect(visibleBuildings([2, 1, 4, 3, 5])).toBe(3);
    expect(visibleBuildings([5, 3, 4, 1, 2])).toBe(1);
    expect(visibleBuildings([1, 2, 3, 4, 5])).toBe(5);
    expect(visibleBuildings([2, 2, 3])).toBe(2);
    for (const line of [[], [0, 2, 3], [1, NaN, 3], [1, 1.5, 3], [-1, 3, 2]])
      expect(visibleBuildings(line)).toBe(0);
    expect(skylineLineOptions(3, 3, 1)).toEqual([[1, 2, 3]]);
    expect(skylineLineOptions(3, 1, 1)).toEqual([]);
    expect(skylineLineOptions(3, 2, 2)).toEqual([
      [1, 3, 2],
      [2, 3, 1],
    ]);
    expect(skylineLineOptions(3, 0, 0, [0, 2, 0])).toEqual([
      [1, 2, 3],
      [3, 2, 1],
    ]);
  });
  it("has no Sudoku box restriction and preserves board-coordinate edge order", () => {
    const values = [1, 2, 3, 4, 2, 3, 4, 1, 3, 4, 1, 2, 4, 1, 2, 3];
    const f: FutoshikiLevel = {
      title: "Latin only",
      size: 4,
      givens: Array(16).fill(0),
      inequalities: [],
      solution: [],
    };
    const s: SkylineLevel = {
      title: "Latin only",
      size: 4,
      givens: Array(16).fill(0),
      clues: {
        top: [0, 0, 0, 0],
        right: [0, 0, 0, 0],
        bottom: [0, 0, 0, 0],
        left: [0, 0, 0, 0],
      },
      solution: [],
    };
    expect(isFutoshikiSolved(f, values)).toBe(true);
    expect(isSkylineSolved(s, values)).toBe(true);
    expect(latinConflicts(4, values)).toEqual([]);
    expect(skylineLine(s, values, "bottom", 1)).toEqual([1, 4, 3, 2]);
    expect(skylineLine(s, values, "right", 1)).toEqual([1, 4, 3, 2]);
  });
  it("rejects invalid board shapes, values, clues, edges and overwritten givens", () => {
    const f = futoshikiLevels[0],
      s = skylineLevels[0];
    for (const values of [
      [],
      [...f.givens, 0],
      f.givens.map((v, i) => (i === 0 ? NaN : v)),
      f.givens.map((v, i) => (i === 0 ? 1.5 : v)),
      f.givens.map((v, i) => (i === 0 ? 9 : v)),
      f.givens.map((v, i) => (i === 0 ? -1 : v)),
    ]) {
      expect(validLatinValues(3, values)).toBe(false);
      expect(solveFutoshiki(f, values).solutions).toEqual([]);
      expect(solveSkyline(s, values).solutions).toEqual([]);
      expect(isFutoshikiSolved(f, values)).toBe(false);
      expect(isSkylineSolved(s, values)).toBe(false);
    }
    expect(latinPermutations(7)).toEqual([]);
    expect(validLatinValues(2, [1, 2, 2, 1])).toBe(false);
    expect(validInequalities(3, [{ less: 0, greater: 4 }])).toBe(false);
    expect(
      validInequalities(3, [
        { less: 0, greater: 1 },
        { less: 1, greater: 0 },
      ]),
    ).toBe(false);
    expect(
      validFutoshikiLevel({ ...f, inequalities: [{ less: -1, greater: 0 }] }),
    ).toBe(false);
    expect(
      validSkylineLevel({ ...s, clues: { ...s.clues, top: [4, 0, 0] } }),
    ).toBe(false);
    expect(validSkylineLevel({ ...s, clues: { ...s.clues, top: [] } })).toBe(
      false,
    );
    for (const partial of [
      [0, 1],
      [0, 0, 4],
      [1, 1, 0],
      [0, NaN, 0],
    ])
      expect(skylineLineOptions(3, 0, 0, partial)).toEqual([]);
    expect(skylineLineOptions(3, 4, 0)).toEqual([]);
    expect(skylineLineOptions(3, -1, 0)).toEqual([]);
    for (const [level, solve, solved] of [
      [f, solveFutoshiki, isFutoshikiSolved],
      [s, solveSkyline, isSkylineSolved],
    ] as const) {
      const board = [...level.solution];
      board[level.givens.findIndex(Boolean)] = 0;
      expect(
        (solve as typeof solveFutoshiki)(level as FutoshikiLevel, board)
          .solutions,
      ).toEqual([]);
      expect(
        (solved as typeof isFutoshikiSolved)(level as FutoshikiLevel, board),
      ).toBe(false);
    }
    expect(futoshikiCandidates(f, f.givens, -1)).toEqual([]);
    expect(skylineCandidates(s, s.givens, 99)).toEqual([]);
  });
  it("marks violated inequalities, duplicates and impossible visibility lines", () => {
    const f = { ...futoshikiLevels[0], givens: Array(9).fill(0) };
    const { less, greater } = f.inequalities[0];
    const board = Array(9).fill(0);
    board[less] = 3;
    board[greater] = 1;
    expect(futoshikiConflicts(f, board)).toContain(less);
    expect(futoshikiConflicts(f, board)).toContain(greater);
    expect(solveFutoshiki(f, board).solutions).toEqual([]);
    expect(latinConflicts(3, [1, 1, 0, 0, 0, 0, 0, 0, 0])).toEqual([0, 1]);
    const s = {
      ...skylineLevels[0],
      givens: Array(9).fill(0),
      clues: {
        top: [0, 0, 0],
        bottom: [0, 0, 0],
        left: [1, 0, 0],
        right: [0, 0, 0],
      },
    };
    const wrong = [1, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(skylineClueState(s, wrong, "left", 0)).toBe("conflict");
    expect(skylineConflicts(s, wrong)).toContain(0);
    expect(solveSkyline(s, wrong).solutions).toEqual([]);
    expect(skylineClueState(s, wrong, "right", 0)).toBe("empty");
  });
  it("detects globally impossible partial boards and gives a current-state correction", () => {
    for (const game of ["futoshiki", "skyline"]) {
      const level =
        game === "futoshiki" ? futoshikiLevels[11] : skylineLevels[11];
      const conflicts =
        game === "futoshiki"
          ? (b: number[]) => futoshikiConflicts(level as FutoshikiLevel, b)
          : (b: number[]) => skylineConflicts(level as SkylineLevel, b);
      const solve =
        game === "futoshiki"
          ? (b: number[]) => solveFutoshiki(level as FutoshikiLevel, b)
          : (b: number[]) => solveSkyline(level as SkylineLevel, b);
      const hint =
        game === "futoshiki"
          ? (b: number[]) => getFutoshikiHint(level as FutoshikiLevel, b)
          : (b: number[]) => getSkylineHint(level as SkylineLevel, b);
      let wrong: number[] | undefined;
      for (let i = 0; i < 25 && !wrong; i++)
        for (let v = 1; v <= 5; v++) {
          if (v === level.solution[i] || level.givens[i]) continue;
          const board = [...level.givens];
          board[i] = v;
          if (!conflicts(board).length && !solve(board).solutions.length) {
            wrong = board;
            break;
          }
        }
      expect(wrong).toBeDefined();
      expect(hint(wrong!)?.kind).toBe("correction");
      const suggestion = hint(wrong!)!;
      expect(wrong![suggestion.index]).not.toBe(0);
      wrong![suggestion.index] = suggestion.value;
      expect(solve(wrong!).solutions).toHaveLength(1);
    }
  });
  it("reports ambiguity and budget exhaustion without falsely certifying uniqueness", () => {
    const f = {
      ...futoshikiLevels[0],
      givens: Array(9).fill(0),
      inequalities: [],
    };
    const s = {
      ...skylineLevels[0],
      givens: Array(9).fill(0),
      clues: {
        top: [0, 0, 0],
        right: [0, 0, 0],
        bottom: [0, 0, 0],
        left: [0, 0, 0],
      },
    };
    for (const result of [solveFutoshiki(f), solveSkyline(s)]) {
      expect(result.solutions).toHaveLength(2);
      expect(result.status).toBe("limit");
    }
    expect(getFutoshikiHint(f, f.givens)).toBeNull();
    expect(getSkylineHint(s, s.givens)).toBeNull();
    for (const result of [
      solveFutoshiki(f, f.givens, 2, 1),
      solveSkyline(s, s.givens, 2, 1),
    ]) {
      expect(result.status).toBe("budget");
      expect(result.nodes).toBe(1);
      expect(result.solutions).toHaveLength(0);
    }
    for (const limit of [0, -1, NaN, 1.5]) {
      expect(solveFutoshiki(f, f.givens, limit).status).toBe("invalid");
      expect(solveSkyline(s, s.givens, limit).status).toBe("invalid");
    }
    expect(
      solveFutoshiki(f, f.givens, 2, CONSTRAINT_NODE_LIMIT + 1).status,
    ).toBe("invalid");
  });
  it("keeps immutable number/note snapshots, exact undo, and fixed clues", () => {
    const level = futoshikiLevels[0],
      original = createConstraintState(level.givens),
      index = level.givens.indexOf(0),
      fixed = level.givens.findIndex(Boolean);
    for (const [i, v] of [
      [fixed, 1],
      [-1, 1],
      [0.5, 1],
      [index, 4],
      [index, -1],
      [index, NaN],
    ])
      expect(constraintInput(original, level.givens, 3, i, v)).toBe(original);
    const noted = constraintInput(original, level.givens, 3, index, 2, true);
    expect(noted.notes[index]).toEqual([2]);
    expect(original.notes[index]).toEqual([]);
    const added = constraintInput(noted, level.givens, 3, index, 1, true);
    expect(added.notes[index]).toEqual([1, 2]);
    const removed = constraintInput(added, level.givens, 3, index, 2, true);
    expect(removed.notes[index]).toEqual([1]);
    const entered = constraintInput(added, level.givens, 3, index, 3);
    expect(entered.values[index]).toBe(3);
    expect(entered.notes[index]).toEqual([]);
    expect(constraintInput(entered, level.givens, 3, index, 1, true)).toBe(
      entered,
    );
    const undone = undoConstraint(entered);
    expect(undone.values[index]).toBe(0);
    expect(undone.notes[index]).toEqual([1, 2]);
    expect(undoConstraint(original)).toBe(original);
    const erased = constraintInput(added, level.givens, 3, index, 0);
    expect(erased.notes[index]).toEqual([]);
    expect(undoConstraint(erased).notes[index]).toEqual([1, 2]);
  });
});

for (const game of [
  { name: "Futoshiki", Component: FutoshikiGarden, levels: futoshikiLevels },
  { name: "Skyline", Component: SkylineGarden, levels: skylineLevels },
])
  describe(`${game.name} accessible interaction`, () => {
    for (const [index, level] of game.levels.entries())
      it(`level ${index + 1} is completable by keyboard and touch pad, exactly once`, () => {
        const p = props({ level: index });
        const { rerender } = render(<game.Component {...p} />);
        for (let i = 0; i < level.givens.length; i++)
          if (!level.givens[i]) {
            fireEvent.click(cell(i));
            if (i % 2)
              fireEvent.keyDown(cell(i), { key: String(level.solution[i]) });
            else
              fireEvent.click(
                screen.getByRole("button", {
                  name: `填入 ${level.solution[i]}`,
                }),
              );
          }
        expect(boardValues()).toEqual(level.solution);
        expect(p.onComplete).toHaveBeenCalledTimes(1);
        expect(
          [
            ...document.querySelectorAll<HTMLButtonElement>(
              "[data-constraint-cell]",
            ),
          ].every((button) => button.disabled),
        ).toBe(true);
        rerender(<game.Component {...p} hintToken={1} />);
        fireEvent.keyDown(document.querySelector("[data-number-constraint]")!, {
          key: "1",
        });
        expect(p.onComplete).toHaveBeenCalledTimes(1);
      });
    it("supports number/notes/clear, true undo, fixed-disabled cells, hint selection, and reset", () => {
      const p = props(),
        level = game.levels[0];
      const { rerender } = render(<game.Component {...p} />);
      const first = level.givens.indexOf(0),
        fixed = level.givens.findIndex(Boolean);
      expect(cell(fixed).disabled).toBe(true);
      fireEvent.click(cell(first));
      fireEvent.keyDown(cell(first), { key: "n" });
      fireEvent.click(screen.getByRole("button", { name: "笔记 2" }));
      expect(cell(first).getAttribute("aria-label")).toContain("笔记 2");
      expect(boardValues()[first]).toBe(0);
      fireEvent.keyDown(cell(first), { key: "n" });
      fireEvent.keyDown(cell(first), { key: "1" });
      expect(boardValues()[first]).toBe(1);
      rerender(<game.Component {...p} undoToken={1} />);
      expect(boardValues()[first]).toBe(0);
      expect(cell(first).getAttribute("aria-label")).toContain("笔记 2");
      fireEvent.click(screen.getByRole("button", { name: "清空所选格" }));
      expect(cell(first).getAttribute("aria-label")).not.toContain("笔记");
      rerender(<game.Component {...p} undoToken={1} hintToken={1} />);
      expect(document.querySelector(".nc-hinted")).not.toBeNull();
      expect(p.onStatus).toHaveBeenLastCalledWith(
        expect.stringContaining("所有可行填法"),
      );
      fireEvent.keyDown(cell(first), { key: "9" });
      fireEvent.keyDown(cell(first), { key: "2", ctrlKey: true });
      expect(boardValues()).toEqual(level.givens);
      fireEvent.keyDown(cell(first), { key: "2" });
      fireEvent.keyDown(cell(first), { key: "Backspace" });
      expect(boardValues()[first]).toBe(0);
      fireEvent.keyDown(cell(first), { key: "2" });
      rerender(
        <game.Component {...p} resetToken={1} hintToken={1} undoToken={1} />,
      );
      expect(boardValues()).toEqual(level.givens);
      expect(document.querySelector(".nc-hinted")).toBeNull();
      expect(
        screen
          .getByRole("button", { name: /候选笔记/ })
          .getAttribute("aria-pressed"),
      ).toBe("false");
      rerender(
        <game.Component
          {...p}
          level={4}
          resetToken={1}
          hintToken={1}
          undoToken={1}
        />,
      );
      expect(boardValues()).toEqual(game.levels[4].givens);
      expect(document.querySelectorAll("[data-constraint-cell]")).toHaveLength(
        16,
      );
    });
    it("freezes inputs and consumes paused hint/undo tokens without replay on resume", () => {
      const p = props(),
        level = game.levels[0],
        first = level.givens.indexOf(0);
      const { rerender } = render(<game.Component {...p} />);
      fireEvent.click(cell(first));
      fireEvent.keyDown(cell(first), { key: "2" });
      const entered = boardValues();
      rerender(<game.Component {...p} paused hintToken={1} undoToken={1} />);
      fireEvent.keyDown(cell(first), { key: "3" });
      fireEvent.click(screen.getByRole("button", { name: "填入 1" }));
      fireEvent.keyDown(cell(first), { key: "n" });
      expect(boardValues()).toEqual(entered);
      expect(document.querySelector(".nc-hinted")).toBeNull();
      rerender(<game.Component {...p} hintToken={1} undoToken={1} />);
      expect(boardValues()).toEqual(entered);
      rerender(<game.Component {...p} hintToken={1} undoToken={2} />);
      expect(boardValues()).toEqual(level.givens);
    });
    it("uses arrow keys without row wrap and native Enter/Space activation", async () => {
      const user = userEvent.setup(),
        p = props({ level: 3 }),
        level = game.levels[3];
      render(<game.Component {...p} />);
      const first = level.givens.indexOf(0);
      cell(first).focus();
      await user.keyboard("1");
      expect(boardValues()[first]).toBe(1);
      fireEvent.keyDown(cell(0), { key: "ArrowLeft" });
      expect(document.activeElement).toBe(cell(first));
      cell(0).focus();
      fireEvent.keyDown(cell(0), { key: "ArrowRight" });
      expect(document.activeElement).toBe(cell(1));
      fireEvent.keyDown(cell(1), { key: "ArrowDown" });
      expect(document.activeElement).toBe(cell(4));
      const pad = screen.getByRole("button", { name: "填入 2" });
      pad.focus();
      await user.keyboard("{Enter}");
      expect(boardValues()[4]).toBe(2);
      const clear = screen.getByRole("button", { name: "清空所选格" });
      clear.focus();
      await user.keyboard(" ");
      expect(boardValues()[4]).toBe(0);
    });
    it("can undo after completion and refill without a second completion notification", () => {
      const p = props(),
        level = game.levels[0];
      const { rerender } = render(<game.Component {...p} />);
      for (let i = 0; i < level.givens.length; i++)
        if (!level.givens[i]) {
          fireEvent.click(cell(i));
          fireEvent.keyDown(cell(i), { key: String(level.solution[i]) });
        }
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      rerender(<game.Component {...p} undoToken={1} />);
      const last = boardValues().findIndex((v) => v === 0);
      expect(last).toBeGreaterThanOrEqual(0);
      fireEvent.click(cell(last));
      fireEvent.keyDown(cell(last), { key: String(level.solution[last]) });
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      rerender(<game.Component {...p} resetToken={1} undoToken={1} />);
      expect(boardValues()).toEqual(level.givens);
    });
  });

describe("Skyline optional city visualization", () => {
  it("keeps a fully operable DOM board and directional street view without WebGL", () => {
    const p = props();
    render(<SkylineGarden {...p} />);
    expect(screen.getByText("平面城市预览")).toBeTruthy();
    expect(
      screen.getByRole("list", { name: "按视线方向排列的楼高" }),
    ).toBeTruthy();
    fireEvent.click(document.querySelector('[data-skyline-clue="right:1"]')!);
    expect(screen.getByText("从右往里看 · 第 2 行")).toBeTruthy();
    expect(
      document
        .querySelector('[data-skyline-clue="right:1"]')!
        .getAttribute("aria-pressed"),
    ).toBe("true");
    const first = skylineLevels[0].givens.indexOf(0);
    fireEvent.click(cell(first));
    fireEvent.click(screen.getByRole("button", { name: "填入 1" }));
    expect(boardValues()[first]).toBe(1);
  });
  it("draws original city geometry, updates selected street, and disposes every WebGL resource", () => {
    vi.stubGlobal("WebGLRenderingContext", class {});
    const observe = vi.fn(),
      disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = observe;
        disconnect = disconnect;
      },
    );
    const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, "dispose"),
      materialDispose = vi.spyOn(THREE.Material.prototype, "dispose");
    const level = skylineLevels[0];
    const { rerender, unmount } = render(
      <SkylineScene
        level={level}
        values={level.solution}
        side="left"
        index={0}
        paused={false}
      />,
    );
    expect(document.querySelector("canvas")).not.toBeNull();
    expect(rendererState.instances[0].render).toHaveBeenCalled();
    expect(observe).toHaveBeenCalled();
    rerender(
      <SkylineScene
        level={level}
        values={level.solution}
        side="right"
        index={1}
        paused={false}
      />,
    );
    expect(rendererState.instances[0].dispose).toHaveBeenCalledTimes(1);
    expect(rendererState.instances[0].forceContextLoss).toHaveBeenCalledTimes(
      1,
    );
    unmount();
    expect(rendererState.instances[1].dispose).toHaveBeenCalledTimes(1);
    expect(
      rendererState.instances[1].renderLists.dispose,
    ).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(2);
    expect(geometryDispose).toHaveBeenCalledTimes(2);
    expect(materialDispose).toHaveBeenCalledTimes(8);
    expect(document.querySelector("canvas")).toBeNull();
  });
  it("handles context creation failure and context loss with readable fallback", () => {
    vi.stubGlobal("WebGLRenderingContext", class {});
    rendererState.fail = true;
    const level = skylineLevels[0];
    const failed = render(
      <SkylineScene
        level={level}
        values={level.givens}
        side="top"
        index={0}
        paused={false}
      />,
    );
    expect(screen.getByText("平面城市预览")).toBeTruthy();
    failed.unmount();
    rendererState.fail = false;
    render(
      <SkylineScene
        level={level}
        values={level.givens}
        side="top"
        index={0}
        paused={false}
      />,
    );
    fireEvent(
      rendererState.instances[0].domElement,
      new Event("webglcontextlost", { cancelable: true }),
    );
    expect(screen.getByText("平面城市预览")).toBeTruthy();
    expect(
      screen.getByRole("list", { name: "按视线方向排列的楼高" }),
    ).toBeTruthy();
  });
});
