// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BooleanCircuit from "../src/games/BooleanCircuit";
import StackQueueWorkshop from "../src/games/StackQueueWorkshop";
import {
  applyCircuitMove,
  booleanCircuitLevels,
  circuitHint,
  circuitNextMove,
  circuitTruthTable,
  circuitWon,
  createCircuitState,
  evaluateCircuit,
  moveCircuit,
  undoCircuit,
  validCircuitGates,
  type CircuitGate,
  type CircuitLevel,
  type CircuitMove,
} from "../src/games/booleanCircuitLogic";
import {
  applyCargoMove,
  cargoHint,
  cargoMoves,
  cargoWon,
  CARGO_STATE_LIMIT,
  createCargoState,
  initialCargoBoard,
  legalCargoMoves,
  moveCargo,
  searchCargo,
  stackQueueLevels,
  undoCargo,
  validCargoBoard,
  type CargoBoard,
  type CargoLevel,
  type CargoMove,
} from "../src/games/stackQueueLogic";

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
function frozen<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(frozen);
    Object.freeze(value);
  }
  return value;
}

// An independent Boolean interpreter: no production evaluation/transition helpers.
function circuitOracle(
  level: CircuitLevel,
  gates: CircuitGate[],
  row: number,
): number {
  const bits = row.toString(2).padStart(level.inputs.length, "0").split("");
  const signals = new Map<string, boolean>(
    level.inputs.map((name, i) => [name, bits[i] === "1"]),
  );
  gates.forEach((gate, i) => {
    if (!gate.op || !gate.a || !signals.has(gate.a))
      throw new Error("Missing or forward wire");
    const left = signals.get(gate.a)!;
    let result: boolean;
    if (gate.op === "NOT") result = !left;
    else {
      if (!gate.b || !signals.has(gate.b))
        throw new Error("Missing or forward wire");
      const right = signals.get(gate.b)!;
      result = gate.op === "AND" ? left && right : left || right;
    }
    signals.set(`g${i}`, result);
  });
  return Number(signals.get(`g${gates.length - 1}`));
}
const expectedPredicates = [
  (a: boolean, b: boolean) => a && b,
  (a: boolean, b: boolean) => a || b,
  (a: boolean) => !a,
  (a: boolean, b: boolean) => !(a && b),
  (a: boolean, b: boolean) => !(a || b),
  (a: boolean, b: boolean) => a && !b,
  (a: boolean, b: boolean, c: boolean) => (a || b) && c,
  (a: boolean, b: boolean, c: boolean) => (a && b) || (b && c),
  (a: boolean, b: boolean) => a !== b,
  (a: boolean, b: boolean, c: boolean) => (a ? b : c),
  (a: boolean, b: boolean, c: boolean) => [a, b, c].filter(Boolean).length >= 2,
  (a: boolean, b: boolean, c: boolean) =>
    [a, b, c].filter(Boolean).length === 2,
];

