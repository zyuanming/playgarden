// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GameProps } from "../src/lib/types";
import InclineLab from "../src/games/InclineLab";
import BuoyancyDock from "../src/games/BuoyancyDock";
import {
  INCLINE_SEARCH_LIMIT,
  createInclineState,
  describeInclineResult,
  evaluateIncline,
  inclineHint,
  inclineLevels,
  inclineNextMove,
  inclineParts,
  inclineSolutions,
  isInclineSolved,
  moveIncline,
  solveIncline,
  undoIncline,
  validInclineSettings,
  verifyInclineLevel,
  type InclineLevel,
  type InclineMove,
} from "../src/games/inclineLogic";
import {
  BUOYANCY_SEARCH_LIMIT,
  buoyancyHint,
  buoyancyLevels,
  buoyancyNextMove,
  buoyancySolutions,
  createBuoyancyState,
  describeBuoyancyResult,
  evaluateBuoyancy,
  isBuoyancySolved,
  moveBuoyancy,
  solveBuoyancy,
  undoBuoyancy,
  validBuoyancyBoard,
  verifyBuoyancyLevel,
  type BuoyancyLevel,
  type BuoyancyMove,
} from "../src/games/buoyancyLogic";
import {
  comparePhysicsRatios,
  formatPhysicsRatio,
  physicsRatio,
  type PhysicsRatio,
} from "../src/games/motionPhysicsRational";

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
function inclineButton(move: InclineMove): HTMLButtonElement {
  return move.part === "release"
    ? screen.getByTestId("incline-release")
    : document.querySelector(
        `[data-incline-part="${move.part}"][data-value="${move.value}"]`,
      )!;
}
function dockButton(move: BuoyancyMove): HTMLButtonElement {
  return move.kind === "launch"
    ? screen.getByTestId("buoyancy-launch")
    : document.querySelector(
        `[data-dock-kind="${move.kind}"][data-index="${move.index}"]`,
      )!;
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach((v) => deepFreeze(v));
  }
  return value;
}
function crossCompare(n: number, d: number, target: PhysicsRatio): number {
  const left = BigInt(n) * BigInt(target.denominator),
    right = BigInt(d) * BigInt(target.numerator);
  return left < right ? -1 : left > right ? 1 : 0;
}

// Independent oracle uses the unsimplified friction-work and displaced-volume
// equations, not either game's evaluator/solver/certificate validator.
function independentlyCertifyIncline(c: InclineLevel) {
  const s = c.certificate,
    potential = BigInt(s.height) * 100n,
    rampWork = BigInt(s.rampFriction) * BigInt(c.rampRunCm);
  expect(potential > rampWork).toBe(true);
  inclineParts.forEach((part) => expect(c[part]).toContain(s[part]));
  const remaining = Number(potential - rampWork);
  expect(
    crossCompare(remaining, s.brakeFriction, c.targetMinCm),
  ).toBeGreaterThanOrEqual(0);
  expect(
    crossCompare(remaining, s.brakeFriction, c.targetMaxCm),
  ).toBeLessThanOrEqual(0);
}
function independentlyCertifyDock(c: BuoyancyLevel) {
  const board = c.certificate;
  let mass = 0,
    area = 0,
    count = 0;
  c.hulls.forEach((h, i) => {
    if (board.hulls[i]) {
      count++;
      mass += h.massG;
      area += h.areaDm2;
    }
  });
  c.cargo.forEach((load, i) => {
    if (load.required) expect(board.cargo[i]).toBe(true);
    if (board.cargo[i]) mass += load.massG;
  });
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(c.maxHulls);
  // volume(L) = area(dm²) × draft(mm) / 100; displaced grams = rho × volume.
  expect(BigInt(mass) * 100n * BigInt(c.targetDraftMm.denominator)).toBe(
    BigInt(c.densityKgM3) * BigInt(area) * BigInt(c.targetDraftMm.numerator),
  );
  expect(
    BigInt(mass) * 100n <
      BigInt(c.densityKgM3) * BigInt(area) * BigInt(c.hullHeightMm),
  ).toBe(true);
}

