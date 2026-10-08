// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import GalaxiesGarden from "../src/games/GalaxiesGarden";
import { galaxiesLevels } from "../src/games/galaxiesLevels";
import {
  changeGalaxies,
  coreCells,
  GALAXIES_SAVE,
  initialGalaxies,
  inspectGalaxies,
  opposite,
  parseGalaxiesSave,
  solveGalaxies,
  type GalaxiesLevel,
} from "../src/games/galaxiesLogic";
const proofs = JSON.parse(readFileSync("docs/galaxies/campaign.json", "utf8"))
  .levels as { id: string; solution: number[] }[];
afterEach(() => {
  cleanup();
  localStorage.clear();
});
it("validates 36 certificates via actual edits, solves partial states and rejects wrong assignments", () => {
  expect(galaxiesLevels).toHaveLength(36);
  for (const [index, p] of galaxiesLevels.entries()) {
    let state = initialGalaxies(p);
    expect(inspectGalaxies(p, state).won).toBe(false);
    expect(proofs[index].id).toBe(p.id);
    const result = solveGalaxies(p, state);
    expect(result.kind).toBe("solution");
    if (result.kind === "solution")
      expect(result.cells).toEqual(proofs[index].solution);
    const i = state.indexOf(-1),
      right = proofs[index].solution[i];
    expect(
      solveGalaxies(
        p,
        changeGalaxies(p, state, i, (right + 1) % p.centers.length),
      ).kind,
    ).toBe("none");
    expect(solveGalaxies(p, changeGalaxies(p, state, i, right)).kind).toBe(
      "solution",
    );
    proofs[index].solution.forEach((g, j) => {
      state = changeGalaxies(p, state, j, g);
    });
    expect(inspectGalaxies(p, state).won).toBe(true);
    for (let j = 0; j < state.length; j++)
      expect(state[opposite(p, state[j], j)]).toBe(state[j]);
  }
});
it("checks centre types, separate components, asymmetric shapes, fixed clues and safe history bounds", () => {
  const p: GalaxiesLevel = {
    id: "fixture",
    title: "fixture",
    size: 3,
    chapter: 0,
    centers: [[3, 3]],
  };
  expect(coreCells(p, 0)).toEqual([4]);
  expect(inspectGalaxies(p, Array(9).fill(0)).won).toBe(true);
  expect(inspectGalaxies(p, [0, 0, 0, 0, 0, 0, 0, 0, -1]).won).toBe(false);
  expect(inspectGalaxies(p, [0, -1, 0, -1, 0, -1, 0, -1, 0]).won).toBe(false);
  expect(coreCells({ ...p, centers: [[2, 3]] }, 0)).toEqual([3, 4]);
  expect(coreCells({ ...p, centers: [[2, 2]] }, 0)).toEqual([0, 1, 3, 4]);
  const l = galaxiesLevels[0],
    s = initialGalaxies(l),
    i = s.indexOf(-1);
  for (const j of [-1, NaN, 1.5, s.length, s.findIndex((g) => g >= 0)])
    expect(changeGalaxies(l, s, j, 0)).toBe(s);
  expect(solveGalaxies(l, s, 0).kind).toBe("budget");
  const history = Array.from({ length: 2000 }, (_, j) =>
    changeGalaxies(l, s, i, j % 2 ? -1 : 0),
  );
  expect(parseGalaxiesSave(JSON.stringify({ id: l.id, history }), l)).toEqual(
    history,
  );
  for (const raw of [
    "{",
    JSON.stringify({ id: "bad", history: [s] }),
    JSON.stringify({ id: l.id, history: [Array(s.length).fill(-1)] }),
  ])
    expect(parseGalaxiesSave(raw, l)).toEqual([s]);
});
it("uses real DOM for selection, keyboard-safe edit, hint, pause, undo, resume, reset and single completion", () => {
  const p = galaxiesLevels[0],
    s = initialGalaxies(p),
    i = s.indexOf(-1),
    g = proofs[0].solution[i],
    complete = vi.fn();
  const props = {
    level: 0,
    paused: false,
    freshStart: false,
    hintToken: 0,
    undoToken: 0,
    resetToken: 0,
    onComplete: complete,
    onStatus: vi.fn(),
  };
  const view = render(<GalaxiesGarden {...props} />),
    root = () => view.container.querySelector(".galaxies-layout")!;
  const cell = (j: number) =>
    view.container.querySelector(`button[data-cell="${j}"]`)!;
  fireEvent.click(screen.getByRole("button", { name: `选择 ${g + 1} 号星心` }));
  fireEvent.click(cell(i));
  const one = root().getAttribute("data-galaxies-state");
  expect(one).not.toBe(s.join(","));
  view.rerender(<GalaxiesGarden {...props} paused />);
  fireEvent.click(cell(i));
  expect(root().getAttribute("data-galaxies-state")).toBe(one);
  view.rerender(<GalaxiesGarden {...props} undoToken={1} />);
  expect(root().getAttribute("data-galaxies-state")).toBe(s.join(","));
  view.rerender(<GalaxiesGarden {...props} undoToken={1} hintToken={1} />);
  expect(view.container.querySelectorAll(".hint")).toHaveLength(1);
  expect(root().getAttribute("data-galaxies-state")).toBe(s.join(","));
  fireEvent.click(cell(i));
  view.unmount();
  const resume = render(<GalaxiesGarden {...props} />);
  expect(
    resume.container
      .querySelector(".galaxies-layout")!
      .getAttribute("data-galaxies-state"),
  ).toBe(one);
  resume.unmount();
  const finish = render(<GalaxiesGarden {...props} freshStart />);
  for (const [j, owner] of proofs[0].solution.entries())
    if (s[j] < 0) {
      fireEvent.click(
        screen.getByRole("button", { name: `选择 ${owner + 1} 号星心` }),
      );
      fireEvent.click(
        finish.container.querySelector(`button[data-cell="${j}"]`)!,
      );
    }
  expect(complete).toHaveBeenCalledTimes(1);
  expect(
    finish.container
      .querySelector(".galaxies-layout")!
      .getAttribute("data-galaxies-won"),
  ).toBe("true");
  finish.rerender(<GalaxiesGarden {...props} resetToken={1} />);
  expect(
    finish.container
      .querySelector(".galaxies-layout")!
      .getAttribute("data-galaxies-state"),
  ).toBe(s.join(","));
  expect(localStorage.getItem(`${GALAXIES_SAVE}.round.0`)).toBeTruthy();
});