// Independent cargo oracle represents incoming cargo as an array and validates
// sources/destinations itself. It never invokes production move/search helpers.
type OracleCargo = {
  incoming: string[];
  lifo: string[];
  fifo: string[];
  sent: string[];
};
function oracleStep(
  level: CargoLevel,
  state: OracleCargo,
  move: CargoMove,
): OracleCargo | null {
  const next = {
    incoming: [...state.incoming],
    lifo: [...state.lifo],
    fifo: [...state.fifo],
    sent: [...state.sent],
  };
  const from = move.slice(0, move.indexOf("-")),
    to = move.slice(move.indexOf("-") + 1);
  let item: string | undefined;
  if (from === "input") item = next.incoming.shift();
  if (from === "stack") item = next.lifo.pop();
  if (from === "queue") item = next.fifo.shift();
  if (!item) return null;
  if (to === "output") {
    if (level.target[next.sent.length] !== item) return null;
    next.sent.push(item);
  } else if (to === "stack") {
    if (next.lifo.length === level.stackCapacity) return null;
    next.lifo.push(item);
  } else if (to === "queue") {
    if (next.fifo.length === level.queueCapacity) return null;
    next.fifo.push(item);
  } else return null;
  return next;
}
const oracleStart = (level: CargoLevel): OracleCargo => ({
  incoming: [...level.input],
  lifo: [],
  fifo: [],
  sent: [],
});
function oracleDistance(level: CargoLevel): number | null {
  const start = oracleStart(level),
    key = (s: OracleCargo) => JSON.stringify(s);
  const seen = new Set([key(start)]),
    queue = [{ state: start, depth: 0 }];
  const routes: CargoMove[] = [
    "queue-stack",
    "stack-queue",
    "queue-output",
    "stack-output",
    "input-output",
    "input-queue",
    "input-stack",
  ];
  for (let i = 0; i < queue.length; i++) {
    const { state, depth } = queue[i];
    if (state.sent.length === level.target.length) return depth;
    for (const route of routes) {
      const next = oracleStep(level, state, route);
      if (next && !seen.has(key(next))) {
        seen.add(key(next));
        queue.push({ state: next, depth: depth + 1 });
      }
    }
  }
  return null;
}
function fillCircuit(container: HTMLElement, level: CircuitLevel) {
  level.solution.forEach((gate, i) => {
    fireEvent.click(
      container.querySelector(
        `[data-circuit-op="${gate.op}"][data-gate-index="${i}"]`,
      )!,
    );
    fireEvent.change(
      container.querySelector(
        `[data-circuit-field="a"][data-gate-index="${i}"]`,
      )!,
      { target: { value: gate.a } },
    );
    if (gate.op !== "NOT")
      fireEvent.change(
        container.querySelector(
          `[data-circuit-field="b"][data-gate-index="${i}"]`,
        )!,
        { target: { value: gate.b } },
      );
  });
}
const clickCargo = (container: HTMLElement, move: CargoMove) =>
  fireEvent.click(container.querySelector(`[data-cargo-move="${move}"]`)!);
const cargoSnapshot = (container: HTMLElement) => {
  const root = container.querySelector("[data-cargo-game]")!;
  return ["cursor", "stack", "queue", "output"].map((part) =>
    root.getAttribute(`data-cargo-${part}`),
  );
};

