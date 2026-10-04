// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EnergyDispatch from "../src/games/EnergyDispatch";
import { energyDispatchLevels } from "../src/games/energyDispatchLevels";
import {
  ENERGY_STATE_LIMIT,
  ENERGY_TRANSITION_LIMIT,
  createEnergyState,
  energyActions,
  energyHint,
  energyPreview,
  energyWon,
  moveEnergy,
  publicEnergy,
  solveEnergy,
  undoEnergy,
  validEnergyLevel,
  type EnergyAction,
  type EnergyBoard,
  type EnergyPublic,
} from "../src/games/energyDispatchLogic";
afterEach(cleanup);
const props = () => ({
  level: 0,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
});
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
// Independent physical bookkeeping. No production transition, action list, DP or certificate.
function independentStep(
  l: EnergyPublic,
  b: EnergyBoard,
  a: EnergyAction,
): EnergyBoard | null {
  if (
    !Number.isInteger(a.generator) ||
    a.generator < 0 ||
    a.generator > l.generatorLimit ||
    !Number.isInteger(a.battery) ||
    a.battery < -l.dischargeLimit ||
    a.battery > l.chargeLimit ||
    b.time >= l.periods.length
  )
    return null;
  let charge = b.charge,
    available = l.periods[b.time].renewable + a.generator;
  if (a.battery > 0) {
    if (a.battery <= l.chargeLoss) return null;
    available -= a.battery;
    charge += a.battery - l.chargeLoss;
  }
  if (a.battery < 0) {
    charge += a.battery;
    available -= a.battery;
  }
  if (charge < 0 || charge > l.capacity || available < l.periods[b.time].demand)
    return null;
  return {
    time: b.time + 1,
    charge,
    cost: b.cost + a.generator * l.periods[b.time].price,
  };
}
function independentActions(l: EnergyPublic): EnergyAction[] {
  const result: EnergyAction[] = [];
  for (let g = 0; g <= l.generatorLimit; g++)
    for (let b = -l.dischargeLimit; b <= l.chargeLimit; b++)
      result.push({ generator: g, battery: b });
  return result;
}
// Forward cost frontier is an independent direction of computation from the production suffix DP.
function forwardMinimum(
  l: EnergyPublic,
  initial: EnergyBoard = { time: 0, charge: l.initial, cost: 0 },
): number {
  let frontier = new Map([[initial.charge, initial.cost]]);
  for (let t = initial.time; t < l.periods.length; t++) {
    const next = new Map<number, number>();
    for (const [charge, cost] of frontier)
      for (const a of independentActions(l)) {
        const b = independentStep(l, { time: t, charge, cost }, a);
        if (b)
          next.set(b.charge, Math.min(next.get(b.charge) ?? Infinity, b.cost));
      }
    frontier = next;
  }
  return Math.min(
    Infinity,
    ...[...frontier].filter(([s]) => s >= l.reserve).map(([, cost]) => cost),
  );
}
// Deliberately no memoization/pruning: exhaustive short-horizon action-sequence oracle.
function brute(l: EnergyPublic, b: EnergyBoard): number {
  if (b.time === l.periods.length)
    return b.charge >= l.reserve ? b.cost : Infinity;
  let best = Infinity;
  for (const a of independentActions(l)) {
    const next = independentStep(l, b, a);
    if (next) best = Math.min(best, brute(l, next));
  }
  return best;
}
function select(container: HTMLElement, a: EnergyAction) {
  fireEvent.click(
    container.querySelector(
      `[data-energy-dispatch-generator="${a.generator}"]`,
    )!,
  );
  fireEvent.click(
    container.querySelector(`[data-energy-dispatch-battery="${a.battery}"]`)!,
  );
}
const commit = (container: HTMLElement) =>
  fireEvent.click(container.querySelector("[data-energy-dispatch-commit]")!);

