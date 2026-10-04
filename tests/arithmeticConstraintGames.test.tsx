// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GameProps } from "../src/lib/types";
import KakuroGarden from "../src/games/KakuroGarden";
import ArithmeticCageGarden from "../src/games/ArithmeticCageGarden";
import {
  ARITHMETIC_HISTORY_LIMIT,
  ARITHMETIC_NODE_LIMIT,
  arithmeticHint,
  createArithmeticState,
  inputArithmetic,
  searchArithmetic,
  undoArithmetic,
} from "../src/games/arithmeticConstraintCore";
import {
  getKakuroHint,
  isKakuroSolved,
  kakuroConflicts,
  kakuroLevels,
  kakuroProblem,
  kakuroRunOptions,
  kakuroRuns,
  solveKakuro,
  validKakuroLevel,
  type KakuroLevel,
} from "../src/games/kakuroLogic";
import {
  arithmeticCageConflicts,
  arithmeticCageLevels,
  arithmeticCageOptions,
  arithmeticCageProblem,
  cageMatches,
  getArithmeticCageHint,
  isArithmeticCageSolved,
  solveArithmeticCage,
  validArithmeticCageLevel,
  type ArithmeticCageLevel,
} from "../src/games/arithmeticCageLogic";
import {
  arithmeticCageCertificates,
  kakuroCertificates,
} from "./fixtures/arithmeticConstraintCertificates";
afterEach(cleanup);
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
  return document.querySelector(`[data-arithmetic-cell="${index}"]`)!;
}
function input(index: number, value: number) {
  fireEvent.click(cell(index));
  fireEvent.keyDown(cell(index), { key: String(value) });
}

/** Independent cell-by-cell enumerator: direct constraints and arithmetic, no production search,
 * tuple tables, topology, validator, or stored answers. Bounded to two million DFS nodes. */
function independentlyEnumerate(
  level: KakuroLevel | ArithmeticCageLevel,
  max = 2,
) {
  const kakuro = "rows" in level,
    w = kakuro ? level.rows[0].length : level.size,
    length = kakuro ? w * level.rows.length : w * w;
  const values = Array(length).fill(0),
    active = Array.from({ length }, (_, i) => i).filter(
      (i) => !kakuro || level.rows[Math.floor(i / w)][i % w] === ".",
    ),
    digits = kakuro ? 9 : w;
  const runs: { cells: number[]; target: number }[] = [];
  if (kakuro) {
    let next = 0;
    for (const i of active)
      for (const step of [1, w]) {
        if (
          step === 1
            ? i % w !== 0 && active.includes(i - 1)
            : active.includes(i - w)
        )
          continue;
        const cells: number[] = [];
        for (
          let j = i;
          active.includes(j) &&
          (step === w || Math.floor(j / w) === Math.floor(i / w));
          j += step
        )
          cells.push(j);
        runs.push({ cells, target: level.sums[next++] });
      }
  }
  function runPossible(run: { cells: number[]; target: number }) {
    const filled = run.cells.map((i) => values[i]).filter(Boolean);
    if (new Set(filled).size !== filled.length) return false;
    const remaining = run.target - filled.reduce((s, v) => s + v, 0),
      slots = run.cells.length - filled.length;
    const available = Array.from({ length: 9 }, (_, i) => i + 1).filter(
      (v) => !filled.includes(v),
    );
    function subset(start: number, count: number, sum: number): boolean {
      if (!count) return sum === 0;
      if (sum <= 0 || available.length - start < count) return false;
      for (let j = start; j < available.length; j++)
        if (subset(j + 1, count - 1, sum - available[j])) return true;
      return false;
    }
    return subset(0, slots, remaining);
  }
  function possibleCage(cage: ArithmeticCageLevel["cages"][number]) {
    const local = cage.cells.map((i) => values[i]);
    function assign(k: number): boolean {
      if (k === local.length) {
        switch (cage.op) {
          case "=":
            return local[0] === cage.target;
          case "+":
            return local.reduce((a, b) => a + b, 0) === cage.target;
          case "×":
            return local.reduce((a, b) => a * b, 1) === cage.target;
          case "−":
            return Math.abs(local[0] - local[1]) === cage.target;
          case "÷":
            return Math.max(...local) === Math.min(...local) * cage.target;
        }
      }
      if (local[k]) return assign(k + 1);
      const i = cage.cells[k];
      for (let v = 1; v <= w; v++) {
        if (
          active.some(
            (j) =>
              j !== i &&
              values[j] === v &&
              (Math.floor(i / w) === Math.floor(j / w) || i % w === j % w),
          ) ||
          local.some(
            (a, j) =>
              j !== k &&
              a === v &&
              (Math.floor(i / w) === Math.floor(cage.cells[j] / w) ||
                i % w === cage.cells[j] % w),
          )
        )
          continue;
        local[k] = v;
        if (assign(k + 1)) {
          local[k] = 0;
          return true;
        }
        local[k] = 0;
      }
      return false;
    }
    return assign(0);
  }
  function possible(i: number) {
    if (kakuro)
      return runs.filter((r) => r.cells.includes(i)).every(runPossible);
    return (
      !active.some(
        (j) =>
          j !== i &&
          values[j] === values[i] &&
          (Math.floor(i / w) === Math.floor(j / w) || i % w === j % w),
      ) && level.cages.filter((c) => c.cells.includes(i)).every(possibleCage)
    );
  }
  let nodes = 0;
  const solutions: number[][] = [];
  function visit() {
    if (solutions.length >= max) return;
    if (++nodes > 2000000)
      throw Error("Independent enumeration budget exceeded");
    let index = -1,
      options: number[] = [];
    for (const i of active)
      if (!values[i]) {
        const candidates: number[] = [];
        for (let v = 1; v <= digits; v++) {
          values[i] = v;
          if (possible(i)) candidates.push(v);
        }
        values[i] = 0;
        if (!candidates.length) return;
        if (index < 0 || candidates.length < options.length) {
          index = i;
          options = candidates;
        }
      }
    if (index < 0) {
      solutions.push(values.slice());
      return;
    }
    for (const v of options) {
      values[index] = v;
      visit();
      if (solutions.length >= max) break;
    }
    values[index] = 0;
  }
  visit();
  return { solutions, nodes };
}