describe("BooleanCircuit: complete truth-table certificates and pure rules", () => {
  it("certifies all 12 original levels with independent expressions and interpreter", () => {
    expect(booleanCircuitLevels).toHaveLength(12);
    expect(
      new Set(
        booleanCircuitLevels.map(
          (l) => `${l.inputs.length}:${l.target.join("")}`,
        ),
      ).size,
    ).toBe(12);
    booleanCircuitLevels.forEach((level, i) => {
      expect(level.target).toHaveLength(2 ** level.inputs.length);
      for (let row = 0; row < level.target.length; row++) {
        const bits = row
          .toString(2)
          .padStart(level.inputs.length, "0")
          .split("")
          .map((n) => n === "1");
        expect(circuitOracle(level, level.solution, row)).toBe(
          level.target[row],
        );
        expect(Number(expectedPredicates[i](bits[0], bits[1], bits[2]))).toBe(
          level.target[row],
        );
      }
      expect(circuitTruthTable(level, level.solution)).toEqual(level.target);
      expect(circuitWon(level, level.solution)).toBe(true);
      expect(circuitWon(level, createCircuitState(level).gates)).toBe(false);
    });
  });
  it("checks all rows, rejects cycles/bad operations, and leaves incomplete signals unknown", () => {
    const level = booleanCircuitLevels[0],
      blank = createCircuitState(level);
    expect(circuitTruthTable(level, blank.gates)).toEqual([
      null,
      null,
      null,
      null,
    ]);
    const almost: CircuitGate[] = [{ op: "AND", a: "A", b: "A" }];
    expect(evaluateCircuit(level, almost, 0)).toEqual([0]);
    expect(circuitWon(level, almost)).toBe(false);
    expect(validCircuitGates(level, [{ op: "AND", a: "g0", b: "A" }])).toBe(
      false,
    );
    expect(
      applyCircuitMove(level, blank.gates, {
        gate: 0,
        field: "a",
        value: "g0",
      }),
    ).toBeNull();
    expect(
      applyCircuitMove(level, blank.gates, {
        gate: 99,
        field: "op",
        value: "AND",
      }),
    ).toBeNull();
    expect(
      applyCircuitMove(level, blank.gates, {
        gate: 0,
        field: "op",
        value: "XOR",
      } as unknown as CircuitMove),
    ).toBeNull();
    expect(evaluateCircuit(level, almost, -1)).toEqual([]);
    expect(evaluateCircuit(level, almost, 0.5)).toEqual([]);
    expect(evaluateCircuit(level, almost, 4)).toEqual([]);
  });
  it("is immutable, supports undo, and doesn't use the authored wiring to determine victory", () => {
    const level = booleanCircuitLevels[0],
      original = frozen(createCircuitState(level));
    const next = moveCircuit(level, original, {
      gate: 0,
      field: "op",
      value: "AND",
    });
    expect(original.gates[0].op).toBeNull();
    expect(next.history).toHaveLength(1);
    expect(undoCircuit(next)).toEqual(original);
    expect(undoCircuit(original)).toBe(original);
    expect(
      moveCircuit(level, next, { gate: 0, field: "op", value: "AND" }),
    ).toBe(next);
    const alternative = [{ op: "AND", a: "B", b: "A" }] as CircuitGate[];
    const poisoned = {
      ...level,
      solution: [{ op: "NOT", a: "A", b: null }] as CircuitGate[],
    };
    expect(circuitWon(poisoned, alternative)).toBe(true);
    expect(circuitNextMove(level, alternative)).toBeNull();
  });
  it("offers bounded legal hints from changed circuits and admits other wires may need changing", () => {
    for (const level of booleanCircuitLevels) {
      let state = createCircuitState(level);
      state = moveCircuit(level, state, { gate: 0, field: "op", value: "NOT" });
      state = moveCircuit(level, state, {
        gate: 0,
        field: "a",
        value: level.inputs.at(-1)!,
      });
      let steps = 0;
      while (!circuitWon(level, state.gates) && steps < 22) {
        const move = circuitNextMove(level, state.gates);
        expect(move).not.toBeNull();
        expect(circuitHint(level, state.gates)).toContain("后续可能");
        const next = moveCircuit(level, state, move!);
        expect(next).not.toBe(state);
        state = next;
        steps++;
      }
      expect(circuitWon(level, state.gates)).toBe(true);
      expect(steps).toBeLessThanOrEqual(level.solution.length * 3);
    }
  });
});