describe("exact physics fractions", () => {
  it("normalizes and compares fractions with exact large cross-products", () => {
    expect(physicsRatio(12, -18)).toEqual({ numerator: -2, denominator: 3 });
    expect(physicsRatio(0, 50)).toEqual({ numerator: 0, denominator: 1 });
    expect(formatPhysicsRatio(physicsRatio(100, 3))).toBe("100/3");
    expect(
      comparePhysicsRatios(
        { numerator: Number.MAX_SAFE_INTEGER, denominator: 2 },
        { numerator: Number.MAX_SAFE_INTEGER - 1, denominator: 2 },
      ),
    ).toBe(1);
    expect(() => physicsRatio(1, 0)).toThrow(RangeError);
    expect(() => physicsRatio(1.5)).toThrow(RangeError);
    expect(() =>
      comparePhysicsRatios(physicsRatio(1), { numerator: 1, denominator: 0 }),
    ).toThrow(RangeError);
  });
});

describe("InclineLab exact energy model", () => {
  it("certifies 12 distinct progressive levels with an independent energy oracle", () => {
    expect(inclineLevels).toHaveLength(12);
    expect(
      new Set(
        inclineLevels.map((c) =>
          JSON.stringify([
            c.rampRunCm,
            c.height,
            c.rampFriction,
            c.brakeFriction,
            c.targetMinCm,
          ]),
        ),
      ).size,
    ).toBe(12);
    inclineLevels.forEach((c) => {
      independentlyCertifyIncline(c);
      expect(verifyInclineLevel(c)).toBe(true);
    });
    expect(
      inclineLevels[0].height.length *
        inclineLevels[0].rampFriction.length *
        inclineLevels[0].brakeFriction.length,
    ).toBe(3);
    expect(
      inclineLevels[11].height.length *
        inclineLevels[11].rampFriction.length *
        inclineLevels[11].brakeFriction.length,
    ).toBe(216);
  });
  it("uses ramp horizontal projection, permits zero ramp friction, and respects the start threshold", () => {
    const c: InclineLevel = {
      ...inclineLevels[0],
      height: [20, 30, 40],
      rampFriction: [0, 10, 20, 40],
      brakeFriction: [30, 50],
      targetMinCm: physicsRatio(40),
      targetMaxCm: physicsRatio(40),
    };
    expect(
      evaluateIncline(c, { height: 30, rampFriction: 10, brakeFriction: 50 }),
    ).toMatchObject({
      kind: "target",
      stopCm: physicsRatio(40),
      energyHeightCm: physicsRatio(20),
    });
    expect(
      evaluateIncline(c, { height: 30, rampFriction: 0, brakeFriction: 50 })
        .stopCm,
    ).toEqual(physicsRatio(60));
    expect(
      evaluateIncline(c, { height: 20, rampFriction: 20, brakeFriction: 50 })
        .kind,
    ).toBe("stuck");
    expect(
      evaluateIncline(c, { height: 20, rampFriction: 40, brakeFriction: 50 })
        .kind,
    ).toBe("stuck");
    expect(
      describeInclineResult(
        evaluateIncline(c, { height: 20, rampFriction: 40, brakeFriction: 50 }),
      ),
    ).toContain("未启动");
    expect(
      evaluateIncline(c, { height: 30, rampFriction: 10, brakeFriction: 0 })
        .kind,
    ).toBe("invalid");
  });
  it("compares inclusive and exact fractional targets without rounding", () => {
    const c = {
      ...inclineLevels[0],
      height: [20],
      rampFriction: [10],
      brakeFriction: [30],
      targetMinCm: physicsRatio(100, 3),
      targetMaxCm: physicsRatio(100, 3),
    };
    const settings = { height: 20, rampFriction: 10, brakeFriction: 30 };
    expect(evaluateIncline(c, settings).kind).toBe("target");
    expect(
      evaluateIncline(
        {
          ...c,
          targetMinCm: physicsRatio(33333, 1000),
          targetMaxCm: physicsRatio(33333, 1000),
        },
        settings,
      ).kind,
    ).toBe("long");
    expect(
      evaluateIncline(
        {
          ...c,
          targetMinCm: physicsRatio(33334, 1000),
          targetMaxCm: physicsRatio(33334, 1000),
        },
        settings,
      ).kind,
    ).toBe("short");
  });
  it.each(inclineLevels.map((c, i) => [i + 1, c] as const))(
    "replays certificate %i, conserves energy, reverses all steps, and bounds search",
    (_, c) => {
      const initial = deepFreeze(createInclineState(c));
      let state = initial;
      for (const move of inclineSolutions[inclineLevels.indexOf(c)])
        state = moveIncline(c, state, move);
      expect(isInclineSolved(c, state)).toBe(true);
      const stop = evaluateIncline(c, state.settings).stopCm!;
      const { height: h, rampFriction: r, brakeFriction: b } = c.certificate;
      expect(BigInt(h * 100) * BigInt(stop.denominator)).toBe(
        BigInt(r * c.rampRunCm) * BigInt(stop.denominator) +
          BigInt(b) * BigInt(stop.numerator),
      );
      expect(moveIncline(c, state, { part: "release" })).toBe(state);
      expect(inclineNextMove(c, state)).toBeNull();
      expect(inclineHint(c, state)).toContain("已停");
      while (state.history.length) state = undoIncline(state);
      expect(state).toEqual(initial);
      expect(undoIncline(state)).toBe(state);
      const answer = solveIncline(c);
      expect(answer.exhausted).toBe(false);
      expect(answer.nodes).toBeLessThanOrEqual(INCLINE_SEARCH_LIMIT);
      expect(evaluateIncline(c, answer.settings!).kind).toBe("target");
    },
  );
  it("rejects malformed moves, preserves inputs, clears stale observations and reports capped searches honestly", () => {
    const c = inclineLevels[0],
      state = deepFreeze(createInclineState(c));
    for (const move of [
      { part: "height", value: 999 },
      { part: "height", value: NaN },
      { part: "missing", value: 30 },
      { part: "release" },
    ] as InclineMove[])
      expect(moveIncline(c, state, move)).toBe(state);
    expect(
      validInclineSettings(c, {
        height: 30,
        rampFriction: 9,
        brakeFriction: 50,
      }),
    ).toBe(false);
    const chosen = moveIncline(c, state, { part: "height", value: 20 });
    expect(moveIncline(c, chosen, { part: "height", value: 20 })).toBe(chosen);
    const tested = moveIncline(c, chosen, { part: "release" });
    expect(tested.tested).toBe(true);
    const changed = moveIncline(c, tested, { part: "height", value: 40 });
    expect(changed.tested).toBe(false);
    expect(undoIncline(changed)).toEqual(tested);
    expect(solveIncline(c, undefined, 0)).toEqual({
      settings: null,
      nodes: 0,
      exhausted: true,
    });
    expect(inclineHint(c, state, 0)).toContain("搜索上限");
    const impossible = {
      ...c,
      targetMinCm: physicsRatio(9000),
      targetMaxCm: physicsRatio(9000),
    };
    expect(solveIncline(impossible).exhausted).toBe(false);
    expect(solveIncline(impossible).settings).toBeNull();
    expect(inclineHint(impossible, state)).toContain("没有可行");
    expect(
      verifyInclineLevel({
        ...c,
        certificate: { ...c.certificate, height: 999 },
      }),
    ).toBe(false);
  });
});