describe("original Kakuro cross sums", () => {
  it("certifies every original board independently and exhausts the clue-only solver", () => {
    expect(kakuroLevels).toHaveLength(12);
    expect(
      new Set(kakuroLevels.map((l) => JSON.stringify([l.rows, l.sums]))).size,
    ).toBe(12);
    kakuroLevels.forEach((level, i) => {
      expect(validKakuroLevel(level)).toBe(true);
      const result = solveKakuro(level);
      expect(result.status).toBe("complete");
      expect(result.solutions).toEqual([kakuroCertificates[i].solution]);
      expect(result.nodes).toBe(kakuroCertificates[i].nodes);
      expect(isKakuroSolved(level, result.solutions[0])).toBe(true);
      expect(independentlyEnumerate(level).solutions).toEqual(result.solutions);
    });
  });
  it("exhaustively checks every distinct satisfiable 2×2 clue set against 9^4 assignments", () => {
    const groups = new Map<string, number>();
    for (let a = 1; a <= 9; a++)
      for (let b = 1; b <= 9; b++)
        for (let c = 1; c <= 9; c++)
          for (let d = 1; d <= 9; d++) {
            if (a === b || a === c || b === d || c === d) continue;
            const key = [a + b, a + c, b + d, c + d].join(",");
            groups.set(key, (groups.get(key) ?? 0) + 1);
          }
    for (const [key, count] of groups) {
      const result = solveKakuro(
        {
          title: "test",
          lesson: "",
          rows: ["..", ".."],
          sums: key.split(",").map(Number),
        },
        undefined,
        10,
      );
      expect(result.status).toBe("complete");
      expect(result.solutions.length).toBe(count);
    }
    expect(
      solveKakuro({
        title: "test",
        lesson: "",
        rows: ["..", ".."],
        sums: [3, 3, 3, 17],
      }).solutions,
    ).toEqual([]);
  });
  it("exhaustively checks short run combinations, not only sums", () => {
    for (let sum = 3; sum <= 24; sum++) {
      const expected: number[][] = [];
      for (let a = 1; a <= 9; a++)
        for (let b = 1; b <= 9; b++)
          for (let c = 1; c <= 9; c++)
            if (a !== b && a !== c && b !== c && a + b + c === sum)
              expected.push([a, b, c]);
      expect(kakuroRunOptions(3, sum)).toEqual(expected);
    }
    expect(kakuroRunOptions(2, 4)).toEqual([
      [1, 3],
      [3, 1],
    ]);
    expect(kakuroRunOptions(6, 20)).toEqual([]);
    const copied = kakuroRunOptions(2, 3);
    copied[0][0] = 9;
    expect(kakuroRunOptions(2, 3)[0]).toEqual([1, 2]);
  });
  it("segments at blockers, allows repeats outside a run, and rejects partial/invalid inputs", () => {
    const level = kakuroLevels[8],
      solution = kakuroCertificates[8].solution;
    expect(
      kakuroRuns(level).filter((r) => r.direction === "across"),
    ).toHaveLength(7);
    expect(isKakuroSolved(level, solution)).toBe(true);
    expect(isKakuroSolved(level, Array(solution.length).fill(0))).toBe(false);
    expect(validKakuroLevel({ ...level, rows: [".#", ".."] })).toBe(false);
    expect(validKakuroLevel({ ...level, sums: [] })).toBe(false);
    expect(solveKakuro(level, [1]).status).toBe("invalid");
    expect(
      solveKakuro(
        level,
        solution.map((v, i) =>
          i === level.rows.join("").indexOf("#") ? 1 : v,
        ),
      ).status,
    ).toBe("invalid");
    const wrong = solution.slice(),
      run = kakuroRuns(level)[0];
    wrong[run.cells[0]] = wrong[run.cells[1]];
    expect(kakuroConflicts(level, wrong)).toContain(run.cells[0]);
    expect(isKakuroSolved(level, wrong)).toBe(false);
  });
});

