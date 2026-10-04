// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GameProps } from "../src/lib/types";
import ParabolicTargets from "../src/games/ParabolicTargets";
import CurrentCircuitLab from "../src/games/CurrentCircuitLab";
import {
  labAdd,
  labCompare,
  labDiv,
  labFormat,
  labMul,
  labQ,
  labSub,
  labValid,
  labValue,
  type LabFraction,
} from "../src/games/ballisticsCircuitExact";
import {
  parabolicTargetsLevels,
  parabolicTargetsSolutions,
} from "../src/games/parabolicTargetsLevels";
import {
  PARABOLIC_SEARCH_LIMIT,
  createParabolicState,
  describeParabolicResult,
  evaluateParabolic,
  isParabolicSolved,
  moveParabolic,
  parabolicHeightRange,
  parabolicHint,
  parabolicParts,
  solveParabolic,
  undoParabolic,
  validParabolicGeometry,
  validParabolicSettings,
  verifyParabolicLevel,
  type ParabolicLevel,
  type ParabolicMove,
} from "../src/games/parabolicTargetsLogic";
import {
  currentCircuitLevels,
  currentCircuitSolutions,
} from "../src/games/currentCircuitLevels";
import {
  CURRENT_SEARCH_LIMIT,
  createCurrentState,
  currentChoices,
  currentHint,
  currentMoveFor,
  currentParts,
  describeCurrentResult,
  evaluateCurrent,
  isCurrentSolved,
  moveCurrent,
  solveCurrent,
  undoCurrent,
  validCurrentLevel,
  validCurrentSettings,
  verifyCurrentLevel,
  type CurrentCompleteSettings,
  type CurrentLevel,
  type CurrentMove,
} from "../src/games/currentCircuitLogic";

afterEach(cleanup);
function props(overrides: Partial<GameProps> = {}): GameProps {
  return {
    level: 0,
    paused: false,
    hintToken: 0,
    undoToken: 0,
    resetToken: 0,
    onStatus: vi.fn(),
    onComplete: vi.fn(),
    ...overrides,
  };
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}
function pButton(move: ParabolicMove): HTMLButtonElement {
  return move.part === "launch"
    ? screen.getByTestId("parabolic-launch")
    : document.querySelector(
        `[data-parabolic-part="${move.part}"][data-value="${move.value}"]`,
      )!;
}
function cButton(move: CurrentMove): HTMLButtonElement {
  return move.part === "measure"
    ? screen.getByTestId("current-measure")
    : document.querySelector(
        `[data-current-part="${move.part}"][data-value="${move.value}"]`,
      )!;
}

// Independent ballistic oracle: work directly in unsimplified integer
// numerators. It imports no production height, range, or comparison routine.
function oracleCompare(a: LabFraction, b: LabFraction) {
  const d = a.n * b.d - b.n * a.d;
  return d < 0n ? -1 : d > 0n ? 1 : 0;
}
function oracleHeight(
  c: ParabolicLevel,
  vx: number,
  vy: number,
  x: LabFraction,
): LabFraction {
  const u = BigInt(vx),
    v = BigInt(vy),
    h = BigInt(c.startHeight);
  return {
    n: h * u * u * x.d * x.d + v * u * x.n * x.d - x.n * x.n,
    d: u * u * x.d * x.d,
  };
}
function oracleBallistic(c: ParabolicLevel, vx: number, vy: number) {
  const target = oracleHeight(c, vx, vy, { n: BigInt(c.targetX), d: 1n });
  if (
    oracleCompare(target, c.targetLow) < 0 ||
    oracleCompare(target, c.targetHigh) > 0
  )
    return false;
  const sign = vy * vx - 2 * c.targetX;
  if (
    (c.direction === "rising" && sign <= 0) ||
    (c.direction === "falling" && sign >= 0)
  )
    return false;
  // Concavity proves positivity between the positive launch and target.
  return c.obstacles.every((o) => {
    const left = oracleHeight(c, vx, vy, o.left),
      right = oracleHeight(c, vx, vy, o.right);
    if (oracleCompare(left, o.top) > 0 && oracleCompare(right, o.top) > 0)
      return true;
    const vertex = { n: BigInt(vx * vy), d: 2n };
    const highest =
      oracleCompare(vertex, o.left) >= 0 && oracleCompare(vertex, o.right) <= 0
        ? oracleHeight(c, vx, vy, vertex)
        : oracleCompare(left, right) >= 0
          ? left
          : right;
    return oracleCompare(highest, o.bottom) < 0;
  });
}