describe("EnergyDispatch independent conservation and authored certificates", () => {
  it("certifies all twelve distinct visible timelines and exact tight budgets", () => {
    expect(energyDispatchLevels).toHaveLength(12);
    expect(new Set(energyDispatchLevels.map((l) => l.id)).size).toBe(12);
    expect(
      new Set(energyDispatchLevels.map((l) => JSON.stringify(l.periods))).size,
    ).toBe(12);
    expect(energyDispatchLevels.map((l) => l.periods.length)).toEqual([
      3, 4, 4, 5, 5, 6, 7, 8, 8, 10, 11, 12,
    ]);
    energyDispatchLevels.forEach((l) => {
      expect(validEnergyLevel(l)).toBe(true);
      expect(energyActions(l).length).toBeLessThanOrEqual(35);
      let state = createEnergyState(l),
        independent: EnergyBoard = { time: 0, charge: l.initial, cost: 0 };
      expect(l.certificate.actions).toHaveLength(l.periods.length);
      l.certificate.actions.forEach((a, t) => {
        const before = state.board;
        expect(energyWon(l, before)).toBe(false);
        const next = independentStep(l, independent, a);
        expect(next).not.toBeNull();
        independent = next!;
        state = moveEnergy(l, freeze(state), a);
        expect(state.board).toEqual(independent);
        const step = state.history.at(-1)!;
        expect(
          l.periods[t].renewable + a.generator + Math.max(0, -a.battery),
        ).toBe(l.periods[t].demand + Math.max(0, a.battery) + step.spill);
        expect(step.after.charge - step.before.charge).toBe(
          Math.max(0, a.battery) - step.loss - Math.max(0, -a.battery),
        );
        expect(step.loss).toBe(a.battery > 0 ? l.chargeLoss : 0);
        expect(step.spill).toBeGreaterThanOrEqual(0);
        expect(step.after.cost - step.before.cost).toBe(
          a.generator * l.periods[t].price,
        );
      });
      expect(energyWon(l, state.board)).toBe(true);
      expect(state.board.cost).toBe(l.certificate.cost);
      expect(state.board.charge).toBe(l.certificate.finalCharge);
      const minimum = forwardMinimum(l),
        table = solveEnergy(l);
      expect(l.certificate.cost).toBe(minimum);
      expect(table.costs[0][l.initial]).toBe(minimum);
      expect(l.budget - minimum).toBeGreaterThanOrEqual(0);
      expect(l.budget - minimum).toBeLessThanOrEqual(1);
      expect(table.states).toBeLessThanOrEqual(ENERGY_STATE_LIMIT);
      expect(table.transitions).toBeLessThanOrEqual(ENERGY_TRANSITION_LIMIT);
    });
  });
  it("matches independent transitions for every authored period, charge and legal-range action", () => {
    energyDispatchLevels.forEach((l) => {
      for (let time = 0; time < l.periods.length; time++)
        for (let charge = 0; charge <= l.capacity; charge++)
          for (const a of independentActions(l)) {
            const board = { time, charge, cost: 7 },
              expected = independentStep(l, board, a),
              actual = energyPreview(l, board, a);
            expect(actual.valid).toBe(expected !== null);
            if (expected) expect(actual.next).toEqual(expected);
          }
    });
  });
  it("agrees with unmemoized exhaustive short-horizon enumeration at every charge", () => {
    energyDispatchLevels.forEach((l) => {
      const shortened = { ...publicEnergy(l), periods: l.periods.slice(-2) },
        table = solveEnergy(shortened);
      for (let charge = 0; charge <= l.capacity; charge++)
        expect(table.costs[0][charge]).toBe(
          brute(shortened, { time: 0, charge, cost: 0 }),
        );
    });
    const l = energyDispatchLevels[0];
    expect(brute(l, { time: 0, charge: l.initial, cost: 0 })).toBe(
      l.certificate.cost,
    );
  });
  it("makes balance, loss, spill and integer power bounds explicit", () => {
    const l = {
      ...publicEnergy(energyDispatchLevels[5]),
      periods: [
        { renewable: 6, demand: 1, price: 3 },
        { renewable: 0, demand: 0, price: 1 },
      ],
      capacity: 5,
      initial: 1,
    };
    const p = energyPreview(
      l,
      { time: 0, charge: 1, cost: 4 },
      { generator: 1, battery: 3 },
    );
    expect(p).toMatchObject({
      valid: true,
      spill: 3,
      loss: 1,
      supply: 7,
      consumption: 4,
      next: { time: 1, charge: 3, cost: 7 },
    });
    expect(
      energyPreview(
        l,
        { time: 0, charge: 1, cost: 0 },
        { generator: 0, battery: 1 },
      ).valid,
    ).toBe(false);
    expect(
      energyPreview(
        l,
        { time: 0, charge: 1, cost: 0 },
        { generator: 0, battery: -2 },
      ).valid,
    ).toBe(false);
    expect(
      energyPreview(
        l,
        { time: 0, charge: 5, cost: 0 },
        { generator: 0, battery: 2 },
      ).valid,
    ).toBe(false);
    for (const a of [
      { generator: -1, battery: 0 },
      { generator: 5, battery: 0 },
      { generator: 0.5, battery: 0 },
      { generator: 0, battery: 4 },
      { generator: 0, battery: -4 },
      { generator: 0, battery: 1.5 },
    ])
      expect(energyPreview(l, { time: 0, charge: 1, cost: 0 }, a).valid).toBe(
        false,
      );
    expect(
      energyPreview(
        l,
        { time: 99, charge: 1, cost: 0 },
        { generator: 0, battery: 0 },
      ).valid,
    ).toBe(false);
    expect(energyWon(l, { time: 2, charge: 99, cost: 0 })).toBe(false);
    expect(energyWon(l, { time: 2, charge: 4, cost: -1 })).toBe(false);
    expect(validEnergyLevel({ ...l, capacity: 11 })).toBe(false);
    expect(validEnergyLevel({ ...l, chargeLimit: 4 })).toBe(false);
    expect(() =>
      solveEnergy({ ...l, periods: Array(13).fill(l.periods[0]) }),
    ).toThrow();
  });
  it("uses only problem data and the current prefix, even with poisoned certificates", () => {
    energyDispatchLevels.forEach((l) => {
      let state = createEnergyState(l);
      state = moveEnergy(l, state, l.certificate.actions[0]);
      const original = energyHint(publicEnergy(l), state),
        corrupted = {
          ...l,
          certificate: { actions: [], cost: 99999, finalCharge: 99 },
        };
      expect(energyHint(publicEnergy(corrupted), state)).toEqual(original);
      const guarded = {
        ...l,
        get certificate(): typeof l.certificate {
          throw new Error("Certificate accessed");
        },
      };
      expect(energyHint(publicEnergy(guarded), state)).toEqual(original);
      expect(solveEnergy(publicEnergy(guarded))).toEqual(
        solveEnergy(publicEnergy(l)),
      );
      expect(original.minimum).toBe(forwardMinimum(l, state.board));
      expect(original.action).not.toBeNull();
      const next = independentStep(l, state.board, original.action!);
      expect(next).not.toBeNull();
      expect(forwardMinimum(l, next!)).toBe(original.minimum);
    });
  });
  it("explains necessary undo when a prefix misses budget, including final failure", () => {
    const l = energyDispatchLevels[0];
    let state = createEnergyState(l);
    state = moveEnergy(l, state, { generator: 0, battery: 0 });
    let hint = energyHint(l, state);
    expect(hint.action).toBeNull();
    expect(hint.minimum).toBe(11);
    expect(hint.undo).toBe(1);
    expect(hint.text).toContain("至少撤销 1");
    state = moveEnergy(l, state, { generator: 2, battery: 0 });
    hint = energyHint(l, state);
    expect(hint.undo).toBe(2);
    state = moveEnergy(l, state, { generator: 1, battery: 0 });
    expect(energyWon(l, state.board)).toBe(false);
    expect(energyHint(l, state).undo).toBe(3);
    const reserve = { ...publicEnergy(l), reserve: 1 };
    const impossible = energyHint(reserve, state);
    expect(impossible.minimum).toBe(Infinity);
    expect(impossible.text).toContain("最终储备");
  });
  it("preserves immutable history and accepts alternative feasible outcomes", () => {
    const l = energyDispatchLevels[0],
      start = freeze(createEnergyState(l));
    expect(moveEnergy(l, start, { generator: 99, battery: 0 })).toBe(start);
    const next = moveEnergy(l, start, l.certificate.actions[0]);
    expect(start.board).toEqual({ time: 0, charge: 0, cost: 0 });
    expect(start.history).toEqual([]);
    expect(undoEnergy(l, freeze(next))).toEqual(start);
    let alternatives = 0;
    for (const level of energyDispatchLevels) {
      const table = solveEnergy(level);
      let s = createEnergyState(level);
      for (let t = 0; t < level.periods.length; t++) {
        const alternative = energyActions(level).find(
          (a) =>
            JSON.stringify(a) !==
              JSON.stringify(level.certificate.actions[t]) &&
            (() => {
              const n = independentStep(level, s.board, a);
              return n && n.cost + table.costs[t + 1][n.charge] <= level.budget;
            })(),
        );
        if (alternative) {
          s = moveEnergy(level, s, alternative);
          while (s.board.time < level.periods.length)
            s = moveEnergy(
              level,
              s,
              table.choices[s.board.time][s.board.charge]!,
            );
          expect(energyWon(level, s.board)).toBe(true);
          expect(undoEnergy(level, s)).toBe(s);
          expect(moveEnergy(level, s, { generator: 0, battery: 0 })).toBe(s);
          alternatives++;
          break;
        }
        s = moveEnergy(level, s, level.certificate.actions[t]);
      }
    }
    expect(alternatives).toBeGreaterThanOrEqual(3);
  });
  it("gives meaningful alternatives at the start, middle and end of the last level", () => {
    const l = energyDispatchLevels[11];
    let state = createEnergyState(l);
    const checkpoints = [0, 5, 11];
    for (let t = 0; t < l.periods.length; t++) {
      if (checkpoints.includes(t)) {
        const actions = energyActions(l).filter(
          (a) => energyPreview(l, state.board, a).valid,
        );
        expect(actions.length).toBeGreaterThan(1);
        expect(
          new Set(
            actions.map((a) =>
              JSON.stringify(energyPreview(l, state.board, a).next),
            ),
          ).size,
        ).toBeGreaterThan(1);
      }
      state = moveEnergy(l, state, l.certificate.actions[t]);
    }
  });
});

