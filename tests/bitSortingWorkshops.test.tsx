// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BinaryCourier from "../src/games/BinaryCourier";
import SortingNetworkWorkshop from "../src/games/SortingNetworkWorkshop";
import {
  applyBinaryCard,
  BINARY_STATE_LIMIT,
  binaryBits,
  binaryCourierLevels,
  binaryHint,
  binaryWon,
  createBinaryState,
  executeBinaryOp,
  initialBinaryBoard,
  moveBinary,
  searchBinary,
  undoBinary,
  validBinaryBoard,
  validBinaryLevel,
  type BinaryBoard,
  type BinaryCard,
  type BinaryLevel,
  type BinaryOp,
} from "../src/games/binaryCourierLogic";
import {
  applySortingMove,
  createSortingState,
  moveSorting,
  sortingHint,
  sortingMoveProblem,
  sortingNetworkLevels,
  sortingNextMove,
  sortingPairKey,
  sortingWon,
  traceSorting,
  undoSorting,
  validSortingGates,
  validSortingLevel,
  verifySorting,
  type SortingGates,
  type SortingLevel,
  type SortingPair,
} from "../src/games/sortingNetworkLogic";

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
// Independent string-based bit interpreter: no production bitwise math, state
// transitions, search, mask, or formatting helpers are used to certify levels.
function bitOracle(width: number, value: number, card: BinaryCard): number {
  const source = value.toString(2).padStart(width, "0");
  const mask = card.operand.toString(2).padStart(width, "0");
  const zeroes = "0".repeat(card.operand);
  let output: string;
  if (card.op === "SHL") output = source.slice(card.operand) + zeroes;
  else if (card.op === "SHR")
    output = zeroes + source.slice(0, width - card.operand);
  else
    output = [...source]
      .map((bit, i) => {
        const a = bit === "1",
          b = mask[i] === "1";
        return Number(
          card.op === "NOT"
            ? !a
            : card.op === "AND"
              ? a && b
              : card.op === "OR"
                ? a || b
                : a !== b,
        );
      })
      .join("");
  return parseInt(output, 2);
}
function bitOracleDistance(
  level: BinaryLevel,
  start: BinaryBoard = {
    value: level.start,
    remaining: level.cards.map((card) => card.count),
  },
): number | null {
  const queue = [
    { value: start.value, inventory: [...start.remaining], depth: 0 },
  ];
  const seen = new Set<string>();
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (current.value === level.target) return current.depth;
    for (let card = level.cards.length - 1; card >= 0; card--) {
      if (current.inventory[card] === 0) continue;
      const value = bitOracle(level.width, current.value, level.cards[card]);
      const inventory = [...current.inventory];
      inventory[card]--;
      const key = JSON.stringify([value, inventory]);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ value, inventory, depth: current.depth + 1 });
    }
  }
  return null;
}
// Separate numeric compare-and-swap implementation. Tests check the complete
// permutation domain independently of the production zero-one verifier.
function networkOracle(gates: SortingGates, input: number[]): number[] {
  const output = [...input];
  for (const stage of gates) {
    const touched = new Set<number>();
    for (const pair of stage) {
      if (!pair) continue;
      const [a, b] = pair;
      if (
        a < 0 ||
        b >= input.length ||
        a >= b ||
        touched.has(a) ||
        touched.has(b)
      )
        throw new Error("Invalid parallel comparator");
      touched.add(a);
      touched.add(b);
      if (output[a] > output[b]) {
        const temporary = output[a];
        output[a] = output[b];
        output[b] = temporary;
      }
    }
  }
  return output;
}
function permutations(values: number[]): number[][] {
  if (values.length === 0) return [[]];
  return values.flatMap((value, index) =>
    permutations(values.filter((_, i) => i !== index)).map((rest) => [
      value,
      ...rest,
    ]),
  );
}
function bitVectors(width: number, alphabet = [0, 1]): number[][] {
  return width === 0
    ? [[]]
    : alphabet.flatMap((value) =>
        bitVectors(width - 1, alphabet).map((rest) => [value, ...rest]),
      );
}
const sorted = (values: number[]) => [...values].sort((a, b) => a - b);
function clickBinary(container: HTMLElement, card: number) {
  fireEvent.click(container.querySelector(`[data-binary-card="${card}"]`)!);
}
function chooseGate(
  container: HTMLElement,
  stage: number,
  slot: number,
  pair: SortingPair | null,
) {
  fireEvent.change(
    container.querySelector(
      `[data-sorting-stage="${stage}"][data-sorting-slot="${slot}"]`,
    )!,
    { target: { value: sortingPairKey(pair) } },
  );
}
function fillNetwork(container: HTMLElement, level: SortingLevel) {
  level.solution.forEach((stage, s) =>
    stage.forEach((pair, slot) => {
      if (level.fixed[s][slot] === null) chooseGate(container, s, slot, pair);
    }),
  );
}
const binarySnapshot = (container: HTMLElement) => {
  const root = container.querySelector("[data-binary-game]")!;
  return [
    root.getAttribute("data-binary-bits"),
    root.getAttribute("data-binary-remaining"),
  ];
};
const sortingSnapshot = (container: HTMLElement) =>
  container
    .querySelector("[data-sorting-game]")!
    .getAttribute("data-sorting-gates");

