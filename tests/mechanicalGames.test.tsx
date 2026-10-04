// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GameProps } from "../src/lib/types";
import BalanceLab from "../src/games/BalanceLab";
import GearWorks from "../src/games/GearWorks";
import {
  BALANCE_SEARCH_LIMIT,
  balanceHint,
  balanceLevels,
  balanceNextMove,
  balanceSolutions,
  balanceTorque,
  createBalanceState,
  isBalanceSolved,
  moveBalance,
  solveBalance,
  undoBalance,
  validBalancePositions,
  verifyBalanceLevel,
  type BalanceLevel,
  type BalanceMove,
} from "../src/games/balanceLogic";
import {
  GEAR_SEARCH_LIMIT,
  createGearState,
  equalGearFractions,
  formatGearFraction,
  gearDirection,
  gearFraction,
  gearHint,
  gearLevels,
  gearNextMove,
  gearSolutions,
  gearTransmission,
  isGearSolved,
  moveGear,
  multiplyGearFractions,
  solveGears,
  undoGear,
  verifyGearLevel,
  type GearMove,
} from "../src/games/gearLogic";

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
function weight(index: number): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(`[data-weight="${index}"]`)!;
}
function position(value: number): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(
    `[data-position="${value}"]`,
  )!;
}
function gearButton(move: GearMove): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(
    `[data-stage="${move.stage}"][data-part="${move.part}"][data-teeth="${move.teeth}"]`,
  )!;
}
function playBalance(move: BalanceMove) {
  fireEvent.click(weight(move.weight));
  fireEvent.click(
    move.position === null
      ? screen.getByRole("button", { name: "放回托盘" })
      : position(move.position),
  );
}
function deepFreeze<T>(item: T): T {
  if (item && typeof item === "object") {
    Object.freeze(item);
    Object.values(item).forEach(deepFreeze);
  }
  return item;
}

