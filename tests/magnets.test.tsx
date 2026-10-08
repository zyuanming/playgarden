// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import MagnetsGarden from "../src/games/MagnetsGarden";
import { magnetsLevels } from "../src/games/magnetsLevels";
import {
  changeMagnets,
  initialMagnets,
  inspectMagnets,
  magnetCells,
  oppositePole,
  parseMagnetsSave,
  solveMagnets,
  type MagnetsLevel,
} from "../src/games/magnetsLogic";
const proofs = JSON.parse(readFileSync("docs/magnets/campaign.json", "utf8"))
  .levels as { solution: number[] }[];
afterEach(() => {
  cleanup();
  localStorage.clear();
});
it("all36 actual certificates, live solving, edit and save invariants", () => {
  expect(magnetsLevels).toHaveLength(36);
  for (const [index, p] of magnetsLevels.entries()) {
    const fresh = initialMagnets(p),
      solution = proofs[index].solution;
    expect(inspectMagnets(p, fresh).won).toBe(false);
    expect(inspectMagnets(p, solution).won).toBe(true);
    expect(solveMagnets(p, fresh)).toMatchObject({
      kind: "solution",
      state: solution,
    });
    const wrong = changeMagnets(p, fresh, 0, (solution[0] + 1) % 3);
    expect(solveMagnets(p, wrong).kind).toBe("none");
    let state = fresh;
    for (const [d, v] of solution.entries())
      state = changeMagnets(p, state, d, v);
    expect(state).toEqual(solution);
    expect(changeMagnets(p, state, 0, -1)).toBe(state);
    expect(
      parseMagnetsSave(
        JSON.stringify({ id: p.id, history: [fresh, wrong] }),
        p,
      ),
    ).toEqual([fresh, wrong]);
  }
}, 20000);
it("rejects malformed states; neutral differs from unknown; only orthogonal same poles conflict", () => {
  const p: MagnetsLevel = {
    id: "test",
    title: "",
    chapter: 0,
    width: 2,
    height: 2,
    dominoes: [
      [0, 1],
      [2, 3],
    ],
    rowPlus: [-1, -1],
    rowMinus: [-1, -1],
    colPlus: [-1, -1],
    colMinus: [-1, -1],
  };
  expect([0, 1, 2].map(oppositePole)).toEqual([0, 2, 1]);
  expect(inspectMagnets(p, [1, 2]).won).toBe(true); // same poles only diagonal
  expect(inspectMagnets(p, [1, 1]).conflicts.size).toBe(4);
  expect(inspectMagnets(p, [0, 0]).won).toBe(true);
  expect(inspectMagnets(p, [-1, 0]).won).toBe(false);
  for (const s of [[NaN, 0], [Infinity, 0], [3, 0], [0], Array(2)])
    expect(inspectMagnets(p, s).won).toBe(false);
  expect(magnetCells(p, [1, 2])).toEqual([1, 2, 2, 1]);
  const q = { ...p, rowPlus: [1, 0] };
  expect(inspectMagnets(q, [0, 0]).won).toBe(false);
  expect(solveMagnets(p, [-1, -1], 0).kind).toBe("budget");
  for (const raw of [
    "{",
    JSON.stringify({ id: "other", history: [[0, 0]] }),
    JSON.stringify({ id: p.id, history: [[null, 0]] }),
  ])
    expect(parseMagnetsSave(raw, p)).toEqual([[-1, -1]]);
});
it("DOM uses clicked pole, whole-domino erase, pause, undo, hint, resume, completion and reset", () => {
  const complete = vi.fn(),
    props = {
      level: 0,
      paused: false,
      freshStart: false,
      hintToken: 0,
      undoToken: 0,
      resetToken: 0,
      onComplete: complete,
      onStatus: vi.fn(),
    };
  const p = magnetsLevels[0],
    v = render(<MagnetsGarden {...props} />),
    root = () => v.container.querySelector(".magnets-layout")!,
    cell = (i: number) =>
      v.container.querySelector(`button[data-cell="${i}"]`)!,
    pole = (n: number) =>
      v.container.querySelector(`button[data-pole="${n}"]`)!;
  const [a, b] = p.dominoes[0];
  fireEvent.click(pole(1));
  fireEvent.click(cell(b));
  expect(root().getAttribute("data-magnets-state")?.split(",")[0]).toBe("2");
  fireEvent.click(pole(-1));
  fireEvent.click(cell(a));
  expect(root().getAttribute("data-magnets-state")).toBe(
    initialMagnets(p).join(","),
  );
  fireEvent.click(pole(0));
  fireEvent.click(cell(a));
  const one = root().getAttribute("data-magnets-state");
  v.rerender(<MagnetsGarden {...props} paused />);
  fireEvent.click(cell(b));
  expect(root().getAttribute("data-magnets-state")).toBe(one);
  v.rerender(<MagnetsGarden {...props} undoToken={1} />);
  expect(root().getAttribute("data-magnets-state")).toBe(
    initialMagnets(p).join(","),
  );
  v.rerender(<MagnetsGarden {...props} undoToken={1} hintToken={1} />);
  expect(v.container.querySelectorAll(".hint")).toHaveLength(2);
  expect(root().getAttribute("data-magnets-state")).toBe(
    initialMagnets(p).join(","),
  );
  fireEvent.click(pole(0));
  fireEvent.click(cell(a));
  v.unmount();
  const resumed = render(<MagnetsGarden {...props} />);
  expect(
    resumed.container
      .querySelector(".magnets-layout")
      ?.getAttribute("data-magnets-state"),
  ).toBe(one);
  resumed.unmount();
  const finish = render(<MagnetsGarden {...props} freshStart />);
  for (const [d, value] of proofs[0].solution.entries()) {
    fireEvent.click(
      finish.container.querySelector(`button[data-pole="${value}"]`)!,
    );
    fireEvent.click(
      finish.container.querySelector(
        `button[data-cell="${p.dominoes[d][0]}"]`,
      )!,
    );
  }
  expect(complete).toHaveBeenCalledTimes(1);
  expect(
    finish.container
      .querySelector(".magnets-layout")
      ?.getAttribute("data-magnets-won"),
  ).toBe("true");
  finish.rerender(<MagnetsGarden {...props} resetToken={1} />);
  expect(
    finish.container
      .querySelector(".magnets-layout")
      ?.getAttribute("data-magnets-state"),
  ).toBe(initialMagnets(p).join(","));
});