describe("BinaryCourier: independent certificates and deterministic rules", () => {
  it("certifies 12 original levels, every consumption, and the true shortest distances", () => {
    expect(binaryCourierLevels).toHaveLength(12);
    expect(
      new Set(
        binaryCourierLevels.map((l) => `${l.width}:${l.start}:${l.target}`),
      ).size,
    ).toBe(12);
    expect(binaryCourierLevels.map((l) => l.par)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    ]);
    for (const level of binaryCourierLevels) {
      expect(validBinaryLevel(level)).toBe(true);
      let value = level.start;
      const inventory = level.cards.map((card) => card.count);
      let state = createBinaryState(level);
      expect(binaryWon(level, state.board)).toBe(false);
      for (const card of level.solution) {
        expect(inventory[card]).toBeGreaterThan(0);
        inventory[card]--;
        value = bitOracle(level.width, value, level.cards[card]);
        state = moveBinary(level, state, card);
        expect(state.board).toEqual({ value, remaining: inventory });
      }
      expect(value).toBe(level.target);
      expect(binaryWon(level, state.board)).toBe(true);
      expect(bitOracleDistance(level)).toBe(level.par);
      const search = searchBinary(level);
      expect(search.status).toBe("solved");
      expect(search.solution).toHaveLength(level.par);
      expect(search.visited).toBeLessThanOrEqual(BINARY_STATE_LIMIT);
    }
  });
  it("exhausts all 2–4 bit values and masks for all six operations", () => {
    for (let width = 2; width <= 4; width++) {
      for (let value = 0; value < 2 ** width; value++) {
        const cards: BinaryCard[] = [{ op: "NOT", operand: 0, count: 1 }];
        for (let shift = 1; shift < width; shift++)
          for (const op of ["SHL", "SHR"] as BinaryOp[])
            cards.push({ op, operand: shift, count: 1 });
        for (let operand = 0; operand < 2 ** width; operand++)
          for (const op of ["AND", "OR", "XOR"] as BinaryOp[])
            cards.push({ op, operand, count: 1 });
        for (const card of cards) {
          const result = executeBinaryOp(width, value, card);
          expect(result).toBe(bitOracle(width, value, card));
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThan(2 ** width);
        }
      }
    }
    expect(
      executeBinaryOp(4, 0b1101, { op: "SHL", operand: 2, count: 1 }),
    ).toBe(0b0100);
    expect(
      executeBinaryOp(4, 0b1101, { op: "SHR", operand: 2, count: 1 }),
    ).toBe(0b0011);
    expect(executeBinaryOp(4, 0, { op: "NOT", operand: 0, count: 1 })).toBe(15);
  });
  it("search matches an independent exhaustive oracle on every two-bit start and target", () => {
    const cards: BinaryCard[] = [
      { op: "SHL", operand: 1, count: 1 },
      { op: "SHR", operand: 1, count: 1 },
      { op: "XOR", operand: 1, count: 2 },
      { op: "NOT", operand: 0, count: 1 },
    ];
    for (let start = 0; start < 4; start++)
      for (let target = 0; target < 4; target++) {
        const level = {
          ...binaryCourierLevels[0],
          width: 2,
          start,
          target,
          cards,
        };
        for (const remaining of bitVectors(cards.length)) {
          const board = { value: start, remaining };
          const distance = bitOracleDistance(level, board),
            actual = searchBinary(level, board);
          expect(actual.status).toBe(
            distance === null ? "unreachable" : "solved",
          );
          expect(actual.solution?.length ?? null).toBe(distance);
        }
      }
  });
  it("accepts alternate solutions and makes no state changes on malformed or exhausted moves", () => {
    const level = binaryCourierLevels[1];
    expect(
      binaryWon(level, moveBinary(level, createBinaryState(level), 2).board),
    ).toBe(true); // SHR instead of NOT.
    const original = freeze(createBinaryState(binaryCourierLevels[3]));
    const next = moveBinary(binaryCourierLevels[3], original, 0);
    expect(next.board.value).toBe(0b10100);
    expect(next.board.remaining[0]).toBe(0);
    expect(moveBinary(binaryCourierLevels[3], next, 0)).toBe(next);
    expect(undoBinary(freeze(next))).toEqual(original);
    expect(undoBinary(original)).toBe(original);
    for (const index of [-1, 0.5, 9, NaN])
      expect(
        applyBinaryCard(binaryCourierLevels[3], original.board, index),
      ).toBeNull();
    expect(validBinaryBoard(level, { value: 16, remaining: [1, 1, 1] })).toBe(
      false,
    );
    expect(validBinaryBoard(level, { value: 2, remaining: [1, -1, 1] })).toBe(
      false,
    );
    expect(validBinaryBoard(level, { value: 2, remaining: [1, 1] })).toBe(
      false,
    );
    expect(validBinaryLevel({ ...level, width: 31 })).toBe(false);
    expect(
      validBinaryLevel({
        ...level,
        cards: [{ op: "SHL", operand: 0, count: 1 }],
      }),
    ).toBe(false);
    expect(
      validBinaryLevel({
        ...level,
        cards: [{ op: "XOR", operand: 16, count: 1 }],
      }),
    ).toBe(false);
    expect(
      validBinaryLevel({
        ...level,
        cards: [{ op: "NOT", operand: 0, count: 0 }],
      }),
    ).toBe(false);
  });
  it("hints solve from actual remaining inventory, distinguish impossibility from the search bound, and never mutate", () => {
    for (const level of binaryCourierLevels) {
      let board = freeze(initialBinaryBoard(level));
      for (let step = 0; step < 10 && !binaryWon(level, board); step++) {
        const before = JSON.stringify(board),
          hint = binaryHint(level, board);
        expect(JSON.stringify(board)).toBe(before);
        expect(hint.card).not.toBeNull();
        board = freeze(applyBinaryCard(level, board, hint.card!)!);
      }
      expect(binaryWon(level, board)).toBe(true);
    }
    const level = binaryCourierLevels[0],
      dead = applyBinaryCard(level, initialBinaryBoard(level), 1)!;
    expect(binaryHint(level, dead).text).toContain("已无法");
    expect(binaryHint(level, dead).card).toBeNull();
    const limited = binaryHint(
      binaryCourierLevels[11],
      initialBinaryBoard(binaryCourierLevels[11]),
      1,
    );
    expect(limited.text).toContain("不代表无解");
    expect(limited.card).toBeNull();
    expect(searchBinary(level, { value: -1, remaining: [1, 1] }).status).toBe(
      "invalid",
    );
    expect(searchBinary(level, initialBinaryBoard(level), 0).visited).toBe(1);
  });
});

