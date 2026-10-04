// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { carryLettersLevels } from "../src/games/carryLettersLevels";
import { binaryBalanceLevels } from "../src/games/binaryBalanceLevels";
import {
  CARRY_NODE_LIMIT,
  carryColumns,
  carryHintFromSearch,
  carryNumber,
  carrySymbols,
  carryWon,
  createCarrySearch,
  createCarryState,
  editCarry,
  findCarryHint,
  publicCarry,
  undoCarry,
  validCarryProblem,
  type CarryMapping,
  type CarryProblem,
} from "../src/games/carryLettersLogic";
import {
  BINARY_NODE_LIMIT,
  binaryConflicts,
  binaryHintFromSearch,
  binaryRowPatterns,
  binaryWon,
  createBinarySearch,
  createBinaryState,
  editBinary,
  findBinaryHint,
  publicBinary,
  undoBinary,
  validBinaryProblem,
  type BinaryCell,
  type BinaryProblem,
} from "../src/games/binaryBalanceLogic";
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function carrySearch(
  p: CarryProblem,
  values: CarryMapping = createCarryState(p).values,
  limit = CARRY_NODE_LIMIT,
) {
  const search = createCarrySearch(p, values, limit);
  let result = search.step(79);
  while (!result) result = search.step(79);
  return result;
}
function binarySearch(
  p: BinaryProblem,
  cells: readonly BinaryCell[] = p.givens,
  limit = BINARY_NODE_LIMIT,
) {
  const search = createBinarySearch(p, cells, limit);
  let result = search.step(73);
  while (!result) result = search.step(73);
  return result;
}
// Deliberately independent: enumerate digit permutations and evaluate full integer words.
// No column arithmetic, runtime symbols, certificate, or runtime validation is used.
function permutationOracle(p: CarryProblem, entries: CarryMapping = p.givens) {
  const letters = Array.from(new Set(p.addends.join("") + p.result)).sort(),
    mapping: Record<string, number> = {},
    answers: Record<string, number>[] = [];
  const leading = [...p.addends, p.result]
    .filter((w) => w.length > 1)
    .map((w) => w[0]);
  function dfs(index: number, remaining: number[]) {
    if (index === letters.length) {
      const number = (word: string) =>
        Number([...word].map((s) => mapping[s]).join(""));
      if (p.addends.reduce((s, w) => s + number(w), 0) === number(p.result))
        answers.push({ ...mapping });
      return;
    }
    const s = letters[index];
    for (const d of remaining) {
      if (
        (entries[s] != null && entries[s] !== d) ||
        (s in p.givens && p.givens[s] !== d) ||
        (!d && leading.includes(s))
      )
        continue;
      mapping[s] = d;
      dfs(
        index + 1,
        remaining.filter((v) => v !== d),
      );
    }
  }
  dfs(0, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  return answers;
}
// Independent cell-by-cell backtracking with direct line scans; never uses row-pattern CSP.
function cellOracle(p: BinaryProblem, input: readonly BinaryCell[] = p.givens) {
  const n = p.size,
    board = [...input],
    solutions: BinaryCell[][] = [];
  function okay() {
    for (let vertical = 0; vertical < 2; vertical++) {
      const completed: string[] = [];
      for (let a = 0; a < n; a++) {
        const line = Array.from(
          { length: n },
          (_, b) => board[vertical ? b * n + a : a * n + b],
        );
        if (
          line.filter((v) => v === 1).length > n / 2 ||
          line.filter((v) => v === 2).length > n / 2
        )
          return false;
        for (let k = 0; k < n - 2; k++)
          if (line[k] && line[k] === line[k + 1] && line[k] === line[k + 2])
            return false;
        if (!line.includes(0)) {
          const key = line.join("");
          if (completed.includes(key)) return false;
          completed.push(key);
        }
      }
    }
    return true;
  }
  function dfs(index: number) {
    if (!okay()) return;
    if (index === n * n) {
      solutions.push([...board]);
      return;
    }
    if (p.givens[index] && p.givens[index] !== board[index]) return;
    if (board[index]) {
      dfs(index + 1);
      return;
    }
    for (const value of [1, 2] as const) {
      board[index] = value;
      dfs(index + 1);
    }
    board[index] = 0;
  }
  dfs(0);
  return solutions;
}

describe("CarryLetters original equations and independent certificates", () => {
  it("has twelve distinct, uniquely solvable, bounded authored equations", () => {
    expect(carryLettersLevels).toHaveLength(12);
    expect(
      new Set(carryLettersLevels.map((p) => JSON.stringify(publicCarry(p))))
        .size,
    ).toBe(12);
    expect(new Set(carryLettersLevels.map((p) => p.id)).size).toBe(12);
    for (const level of carryLettersLevels) {
      expect(validCarryProblem(level)).toBe(true);
      const initial = createCarryState(level);
      expect(
        Object.values(initial.values).filter((v) => v === null).length,
      ).toBeGreaterThanOrEqual(2);
      expect(carryWon(level, initial.values)).toBe(false);
      const oracle = permutationOracle(level),
        result = carrySearch(
          freeze(publicCarry(level)),
          freeze(initial.values),
        );
      expect(oracle, level.id).toEqual([level.certificate.mapping]);
      expect(result.complete).toBe(true);
      expect(result.count).toBe(1);
      expect(result.first).toEqual(oracle[0]);
      expect(result.nodes).toBeLessThan(CARRY_NODE_LIMIT);
      expect(carryColumns(level, oracle[0]).map((c) => c.outgoing)).toEqual(
        level.certificate.carries,
      );
      expect(carryColumns(level, oracle[0]).every((c) => c.matches)).toBe(true);
      expect(carryWon(level, oracle[0])).toBe(true);
    }
    expect(Math.max(...carryLettersLevels.map((l) => l.result.length))).toBe(5);
    expect(Math.max(...carryLettersLevels.map((l) => l.addends.length))).toBe(
      3,
    );
    expect(
      Math.max(...carryLettersLevels.flatMap((l) => l.certificate.carries)),
    ).toBe(2);
  });
  it("agrees with the whole-integer oracle for ambiguous and contradictory player states", () => {
    const p: CarryProblem = { addends: ["A", "B"], result: "C", givens: {} };
    for (const values of [
      { A: null, B: null, C: null },
      { A: 2, B: null, C: null },
      { A: 0, B: 0, C: null },
      { A: 9, B: 8, C: 1 },
    ] as CarryMapping[]) {
      const oracle = permutationOracle(p, values),
        result = carrySearch(p, values);
      expect(result.complete).toBe(true);
      expect(result.count).toBe(oracle.length);
      for (const s of ["A", "B", "C"])
        expect(result.candidates[s]).toEqual(
          [...new Set(oracle.map((m) => m[s]))].sort((a, b) => a - b),
        );
    }
    expect(
      carryHintFromSearch(
        p,
        { A: 2, B: null, C: null },
        carrySearch(p, { A: 2, B: null, C: null }),
      ).kind,
    ).toBe("choice");
    expect(
      carryWon(
        { addends: ["AB", "C"], result: "DE", givens: {} },
        { A: 0, B: 3, C: 8, D: 1, E: 1 },
      ),
    ).toBe(false);
    expect(carryNumber("AB", { A: 2, B: null })).toBeNull();
  });
  it("does not use a certificate for goals or actual-state hints", () => {
    for (const level of carryLettersLevels) {
      const guarded = {
        ...level,
        get certificate(): typeof level.certificate {
          throw new Error("Certificate must stay out of runtime");
        },
      };
      const p = publicCarry(guarded),
        initial = createCarryState(p),
        result = carrySearch(p, initial.values);
      expect(carryHintFromSearch(p, initial.values, result).kind).toBe(
        "forced",
      );
      expect(carryWon(guarded, level.certificate.mapping)).toBe(true);
      const wrong = { ...initial.values };
      const first = carrySymbols(p).find((s) => !(s in p.givens))!;
      wrong[first] = (level.certificate.mapping[first] + 1) % 10;
      expect(carryHintFromSearch(p, wrong, carrySearch(p, wrong)).kind).toBe(
        "contradiction",
      );
    }
  });
  it("chunks, cancels and distinguishes exhausted budget from contradiction", async () => {
    const p: CarryProblem = {
        addends: ["ABC", "DEF"],
        result: "GAB",
        givens: {},
      },
      values = createCarryState(p).values;
    const search = createCarrySearch(p, values, 5);
    expect(search.step(1)).toBeNull();
    expect(search.nodes).toBe(1);
    let result = search.step(2);
    while (!result) result = search.step(2);
    expect(result.nodes).toBe(5);
    expect(result.complete).toBe(false);
    const hint = carryHintFromSearch(p, values, result);
    expect(hint.kind).toBe("unknown");
    expect(hint.digit).toBeUndefined();
    expect(() => search.step(0)).toThrow();
    const controller = new AbortController(),
      work = findCarryHint(p, values, { signal: controller.signal, chunk: 1 });
    controller.abort();
    expect(await work).toBeNull();
    expect(carryHintFromSearch(p, values, carrySearch(p, values, 0)).kind).toBe(
      "unknown",
    );
    expect(validCarryProblem({ ...p, addends: ["ABCDEF", "DEF"] })).toBe(false);
  });
  it("keeps immutable history and prevents editing clues, invalid inputs and completed games", () => {
    const p = carryLettersLevels[0],
      original = freeze(createCarryState(p));
    expect(editCarry(p, original, "C", 9)).toBe(original);
    expect(editCarry(p, original, "Z", 1)).toBe(original);
    expect(editCarry(p, original, "A", 10)).toBe(original);
    const changed = editCarry(p, original, "A", 3),
      cleared = editCarry(p, freeze(changed), "A", null);
    expect(original.values.A).toBeNull();
    expect(changed.values.A).toBe(3);
    expect(cleared.values.A).toBeNull();
    expect(undoCarry(p, cleared)).toEqual(changed);
    expect(undoCarry(p, changed)).toEqual(original);
    let solved = createCarryState(p);
    for (const [s, d] of Object.entries(p.certificate.mapping))
      solved = editCarry(p, freeze(solved), s, d);
    expect(carryWon(p, solved.values)).toBe(true);
    expect(editCarry(p, solved, "A", 0)).toBe(solved);
    expect(undoCarry(p, solved)).toBe(solved);
  });
});

describe("BinaryBalance literal grids and independent cellwise uniqueness", () => {
  it("has twelve unique authored levels with two difficulty sizes and progressively fewer clues", () => {
    expect(binaryBalanceLevels).toHaveLength(12);
    expect(new Set(binaryBalanceLevels.map((l) => l.id)).size).toBe(12);
    expect(
      new Set(binaryBalanceLevels.map((l) => JSON.stringify(publicBinary(l))))
        .size,
    ).toBe(12);
    expect(binaryBalanceLevels.map((l) => l.size)).toEqual([
      4, 4, 4, 4, 6, 6, 6, 6, 6, 6, 6, 6,
    ]);
    for (const l of binaryBalanceLevels) {
      expect(validBinaryProblem(l)).toBe(true);
      expect(l.givens.filter((v) => !v).length).toBeGreaterThanOrEqual(8);
      const oracle = cellOracle(l),
        result = binarySearch(freeze(publicBinary(l)));
      expect(oracle, l.id).toEqual([l.certificate.cells]);
      expect(result.complete).toBe(true);
      expect(result.count).toBe(1);
      expect(result.first).toEqual(oracle[0]);
      expect(result.nodes).toBeLessThan(BINARY_NODE_LIMIT);
      expect(binaryWon(l, oracle[0])).toBe(true);
      expect(binaryWon(l, l.givens)).toBe(false);
      for (let i = 0; i < l.givens.length; i++)
        if (l.givens[i]) expect(l.givens[i]).toBe(oracle[0][i]);
    }
  });
  it("matches cellwise enumeration on the empty 4×4 domain and partial player states", () => {
    const p: BinaryProblem = { size: 4, givens: Array<BinaryCell>(16).fill(0) },
      all = cellOracle(p),
      result = binarySearch(p);
    expect(result.count).toBe(all.length);
    expect(all.length).toBe(72);
    expect(binaryHintFromSearch(p, p.givens, result).kind).toBe("choice");
    for (const fills of [
      [1, 0, 2, 0],
      [1, 1, 1, 0],
      [1, 2, 0, 0],
    ] as BinaryCell[][]) {
      const cells = [...fills, ...Array<BinaryCell>(12).fill(0)];
      expect(binarySearch(p, cells).count).toBe(cellOracle(p, cells).length);
    }
    expect(binaryRowPatterns(4)).toHaveLength(6);
    expect(binaryRowPatterns(6)).toHaveLength(14);
    expect(binaryRowPatterns(8)).toEqual([]);
  });
  it("checks all independent rules, including duplicate full columns, without certificates", () => {
    const p: BinaryProblem = { size: 4, givens: Array<BinaryCell>(16).fill(0) };
    expect(
      binaryConflicts(p, [1, 1, 1, 0, ...Array<BinaryCell>(12).fill(0)]),
    ).toEqual([0, 1, 2]);
    const duplicate: BinaryCell[] = [
      1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 2, 1, 1,
    ];
    expect(binaryWon(p, duplicate)).toBe(false);
    expect(binaryConflicts(p, duplicate).length).toBe(16);
    for (const level of binaryBalanceLevels) {
      const guarded = {
        ...level,
        get certificate(): typeof level.certificate {
          throw new Error("Certificate accessed");
        },
      };
      const pub = publicBinary(guarded);
      expect(binaryWon(guarded, level.certificate.cells)).toBe(true);
      expect(
        binaryHintFromSearch(pub, pub.givens, binarySearch(pub)).kind,
      ).toBe("forced");
      const wrong = [...pub.givens],
        i = wrong.indexOf(0);
      wrong[i] = level.certificate.cells[i] === 1 ? 2 : 1;
      expect(
        binaryHintFromSearch(pub, wrong, binarySearch(pub, wrong)).kind,
      ).toBe("contradiction");
    }
  });
  it("bounds partial nodes and never calls truncated possibilities forced or impossible", async () => {
    const p: BinaryProblem = { size: 6, givens: Array<BinaryCell>(36).fill(0) },
      search = createBinarySearch(p, p.givens, 2);
    expect(search.step(1)).toBeNull();
    expect(search.nodes).toBe(1);
    let result = search.step(1);
    while (!result) result = search.step(1);
    expect(result.complete).toBe(false);
    expect(result.nodes).toBe(2);
    expect(binaryHintFromSearch(p, p.givens, result).kind).toBe("unknown");
    expect(() => search.step(0)).toThrow();
    const controller = new AbortController(),
      work = findBinaryHint(p, p.givens, {
        signal: controller.signal,
        chunk: 1,
      });
    controller.abort();
    expect(await work).toBeNull();
    expect(binarySearch(p, p.givens, 0).complete).toBe(false);
    expect(validBinaryProblem({ size: 5, givens: [] })).toBe(false);
  });
  it("makes reversible immutable edits and locks literal clues and completed boards", () => {
    const p = binaryBalanceLevels[0],
      original = freeze(createBinaryState(p)),
      blank = p.givens.indexOf(0),
      given = p.givens.findIndex(Boolean);
    expect(editBinary(p, original, given, 0)).toBe(original);
    expect(editBinary(p, original, -1, 1)).toBe(original);
    const changed = editBinary(p, original, blank, 1),
      cleared = editBinary(p, freeze(changed), blank, 0);
    expect(original.cells[blank]).toBe(0);
    expect(changed.cells[blank]).toBe(1);
    expect(undoBinary(p, cleared)).toEqual(changed);
    expect(undoBinary(p, changed)).toEqual(original);
    let solved = createBinaryState(p);
    p.certificate.cells.forEach((v, i) => {
      solved = editBinary(p, freeze(solved), i, v);
    });
    expect(binaryWon(p, solved.cells)).toBe(true);
    expect(editBinary(p, solved, blank, 0)).toBe(solved);
    expect(undoBinary(p, solved)).toBe(solved);
  });
});
