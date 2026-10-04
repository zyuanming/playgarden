// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GameProps } from "../src/lib/types";
import ArithmeticWorkshop from "../src/games/ArithmeticWorkshop";
import WordSearchGarden from "../src/games/WordSearchGarden";
import {
  arithmeticHint,
  arithmeticLevels,
  arithmeticMove,
  arithmeticSolutions,
  calculateRational,
  createArithmeticState,
  formatRational,
  isArithmeticSolved,
  rational,
  rationalEqual,
  solveArithmetic,
  undoArithmetic,
  verifyArithmeticLevel,
  type ArithmeticMove,
  type ArithmeticOperator,
} from "../src/games/arithmeticLogic";
import {
  buildWordSearchLevel,
  chooseWordSearchCell,
  clearWordSearchSelection,
  createWordSearchState,
  isWordSearchSolved,
  matchWordSearchPath,
  undoWordSearch,
  verifyWordSearchLevel,
  wordSearchDirection,
  wordSearchHint,
  wordSearchKeyboardCell,
  wordSearchLevels,
  wordSearchPath,
  wordSearchSolutions,
  type WordSearchLevel,
  type WordSearchState,
} from "../src/games/wordSearchLogic";

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
function card(id: string): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(`[data-token="${id}"]`)!;
}
function operation(operator: ArithmeticOperator): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(
    `[data-operator="${operator}"]`,
  )!;
}
function cell(index: number): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(`[data-cell="${index}"]`)!;
}
function clickArithmeticMove(move: ArithmeticMove) {
  fireEvent.click(card(move.leftId));
  fireEvent.click(card(move.rightId));
  fireEvent.click(operation(move.operator));
}
function findWord(
  level: WordSearchLevel,
  state: WordSearchState,
  start: number,
  end: number,
) {
  return chooseWordSearchCell(
    level,
    chooseWordSearchCell(level, state, start).state,
    end,
  );
}
const overlapLevel: WordSearchLevel = {
  title: "overlapping letters",
  size: 4,
  grid: [
    "星",
    "星",
    "空",
    "白",
    "山",
    "河",
    "日",
    "云",
    "小",
    "鸟",
    "光",
    "月",
    "花",
    "草",
    "树",
    "林",
  ],
  words: ["星星", "星空", "白云"],
  solution: [
    { word: "星星", path: [0, 1], start: 0, end: 1 },
    { word: "星空", path: [1, 2], start: 1, end: 2 },
    { word: "白云", path: [3, 7], start: 3, end: 7 },
  ],
  idea: "shared letters",
};

