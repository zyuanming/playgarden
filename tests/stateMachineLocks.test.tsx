// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StateMachineLocks from "../src/games/StateMachineLocks";
import {
  applyMachineLockInput,
  createMachineLockState,
  initialMachineLockBoard,
  machineLockHint,
  machineLocksWon,
  MACHINE_LOCK_SEARCH_LIMIT,
  moveMachineLock,
  searchMachineLocks,
  stateMachineLocksLevels,
  undoMachineLock,
  validMachineLockBoard,
  validMachineLockLevel,
  type MachineLockBoard,
  type MachineLockLevel,
} from "../src/games/stateMachineLocksLogic";
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
// Independent machine model stores named open-door sets and a bag of input
// labels. It uses neither production transitions, validation, search nor masks.
type Oracle = {
  state: number;
  open: Set<string>;
  bag: string[];
  path: number[];
};
function oracleStart(
  level: MachineLockLevel,
  board?: MachineLockBoard,
): Oracle {
  const flags = board?.doors ?? level.initialDoors;
  return {
    state: board?.state ?? level.start,
    open: new Set(level.doors.filter((_, i) => flags[i])),
    bag: level.inputs.flatMap((input, i) =>
      Array(board?.remaining[i] ?? input.count).fill(input.label),
    ),
    path: [],
  };
}
function oracleStep(
  level: MachineLockLevel,
  source: Oracle,
  input: number,
): Oracle | null {
  const label = level.inputs[input]?.label,
    at = source.bag.indexOf(label);
  if (at < 0 || level.forbidden.includes(source.state)) return null;
  const transition = level.transitions[source.state][input],
    output = transition.output;
  const next = {
    state: transition.to,
    open: new Set(source.open),
    bag: source.bag.filter((_, i) => i !== at),
    path: [...source.path, input],
  };
  if (output) {
    const door = level.doors[output.door];
    const desired =
      output.mode === "open" ||
      (output.mode === "toggle" && !source.open.has(door));
    if (desired) next.open.add(door);
    else next.open.delete(door);
  }
  return next;
}
function oracleGoal(level: MachineLockLevel, node: Oracle): boolean {
  return (
    !level.forbidden.includes(node.state) &&
    node.state === level.target &&
    level.doors.every((door, i) => node.open.has(door) === level.targetDoors[i])
  );
}
function oracleSearch(
  level: MachineLockLevel,
  start = oracleStart(level),
): number[] | null {
  const queue = [start],
    visited = new Set<string>();
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    if (oracleGoal(level, node)) return node.path;
    // Reverse order deliberately differs from production search tie breaking.
    for (let input = level.inputs.length - 1; input >= 0; input--) {
      const next = oracleStep(level, node, input);
      if (!next || level.forbidden.includes(next.state)) continue;
      const key = JSON.stringify([
        next.state,
        [...next.open].sort(),
        [...next.bag].sort(),
      ]);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return null;
}
function asBoard(level: MachineLockLevel, state: Oracle): MachineLockBoard {
  return {
    state: state.state,
    doors: level.doors.map((d) => state.open.has(d)),
    remaining: level.inputs.map(
      (input) => state.bag.filter((label) => label === input.label).length,
    ),
  };
}
function click(container: HTMLElement, input: number) {
  fireEvent.click(
    container.querySelector(`[data-machine-lock-input="${input}"]`)!,
  );
}
const snapshot = (container: HTMLElement) => {
  const root = container.querySelector("[data-machine-lock-game]")!;
  return ["state", "doors", "remaining"].map((key) =>
    root.getAttribute(`data-machine-lock-${key}`),
  );
};
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

describe("StateMachineLocks independent certificates and mechanics", () => {
  it("certifies all 12 handcrafted machines and independently proves shortest lengths", () => {
    expect(stateMachineLocksLevels).toHaveLength(12);
    expect(stateMachineLocksLevels.map((l) => l.par)).toEqual([
      2, 3, 4, 4, 4, 4, 5, 6, 6, 7, 8, 9,
    ]);
    expect(
      new Set(stateMachineLocksLevels.map((l) => JSON.stringify(l.transitions)))
        .size,
    ).toBe(12);
    stateMachineLocksLevels.forEach((level) => {
      expect(validMachineLockLevel(level)).toBe(true);
      let oracle = oracleStart(level),
        state = createMachineLockState(level);
      expect(machineLocksWon(level, state.board)).toBe(false);
      for (const input of level.solution) {
        const next = oracleStep(level, oracle, input);
        expect(next).not.toBeNull();
        oracle = next!;
        expect(level.forbidden).not.toContain(oracle.state);
        state = moveMachineLock(level, state, input);
        expect(state.board).toEqual(asBoard(level, oracle));
      }
      expect(oracleGoal(level, oracle)).toBe(true);
      expect(machineLocksWon(level, state.board)).toBe(true);
      expect(oracleSearch(level)?.length, level.title).toBe(level.par);
      const search = searchMachineLocks(level);
      expect(search.status).toBe("found");
      expect(search.solution).toHaveLength(level.par);
      expect(search.visited).toBeLessThanOrEqual(MACHINE_LOCK_SEARCH_LIMIT);
    });
  });
  it("validates every state/input/door combination against a separate interpreter", () => {
    for (const level of stateMachineLocksLevels)
      for (let state = 0; state < level.states.length; state++)
        for (let mask = 0; mask < 2 ** level.doors.length; mask++)
          for (let input = 0; input < level.inputs.length; input++) {
            const board = {
              state,
              doors: level.doors.map((_, i) => Boolean(mask & (1 << i))),
              remaining: level.inputs.map((c) => c.count),
            };
            const actual = applyMachineLockInput(level, board, input);
            if (
              level.forbidden.includes(state) ||
              machineLocksWon(level, board)
            )
              expect(actual).toBeNull();
            else
              expect(actual).toEqual(
                asBoard(
                  level,
                  oracleStep(level, oracleStart(level, board), input)!,
                ),
              );
          }
  });
  it("uses both memory state and door outputs, including initially open locks", () => {
    const level = stateMachineLocksLevels[2],
      board = initialMachineLockBoard(level);
    expect(applyMachineLockInput(level, board, 0)?.doors).toEqual([
      true,
      false,
    ]);
    expect(
      applyMachineLockInput(level, { ...board, state: 2 }, 0)?.doors,
    ).toEqual([false, true]);
    expect(machineLocksWon(level, board)).toBe(false); // correct state alone is insufficient
    expect(
      machineLocksWon(level, { ...board, state: 1, doors: [true, true] }),
    ).toBe(false); // all open alone insufficient
    const final = stateMachineLocksLevels[11];
    expect(initialMachineLockBoard(final).doors).toEqual([true, false, false]);
    expect(
      applyMachineLockInput(final, initialMachineLockBoard(final), 0)?.doors[0],
    ).toBe(false);
  });
  it("current-state hints agree with independent reachability for every certificate prefix and first move", () => {
    for (const original of stateMachineLocksLevels) {
      const level = { ...original, solution: [] },
        prefix = createMachineLockState(level);
      const boards = [prefix.board];
      let state = prefix;
      for (const input of original.solution) {
        state = moveMachineLock(level, state, input);
        boards.push(state.board);
      }
      for (let input = 0; input < level.inputs.length; input++) {
        const b = applyMachineLockInput(level, prefix.board, input);
        if (b) boards.push(b);
      }
      for (const board of boards) {
        const expected = oracleSearch(level, oracleStart(level, board)),
          result = searchMachineLocks(level, board),
          hint = machineLockHint(level, board);
        if (expected === null) {
          expect(result.status).toBe("unsolvable");
          expect(hint.input).toBeNull();
        } else {
          expect(result.solution?.length).toBe(expected.length);
          expect(result.status).toBe(expected.length ? "found" : "solved");
        }
        if (hint.input !== null)
          expect(
            applyMachineLockInput(level, board, hint.input),
          ).not.toBeNull();
      }
    }
  });
  it("keeps invalid data, forbidden states, exhausted resources and search limits distinct", () => {
    const level = stateMachineLocksLevels[0],
      board = initialMachineLockBoard(level);
    expect(searchMachineLocks(level, board, 0).status).toBe("limit");
    expect(searchMachineLocks(level, board, 1).status).toBe("limit");
    expect(
      searchMachineLocks(level, { ...board, remaining: [0, 0] }).status,
    ).toBe("unsolvable");
    expect(applyMachineLockInput(level, board, -1)).toBeNull();
    expect(applyMachineLockInput(level, board, 0.5)).toBeNull();
    expect(
      applyMachineLockInput(level, { ...board, remaining: [0, 1] }, 0),
    ).toBeNull();
    expect(validMachineLockBoard(level, { ...board, doors: [] })).toBe(false);
    expect(validMachineLockBoard(level, { ...board, remaining: [3, 1] })).toBe(
      false,
    );
    expect(validMachineLockLevel({ ...level, target: 100 })).toBe(false);
    expect(searchMachineLocks({ ...level, transitions: [] }).status).toBe(
      "invalid",
    );
    const trap = applyMachineLockInput(level, board, 1)!;
    expect(trap.state).toBe(2);
    expect(trap.remaining).toEqual([2, 0]);
    expect(applyMachineLockInput(level, trap, 0)).toBeNull();
    expect(machineLockHint(level, trap).status).toBe("unsolvable");
  });
  it("supports multiple genuine solutions and immutable undo from success or failure", () => {
    const level = stateMachineLocksLevels[2],
      state = freeze(createMachineLockState(level));
    let alternate = state;
    for (const input of [1, 0, 0, 1])
      alternate = moveMachineLock(level, alternate, input);
    expect(machineLocksWon(level, alternate.board)).toBe(true);
    expect(state.board.remaining).toEqual([2, 2]);
    const before = undoMachineLock(alternate);
    expect(machineLocksWon(level, before.board)).toBe(false);
    expect(moveMachineLock(level, alternate, 0)).toBe(alternate);
    const start = createMachineLockState(stateMachineLocksLevels[0]);
    expect(
      undoMachineLock(moveMachineLock(stateMachineLocksLevels[0], start, 1)),
    ).toEqual(start);
  });
});

describe("StateMachineLocks rendered interaction and lifecycle", () => {
  stateMachineLocksLevels.forEach((level, index) =>
    it(`replays actual input controls for level ${index + 1}: ${level.title}`, () => {
      const p = props(),
        view = render(<StateMachineLocks {...p} level={index} />);
      expect(
        view.container.querySelectorAll("[data-machine-lock-rule-state]"),
      ).toHaveLength(level.states.length);
      level.solution.forEach((input) => click(view.container, input));
      expect(
        view.container.querySelector("[data-machine-lock-won=true]"),
      ).not.toBeNull();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        view.container.querySelectorAll("[data-machine-lock-history]"),
      ).toHaveLength(level.solution.length);
    }),
  );
  it("supports keyboard numbers, ignores repeated/modifier keys and freezes during pause", async () => {
    const user = userEvent.setup(),
      p = props(),
      view = render(<StateMachineLocks {...p} />),
      root = view.getByLabelText("状态机门锁工作台，数字一至三发送输入");
    root.focus();
    await user.keyboard("1");
    expect(snapshot(view.container)[0]).toBe("1");
    const before = snapshot(view.container);
    fireEvent.keyDown(root, { key: "2", repeat: true });
    fireEvent.keyDown(root, { key: "2", ctrlKey: true });
    expect(snapshot(view.container)).toEqual(before);
    view.rerender(
      <StateMachineLocks {...p} paused hintToken={1} undoToken={1} />,
    );
    fireEvent.keyDown(root, { key: "2" });
    click(view.container, 1);
    expect(snapshot(view.container)).toEqual(before);
    view.rerender(<StateMachineLocks {...p} hintToken={1} undoToken={1} />);
    expect(snapshot(view.container)).toEqual(before);
    expect(view.container.querySelector(".ml-hinted")).toBeNull();
    await user.keyboard("2");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("provides current-state hints and undo restores every resource, door and state", () => {
    const p = props(),
      view = render(<StateMachineLocks {...p} />);
    click(view.container, 0);
    view.rerender(<StateMachineLocks {...p} hintToken={1} />);
    expect(
      view.container.querySelector('[data-machine-lock-input="1"]')!.className,
    ).toContain("ml-hinted");
    view.rerender(<StateMachineLocks {...p} hintToken={1} undoToken={1} />);
    expect(snapshot(view.container)).toEqual(["0", "0", "2,1"]);
    expect(view.container.querySelector(".ml-hinted")).toBeNull();
    click(view.container, 1);
    expect(snapshot(view.container)).toEqual(["2", "0", "2,0"]);
    view.rerender(<StateMachineLocks {...p} hintToken={2} undoToken={1} />);
    expect(
      view
        .getAllByRole("status")
        .some((node) => node.textContent?.includes("无法到达目标")),
    ).toBe(true);
    click(view.container, 0);
    expect(snapshot(view.container)[0]).toBe("2");
    view.rerender(<StateMachineLocks {...p} hintToken={2} undoToken={2} />);
    expect(snapshot(view.container)).toEqual(["0", "0", "2,1"]);
  });
  it("resets an exhausted run and changes levels without retaining history", () => {
    const p = props(),
      view = render(<StateMachineLocks {...p} level={1} />);
    click(view.container, 1);
    click(view.container, 1);
    expect(
      view.container
        .querySelector('[data-machine-lock-input="1"]')!
        .hasAttribute("disabled"),
    ).toBe(true);
    const before = snapshot(view.container);
    click(view.container, 1);
    expect(snapshot(view.container)).toEqual(before);
    view.rerender(<StateMachineLocks {...p} level={1} resetToken={1} />);
    expect(snapshot(view.container)).toEqual(["0", "0", "2,2"]);
    view.rerender(<StateMachineLocks {...p} level={11} resetToken={1} />);
    expect(snapshot(view.container)).toEqual(["0", "100", "5,3,1"]);
    expect(
      view.container.querySelectorAll("[data-machine-lock-history]"),
    ).toHaveLength(0);
  });
  it("notifies once under StrictMode, repeated inputs, callback changes and undo-rewin", () => {
    const p = props(),
      view = render(
        <StrictMode>
          <StateMachineLocks {...p} />
        </StrictMode>,
      );
    click(view.container, 0);
    click(view.container, 1);
    click(view.container, 1);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <StateMachineLocks {...p} onStatus={vi.fn()} undoToken={1} />
      </StrictMode>,
    );
    expect(snapshot(view.container)[0]).toBe("1");
    click(view.container, 1);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <StateMachineLocks {...p} resetToken={1} />
      </StrictMode>,
    );
    click(view.container, 0);
    click(view.container, 1);
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
  it("has honest complete transition and goal text with no certificate-sequence controls", () => {
    const p = props(),
      view = render(<StateMachineLocks {...p} level={11} />);
    expect(
      view
        .getByLabelText("全部状态与输入的转移规则")
        .querySelectorAll("tbody td"),
    ).toHaveLength(21);
    expect(view.getByLabelText("当前门锁与目标").textContent).toContain(
      "月门 · 打开",
    );
    expect(
      view.container.querySelectorAll("[data-machine-lock-input]"),
    ).toHaveLength(3);
    expect(view.container.textContent).not.toContain("一键通关");
  });
});