// Independent circuit oracle: assemble the actual resistor graph, collapse
// ideal wires, then solve conductance-matrix nodal equations by elimination.
// This does not use the production series/parallel reduction formulas.
function nodalOracle(c: CurrentLevel, s: CurrentCompleteSettings) {
  const parent = Array.from({ length: 7 }, (_, i) => i);
  const root = (x: number): number =>
    parent[x] === x ? x : (parent[x] = root(parent[x]));
  type Edge = [number, number, number];
  const edges: Edge[] = [
    [1, 2, s.common],
    [2, 3, s.ballastA],
  ];
  let lampA: Edge, lampB: Edge | null;
  if (s.topology === "series") {
    lampA = [3, 4, c.lampA];
    lampB = [5, 0, c.lampB];
    edges.push(lampA, [4, 5, s.ballastB], lampB);
  } else {
    lampA = [3, 0, c.lampA];
    lampB = s.topology === "single" ? null : [4, 0, c.lampB];
    edges.push(lampA);
    if (lampB) edges.push([2, 4, s.ballastB], lampB);
  }
  for (const [a, b, resistance] of edges)
    if (resistance === 0) parent[root(a)] = root(b);
  const source = root(1),
    ground = root(0),
    nodes = [...new Set(edges.flatMap(([a, b]) => [root(a), root(b)]))].filter(
      (n) => n !== source && n !== ground,
    );
  const matrix = nodes.map(() => Array(nodes.length + 1).fill(0) as number[]);
  for (const [a0, b0, r] of edges) {
    if (r === 0) continue;
    const a = root(a0),
      b = root(b0),
      g = 1 / r;
    for (const [node, other] of [
      [a, b],
      [b, a],
    ]) {
      const i = nodes.indexOf(node);
      if (i < 0) continue;
      matrix[i][i] += g;
      const j = nodes.indexOf(other);
      if (j >= 0) matrix[i][j] -= g;
      else if (other === source) matrix[i][nodes.length] += g * s.voltage;
    }
  }
  for (let k = 0; k < nodes.length; k++) {
    let pivot = k;
    for (let i = k + 1; i < nodes.length; i++)
      if (Math.abs(matrix[i][k]) > Math.abs(matrix[pivot][k])) pivot = i;
    [matrix[k], matrix[pivot]] = [matrix[pivot], matrix[k]];
    const scale = matrix[k][k];
    if (Math.abs(scale) < 1e-14) throw new Error("Unexpected singular circuit");
    for (let j = k; j <= nodes.length; j++) matrix[k][j] /= scale;
    for (let i = 0; i < nodes.length; i++)
      if (i !== k) {
        const amount = matrix[i][k];
        for (let j = k; j <= nodes.length; j++)
          matrix[i][j] -= amount * matrix[k][j];
      }
  }
  const potential = (node: number) =>
    root(node) === source
      ? s.voltage
      : root(node) === ground
        ? 0
        : matrix[nodes.indexOf(root(node))][nodes.length];
  const edgeCurrent = ([a, b, r]: Edge) => (potential(a) - potential(b)) / r;
  const ia = edgeCurrent(lampA),
    ib = lampB ? edgeCurrent(lampB) : 0;
  const sourceI = edges
    .filter(([a, b, r]) => r > 0 && (root(a) === source || root(b) === source))
    .reduce(
      (sum, edge) =>
        sum + (root(edge[0]) === source ? 1 : -1) * edgeCurrent(edge),
      0,
    );
  const dissipation = edges
    .filter(([, , r]) => r > 0)
    .reduce((sum, edge) => sum + edgeCurrent(edge) ** 2 * edge[2], 0);
  return {
    ia,
    ib,
    va: ia * c.lampA,
    vb: ib * c.lampB,
    sourceI,
    busV: potential(2),
    equivalentR: s.voltage / sourceI,
    dissipation,
  };
}
function allCurrentSettings(c: CurrentLevel) {
  const list: CurrentCompleteSettings[] = [];
  for (const topology of c.options.topology)
    for (const voltage of c.options.voltage)
      for (const common of c.options.common)
        for (const ballastA of c.options.ballastA)
          for (const ballastB of c.options.ballastB)
            list.push({ topology, voltage, common, ballastA, ballastB });
  return list;
}