describe("BalanceLab exact mechanics", () => {
  it("certifies 12 distinct levels with increasing breadth", () => {
    expect(balanceLevels).toHaveLength(12);
    expect(
      new Set(
        balanceLevels.map((l) => JSON.stringify([l.arm, l.fixed, l.weights])),
      ).size,
    ).toBe(12);
    expect(balanceLevels[11].weights.length).toBeGreaterThan(
      balanceLevels[0].weights.length,
    );
    balanceLevels.forEach((config) =>
      expect(verifyBalanceLevel(config)).toBe(true),
    );
  });
  it.each(balanceLevels.map((config, index) => [index + 1, config] as const))(
    "certified solution, immutable replay, undo and bounded solver for level %i",
    (_, config) => {
      const initial = deepFreeze(createBalanceState(config));
      let state = initial;
      const levelIndex = balanceLevels.indexOf(config);
      expect(isBalanceSolved(config, state)).toBe(false);
      for (const move of balanceSolutions[levelIndex]) {
        const old = state;
        state = moveBalance(config, state, move);
        expect(state).not.toBe(old);
        expect(validBalancePositions(config, state.positions)).toBe(true);
      }
      expect(isBalanceSolved(config, state)).toBe(true);
      expect(balanceTorque(config, state.positions)).toBe(0);
      expect(state.positions.filter((p) => p !== null)).toHaveLength(
        config.weights.length,
      );
      for (let i = 0; i < config.weights.length; i++)
        state = undoBalance(state);
      expect(state).toEqual(initial);
      expect(undoBalance(state)).toBe(state);
      const result = solveBalance(config);
      expect(result.positions).not.toBeNull();
      expect(result.exhausted).toBe(false);
      expect(result.nodes).toBeLessThan(BALANCE_SEARCH_LIMIT);
      expect(isBalanceSolved(config, { positions: result.positions! })).toBe(
        true,
      );
    },
  );
  it("includes fixed masses and uses signed arms; zero with unused weights is not solved", () => {
    const config = balanceLevels[6];
    const start = createBalanceState(config);
    expect(balanceTorque(config, start.positions)).toBe(0);
    expect(isBalanceSolved(config, start)).toBe(false);
    expect(balanceTorque(config, [-3, 2])).toBe(0);
    expect(balanceTorque(config, [-2, 2])).toBe(2);
    expect(balanceTorque(balanceLevels[0], [null])).toBe(-4);
    expect(balanceTorque(balanceLevels[0], [3])).toBe(2);
  });
  it("rejects occupied/fixed/disallowed/zero/fractional/out-of-range moves without adding history", () => {
    const config = balanceLevels[3];
    const state = moveBalance(config, createBalanceState(config), {
      weight: 0,
      position: 2,
    });
    const bad: BalanceMove[] = [
      { weight: 1, position: 2 },
      { weight: 0, position: 2 },
      { weight: 0, position: -3 },
      { weight: 0, position: 0 },
      { weight: 0, position: 1.5 },
      { weight: 0, position: 100 },
      { weight: -1, position: 1 },
      { weight: 1.5, position: 1 },
      { weight: 99, position: 1 },
    ];
    for (const move of bad)
      expect(moveBalance(config, state, move)).toBe(state);
    const returned = moveBalance(config, state, { weight: 0, position: null });
    expect(returned.positions).toEqual([null, null]);
    expect(undoBalance(returned).positions).toEqual(state.positions);
    expect(validBalancePositions(config, [1])).toBe(false);
    expect(validBalancePositions(config, [1, 1])).toBe(false);
  });
  it("conserves the complete weight inventory across placements and tray returns", () => {
    const config = balanceLevels[11];
    let state = createBalanceState(config);
    for (const move of [
      ...balanceSolutions[11],
      ...config.weights.map((_, weight) => ({ weight, position: null })),
    ]) {
      state = moveBalance(config, state, move);
      expect(state.positions).toHaveLength(config.weights.length);
      const placed = config.weights
        .filter((_, i) => state.positions[i] !== null)
        .reduce((sum, w) => sum + w.mass, 0);
      const inTray = config.weights
        .filter((_, i) => state.positions[i] === null)
        .reduce((sum, w) => sum + w.mass, 0);
      expect(placed + inTray).toBe(
        config.weights.reduce((sum, w) => sum + w.mass, 0),
      );
    }
  });
  it("current-state hints can break occupied-slot cycles using the tray", () => {
    const config: BalanceLevel = {
      title: "cycle",
      arm: 2,
      fixed: [],
      weights: [
        { id: "A", mass: 1, allowed: [-2, 1] },
        { id: "B", mass: 2, allowed: [-2, 1] },
      ],
      solution: [-2, 1],
      idea: "",
    };
    let state = { positions: [1, -2], history: [] };
    const first = balanceNextMove(config, state);
    expect(first?.position).toBeNull();
    expect(balanceHint(config, state)).toContain("托盘");
    let steps = 0;
    while (!isBalanceSolved(config, state) && steps++ < 8) {
      const move = balanceNextMove(config, state);
      expect(move).not.toBeNull();
      state = moveBalance(config, state, move!) as typeof state;
    }
    expect(isBalanceSolved(config, state)).toBe(true);
    expect(balanceNextMove(config, state)).toBeNull();
  });
  it("reports search exhaustion and unsatisfiable levels separately", () => {
    expect(solveBalance(balanceLevels[11], undefined, 0)).toEqual({
      positions: null,
      nodes: 0,
      exhausted: true,
    });
    const impossible = {
      ...balanceLevels[0],
      weights: [{ id: "A", mass: 2, allowed: [1] }],
    };
    const result = solveBalance(impossible);
    expect(result.positions).toBeNull();
    expect(result.exhausted).toBe(false);
    expect(verifyBalanceLevel({ ...balanceLevels[0], solution: [0] })).toBe(
      false,
    );
  });
});