describe("EnergyDispatch rendered complete journeys", () => {
  it.each(energyDispatchLevels.map((l, i) => [i, l] as const))(
    "plays every period of level %i through real controls",
    (index, l) => {
      const p = { ...props(), level: index },
        view = render(<EnergyDispatch {...p} />);
      expect(
        view.container.querySelectorAll("[data-energy-dispatch-period]"),
      ).toHaveLength(l.periods.length);
      l.certificate.actions.forEach((a, t) => {
        select(view.container, a);
        expect(
          (
            view.container.querySelector(
              "[data-energy-dispatch-commit]",
            ) as HTMLButtonElement
          ).disabled,
        ).toBe(false);
        commit(view.container);
        expect(
          view.container
            .querySelector("[data-energy-dispatch-game]")
            ?.getAttribute("data-energy-dispatch-time"),
        ).toBe(String(t + 1));
        if (t < l.periods.length - 1)
          expect(p.onComplete).not.toHaveBeenCalled();
      });
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        view.container.querySelector("[data-energy-dispatch-won=true]"),
      ).not.toBeNull();
      fireEvent.click(
        view.container.querySelector('[data-energy-dispatch-period="0"]')!,
      );
      expect(
        view.container.querySelector("[data-energy-dispatch-inspection]")
          ?.textContent,
      ).toContain("时段 1 · 已执行");
      view.rerender(<EnergyDispatch {...p} undoToken={1} />);
      commit(view.container);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        view.container.querySelector("[data-energy-dispatch-won=true]"),
      ).not.toBeNull();
    },
  );
  it("supports keyboard play and reports completion once per StrictMode round", async () => {
    const user = userEvent.setup(),
      p = props(),
      view = render(
        <StrictMode>
          <EnergyDispatch {...p} />
        </StrictMode>,
      );
    await user.tab();
    for (const a of energyDispatchLevels[0].certificate.actions) {
      // Every new period starts at its first generator, with no manual refocus.
      expect(document.activeElement).toBe(
        view.container.querySelector('[data-energy-dispatch-generator="0"]'),
      );
      const g = view.container.querySelector(
        `[data-energy-dispatch-generator="${a.generator}"]`,
      ) as HTMLButtonElement;
      for (let i = 0; i < a.generator; i++) await user.tab();
      expect(document.activeElement).toBe(g);
      await user.keyboard("{Enter}");
      const b = view.container.querySelector(
        `[data-energy-dispatch-battery="${a.battery}"]`,
      ) as HTMLButtonElement;
      for (let i = 0; document.activeElement !== b && i < 12; i++)
        await user.tab();
      expect(document.activeElement).toBe(b);
      await user.keyboard(" ");
      const c = view.container.querySelector(
        "[data-energy-dispatch-commit]",
      ) as HTMLButtonElement;
      for (let i = 0; document.activeElement !== c && i < 12; i++)
        await user.tab();
      expect(document.activeElement).toBe(c);
      await user.keyboard("{Enter}");
    }
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <EnergyDispatch {...p} resetToken={1} />
      </StrictMode>,
    );
    for (const a of energyDispatchLevels[0].certificate.actions) {
      select(view.container, a);
      commit(view.container);
    }
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
  it("preserves final action values and leaves victory focus to the shell", async () => {
    const user = userEvent.setup(),
      p = props(),
      view = render(
        <>
          <EnergyDispatch {...p} />
          <button>下一关</button>
        </>,
      ),
      advance = view.getByRole("button", { name: "下一关" });
    p.onComplete.mockImplementation(() => advance.focus());
    const actions = energyDispatchLevels[0].certificate.actions;
    for (const a of actions.slice(0, -1)) {
      select(view.container, a);
      commit(view.container);
    }
    const last = actions.at(-1)!;
    select(view.container, last);
    const control = view.container.querySelector(
      "[data-energy-dispatch-commit]",
    ) as HTMLButtonElement;
    control.focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(advance);
    expect(view.container.textContent).toContain("最后时段发电量（只读）");
    expect(view.container.textContent).toContain("最后时段电池动作（只读）");
    expect(
      view.container
        .querySelector(`[data-energy-dispatch-generator="${last.generator}"]`)
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      view.container
        .querySelector(`[data-energy-dispatch-battery="${last.battery}"]`)
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(control.disabled).toBe(true);
    expect(control.textContent).toBe("全部时段已执行");
  });
  it("focuses terminal shortfall instructions only after a focused commit", async () => {
    const user = userEvent.setup(),
      p = props(),
      view = render(<EnergyDispatch {...p} />);
    for (const generator of [0, 2]) {
      select(view.container, { generator, battery: 0 });
      commit(view.container);
    }
    select(view.container, { generator: 1, battery: 0 });
    const control = view.container.querySelector(
      "[data-energy-dispatch-commit]",
    ) as HTMLButtonElement;
    control.focus();
    await user.keyboard("{Enter}");
    const instruction = view.container.querySelector(".ed-instruction");
    expect(document.activeElement).toBe(instruction);
    expect(instruction?.textContent).toContain("费用超过预算");
    expect(p.onComplete).not.toHaveBeenCalled();
    // Tab continues to readable history even though all action controls are locked.
    await user.tab();
    const firstPeriod = view.container.querySelector(
      '[data-energy-dispatch-period="0"]',
    );
    expect(document.activeElement).toBe(firstPeriod);
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(firstPeriod);
    view.rerender(<EnergyDispatch {...p} undoToken={1} />);
    expect(document.activeElement).toBe(firstPeriod);
  });
  it("does not steal unrelated focus for pointer commits, inspection or undo", async () => {
    const user = userEvent.setup(),
      p = props(),
      view = render(<EnergyDispatch {...p} />),
      period = view.container.querySelector(
        '[data-energy-dispatch-period="0"]',
      ) as HTMLButtonElement;
    await user.click(period);
    expect(document.activeElement).toBe(period);
    // Simulate a pointer activation that does not focus its button.
    commit(view.container);
    expect(document.activeElement).toBe(period);
    view.rerender(<EnergyDispatch {...p} undoToken={1} />);
    expect(document.activeElement).toBe(period);
    expect(
      view.container.querySelector('[data-energy-dispatch-time="0"]'),
    ).not.toBeNull();
  });
  it("does not auto-submit hints and invalidates them on edits, pause, reset and level changes", () => {
    const p = props(),
      view = render(<EnergyDispatch {...p} />);
    view.rerender(<EnergyDispatch {...p} hintToken={1} />);
    expect(
      view.container.querySelector("[data-energy-dispatch-hint]"),
    ).not.toBeNull();
    fireEvent.click(
      view.container.querySelector("[data-energy-dispatch-use-hint]")!,
    );
    expect(
      view.container.querySelector('[data-energy-dispatch-time="0"]'),
    ).not.toBeNull();
    expect(
      view.container.querySelector("[data-energy-dispatch-hint]"),
    ).toBeNull();
    view.rerender(<EnergyDispatch {...p} hintToken={2} />);
    fireEvent.click(
      view.container.querySelector('[data-energy-dispatch-generator="1"]')!,
    );
    expect(
      view.container.querySelector("[data-energy-dispatch-hint]"),
    ).toBeNull();
    view.rerender(<EnergyDispatch {...p} hintToken={3} />);
    view.rerender(<EnergyDispatch {...p} hintToken={4} paused />);
    expect(
      view.container.querySelector("[data-energy-dispatch-hint]"),
    ).toBeNull();
    commit(view.container);
    expect(
      view.container.querySelector('[data-energy-dispatch-time="0"]'),
    ).not.toBeNull();
    view.rerender(<EnergyDispatch {...p} hintToken={4} />);
    expect(
      view.container.querySelector("[data-energy-dispatch-hint]"),
    ).toBeNull();
    view.rerender(<EnergyDispatch {...p} hintToken={5} />);
    view.rerender(<EnergyDispatch {...p} hintToken={5} resetToken={1} />);
    expect(
      view.container.querySelector("[data-energy-dispatch-hint]"),
    ).toBeNull();
    view.rerender(<EnergyDispatch {...p} hintToken={6} resetToken={1} />);
    view.rerender(
      <EnergyDispatch {...p} hintToken={6} resetToken={1} level={11} />,
    );
    expect(
      view.container.querySelector("[data-energy-dispatch-hint]"),
    ).toBeNull();
    expect(
      view.container.querySelectorAll("[data-energy-dispatch-period]"),
    ).toHaveLength(12);
  });
  it("undoes a committed step, consumes paused undo tokens and recovers a budget failure", () => {
    const p = props(),
      view = render(<EnergyDispatch {...p} />);
    commit(view.container);
    view.rerender(<EnergyDispatch {...p} hintToken={1} />);
    expect(
      view.container.querySelector("[data-energy-dispatch-hint]")?.textContent,
    ).toContain("至少撤销 1");
    view.rerender(<EnergyDispatch {...p} hintToken={1} undoToken={1} paused />);
    view.rerender(<EnergyDispatch {...p} hintToken={1} undoToken={1} />);
    expect(
      view.container.querySelector('[data-energy-dispatch-time="1"]'),
    ).not.toBeNull();
    view.rerender(<EnergyDispatch {...p} hintToken={1} undoToken={2} />);
    expect(
      view.container.querySelector('[data-energy-dispatch-time="0"]'),
    ).not.toBeNull();
    for (const a of energyDispatchLevels[0].certificate.actions) {
      select(view.container, a);
      commit(view.container);
    }
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("disables infeasible controls, shows terminal shortfalls and preserves readable history", () => {
    const p = props(),
      view = render(<EnergyDispatch {...p} />);
    select(view.container, { generator: 0, battery: -1 });
    expect(
      (
        view.container.querySelector(
          "[data-energy-dispatch-commit]",
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    select(view.container, { generator: 0, battery: 0 });
    commit(view.container);
    select(view.container, { generator: 2, battery: 0 });
    commit(view.container);
    select(view.container, { generator: 1, battery: 0 });
    commit(view.container);
    expect(p.onComplete).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain("费用超过预算");
    view.rerender(<EnergyDispatch {...p} hintToken={1} />);
    expect(
      view.container.querySelector("[data-energy-dispatch-hint]")?.textContent,
    ).toContain("至少撤销 3");
    view.rerender(<EnergyDispatch {...p} hintToken={1} undoToken={1} />);
    expect(
      view.container.querySelector('[data-energy-dispatch-time="2"]'),
    ).not.toBeNull();
  });
});