describe("BuoyancyDock exact displacement model", () => {
  it("certifies 12 distinct assemblies independently, including payload and positive freeboard", () => {
    expect(buoyancyLevels).toHaveLength(12);
    expect(
      new Set(
        buoyancyLevels.map((c) =>
          JSON.stringify([c.hulls, c.cargo, c.densityKgM3]),
        ),
      ).size,
    ).toBe(12);
    buoyancyLevels.forEach((c) => {
      independentlyCertifyDock(c);
      expect(verifyBuoyancyLevel(c)).toBe(true);
    });
    expect(buoyancyLevels[0].hulls).toHaveLength(2);
    expect(buoyancyLevels[11].hulls).toHaveLength(6);
    expect(buoyancyLevels[11].cargo).toHaveLength(6);
  });
  it("counts hull self-mass, required cargo, density, displacement and all unit conversions", () => {
    const c = buoyancyLevels[0],
      result = evaluateBuoyancy(c, c.certificate);
    expect(result).toMatchObject({
      kind: "target",
      massG: 15000,
      areaDm2: 10,
      draftMm: physicsRatio(150),
      displacedL: physicsRatio(15),
      averageDensityKgM3: physicsRatio(500),
    });
    expect(
      evaluateBuoyancy({ ...c, densityKgM3: 1200 }, c.certificate).draftMm,
    ).toEqual(physicsRatio(125));
    expect(
      evaluateBuoyancy(c, { hulls: [false, true], cargo: [true] }).draftMm,
    ).toEqual(physicsRatio(90));
    expect(
      evaluateBuoyancy(c, { hulls: [true, false], cargo: [false] }).kind,
    ).toBe("missing");
    expect(
      evaluateBuoyancy(c, { hulls: [false, false], cargo: [true] }).kind,
    ).toBe("empty");
  });
  it("distinguishes over-capacity sinking, neutral full submergence and safe freeboard", () => {
    const c: BuoyancyLevel = {
      ...buoyancyLevels[0],
      hulls: [{ id: "A", areaDm2: 10, massG: 10000 }],
      cargo: [{ id: "load", massG: 20000, required: true }],
      certificate: { hulls: [true], cargo: [true] },
    };
    const submerged = evaluateBuoyancy(c, c.certificate);
    expect(submerged.kind).toBe("submerged");
    expect(submerged.draftMm).toEqual(physicsRatio(300));
    expect(describeBuoyancyResult(submerged)).toContain("干舷为 0");
    const heavier = { ...c, cargo: [{ ...c.cargo[0], massG: 21000 }] };
    expect(evaluateBuoyancy(heavier, c.certificate).kind).toBe("sunk");
    expect(evaluateBuoyancy(heavier, c.certificate).displacedL).toEqual(
      physicsRatio(31),
    );
    const lighter = {
      ...c,
      cargo: [{ ...c.cargo[0], massG: 19000 }],
      targetDraftMm: physicsRatio(290),
    };
    expect(evaluateBuoyancy(lighter, c.certificate).kind).toBe("target");
  });
  it.each(buoyancyLevels.map((c, i) => [i + 1, c] as const))(
    "replays certificate %i, preserves inventory, fully undoes and bounds search",
    (_, c) => {
      const initial = deepFreeze(createBuoyancyState(c));
      let state = initial;
      for (const move of buoyancySolutions[buoyancyLevels.indexOf(c)]) {
        state = moveBuoyancy(c, state, move);
        expect(state.hulls.length + state.cargo.length).toBe(
          c.hulls.length + c.cargo.length,
        );
      }
      expect(isBuoyancySolved(c, state)).toBe(true);
      expect(moveBuoyancy(c, state, { kind: "launch" })).toBe(state);
      expect(buoyancyNextMove(c, state)).toBeNull();
      expect(buoyancyHint(c, state)).toContain("正干舷");
      while (state.history.length) state = undoBuoyancy(state);
      expect(state).toEqual(initial);
      expect(undoBuoyancy(state)).toBe(state);
      const answer = solveBuoyancy(c);
      expect(answer.exhausted).toBe(false);
      expect(answer.nodes).toBe(2 ** (c.hulls.length + c.cargo.length));
      expect(answer.nodes).toBeLessThanOrEqual(BUOYANCY_SEARCH_LIMIT);
      expect(evaluateBuoyancy(c, answer.board!).kind).toBe("target");
    },
  );
  it("guards capacity and invalid moves, clears stale launch results, separates impossible from capped search", () => {
    const c = buoyancyLevels[0],
      state = deepFreeze(createBuoyancyState(c));
    for (const move of [
      { kind: "hull", index: -1 },
      { kind: "hull", index: 0.5 },
      { kind: "hull", index: 90 },
      { kind: "cargo", index: NaN },
      { kind: "other", index: 0 },
      { kind: "launch" },
    ] as BuoyancyMove[])
      expect(moveBuoyancy(c, state, move)).toBe(state);
    const withHull = moveBuoyancy(c, state, { kind: "hull", index: 0 });
    expect(moveBuoyancy(c, withHull, { kind: "hull", index: 1 })).toBe(
      withHull,
    );
    expect(validBuoyancyBoard(c, { hulls: [true, true], cargo: [false] })).toBe(
      false,
    );
    expect(validBuoyancyBoard(c, { hulls: [true], cargo: [false] })).toBe(
      false,
    );
    const tested = moveBuoyancy(c, withHull, { kind: "launch" }),
      changed = moveBuoyancy(c, tested, { kind: "cargo", index: 0 });
    expect(changed.tested).toBe(false);
    expect(undoBuoyancy(changed)).toEqual(tested);
    expect(solveBuoyancy(c, state, 0)).toEqual({
      board: null,
      nodes: 0,
      exhausted: true,
    });
    expect(buoyancyHint(c, state, 0)).toContain("搜索上限");
    const impossible = { ...c, targetDraftMm: physicsRatio(1) };
    expect(solveBuoyancy(impossible).board).toBeNull();
    expect(solveBuoyancy(impossible).exhausted).toBe(false);
    expect(buoyancyHint(impossible, state)).toContain("没有可行");
    expect(
      verifyBuoyancyLevel({
        ...c,
        certificate: { hulls: [false, false], cargo: [true] },
      }),
    ).toBe(false);
  });
});

