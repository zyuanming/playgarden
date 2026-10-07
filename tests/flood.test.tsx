// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import FloodGarden from "../src/games/FloodGarden";
import { floodLevels } from "../src/games/floodLevels";
import {
  createFloodState,
  fillFlood,
  floodRegion,
  isFloodComplete,
  playFlood,
  replayFlood,
  solveFlood,
  parseFloodSave,
  FLOOD_RESUME_KEY,
} from "../src/games/floodLogic";
const certificates = JSON.parse(
  readFileSync("docs/flood/campaign.json", "utf8"),
).levels as {
  id: string;
  solution: number[];
  canonical: string;
  openingDistances: { color: number; distance: number }[];
}[];
afterEach(() => {
  cleanup();
  localStorage.clear();
});
describe("Flood rules and actual campaign", () => {
  it("queue fill changes only the orthogonal old region and absorbs the new frontier", () => {
    const board = [0, 1, 0, 0, 2, 0, 2, 1, 0];
    const next = fillFlood(board, 3, 1);
    expect(next).toEqual([1, 1, 0, 1, 2, 0, 2, 1, 0]);
    expect(board).toEqual([0, 1, 0, 0, 2, 0, 2, 1, 0]);
    expect(floodRegion(next, 3).sort()).toEqual([0, 1, 3]);
  });
  it("rejects illegal, same-colour, over-budget and post-win moves", () => {
    const p = floodLevels[0],
      s = createFloodState(p);
    for (const c of [-1, 5, 1.5, NaN, p.board[0]])
      expect(playFlood(s, p, c)).toBe(s);
    const won = replayFlood(p, certificates[0].solution)!;
    expect(isFloodComplete(won.board)).toBe(true);
    expect(playFlood(won, p, (won.board[0] + 1) % p.colors)).toBe(won);
    const locked = { board: s.board, moves: Array(p.limit).fill(1) };
    expect(playFlood(locked, p, (p.board[0] + 1) % p.colors)).toBe(locked);
  });
  it("replays every independently certified board and verifies current-position shortest hints", () => {
    expect(floodLevels).toHaveLength(100);
    expect(new Set(certificates.map((c) => c.canonical)).size).toBe(100);
    for (const [i, p] of floodLevels.entries()) {
      const proof = certificates[i];
      expect(proof.id).toBe(p.id);
      expect(proof.solution).toHaveLength(p.optimum);
      const end = replayFlood(p, proof.solution)!;
      expect(isFloodComplete(end.board)).toBe(true);
      const answer = solveFlood(p.board, p.size, p.colors);
      expect(answer.kind).toBe("solved");
      if (answer.kind === "solved") expect(answer.path).toHaveLength(p.optimum);
      const mid = replayFlood(p, proof.solution.slice(0, 2))!;
      const hint = solveFlood(mid.board, p.size, p.colors);
      expect(hint.kind).toBe("solved");
      if (hint.kind === "solved") expect(hint.path.length + 2).toBe(p.optimum);
      if (p.chapter > 0)
        expect(proof.openingDistances.some((o) => o.distance > p.optimum)).toBe(
          true,
        );
    }
  }, 30000);
  it("makes the search budget explicit and validates saves by replay, not stored board", () => {
    const p = floodLevels[99];
    expect(solveFlood(p.board, p.size, p.colors, 1).kind).toBe("budget");
    const moves = certificates[99].solution.slice(0, 3),
      good = JSON.stringify({ version: 1, id: p.id, moves });
    expect(parseFloodSave(good, p)).toEqual(replayFlood(p, moves));
    for (const raw of [
      "{",
      JSON.stringify({ version: 1, id: p.id, moves: [p.board[0]] }),
      JSON.stringify({ version: 1, id: "wrong", moves }),
      JSON.stringify({ version: 1, id: p.id, moves, board: Array(64).fill(0) }),
    ]) {
      const state = parseFloodSave(raw, p);
      expect(isFloodComplete(state.board)).toBe(false);
    }
  });
});
it("DOM supports preview/cancel, keyboard guards, pause, undo and reset tokens", async () => {
  const p = floodLevels[0],
    move = certificates[0].solution[0],
    onComplete = vi.fn(),
    onStatus = vi.fn();
  let props = {
    level: 0,
    paused: false,
    resetToken: 0,
    hintToken: 0,
    undoToken: 0,
    onComplete,
    onStatus,
  };
  const v = render(<FloodGarden {...props} />),
    root = () => v.container.querySelector("[data-flood-board]")!;
  const initial = root().getAttribute("data-flood-board"),
    target = screen.getAllByRole("button", { name: /^选择/ })[move];
  target.focus();
  expect(document.activeElement).toBe(target);
  const key = new KeyboardEvent("keydown", {
    key: "Enter",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(key);
  expect(key.defaultPrevented).toBe(true);
  expect(root().getAttribute("data-flood-board")).toBe(initial);
  fireEvent.click(target);
  expect(root().getAttribute("data-flood-board")).toBe(initial);
  fireEvent.click(screen.getByRole("button", { name: "取消预览" }));
  fireEvent.click(target);
  props = { ...props, paused: true };
  v.rerender(<FloodGarden {...props} />);
  expect(
    (screen.getByRole("button", { name: /^确认换色/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  props = { ...props, paused: false };
  v.rerender(<FloodGarden {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /^确认换色/ }));
  expect(root().getAttribute("data-flood-board")).not.toBe(initial);
  props = { ...props, undoToken: 1 };
  v.rerender(<FloodGarden {...props} />);
  await waitFor(() =>
    expect(root().getAttribute("data-flood-board")).toBe(initial),
  );
  props = { ...props, hintToken: 1 };
  v.rerender(<FloodGarden {...props} />);
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: /^确认换色/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: /^确认换色/ }));
  props = { ...props, resetToken: 1 };
  v.rerender(<FloodGarden {...props} />);
  expect(root().getAttribute("data-flood-board")).toBe(initial);
  expect(onComplete).not.toHaveBeenCalled();
});
it("DOM restores a real current game and locks the completed round exactly once", async () => {
  const p = floodLevels[99],
    proof = certificates[99],
    moves = proof.solution.slice(0, -1),
    onComplete = vi.fn();
  localStorage.setItem(
    `${FLOOD_RESUME_KEY}.round.99`,
    JSON.stringify({ version: 1, id: p.id, moves }),
  );
  const props = {
      level: 99,
      paused: false,
      resetToken: 0,
      hintToken: 0,
      undoToken: 0,
      onComplete,
      onStatus: vi.fn(),
    },
    v = render(<FloodGarden {...props} />);
  const root = v.container.querySelector("[data-flood-board]")!;
  expect(root.getAttribute("data-flood-moves")).toBe(String(moves.length));
  fireEvent.click(
    screen.getAllByRole("button", { name: /^选择/ })[proof.solution.at(-1)!],
  );
  fireEvent.click(screen.getByRole("button", { name: /^确认换色/ }));
  await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  expect(root.getAttribute("data-flood-won")).toBe("true");
  v.rerender(<FloodGarden {...props} undoToken={1} hintToken={1} />);
  expect(root.getAttribute("data-flood-won")).toBe("true");
  for (const b of screen.getAllByRole("button"))
    expect((b as HTMLButtonElement).disabled).toBe(true);
});
