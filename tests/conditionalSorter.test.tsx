// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConditionalSorter from "../src/games/ConditionalSorter";
import { conditionalSorterLevels } from "../src/games/conditionalSorterLevels";
import {
  applySortMove,
  createSortState,
  moveSort,
  searchSort,
  SORT_SEARCH_LIMIT,
  sortConditions,
  sortDomain,
  sortHint,
  sortMatches,
  sortWon,
  traceSort,
  undoSort,
  validSortLevel,
  validSortProgram,
  verifySort,
  type SortLevel,
  type SortParcel,
  type SortProgram,
} from "../src/games/conditionalSorterLogic";
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
function independentDomain(level: SortLevel): SortParcel[] {
  const parcels: SortParcel[] = [];
  for (const shape of level.shapes)
    for (const material of level.materials)
      for (const number of level.numbers)
        parcels.push({ shape, material, number });
  return parcels;
}
// Separate condition implementation, not production atoms, masks, trace or search.
function predicate(id: string, p: SortParcel): boolean {
  const checks: Record<string, boolean> = {
    circle: p.shape === "circle",
    square: p.shape === "square",
    triangle: p.shape === "triangle",
    wood: p.material === "wood",
    glass: p.material === "glass",
    metal: p.material === "metal",
    odd: p.number % 2 !== 0,
    even: p.number % 2 === 0,
    high: p.number > 2,
    low: p.number < 3,
    prime:
      p.number > 1 &&
      !Array.from({ length: Math.max(0, p.number - 2) }, (_, i) => i + 2).some(
        (n) => p.number % n === 0,
      ),
  };
  return id.split("-").every((part) => checks[part]);
}
function oracle(program: SortProgram, p: SortParcel): number | null {
  for (const rule of program.rules)
    if (rule.condition && predicate(rule.condition, p)) return rule.bin;
  return program.otherwise;
}
// Direct, independent interpretation of each authored shipping brief.
function goal(index: number, p: SortParcel): number {
  const circle = p.shape === "circle",
    square = p.shape === "square",
    triangle = p.shape === "triangle",
    glass = p.material === "glass",
    metal = p.material === "metal",
    wood = p.material === "wood",
    even = [2, 4, 6].includes(p.number),
    prime = [2, 3, 5].includes(p.number),
    high = p.number > 2;
  return [
    () => (circle ? 0 : 1),
    () => (even ? 1 : 0),
    () => (glass ? 2 : circle ? 0 : 1),
    () => (high ? 1 : square ? 2 : 0),
    () => (circle ? (glass ? 2 : 0) : 1),
    () => (metal ? 2 : !even ? 1 : triangle ? 0 : 3),
    () => (square && even ? 2 : glass ? 1 : square ? 0 : 3),
    () => (prime ? 0 : metal && high ? 2 : circle ? 1 : 3),
    () => (glass && !even ? 3 : triangle ? 2 : even ? 1 : 0),
    () => (circle && glass ? 3 : metal ? 2 : high ? 1 : square ? 0 : 3),
    () => (triangle && prime ? 2 : wood ? 0 : even ? 3 : square ? 1 : 2),
    () => (metal && !even ? 3 : glass && high ? 2 : square ? 1 : prime ? 0 : 2),
  ][index]();
}
function oracleMinimum(level: SortLevel): number {
  const all = independentDomain(level),
    targets = level.targets;
  const memo = new Map<string, number>();
  function solve(indices: number[], left: number): number {
    if (new Set(indices.map((i) => targets[i])).size <= 1) return 0;
    if (!left) return Infinity;
    const key = `${left}:${indices.join(",")}`;
    if (memo.has(key)) return memo.get(key)!;
    let best = Infinity;
    for (const condition of level.conditions) {
      const take = indices.filter((i) => predicate(condition, all[i]));
      if (!take.length || new Set(take.map((i) => targets[i])).size > 1)
        continue;
      const remain = indices.filter((i) => !predicate(condition, all[i]));
      best = Math.min(best, 1 + solve(remain, left - 1));
    }
    memo.set(key, best);
    return best;
  }
  return solve(
    all.map((_, i) => i),
    level.slots,
  );
}
function change(
  container: HTMLElement,
  selector: string,
  value: string | number,
) {
  fireEvent.change(container.querySelector(selector)!, {
    target: { value: String(value) },
  });
}
function fill(
  container: HTMLElement,
  level: SortLevel,
  program = level.solution,
) {
  program.rules.forEach((rule, row) => {
    change(container, `[data-sorter-condition="${row}"]`, rule.condition ?? "");
    if (rule.condition)
      change(container, `[data-sorter-bin="${row}"]`, rule.bin);
  });
  change(container, "[data-sorter-otherwise]", program.otherwise!);
}
const snapshot = (container: HTMLElement) =>
  container
    .querySelector("[data-sorter-game]")!
    .getAttribute("data-sorter-program");
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