describe("original arithmetic-cage Latin puzzles", () => {
  it("certifies all 12 independently, with four operators, sizes, and bent multi-cell cages", () => {
    expect(arithmeticCageLevels).toHaveLength(12);
    expect(
      new Set(arithmeticCageLevels.map((l) => JSON.stringify(l.cages))).size,
    ).toBe(12);
    expect(new Set(arithmeticCageLevels.map((l) => l.size))).toEqual(
      new Set([3, 4, 5]),
    );
    arithmeticCageLevels.forEach((level, i) => {
      expect(validArithmeticCageLevel(level)).toBe(true);
      const result = solveArithmeticCage(level);
      expect(result.status).toBe("complete");
      expect(result.solutions).toEqual([
        arithmeticCageCertificates[i].solution,
      ]);
      expect(result.nodes).toBe(arithmeticCageCertificates[i].nodes);
      expect(isArithmeticCageSolved(level, result.solutions[0])).toBe(true);
      expect(independentlyEnumerate(level).solutions).toEqual(result.solutions);
    });
    for (const op of ["+", "−", "×", "÷"])
      expect(arithmeticCageLevels[11].cages.some((c) => c.op === op)).toBe(
        true,
      );
  });
  it("exhaustively checks all pair operators, targets, and digits, including exact division", () => {
    for (const op of ["+", "−", "×", "÷"] as const)
      for (let target = 0; target <= 25; target++)
        for (let a = 1; a <= 5; a++)
          for (let b = 1; b <= 5; b++) {
            const expected =
              op === "+"
                ? a + b === target
                : op === "−"
                  ? Math.abs(a - b) === target
                  : op === "×"
                    ? a * b === target
                    : Math.max(a, b) % Math.min(a, b) === 0 &&
                      Math.max(a, b) / Math.min(a, b) === target;
            expect(cageMatches({ cells: [0, 1], op, target }, [a, b])).toBe(
              expected,
            );
          }
    expect(cageMatches({ cells: [0, 1], op: "÷", target: 2 }, [5, 2])).toBe(
      false,
    );
    expect(
      arithmeticCageOptions(3, { cells: [0, 1, 4], op: "+", target: 4 }),
    ).toContainEqual([1, 2, 1]);
    expect(
      arithmeticCageOptions(3, { cells: [0, 1], op: "+", target: 4 }),
    ).not.toContainEqual([2, 2]);
  });
  it("exhaustively checks every pair-of-row-cages 2×2 puzzle against both Latin squares", () => {
    const operations = ["+", "−", "×", "÷"] as const,
      squares = [
        [1, 2, 2, 1],
        [2, 1, 1, 2],
      ];
    for (const a of operations)
      for (const b of operations)
        for (let x = 0; x <= 4; x++)
          for (let y = 0; y <= 4; y++) {
            const level: ArithmeticCageLevel = {
              title: "small",
              lesson: "",
              size: 2,
              cages: [
                { cells: [0, 1], op: a, target: x },
                { cells: [2, 3], op: b, target: y },
              ],
            };
            const independent = (op: string, target: number, p: number[]) =>
              op === "+"
                ? p[0] + p[1] === target
                : op === "−"
                  ? Math.abs(p[0] - p[1]) === target
                  : op === "×"
                    ? p[0] * p[1] === target
                    : Math.max(...p) === Math.min(...p) * target;
            if ((x === 0 && a !== "−") || (y === 0 && b !== "−")) {
              expect(solveArithmeticCage(level).status).toBe("invalid");
              continue;
            }
            expect(solveArithmeticCage(level, undefined, 3).solutions).toEqual(
              squares.filter(
                (s) =>
                  independent(a, x, s.slice(0, 2)) &&
                  independent(b, y, s.slice(2)),
              ),
            );
          }
  });
  it("rejects disconnected/overlapping cages, illegal arities, row duplicates, and fractional digits", () => {
    const level = arithmeticCageLevels[0],
      bad = (cages: ArithmeticCageLevel["cages"]) => ({ ...level, cages });
    expect(
      validArithmeticCageLevel(bad([{ cells: [0, 8], op: "+", target: 4 }])),
    ).toBe(false);
    expect(
      validArithmeticCageLevel(bad([...level.cages, level.cages[0]])),
    ).toBe(false);
    expect(
      validArithmeticCageLevel(bad([{ cells: [0, 1, 2], op: "−", target: 2 }])),
    ).toBe(false);
    expect(solveArithmeticCage(level, Array(9).fill(0.5)).status).toBe(
      "invalid",
    );
    const wrong = arithmeticCageCertificates[0].solution.slice();
    wrong[1] = wrong[0];
    expect(isArithmeticCageSolved(level, wrong)).toBe(false);
    expect(arithmeticCageConflicts(level, wrong)).toContain(0);
  });
});