describe("shared exact arithmetic for the two original labs", () => {
  it("normalizes signs, preserves arbitrary cross-products, and refuses inexact inputs", () => {
    expect(labQ(12, -18)).toEqual({ n: -2n, d: 3n });
    expect(labQ(0, 80)).toEqual({ n: 0n, d: 1n });
    expect(labFormat(labAdd(labQ(1, 3), labQ(1, 6)))).toBe("1/2");
    expect(labFormat(labSub(labQ(1, 3), labQ(1, 2)))).toBe("-1/6");
    expect(labFormat(labDiv(labMul(labQ(7, 9), labQ(12, 5)), labQ(2, 3)))).toBe(
      "14/5",
    );
    expect(labCompare(labQ(10n ** 40n + 1n, 3n), labQ(10n ** 40n, 3n))).toBe(1);
    expect(() => labQ(1, 0)).toThrow(RangeError);
    expect(() => labQ(1.2)).toThrow(RangeError);
    expect(() => labDiv(labQ(1), labQ(0))).toThrow(RangeError);
    expect(labValid({ n: 1n, d: 0n })).toBe(false);
    expect(labValid({ n: 1, d: 2 })).toBe(false);
  });
});

describe("ParabolicTargets continuous physics", () => {
  it("has 12 distinct authored solvable levels, increasing design scope, and no first-choice victories", () => {
    expect(parabolicTargetsLevels).toHaveLength(12);
    expect(
      new Set(
        parabolicTargetsLevels.map(
          (c) =>
            `${c.startHeight}/${c.targetX}/${labFormat(c.targetLow)}/${c.direction}/${c.obstacles.map((o) => o.name).join()}`,
        ),
      ).size,
    ).toBe(12);
    parabolicTargetsLevels.forEach((c) => {
      expect(verifyParabolicLevel(c)).toBe(true);
      expect(oracleBallistic(c, c.certificate.vx, c.certificate.vy)).toBe(true);
      expect(evaluateParabolic(c, { vx: c.vx[0], vy: c.vy[0] }).kind).not.toBe(
        "target",
      );
    });
    expect(
      parabolicTargetsLevels[0].vx.length * parabolicTargetsLevels[0].vy.length,
    ).toBe(3);
    expect(
      parabolicTargetsLevels[11].vx.length *
        parabolicTargetsLevels[11].vy.length,
    ).toBe(64);
    expect(parabolicTargetsLevels[11].obstacles).toHaveLength(3);
  });
  it("makes the final obstacle course essential rather than merely decorative", () => {
    const c = parabolicTargetsLevels[11],
      highArc = { vx: 5, vy: 8 };
    expect(evaluateParabolic({ ...c, obstacles: [] }, highArc).kind).toBe(
      "target",
    );
    expect(evaluateParabolic(c, highArc).kind).toBe("obstacle");
    expect(evaluateParabolic(c, c.certificate).kind).toBe("target");
    expect(verifyParabolicLevel({ ...c, certificate: highArc })).toBe(false);
    const solutions = c.vx
      .flatMap((vx) => c.vy.map((vy) => ({ vx, vy })))
      .filter((s) => evaluateParabolic(c, s).kind === "target");
    expect(solutions).toEqual([c.certificate]);
  });
  it("independently classifies every authored choice, including direction and clearance", () => {
    for (const c of parabolicTargetsLevels)
      for (const vx of c.vx)
        for (const vy of c.vy)
          expect(evaluateParabolic(c, { vx, vy }).kind === "target").toBe(
            oracleBallistic(c, vx, vy),
          );
  });
  it("detects narrow obstacles, endpoint contact, and an interior-vertex collision", () => {
    const c: ParabolicLevel = {
      ...parabolicTargetsLevels[0],
      vx: [2, 4],
      vy: [3, 4],
      targetLow: labQ(1),
      targetHigh: labQ(10),
      obstacles: [
        {
          name: "极薄柱",
          left: labQ(1001, 1000),
          right: labQ(1002, 1000),
          bottom: labQ(0),
          top: labQ(10),
        },
      ],
    };
    expect(evaluateParabolic(c, { vx: 4, vy: 3 }).kind).toBe("obstacle");
    const touching = {
      ...c,
      obstacles: [
        {
          name: "边缘",
          left: labQ(2),
          right: labQ(3),
          bottom: labQ(0),
          top: labQ(9, 4),
        },
      ],
    };
    expect(evaluateParabolic(touching, { vx: 4, vy: 3 }).kind).toBe("obstacle");
    expect(
      evaluateParabolic(
        {
          ...touching,
          obstacles: [{ ...touching.obstacles[0], top: labQ(2249, 1000) }],
        },
        { vx: 4, vy: 3 },
      ).kind,
    ).toBe("target");
    const roof = {
      ...c,
      obstacles: [
        {
          name: "内峰顶板",
          left: labQ(3),
          right: labQ(5),
          bottom: labQ(49, 10),
          top: labQ(6),
        },
      ],
    };
    const range = parabolicHeightRange(
      roof,
      { vx: 2, vy: 4 },
      labQ(3),
      labQ(5),
    );
    expect(range.min).toEqual(labQ(19, 4));
    expect(range.max).toEqual(labQ(5));
    expect(evaluateParabolic(roof, { vx: 2, vy: 4 }).kind).toBe("obstacle");
    expect(
      evaluateParabolic(
        {
          ...roof,
          obstacles: [{ ...roof.obstacles[0], bottom: labQ(5001, 1000) }],
        },
        { vx: 2, vy: 4 },
      ).kind,
    ).toBe("target");
  });
  it("uses inclusive targets, excludes grounded trajectories, and distinguishes the apex from rising/falling", () => {
    const c = {
      ...parabolicTargetsLevels[0],
      vx: [2, 4],
      vy: [2, 3, 4],
      targetLow: labQ(3),
      targetHigh: labQ(3),
    };
    expect(evaluateParabolic(c, { vx: 4, vy: 3 }).kind).toBe("target");
    expect(
      evaluateParabolic(
        { ...c, targetLow: labQ(3001, 1000), targetHigh: labQ(4) },
        { vx: 4, vy: 3 },
      ).kind,
    ).toBe("low");
    expect(
      evaluateParabolic(
        { ...c, targetLow: labQ(2), targetHigh: labQ(2999, 1000) },
        { vx: 4, vy: 3 },
      ).kind,
    ).toBe("high");
    expect(evaluateParabolic(c, { vx: 2, vy: 2 }).kind).toBe("ground");
    const apex = {
      ...c,
      targetLow: labQ(5),
      targetHigh: labQ(5),
      direction: "rising" as const,
    };
    expect(evaluateParabolic(apex, { vx: 4, vy: 4 }).kind).toBe("direction");
    expect(
      evaluateParabolic({ ...apex, direction: "falling" }, { vx: 4, vy: 4 })
        .kind,
    ).toBe("direction");
  });
  it.each(parabolicTargetsLevels.map((c, i) => [i + 1, c, i] as const))(
    "replays certificate %i, freezes victory, and reverses every move",
    (_, c, i) => {
      const initial = freeze(createParabolicState(c));
      let state = initial;
      for (const move of parabolicTargetsSolutions[i])
        state = moveParabolic(c, state, move);
      expect(isParabolicSolved(c, state)).toBe(true);
      expect(moveParabolic(c, state, { part: "vy", value: c.vy[0] })).toBe(
        state,
      );
      expect(parabolicHint(c, state)).toContain("已验证");
      const solution = solveParabolic(c);
      expect(solution.exhausted).toBe(false);
      expect(solution.nodes).toBeLessThanOrEqual(PARABOLIC_SEARCH_LIMIT);
      expect(evaluateParabolic(c, solution.settings!).kind).toBe("target");
      while (state.history.length) state = undoParabolic(state);
      expect(state).toEqual(initial);
      expect(undoParabolic(state)).toBe(state);
    },
  );
  it("rejects malformed inputs and clears/reinstates measurements without mutating the past", () => {
    const c = parabolicTargetsLevels[0],
      initial = freeze(createParabolicState(c));
    for (const move of [
      { part: "vy", value: 999 },
      { part: "vx", value: NaN },
      { part: "unknown", value: 4 },
      { part: "launch" },
    ] as ParabolicMove[])
      expect(moveParabolic(c, initial, move)).toBe(initial);
    expect(validParabolicSettings(c, { vx: 0, vy: 3 })).toBe(false);
    expect(validParabolicGeometry({ ...c, vx: [4, 4] })).toBe(false);
    expect(
      evaluateParabolic({ ...c, targetLow: labQ(-1) }, c.certificate).kind,
    ).toBe("invalid");
    let state = moveParabolic(c, initial, { part: "vy", value: 2 });
    state = moveParabolic(c, state, { part: "launch" });
    expect(state.tested).toBe(true);
    const changed = moveParabolic(c, freeze(state), { part: "vy", value: 3 });
    expect(changed.tested).toBe(false);
    expect(undoParabolic(changed)).toEqual(state);
    expect(solveParabolic(c, initial, 0)).toEqual({
      settings: null,
      nodes: 0,
      exhausted: true,
    });
    expect(solveParabolic(c, initial, 1).exhausted).toBe(true);
    expect(parabolicHint(c, initial)).toContain("竖直初速度");
    expect(parabolicHint(c, state)).toContain("变为");
    expect(parabolicHint(c, state, 0)).toContain("达到上限");
    expect(
      describeParabolicResult(c, evaluateParabolic(c, { vx: 4, vy: 99 })),
    ).toContain("无效");
  });
});