describe("ConditionalSorter complete-domain certificates", () => {
  it("has 12 distinct authored tasks with a certified rule-depth progression", () => {
    expect(conditionalSorterLevels).toHaveLength(12);
    expect(new Set(conditionalSorterLevels.map((l) => l.title)).size).toBe(12);
    expect(conditionalSorterLevels.map((l) => l.slots)).toEqual([
      1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4,
    ]);
    conditionalSorterLevels.forEach((level, index) => {
      expect(validSortLevel(level)).toBe(true);
      const domain = independentDomain(level);
      expect(sortDomain(level)).toEqual(domain);
      expect(new Set(domain.map((p) => JSON.stringify(p))).size).toBe(
        domain.length,
      );
      expect(domain.map((p) => goal(index, p))).toEqual(level.targets);
      expect(domain.map((p) => oracle(level.solution, p))).toEqual(
        level.targets,
      );
      expect(oracleMinimum(level)).toBe(level.slots);
      expect(sortWon(level, level.solution)).toBe(true);
      const result = searchSort(level);
      expect(result.status).toBe("found");
      expect(result.visited).toBeLessThanOrEqual(SORT_SEARCH_LIMIT);
      expect(domain.map((p) => oracle(result.program!, p))).toEqual(
        level.targets,
      );
    });
  });
  it("checks every predicate across the complete 54-parcel universe", () => {
    const parcels = independentDomain(conditionalSorterLevels[11]);
    for (const p of parcels)
      for (const c of sortConditions)
        expect(sortMatches(c.id, p)).toBe(predicate(c.id, p));
    expect(sortMatches("unknown", parcels[0])).toBe(false);
  });
  it("uses first match, not last match, and can reveal an overshadowed exception", () => {
    const level = conditionalSorterLevels[2],
      p: SortParcel = { shape: "circle", material: "glass", number: 1 };
    expect(traceSort(level.solution, p)).toEqual({
      bin: 2,
      row: 0,
      checked: [0],
    });
    const wrong = {
      ...level.solution,
      rules: [...level.solution.rules].reverse(),
    };
    expect(traceSort(wrong, p).bin).toBe(0);
    expect(verifySort(level, wrong).passed).toBeLessThan(16);
    expect(sortWon(level, wrong)).toBe(false);
  });
  it("accepts an independently authored alternative and rejects partial/default-less programs", () => {
    const level = conditionalSorterLevels[0];
    const alternative = {
      rules: [{ condition: "square", bin: 1 }],
      otherwise: 0,
    };
    expect(sortWon(level, alternative)).toBe(true);
    expect(sortWon(level, { ...alternative, otherwise: null })).toBe(false);
    expect(sortWon(level, createSortState(level).program)).toBe(false);
    for (const l of conditionalSorterLevels)
      for (let row = 0; row < l.slots; row++) {
        const altered = structuredClone(l.solution);
        altered.rules[row].bin = (altered.rules[row].bin + 1) % l.bins;
        expect(sortWon(l, altered)).toBe(false);
      }
  });
  it("synthesizes valid repairs without reading certificates, including off-path edits", () => {
    for (const source of conditionalSorterLevels) {
      const level = { ...source, solution: { rules: [], otherwise: null } };
      const current = {
        rules: source.solution.rules.map((r, i) => ({
          condition: source.conditions[(i + 1) % source.conditions.length],
          bin: (r.bin + 1) % source.bins,
        })),
        otherwise: 0,
      };
      const result = searchSort(level, current);
      expect(["found", "solved"]).toContain(result.status);
      expect(
        independentDomain(level).map((p) => oracle(result.program!, p)),
      ).toEqual(level.targets);
      let state = {
        program: current as SortProgram,
        history: [] as SortProgram[],
      };
      for (let i = 0; i < 20 && !sortWon(level, state.program); i++) {
        const hint = sortHint(level, state.program);
        expect(hint.move).not.toBeNull();
        const next = moveSort(level, state, hint.move!);
        expect(next).not.toBe(state);
        state = next;
      }
      expect(sortWon(level, state.program)).toBe(true);
    }
  });
  it("distinguishes search budget uncertainty, impossibility, and invalid data", () => {
    const level = conditionalSorterLevels[0];
    expect(searchSort(level, undefined, 0).status).toBe("limit");
    expect(searchSort(level, undefined, 1).status).toBe("limit");
    expect(searchSort({ ...level, conditions: ["wood"] }).status).toBe(
      "unsolvable",
    );
    expect(searchSort({ ...level, targets: [] }).status).toBe("invalid");
    expect(validSortLevel({ ...level, numbers: [1, 7] })).toBe(false);
    expect(
      validSortProgram(level, {
        rules: [{ condition: "bad", bin: 0 }],
        otherwise: 0,
      }),
    ).toBe(false);
    expect(
      validSortProgram(level, {
        rules: [{ condition: null, bin: NaN }],
        otherwise: 0,
      }),
    ).toBe(false);
    expect(searchSort(level, level.solution).status).toBe("solved");
  });
  it("preserves snapshots, guards invalid actions, swaps adjacent whole rules, and undoes victory", () => {
    const level = conditionalSorterLevels[2],
      state = freeze(createSortState(level));
    expect(
      applySortMove(level, state.program, {
        type: "condition",
        row: -1,
        value: "circle",
      }),
    ).toBeNull();
    expect(
      applySortMove(level, state.program, { type: "bin", row: 0, value: 1 }),
    ).toBeNull();
    expect(
      applySortMove(level, state.program, { type: "otherwise", value: 8 }),
    ).toBeNull();
    expect(
      applySortMove(level, state.program, { type: "swap", row: 0, other: 7 }),
    ).toBeNull();
    let next = moveSort(level, state, {
      type: "condition",
      row: 0,
      value: "glass",
    });
    expect(state.history).toHaveLength(0);
    next = moveSort(level, next, { type: "bin", row: 0, value: 2 });
    const swapped = moveSort(level, next, { type: "swap", row: 0, other: 1 });
    expect(swapped.program.rules[1]).toEqual({ condition: "glass", bin: 2 });
    expect(undoSort(swapped).program).toEqual(next.program);
    const beforeWin = {
      program: { ...level.solution, otherwise: null },
      history: [],
    };
    const win = moveSort(level, beforeWin, { type: "otherwise", value: 1 });
    expect(sortWon(level, win.program)).toBe(true);
    expect(moveSort(level, win, { type: "otherwise", value: 0 })).toBe(win);
    expect(undoSort(win).program).toEqual(beforeWin.program);
  });
});