describe("SortingNetworkWorkshop: all-input certificates and pure rules", () => {
  it("certifies all 12 networks against every binary input AND every distinct permutation", () => {
    expect(sortingNetworkLevels).toHaveLength(12);
    expect(
      new Set(
        sortingNetworkLevels.map((l) =>
          JSON.stringify([l.lanes, l.slots, l.fixed, l.adjacentOnly]),
        ),
      ).size,
    ).toBe(12);
    for (const level of sortingNetworkLevels) {
      expect(validSortingLevel(level)).toBe(true);
      expect(sortingWon(level, createSortingState(level).gates)).toBe(false);
      for (const input of [
        ...bitVectors(level.lanes),
        ...permutations(Array.from({ length: level.lanes }, (_, i) => i)),
      ]) {
        const expected = sorted(input);
        expect(networkOracle(level.solution, input)).toEqual(expected);
        expect(traceSorting(level, level.solution, input)!.at(-1)).toEqual(
          expected,
        );
      }
      const report = verifySorting(level, level.solution);
      expect(report).toEqual({
        valid: true,
        total: 2 ** level.lanes,
        passed: 2 ** level.lanes,
        counterexample: null,
      });
      expect(sortingWon(level, level.solution)).toBe(true);
      const duplicateNegative = Array.from(
        { length: level.lanes },
        (_, i) => [-5, 2.5, -5, 0, 2.5, -9][i],
      );
      expect(
        traceSorting(level, level.solution, duplicateNegative)!.at(-1),
      ).toEqual(sorted(duplicateNegative));
    }
  });
  it("exhausts all 64 three-line networks and independently checks zero-one/permutation agreement", () => {
    const level = sortingNetworkLevels[2];
    const choices: (SortingPair | null)[] = [null, [0, 1], [0, 2], [1, 2]];
    for (const a of choices)
      for (const b of choices)
        for (const c of choices) {
          const gates = [[a], [b], [c]];
          const expectedPassed = bitVectors(3).filter(
            (input) =>
              JSON.stringify(networkOracle(gates, input)) ===
              JSON.stringify(sorted(input)),
          ).length;
          const sortsPermutations = permutations([0, 1, 2]).every(
            (input) =>
              JSON.stringify(networkOracle(gates, input)) ===
              JSON.stringify(sorted(input)),
          );
          expect(verifySorting(level, gates).passed).toBe(expectedPassed);
          expect(sortingWon(level, gates)).toBe(sortsPermutations);
          if (!sortsPermutations) {
            const failure = verifySorting(level, gates).counterexample!;
            expect(networkOracle(gates, failure.input)).toEqual(failure.output);
            expect(failure.output).not.toEqual(sorted(failure.input));
          }
          // Current-state hints must always be legal, even from alternate layouts.
          let state = { gates, history: [] as SortingGates[] };
          for (
            let steps = 0;
            steps < 8 && !sortingWon(level, state.gates);
            steps++
          ) {
            const move = sortingNextMove(level, state.gates)!;
            expect(sortingMoveProblem(level, state.gates, move)).toBeNull();
            state = moveSorting(level, state, move);
          }
          expect(sortingWon(level, state.gates)).toBe(true);
        }
  });
  it("exhausts every two-slot parallel pairing and rejects lane reuse, bad indices, and fixed edits", () => {
    const level = sortingNetworkLevels[5];
    const pairs: (SortingPair | null)[] = [
      null,
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ];
    for (const a of pairs)
      for (const b of pairs) {
        const expected = !a || !b || !a.some((lane) => b.includes(lane));
        const gates: SortingGates = [[a, b], [null, null], [null]];
        expect(validSortingGates(level, gates)).toBe(expected);
      }
    const blank = createSortingState(level).gates;
    expect(
      applySortingMove(level, blank, { stage: -1, slot: 0, pair: [0, 1] }),
    ).toBeNull();
    expect(
      applySortingMove(level, blank, { stage: 0, slot: 0, pair: [2, 1] }),
    ).toBeNull();
    expect(
      applySortingMove(level, blank, { stage: 0, slot: 0, pair: [0, 4] }),
    ).toBeNull();
    expect(
      applySortingMove(level, blank, { stage: 0, slot: 0, pair: [0, 0] }),
    ).toBeNull();
    expect(
      applySortingMove(level, blank, { stage: 0, slot: 0, pair: [0, 1.5] }),
    ).toBeNull();
    const fixed = sortingNetworkLevels[3];
    expect(
      applySortingMove(fixed, createSortingState(fixed).gates, {
        stage: 0,
        slot: 0,
        pair: null,
      }),
    ).toBeNull();
    const neighborOnly = sortingNetworkLevels[6];
    expect(
      applySortingMove(neighborOnly, createSortingState(neighborOnly).gates, {
        stage: 1,
        slot: 0,
        pair: [0, 2],
      }),
    ).toBeNull();
    expect(traceSorting(level, blank, [1, 0])).toBeNull();
    expect(traceSorting(level, blank, [1, NaN, 0, 1])).toBeNull();
    expect(validSortingLevel({ ...level, lanes: 7 })).toBe(false);
    expect(validSortingLevel({ ...level, slots: [3] })).toBe(false);
  });
  it("accepts alternate networks, bypass slots, and preserves values for all small duplicate inputs", () => {
    const level = sortingNetworkLevels[2],
      alternate: SortingGates = [[[1, 2]], [[0, 1]], [[1, 2]]];
    expect(sortingWon(level, alternate)).toBe(true);
    for (const input of bitVectors(3, [-1, 0, 2]))
      expect(traceSorting(level, alternate, input)!.at(-1)).toEqual(
        sorted(input),
      );
    const roomy: SortingLevel = {
      ...sortingNetworkLevels[0],
      slots: [1, 1],
      fixed: [[null], [null]],
      solution: [[[0, 1]], [null]],
    };
    expect(sortingWon(roomy, [[[0, 1]], [null]])).toBe(true);
    const initial = freeze(createSortingState(level));
    const next = moveSorting(level, initial, {
      stage: 0,
      slot: 0,
      pair: [0, 2],
    });
    expect(next).not.toBe(initial);
    expect(undoSorting(freeze(next))).toEqual(initial);
    expect(undoSorting(initial)).toBe(initial);
    expect(moveSorting(level, initial, { stage: 0, slot: 0, pair: null })).toBe(
      initial,
    );
    const solved = { gates: alternate, history: [] };
    expect(moveSorting(level, solved, { stage: 0, slot: 0, pair: null })).toBe(
      solved,
    );
  });
  it("constructive hints release conflicts, preserve givens, and reach a certified design from every level", () => {
    for (const level of sortingNetworkLevels) {
      let state = freeze(createSortingState(level));
      for (let step = 0; step < 36 && !sortingWon(level, state.gates); step++) {
        const before = JSON.stringify(state),
          hint = sortingHint(level, state.gates);
        expect(JSON.stringify(state)).toBe(before);
        expect(hint.move).not.toBeNull();
        expect(hint.text).toContain("不是唯一答案");
        expect(sortingMoveProblem(level, state.gates, hint.move!)).toBeNull();
        state = freeze(moveSorting(level, state, hint.move!));
      }
      expect(sortingWon(level, state.gates)).toBe(true);
    }
    const level = sortingNetworkLevels[5],
      gates: SortingGates = [
        [
          [2, 3],
          [0, 1],
        ],
        [null, null],
        [null],
      ];
    const before = JSON.stringify(gates),
      hint = sortingHint(level, gates);
    expect(hint.move).toEqual({ stage: 0, slot: 1, pair: null });
    expect(hint.text).toContain("先释放");
    expect(JSON.stringify(gates)).toBe(before);
    const invalid = [
      [
        [0, 1],
        [0, 2],
      ],
      [null, null],
      [null],
    ] as SortingGates;
    expect(sortingHint(level, invalid).move).toBeNull();
    expect(verifySorting(level, invalid).valid).toBe(false);
  });
});

