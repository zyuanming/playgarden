// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConcurrentKitchen from "../src/games/ConcurrentKitchen";
import { concurrentKitchenLevels } from "../src/games/concurrentKitchenLevels";
import {
  createKitchenState,
  editKitchen,
  inspectKitchen,
  kitchenHint,
  kitchenWon,
  searchKitchen,
  undoKitchen,
  validKitchenLevel,
  validKitchenSchedule,
  KITCHEN_CHECK_LIMIT,
  KITCHEN_SEARCH_LIMIT,
  type KitchenLevel,
  type KitchenSchedule,
} from "../src/games/concurrentKitchenLogic";
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
const certificate = (level: KitchenLevel): KitchenSchedule =>
  Object.fromEntries(level.solution.map((move) => [move.task, move.start]));
function immutable<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(immutable);
    Object.freeze(value);
  }
  return value;
}
// Independent witness checker: expand intervals into individual occupied slots.
// Does not call the production shape checker, conflict detector, or solver.
function oracleLegal(
  level: KitchenLevel,
  schedule: KitchenSchedule,
  complete = false,
): boolean {
  if (complete && Object.keys(schedule).length !== level.tasks.length)
    return false;
  const used = new Set<string>();
  for (const [id, start] of Object.entries(schedule)) {
    const task = level.tasks.find((item) => item.id === id);
    if (
      !task ||
      !Number.isInteger(start) ||
      start < 0 ||
      start + task.duration > level.deadline
    )
      return false;
    for (let time = start; time < start + task.duration; time++) {
      const key = `${task.station}/${time}`;
      if (used.has(key)) return false;
      used.add(key);
    }
    for (const parent of task.after) {
      if (
        schedule[parent] !== undefined &&
        schedule[parent] +
          level.tasks.find((item) => item.id === parent)!.duration >
          start
      )
        return false;
    }
  }
  return true;
}
function permutations<T>(items: T[]): T[][] {
  if (!items.length) return [[]];
  return items.flatMap((item, i) =>
    permutations(items.filter((_, j) => i !== j)).map((rest) => [
      item,
      ...rest,
    ]),
  );
}
/**
 * Independent exact scheduling oracle: enumerate orders at each station, add
 * those orders as DAG edges, then compute earliest starts topologically.
 * Unlike production this never enumerates start-time domains or runs AC/MRV.
 * Every legal non-preemptive schedule induces one enumerated station order.
 */
function schedulingOracle(
  level: KitchenLevel,
  fixed: KitchenSchedule = {},
): { minimum: number; schedule: KitchenSchedule | null } {
  const orders = ["prep", "oven", "plate"].map((station) =>
    permutations(
      level.tasks
        .filter((task) => task.station === station)
        .map((task) => task.id),
    ),
  );
  let minimum = Infinity,
    witness: KitchenSchedule | null = null;
  for (const prep of orders[0])
    for (const oven of orders[1])
      for (const plate of orders[2]) {
        const parents = Object.fromEntries(
          level.tasks.map((task) => [task.id, [...task.after]]),
        );
        for (const line of [prep, oven, plate])
          for (let i = 1; i < line.length; i++)
            parents[line[i]].push(line[i - 1]);
        const result: KitchenSchedule = {},
          finish: Record<string, number> = {};
        let possible = true;
        while (Object.keys(result).length < level.tasks.length && possible) {
          const task = level.tasks.find(
            (item) =>
              result[item.id] === undefined &&
              parents[item.id].every((id) => finish[id] !== undefined),
          );
          if (!task) {
            possible = false;
            break;
          }
          const earliest = Math.max(
            0,
            ...parents[task.id].map((id) => finish[id]),
          );
          if (fixed[task.id] !== undefined && fixed[task.id] < earliest) {
            possible = false;
            break;
          }
          result[task.id] = fixed[task.id] ?? earliest;
          finish[task.id] = result[task.id] + task.duration;
        }
        if (!possible) continue;
        const end = Math.max(...Object.values(finish));
        if (end < minimum) {
          minimum = end;
          witness = result;
        }
      }
  return { minimum, schedule: minimum <= level.deadline ? witness : null };
}
function click(container: HTMLElement, selector: string) {
  fireEvent.click(container.querySelector(selector)!);
}
function place(container: HTMLElement, task: string, start: number) {
  click(container, `[data-kitchen-task="${task}"]`);
  click(container, `[data-kitchen-start="${start}"]`);
}
function fill(container: HTMLElement, schedule: KitchenSchedule) {
  Object.entries(schedule).forEach(([task, start]) =>
    place(container, task, start),
  );
}
const board = (container: HTMLElement) =>
  container.querySelector("[data-kitchen-game]")!;