describe("exact arithmetic and move history", () => {
  it("normalizes fractions, signs and zero without floating-point rounding", () => {
    expect(rational(12, -18)).toEqual({ numerator: -2, denominator: 3 });
    expect(rational(0, -18)).toEqual({ numerator: 0, denominator: 1 });
    expect(
      rationalEqual(rational(1, 3), { numerator: 2, denominator: 6 }),
    ).toBe(true);
    expect(calculateRational(rational(1, 3), rational(1, 6), "+")).toEqual(
      rational(1, 2),
    );
    expect(calculateRational(rational(3), rational(8, 3), "−")).toEqual(
      rational(1, 3),
    );
    expect(calculateRational(rational(8), rational(1, 3), "÷")).toEqual(
      rational(24),
    );
    expect(calculateRational(rational(-2, 3), rational(9, 4), "×")).toEqual(
      rational(-3, 2),
    );
    expect(formatRational(rational(-9, 6))).toBe("-3/2");
    expect(formatRational(rational(6, 3))).toBe("2");
  });
  it("rejects division by zero, invalid rationals, unsafe integer arithmetic and missing cards", () => {
    expect(calculateRational(rational(1), rational(0), "÷")).toBeNull();
    expect(() => rational(1, 0)).toThrow(RangeError);
    expect(() => rational(0.3)).toThrow(RangeError);
    expect(
      calculateRational(rational(Number.MAX_SAFE_INTEGER), rational(2), "×"),
    ).toBeNull();
    const state = createArithmeticState(arithmeticLevels[0]);
    for (const move of [
      { leftId: "n0", rightId: "n0", operator: "+" as const },
      { leftId: "n0", rightId: "missing", operator: "+" as const },
    ])
      expect(arithmeticMove(state, move)).toBe(state);
    const withZero = arithmeticMove(
      createArithmeticState(arithmeticLevels[2]),
      { leftId: "n0", rightId: "n1", operator: "−" },
    );
    expect(
      arithmeticMove(withZero, { leftId: "n2", rightId: "m0", operator: "÷" }),
    ).toBe(withZero);
  });
  it("keeps equal cards distinct and consumes each original card only once", () => {
    const start = createArithmeticState(arithmeticLevels[2]);
    const combined = arithmeticMove(start, {
      leftId: "n0",
      rightId: "n1",
      operator: "+",
    });
    expect(start.tokens).toHaveLength(4);
    expect(combined.tokens.map((token) => token.id)).toEqual([
      "n2",
      "n3",
      "m0",
    ]);
    expect(combined.tokens.at(-1)!.leaves).toEqual([0, 1]);
    expect(
      arithmeticMove(combined, { leftId: "n0", rightId: "m0", operator: "+" }),
    ).toBe(combined);
    expect(undoArithmetic(combined)).toEqual(start);
    expect(undoArithmetic(start)).toBe(start);
  });
  it("preserves operand order and negative intermediate values", () => {
    const initial = createArithmeticState(arithmeticLevels[6]);
    const negative = arithmeticMove(initial, arithmeticLevels[6].solution[0]);
    expect(negative.tokens.at(-1)!.value).toEqual(rational(-3));
    expect(
      arithmeticMove(initial, {
        leftId: "n1",
        rightId: "n0",
        operator: "−",
      }).tokens.at(-1)!.value,
    ).toEqual(rational(3));
  });
  it("finds a legal solution after an off-certificate move", () => {
    const state = arithmeticMove(createArithmeticState(arithmeticLevels[0]), {
      leftId: "n3",
      rightId: "n2",
      operator: "+",
    });
    const solution = solveArithmetic(state)!;
    expect(solution).toHaveLength(2);
    expect(isArithmeticSolved(solution.reduce(arithmeticMove, state))).toBe(
      true,
    );
    expect(arithmeticHint(state)).toEqual({ move: solution[0], undoSteps: 0 });
  });
  it("identifies an impossible current branch and the exact undo distance", () => {
    const initial = createArithmeticState(arithmeticLevels[0]);
    let state = arithmeticMove(initial, {
      leftId: "n0",
      rightId: "n1",
      operator: "+",
    });
    state = arithmeticMove(state, {
      leftId: "m0",
      rightId: "n2",
      operator: "+",
    });
    state = arithmeticMove(state, {
      leftId: "m1",
      rightId: "n3",
      operator: "×",
    });
    expect(solveArithmetic(state)).toBeNull();
    expect(arithmeticHint(state)).toEqual({ move: null, undoSteps: 1 });
    expect(solveArithmetic(undoArithmetic(state))).not.toBeNull();
  });
});

