// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import BudgetTown from "../src/games/BudgetTown";
import { budgetTownLevels } from "../src/games/budgetTownLevels";
import {
  BUDGET_TOWN_SEARCH_LIMIT,
  budgetTownCovers,
  budgetTownDistance,
  budgetTownHint,
  budgetTownWon,
  createBudgetTownState,
  evaluateBudgetTown,
  searchBudgetTown,
  toggleBudgetTown,
  undoBudgetTown,
  validBudgetTownLevel,
  validBudgetTownPlan,
  type BudgetTownKind,
  type BudgetTownLevel,
} from "../src/games/budgetTownLogic";

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
// Separate specification: deliberately no production facility record, distance,
// coverage, evaluation or solver calls. Encode a service at (home * 3 + type).
const independentFacilities: Record<
  BudgetTownKind,
  { price: number; blocks: number; supplies: string }
> = {
  g: { price: 3, blocks: 2, supplies: "g" },
  r: { price: 3, blocks: 2, supplies: "r" },
  w: { price: 3, blocks: 2, supplies: "w" },
  G: { price: 5, blocks: 3, supplies: "g" },
  R: { price: 5, blocks: 3, supplies: "r" },
  W: { price: 5, blocks: 3, supplies: "w" },
  gr: { price: 5, blocks: 2, supplies: "gr" },
  gw: { price: 5, blocks: 2, supplies: "gw" },
  rw: { price: 5, blocks: 2, supplies: "rw" },
  all: { price: 7, blocks: 2, supplies: "grw" },
};
function independentCoverage(level: BudgetTownLevel, built: readonly string[]) {
  let price = 0;
  const fulfilled = new Set<string>();
  for (const id of built) {
    const proposal = level.proposals.find((p) => p.id === id)!;
    const facility = independentFacilities[proposal.kind];
    price += facility.price;
    for (const home of level.homes) {
      // Count individual horizontal and vertical street steps, independently.
      let distance = 0;
      for (
        let x = Math.min(home.x, proposal.x);
        x < Math.max(home.x, proposal.x);
        x++
      )
        distance++;
      for (
        let y = Math.min(home.y, proposal.y);
        y < Math.max(home.y, proposal.y);
        y++
      )
        distance++;
      if (distance <= facility.blocks)
        for (const service of home.needs)
          if (facility.supplies.includes(service))
            fulfilled.add(`${home.id}:${service}`);
    }
  }
  const needs = level.homes.flatMap((home) =>
    home.needs.map((service) => `${home.id}:${service}`),
  );
  return {
    price,
    covered: fulfilled.size,
    won: price <= level.budget && needs.every((need) => fulfilled.has(need)),
  };
}
function independentOracle(level: BudgetTownLevel) {
  const coverage = level.proposals.map((proposal) => {
    const facility = independentFacilities[proposal.kind];
    let mask = 0;
    level.homes.forEach((home, homeIndex) => {
      const dx = Math.max(home.x, proposal.x) - Math.min(home.x, proposal.x);
      const dy = Math.max(home.y, proposal.y) - Math.min(home.y, proposal.y);
      if (dx + dy <= facility.blocks)
        for (const service of home.needs)
          if (facility.supplies.includes(service))
            mask |= 1 << (homeIndex * 3 + "grw".indexOf(service));
    });
    return mask;
  });
  const required = level.homes.reduce(
    (mask, home, index) =>
      home.needs.reduce(
        (next, service) => next | (1 << (index * 3 + "grw".indexOf(service))),
        mask,
      ),
    0,
  );
  const solutions: string[][] = [];
  let minimum = Infinity,
    optimal = 0;
  // Recursion differs from production's DP subset recurrence.
  function visit(
    index: number,
    cost: number,
    reached: number,
    chosen: string[],
  ) {
    if (index === level.proposals.length) {
      if (reached !== required) return;
      if (cost < minimum) {
        minimum = cost;
        optimal = 1;
      } else if (cost === minimum) optimal++;
      if (cost <= level.budget) solutions.push(chosen);
      return;
    }
    visit(index + 1, cost, reached, chosen);
    visit(
      index + 1,
      cost + independentFacilities[level.proposals[index].kind].price,
      reached | coverage[index],
      [...chosen, level.proposals[index].id],
    );
  }
  visit(0, 0, 0, []);
  return { minimum, optimal, solutions, coverage };
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
function clickProposal(container: HTMLElement, id: string) {
  fireEvent.click(
    container.querySelector(`[data-budget-town-proposal="${id}"]`)!,
  );
  fireEvent.click(
    container.querySelector(`[data-budget-town-toggle="${id}"]`)!,
  );
}
function currentBuilt(container: HTMLElement) {
  return container
    .querySelector("[data-budget-town-game]")!
    .getAttribute("data-budget-town-built")!
    .split(",")
    .filter(Boolean);
}
const oracles = budgetTownLevels.map(independentOracle);

describe("BudgetTown authored coverage puzzles and independent certificates", () => {
  it("has twelve valid distinct authored maps with tight budgets and useful alternatives", () => {
    expect(budgetTownLevels).toHaveLength(12);
    expect(
      new Set(
        budgetTownLevels.map((level) =>
          JSON.stringify([level.homes, level.proposals]),
        ),
      ).size,
    ).toBe(12);
    for (const [index, level] of budgetTownLevels.entries()) {
      expect(validBudgetTownLevel(level)).toBe(true);
      const oracle = oracles[index];
      expect(oracle.minimum).toBe(level.budget);
      expect(oracle.minimum).toBe(level.certificate.minimumCost);
      expect(oracle.optimal).toBe(level.certificate.optimalPlans);
      expect(oracle.coverage.every((mask) => mask !== 0)).toBe(true);
      expect(independentCoverage(level, level.certificate.built)).toMatchObject(
        { price: level.certificate.cost, won: true },
      );
      expect(oracle.solutions).toContainEqual(level.certificate.built);
      expect(
        independentCoverage(
          level,
          level.proposals.map((p) => p.id),
        ).price,
      ).toBeGreaterThan(level.budget);
      expect(budgetTownWon(level, [])).toBe(false);
      expect(budgetTownWon(level, level.certificate.built)).toBe(true);
      for (const id of level.certificate.built)
        expect(
          budgetTownWon(
            level,
            level.certificate.built.filter((item) => item !== id),
          ),
        ).toBe(false);
    }
    expect(budgetTownLevels[0].certificate.built).toHaveLength(1);
    expect(budgetTownLevels[5].certificate.built.length).toBeGreaterThanOrEqual(
      3,
    );
    expect(
      budgetTownLevels[11].certificate.built.length,
    ).toBeGreaterThanOrEqual(6);
    expect(oracles[11].optimal).toBe(16);
  });
  it("accepts every independently found alternate optimal plan, never certificate identity", () => {
    for (const [index, level] of budgetTownLevels.entries()) {
      const poison = {
        ...level,
        certificate: {
          built: ["not-an-answer"],
          cost: 999,
          minimumCost: 999,
          optimalPlans: 0,
        },
      };
      for (const solution of oracles[index].solutions)
        expect(budgetTownWon(poison, solution)).toBe(true);
      expect(searchBudgetTown(poison, []).status).toBe("found");
    }
  });
  it("agrees with separate rules for sampled subsets including complete but over-budget plans", () => {
    for (const level of budgetTownLevels) {
      for (let sample = 0; sample < 40; sample++) {
        const mask =
          ((sample * 7919 + 31) ^ (sample << 4)) %
          (1 << level.proposals.length);
        const built = level.proposals
          .filter((_, index) => Boolean(mask & (1 << index)))
          .map((p) => p.id);
        const reference = independentCoverage(level, built),
          result = evaluateBudgetTown(level, built);
        expect(result.spent).toBe(reference.price);
        expect(result.covered).toBe(reference.covered);
        expect(result.won).toBe(reference.won);
      }
      const full = evaluateBudgetTown(
        level,
        level.proposals.map((p) => p.id),
      );
      expect(full.covered).toBe(full.required);
      expect(full.remaining).toBeLessThan(0);
      expect(full.won).toBe(false);
    }
  });
  it("uses inclusive Manhattan radius, not diagonal shortcut or any-service coverage", () => {
    const proposal = { id: "A", x: 2, y: 2, kind: "g" as const };
    expect(budgetTownDistance(proposal, { x: 3, y: 3 })).toBe(2);
    expect(
      budgetTownCovers(proposal, { id: "H1", x: 3, y: 3, needs: ["g"] }, "g"),
    ).toBe(true);
    expect(
      budgetTownCovers(proposal, { id: "H2", x: 4, y: 3, needs: ["g"] }, "g"),
    ).toBe(false);
    expect(
      budgetTownCovers(proposal, { id: "H1", x: 2, y: 3, needs: ["r"] }, "r"),
    ).toBe(false);
  });
  it("rejects invalid plans and malformed or oversized maps without search allocation", () => {
    const level = budgetTownLevels[0];
    for (const built of [["missing"], ["A", "A"]]) {
      expect(validBudgetTownPlan(level, built)).toBe(false);
      expect(evaluateBudgetTown(level, built).won).toBe(false);
      expect(searchBudgetTown(level, built).status).toBe("invalid");
    }
    const invalids = [
      { ...level, width: 0 },
      { ...level, budget: -1 },
      { ...level, homes: [] },
      { ...level, proposals: [...level.proposals, level.proposals[0]] },
      {
        ...level,
        proposals: Array.from({ length: 16 }, (_, i) => ({
          ...level.proposals[0],
          id: String(i),
        })),
      },
      { ...level, homes: [{ ...level.homes[0], needs: ["g", "g"] }] },
      { ...level, homes: [{ ...level.homes[0], x: 100 }] },
      {
        ...level,
        homes: [
          {
            ...level.homes[0],
            x: level.proposals[0].x,
            y: level.proposals[0].y,
          },
        ],
      },
    ] as BudgetTownLevel[];
    for (const invalid of invalids) {
      expect(validBudgetTownLevel(invalid)).toBe(false);
      expect(searchBudgetTown(invalid, []).status).toBe("invalid");
    }
  });
  it("preserves immutable snapshots, gives full refunds, and ignores edits after completion", () => {
    const level = deepFreeze(structuredClone(budgetTownLevels[0]));
    let state = deepFreeze(createBudgetTownState());
    const first = level.proposals.find(
      (p) => !level.certificate.built.includes(p.id),
    )!.id;
    state = toggleBudgetTown(level, state, first);
    expect(evaluateBudgetTown(level, state.built).spent).toBeGreaterThan(0);
    const removed = toggleBudgetTown(level, deepFreeze(state), first);
    expect(removed.built).toEqual([]);
    expect(removed.history).toHaveLength(2);
    expect(evaluateBudgetTown(level, removed.built).remaining).toBe(
      level.budget,
    );
    expect(undoBudgetTown(removed).built).toEqual([first]);
    expect(toggleBudgetTown(level, removed, "missing")).toBe(removed);
    const won = toggleBudgetTown(
      level,
      createBudgetTownState(),
      level.certificate.built[0],
    );
    expect(toggleBudgetTown(level, won, first)).toBe(won);
    expect(undoBudgetTown(won).built).toEqual([]);
    const initial = createBudgetTownState();
    expect(undoBudgetTown(initial)).toBe(initial);
  });
});

describe("BudgetTown bounded actual-plan hints", () => {
  it("finds the nearest valid combination from empty, partial, alternate, and over-budget plans", () => {
    for (const [index, level] of budgetTownLevels.entries()) {
      const starts = [
        [],
        level.certificate.built.slice(0, -1),
        level.proposals.slice(0, 3).map((p) => p.id),
        level.proposals.map((p) => p.id),
        oracles[index].solutions.at(-1)!,
      ];
      for (const built of starts) {
        const result = searchBudgetTown(level, built);
        expect(result.visited).toBeLessThanOrEqual(BUDGET_TOWN_SEARCH_LIMIT);
        expect(result.target).not.toBeNull();
        expect(independentCoverage(level, result.target!).won).toBe(true);
        const distance = (solution: string[]) =>
          solution.filter((id) => !built.includes(id)).length +
          built.filter((id) => !solution.includes(id)).length;
        expect(result.edits).toBe(
          Math.min(...oracles[index].solutions.map(distance)),
        );
        if (independentCoverage(level, built).won) {
          expect(result.status).toBe("solved");
          expect(result.next).toBeNull();
        } else {
          expect(result.status).toBe("found");
          expect(result.next).not.toBeNull();
          expect(result.next!.build).toBe(!built.includes(result.next!.id));
          if (built.some((id) => !result.target!.includes(id)))
            expect(result.next!.build).toBe(false);
        }
      }
    }
  });
  it("distinguishes exhausted search from a proven infeasible budget and invalid input", () => {
    const level = budgetTownLevels[11];
    expect(searchBudgetTown(level, [], 1)).toMatchObject({
      status: "limit",
      visited: 1,
      target: null,
    });
    expect(budgetTownHint(level, [], 1).text).toContain("尚不能判断");
    expect(searchBudgetTown({ ...level, budget: 1 }, []).status).toBe(
      "unsolvable",
    );
    expect(searchBudgetTown(level, ["missing"]).status).toBe("invalid");
    expect(searchBudgetTown(budgetTownLevels[0], [], Infinity).status).toBe(
      "found",
    );
  });
  it("successive hints repair a wrong complete over-budget plan, using removals before additions", () => {
    const level = budgetTownLevels[7];
    let built = level.proposals.map((p) => p.id),
      prior = Infinity;
    for (let i = 0; i < 20; i++) {
      const result = budgetTownHint(level, built);
      if (result.status === "solved") break;
      expect(result.status).toBe("found");
      expect(result.edits).toBeLessThan(prior);
      prior = result.edits;
      const next = result.next!;
      built = next.build
        ? [...built, next.id]
        : built.filter((id) => id !== next.id);
    }
    expect(independentCoverage(level, built).won).toBe(true);
  });
});

describe("BudgetTown rendered complete solutions and lifecycle", () => {
  for (const [index, config] of budgetTownLevels.entries())
    it(`replays authored level ${index + 1} using visible selection/build controls`, () => {
      const p = { ...props(), level: index },
        { container } = render(<BudgetTown {...p} />);
      expect(
        container
          .querySelector("[data-budget-town-won]")!
          .getAttribute("data-budget-town-won"),
      ).toBe("false");
      for (const id of config.certificate.built) clickProposal(container, id);
      expect(independentCoverage(config, currentBuilt(container)).won).toBe(
        true,
      );
      expect(
        container
          .querySelector("[data-budget-town-game]")!
          .getAttribute("data-budget-town-won"),
      ).toBe("true");
      expect(
        container.querySelector("[data-budget-town-complete]")!.textContent,
      ).toContain(config.discovery);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        Array.from(container.querySelectorAll("[data-budget-town-home]")),
      ).toHaveLength(config.homes.length);
      for (const home of container.querySelectorAll("[data-budget-town-home]"))
        expect(home.getAttribute("data-missing")).toBe("");
      fireEvent.click(container.querySelector("[data-budget-town-toggle]")!);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    });
  it("accepts a rendered alternative certificate without matching the stored layout", () => {
    const index = 11,
      config = budgetTownLevels[index];
    const alternative = oracles[index].solutions.find(
      (solution) => solution.join() !== config.certificate.built.join(),
    )!;
    const p = { ...props(), level: index },
      { container } = render(<BudgetTown {...p} />);
    for (const id of alternative) clickProposal(container, id);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("shows complete coverage with overspending as failure; hint repairs current selected facilities", () => {
    const p = props(),
      { container, rerender } = render(<BudgetTown {...p} />),
      config = budgetTownLevels[0];
    const wide = config.proposals.find((item) => item.kind === "G")!;
    clickProposal(container, wide.id);
    expect(
      container.querySelector("[data-budget-town-feedback]")!.textContent,
    ).toContain("已超预算 2 币");
    expect(
      container
        .querySelector("[data-budget-town-game]")!
        .getAttribute("data-budget-town-covered"),
    ).toBe("2");
    expect(p.onComplete).not.toHaveBeenCalled();
    rerender(<BudgetTown {...p} hintToken={1} />);
    expect(
      container.querySelector("[data-budget-town-hint]")!.textContent,
    ).toContain(`撤下 ${wide.id}`);
    expect(
      container
        .querySelector("[data-budget-town-selection]")!
        .getAttribute("data-budget-town-selection"),
    ).toBe(wide.id);
    fireEvent.click(container.querySelector("[data-budget-town-toggle]")!);
    expect(currentBuilt(container)).toEqual([]);
    expect(container.querySelector("[data-budget-town-hint]")).toBeNull();
    clickProposal(container, config.certificate.built[0]);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("freezes every action and consumes hint/undo tokens during pause, with no delayed replay", () => {
    const p = props(),
      { container, rerender } = render(<BudgetTown {...p} />),
      config = budgetTownLevels[0];
    const id = config.proposals.find(
      (item) => !config.certificate.built.includes(item.id),
    )!.id;
    clickProposal(container, id);
    rerender(<BudgetTown {...p} paused hintToken={1} undoToken={1} />);
    const map = container.querySelector("[data-budget-town-map]")!;
    fireEvent.keyDown(map, { key: "Enter" });
    fireEvent.click(container.querySelector("[data-budget-town-toggle]")!);
    fireEvent.click(container.querySelector("[data-budget-town-undo]")!);
    expect(currentBuilt(container)).toEqual([id]);
    expect(
      container.querySelector("[data-budget-town-feedback]")!.textContent,
    ).toContain("已暂停");
    rerender(<BudgetTown {...p} hintToken={1} undoToken={1} />);
    expect(currentBuilt(container)).toEqual([id]);
    expect(container.querySelector("[data-budget-town-hint]")).toBeNull();
    rerender(<BudgetTown {...p} hintToken={1} undoToken={2} />);
    expect(currentBuilt(container)).toEqual([]);
  });
  it("keeps the completed plan locked consistently with the shell; reset and level changes clear all state", () => {
    const p = props(),
      { container, rerender } = render(
        <StrictMode>
          <BudgetTown {...p} />
        </StrictMode>,
      ),
      solution = budgetTownLevels[0].certificate.built[0];
    clickProposal(container, solution);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    rerender(
      <StrictMode>
        <BudgetTown {...p} undoToken={1} />
      </StrictMode>,
    );
    expect(currentBuilt(container)).toEqual([solution]);
    expect(
      container.querySelector("[data-budget-town-complete]"),
    ).not.toBeNull();
    expect(
      container.querySelector<HTMLButtonElement>("[data-budget-town-undo]")!
        .disabled,
    ).toBe(true);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    rerender(
      <StrictMode>
        <BudgetTown {...p} resetToken={1} undoToken={1} hintToken={7} />
      </StrictMode>,
    );
    expect(currentBuilt(container)).toEqual([]);
    expect(container.querySelector("[data-budget-town-hint]")).toBeNull();
    clickProposal(container, solution);
    expect(p.onComplete).toHaveBeenCalledTimes(2);
    rerender(
      <StrictMode>
        <BudgetTown
          {...p}
          level={11}
          resetToken={1}
          hintToken={7}
          undoToken={1}
        />
      </StrictMode>,
    );
    expect(currentBuilt(container)).toEqual([]);
    expect(
      container
        .querySelector("[data-budget-town-game]")!
        .getAttribute("data-budget-town-level"),
    ).toBe("11");
    expect(container.querySelector("[data-budget-town-complete]")).toBeNull();
  });
  it("supports keyboard-only planning without repeated, modified, or bubbled double actions", () => {
    const p = props(),
      { container } = render(<BudgetTown {...p} />),
      config = budgetTownLevels[0];
    const map = container.querySelector("[data-budget-town-map]")!,
      button = container.querySelector("[data-budget-town-toggle]")!;
    fireEvent.keyDown(map, { key: "Enter", repeat: true });
    fireEvent.keyDown(map, { key: "Enter", ctrlKey: true });
    fireEvent.keyDown(button, { key: "Enter" });
    expect(currentBuilt(container)).toEqual([]);
    fireEvent.keyDown(map, { key: " " });
    expect(currentBuilt(container)).toEqual([config.proposals[0].id]);
    fireEvent.keyDown(map, { key: " " });
    expect(currentBuilt(container)).toEqual([]);
    const solutionIndex = config.proposals.findIndex(
      (item) => item.id === config.certificate.built[0],
    );
    for (let i = 0; i < solutionIndex; i++)
      fireEvent.keyDown(map, { key: "ArrowRight" });
    fireEvent.keyDown(map, { key: "Enter" });
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(map, { key: "Enter" });
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("has a worked tutorial, persistent rules, service labels, and all reachable native controls", () => {
    const p = props(),
      { container } = render(<BudgetTown {...p} />);
    expect(container.querySelector("details")!.open).toBe(true);
    expect(container.textContent).toContain("横向距离 + 纵向距离");
    expect(container.textContent).toContain("斜对角算 2");
    expect(container.textContent).toContain("不会相互抵消");
    expect(
      container.querySelectorAll("[data-budget-town-proposal]"),
    ).toHaveLength(budgetTownLevels[0].proposals.length);
    for (const control of container.querySelectorAll(
      "[data-budget-town-proposal]",
    ))
      expect(control.getAttribute("aria-label")).toContain("半径");
    expect(
      container
        .querySelector("[data-budget-town-map]")!
        .getAttribute("tabindex"),
    ).toBe("0");
  });
});

it("keeps the winning plan immutable while permitting read-only plot inspection", () => {
  const p = props(),
    { container } = render(<BudgetTown {...p} />),
    level = budgetTownLevels[0];
  clickProposal(container, level.certificate.built[0]);
  const built = currentBuilt(container);
  const other = level.proposals.find(
    (plot) => plot.id !== level.certificate.built[0],
  )!;
  const plot = container.querySelector<HTMLButtonElement>(
    `[data-budget-town-proposal="${other.id}"]`,
  )!;
  expect(plot.disabled).toBe(false);
  fireEvent.click(plot);
  expect(plot.getAttribute("aria-pressed")).toBe("true");
  expect(currentBuilt(container)).toEqual(built);
  expect(
    container.querySelector<HTMLButtonElement>("[data-budget-town-toggle]")!
      .disabled,
  ).toBe(true);
  expect(
    container.querySelector<HTMLButtonElement>("[data-budget-town-undo]")!
      .disabled,
  ).toBe(true);
  expect(p.onComplete).toHaveBeenCalledTimes(1);
});