const snapshot = (container: HTMLElement): KitchenSchedule =>
  JSON.parse(board(container).getAttribute("data-kitchen-schedule")!);

describe("ConcurrentKitchen authored scheduling certificates", () => {
  it("contains 12 distinct handcrafted graphs, with 6–8 tasks in the last six levels", () => {
    expect(concurrentKitchenLevels).toHaveLength(12);
    expect(
      new Set(concurrentKitchenLevels.map((level) => level.title)).size,
    ).toBe(12);
    expect(
      new Set(
        concurrentKitchenLevels.map((level) =>
          JSON.stringify(
            level.tasks.map(({ station, duration, after }) => ({
              station,
              duration,
              after,
            })),
          ),
        ),
      ).size,
    ).toBe(12);
    for (const level of concurrentKitchenLevels)
      expect(validKitchenLevel(level)).toBe(true);
    for (const level of concurrentKitchenLevels.slice(6))
      expect(level.tasks.length).toBeGreaterThanOrEqual(6);
    expect(concurrentKitchenLevels.at(-1)!.tasks).toHaveLength(8);
  });
  it.each(concurrentKitchenLevels.map((level, i) => [i + 1, level] as const))(
    "independently certifies level %i and its tight optimal deadline",
    (_, level) => {
      const plan = certificate(level);
      expect(oracleLegal(level, plan, true)).toBe(true);
      expect(schedulingOracle(level).minimum).toBe(level.deadline);
      const impossible = { ...level, deadline: level.deadline - 1 };
      expect(schedulingOracle(impossible).schedule).toBeNull();
      let state = createKitchenState();
      for (const move of level.solution)
        state = editKitchen(level, state, move);
      expect(state.schedule).toEqual(plan);
      expect(kitchenWon(level, state.schedule)).toBe(true);
    },
  );
  it.each(concurrentKitchenLevels.map((level, i) => [i + 1, level] as const))(
    "solves level %i without using its certificate and preserves fixed placements",
    (_, level) => {
      const config = immutable({ ...level, solution: [] });
      const empty = searchKitchen(config);
      expect(empty.status).toBe("solved");
      expect(oracleLegal(config, empty.schedule!, true)).toBe(true);
      const fixed = Object.fromEntries(
        level.solution
          .filter((_, i) => i % 2)
          .map(({ task, start }) => [task, start]),
      );
      const solution = searchKitchen(config, immutable(fixed));
      expect(solution.status).toBe("solved");
      expect(oracleLegal(config, solution.schedule!, true)).toBe(true);
      for (const [id, start] of Object.entries(fixed))
        expect(solution.schedule![id]).toBe(start);
      expect(solution.visited).toBeLessThanOrEqual(KITCHEN_SEARCH_LIMIT);
      expect(solution.checks).toBeLessThanOrEqual(KITCHEN_CHECK_LIMIT);
    },
  );
  it("agrees with an independent scheduling oracle for every partial 3-task schedule", () => {
    const level: KitchenLevel = {
      title: "oracle",
      deadline: 4,
      lesson: "",
      solution: [],
      tasks: [
        { id: "A", name: "A", station: "prep", duration: 1, after: [] },
        { id: "B", name: "B", station: "oven", duration: 2, after: ["A"] },
        { id: "C", name: "C", station: "prep", duration: 2, after: [] },
      ],
    };
    let checked = 0;
    for (const a of [undefined, 0, 1, 2, 3])
      for (const b of [undefined, 0, 1, 2])
        for (const c of [undefined, 0, 1, 2]) {
          const schedule = Object.fromEntries(
            [
              ["A", a],
              ["B", b],
              ["C", c],
            ].filter(([, start]) => start !== undefined),
          ) as KitchenSchedule;
          const result = searchKitchen(level, schedule);
          if (!oracleLegal(level, schedule))
            expect(result.status).toBe("conflict");
          else
            expect(result.status).toBe(
              schedulingOracle(level, schedule).schedule
                ? "solved"
                : "impossible",
            );
          if (result.schedule)
            expect(oracleLegal(level, result.schedule, true)).toBe(true);
          checked++;
        }
    expect(checked).toBe(80);
  });
  it("accepts multiple distinct schedules and touching intervals", () => {
    const level = concurrentKitchenLevels[1],
      alternative = { A: 0, B: 2, C: 3 };
    expect(alternative).not.toEqual(certificate(level));
    expect(oracleLegal(level, alternative, true)).toBe(true);
    expect(kitchenWon(level, alternative)).toBe(true);
    expect(
      kitchenWon(concurrentKitchenLevels[3], { A: 1, B: 2, C: 0, D: 5 }),
    ).toBe(true);
    expect(
      kitchenWon(concurrentKitchenLevels[8], {
        D: 0,
        A: 1,
        E: 1,
        B: 3,
        F: 3,
        C: 6,
        G: 8,
      }),
    ).toBe(true);
  });
});