describe("StackQueueWorkshop: capacity, FIFO/LIFO, and independent shortest certificates", () => {
  it("independently proves legality and optimal lengths for every one of 12 levels", () => {
    expect(stackQueueLevels).toHaveLength(12);
    expect(
      new Set(
        stackQueueLevels.map(
          (l) => l.target.join("") + l.stackCapacity + l.queueCapacity,
        ),
      ).size,
    ).toBe(12);
    for (const level of stackQueueLevels) {
      let independent = oracleStart(level),
        board = initialCargoBoard();
      for (const move of level.solution) {
        const next = oracleStep(level, independent, move);
        expect(next, `${level.title}: ${move}`).not.toBeNull();
        independent = next!;
        board = applyCargoMove(level, board, move)!;
        expect(board).not.toBeNull();
        expect(validCargoBoard(level, board)).toBe(true);
        expect(board.stack).toEqual(independent.lifo);
        expect(board.queue).toEqual(independent.fifo);
      }
      expect(independent.sent).toEqual(level.target);
      expect(cargoWon(level, board)).toBe(true);
      expect(oracleDistance(level)).toBe(level.par);
      const result = searchCargo(level);
      expect(result.status).toBe("solved");
      expect(result.solution).toHaveLength(level.par);
      expect(result.visited).toBeLessThanOrEqual(CARGO_STATE_LIMIT);
    }
  });
  it("actually takes the newest stack cargo and oldest queue cargo", () => {
    const level = stackQueueLevels[4];
    let stack = initialCargoBoard(),
      queue = initialCargoBoard();
    for (let i = 0; i < 2; i++) {
      stack = applyCargoMove(level, stack, "input-stack")!;
      queue = applyCargoMove(level, queue, "input-queue")!;
    }
    expect(applyCargoMove(level, stack, "stack-queue")!.queue).toEqual(["B"]);
    expect(applyCargoMove(level, queue, "queue-stack")!.stack).toEqual(["A"]);
    expect(applyCargoMove(level, stack, "input-stack")).toBeNull();
    expect(applyCargoMove(level, queue, "input-queue")).toBeNull();
    expect(applyCargoMove(level, stack, "stack-output")).toBeNull();
    expect(
      applyCargoMove(level, initialCargoBoard(), "queue-stack"),
    ).toBeNull();
  });
  it("preserves cargo exactly, rejects invalid boards, and supports immutable undo", () => {
    const level = stackQueueLevels[0],
      initial = frozen(createCargoState());
    const next = moveCargo(level, initial, "input-stack");
    expect(initial.board.stack).toEqual([]);
    expect(next.board.stack).toEqual(["A"]);
    expect(undoCargo(next)).toEqual(initial);
    expect(undoCargo(initial)).toBe(initial);
    expect(moveCargo(level, initial, "stack-output")).toBe(initial);
    for (const invalid of [
      { cursor: 1, stack: ["A"], queue: ["A"], output: [] },
      { cursor: 1, stack: ["C"], queue: [], output: [] },
      { cursor: 1, stack: [], queue: [], output: ["A"] },
      { cursor: -1, stack: [], queue: [], output: [] },
      { cursor: 0.5, stack: [], queue: [], output: [] },
    ]) {
      expect(validCargoBoard(level, invalid)).toBe(false);
      expect(searchCargo(level, invalid).status).toBe("invalid");
    }
    expect(searchCargo({ ...level, stackCapacity: 0 }).status).toBe("invalid");
    expect(applyCargoMove(level, initial.board, "bad" as CargoMove)).toBeNull();
  });
  it("searches the current state, distinguishes deadlocks from limits, and never claims a limit proves no solution", () => {
    const level = stackQueueLevels[0],
      alternate = applyCargoMove(level, initialCargoBoard(), "input-queue")!;
    const result = searchCargo(level, alternate);
    expect(result.solution?.[0]).toBe("input-output");
    let board = alternate;
    for (const move of result.solution!)
      board = applyCargoMove(level, board, move)!;
    expect(cargoWon(level, board)).toBe(true);
    const deadlock: CargoBoard = {
      cursor: 3,
      stack: ["A"],
      queue: ["B", "C"],
      output: [],
    };
    expect(validCargoBoard(stackQueueLevels[1], deadlock)).toBe(true);
    expect(legalCargoMoves(stackQueueLevels[1], deadlock)).toEqual([]);
    expect(searchCargo(stackQueueLevels[1], deadlock).status).toBe(
      "unreachable",
    );
    expect(cargoHint(stackQueueLevels[1], deadlock).text).toContain("撤销");
    expect(searchCargo(level, initialCargoBoard(), 1)).toEqual({
      status: "limit",
      solution: null,
      visited: 1,
    });
    expect(cargoHint(level, initialCargoBoard(), 1).text).toContain(
      "不代表无解",
    );
    expect(searchCargo(level, board, 0)).toEqual({
      status: "solved",
      solution: [],
      visited: 1,
    });
    expect(searchCargo(level, initialCargoBoard(), NaN).status).toBe("solved");
    expect(
      searchCargo(level, initialCargoBoard(), 1e10).visited,
    ).toBeLessThanOrEqual(CARGO_STATE_LIMIT);
  });
});

