// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, StrictMode } from "react";
import { createHash } from "node:crypto";
import type { GameProps } from "../src/lib/types";
import TentsGarden from "../src/games/TentsGarden";
import { tentsChapters, tentsLevels } from "../src/games/tentsLevels";
import { createTentsState, getTentsHint, isTentsSolved, setTentsCell, solveTents } from "../src/games/tentsLogic";
import { completeLevel, initialProgress, parseProgress } from "../src/lib/progress";
import legacy from "./fixtures/tentsLegacy.json";

afterEach(cleanup);
const square = (index: number) => document.querySelector<HTMLButtonElement>(`[data-tents-cell="${index}"]`)!;
const values = () => [...document.querySelectorAll("[data-tents-cell]")].map(node => Number(node.getAttribute("data-value")));
const props = (overrides: Partial<GameProps> = {}): GameProps => ({
  level: 0, paused: false, resetToken: 0, hintToken: 0, undoToken: 0,
  onComplete: vi.fn(), onStatus: vi.fn(), ...overrides,
});
const checkpointIndices = tentsChapters.flatMap(({ start, count }) => [
  start, start + Math.floor((count - 1) / 2), start + count - 1,
]);

function canonical(index: number, answer: boolean) {
  const level = tentsLevels[index], n = level.size, variants: string[] = [];
  for (let symmetry = 0; symmetry < 8; symmetry++) {
    const transform = (cell: number) => {
      let row = Math.floor(cell / n), column = cell % n;
      if (symmetry >= 4) column = n - 1 - column;
      for (let turn = 0; turn < symmetry % 4; turn++) [row, column] = [column, n - 1 - row];
      return row * n + column;
    };
    if (answer) variants.push(JSON.stringify([n, level.solution.map(transform).sort((a, b) => a - b)]));
    else {
      const trees = level.trees.map(transform).sort((a, b) => a - b);
      const rows = Array(n).fill(0), columns = Array(n).fill(0);
      // Rotate line counts directly, without consulting the stored answer certificate.
      for (let row = 0; row < n; row++) {
        const first = transform(row * n), last = transform(row * n + n - 1);
        if (Math.floor(first / n) === Math.floor(last / n)) rows[Math.floor(first / n)] = level.rowCounts[row];
        else columns[first % n] = level.rowCounts[row];
      }
      for (let column = 0; column < n; column++) {
        const first = transform(column), last = transform((n - 1) * n + column);
        if (Math.floor(first / n) === Math.floor(last / n)) rows[Math.floor(first / n)] = level.columnCounts[column];
        else columns[first % n] = level.columnCounts[column];
      }
      variants.push(JSON.stringify([n, trees, rows, columns]));
    }
  }
  return variants.sort()[0];
}

describe("Tents 200 appended campaign contract", () => {
  it("preserves the exact original twelve objects, titles, certificates and save indices", () => {
    expect(tentsLevels).toHaveLength(200);
    expect(tentsLevels.slice(0, 12)).toEqual(legacy);
    expect([0, 1, 11].map(index => tentsLevels[index].title)).toEqual(["林间初营", "树荫相伴", "森林露营家"]);
    let saved = initialProgress();
    for (let index = 0; index < 12; index++) saved = completeLevel(saved, "tents", index);
    const current = parseProgress(JSON.stringify(saved));
    expect(current.version).toBe(2);
    expect(current.completed.tents).toEqual(Array.from({ length: 12 }, (_, index) => index));
    expect(current.completed.tents.map(index => tentsLevels[index])).toEqual(legacy);
    expect(createHash("sha256").update(JSON.stringify(tentsLevels.slice(0, 12))).digest("hex"))
      .toBe(createHash("sha256").update(JSON.stringify(legacy)).digest("hex"));
  });
  it("defines contiguous, objective-bearing chapters and all fifteen visual checkpoints", () => {
    expect(tentsChapters.map(({ id, start, count }) => [id, start, count])).toEqual([
      [0, 0, 12], [1, 12, 28], [2, 40, 50], [3, 90, 50], [4, 140, 60],
    ]);
    expect(checkpointIndices).toEqual([0, 5, 11, 12, 25, 39, 40, 64, 89, 90, 114, 139, 140, 169, 199]);
    expect(tentsChapters.every(chapter => chapter.title.length > 0 && chapter.objective.length > 0)).toBe(true);
    for (const chapter of tentsChapters.slice(1)) {
      const levels = tentsLevels.slice(chapter.start, chapter.start + chapter.count);
      expect(levels.every(level => level.chapter === chapter.id)).toBe(true);
      expect(levels.every(level => level.contentVersion === 1 && !!level.objective)).toBe(true);
    }
    expect(tentsLevels.slice(12).map(level => level.id)).toEqual(
      [["counts", 28], ["spacing", 50], ["trees", 50], ["challenge", 60]].flatMap(([name, count]) =>
        Array.from({ length: Number(count) }, (_, index) => `tents-${name}-${String(index + 1).padStart(3, "0")}`)),
    );
  });
  it("has distinct public boards and tent layouts even under rotations and reflections", () => {
    expect(new Set(tentsLevels.map((_, index) => canonical(index, false))).size).toBe(200);
    expect(new Set(tentsLevels.map((_, index) => canonical(index, true))).size).toBe(200);
  });
  it("keeps all 200 earned indices compact and compatible with the current save schema", () => {
    let saved = initialProgress();
    for (let index = 0; index < 200; index++) saved = completeLevel(saved, "tents", index);
    const raw = JSON.stringify(saved), current = parseProgress(raw);
    expect(current.version).toBe(2);
    expect(current.completed.tents).toEqual(Array.from({ length: 200 }, (_, index) => index));
    expect(new TextEncoder().encode(raw).length).toBeLessThan(5000);
  });
});