describe("ConcurrentKitchen editing and bounded actual-state hints", () => {
  it("records edits, ignores invalid/no-op edits, removes tasks and restores immutable snapshots", () => {
    const level = concurrentKitchenLevels[2];
    let state = immutable(createKitchenState());
    expect(editKitchen(level, state, { task: "X", start: 0 })).toBe(state);
    expect(editKitchen(level, state, { task: "A", start: -1 })).toBe(state);
    expect(editKitchen(level, state, { task: "A", start: 0.5 })).toBe(state);
    expect(editKitchen(level, state, { task: "A", start: 5 })).toBe(state);
    expect(editKitchen(level, state, { task: "A", start: null })).toBe(state);
    state = immutable(editKitchen(level, state, { task: "A", start: 0 }));
    expect(editKitchen(level, state, { task: "A", start: 0 })).toBe(state);
    state = immutable(editKitchen(level, state, { task: "C", start: 0 }));
    expect(inspectKitchen(level, state.schedule).issues[0].kind).toBe(
      "station",
    );
    const removed = editKitchen(level, state, { task: "C", start: null });
    expect(removed.schedule).toEqual({ A: 0 });
    expect(undoKitchen(level, removed).schedule).toEqual(state.schedule);
    expect(undoKitchen(level, state).schedule).toEqual({ A: 0 });
    expect(state.schedule).toEqual({ A: 0, C: 0 });
  });
  it("distinguishes malformed input, direct conflicts, proven impossibility, and exhausted budgets", () => {
    const level = concurrentKitchenLevels[2];
    const invalidSchedules: KitchenSchedule[] = [
      { A: -1 },
      { A: 0.5 },
      { A: 5 },
      { X: 0 },
    ];
    for (const schedule of invalidSchedules) {
      expect(validKitchenSchedule(level, schedule)).toBe(false);
      expect(searchKitchen(level, schedule).status).toBe("invalid");
    }
    expect(searchKitchen(level, { A: 0, C: 0 }).status).toBe("conflict");
    expect(searchKitchen(level, { A: 0, B: 1 }).status).toBe("conflict");
    expect(inspectKitchen(level, { C: 0 }).issues).toEqual([]);
    expect(searchKitchen(level, { C: 0 }).status).toBe("impossible");
    expect(schedulingOracle(level, { C: 0 }).schedule).toBeNull();
    expect(searchKitchen(level, {}, 0).status).toBe("limit");
    const pairLimit = searchKitchen(level, {}, KITCHEN_SEARCH_LIMIT, 0);
    expect(pairLimit.status).toBe("limit");
    expect(pairLimit.checks).toBe(0);
    expect(searchKitchen(concurrentKitchenLevels[1], {}, 1).status).toBe(
      "limit",
    );
  });
  it("rejects cyclic, duplicate, unknown-parent and malformed task definitions", () => {
    const level = concurrentKitchenLevels[0];
    expect(validKitchenLevel({ ...level, deadline: 17 })).toBe(false);
    expect(
      validKitchenLevel({ ...level, tasks: [level.tasks[0], level.tasks[0]] }),
    ).toBe(false);
    expect(
      validKitchenLevel({
        ...level,
        tasks: level.tasks.map((t) => ({
          ...t,
          after: [t.id === "A" ? "B" : "A"],
        })),
      }),
    ).toBe(false);
    expect(
      validKitchenLevel({
        ...level,
        tasks: [{ ...level.tasks[0], after: ["H"] }],
      }),
    ).toBe(false);
    expect(
      validKitchenLevel({
        ...level,
        tasks: [{ ...level.tasks[0], duration: 0 }],
      }),
    ).toBe(false);
    expect(validKitchenSchedule(level, [] as unknown as KitchenSchedule)).toBe(
      false,
    );
    expect(searchKitchen({ ...level, deadline: 1 }).status).toBe("impossible");
  });
  it("gives actionable conflict and impossible-state edits without calling a budget limit impossible", () => {
    const level = concurrentKitchenLevels[2];
    const conflict = kitchenHint(level, { A: 0, C: 0 });
    expect(conflict.status).toBe("conflict");
    expect(conflict.move).toEqual({ task: "C", start: null });
    expect(conflict.text).toMatch(/移出时间轴/);
    const impossible = kitchenHint(level, { C: 0 });
    expect(impossible.status).toBe("impossible");
    expect(impossible.move).toEqual({ task: "C", start: null });
    expect(impossible.text).toMatch(/撤销/);
    const limited = kitchenHint(level, {}, 0);
    expect(limited.status).toBe("limit");
    expect(limited.text).toMatch(/不代表无解/);
    expect(limited.move).toBeNull();
  });
  it("hints extend the actual alternate partial schedule one task at a time", () => {
    const level = concurrentKitchenLevels[1];
    let state = editKitchen(level, createKitchenState(), {
      task: "C",
      start: 3,
    });
    for (let step = 0; step < 2; step++) {
      const hint = kitchenHint(level, immutable(state.schedule));
      expect(hint.status).toBe("solved");
      expect(hint.move).not.toBeNull();
      state = editKitchen(level, state, hint.move!);
      expect(state.schedule.C).toBe(3);
      expect(schedulingOracle(level, state.schedule).schedule).not.toBeNull();
    }
    expect(kitchenWon(level, state.schedule)).toBe(true);
    expect(kitchenHint(level, state.schedule).move).toBeNull();
    expect(editKitchen(level, state, { task: "C", start: null })).toBe(state);
    expect(undoKitchen(level, state)).toBe(state);
  });
});