describe("bounded proofs, state, hints and repair", () => {
  it("teaches the smallest Kakuro intersection and the visible single-cell cage first", () => {
    const kakuro = getKakuroHint(kakuroLevels[0], [0, 0, 0, 0]);
    expect(kakuro).toMatchObject({ kind: "deduction", index: 3, value: 1 });
    expect(kakuro.reason).toContain("第 2 行第 1–2 列横段（和 3，段内不重复）");
    expect(kakuro.reason).toContain("{1、2}");
    expect(kakuro.reason).toContain("第 2 列第 1–2 行竖段（和 4，段内不重复）");
    expect(kakuro.reason).toContain("{1、3}");
    expect(kakuro.reason).toContain("共同候选只有 1");
    expect(kakuro.reason).not.toContain("完整枚举");
    const cage = getArithmeticCageHint(
      arithmeticCageLevels[0],
      Array(9).fill(0),
    );
    expect(cage).toMatchObject({ kind: "deduction", index: 0, value: 1 });
    expect(cage.reason).toContain("第 1 笼（1=，单格）");
    expect(cage.reason).toContain("{1}");
    expect(cage.reason).not.toContain("完整枚举");
  });
  it("filters local combinations by filled entries and teaches remaining row or column digits", () => {
    // Many Latin-square completions remain; a local proof does not require uniqueness.
    const level: ArithmeticCageLevel = {
      title: "local rules",
      lesson: "",
      size: 3,
      cages: Array.from({ length: 3 }, (_, r) => ({
        cells: [r * 3, r * 3 + 1, r * 3 + 2],
        op: "+",
        target: 6,
      })),
    };
    for (const [values, index, source] of [
      [[1, 2, 0, 0, 0, 0, 0, 0, 0], 2, "第 1 行（1–3 各一次）"],
      [[1, 0, 0, 2, 0, 0, 0, 0, 0], 6, "第 1 列（1–3 各一次）"],
    ] as const) {
      expect(solveArithmeticCage(level, values).solutions).toHaveLength(2);
      const hint = getArithmeticCageHint(level, values);
      expect(hint).toMatchObject({ kind: "deduction", index, value: 3 });
      expect(hint.reason).toContain(source);
      expect(hint.reason).toContain("{3}");
      expect(hint.reason).not.toContain("完整枚举");
    }
    const kakuro = getKakuroHint(kakuroLevels[0], [0, 0, 0, 1]);
    expect(kakuro).toMatchObject({ kind: "deduction", value: 3 });
    expect(kakuro.reason).toContain("竖段（和 4，段内不重复）");
    expect(kakuro.reason).toContain("{3}");
    expect(kakuro.reason).not.toContain("共同候选");
  });
  it("retains an honest exhaustive fallback and never uses a local clue to bypass feasibility or budget checks", () => {
    const problem = {
      length: 3,
      digits: 2,
      active: [0, 1, 2],
      tables: [
        {
          cells: [0, 1],
          tuples: [
            [1, 1],
            [2, 2],
          ],
        },
        {
          cells: [1, 2],
          tuples: [
            [1, 1],
            [2, 2],
          ],
        },
        {
          cells: [0, 2],
          tuples: [
            [1, 1],
            [1, 2],
            [2, 1],
          ],
        },
      ],
    };
    const fallback = arithmeticHint(problem, [0, 0, 0], "");
    expect(fallback).toMatchObject({ kind: "deduction", index: 0, value: 1 });
    expect(fallback.reason).toContain("完整枚举只剩这一种解");
    const direct = {
      ...problem,
      tables: [
        { cells: [0], tuples: [[1]], source: "visible 1=" },
        {
          cells: [1, 2],
          tuples: [
            [1, 2],
            [2, 1],
          ],
        },
      ],
    };
    expect(arithmeticHint(direct, [0, 0, 0], "")).toMatchObject({
      kind: "deduction",
      index: 0,
      value: 1,
    });
    expect(arithmeticHint(direct, [0, 0, 0], "", 1).kind).toBe("unavailable");
    expect(arithmeticHint(direct, [0, 0, 0], "", 0).kind).toBe("unavailable");
    expect(arithmeticHint(direct, [0, 1, 1], "").kind).toBe("unavailable");
    expect(arithmeticHint(direct, [0, 0], "").kind).toBe("unavailable");
    expect(arithmeticHint(problem, [1, 1, 1], "").reason).toBe(
      "所有线索已经满足。",
    );
    expect(
      arithmeticHint(
        {
          ...direct,
          tables: [direct.tables[1], { cells: [0], tuples: [[1], [2]] }],
        },
        [0, 0, 0],
        "",
      ).kind,
    ).toBe("unavailable");
  });
  it("solves all 24 boards using fresh hints alone, matching independent certificates at every step", () => {
    for (const [levels, certificates, hint, problem, solved] of [
      [
        kakuroLevels,
        kakuroCertificates,
        getKakuroHint,
        kakuroProblem,
        isKakuroSolved,
      ],
      [
        arithmeticCageLevels,
        arithmeticCageCertificates,
        getArithmeticCageHint,
        arithmeticCageProblem,
        isArithmeticCageSolved,
      ],
    ] as const)
      levels.forEach((level, l) => {
        const p = problem(level as never)!,
          values = Array(p.length).fill(0);
        for (let step = 0; step < p.active.length; step++) {
          const result = hint(level as never, values);
          expect(result.kind).toBe("deduction");
          if (result.kind !== "deduction") throw Error(result.reason);
          expect(p.active).toContain(result.index);
          expect(values[result.index]).toBe(0);
          expect(result.value).toBe(certificates[l].solution[result.index]);
          values[result.index] = result.value;
        }
        expect(values).toEqual(certificates[l].solution);
        expect(solved(level as never, values)).toBe(true);
        expect(hint(level as never, values).reason).toBe("所有线索已经满足。");
      });
  });
  it("respects node/work limits and invalid budgets without turning a cutoff into a proof", () => {
    const problem = {
      length: 2,
      digits: 2,
      active: [0, 1],
      tables: [
        {
          cells: [0, 1],
          tuples: [
            [1, 2],
            [2, 1],
          ],
        },
      ],
    };
    expect(searchArithmetic(problem, [0, 0], 2, 1).status).toBe("budget");
    expect(searchArithmetic(problem, [0, 0], 2, 30000, 1).status).toBe(
      "budget",
    );
    expect(
      searchArithmetic(problem, [0, 0], 2, ARITHMETIC_NODE_LIMIT + 1).status,
    ).toBe("invalid");
    expect(searchArithmetic(problem, [0, 0], 0).status).toBe("invalid");
    expect(
      searchArithmetic({ ...problem, active: [0, 0] }, [0, 0]).status,
    ).toBe("invalid");
  });
  it("proves hints against current entries, identifies definite mistakes, and reports bad/bounded states honestly", () => {
    for (const [levels, certificates, hint, problem] of [
      [kakuroLevels, kakuroCertificates, getKakuroHint, kakuroProblem],
      [
        arithmeticCageLevels,
        arithmeticCageCertificates,
        getArithmeticCageHint,
        arithmeticCageProblem,
      ],
    ] as const) {
      // The two games deliberately share only the proof protocol; their constraints remain distinct.
      for (let l = 0; l < levels.length; l++) {
        const level = levels[l] as never,
          p = problem(level)!;
        const filled = Array(p.length).fill(0);
        filled[p.active[0]] = certificates[l].solution[p.active[0]];
        const result = hint(level, filled);
        expect(result.kind).toBe("deduction");
        if (result.kind === "deduction") {
          expect(filled[result.index]).toBe(0);
          expect(result.value).toBe(certificates[l].solution[result.index]);
        }
        filled[p.active[0]] = (filled[p.active[0]] % p.digits) + 1;
        const repair = hint(level, filled);
        expect(repair.kind).toBe("repair");
        if (repair.kind === "repair") expect(repair.index).toBe(p.active[0]);
        expect(hint(level, filled, 0).kind).toBe("unavailable");
      }
    }
  });
  it("keeps immutable bounded history and rejects blocked/locked/no-op inputs", () => {
    let state = createArithmeticState(3);
    const initial = state;
    expect(inputArithmetic(state, 1, 2, [0, 2], 9)).toBe(state);
    expect(inputArithmetic(state, 0, 10, [0, 2], 9)).toBe(state);
    expect(inputArithmetic(state, 0, 2, [0, 2], 9, true)).toBe(state);
    state = inputArithmetic(state, 0, 3, [0, 2], 9);
    expect(initial.values).toEqual([0, 0, 0]);
    expect(inputArithmetic(state, 0, 3, [0, 2], 9)).toBe(state);
    expect(undoArithmetic(state).values).toEqual(initial.values);
    expect(undoArithmetic(state, true)).toBe(state);
    for (let i = 0; i < 300; i++)
      state = inputArithmetic(state, 2, (i % 2) + 1, [0, 2], 9);
    expect(state.history).toHaveLength(ARITHMETIC_HISTORY_LIMIT);
  });
});