describe("Tents real DOM campaign controls", () => {
  it.each(tentsLevels.map((level, index) => [index, level] as const))(
    "completes board %i using genuine cell controls once, with terminal lock under StrictMode",
    (index, level) => {
      const p = props({ level: index });
      const view = render(createElement(StrictMode, null, createElement(TentsGarden, p)));
      const chapter = tentsChapters.find(item => index >= item.start && index < item.start + item.count)!;
      expect(document.querySelector("[data-tents-chapter]")?.getAttribute("data-tents-chapter")).toBe(String(chapter.id));
      expect(document.querySelector(".rc-level")?.textContent).toBe(`${String(index + 1).padStart(3, "0")} / 200`);
      for (const cell of level.solution) fireEvent.click(square(cell));
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(document.querySelector('[data-complete="true"]')).not.toBeNull();
      expect(isTentsSolved(level, values())).toBe(true);
      const completed = values();
      fireEvent.click(square(level.solution[0]));
      view.rerender(createElement(StrictMode, null, createElement(TentsGarden, { ...p, undoToken: 1, hintToken: 1 })));
      expect(values()).toEqual(completed);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(document.querySelector("[data-region-hint]")).toBeNull();
      expect(square(level.solution[0]).disabled).toBe(true);
    },
  );

  it.each(checkpointIndices)("board %i derives live hint and wrong-step repair without reading its certificate", index => {
    const level = tentsLevels[index], [first, other] = level.solution;
    const descriptor = Object.getOwnPropertyDescriptor(level, "solution")!;
    // A throwing getter is stronger than an empty/incorrect answer: UI/solver reads fail the test.
    Object.defineProperty(level, "solution", { configurable: true, get: () => { throw Error("Runtime read an authoring certificate"); } });
    try {
      const p = props({ level: index }), view = render(createElement(TentsGarden, p));
      fireEvent.click(square(first)); fireEvent.click(square(first)); // Deliberately rule out a real tent.
      fireEvent.click(square(other));
      const wrong = values();
      view.rerender(createElement(TentsGarden, { ...p, hintToken: 1 }));
      expect(document.querySelector("[data-region-hint]")?.getAttribute("data-region-hint")).toBe("repair");
      expect(values()).toEqual(wrong);
      expect(document.activeElement).toBe(square(first));
      fireEvent.click(screen.getByRole("button", { name: "清除这个标记" }));
      expect(square(first).getAttribute("data-value")).toBe("-1");
      expect(square(other).getAttribute("data-value")).toBe("1");
      view.rerender(createElement(TentsGarden, { ...p, hintToken: 1, undoToken: 1 }));
      expect(values()).toEqual(wrong);
      view.rerender(createElement(TentsGarden, { ...p, hintToken: 2, undoToken: 1 }));
      fireEvent.click(screen.getByRole("button", { name: "清除这个标记" }));
      const repaired = values();
      view.rerender(createElement(TentsGarden, { ...p, hintToken: 3, undoToken: 1 }));
      expect(document.querySelector("[data-region-hint]")?.getAttribute("data-region-hint")).toBe("deduction");
      expect(values()).toEqual(repaired);
      expect(document.activeElement?.classList.contains("is-hinted")).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "采用这一步" }));
      expect(values().filter(value => value === 1)).toHaveLength(2);
      expect(square(other).getAttribute("data-value")).toBe("1");
      expect(document.querySelector("[data-region-hint]")).toBeNull();
      view.rerender(createElement(TentsGarden, { ...p, hintToken: 3, undoToken: 1, resetToken: 1 }));
      expect(values()).toEqual(createTentsState(level).board);
    } finally { Object.defineProperty(level, "solution", descriptor); }
  });

  it("blocks paused input, native modified Enter/Space, tree edits and stale hints across level changes", async () => {
    const user = userEvent.setup(), index = 199, level = tentsLevels[index];
    const p = props({ level: index }), view = render(createElement(TentsGarden, p));
    const target = square(level.solution[0]);
    target.focus();
    const blank = values();
    for (const modifier of ["Control", "Meta", "Alt"]) {
      for (const key of ["ArrowRight", "t", "x", "Enter", " "]) {
        await user.keyboard(`{${modifier}>}${key === " " ? " " : `{${key}}`}{/${modifier}}`);
        expect(document.activeElement).toBe(target);
        expect(values()).toEqual(blank);
      }
    }
    await user.keyboard("{Enter}");
    expect(target.getAttribute("data-value")).toBe("1");
    await user.keyboard(" ");
    expect(target.getAttribute("data-value")).toBe("0");
    await user.keyboard("{Delete}");
    expect(values()).toEqual(blank);
    await user.keyboard("t");
    const current = values();
    view.rerender(createElement(TentsGarden, { ...p, paused: true, hintToken: 1, undoToken: 1 }));
    fireEvent.click(target);
    fireEvent.keyDown(target, { key: "x" });
    expect(values()).toEqual(current);
    expect(target.disabled).toBe(true);
    expect(document.querySelector("[data-region-hint]")).toBeNull();
    view.rerender(createElement(TentsGarden, { ...p, hintToken: 1, undoToken: 1 }));
    expect(values()).toEqual(current);
    const tree = square(level.trees[0]);
    tree.focus();
    await user.keyboard("t{Enter} ");
    expect(tree.getAttribute("data-value")).toBe("0");
    expect(values()).toEqual(current);
    view.rerender(createElement(TentsGarden, { ...p, hintToken: 2, undoToken: 1 }));
    expect(document.querySelector("[data-region-hint]")).not.toBeNull();
    view.rerender(createElement(TentsGarden, { ...p, level: 12, hintToken: 2, undoToken: 1 }));
    expect(values()).toEqual(createTentsState(tentsLevels[12]).board);
    expect(document.querySelector("[data-region-hint]")).toBeNull();
    expect(p.onComplete).not.toHaveBeenCalled();
  });
});