describe("ConcurrentKitchen rendered certificates and lifecycle", () => {
  it.each(concurrentKitchenLevels.map((level, i) => [i, level] as const))(
    "replays every certificate through the rendered controls: level %i",
    (index, level) => {
      const p = { ...props(), level: index };
      const view = render(
        <StrictMode>
          <ConcurrentKitchen {...p} />
        </StrictMode>,
      );
      fill(view.container, certificate(level));
      expect(snapshot(view.container)).toEqual(certificate(level));
      expect(board(view.container).getAttribute("data-kitchen-won")).toBe(
        "true",
      );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        view.container.querySelectorAll("[data-kitchen-task]"),
      ).toHaveLength(level.tasks.length);
      expect(
        view.container.querySelectorAll("[data-kitchen-issues]"),
      ).toHaveLength(0);
      view.rerender(
        <StrictMode>
          <ConcurrentKitchen {...p} hintToken={1} undoToken={1} />
        </StrictMode>,
      );
      expect(snapshot(view.container)).toEqual(certificate(level));
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    },
  );
  it("accepts an alternate complete schedule through rendered controls", () => {
    const p = { ...props(), level: 8 },
      view = render(<ConcurrentKitchen {...p} />);
    const alternate = { D: 0, A: 1, E: 1, B: 3, F: 3, C: 6, G: 8 };
    expect(alternate).not.toEqual(certificate(concurrentKitchenLevels[8]));
    fill(view.container, alternate);
    expect(snapshot(view.container)).toEqual(alternate);
    expect(p.onComplete).toHaveBeenCalledOnce();
  });
  it("keeps conflicting placements visible, offers useful hints and supports independent removal", () => {
    const p = { ...props(), level: 2 },
      view = render(<ConcurrentKitchen {...p} />);
    place(view.container, "A", 0);
    place(view.container, "C", 0);
    expect(snapshot(view.container)).toEqual({ A: 0, C: 0 });
    expect(board(view.container).getAttribute("data-kitchen-conflicts")).toBe(
      "1",
    );
    expect(
      view.container
        .querySelector('[data-kitchen-cell="prep:0"]')!
        .getAttribute("aria-label"),
    ).toMatch(/争用冲突/);
    view.rerender(<ConcurrentKitchen {...p} hintToken={1} />);
    expect(board(view.container).getAttribute("data-kitchen-selected")).toBe(
      "C",
    );
    expect(
      view.container.querySelector('[data-kitchen-hint="conflict"]'),
    ).not.toBeNull();
    click(view.container, "[data-kitchen-remove]");
    expect(snapshot(view.container)).toEqual({ A: 0 });
    expect(view.container.querySelector("[data-kitchen-hint]")).toBeNull();
    view.rerender(<ConcurrentKitchen {...p} hintToken={1} undoToken={1} />);
    expect(snapshot(view.container)).toEqual({ A: 0, C: 0 });
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("reports clean but impossible partial schedules separately and respects the user's placement in hints", () => {
    const p = { ...props(), level: 2 },
      view = render(<ConcurrentKitchen {...p} />);
    place(view.container, "C", 0);
    expect(board(view.container).getAttribute("data-kitchen-conflicts")).toBe(
      "0",
    );
    view.rerender(<ConcurrentKitchen {...p} hintToken={1} />);
    expect(
      view.container.querySelector('[data-kitchen-hint="impossible"]'),
    ).not.toBeNull();
    expect(snapshot(view.container)).toEqual({ C: 0 });
    view.rerender(<ConcurrentKitchen {...p} level={1} hintToken={1} />);
    place(view.container, "C", 3);
    view.rerender(<ConcurrentKitchen {...p} level={1} hintToken={2} />);
    expect(
      view.container.querySelector('[data-kitchen-hint="solved"]'),
    ).not.toBeNull();
    expect(snapshot(view.container)).toEqual({ C: 3 });
    expect(board(view.container).getAttribute("data-kitchen-selected")).toBe(
      "A",
    );
  });
  it("pauses editing without losing focus, consumes paused tokens, and never reopens completed schedules", () => {
    const p = { ...props(), level: 1 },
      view = render(<ConcurrentKitchen {...p} />);
    place(view.container, "C", 3);
    const button = view.container.querySelector(
      '[data-kitchen-start="2"]',
    ) as HTMLButtonElement;
    button.focus();
    view.rerender(
      <ConcurrentKitchen {...p} paused hintToken={1} undoToken={1} />,
    );
    expect(document.activeElement).toBe(button);
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button);
    click(view.container, "[data-kitchen-remove]");
    expect(snapshot(view.container)).toEqual({ C: 3 });
    expect(view.container.querySelector("[data-kitchen-hint]")).toBeNull();
    view.rerender(<ConcurrentKitchen {...p} hintToken={1} undoToken={1} />);
    expect(snapshot(view.container)).toEqual({ C: 3 });
    expect(view.container.querySelector("[data-kitchen-hint]")).toBeNull();
    place(view.container, "A", 0);
    click(view.container, '[data-kitchen-task="B"]');
    const finalButton = view.container.querySelector(
      '[data-kitchen-start="2"]',
    ) as HTMLButtonElement;
    finalButton.focus();
    fireEvent.click(finalButton);
    expect(document.activeElement).toBe(finalButton);
    expect(finalButton.getAttribute("aria-disabled")).toBe("true");
    expect(p.onComplete).toHaveBeenCalledOnce();
    click(view.container, '[data-kitchen-task="C"]');
    expect(board(view.container).getAttribute("data-kitchen-selected")).toBe(
      "C",
    );
    click(view.container, '[data-kitchen-start="0"]');
    click(view.container, "[data-kitchen-remove]");
    view.rerender(<ConcurrentKitchen {...p} hintToken={2} undoToken={2} />);
    expect(snapshot(view.container)).toEqual({ C: 3, A: 0, B: 2 });
    expect(board(view.container).getAttribute("data-kitchen-won")).toBe("true");
    view.rerender(
      <ConcurrentKitchen {...p} resetToken={1} hintToken={2} undoToken={2} />,
    );
    expect(snapshot(view.container)).toEqual({});
    expect(board(view.container).getAttribute("data-kitchen-won")).toBe(
      "false",
    );
  });
  it("supports keyboard selection, Enter/Space placement, and retains visible selected state", async () => {
    const p = props(),
      user = userEvent.setup(),
      view = render(<ConcurrentKitchen {...p} />);
    await user.tab();
    expect(document.activeElement).toBe(
      view.container.querySelector(".ck-timeline-scroll"),
    );
    await user.tab();
    expect(document.activeElement).toBe(
      view.container.querySelector('[data-kitchen-task="A"]'),
    );
    await user.keyboard("{Enter}");
    const first = view.container.querySelector(
      '[data-kitchen-start="0"]',
    ) as HTMLButtonElement;
    first.focus();
    await user.keyboard(" ");
    expect(snapshot(view.container)).toEqual({ A: 0 });
    const second = view.container.querySelector(
      '[data-kitchen-task="B"]',
    ) as HTMLButtonElement;
    second.focus();
    await user.keyboard("{Enter}");
    expect(second.getAttribute("aria-pressed")).toBe("true");
    expect(second.textContent).toMatch(/已选/);
    const end = view.container.querySelector(
      '[data-kitchen-start="2"]',
    ) as HTMLButtonElement;
    end.focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(end);
    expect(end.getAttribute("aria-pressed")).toBe("true");
    expect(p.onComplete).toHaveBeenCalledOnce();
  });
  it("resets selection, history and hints on reset or level changes without late completion", () => {
    const p = props(),
      view = render(<ConcurrentKitchen {...p} />);
    place(view.container, "A", 0);
    view.rerender(<ConcurrentKitchen {...p} hintToken={1} />);
    expect(view.container.querySelector("[data-kitchen-hint]")).not.toBeNull();
    view.rerender(<ConcurrentKitchen {...p} resetToken={1} hintToken={1} />);
    expect(snapshot(view.container)).toEqual({});
    expect(board(view.container).getAttribute("data-kitchen-selected")).toBe(
      "A",
    );
    expect(view.container.querySelector("[data-kitchen-hint]")).toBeNull();
    view.rerender(
      <ConcurrentKitchen
        {...p}
        level={11}
        resetToken={1}
        hintToken={1}
        undoToken={1}
      />,
    );
    expect(snapshot(view.container)).toEqual({});
    expect(view.container.querySelectorAll("[data-kitchen-task]")).toHaveLength(
      8,
    );
    expect(p.onComplete).not.toHaveBeenCalled();
  });
});