describe("CurrentCircuitLab ideal physical network", () => {
  it("has 12 authored solvable levels with explicit independent goals and no first-choice victories", () => {
    expect(currentCircuitLevels).toHaveLength(12);
    expect(new Set(currentCircuitLevels.map((c) => c.title)).size).toBe(12);
    currentCircuitLevels.forEach((c) => {
      expect(verifyCurrentLevel(c)).toBe(true);
      const oracle = nodalOracle(c, c.certificate);
      for (const goal of c.goals)
        expect(oracle[goal.quantity]).toBeCloseTo(labValue(goal.target), 11);
      const first = Object.fromEntries(
        currentParts.map((p) => [p, currentChoices(c, p)[0]]),
      ) as CurrentCompleteSettings;
      expect(evaluateCurrent(c, first).kind).not.toBe("target");
    });
    expect(allCurrentSettings(currentCircuitLevels[0])).toHaveLength(3);
    expect(allCurrentSettings(currentCircuitLevels[11])).toHaveLength(1200);
  });
  it("matches an independent nodal solver for every authored combination and conserves power", () => {
    for (const c of currentCircuitLevels)
      for (const s of allCurrentSettings(c)) {
        const expected = nodalOracle(c, s),
          result = evaluateCurrent(c, s),
          actual = result.readings!;
        for (const key of [
          "ia",
          "ib",
          "va",
          "vb",
          "sourceI",
          "busV",
          "equivalentR",
        ] as const)
          expect(labValue(actual[key])).toBeCloseTo(expected[key], 10);
        expect(labValue(actual.sourcePower)).toBeCloseTo(
          expected.dissipation,
          10,
        );
        expect(labAdd(actual.busV, actual.commonV)).toEqual(labQ(s.voltage));
        if (s.topology === "parallel")
          expect(labAdd(actual.ia, actual.ib)).toEqual(actual.sourceI);
        if (s.topology === "series") expect(actual.ia).toEqual(actual.ib);
        expect(result.kind === "target").toBe(
          c.goals.every(
            (g) => Math.abs(expected[g.quantity] - labValue(g.target)) < 1e-10,
          ),
        );
      }
  });
  it("gives the final network a unique design and detects an incorrect certificate", () => {
    const c = currentCircuitLevels[11];
    expect(
      allCurrentSettings(c).filter(
        (s) => evaluateCurrent(c, s).kind === "target",
      ),
    ).toEqual([c.certificate]);
    expect(
      verifyCurrentLevel({
        ...c,
        certificate: { ...c.certificate, common: 0 },
      }),
    ).toBe(false);
    expect(
      evaluateCurrent(
        { ...c, goals: [{ quantity: "ia", target: labQ(100) }] },
        c.certificate,
      ).kind,
    ).toBe("mismatch");
  });
  it("demonstrates shared-resistor coupling and the ideal independent-branch limit", () => {
    const c: CurrentLevel = {
      ...currentCircuitLevels[6],
      lampA: 4,
      lampB: 8,
      options: { ...currentCircuitLevels[6].options, ballastA: [0, 4, 8] },
    };
    const base = {
      topology: "parallel" as const,
      voltage: 12,
      common: 2,
      ballastA: 0,
      ballastB: 0,
    };
    const before = evaluateCurrent(c, base).readings!,
      after = evaluateCurrent(c, { ...base, ballastA: 4 }).readings!;
    expect(labCompare(after.ia, before.ia)).toBe(-1);
    expect(labCompare(after.ib, before.ib)).toBe(1);
    expect(labCompare(after.busV, before.busV)).toBe(1);
    const a = evaluateCurrent(c, { ...base, common: 0 }).readings!,
      b = evaluateCurrent(c, { ...base, common: 0, ballastA: 4 }).readings!;
    expect(a.ib).toEqual(b.ib);
    expect(labCompare(b.ia, a.ia)).toBe(-1);
  });
  it("does not accept rounded fraction readings or Boolean-gate semantics", () => {
    const c = currentCircuitLevels[9],
      good = evaluateCurrent(c, c.certificate);
    expect(good.readings!.ia).toEqual(labQ(4, 3));
    const approximate = {
      ...c,
      goals: [{ quantity: "ia" as const, target: labQ(1333, 1000) }],
    };
    expect(evaluateCurrent(approximate, c.certificate).kind).toBe("mismatch");
    expect(
      evaluateCurrent(c, { ...c.certificate, topology: "AND" as never }).kind,
    ).toBe("invalid");
  });
  it.each(currentCircuitLevels.map((c, i) => [i + 1, c, i] as const))(
    "replays certificate %i, restores all snapshots, and bounds finite search",
    (_, c, i) => {
      const initial = freeze(createCurrentState(c));
      let state = initial;
      for (const move of currentCircuitSolutions[i])
        state = moveCurrent(c, state, move);
      expect(isCurrentSolved(c, state)).toBe(true);
      expect(moveCurrent(c, state, { part: "measure" })).toBe(state);
      expect(currentHint(c, state)).toContain("测量已通过");
      const answer = solveCurrent(c);
      expect(answer.exhausted).toBe(false);
      expect(answer.nodes).toBeLessThanOrEqual(CURRENT_SEARCH_LIMIT);
      expect(evaluateCurrent(c, answer.settings!).kind).toBe("target");
      while (state.history.length) state = undoCurrent(state);
      expect(state).toEqual(initial);
      expect(undoCurrent(state)).toBe(state);
    },
  );
  it("rejects invalid topology/resistance/voltage, preserves snapshots, and explains finite-search caps", () => {
    const c = currentCircuitLevels[0],
      initial = freeze(createCurrentState(c));
    for (const move of [
      { part: "voltage", value: 999 },
      { part: "common", value: NaN },
      { part: "topology", value: "parallel" },
      { part: "unknown", value: 4 },
      { part: "measure" },
    ] as CurrentMove[])
      expect(moveCurrent(c, initial, move)).toBe(initial);
    expect(validCurrentSettings(c, { ...initial.settings, voltage: 0 })).toBe(
      false,
    );
    expect(validCurrentLevel({ ...c, lampA: 0 })).toBe(false);
    expect(
      validCurrentLevel({ ...c, options: { ...c.options, voltage: [24] } }),
    ).toBe(false);
    expect(
      validCurrentLevel({ ...c, options: { ...c.options, common: [-1] } }),
    ).toBe(false);
    let state = moveCurrent(c, initial, { part: "voltage", value: 3 });
    state = moveCurrent(c, state, { part: "measure" });
    const changed = moveCurrent(c, freeze(state), {
      part: "voltage",
      value: 6,
    });
    expect(changed.tested).toBe(false);
    expect(undoCurrent(changed)).toEqual(state);
    expect(solveCurrent(c, initial, 0)).toEqual({
      settings: null,
      nodes: 0,
      exhausted: true,
    });
    expect(solveCurrent(c, initial, 1).exhausted).toBe(true);
    expect(currentHint(c, initial)).toContain("电源电压");
    expect(currentHint(c, state)).toContain("→");
    expect(currentHint(c, state, 0)).toContain("达到上限");
    expect(
      describeCurrentResult(
        c,
        evaluateCurrent(c, { ...c.certificate, common: 999 }),
      ),
    ).toContain("无效");
  });
});