describe("ConditionalSorter rendered replay and lifecycle", () => {
  conditionalSorterLevels.forEach((level, index) =>
    it(`replays every visible select for level ${index + 1}: ${level.title}`, () => {
      const p = props(),
        view = render(<ConditionalSorter {...p} level={index} />);
      expect(
        view.container.querySelectorAll("[data-sorter-test]"),
      ).toHaveLength(level.targets.length);
      fill(view.container, level);
      expect(
        view.container.querySelector("[data-sorter-won=true]"),
      ).not.toBeNull();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      for (const row of view.container.querySelectorAll("[data-sorter-test]"))
        expect(row.getAttribute("data-actual")).toBe(
          row.getAttribute("data-target"),
        );
    }),
  );
  it("renders an alternative solution and native keyboard editing", async () => {
    const user = userEvent.setup(),
      p = props(),
      view = render(<ConditionalSorter {...p} />);
    const condition = view.getByLabelText("规则 1 条件");
    condition.focus();
    expect(document.activeElement).toBe(condition);
    await user.selectOptions(condition, "square");
    await user.selectOptions(view.getByLabelText("规则 1 目的箱"), "1");
    await user.selectOptions(view.getByLabelText("否则目的箱"), "0");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("freezes pause, consumes paused tokens, clears hints, and restores undo", () => {
    const p = props(),
      view = render(<ConditionalSorter {...p} level={2} />);
    change(view.container, '[data-sorter-condition="0"]', "glass");
    const before = snapshot(view.container);
    view.rerender(<ConditionalSorter {...p} level={2} hintToken={1} />);
    expect(view.container.querySelector(".cs-hinted")).not.toBeNull();
    view.rerender(
      <ConditionalSorter {...p} level={2} paused hintToken={2} undoToken={1} />,
    );
    change(view.container, '[data-sorter-condition="0"]', "circle");
    expect(snapshot(view.container)).toBe(before);
    view.rerender(
      <ConditionalSorter {...p} level={2} hintToken={2} undoToken={1} />,
    );
    expect(snapshot(view.container)).toBe(before);
    view.rerender(
      <ConditionalSorter {...p} level={2} hintToken={2} undoToken={2} />,
    );
    expect(JSON.parse(snapshot(view.container)!).rules[0].condition).toBeNull();
    expect(view.container.querySelector(".cs-hinted")).toBeNull();
  });
  it("shows an honest counterexample trace and reverses rule-order changes", () => {
    const p = props(),
      view = render(<ConditionalSorter {...p} level={2} />);
    const wrong = {
      ...conditionalSorterLevels[2].solution,
      rules: [...conditionalSorterLevels[2].solution.rules].reverse(),
    };
    fill(view.container, conditionalSorterLevels[2], wrong);
    expect(p.onComplete).not.toHaveBeenCalled();
    fireEvent.click(
      view.container.querySelector("[data-sorter-counterexample]")!,
    );
    expect(view.getByLabelText("选中包裹的执行过程").textContent).toContain(
      "命中，停止检查",
    );
    fireEvent.click(view.container.querySelector('[data-sorter-down="0"]')!);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(<ConditionalSorter {...p} level={2} undoToken={1} />);
    expect(snapshot(view.container)).toBe(JSON.stringify(wrong));
    fireEvent.click(view.container.querySelector('[data-sorter-down="0"]')!);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("remounts on reset and level change; repeated callbacks and StrictMode cannot duplicate completion", () => {
    const p = props(),
      view = render(
        <StrictMode>
          <ConditionalSorter {...p} />
        </StrictMode>,
      );
    fill(view.container, conditionalSorterLevels[0]);
    view.rerender(
      <StrictMode>
        <ConditionalSorter {...p} hintToken={1} onStatus={vi.fn()} />
      </StrictMode>,
    );
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <ConditionalSorter {...p} resetToken={1} />
      </StrictMode>,
    );
    expect(JSON.parse(snapshot(view.container)!).otherwise).toBeNull();
    fill(view.container, conditionalSorterLevels[0]);
    expect(p.onComplete).toHaveBeenCalledTimes(2);
    view.rerender(
      <StrictMode>
        <ConditionalSorter {...p} level={11} resetToken={1} />
      </StrictMode>,
    );
    expect(view.container.querySelectorAll("[data-sorter-rule]")).toHaveLength(
      4,
    );
    expect(view.container.querySelectorAll("[data-sorter-test]")).toHaveLength(
      54,
    );
    expect(
      JSON.parse(snapshot(view.container)!).rules.every(
        (r: { condition: string | null }) => r.condition === null,
      ),
    ).toBe(true);
  });
  it("does not complete while paused and does not leak answer order into menus", () => {
    const p = props(),
      view = render(<ConditionalSorter {...p} paused />);
    fill(view.container, conditionalSorterLevels[0]);
    expect(p.onComplete).not.toHaveBeenCalled();
    expect(JSON.parse(snapshot(view.container)!).otherwise).toBeNull();
    for (const level of conditionalSorterLevels)
      expect(level.conditions).toEqual(
        sortConditions
          .filter((c) => level.conditions.includes(c.id))
          .map((c) => c.id),
      );
  });
});

it("allows read-only parcel exploration after success without changing the program", () => {
  const p = props(),
    view = render(<ConditionalSorter {...p} />),
    solution = conditionalSorterLevels[0].solution;
  change(
    view.container,
    '[data-sorter-condition="0"]',
    solution.rules[0].condition!,
  );
  change(
    view.container,
    '[data-sorter-bin="0"]',
    String(solution.rules[0].bin),
  );
  change(view.container, "[data-sorter-otherwise]", String(solution.otherwise));
  expect(p.onComplete).toHaveBeenCalledTimes(1);
  const before = snapshot(view.container),
    parcel = view.container.querySelector<HTMLButtonElement>(
      '[data-sorter-parcel="7"]',
    )!;
  expect(parcel.disabled).toBe(false);
  fireEvent.click(parcel);
  expect(parcel.getAttribute("aria-pressed")).toBe("true");
  expect(snapshot(view.container)).toBe(before);
  expect(p.onComplete).toHaveBeenCalledTimes(1);
  view.rerender(<ConditionalSorter {...p} paused />);
  expect(parcel.disabled).toBe(true);
});