describe("BinaryCourier: rendered controls and lifecycle", () => {
  it("finishes every level using actual card buttons", () => {
    binaryCourierLevels.forEach((level, index) => {
      const p = { ...props(), level: index },
        view = render(<BinaryCourier {...p} />);
      level.solution.forEach((card) => clickBinary(view.container, card));
      expect(
        view.container
          .querySelector("[data-binary-game]")!
          .getAttribute("data-binary-bits"),
      ).toBe(binaryBits(level.width, level.target));
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        [
          ...view.container.querySelectorAll<HTMLButtonElement>(
            "[data-binary-card]",
          ),
        ].every((button) => button.disabled),
      ).toBe(true);
      view.unmount();
    });
  });
  it("pauses card/hint/undo controls, consumes paused tokens, and remounts fresh on reset or level change", () => {
    const p = { ...props(), level: 3 },
      view = render(<BinaryCourier {...p} />);
    clickBinary(view.container, 1);
    const changed = binarySnapshot(view.container);
    view.rerender(<BinaryCourier {...p} paused hintToken={1} undoToken={1} />);
    clickBinary(view.container, 0);
    fireEvent.keyDown(view.container.querySelector("[data-binary-game]")!, {
      key: "1",
    });
    expect(binarySnapshot(view.container)).toEqual(changed);
    expect(p.onComplete).not.toHaveBeenCalled();
    view.rerender(<BinaryCourier {...p} hintToken={1} undoToken={1} />);
    expect(binarySnapshot(view.container)).toEqual(changed);
    expect(view.container.querySelector(".by-hinted")).toBeNull();
    view.rerender(<BinaryCourier {...p} hintToken={2} undoToken={1} />);
    expect(view.container.querySelector(".by-hinted")).not.toBeNull();
    expect(binarySnapshot(view.container)).toEqual(changed);
    view.rerender(<BinaryCourier {...p} hintToken={2} undoToken={2} />);
    expect(binarySnapshot(view.container)[0]).toBe("10101");
    expect(view.container.querySelector(".by-hinted")).toBeNull();
    clickBinary(view.container, 0);
    view.rerender(
      <BinaryCourier {...p} resetToken={1} hintToken={2} undoToken={2} />,
    );
    expect(binarySnapshot(view.container)[0]).toBe("10101");
    expect(binarySnapshot(view.container)[1]).toBe("1,1,1,1");
    view.rerender(
      <BinaryCourier
        {...p}
        level={4}
        resetToken={1}
        hintToken={2}
        undoToken={2}
      />,
    );
    expect(binarySnapshot(view.container)[0]).toBe("01011");
    expect(view.container.querySelector(".by-hinted")).toBeNull();
  });
  it("supports keyboard cards, ignores repeat/modifiers, and notifies once even after undo/recompletion in StrictMode", async () => {
    const user = userEvent.setup(),
      p = props(),
      view = render(
        <StrictMode>
          <BinaryCourier {...p} />
        </StrictMode>,
      );
    const root =
      view.container.querySelector<HTMLElement>("[data-binary-game]")!;
    root.focus();
    fireEvent.keyDown(root, { key: "1", repeat: true });
    fireEvent.keyDown(root, { key: "1", ctrlKey: true });
    expect(binarySnapshot(view.container)[0]).toBe("0011");
    await user.keyboard("1");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <BinaryCourier {...p} undoToken={1} />
      </StrictMode>,
    );
    expect(binarySnapshot(view.container)[0]).toBe("0011");
    clickBinary(view.container, 0);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <BinaryCourier {...p} resetToken={1} undoToken={1} />
      </StrictMode>,
    );
    const card = view.container.querySelector<HTMLButtonElement>(
      "[data-binary-card='0']",
    )!;
    card.focus();
    await user.keyboard(" ");
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
  it("shows an honest dead-end hint after a divergent move and accepts the alternate card", () => {
    const p = props(),
      view = render(<BinaryCourier {...p} />);
    clickBinary(view.container, 1);
    view.rerender(<BinaryCourier {...p} hintToken={1} />);
    expect(p.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("已无法"),
    );
    expect(view.container.querySelector(".by-hinted")).toBeNull();
    view.rerender(<BinaryCourier {...p} level={1} hintToken={1} />);
    clickBinary(view.container, 2);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("SortingNetworkWorkshop: rendered controls and lifecycle", () => {
  it("finishes all levels using actual gate selectors and checks every displayed input count", () => {
    sortingNetworkLevels.forEach((level, index) => {
      const p = { ...props(), level: index },
        view = render(<SortingNetworkWorkshop {...p} />);
      fillNetwork(view.container, level);
      expect(
        view.container
          .querySelector("[data-sorting-game]")!
          .getAttribute("data-sorting-won"),
      ).toBe("true");
      expect(
        view.container
          .querySelector("[data-sorting-game]")!
          .getAttribute("data-sorting-passed"),
      ).toBe(String(2 ** level.lanes));
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      view.unmount();
    });
  });
  it("never awards completion for just the preview and accepts a genuinely different network", async () => {
    const user = userEvent.setup(),
      p = { ...props(), level: 2 },
      view = render(<SortingNetworkWorkshop {...p} />);
    const input = view.container.querySelector<HTMLButtonElement>(
      "[data-sorting-input='0']",
    )!;
    input.focus();
    await user.keyboard(" ");
    expect(
      view.container
        .querySelector("[data-sorting-output]")!
        .getAttribute("data-sorting-output"),
    ).toBe("000");
    expect(p.onComplete).not.toHaveBeenCalled();
    const before = sortingSnapshot(view.container);
    fireEvent.click(
      view.container.querySelector("[data-sorting-counterexample]")!,
    );
    expect(sortingSnapshot(view.container)).toBe(before);
    expect(
      view.container.querySelector("[data-sorting-output]")!.textContent,
    ).toContain("尚未排序");
    await user.selectOptions(
      view.container.querySelector<HTMLSelectElement>(
        "[data-sorting-stage='0'][data-sorting-slot='0']",
      )!,
      "1-2",
    );
    chooseGate(view.container, 1, 0, [0, 1]);
    chooseGate(view.container, 2, 0, [1, 2]);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("rejects conflicting selectors, hints by clearing a collision, and leaves fixed gates immutable", () => {
    const p = { ...props(), level: 5 },
      view = render(<SortingNetworkWorkshop {...p} />);
    chooseGate(view.container, 0, 0, [2, 3]);
    chooseGate(view.container, 0, 1, [0, 1]);
    const before = sortingSnapshot(view.container);
    chooseGate(view.container, 0, 1, [1, 2]);
    expect(sortingSnapshot(view.container)).toBe(before);
    view.rerender(<SortingNetworkWorkshop {...p} hintToken={1} />);
    expect(p.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("先释放"),
    );
    expect(sortingSnapshot(view.container)).toBe(before);
    chooseGate(view.container, 0, 1, null);
    expect(sortingSnapshot(view.container)).not.toBe(before);
    view.rerender(<SortingNetworkWorkshop {...p} level={3} hintToken={1} />);
    const fixed = view.container.querySelector<HTMLSelectElement>(
      "[data-sorting-stage='0'][data-sorting-slot='0']",
    )!;
    expect(fixed.disabled).toBe(true);
    const original = sortingSnapshot(view.container);
    chooseGate(view.container, 0, 0, null);
    expect(sortingSnapshot(view.container)).toBe(original);
  });
  it("pauses every control, discards paused hint/undo tokens, and resets network and preview with the epoch", () => {
    const p = { ...props(), level: 2 },
      view = render(<SortingNetworkWorkshop {...p} />);
    chooseGate(view.container, 0, 0, [0, 1]);
    const changed = sortingSnapshot(view.container);
    view.rerender(
      <SortingNetworkWorkshop {...p} paused hintToken={1} undoToken={1} />,
    );
    expect(
      [
        ...view.container.querySelectorAll<
          HTMLButtonElement | HTMLSelectElement
        >("button,select"),
      ].every((control) => control.disabled),
    ).toBe(true);
    chooseGate(view.container, 1, 0, [1, 2]);
    expect(sortingSnapshot(view.container)).toBe(changed);
    view.rerender(
      <SortingNetworkWorkshop {...p} hintToken={1} undoToken={1} />,
    );
    expect(sortingSnapshot(view.container)).toBe(changed);
    expect(view.container.querySelector(".sn-hinted")).toBeNull();
    view.rerender(
      <SortingNetworkWorkshop {...p} hintToken={2} undoToken={1} />,
    );
    expect(view.container.querySelector(".sn-hinted")).not.toBeNull();
    expect(sortingSnapshot(view.container)).toBe(changed);
    view.rerender(
      <SortingNetworkWorkshop {...p} hintToken={2} undoToken={2} />,
    );
    expect(sortingSnapshot(view.container)).toBe(
      JSON.stringify(createSortingState(sortingNetworkLevels[2]).gates),
    );
    expect(view.container.querySelector(".sn-hinted")).toBeNull();
    chooseGate(view.container, 0, 0, [0, 2]);
    fireEvent.click(view.container.querySelector("[data-sorting-input='0']")!);
    view.rerender(
      <SortingNetworkWorkshop
        {...p}
        resetToken={1}
        hintToken={2}
        undoToken={2}
      />,
    );
    expect(sortingSnapshot(view.container)).toBe(
      JSON.stringify(createSortingState(sortingNetworkLevels[2]).gates),
    );
    expect(
      view.container
        .querySelector("[data-sorting-game]")!
        .getAttribute("data-sorting-row"),
    ).toBe("4");
    view.rerender(
      <SortingNetworkWorkshop
        {...p}
        level={4}
        resetToken={1}
        hintToken={2}
        undoToken={2}
      />,
    );
    expect(sortingSnapshot(view.container)).toBe(
      JSON.stringify(createSortingState(sortingNetworkLevels[4]).gates),
    );
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("completion stays idempotent through StrictMode, undo, repeated props, and starts fresh after reset", () => {
    const p = props(),
      view = render(
        <StrictMode>
          <SortingNetworkWorkshop {...p} />
        </StrictMode>,
      );
    chooseGate(view.container, 0, 0, [0, 1]);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <SortingNetworkWorkshop {...p} hintToken={1} />
      </StrictMode>,
    );
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <SortingNetworkWorkshop {...p} hintToken={1} undoToken={1} />
      </StrictMode>,
    );
    expect(
      view.container
        .querySelector("[data-sorting-game]")!
        .getAttribute("data-sorting-won"),
    ).toBe("false");
    chooseGate(view.container, 0, 0, [0, 1]);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <SortingNetworkWorkshop
          {...p}
          resetToken={1}
          hintToken={1}
          undoToken={1}
        />
      </StrictMode>,
    );
    chooseGate(view.container, 0, 0, [0, 1]);
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
});