describe("all 24 rendered certificate replays", () => {
  it.each(parabolicTargetsLevels.map((_, i) => [i + 1, i] as const))(
    "launches ParabolicTargets level %i through real controls exactly once",
    (_, level) => {
      const p = props({ level }),
        view = render(
          <StrictMode>
            <ParabolicTargets {...p} />
          </StrictMode>,
        );
      expect(p.onComplete).not.toHaveBeenCalled();
      for (const move of parabolicTargetsSolutions[level]) {
        expect(pButton(move)).toBeTruthy();
        fireEvent.click(pButton(move));
      }
      expect(
        document.querySelector("[data-parabolic-won=true]"),
      ).not.toBeNull();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("parabolic-height").textContent).not.toContain(
        "等待",
      );
      fireEvent.click(screen.getByTestId("parabolic-launch"));
      view.rerender(
        <StrictMode>
          <ParabolicTargets {...p} paused />
        </StrictMode>,
      );
      view.rerender(
        <StrictMode>
          <ParabolicTargets {...p} />
        </StrictMode>,
      );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    },
  );
  it.each(currentCircuitLevels.map((c, i) => [i + 1, i, c] as const))(
    "measures CurrentCircuitLab level %i through real controls exactly once",
    (_, level, c) => {
      const p = props({ level }),
        view = render(
          <StrictMode>
            <CurrentCircuitLab {...p} />
          </StrictMode>,
        );
      expect(p.onComplete).not.toHaveBeenCalled();
      for (const move of currentCircuitSolutions[level]) {
        expect(cButton(move)).toBeTruthy();
        fireEvent.click(cButton(move));
      }
      expect(document.querySelector("[data-current-won=true]")).not.toBeNull();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        document.querySelectorAll("[data-current-goal][data-matched=true]"),
      ).toHaveLength(c.goals.length);
      expect(
        document
          .querySelector("[data-current-topology]")
          ?.getAttribute("data-current-topology"),
      ).toBe(c.certificate.topology);
      fireEvent.click(screen.getByTestId("current-measure"));
      view.rerender(
        <StrictMode>
          <CurrentCircuitLab {...p} paused />
        </StrictMode>,
      );
      view.rerender(
        <StrictMode>
          <CurrentCircuitLab {...p} />
        </StrictMode>,
      );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    },
  );
});