describe("GearWorks exact kinematics", () => {
  it("normalizes rational speeds without decimal error and handles unsafe inputs", () => {
    expect(gearFraction(12, -18)).toEqual({ numerator: -2, denominator: 3 });
    expect(gearFraction(0, -2)).toEqual({ numerator: 0, denominator: 1 });
    expect(
      equalGearFractions(gearFraction(2, 3), { numerator: 4, denominator: 6 }),
    ).toBe(true);
    expect(
      multiplyGearFractions(gearFraction(2, 3), gearFraction(-9, 4)),
    ).toEqual(gearFraction(-3, 2));
    expect(
      multiplyGearFractions(
        gearFraction(Number.MAX_SAFE_INTEGER, 2),
        gearFraction(2, Number.MAX_SAFE_INTEGER),
      ),
    ).toEqual(gearFraction(1));
    expect(formatGearFraction(gearFraction(-3, 2))).toBe("-3/2");
    expect(formatGearFraction(gearFraction(-3, 2), true)).toBe("3/2");
    expect(gearDirection(gearFraction(0))).toBe("静止");
    expect(() => gearFraction(1, 0)).toThrow(RangeError);
    expect(() => gearFraction(1.5)).toThrow(RangeError);
    expect(() =>
      multiplyGearFractions(
        gearFraction(Number.MAX_SAFE_INTEGER),
        gearFraction(2),
      ),
    ).toThrow(RangeError);
  });
  it("one external mesh reverses direction and preserves tangential tooth speed", () => {
    const result = gearTransmission(gearFraction(60), [
      { driver: 20, driven: 30, idler: 0 },
    ])!;
    expect(result.output).toEqual(gearFraction(-40));
    expect(result.meshes).toBe(1);
    const speed = result.stages[0];
    expect(multiplyGearFractions(speed.driver, gearFraction(20))).toEqual(
      multiplyGearFractions(speed.driven, gearFraction(-30)),
    );
  });
  it("idler teeth cancel from the final ratio but change the idler's speed", () => {
    const a = gearTransmission(gearFraction(60), [
      { driver: 12, driven: 24, idler: 12 },
    ])!;
    const b = gearTransmission(gearFraction(60), [
      { driver: 12, driven: 24, idler: 20 },
    ])!;
    expect(a.output).toEqual(gearFraction(30));
    expect(b.output).toEqual(a.output);
    expect(a.stages[0].idler).toEqual(gearFraction(-60));
    expect(b.stages[0].idler).toEqual(gearFraction(-36));
    expect(a.meshes).toBe(2);
    expect(
      multiplyGearFractions(b.stages[0].idler!, gearFraction(-20)),
    ).toEqual(multiplyGearFractions(b.output, gearFraction(24)));
  });
  it("compound stages explicitly share angular speed and multiply independent ratios", () => {
    const result = gearTransmission(gearFraction(60), [
      { driver: 12, driven: 24, idler: 0 },
      { driver: 12, driven: 36, idler: 0 },
    ])!;
    expect(result.stages[0].driven).toEqual(result.stages[1].driver);
    expect(result.output).toEqual(gearFraction(10));
    expect(result.meshes).toBe(2);
    const third = gearTransmission(gearFraction(60), [
      { driver: 12, driven: 24, idler: 0 },
      { driver: 12, driven: 36, idler: 0 },
      { driver: 12, driven: 24, idler: 0 },
    ])!;
    expect(third.output).toEqual(gearFraction(-5));
    expect(third.meshes).toBe(3);
  });
  it("certifies 12 distinct configurations", () => {
    expect(gearLevels).toHaveLength(12);
    expect(
      new Set(
        gearLevels.map((l) => JSON.stringify([l.input, l.target, l.stages])),
      ).size,
    ).toBe(12);
    gearLevels.forEach((config) => expect(verifyGearLevel(config)).toBe(true));
    expect(gearLevels[11].stages).toHaveLength(3);
  });
  it.each(gearLevels.map((config, index) => [index + 1, config] as const))(
    "replays certified level %i with exact direction, undo, current hints and bounded solver",
    (_, config) => {
      const initial = deepFreeze(createGearState(config));
      let state = initial;
      for (const move of gearSolutions[gearLevels.indexOf(config)])
        state = moveGear(config, state, move);
      expect(isGearSolved(config, state)).toBe(true);
      const transmission = gearTransmission(config.input, state.settings)!;
      expect(Math.sign(transmission.output.numerator)).toBe(
        transmission.meshes % 2 ? -1 : 1,
      );
      expect(gearNextMove(config, state)).toBeNull();
      expect(gearHint(config, state)).toContain("匹配");
      while (state.history.length) state = undoGear(state);
      expect(state).toEqual(initial);
      expect(undoGear(state)).toBe(state);
      const solved = solveGears(config);
      expect(solved.settings).not.toBeNull();
      expect(solved.exhausted).toBe(false);
      expect(solved.nodes).toBeLessThan(GEAR_SEARCH_LIMIT);
      expect(isGearSolved(config, { settings: solved.settings! })).toBe(true);
    },
  );
  it("rejects invalid teeth, fixed-part edits, malformed speeds and unsupported moves", () => {
    const config = gearLevels[0],
      initial = createGearState(config);
    for (const move of [
      { stage: 0, part: "driver", teeth: 24 },
      { stage: 0, part: "driven", teeth: 0 },
      { stage: 0, part: "driven", teeth: -12 },
      { stage: 0, part: "driven", teeth: 12.5 },
      { stage: -1, part: "driven", teeth: 24 },
      { stage: 0.5, part: "driven", teeth: 24 },
      { stage: 5, part: "driven", teeth: 24 },
      { stage: 0, part: "missing", teeth: 24 },
    ] as GearMove[])
      expect(moveGear(config, initial, move)).toBe(initial);
    expect(gearTransmission(gearFraction(60), initial.settings)).toBeNull();
    for (const setting of [
      { driver: 0, driven: 12, idler: 0 },
      { driver: 12, driven: -1, idler: 0 },
      { driver: 12, driven: 20, idler: -1 },
      { driver: 12.5, driven: 20, idler: 0 },
    ])
      expect(gearTransmission(gearFraction(60), [setting])).toBeNull();
    expect(gearTransmission({ numerator: 1, denominator: 0 }, [])).toBeNull();
    expect(
      gearTransmission(gearFraction(Number.MAX_SAFE_INTEGER), [
        { driver: 24, driven: 12, idler: 0 },
      ]),
    ).toBeNull();
    expect(solveGears(config, initial, 0)).toEqual({
      settings: null,
      nodes: 0,
      exhausted: true,
    });
  });
  it("gives legal current-state corrections after a wrong completed assembly", () => {
    const config = gearLevels[8];
    let state = createGearState(config);
    config.stages.forEach((s, stage) =>
      (["driver", "driven", "idler"] as const).forEach((part) => {
        state = moveGear(config, state, { stage, part, teeth: s[part][0] });
      }),
    );
    let steps = 0;
    while (!isGearSolved(config, state) && steps++ < 12) {
      const move = gearNextMove(config, state)!;
      expect(move).not.toBeNull();
      expect(gearHint(config, state)).toContain(`第 ${move.stage + 1} 级`);
      const next = moveGear(config, state, move);
      expect(next).not.toBe(state);
      state = next;
    }
    expect(isGearSolved(config, state)).toBe(true);
  });
});