describe("all twelve authored arithmetic certificates", () => {
  it("solves or accurately diagnoses every legal first move in every level", () => {
    const operators: ArithmeticOperator[] = ["+", "−", "×", "÷"];
    for (const level of arithmeticLevels) {
      const initial = createArithmeticState(level);
      for (const left of initial.tokens)
        for (const right of initial.tokens) {
          if (left.id === right.id) continue;
          for (const operator of operators) {
            const state = arithmeticMove(initial, {
              leftId: left.id,
              rightId: right.id,
              operator,
            });
            if (state === initial) continue;
            const solution = solveArithmetic(state);
            if (solution === null)
              expect(arithmeticHint(state)).toEqual({
                move: null,
                undoSteps: 1,
              });
            else {
              expect(solution).toHaveLength(2);
              expect(
                isArithmeticSolved(solution.reduce(arithmeticMove, state)),
              ).toBe(true);
            }
          }
        }
    }
  });
  it("exports twelve levels and three-step certificates", () => {
    expect(arithmeticLevels).toHaveLength(12);
    expect(arithmeticSolutions).toEqual(
      arithmeticLevels.map((level) => level.solution),
    );
    expect(arithmeticLevels.slice(0, 3).map((level) => level.target)).toEqual([
      10, 12, 12,
    ]);
    expect(
      arithmeticLevels.slice(3).every((level) => level.target === 24),
    ).toBe(true);
  });
  for (const [index, level] of arithmeticLevels.entries()) {
    it(`arithmetic level ${index + 1} certificate, independent solver, all current-state hints and complete undo are correct`, () => {
      expect(verifyArithmeticLevel(level)).toBe(true);
      const initial = createArithmeticState(level);
      const solvedBySearch = solveArithmetic(initial)!;
      expect(solvedBySearch).toHaveLength(3);
      expect(
        isArithmeticSolved(solvedBySearch.reduce(arithmeticMove, initial)),
      ).toBe(true);
      let state = initial;
      for (const move of level.solution) {
        const hint = arithmeticHint(state);
        expect(hint.move).not.toBeNull();
        const hintResult = arithmeticMove(state, hint.move!);
        expect(hintResult).not.toBe(state);
        expect(solveArithmetic(hintResult)).not.toBeNull();
        state = arithmeticMove(state, move);
      }
      expect(isArithmeticSolved(state)).toBe(true);
      expect([...state.tokens[0].leaves].sort()).toEqual([0, 1, 2, 3]);
      expect(arithmeticMove(state, level.solution[0])).toBe(state);
      expect(solveArithmetic(state)).toEqual([]);
      expect(arithmeticHint(state)).toEqual({ move: null, undoSteps: 0 });
      while (state.history.length) state = undoArithmetic(state);
      expect(state).toEqual(initial);
    });
    it(`arithmetic level ${index + 1} is playable through semantic buttons and completes once`, () => {
      const p = props({ level: index });
      const view = render(<ArithmeticWorkshop {...p} />);
      for (const move of level.solution) clickArithmeticMove(move);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(document.querySelectorAll("[data-token]")).toHaveLength(1);
      expect(
        document.querySelector("[data-token]")!.getAttribute("data-value"),
      ).toBe(String(level.target));
      view.rerender(<ArithmeticWorkshop {...p} hintToken={2} undoToken={2} />);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(document.querySelectorAll("[data-token]")).toHaveLength(1);
    });
  }
});