for (const [name, Component, certificates, levels] of [
  ["Kakuro", KakuroGarden, kakuroCertificates, kakuroLevels],
  [
    "Arithmetic cages",
    ArithmeticCageGarden,
    arithmeticCageCertificates,
    arithmeticCageLevels,
  ],
] as const)
  describe(`${name} DOM`, () => {
    it("completes every authored level through visible keyboard inputs exactly once", () => {
      for (let l = 0; l < levels.length; l++) {
        const p = props({ level: l }),
          view = render(<Component {...p} />);
        certificates[l].solution.forEach((v, i) => {
          if (v) input(i, v);
        });
        expect(p.onComplete).toHaveBeenCalledTimes(1);
        expect(
          (screen.getByRole("button", { name: "填入 1" }) as HTMLButtonElement)
            .disabled,
        ).toBe(true);
        fireEvent.keyDown(cell(certificates[l].solution.findIndex(Boolean)), {
          key: "1",
        });
        view.rerender(<Component {...p} hintToken={1} />);
        expect(p.onComplete).toHaveBeenCalledTimes(1);
        view.unmount();
      }
    });
    it("supports touch pad, clear, arrows, undo, pause token consumption, reset and level changes", () => {
      const p = props(),
        view = render(<Component {...p} />);
      const first = certificates[0].solution.findIndex(Boolean);
      fireEvent.click(cell(first));
      fireEvent.click(screen.getByRole("button", { name: "填入 2" }));
      expect(cell(first).getAttribute("data-value")).toBe("2");
      fireEvent.click(screen.getByRole("button", { name: "清空所选格" }));
      expect(cell(first).getAttribute("data-value")).toBe("0");
      view.rerender(<Component {...p} undoToken={1} />);
      expect(cell(first).getAttribute("data-value")).toBe("2");
      fireEvent.keyDown(cell(first), { key: "ArrowRight" });
      expect(document.activeElement).toBe(cell(first + 1));
      fireEvent.keyDown(cell(first + 1), { key: "1" });
      expect(cell(first + 1).getAttribute("data-value")).toBe("1");
      view.rerender(<Component {...p} paused hintToken={1} undoToken={2} />);
      expect(cell(first).disabled).toBe(true);
      fireEvent.keyDown(cell(first), { key: "3" });
      fireEvent.click(screen.getByRole("button", { name: "填入 3" }));
      expect(cell(first).getAttribute("data-value")).toBe("2");
      view.rerender(<Component {...p} hintToken={1} undoToken={2} />);
      expect(cell(first + 1).getAttribute("data-value")).toBe("1");
      expect(document.querySelector(".ac-hint")).toBeNull();
      view.rerender(
        <Component {...p} resetToken={1} hintToken={1} undoToken={2} />,
      );
      expect(cell(first).getAttribute("data-value")).toBe("0");
      expect(document.querySelector(".ac-hint")).toBeNull();
      view.rerender(
        <Component
          {...p}
          level={1}
          resetToken={1}
          hintToken={1}
          undoToken={2}
        />,
      );
      expect(
        [...document.querySelectorAll("[data-arithmetic-cell]")].every(
          (e) => e.getAttribute("data-value") === "0",
        ),
      ).toBe(true);
      expect(p.onComplete).not.toHaveBeenCalled();
    });
    it("shows fresh hint/repair explanations and keeps completion idempotent through undo and reset", () => {
      const p = props(),
        view = render(<Component {...p} />);
      view.rerender(<Component {...p} hintToken={1} />);
      expect(document.querySelector(".ac-hint")?.textContent).toContain(
        name === "Kakuro" ? "共同候选只有 1" : "第 1 笼（1=，单格）",
      );
      expect(document.querySelector(".ac-hint")?.textContent).not.toContain(
        "完整枚举",
      );
      expect(document.activeElement).toBe(cell(name === "Kakuro" ? 3 : 0));
      const first = certificates[0].solution.findIndex(Boolean),
        wrong =
          (certificates[0].solution[first] % (name === "Kakuro" ? 9 : 3)) + 1;
      input(first, wrong);
      view.rerender(<Component {...p} hintToken={2} />);
      expect(document.querySelector(".ac-hint")?.textContent).toContain(
        "请先清空",
      );
      certificates[0].solution.forEach((v, i) => {
        if (v) input(i, v);
      });
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      view.rerender(<Component {...p} hintToken={2} undoToken={1} />);
      const last =
        certificates[0].solution.length -
        1 -
        [...certificates[0].solution].reverse().findIndex(Boolean);
      input(last, certificates[0].solution[last]);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      view.rerender(
        <Component {...p} resetToken={1} hintToken={2} undoToken={1} />,
      );
      certificates[0].solution.forEach((v, i) => {
        if (v) input(i, v);
      });
      expect(p.onComplete).toHaveBeenCalledTimes(2);
    });
  });