describe("mechanical game semantic controls", () => {
  it.each(balanceLevels.map((_, index) => index))(
    "plays BalanceLab level %i through the buttons",
    (level) => {
      const p = props({ level });
      render(<BalanceLab {...p} />);
      balanceSolutions[level].forEach(playBalance);
      expect(screen.getByTestId("balance-torque").textContent).toBe("0");
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        document.querySelectorAll(".balance-rack button:not(:disabled)").length,
      ).toBe(0);
    },
  );
  it.each(gearLevels.map((_, index) => index))(
    "plays GearWorks level %i through the buttons",
    (level) => {
      const p = props({ level });
      render(<GearWorks {...p} />);
      gearSolutions[level].forEach((move) => fireEvent.click(gearButton(move)));
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("gear-output").textContent).toContain(
        formatGearFraction(gearLevels[level].target, true),
      );
    },
  );
  it("BalanceLab pauses, ignores paused actions, undoes, resets, and clears selection", () => {
    const p = props();
    const view = render(<BalanceLab {...p} />);
    playBalance({ weight: 0, position: 1 });
    expect(screen.getByTestId("balance-torque").textContent).toBe("-2");
    view.rerender(<BalanceLab {...p} paused undoToken={1} hintToken={1} />);
    fireEvent.click(weight(0));
    fireEvent.click(position(2));
    expect(screen.getByTestId("balance-torque").textContent).toBe("-2");
    view.rerender(<BalanceLab {...p} undoToken={1} hintToken={1} />);
    expect(screen.getByTestId("balance-torque").textContent).toBe("-2");
    view.rerender(<BalanceLab {...p} undoToken={2} hintToken={1} />);
    expect(screen.getByTestId("balance-torque").textContent).toBe("-4");
    fireEvent.click(weight(0));
    view.rerender(
      <BalanceLab {...p} resetToken={1} undoToken={2} hintToken={1} />,
    );
    expect(weight(0).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("balance-torque").textContent).toBe("-4");
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("GearWorks pauses, undoes, resets, and keeps fixed choices immutable", () => {
    const p = props();
    const view = render(<GearWorks {...p} />);
    fireEvent.click(gearButton({ stage: 0, part: "driven", teeth: 24 }));
    expect(screen.getByTestId("gear-output").textContent).toContain("30");
    view.rerender(<GearWorks {...p} paused undoToken={1} hintToken={1} />);
    fireEvent.click(gearButton({ stage: 0, part: "driven", teeth: 12 }));
    expect(screen.getByTestId("gear-output").textContent).toContain("30");
    view.rerender(<GearWorks {...p} undoToken={1} hintToken={1} />);
    expect(screen.getByTestId("gear-output").textContent).toContain("30");
    view.rerender(<GearWorks {...p} undoToken={2} hintToken={1} />);
    expect(screen.getByTestId("gear-output").textContent).toContain("?");
    fireEvent.click(gearButton({ stage: 0, part: "driven", teeth: 24 }));
    view.rerender(
      <GearWorks {...p} resetToken={1} undoToken={2} hintToken={1} />,
    );
    expect(screen.getByTestId("gear-output").textContent).toContain("?");
    expect(gearButton({ stage: 0, part: "driver", teeth: 12 }).disabled).toBe(
      true,
    );
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("hints use the current board, highlight a legal action and never solve for the player", () => {
    const p = props();
    const view = render(<BalanceLab {...p} />);
    playBalance({ weight: 0, position: 1 });
    view.rerender(<BalanceLab {...p} hintToken={1} />);
    expect(p.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("右 2 格"),
    );
    expect(position(2).classList.contains("hinted")).toBe(true);
    expect(weight(0).getAttribute("aria-pressed")).toBe("true");
    expect(p.onComplete).not.toHaveBeenCalled();
    cleanup();
    const q = props();
    const gears = render(<GearWorks {...q} />);
    fireEvent.click(gearButton({ stage: 0, part: "driven", teeth: 24 }));
    gears.rerender(<GearWorks {...q} hintToken={1} />);
    expect(p.onComplete).not.toHaveBeenCalled();
    expect(q.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("12 齿"),
    );
    expect(
      gearButton({ stage: 0, part: "driven", teeth: 12 }).classList.contains(
        "hinted",
      ),
    ).toBe(true);
  });
  it("supports keyboard-only selection and placement without drag or canvas interaction", async () => {
    const user = userEvent.setup();
    const p = props();
    render(<BalanceLab {...p} />);
    weight(0).focus();
    await user.keyboard("{Enter}");
    position(2).focus();
    await user.keyboard(" ");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    cleanup();
    const q = props();
    render(<GearWorks {...q} />);
    gearButton({ stage: 0, part: "driven", teeth: 12 }).focus();
    await user.keyboard("{Enter}");
    expect(q.onComplete).toHaveBeenCalledTimes(1);
  });
  it("completion stays idempotent in StrictMode and token rerenders", () => {
    const p = props();
    const view = render(
      <StrictMode>
        <BalanceLab {...p} />
      </StrictMode>,
    );
    playBalance(balanceSolutions[0][0]);
    view.rerender(
      <StrictMode>
        <BalanceLab {...p} hintToken={1} />
      </StrictMode>,
    );
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <BalanceLab {...p} resetToken={1} />
      </StrictMode>,
    );
    playBalance(balanceSolutions[0][0]);
    expect(p.onComplete).toHaveBeenCalledTimes(2);
    cleanup();
    const q = props();
    const gears = render(
      <StrictMode>
        <GearWorks {...q} />
      </StrictMode>,
    );
    fireEvent.click(gearButton(gearSolutions[0][0]));
    gears.rerender(
      <StrictMode>
        <GearWorks {...q} hintToken={1} />
      </StrictMode>,
    );
    expect(q.onComplete).toHaveBeenCalledTimes(1);
  });
  it("level changes reset state without replaying old tokens", () => {
    const p = props({ hintToken: 7, undoToken: 8 });
    const view = render(<BalanceLab {...p} />);
    playBalance({ weight: 0, position: 1 });
    view.rerender(<BalanceLab {...p} level={1} />);
    expect(screen.getByTestId("balance-torque").textContent).toBe("-6");
    expect(weight(0).getAttribute("aria-pressed")).toBe("false");
    cleanup();
    const q = props({ hintToken: 7, undoToken: 8 });
    const gears = render(<GearWorks {...q} />);
    fireEvent.click(gearButton({ stage: 0, part: "driven", teeth: 24 }));
    gears.rerender(<GearWorks {...q} level={1} />);
    expect(screen.getByTestId("gear-output").textContent).toContain("?");
    expect(q.onComplete).not.toHaveBeenCalled();
  });
  it("retains accessible gameplay when WebGL is unavailable", () => {
    const p = props();
    render(<BalanceLab {...p} />);
    expect(screen.getByRole("region", { name: "杠杆实验台" })).toBeTruthy();
    expect(document.querySelector(".mechanical-scene canvas")).toBeNull();
    playBalance(balanceSolutions[0][0]);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("current-state solver regression coverage", () => {
  it("finds a legal hint route from 720 deterministically scrambled boards", () => {
    let seed = 42;
    const nextInt = (size: number) => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed % size;
    };
    let balanceMax = 0,
      gearsMax = 0;
    for (const config of balanceLevels)
      for (let sample = 0; sample < 30; sample++) {
        let state = createBalanceState(config);
        for (let j = 0; j < 20; j++) {
          const weight = nextInt(config.weights.length);
          const slots = config.weights[weight].allowed;
          state = moveBalance(config, state, {
            weight,
            position: slots[nextInt(slots.length)],
          });
        }
        const result = solveBalance(config, state);
        balanceMax = Math.max(balanceMax, result.nodes);
        expect(result.exhausted).toBe(false);
        let steps = 0;
        while (!isBalanceSolved(config, state) && steps++ < 30) {
          const move = balanceNextMove(config, state);
          expect(move).not.toBeNull();
          const next = moveBalance(config, state, move!);
          expect(next).not.toBe(state);
          state = next;
        }
        expect(isBalanceSolved(config, state)).toBe(true);
      }
    for (const config of gearLevels)
      for (let sample = 0; sample < 30; sample++) {
        let state = createGearState(config);
        for (let j = 0; j < 20; j++) {
          const stage = nextInt(config.stages.length);
          const part = (["driver", "driven", "idler"] as const)[nextInt(3)];
          const options = config.stages[stage][part];
          state = moveGear(config, state, {
            stage,
            part,
            teeth: options[nextInt(options.length)],
          });
        }
        const result = solveGears(config, state);
        gearsMax = Math.max(gearsMax, result.nodes);
        expect(result.exhausted).toBe(false);
        let steps = 0;
        while (!isGearSolved(config, state) && steps++ < 30) {
          const move = gearNextMove(config, state);
          expect(move).not.toBeNull();
          const next = moveGear(config, state, move!);
          expect(next).not.toBe(state);
          state = next;
        }
        expect(isGearSolved(config, state)).toBe(true);
      }
    expect(balanceMax).toBeLessThan(1_000);
    expect(gearsMax).toBeLessThan(10_000);
  });
});