describe("arithmetic interaction resilience", () => {
  it("pauses selection, arithmetic, hints and undo without queued actions on resume", () => {
    const p = props();
    const view = render(<ArithmeticWorkshop {...p} />);
    fireEvent.click(card("n0"));
    fireEvent.click(card("n1"));
    view.rerender(
      <ArithmeticWorkshop {...p} paused hintToken={1} undoToken={1} />,
    );
    fireEvent.click(operation("+"));
    fireEvent.click(card("n2"));
    expect(document.querySelectorAll("[data-token]")).toHaveLength(4);
    expect(card("n0").getAttribute("aria-pressed")).toBe("true");
    expect(card("n2").getAttribute("aria-pressed")).toBe("false");
    view.rerender(<ArithmeticWorkshop {...p} hintToken={1} undoToken={1} />);
    expect(document.querySelectorAll("[data-token]")).toHaveLength(4);
    fireEvent.click(operation("+"));
    expect(document.querySelectorAll("[data-token]")).toHaveLength(3);
    view.rerender(<ArithmeticWorkshop {...p} hintToken={1} undoToken={2} />);
    expect(document.querySelectorAll("[data-token]")).toHaveLength(4);
    expect(card("n0").getAttribute("aria-pressed")).toBe("false");
  });
  it("restores an exact operation, resets hints and log, and remounts on level changes", () => {
    const p = props({ level: 8 });
    const view = render(<ArithmeticWorkshop {...p} />);
    clickArithmeticMove(arithmeticLevels[8].solution[0]);
    expect(card("m0").getAttribute("data-value")).toBe("3/4");
    view.rerender(<ArithmeticWorkshop {...p} undoToken={1} />);
    expect(card("n1").getAttribute("data-value")).toBe("3");
    expect(card("n2").getAttribute("data-value")).toBe("4");
    view.rerender(<ArithmeticWorkshop {...p} undoToken={1} hintToken={1} />);
    expect(
      document.querySelectorAll('[data-token][aria-pressed="true"]'),
    ).toHaveLength(2);
    expect(document.querySelectorAll(".mw-operations .mw-hinted")).toHaveLength(
      1,
    );
    view.rerender(
      <ArithmeticWorkshop {...p} resetToken={1} undoToken={1} hintToken={1} />,
    );
    expect(
      document.querySelectorAll('[data-token][aria-pressed="true"]'),
    ).toHaveLength(0);
    expect(
      screen.getByLabelText("运算记录").querySelectorAll("li"),
    ).toHaveLength(0);
    view.rerender(
      <ArithmeticWorkshop
        {...p}
        level={0}
        resetToken={1}
        undoToken={1}
        hintToken={1}
      />,
    );
    expect(screen.getByLabelText("目标 10")).toBeTruthy();
    expect(card("n3").getAttribute("data-value")).toBe("4");
  });
  it("supports deselect, clear, replace selection and swapping operands", () => {
    render(<ArithmeticWorkshop {...props()} />);
    fireEvent.click(card("n0"));
    fireEvent.click(card("n0"));
    expect(card("n0").getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(card("n0"));
    fireEvent.click(card("n1"));
    fireEvent.click(card("n2"));
    expect(
      document.querySelectorAll('[data-token][aria-pressed="true"]'),
    ).toHaveLength(1);
    expect(card("n2").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "清除选择" }));
    fireEvent.click(card("n0"));
    fireEvent.click(card("n1"));
    fireEvent.click(screen.getByRole("button", { name: "交换顺序 ↔" }));
    fireEvent.click(operation("−"));
    expect(card("m0").getAttribute("data-value")).toBe("1");
  });
  it("shows invalid division feedback without consuming cards", () => {
    const p = props({ level: 2 });
    render(<ArithmeticWorkshop {...p} />);
    clickArithmeticMove({ leftId: "n0", rightId: "n1", operator: "−" });
    fireEvent.click(card("n2"));
    fireEvent.click(card("m0"));
    fireEvent.click(operation("÷"));
    expect(document.querySelectorAll("[data-token]")).toHaveLength(3);
    expect(p.onStatus).toHaveBeenLastCalledWith(
      "不能除以 0。换一个运算，或交换两张卡的顺序。",
    );
  });
  it("offers actionable undo feedback instead of a stale initial solution", () => {
    const p = props();
    const view = render(<ArithmeticWorkshop {...p} />);
    clickArithmeticMove(arithmeticLevels[0].solution[0]);
    clickArithmeticMove(arithmeticLevels[0].solution[1]);
    clickArithmeticMove({ leftId: "m1", rightId: "n3", operator: "×" });
    view.rerender(<ArithmeticWorkshop {...p} hintToken={1} />);
    expect(p.onStatus).toHaveBeenLastCalledWith(
      "当前的数字无法再凑成 10。撤销 1 步，就能回到有解的位置。",
    );
  });
  it("supports Enter and Space on cards, with idempotent completion even in StrictMode", async () => {
    const user = userEvent.setup(),
      p = props();
    const view = render(
      <StrictMode>
        <ArithmeticWorkshop {...p} />
      </StrictMode>,
    );
    card("n0").focus();
    await user.keyboard("{Enter}");
    card("n1").focus();
    await user.keyboard(" ");
    operation("+").focus();
    await user.keyboard("{Enter}");
    expect(document.querySelectorAll("[data-token]")).toHaveLength(3);
    for (const move of arithmeticLevels[0].solution.slice(1))
      clickArithmeticMove(move);
    view.rerender(
      <StrictMode>
        <ArithmeticWorkshop {...p} onStatus={vi.fn()} />
      </StrictMode>,
    );
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <ArithmeticWorkshop {...p} resetToken={1} />
      </StrictMode>,
    );
    for (const move of arithmeticLevels[0].solution) clickArithmeticMove(move);
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
});