describe("Tents expanded current-state logic", () => {
  it.each(tentsLevels.slice(12).map((level, index) => [index + 12, level] as const))(
    "board %i preserves good work when repairing either a wrong tent or wrong grass with poisoned certificates",
    (_index, original) => {
      const level = { ...original, solution: [original.trees[0]], authoringNodes: -1, authoringCandidates: -1 };
      const good = original.solution[1], required = original.solution[0];
      const empty = Array.from({ length: level.size ** 2 }, (_, index) => index)
        .find(index => !original.solution.includes(index) && !level.trees.includes(index))!;
      for (const [wrongIndex, wrongValue] of [[required, 0], [empty, 1]] as const) {
        let state = setTentsCell(createTentsState(level), level, good, 1);
        state = setTentsCell(state, level, wrongIndex, wrongValue);
        expect(solveTents(level, state.board).solutions).toEqual([]);
        const hint = getTentsHint(level, state.board);
        expect(hint?.kind).toBe("repair");
        if (hint?.kind !== "repair") throw Error("Missing current-state repair");
        expect(hint.index).toBe(wrongIndex);
        state = setTentsCell(state, level, hint.index, hint.value);
        expect(state.board[good]).toBe(1);
        expect(solveTents(level, state.board).solutions).toHaveLength(1);
      }
    },
  );
});