describe("programming puzzle UI lifecycle", () => {
  it("solves every circuit through touch/click controls, showing every truth-table row", () => {
    booleanCircuitLevels.forEach((level, i) => {
      const p = { ...props(), level: i },
        view = render(<BooleanCircuit {...p} />);
      expect(
        view.container.querySelectorAll("[data-circuit-row]"),
      ).toHaveLength(level.target.length);
      fillCircuit(view.container, level);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        view.container
          .querySelector("[data-circuit-game]")
          ?.getAttribute("data-circuit-won"),
      ).toBe("true");
      view.unmount();
    });
  });
  it("solves every cargo level through buttons and renders both real storage orders", () => {
    stackQueueLevels.forEach((level, i) => {
      const p = { ...props(), level: i },
        view = render(<StackQueueWorkshop {...p} />);
      for (const move of level.solution) {
        expect(
          (
            view.container.querySelector(
              `[data-cargo-move="${move}"]`,
            ) as HTMLButtonElement
          ).disabled,
        ).toBe(false);
        clickCargo(view.container, move);
      }
      expect(cargoSnapshot(view.container)).toEqual([
        String(level.input.length),
        "",
        "",
        level.target.join(""),
      ]);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      view.unmount();
    });
  });
  it("circuit pause consumes tokens, reset/level switches clear state, and repeated completion is idempotent", () => {
    const p = props(),
      view = render(
        <StrictMode>
          <BooleanCircuit {...p} />
        </StrictMode>,
      );
    const clickAnd = () =>
      fireEvent.click(view.container.querySelector('[data-circuit-op="AND"]')!);
    clickAnd();
    view.rerender(
      <StrictMode>
        <BooleanCircuit {...p} paused hintToken={1} undoToken={1} />
      </StrictMode>,
    );
    fireEvent.change(
      view.container.querySelector('[data-circuit-field="a"]')!,
      { target: { value: "A" } },
    );
    expect(
      (
        view.container.querySelector(
          '[data-circuit-field="a"]',
        ) as HTMLSelectElement
      ).value,
    ).toBe("");
    view.rerender(
      <StrictMode>
        <BooleanCircuit {...p} hintToken={1} undoToken={1} />
      </StrictMode>,
    );
    expect(
      view.container
        .querySelector('[data-circuit-op="AND"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(view.container.querySelector(".bc-hinted")).toBeNull();
    fillCircuit(view.container, booleanCircuitLevels[0]);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <BooleanCircuit {...p} hintToken={1} undoToken={2} />
      </StrictMode>,
    );
    fireEvent.change(
      view.container.querySelector('[data-circuit-field="b"]')!,
      { target: { value: "B" } },
    );
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <BooleanCircuit {...p} resetToken={1} hintToken={9} undoToken={9} />
      </StrictMode>,
    );
    expect(
      (
        view.container.querySelector(
          '[data-circuit-field="a"]',
        ) as HTMLSelectElement
      ).value,
    ).toBe("");
    expect(view.container.querySelector(".bc-hinted")).toBeNull();
    fillCircuit(view.container, booleanCircuitLevels[0]);
    expect(p.onComplete).toHaveBeenCalledTimes(2);
    view.rerender(<BooleanCircuit {...p} level={2} />);
    expect(view.container.querySelectorAll("[data-circuit-row]")).toHaveLength(
      2,
    );
    expect(
      view.container
        .querySelector("[data-circuit-game]")
        ?.getAttribute("data-circuit-won"),
    ).toBe("false");
  });
  it("supports native circuit keyboard controls and ignores NOT's unused right input", async () => {
    const user = userEvent.setup(),
      p = { ...props(), level: 2 },
      view = render(<BooleanCircuit {...p} />);
    const not = screen.getByRole("button", { name: "门 1 设为非 NOT" });
    not.focus();
    await user.keyboard(" ");
    expect(
      (
        view.container.querySelector(
          '[data-circuit-field="b"]',
        ) as HTMLSelectElement
      ).disabled,
    ).toBe(true);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "门 1 左端接线" }),
      "A",
    );
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("cargo pause blocks clicks/shortcuts, consumes hint/undo tokens, and completion remains idempotent", () => {
    const p = props(),
      view = render(
        <StrictMode>
          <StackQueueWorkshop {...p} />
        </StrictMode>,
      );
    const root = () => view.container.querySelector("[data-cargo-game]")!;
    fireEvent.keyDown(root(), { key: "1" });
    expect(cargoSnapshot(view.container)).toEqual(["1", "A", "", ""]);
    view.rerender(
      <StrictMode>
        <StackQueueWorkshop {...p} paused hintToken={1} undoToken={1} />
      </StrictMode>,
    );
    clickCargo(view.container, "input-output");
    fireEvent.keyDown(root(), { key: "3" });
    expect(cargoSnapshot(view.container)).toEqual(["1", "A", "", ""]);
    view.rerender(
      <StrictMode>
        <StackQueueWorkshop {...p} hintToken={1} undoToken={1} />
      </StrictMode>,
    );
    expect(cargoSnapshot(view.container)[1]).toBe("A");
    expect(view.container.querySelector(".sq-hinted")).toBeNull();
    fireEvent.keyDown(root(), { key: "3", repeat: true });
    expect(cargoSnapshot(view.container)[0]).toBe("1");
    for (const key of ["3", "4", "3"]) fireEvent.keyDown(root(), { key });
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(root(), { key: "1" });
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <StackQueueWorkshop {...p} hintToken={1} undoToken={2} />
      </StrictMode>,
    );
    fireEvent.keyDown(root(), { key: "3" });
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <StackQueueWorkshop {...p} resetToken={1} hintToken={8} undoToken={8} />
      </StrictMode>,
    );
    expect(cargoSnapshot(view.container)).toEqual(["0", "", "", ""]);
    expect(view.container.querySelector(".sq-hinted")).toBeNull();
    stackQueueLevels[0].solution.forEach((move) =>
      clickCargo(view.container, move),
    );
    expect(p.onComplete).toHaveBeenCalledTimes(2);
    view.rerender(<StackQueueWorkshop {...p} level={11} />);
    expect(cargoSnapshot(view.container)).toEqual(["0", "", "", ""]);
  });
  it("shows current-state hints without moving any pieces and does not replay unchanged tokens", () => {
    const p = props(),
      view = render(<StackQueueWorkshop {...p} />);
    clickCargo(view.container, "input-queue");
    view.rerender(<StackQueueWorkshop {...p} hintToken={1} />);
    expect(
      view.container
        .querySelector(".sq-hinted")
        ?.getAttribute("data-cargo-move"),
    ).toBe("input-output");
    expect(cargoSnapshot(view.container)).toEqual(["1", "", "A", ""]);
    clickCargo(view.container, "input-output");
    expect(view.container.querySelector(".sq-hinted")).toBeNull();
    view.rerender(<StackQueueWorkshop {...p} hintToken={1} />);
    expect(view.container.querySelector(".sq-hinted")).toBeNull();
    view.unmount();
    const circuit = render(<BooleanCircuit {...p} />);
    circuit.rerender(<BooleanCircuit {...p} hintToken={1} />);
    expect(circuit.container.querySelector(".bc-hinted")).not.toBeNull();
    expect(
      circuit.container
        .querySelector('[data-circuit-op="AND"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("false");
    fireEvent.click(circuit.container.querySelector('[data-circuit-op="OR"]')!);
    expect(circuit.container.querySelector(".bc-hinted")).toBeNull();
    circuit.rerender(<BooleanCircuit {...p} hintToken={1} />);
    expect(circuit.container.querySelector(".bc-hinted")).toBeNull();
  });
});