describe("word paths and repeated letters", () => {
  it("respects exact cell boundaries and distinguishes two reversed target words", () => {
    const reversedWords = {
      ...overlapLevel,
      grid: ["牛", "奶", ...overlapLevel.grid.slice(2)],
      words: ["牛奶", "奶牛"],
    };
    expect(matchWordSearchPath(reversedWords, [0, 1])?.word).toBe("牛奶");
    expect(matchWordSearchPath(reversedWords, [1, 0])?.word).toBe("奶牛");
    expect(
      matchWordSearchPath(
        {
          ...overlapLevel,
          grid: ["星星", "空", ...overlapLevel.grid.slice(2)],
          words: ["星星空"],
        },
        [0, 1],
      ),
    ).toBeNull();
    expect(
      matchWordSearchPath(
        {
          ...overlapLevel,
          grid: ["星", "", "空", ...overlapLevel.grid.slice(3)],
        },
        [0, 1, 2],
      ),
    ).toBeNull();
  });
  it("accepts horizontal, vertical, diagonal and reversed exact paths", () => {
    expect(wordSearchPath(4, 0, 3)).toEqual([0, 1, 2, 3]);
    expect(wordSearchPath(4, 12, 0)).toEqual([12, 8, 4, 0]);
    expect(wordSearchPath(4, 0, 15)).toEqual([0, 5, 10, 15]);
    expect(wordSearchPath(4, 3, 12)).toEqual([3, 6, 9, 12]);
    expect(matchWordSearchPath(overlapLevel, [1, 0])?.word).toBe("星星");
    expect(matchWordSearchPath(overlapLevel, [2, 1])?.path).toEqual([1, 2]);
    expect(matchWordSearchPath(overlapLevel, [7, 3])?.word).toBe("白云");
  });
  it("rejects nonstraight paths, wrapping, prefixes, extra cells and repeated coordinates", () => {
    for (const [start, end] of [
      [0, 6],
      [3, 4],
      [-1, 0],
      [0, 16],
      [NaN, 1],
      [0, 1.5],
    ])
      expect(wordSearchPath(4, start, end)).toBeNull();
    for (const path of [
      [0],
      [0, 0],
      [0, 1, 2],
      [1, 2, 3],
      [3, 4],
      [0, 1, 5],
      [1, 5, 2],
      [3, 7, 11],
    ])
      expect(matchWordSearchPath(overlapLevel, path)).toBeNull();
  });
  it("tracks shared-letter words independently and undoes only the latest found word", () => {
    const initial = createWordSearchState();
    const first = findWord(overlapLevel, initial, 0, 1).state;
    const second = findWord(overlapLevel, first, 1, 2).state;
    expect(second.found.map((found) => found.word)).toEqual(["星星", "星空"]);
    expect(second.found.every((found) => found.path.includes(1))).toBe(true);
    const previous = undoWordSearch(second);
    expect(previous.found).toEqual(first.found);
    expect(previous.start).toBeNull();
    expect(previous.selectedPath).toEqual([]);
    expect(undoWordSearch(previous)).toEqual(initial);
    expect(undoWordSearch(initial)).toBe(initial);
  });
  it("does not double-count reversed duplicate selections and keeps previous work after a miss", () => {
    const first = findWord(overlapLevel, createWordSearchState(), 1, 2).state;
    const duplicate = findWord(overlapLevel, first, 2, 1);
    expect(duplicate.outcome).toBe("duplicate");
    expect(duplicate.state.found).toHaveLength(1);
    const missed = findWord(overlapLevel, duplicate.state, 0, 3);
    expect(missed.outcome).toBe("miss");
    expect(missed.state.found).toEqual(first.found);
    expect(missed.state.selectedPath).toEqual([0, 1, 2, 3]);
    const invalid = findWord(overlapLevel, missed.state, 0, 6);
    expect(invalid.outcome).toBe("invalid");
    expect(invalid.state.found).toEqual(first.found);
    expect(invalid.state.start).toBeNull();
  });
  it("cancels a same-cell endpoint and clears selection without clearing found words", () => {
    const state = findWord(overlapLevel, createWordSearchState(), 0, 1).state;
    const pending = chooseWordSearchCell(overlapLevel, state, 4).state;
    const cleared = chooseWordSearchCell(overlapLevel, pending, 4);
    expect(cleared.outcome).toBe("clear");
    expect(cleared.state.found).toEqual(state.found);
    expect(clearWordSearchSelection(pending)).toEqual(cleared.state);
    expect(chooseWordSearchCell(overlapLevel, state, -1).state).toBe(state);
  });
  it("moves keyboard focus without wrapping edges and supports Home / End", () => {
    expect(wordSearchKeyboardCell(4, 3, "ArrowRight")).toBe(3);
    expect(wordSearchKeyboardCell(4, 0, "ArrowUp")).toBe(0);
    expect(wordSearchKeyboardCell(4, 0, "ArrowDown")).toBe(4);
    expect(wordSearchKeyboardCell(4, 5, "ArrowLeft")).toBe(4);
    expect(wordSearchKeyboardCell(4, 5, "Home")).toBe(4);
    expect(wordSearchKeyboardCell(4, 5, "End")).toBe(7);
    expect(wordSearchKeyboardCell(4, 5, "x")).toBe(5);
  });
});

