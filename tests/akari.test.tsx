// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import AkariGarden from "../src/games/AkariGarden";
import { akariLevels } from "../src/games/akariLevels";
import {
  AKARI_SAVE,
  changeAkari,
  inspectAkari,
  litCells,
  parseAkariSave,
  solveAkari,
  type AkariLevel,
} from "../src/games/akariLogic";
const proofs = JSON.parse(readFileSync("docs/akari/campaign.json", "utf8"))
  .levels as { id: string; solution: number[] }[];
afterEach(() => {
  cleanup();
  localStorage.clear();
});
describe("Akari rules and campaign", () => {
  it("walls stop rays, bulbs do not, intersecting empty light paths are allowed", () => {
    const p: AkariLevel = {
      id: "test",
      title: "test",
      chapter: 0,
      size: 3,
      board: "...#.....",
    };
    expect(litCells(p, 0).sort()).toEqual([0, 1, 2]);
    const s = Array(9).fill(0);
    s[0] = 1;
    s[2] = 1;
    expect(inspectAkari(p, s).clashes).toEqual([0, 2]);
    s[0] = 0;
    s[2] = 0;
    s[1] = 1;
    s[6] = 1;
    const check = inspectAkari(p, s);
    expect(check.light[7]).toBe(2);
    expect(check.clashes).toEqual([]);
    const numbered = { ...p, board: "....1...." };
    const t = Array(9).fill(0);
    t[0] = 1;
    expect(inspectAkari(numbered, t).wrong).toContain(4);
    t[1] = 1;
    expect(inspectAkari(numbered, t).wrong).not.toContain(4);
  });
  it("replays all 36 certificates through real transitions, validates hints from partial and contradicted states", () => {
    expect(akariLevels).toHaveLength(36);
    for (const [index, p] of akariLevels.entries()) {
      expect(proofs[index].id).toBe(p.id);
      let state = Array(p.board.length).fill(0);
      const hint = solveAkari(p, state);
      expect(hint.kind).toBe("solution");
      if (hint.kind === "solution")
        expect([...hint.cells].sort((a, b) => a - b)).toEqual(
          proofs[index].solution,
        );
      for (const i of proofs[index].solution) {
        state = changeAkari(p, state, i, 1);
      }
      expect(inspectAkari(p, state).won).toBe(true);
      expect(changeAkari(p, state, proofs[index].solution[0], 0)).toBe(state);
      const partial = Array(p.board.length).fill(0);
      partial[proofs[index].solution[0]] = 1;
      expect(solveAkari(p, partial).kind).toBe("solution");
      partial[proofs[index].solution[0]] = 2;
      expect(solveAkari(p, partial).kind).toBe("none");
    }
  });
  it("rejects illegal edits and corrupt saves and reports budget without claiming no solution", () => {
    const p = akariLevels[0],
      s = Array(p.board.length).fill(0),
      i = proofs[0].solution[0],
      next = changeAkari(p, s, i, 1);
    for (const pos of [-1, NaN, 1.5, p.board.length, p.board.indexOf("#")])
      expect(changeAkari(p, s, pos, 1)).toBe(s);
    expect(changeAkari(p, s, i, 3)).toBe(s);
    expect(solveAkari(p, s, 0).kind).toBe("budget");
    expect(
      parseAkariSave(JSON.stringify({ id: p.id, history: [s, next] }), p),
    ).toEqual([s, next]);
    for (const raw of [
      "{",
      JSON.stringify({ id: "wrong", history: [s, next] }),
      JSON.stringify({ id: p.id, history: [next] }),
      JSON.stringify({ id: p.id, history: [s, Array(p.board.length).fill(1)] }),
    ])
      expect(parseAkariSave(raw, p)).toEqual([s]);
  });
});
it("real DOM edits, mark mode, hint, pause, undo, reset, save restore and final lock", () => {
  const p = akariLevels[0],
    first = proofs[0].solution[0],
    done = vi.fn(),
    onStatus = vi.fn();
  let props = {
    level: 0,
    paused: false,
    resetToken: 0,
    hintToken: 0,
    undoToken: 0,
    onComplete: done,
    onStatus,
  };
  let v = render(<AkariGarden {...props} />);
  const cell = (i: number) =>
    v.container.querySelector(`button[data-cell="${i}"]`)!;
  const state = () =>
    v.container
      .querySelector("[data-akari-state]")!
      .getAttribute("data-akari-state")!;
  fireEvent.click(cell(first));
  expect(state()[first]).toBe("1");
  props = { ...props, paused: true, hintToken: 1, undoToken: 1 };
  v.rerender(<AkariGarden {...props} />);
  fireEvent.click(cell(first));
  expect(state()[first]).toBe("1");
  props = { ...props, paused: false };
  v.rerender(<AkariGarden {...props} />);
  expect(state()[first]).toBe("1");
  props = { ...props, undoToken: 2 };
  v.rerender(<AkariGarden {...props} />);
  expect(state()[first]).toBe("0");
  fireEvent.click(screen.getByRole("button", { name: "× 标记 / 清除" }));
  fireEvent.click(cell(first));
  expect(state()[first]).toBe("2");
  props = { ...props, hintToken: 2 };
  v.rerender(<AkariGarden {...props} />);
  expect(screen.getByRole("status").textContent).toContain("不相容");
  props = { ...props, resetToken: 1 };
  v.rerender(<AkariGarden {...props} />);
  expect(state()).toBe("0".repeat(p.board.length));
  props = { ...props, hintToken: 3 };
  v.rerender(<AkariGarden {...props} />);
  expect(v.container.querySelector(".hint")).not.toBeNull();
  expect(state()).toBe("0".repeat(p.board.length));
  fireEvent.click(cell(first));
  const saved = state();
  v.unmount();
  v = render(<AkariGarden {...props} />);
  expect(state()).toBe(saved);
  for (const i of proofs[0].solution.slice(1)) fireEvent.click(cell(i));
  expect(
    v.container
      .querySelector("[data-akari-won]")!
      .getAttribute("data-akari-won"),
  ).toBe("true");
  expect(done).toHaveBeenCalledTimes(1);
  props = { ...props, undoToken: 3, hintToken: 4 };
  v.rerender(<AkariGarden {...props} />);
  fireEvent.click(cell(first));
  expect(state()[first]).toBe("1");
  expect(done).toHaveBeenCalledTimes(1);
});
it("corrupt saved round resets and changing levels preserves correct puzzle identity", () => {
  localStorage.setItem(
    `${AKARI_SAVE}.round.35`,
    '{"id":"akari-036","history":[[1]]}',
  );
  const props = {
    level: 35,
    paused: false,
    resetToken: 0,
    hintToken: 0,
    undoToken: 0,
    onComplete: vi.fn(),
    onStatus: vi.fn(),
  };
  const v = render(<AkariGarden {...props} />);
  expect(
    v.container
      .querySelector("[data-akari-state]")!
      .getAttribute("data-akari-state"),
  ).toBe("0".repeat(49));
  v.rerender(<AkariGarden {...props} level={0} />);
  expect(
    v.container.querySelector("[data-akari-id]")!.getAttribute("data-akari-id"),
  ).toBe("akari-001");
});