describe("bounded hints from arbitrary current experiments", () => {
  it("corrects all 24 games from wrong, complete and capacity-full boards without resets", () => {
    let seed = 419;
    const rand = (size: number) => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed % size;
    };
    for (const c of inclineLevels)
      for (let sample = 0; sample < 4; sample++) {
        let state = createInclineState(c);
        for (let n = 0; n < 12; n++) {
          const part = inclineParts[rand(3)];
          state = moveIncline(c, state, {
            part,
            value: c[part][rand(c[part].length)],
          });
        }
        state = moveIncline(c, state, { part: "release" });
        let steps = 0;
        while (!isInclineSolved(c, state) && steps++ < 5) {
          const move = inclineNextMove(c, state);
          expect(move).not.toBeNull();
          const next = moveIncline(c, state, move!);
          expect(next).not.toBe(state);
          state = next;
        }
        expect(isInclineSolved(c, state)).toBe(true);
      }
    for (const c of buoyancyLevels)
      for (let sample = 0; sample < 3; sample++) {
        let state = createBuoyancyState(c);
        for (let n = 0; n < 18; n++) {
          const kind = rand(2) ? "hull" : "cargo";
          state = moveBuoyancy(c, state, {
            kind,
            index: rand(kind === "hull" ? c.hulls.length : c.cargo.length),
          });
        }
        state = moveBuoyancy(c, state, { kind: "launch" });
        let steps = 0;
        while (!isBuoyancySolved(c, state) && steps++ < 14) {
          const move = buoyancyNextMove(c, state);
          expect(move).not.toBeNull();
          const next = moveBuoyancy(c, state, move!);
          expect(next).not.toBe(state);
          state = next;
        }
        expect(isBuoyancySolved(c, state)).toBe(true);
      }
  });
});