describe("all twelve deterministic word gardens", () => {
  it("exports diverse certified 4×4 through 8×8 boards covering all eight directions", () => {
    expect(wordSearchLevels).toHaveLength(12);
    expect(
      new Set(wordSearchLevels.map((level) => level.grid.join(""))).size,
    ).toBe(12);
    expect(wordSearchLevels.map((level) => level.size)).toEqual([
      4, 4, 4, 5, 5, 5, 6, 6, 7, 7, 8, 8,
    ]);
    expect(wordSearchSolutions).toEqual(
      wordSearchLevels.map((level) => level.solution),
    );
    expect(
      new Set(
        wordSearchLevels.flatMap((level) =>
          level.solution.map((item) =>
            wordSearchDirection(item.path, level.size),
          ),
        ),
      ).size,
    ).toBe(8);
  });
  it("generates the same grid from a blueprint without Math.random", () => {
    const blueprint = {
      title: "test",
      size: 4,
      words: ["星星", "白云", "天空"],
      idea: "test",
      seed: 29,
    };
    const spy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Nondeterministic randomness");
    });
    try {
      expect(buildWordSearchLevel(blueprint)).toEqual(
        buildWordSearchLevel(blueprint),
      );
    } finally {
      spy.mockRestore();
    }
    expect(() =>
      buildWordSearchLevel({ ...blueprint, words: ["白云", "白云"] }),
    ).toThrow(RangeError);
  });
  for (const [index, level] of wordSearchLevels.entries()) {
    it(`word level ${index + 1} has exact certificates, accepts both directions, and hints every remaining word`, () => {
      expect(verifyWordSearchLevel(level)).toBe(true);
      let state = createWordSearchState();
      expect(isWordSearchSolved(level, state)).toBe(false);
      for (const solution of level.solution) {
        const hint = wordSearchHint(level, state)!;
        expect(hint.word).toBe(solution.word);
        expect(matchWordSearchPath(level, hint.path)?.word).toBe(hint.word);
        expect(
          matchWordSearchPath(level, [...solution.path].reverse())?.word,
        ).toBe(solution.word);
        const result = findWord(level, state, solution.end, solution.start);
        expect(result.outcome).toBe("found");
        state = result.state;
      }
      expect(isWordSearchSolved(level, state)).toBe(true);
      expect(wordSearchHint(level, state)).toBeNull();
      expect(chooseWordSearchCell(level, state, 0).state).toBe(state);
      while (state.found.length) state = undoWordSearch(state);
      expect(state).toEqual(createWordSearchState());
    });
    it(`word level ${index + 1} is playable with endpoint clicks and completes once`, () => {
      const p = props({ level: index });
      const view = render(<WordSearchGarden {...p} />);
      for (const solution of level.solution) {
        fireEvent.click(cell(solution.end));
        fireEvent.click(cell(solution.start));
      }
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        document.querySelectorAll('[data-word][data-complete="true"]'),
      ).toHaveLength(level.words.length);
      view.rerender(<WordSearchGarden {...p} hintToken={1} undoToken={1} />);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        document.querySelectorAll('[data-word][data-complete="true"]'),
      ).toHaveLength(level.words.length);
    });
  }
});