describe("pause/reset/undo/hints and keyboard lifecycle", () => {
  it("keeps ballistic hints visible and current through edits, measurements, undo, and pause", () => {
    const p = props(),
      view = render(<ParabolicTargets {...p} />);
    expect(screen.getByTestId("parabolic-worked").textContent).toContain(
      "不是本关参数",
    );
    expect(document.querySelector("[data-parabolic-fixed=vx]")?.tagName).toBe(
      "P",
    );
    view.rerender(<ParabolicTargets {...p} hintToken={1} />);
    expect(screen.getByTestId("parabolic-hint").textContent).toContain("先选");
    fireEvent.click(pButton({ part: "vy", value: 2 }));
    expect(screen.getByTestId("parabolic-hint").textContent).toContain("变为");
    fireEvent.click(pButton({ part: "launch" }));
    view.rerender(
      <ParabolicTargets {...p} hintToken={1} paused undoToken={1} />,
    );
    expect(screen.getByTestId("parabolic-hint")).toBeTruthy();
    fireEvent.click(pButton({ part: "vy", value: 3 }));
    expect(pButton({ part: "vy", value: 2 }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    view.rerender(<ParabolicTargets {...p} hintToken={1} undoToken={1} />);
    expect(screen.getByTestId("parabolic-height").textContent).not.toContain(
      "等待",
    );
    view.rerender(<ParabolicTargets {...p} hintToken={1} undoToken={2} />);
    expect(screen.getByTestId("parabolic-height").textContent).toContain(
      "等待",
    );
    expect(screen.getByTestId("parabolic-hint")).toBeTruthy();
    fireEvent.click(pButton({ part: "vy", value: 3 }));
    expect(screen.getByTestId("parabolic-hint").textContent).toContain("满足");
    fireEvent.click(pButton({ part: "launch" }));
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(<ParabolicTargets {...p} hintToken={1} undoToken={3} />);
    expect(document.querySelector("[data-parabolic-won=false]")).not.toBeNull();
    fireEvent.click(pButton({ part: "launch" }));
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <ParabolicTargets {...p} resetToken={1} hintToken={1} undoToken={3} />,
    );
    expect(screen.queryByTestId("parabolic-hint")).toBeNull();
    expect(pButton({ part: "vy", value: 3 }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    for (const move of parabolicTargetsSolutions[0])
      fireEvent.click(pButton(move));
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
  it("keeps circuit hints current, clears stale meters, and restores measurement undo", () => {
    const p = props(),
      view = render(<CurrentCircuitLab {...p} />);
    expect(screen.getByTestId("current-worked").textContent).toContain(
      "不是本关参数",
    );
    expect(
      document.querySelector("[data-current-fixed=topology]")?.tagName,
    ).toBe("P");
    view.rerender(<CurrentCircuitLab {...p} hintToken={1} />);
    fireEvent.click(cButton({ part: "voltage", value: 3 }));
    fireEvent.click(cButton({ part: "measure" }));
    expect(
      document.querySelector("[data-current-reading=ia]")?.textContent,
    ).toContain("1/2 A");
    expect(screen.getByTestId("current-hint").textContent).toContain("→");
    fireEvent.click(cButton({ part: "voltage", value: 9 }));
    expect(
      document.querySelector("[data-current-reading=ia]")?.textContent,
    ).toContain("等待");
    expect(screen.getByTestId("current-hint")).toBeTruthy();
    view.rerender(<CurrentCircuitLab {...p} hintToken={1} undoToken={1} />);
    expect(
      document.querySelector("[data-current-reading=ia]")?.textContent,
    ).toContain("1/2 A");
    view.rerender(
      <CurrentCircuitLab {...p} hintToken={1} undoToken={2} paused />,
    );
    fireEvent.click(cButton({ part: "voltage", value: 6 }));
    expect(
      cButton({ part: "voltage", value: 3 }).getAttribute("aria-pressed"),
    ).toBe("true");
    view.rerender(<CurrentCircuitLab {...p} hintToken={1} undoToken={2} />);
    expect(
      document.querySelector("[data-current-reading=ia]")?.textContent,
    ).toContain("1/2 A");
    fireEvent.click(cButton({ part: "voltage", value: 6 }));
    fireEvent.click(cButton({ part: "measure" }));
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(<CurrentCircuitLab {...p} hintToken={1} undoToken={3} />);
    fireEvent.click(cButton({ part: "measure" }));
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <CurrentCircuitLab {...p} resetToken={1} hintToken={1} undoToken={3} />,
    );
    expect(screen.queryByTestId("current-hint")).toBeNull();
    expect(
      cButton({ part: "voltage", value: 6 }).getAttribute("aria-pressed"),
    ).toBe("false");
    for (const move of currentCircuitSolutions[0])
      fireEvent.click(cButton(move));
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
  it("consumes paused hint/undo tokens without a deferred action in either game", () => {
    for (const Component of [ParabolicTargets, CurrentCircuitLab]) {
      const p = props({ paused: true }),
        view = render(<Component {...p} />);
      view.rerender(<Component {...p} hintToken={1} undoToken={1} />);
      view.rerender(
        <Component {...p} paused={false} hintToken={1} undoToken={1} />,
      );
      expect(screen.queryByTestId("parabolic-hint")).toBeNull();
      expect(screen.queryByTestId("current-hint")).toBeNull();
      expect(p.onComplete).not.toHaveBeenCalled();
      view.unmount();
    }
  });
  it("supports native keyboard-only choices and resets when switching level", async () => {
    const user = userEvent.setup(),
      p = props(),
      ballistic = render(<ParabolicTargets {...p} />);
    pButton({ part: "vy", value: 3 }).focus();
    await user.keyboard("{Enter}");
    screen.getByTestId("parabolic-launch").focus();
    await user.keyboard(" ");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    ballistic.rerender(<ParabolicTargets {...p} level={11} />);
    expect(screen.queryByTestId("parabolic-worked")).toBeNull();
    expect(document.querySelector("[data-parabolic-won=false]")).not.toBeNull();
    expect(
      screen.getByTestId("parabolic-launch").hasAttribute("disabled"),
    ).toBe(true);
    ballistic.unmount();
    const circuit = render(<CurrentCircuitLab {...p} />);
    cButton({ part: "voltage", value: 6 }).focus();
    await user.keyboard(" ");
    screen.getByTestId("current-measure").focus();
    await user.keyboard("{Enter}");
    expect(p.onComplete).toHaveBeenCalledTimes(2);
    circuit.rerender(<CurrentCircuitLab {...p} level={11} />);
    expect(screen.queryByTestId("current-worked")).toBeNull();
    expect(screen.getByTestId("current-unwired")).toBeTruthy();
    expect(document.querySelector("[data-current-won=false]")).not.toBeNull();
  });
});

describe("teaching review regressions", () => {
  it("explains the single-lamp series-resistor mechanism without calling it parallel", () => {
    const c = currentCircuitLevels[1];
    const state = moveCurrent(c, createCurrentState(c), {
      part: "ballastA",
      value: 0,
    });
    const hint = currentHint(c, state);
    expect(hint).toContain("单灯回路");
    expect(hint).toContain("分走");
    expect(hint).not.toContain("每条并联支路");
  });
  it("retains a ballistic measurement and its settings while changing the next experiment", () => {
    const p = props(),
      view = render(<ParabolicTargets {...p} />);
    fireEvent.click(pButton({ part: "vy", value: 2 }));
    fireEvent.click(pButton({ part: "launch" }));
    fireEvent.click(pButton({ part: "vy", value: 3 }));
    expect(
      screen.getByTestId("parabolic-previous-trial").textContent,
    ).toContain("竖直速度 2 m/s");
    expect(screen.getByTestId("parabolic-height").textContent).toBe("等待发射");
    view.rerender(<ParabolicTargets {...p} resetToken={1} />);
    expect(screen.queryByTestId("parabolic-previous-trial")).toBeNull();
  });
  it("retains the measured circuit separately from newly chosen settings", () => {
    const p = props(),
      view = render(<CurrentCircuitLab {...p} />);
    fireEvent.click(cButton({ part: "voltage", value: 3 }));
    fireEvent.click(cButton({ part: "measure" }));
    fireEvent.click(cButton({ part: "voltage", value: 6 }));
    expect(screen.getByTestId("current-previous-trial").textContent).toContain(
      "3 V",
    );
    view.rerender(<CurrentCircuitLab {...p} resetToken={1} />);
    expect(screen.queryByTestId("current-previous-trial")).toBeNull();
  });
});