describe("motion physics accessible controls", () => {
  it.each(inclineLevels.map((_, i) => i))(
    "plays InclineLab level %i using semantic controls",
    (level) => {
      const p = props({ level });
      render(<InclineLab {...p} />);
      inclineSolutions[level].forEach((move) =>
        fireEvent.click(inclineButton(move)),
      );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status").textContent).toContain("正好进入目标");
      expect(
        screen.getByTestId("incline-release").hasAttribute("disabled"),
      ).toBe(true);
    },
  );
  it.each(buoyancyLevels.map((_, i) => i))(
    "plays BuoyancyDock level %i using semantic controls",
    (level) => {
      const p = props({ level });
      render(<BuoyancyDock {...p} />);
      buoyancySolutions[level].forEach((move) =>
        fireEvent.click(dockButton(move)),
      );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status").textContent).toContain("货物齐全");
      expect(
        screen.getByTestId("buoyancy-launch").hasAttribute("disabled"),
      ).toBe(true);
    },
  );
  it("requires explicit release/launch and does not auto-complete a correct plan", () => {
    const p = props();
    const view = render(<InclineLab {...p} />);
    fireEvent.click(inclineButton({ part: "height", value: 30 }));
    expect(p.onComplete).not.toHaveBeenCalled();
    view.rerender(<InclineLab {...p} hintToken={1} />);
    expect(p.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("释放滑车"),
    );
    expect(
      inclineButton({ part: "release" }).classList.contains("mp-hinted"),
    ).toBe(true);
    cleanup();
    const q = props();
    const dock = render(<BuoyancyDock {...q} />);
    fireEvent.click(dockButton({ kind: "hull", index: 0 }));
    fireEvent.click(dockButton({ kind: "cargo", index: 0 }));
    expect(q.onComplete).not.toHaveBeenCalled();
    dock.rerender(<BuoyancyDock {...q} hintToken={1} />);
    expect(q.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("下水验证"),
    );
    expect(dockButton({ kind: "launch" }).classList.contains("mp-hinted")).toBe(
      true,
    );
  });
  it("pauses actions, consumes paused tokens without replay, undoes and resets incline", () => {
    const p = props(),
      view = render(<InclineLab {...p} />);
    fireEvent.click(inclineButton({ part: "height", value: 20 }));
    fireEvent.click(inclineButton({ part: "release" }));
    expect(screen.getByTestId("incline-distance").textContent).toBe("20 cm");
    view.rerender(<InclineLab {...p} paused hintToken={1} undoToken={1} />);
    fireEvent.click(inclineButton({ part: "height", value: 30 }));
    expect(screen.getByTestId("incline-distance").textContent).toBe("20 cm");
    view.rerender(<InclineLab {...p} hintToken={1} undoToken={1} />);
    expect(screen.getByTestId("incline-distance").textContent).toBe("20 cm");
    view.rerender(<InclineLab {...p} hintToken={1} undoToken={2} />);
    expect(screen.getByTestId("incline-distance").textContent).toBe("等待释放");
    view.rerender(<InclineLab {...p} hintToken={2} undoToken={2} />);
    expect(
      inclineButton({ part: "height", value: 30 }).classList.contains(
        "mp-hinted",
      ),
    ).toBe(true);
    view.rerender(
      <InclineLab {...p} resetToken={1} hintToken={2} undoToken={2} />,
    );
    expect(
      inclineButton({ part: "height", value: 20 }).getAttribute("aria-pressed"),
    ).toBe("false");
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("pauses docking, enforces slots, restores launch with undo, and resets cargo", () => {
    const p = props(),
      view = render(<BuoyancyDock {...p} />);
    fireEvent.click(dockButton({ kind: "hull", index: 1 }));
    expect(dockButton({ kind: "hull", index: 0 }).disabled).toBe(true);
    fireEvent.click(dockButton({ kind: "launch" }));
    expect(screen.getByTestId("buoyancy-draft").textContent).toBe("40 mm");
    view.rerender(<BuoyancyDock {...p} paused hintToken={1} undoToken={1} />);
    fireEvent.click(dockButton({ kind: "cargo", index: 0 }));
    expect(screen.getByTestId("buoyancy-mass").textContent).toBe("8 kg");
    view.rerender(<BuoyancyDock {...p} hintToken={1} undoToken={1} />);
    expect(screen.getByTestId("buoyancy-draft").textContent).toBe("40 mm");
    fireEvent.click(dockButton({ kind: "cargo", index: 0 }));
    expect(screen.getByTestId("buoyancy-draft").textContent).toBe("等待下水");
    view.rerender(<BuoyancyDock {...p} hintToken={1} undoToken={2} />);
    expect(screen.getByTestId("buoyancy-draft").textContent).toBe("40 mm");
    view.rerender(<BuoyancyDock {...p} hintToken={2} undoToken={2} />);
    expect(
      dockButton({ kind: "hull", index: 1 }).classList.contains("mp-hinted"),
    ).toBe(true);
    view.rerender(
      <BuoyancyDock {...p} resetToken={1} hintToken={2} undoToken={2} />,
    );
    expect(screen.getByTestId("buoyancy-mass").textContent).toBe("0 kg");
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("plays both introductory experiments with keyboard Enter and Space", async () => {
    const user = userEvent.setup(),
      p = props();
    render(<InclineLab {...p} />);
    inclineButton({ part: "height", value: 30 }).focus();
    await user.keyboard("{Enter}");
    inclineButton({ part: "release" }).focus();
    await user.keyboard(" ");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    cleanup();
    const q = props();
    render(<BuoyancyDock {...q} />);
    dockButton({ kind: "hull", index: 0 }).focus();
    await user.keyboard("{Enter}");
    dockButton({ kind: "cargo", index: 0 }).focus();
    await user.keyboard(" ");
    dockButton({ kind: "launch" }).focus();
    await user.keyboard("{Enter}");
    expect(q.onComplete).toHaveBeenCalledTimes(1);
  });
  it.each(["incline", "dock"])(
    "keeps %s completion idempotent under StrictMode, tokens, undo/replay and reset",
    (name) => {
      const p = props(),
        Game = name === "incline" ? InclineLab : BuoyancyDock;
      const play = () =>
        name === "incline"
          ? inclineSolutions[0].forEach((move) =>
              fireEvent.click(inclineButton(move)),
            )
          : buoyancySolutions[0].forEach((move) =>
              fireEvent.click(dockButton(move)),
            );
      const view = render(
        <StrictMode>
          <Game {...p} />
        </StrictMode>,
      );
      play();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      view.rerender(
        <StrictMode>
          <Game {...p} hintToken={1} />
        </StrictMode>,
      );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      view.rerender(
        <StrictMode>
          <Game {...p} hintToken={1} undoToken={1} />
        </StrictMode>,
      );
      if (name === "incline")
        fireEvent.click(inclineButton({ part: "release" }));
      else fireEvent.click(dockButton({ kind: "launch" }));
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      view.rerender(
        <StrictMode>
          <Game {...p} resetToken={1} />
        </StrictMode>,
      );
      play();
      expect(p.onComplete).toHaveBeenCalledTimes(2);
    },
  );
  it("retains the same SVG across changes, needs no WebGL, and resets on level change", () => {
    const p = props({ hintToken: 4, undoToken: 5 }),
      view = render(<InclineLab {...p} />),
      svg = screen.getByRole("img");
    fireEvent.click(inclineButton({ part: "height", value: 20 }));
    expect(screen.getByRole("img")).toBe(svg);
    expect(document.querySelector("canvas")).toBeNull();
    view.rerender(<InclineLab {...p} level={1} />);
    expect(screen.getByTestId("incline-distance").textContent).toBe("等待释放");
    expect(
      inclineButton({ part: "height", value: 36 }).getAttribute("aria-pressed"),
    ).toBe("false");
    cleanup();
    const q = props({ hintToken: 4, undoToken: 5 }),
      dock = render(<BuoyancyDock {...q} />),
      boat = screen.getByRole("img");
    fireEvent.click(dockButton({ kind: "hull", index: 0 }));
    expect(screen.getByRole("img")).toBe(boat);
    expect(document.querySelector("canvas")).toBeNull();
    dock.rerender(<BuoyancyDock {...q} level={1} />);
    expect(screen.getByTestId("buoyancy-mass").textContent).toBe("0 kg");
    expect(q.onComplete).not.toHaveBeenCalled();
  });
});