describe("word-search interaction resilience", () => {
  it("blocks cells, hint and undo while paused and resumes the pending endpoint unchanged", () => {
    const p = props(),
      solution = wordSearchLevels[0].solution[0];
    const view = render(<WordSearchGarden {...p} />);
    fireEvent.click(cell(solution.start));
    view.rerender(
      <WordSearchGarden {...p} paused hintToken={1} undoToken={1} />,
    );
    fireEvent.click(cell(solution.end));
    expect(
      document.querySelectorAll('[data-word][data-complete="true"]'),
    ).toHaveLength(0);
    expect(cell(solution.start).getAttribute("aria-pressed")).toBe("true");
    view.rerender(<WordSearchGarden {...p} hintToken={1} undoToken={1} />);
    expect(document.querySelectorAll(".mw-word-cell.mw-hinted")).toHaveLength(
      0,
    );
    fireEvent.click(cell(solution.end));
    expect(
      document.querySelectorAll('[data-word][data-complete="true"]'),
    ).toHaveLength(1);
  });
  it("hints without auto-finding, undoes a found word, and resets every selection marker", () => {
    const p = props(),
      first = wordSearchLevels[0].solution[0];
    const view = render(<WordSearchGarden {...p} />);
    view.rerender(<WordSearchGarden {...p} hintToken={1} />);
    expect(document.querySelectorAll(".mw-word-cell.mw-hinted")).toHaveLength(
      first.path.length,
    );
    expect(
      document.querySelectorAll('[data-word][data-complete="true"]'),
    ).toHaveLength(0);
    fireEvent.click(cell(first.start));
    fireEvent.click(cell(first.end));
    view.rerender(<WordSearchGarden {...p} hintToken={1} undoToken={1} />);
    expect(
      document.querySelectorAll('[data-word][data-complete="true"]'),
    ).toHaveLength(0);
    expect(
      document.querySelectorAll('[data-cell][data-found="true"]'),
    ).toHaveLength(0);
    fireEvent.click(cell(first.start));
    fireEvent.click(cell(first.end));
    view.rerender(<WordSearchGarden {...p} hintToken={2} undoToken={1} />);
    view.rerender(
      <WordSearchGarden {...p} resetToken={1} hintToken={2} undoToken={1} />,
    );
    expect(
      document.querySelectorAll('[data-word][data-complete="true"]'),
    ).toHaveLength(0);
    expect(document.querySelectorAll(".mw-hinted, .mw-selected")).toHaveLength(
      0,
    );
    view.rerender(
      <WordSearchGarden
        {...p}
        level={11}
        resetToken={1}
        hintToken={2}
        undoToken={1}
      />,
    );
    expect(document.querySelectorAll("[data-cell]")).toHaveLength(64);
  });
  it("shows the selected path, clears only that path and keeps found markers", () => {
    const first = wordSearchLevels[0].solution[0];
    render(<WordSearchGarden {...props()} />);
    fireEvent.click(cell(first.start));
    fireEvent.click(cell(first.end));
    expect(screen.getByLabelText("所选文字").textContent).toBe(first.word);
    fireEvent.click(screen.getByRole("button", { name: "清除选择" }));
    expect(
      document.querySelectorAll('[data-cell][aria-pressed="true"]'),
    ).toHaveLength(0);
    expect(
      document.querySelectorAll('[data-word][data-complete="true"]'),
    ).toHaveLength(1);
    expect(
      document.querySelectorAll('[data-cell][data-found="true"]'),
    ).toHaveLength(first.path.length);
  });
  it("supports roving arrow-key focus plus Enter / Space selection", async () => {
    const user = userEvent.setup();
    render(<WordSearchGarden {...props()} />);
    cell(0).focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(cell(1));
    expect(cell(1).tabIndex).toBe(0);
    expect(cell(0).tabIndex).toBe(-1);
    await user.keyboard("{Enter}");
    expect(cell(1).getAttribute("aria-pressed")).toBe("true");
    await user.keyboard("{ArrowRight} ");
    expect(cell(1).getAttribute("aria-pressed")).toBe("true");
    expect(cell(2).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("所选文字").textContent).toBe(
      wordSearchLevels[0].grid[1] + wordSearchLevels[0].grid[2],
    );
  });
  it("reports invalid endpoints and duplicate finds without removing progress", () => {
    const p = props(),
      first = wordSearchLevels[0].solution[0];
    render(<WordSearchGarden {...p} />);
    fireEvent.click(cell(first.start));
    fireEvent.click(cell(first.end));
    fireEvent.click(cell(first.end));
    fireEvent.click(cell(first.start));
    expect(p.onStatus).toHaveBeenLastCalledWith(
      `“${first.word}”已经找到了。看看清单中还没有对勾的词。`,
    );
    expect(
      document.querySelectorAll('[data-word][data-complete="true"]'),
    ).toHaveLength(1);
    fireEvent.click(cell(0));
    fireEvent.click(cell(6));
    expect(p.onStatus).toHaveBeenLastCalledWith(
      "这两个字不在同一条横线、竖线或斜线上。重新选一个起点吧。",
    );
    expect(
      document.querySelectorAll('[data-word][data-complete="true"]'),
    ).toHaveLength(1);
  });
  it("completes exactly once in StrictMode and can complete again after reset", () => {
    const p = props();
    const view = render(
      <StrictMode>
        <WordSearchGarden {...p} />
      </StrictMode>,
    );
    for (const solution of wordSearchLevels[0].solution) {
      fireEvent.click(cell(solution.start));
      fireEvent.click(cell(solution.end));
    }
    view.rerender(
      <StrictMode>
        <WordSearchGarden {...p} onStatus={vi.fn()} />
      </StrictMode>,
    );
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <WordSearchGarden {...p} resetToken={1} />
      </StrictMode>,
    );
    for (const solution of wordSearchLevels[0].solution) {
      fireEvent.click(cell(solution.start));
      fireEvent.click(cell(solution.end));
    }
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
});
