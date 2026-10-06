// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import type { GameProps } from "../src/lib/types";
import ShikakuGarden from "../src/games/ShikakuGarden";
import TentsGarden from "../src/games/TentsGarden";
import {
  createShikakuState,
  getShikakuHint,
  isShikakuSolved,
  placeShikakuRectangle,
  removeShikakuRectangle,
  shikakuCandidates,
  shikakuCells,
  shikakuLevels,
  shikakuRectangleFromCorners,
  shikakuSolutions,
  solveShikaku,
  undoShikaku,
  validShikakuLevel,
  validShikakuPlacement,
  type ShikakuLevel,
  type ShikakuRect,
} from "../src/games/shikakuLogic";
import {
  createTentsState,
  cycleTentsCell,
  getTentsHint,
  isTentsSolved,
  setTentsCell,
  solveTents,
  tentsConflicts,
  tentsLevels,
  tentsMatching,
  tentsNeighbors,
  tentsSolutions,
  tentsTouch,
  undoTents,
  validTentsBoard,
  validTentsLevel,
  type TentsCell,
  type TentsLevel,
} from "../src/games/tentsLogic";
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
function square(game: "shikaku" | "tents", index: number): HTMLButtonElement {
  return document.querySelector(`[data-${game}-cell="${index}"]`)!;
}
function tentValues(): number[] {
  return [...document.querySelectorAll("[data-tents-cell]")].map((e) =>
    Number(e.getAttribute("data-value")),
  );
}
function regionCount(): number {
  return Number(
    document
      .querySelector("[data-region-count]")!
      .getAttribute("data-region-count"),
  );
}
function draw(n: number, r: ShikakuRect) {
  fireEvent.click(square("shikaku", r[0] * n + r[1]));
  fireEvent.click(square("shikaku", r[2] * n + r[3]));
}
const rectKey = (r: readonly number[]) => r.join(",");
const layoutKey = (rs: readonly ShikakuRect[]) =>
  rs.map(rectKey).sort().join(";");

/** Independent certificate: enumerate every coordinate rectangle, then assign one to each clue.
 * No production candidate, solver, or validation helpers. Different branch variable from production.
 */
function certifyShikaku(level: ShikakuLevel) {
  const n = level.size,
    domains = level.clues.map((clue) => {
      const options: { rect: ShikakuRect; cells: number[] }[] = [];
      for (let top = 0; top < n; top++)
        for (let left = 0; left < n; left++)
          for (let bottom = top; bottom < n; bottom++)
            for (let right = left; right < n; right++) {
              if ((bottom - top + 1) * (right - left + 1) !== clue.area)
                continue;
              const cells: number[] = [];
              for (let y = top; y <= bottom; y++)
                for (let x = left; x <= right; x++) cells.push(y * n + x);
              if (
                !cells.includes(clue.index) ||
                level.clues.filter((c) => cells.includes(c.index)).length !== 1
              )
                continue;
              options.push({ rect: [top, left, bottom, right], cells });
            }
      return options;
    });
  const order = domains
      .map((_, i) => i)
      .sort((a, b) => domains[a].length - domains[b].length),
    solutions: string[] = [],
    used = new Set<number>(),
    chosen: ShikakuRect[] = [];
  let nodes = 0;
  function dfs(depth: number) {
    if (++nodes > 200000)
      throw Error("Independent rectangle certificate budget exceeded");
    if (solutions.length > 1) return;
    if (depth === order.length) {
      if (used.size === n * n) solutions.push(layoutKey(chosen));
      return;
    }
    for (const option of domains[order[depth]]) {
      if (option.cells.some((i) => used.has(i))) continue;
      option.cells.forEach((i) => used.add(i));
      chosen.push(option.rect);
      dfs(depth + 1);
      chosen.pop();
      option.cells.forEach((i) => used.delete(i));
    }
  }
  dfs(0);
  return { solutions, nodes };
}
/** Independent certificate: choose an adjacent tent for every tree, then canonicalize layouts.
 * No production row bitmask solver, matching algorithm, adjacency, or validation helpers.
 */
function certifyTents(level: TentsLevel) {
  const n = level.size,
    treeSet = new Set(level.trees),
    neighbors = level.trees.map((t) =>
      Array.from({ length: n * n }, (_, i) => i).filter(
        (i) =>
          !treeSet.has(i) &&
          Math.abs(Math.floor(i / n) - Math.floor(t / n)) +
            Math.abs((i % n) - (t % n)) ===
            1,
      ),
    );
  const order = neighbors
      .map((_, i) => i)
      .sort((a, b) => neighbors[a].length - neighbors[b].length),
    picked: number[] = [],
    rows = Array(n).fill(0),
    cols = Array(n).fill(0),
    solutions = new Set<string>();
  let nodes = 0;
  function dfs(depth: number) {
    if (++nodes > 200000)
      throw Error("Independent tent certificate budget exceeded");
    if (solutions.size > 1) return;
    if (depth === order.length) {
      if (
        rows.every((v, r) => v === level.rowCounts[r]) &&
        cols.every((v, c) => v === level.columnCounts[c])
      )
        solutions.add([...picked].sort((a, b) => a - b).join(","));
      return;
    }
    for (const i of neighbors[order[depth]]) {
      const y = Math.floor(i / n),
        x = i % n;
      if (
        rows[y] >= level.rowCounts[y] ||
        cols[x] >= level.columnCounts[x] ||
        picked.some(
          (j) =>
            Math.abs(Math.floor(j / n) - y) <= 1 && Math.abs((j % n) - x) <= 1,
        )
      )
        continue;
      picked.push(i);
      rows[y]++;
      cols[x]++;
      dfs(depth + 1);
      cols[x]--;
      rows[y]--;
      picked.pop();
    }
  }
  dfs(0);
  return { solutions: [...solutions], nodes };
}

describe("original independently certified region and camping levels", () => {
  it("keeps each classic twelve and appends 188 distinct boards per game", () => {
    expect(shikakuLevels).toHaveLength(200);
    expect(tentsLevels).toHaveLength(200);
    expect(shikakuLevels.slice(0, 12).map((l) => l.size)).toEqual([
      3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7,
    ]);
    expect(tentsLevels.slice(0, 12).map((l) => l.size)).toEqual([
      4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7,
    ]);
    expect(
      new Set(shikakuLevels.map((l) => JSON.stringify([l.size, l.clues]))).size,
    ).toBe(200);
    expect(
      new Set(
        tentsLevels.map((l) =>
          JSON.stringify([l.size, l.trees, l.rowCounts, l.columnCounts]),
        ),
      ).size,
    ).toBe(200);
  });
  it.each(shikakuLevels.map((l, i) => [i, l] as const))(
    "Shikaku %i has exactly one independently enumerated rectangle tiling",
    (_i, l) => {
      const certificate = certifyShikaku(l);
      expect(certificate.solutions).toEqual([layoutKey(l.solution)]);
      expect(certificate.nodes).toBeLessThan(200000);
      expect(validShikakuLevel(l)).toBe(true);
      expect(isShikakuSolved(l, l.solution)).toBe(true);
      const search = solveShikaku(l);
      expect(search.status).toBe("complete");
      expect(search.solutions.map(layoutKey)).toEqual(certificate.solutions);
      expect(search.nodes).toBeLessThan(50000);
    },
  );
  it.each(tentsLevels.map((l, i) => [i, l] as const))(
    "Tents %i has exactly one independently enumerated tent layout",
    (i, l) => {
      const certificate = certifyTents(l);
      expect(certificate.solutions).toEqual([
        [...l.solution].sort((a, b) => a - b).join(","),
      ]);
      expect(certificate.nodes).toBeLessThan(200000);
      expect(validTentsLevel(l)).toBe(true);
      expect(isTentsSolved(l, tentsSolutions[i])).toBe(true);
      expect(tentsMatching(l, l.solution)).toHaveLength(l.trees.length);
      const search = solveTents(l);
      expect(search.status).toBe("complete");
      expect(search.solutions).toEqual([tentsSolutions[i]]);
      expect(search.nodes).toBeLessThan(50000);
    },
  );
  it.each(shikakuLevels.map((l, i) => [i, l] as const))(
    "Shikaku %i hints solve the current state with poisoned certificates",
    (_i, raw) => {
      const l = { ...raw, solution: [[99, 99, 99, 99]] as ShikakuRect[] };
      let state = createShikakuState();
      for (let step = 0; step < l.clues.length; step++) {
        const hint = getShikakuHint(l, state.rectangles);
        expect(hint?.kind).toBe("deduction");
        if (hint?.kind !== "deduction") throw Error("No proven rectangle");
        state = placeShikakuRectangle(state, l, hint.rectangle);
      }
      expect(isShikakuSolved(l, state.rectangles)).toBe(true);
      expect(getShikakuHint(l, state.rectangles)).toBeNull();
    },
  );
  it("Tents hints solve the current state without certificate access", () => {
    for (const raw of tentsLevels) {
      const l = { ...raw, solution: [] };
      let state = createTentsState(l);
      for (let step = 0; step < l.trees.length; step++) {
        const hint = getTentsHint(l, state.board);
        expect(hint?.kind).toBe("deduction");
        if (hint?.kind !== "deduction") throw Error("No proven tent");
        expect(hint.value).toBe(1);
        state = setTentsCell(state, l, hint.index, hint.value);
      }
      expect(isTentsSolved(l, state.board)).toBe(true);
      expect(getTentsHint(l, state.board)).toBeNull();
    }
  });
  it("certificate metrics stay bounded for every pack", () => {
    const shikaku = shikakuLevels.map((l) => ({
      independent: certifyShikaku(l).nodes,
      runtime: solveShikaku(l).nodes,
    }));
    const tents = tentsLevels.map((l) => ({
      independent: certifyTents(l).nodes,
      runtime: solveTents(l).nodes,
    }));
    console.info(
      "REGION_CAMPING_CERTIFICATES",
      JSON.stringify({ shikaku, tents }),
    );
    expect(
      Math.max(
        ...shikaku.map((s) => s.runtime),
        ...tents.map((s) => s.runtime),
      ),
    ).toBeLessThan(1000);
  });
});

describe("Shikaku state and guarded public logic", () => {
  it("never calls one of several possible rectangles a forced hint", () => {
    const level: ShikakuLevel = {
      title: "Ambiguity fixture",
      size: 3,
      clues: [
        { index: 0, area: 3 },
        { index: 4, area: 3 },
        { index: 8, area: 3 },
      ],
      solution: [],
      authoringNodes: 0,
      authoringCandidates: 0,
    };
    const search = solveShikaku(level, [], 128);
    expect(search.status).toBe("complete");
    expect(search.solutions.length).toBeGreaterThan(1);
    expect(getShikakuHint(level, [])?.kind).toBe("unavailable");
  });
  it("bounds history storage to the most recent 300 actions", () => {
    let state = createShikakuState();
    for (let i = 0; i < 155; i++) {
      state = placeShikakuRectangle(
        state,
        shikakuLevels[0],
        shikakuLevels[0].solution[0],
      );
      state = removeShikakuRectangle(state, 0);
    }
    expect(state.history).toHaveLength(300);
    expect(state.rectangles).toEqual([]);
  });
  it("normalizes corners, checks clues/areas/overlap, and requires complete coverage", () => {
    const l = shikakuLevels[0],
      a = l.solution[0];
    expect(shikakuRectangleFromCorners(3, 8, 0)).toEqual([0, 0, 2, 2]);
    expect(shikakuRectangleFromCorners(3, -1, 0)).toBeNull();
    expect(shikakuRectangleFromCorners(99, 0, 1)).toBeNull();
    expect(shikakuCells(3, [2, 2, 0, 0])).toEqual([]);
    expect(validShikakuPlacement(l, [a])).toBe(true);
    expect(validShikakuPlacement(l, [a, a])).toBe(false);
    expect(isShikakuSolved(l, [a])).toBe(false);
    expect(validShikakuPlacement(l, [[0, 0, 2, 2]])).toBe(false);
  });
  it("makes immutable reversible placements and removals, with pause and no-op guards", () => {
    const l = shikakuLevels[0],
      initial = createShikakuState(),
      next = placeShikakuRectangle(initial, l, l.solution[0]);
    expect(initial.rectangles).toEqual([]);
    expect(next.history).toHaveLength(1);
    expect(placeShikakuRectangle(next, l, l.solution[0])).toBe(next);
    expect(placeShikakuRectangle(initial, l, l.solution[0], true)).toBe(
      initial,
    );
    expect(removeShikakuRectangle(next, -1)).toBe(next);
    expect(removeShikakuRectangle(next, 0, true)).toBe(next);
    const removed = removeShikakuRectangle(next, 0);
    expect(removed.rectangles).toEqual([]);
    expect(undoShikaku(removed).rectangles).toEqual(next.rectangles);
    expect(undoShikaku(next).rectangles).toEqual([]);
    expect(undoShikaku(next, true)).toBe(next);
    expect(undoShikaku(initial)).toBe(initial);
  });
  it("reports current-state contradictions instead of trusting an answer sheet", () => {
    let example: { level: ShikakuLevel; rect: ShikakuRect } | undefined;
    for (const l of shikakuLevels) {
      const bad = shikakuCandidates(l)
        .flat()
        .find((r) => !l.solution.some((p) => rectKey(p) === rectKey(r)));
      if (bad) {
        example = { level: l, rect: bad };
        break;
      }
    }
    expect(example).toBeDefined();
    const { level, rect } = example!;
    expect(solveShikaku(level, [rect]).solutions).toEqual([]);
    const hint = getShikakuHint(level, [rect]);
    expect(hint?.kind).toBe("repair");
    expect(hint?.reason).toContain("其余矩形存在完整划分");
  });
  it("rejects malformed public constraints and reports explicit search limits", () => {
    const l = shikakuLevels[11];
    expect(validShikakuLevel({ ...l, size: 1000 })).toBe(false);
    expect(
      validShikakuLevel({
        ...l,
        clues: [
          { index: 0, area: 49 },
          { index: 0, area: 0 },
        ],
      }),
    ).toBe(false);
    expect(solveShikaku(l, [], 0).status).toBe("invalid");
    expect(solveShikaku(l, [], 2, 50001).status).toBe("invalid");
    expect(solveShikaku(l, [], 2, 1).status).toBe("budget");
    expect(solveShikaku(l, [], 1).status).toBe("limit");
    expect(getShikakuHint(l, [], 1)?.kind).toBe("unavailable");
    expect(shikakuSolutions).toHaveLength(200);
  });
});

describe("Tents state, adjacency and bijective matching", () => {
  it("uses consensus rather than choosing an arbitrary answer on ambiguous boards", () => {
    const level: TentsLevel = {
      title: "Ambiguity fixture",
      size: 4,
      trees: [1, 9],
      rowCounts: [1, 0, 1, 0],
      columnCounts: [1, 0, 1, 0],
      solution: [],
      authoringNodes: 0,
      authoringCandidates: 0,
    };
    const initial = createTentsState(level);
    const search = solveTents(level, initial.board, 128);
    expect(search.status).toBe("complete");
    expect(search.solutions).toHaveLength(2);
    const hint = getTentsHint(level, initial.board);
    expect(hint?.kind).toBe("deduction");
    if (hint?.kind === "deduction") expect(hint.value).toBe(0);
    const board = initial.board.map(
      (_, i) => ([0, 2, 8, 10].includes(i) ? -1 : 0) as TentsCell,
    );
    expect(getTentsHint(level, board)?.kind).toBe("unavailable");
  });
  it("bounds undo snapshots to 300 without changing fixed tree cells", () => {
    const level = tentsLevels[0];
    let state = createTentsState(level);
    const index = state.board.findIndex((v) => v === -1);
    for (let i = 0; i < 305; i++) state = cycleTentsCell(state, level, index);
    expect(state.history).toHaveLength(300);
    expect(level.trees.every((i) => state.board[i] === 0)).toBe(true);
  });
  it("requires non-touching tents and actual one-to-one matching, not mere adjacency", () => {
    const l: TentsLevel = {
      title: "matching fixture",
      size: 4,
      trees: [1, 3],
      rowCounts: [2, 0, 0, 0],
      columnCounts: [1, 0, 1, 0],
      solution: [0, 2],
      authoringNodes: 0,
      authoringCandidates: 0,
    };
    expect(tentsMatching(l, [0, 2])).toHaveLength(2);
    expect(isTentsSolved(l, [1, 0, 1, 0, ...Array(12).fill(0)])).toBe(true);
    const impossible = { ...l, trees: [1, 5] };
    expect(tentsMatching(impossible, [0, 2])).toBeNull();
    expect(isTentsSolved(impossible, [1, 0, 1, 0, ...Array(12).fill(0)])).toBe(
      false,
    );
    expect(solveTents(impossible).solutions).toEqual([]);
    expect(tentsTouch(4, 0, 5)).toBe(true);
    expect(tentsTouch(4, 0, 2)).toBe(false);
    expect(tentsNeighbors(4, 3)).toEqual([7, 2]);
    expect(tentsNeighbors(4, -1)).toEqual([]);
  });
  it("cycles empty/tent/grass without changing trees; immutable history survives undo", () => {
    const l = tentsLevels[0],
      s = createTentsState(l),
      i = s.board.findIndex((v) => v === -1),
      tree = l.trees[0];
    const a = cycleTentsCell(s, l, i),
      b = cycleTentsCell(a, l, i),
      c = cycleTentsCell(b, l, i);
    expect([a.board[i], b.board[i], c.board[i]]).toEqual([1, 0, -1]);
    expect(s.board[i]).toBe(-1);
    expect(undoTents(c).board).toEqual(b.board);
    expect(undoTents(s)).toBe(s);
    expect(undoTents(a, true)).toBe(a);
    expect(setTentsCell(s, l, tree, 1)).toBe(s);
    expect(setTentsCell(s, l, i, 1, true)).toBe(s);
    expect(setTentsCell(s, l, -1, 1)).toBe(s);
    expect(setTentsCell(a, l, i, 1)).toBe(a);
  });
  it("rejects adjacent and over-count tents while allowing incomplete grass notes", () => {
    const l = tentsLevels[0];
    expect(isTentsSolved(l, createTentsState(l).board)).toBe(false);
    let state = createTentsState(l);
    for (const i of l.solution) state = setTentsCell(state, l, i, 1);
    expect(isTentsSolved(l, state.board)).toBe(true);
    const extra = state.board.findIndex((v) => v === -1);
    state = setTentsCell(state, l, extra, 1);
    expect(tentsConflicts(l, state.board).length).toBeGreaterThan(0);
    expect(isTentsSolved(l, state.board)).toBe(false);
  });
  it("does not turn contradictory markings or a capped search into a deduction", () => {
    const l = tentsLevels[11],
      s = createTentsState(l),
      wrong = setTentsCell(s, l, l.solution[0], 0);
    expect(solveTents(l, wrong.board).solutions).toEqual([]);
    const hint = getTentsHint(l, wrong.board);
    expect(hint?.kind).toBe("repair");
    expect(hint?.reason).toContain("其余标记存在完整布局");
    expect(getTentsHint(l, s.board, 1)?.kind).toBe("unavailable");
    expect(solveTents(l, s.board, 2, 1).status).toBe("budget");
    expect(solveTents(l, s.board, 1).status).toBe("limit");
  });
  it("validates bounded board and clue input", () => {
    const l = tentsLevels[0],
      s = createTentsState(l);
    expect(validTentsLevel({ ...l, size: 999 })).toBe(false);
    expect(validTentsLevel({ ...l, rowCounts: [99, 0, 0, 0] })).toBe(false);
    expect(validTentsLevel({ ...l, trees: [1, 1] })).toBe(false);
    expect(validTentsBoard(l, s.board.slice(1))).toBe(false);
    const bad = s.board.slice();
    bad[l.trees[0]] = 1;
    expect(validTentsBoard(l, bad)).toBe(false);
    expect(solveTents(l, bad).status).toBe("invalid");
    expect(solveTents(l, s.board, 129).status).toBe("invalid");
    expect(solveTents(l, s.board, 2, 50001).status).toBe("invalid");
  });
});

describe("Shikaku accessible round lifecycle", () => {
  it("draws with two clicks, rejects invalid areas, removes and undoes a region", () => {
    const p = props(),
      view = render(<ShikakuGarden {...p} />),
      l = shikakuLevels[0];
    fireEvent.click(square("shikaku", 0));
    fireEvent.click(square("shikaku", 8));
    expect(regionCount()).toBe(0);
    expect(screen.getByRole("status").textContent).toContain("不能重叠");
    draw(l.size, l.solution[0]);
    expect(regionCount()).toBe(1);
    const i = l.solution[0][0] * l.size + l.solution[0][1];
    fireEvent.click(square("shikaku", i));
    expect(regionCount()).toBe(0);
    view.rerender(<ShikakuGarden {...p} undoToken={1} />);
    expect(regionCount()).toBe(1);
  });
  it("supports native keyboard activation, directional focus, cancel and delete", async () => {
    const user = userEvent.setup(),
      p = props();
    render(<ShikakuGarden {...p} />);
    square("shikaku", 0).focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(square("shikaku", 1));
    await user.keyboard("{Enter}");
    expect(
      document.querySelector("[data-anchor]")!.getAttribute("data-anchor"),
    ).toBe("1");
    await user.keyboard("{Escape}");
    expect(
      document.querySelector("[data-anchor]")!.getAttribute("data-anchor"),
    ).toBe("");
    const r = shikakuLevels[0].solution[0];
    draw(3, r);
    square("shikaku", r[0] * 3 + r[1]).focus();
    await user.keyboard("{Delete}");
    expect(regionCount()).toBe(0);
  });
  it("pauses every mutation and consumes paused hint/undo tokens without replay", () => {
    const p = props(),
      view = render(<ShikakuGarden {...p} />),
      l = shikakuLevels[0];
    draw(l.size, l.solution[0]);
    view.rerender(<ShikakuGarden {...p} paused hintToken={1} undoToken={1} />);
    fireEvent.click(
      square("shikaku", l.solution[0][0] * l.size + l.solution[0][1]),
    );
    expect(regionCount()).toBe(1);
    expect(document.querySelector("[data-region-hint]")).toBeNull();
    view.rerender(<ShikakuGarden {...p} hintToken={1} undoToken={1} />);
    expect(regionCount()).toBe(1);
    expect(document.querySelector("[data-region-hint]")).toBeNull();
  });
  it("applies a proven hint, resets unfinished selection, and resets cleanly on level changes", () => {
    const p = props(),
      view = render(<ShikakuGarden {...p} />);
    fireEvent.click(square("shikaku", 0));
    view.rerender(<ShikakuGarden {...p} hintToken={1} />);
    expect(
      document.querySelector("[data-anchor]")!.getAttribute("data-anchor"),
    ).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "采用这个矩形" }));
    expect(regionCount()).toBe(1);
    expect(document.querySelector("[data-region-hint]")).toBeNull();
    view.rerender(<ShikakuGarden {...p} resetToken={1} hintToken={1} />);
    expect(regionCount()).toBe(0);
    view.rerender(<ShikakuGarden {...p} level={11} />);
    expect(document.querySelectorAll("[data-shikaku-cell]")).toHaveLength(49);
    expect(regionCount()).toBe(0);
  });
  it.each(shikakuLevels.map((l, i) => [i, l] as const))(
    "completes Shikaku %i through real DOM clicks and locks terminal undo",
    (level, l) => {
      const p = props({ level });
      const view = render(<StrictMode><ShikakuGarden {...p} /></StrictMode>);
      l.solution.forEach((r) => draw(l.size, r));
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(document.querySelector("[data-complete=true]")).not.toBeNull();
      fireEvent.click(square("shikaku", 0));
      view.rerender(<StrictMode><ShikakuGarden {...p} undoToken={1} hintToken={1} /></StrictMode>);
      expect(regionCount()).toBe(l.clues.length);
      expect(document.querySelector("[data-complete=true]")).not.toBeNull();
      expect(document.querySelector("[data-region-hint]")).toBeNull();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    },
  );
  it("reset starts a new completion lifetime", () => {
    const p = props(),
      view = render(<ShikakuGarden {...p} />);
    shikakuLevels[0].solution.forEach((r) => draw(3, r));
    view.rerender(<ShikakuGarden {...p} resetToken={1} />);
    shikakuLevels[0].solution.forEach((r) => draw(3, r));
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
});

describe("Tents accessible round lifecycle", () => {
  it("keeps trees fixed and supports click cycle, selected-cell tools and undo", () => {
    const p = props(),
      view = render(<TentsGarden {...p} />),
      l = tentsLevels[0],
      i = createTentsState(l).board.findIndex((v) => v === -1);
    fireEvent.click(square("tents", l.trees[0]));
    expect(tentValues()[l.trees[0]]).toBe(0);
    fireEvent.click(square("tents", i));
    expect(tentValues()[i]).toBe(1);
    fireEvent.click(square("tents", i));
    expect(tentValues()[i]).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "清空" }));
    expect(tentValues()[i]).toBe(-1);
    view.rerender(<TentsGarden {...p} undoToken={1} />);
    expect(tentValues()[i]).toBe(0);
  });
  it("supports directional focus and native Space, T, X, Delete input", async () => {
    const user = userEvent.setup();
    render(<TentsGarden {...props()} />);
    square("tents", 0).focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(square("tents", 1));
    const i = createTentsState(tentsLevels[0]).board.findIndex((v) => v === -1);
    square("tents", i).focus();
    await user.keyboard("t");
    expect(tentValues()[i]).toBe(1);
    await user.keyboard("x");
    expect(tentValues()[i]).toBe(0);
    await user.keyboard("{Delete}");
    expect(tentValues()[i]).toBe(-1);
    await user.keyboard(" ");
    expect(tentValues()[i]).toBe(1);
  });
  it("pauses click, keyboard, hint application and undo without replay", () => {
    const p = props(),
      view = render(<TentsGarden {...p} />);
    view.rerender(<TentsGarden {...p} hintToken={1} />);
    expect(
      document.querySelector("[data-region-hint=deduction]"),
    ).not.toBeNull();
    view.rerender(<TentsGarden {...p} paused hintToken={2} undoToken={1} />);
    const before = tentValues();
    fireEvent.click(screen.getByRole("button", { name: "采用这一步" }));
    fireEvent.click(square("tents", tentsLevels[0].solution[0]));
    fireEvent.keyDown(square("tents", tentsLevels[0].solution[0]), {
      key: "t",
    });
    expect(tentValues()).toEqual(before);
    view.rerender(<TentsGarden {...p} hintToken={2} undoToken={1} />);
    expect(tentValues()).toEqual(before);
    fireEvent.click(screen.getByRole("button", { name: "采用这一步" }));
    expect(tentValues().filter((v) => v === 1)).toHaveLength(1);
  });
  it("shows row/column conflict feedback and clears stale hints when editing", () => {
    const p = props(),
      view = render(<TentsGarden {...p} />);
    view.rerender(<TentsGarden {...p} hintToken={1} />);
    const free = createTentsState(tentsLevels[0]).board.flatMap((v, i) =>
      v === -1 ? [i] : [],
    );
    for (const i of free.slice(0, 4)) fireEvent.click(square("tents", i));
    expect(document.querySelector("[data-region-hint]")).toBeNull();
    expect(
      document.querySelectorAll(".rc-square.is-conflict").length,
    ).toBeGreaterThan(0);
  });
  it("reset and level change clear state, selection, hints and completion latch", () => {
    const p = props(),
      view = render(<TentsGarden {...p} />);
    tentsLevels[0].solution.forEach((i) => fireEvent.click(square("tents", i)));
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(<TentsGarden {...p} resetToken={1} />);
    expect(tentValues()).toEqual(createTentsState(tentsLevels[0]).board);
    tentsLevels[0].solution.forEach((i) => fireEvent.click(square("tents", i)));
    expect(p.onComplete).toHaveBeenCalledTimes(2);
    view.rerender(<TentsGarden {...p} level={11} />);
    expect(tentValues()).toEqual(createTentsState(tentsLevels[11]).board);
    expect(tentValues()).toHaveLength(49);
  });
  it("completes all twelve puzzles by placing tents only, exactly once under StrictMode", () => {
    for (let level = 0; level < 12; level++) {
      const p = props({ level }),
        view = render(
          <StrictMode>
            <TentsGarden {...p} />
          </StrictMode>,
        ),
        l = tentsLevels[level];
      l.solution.forEach((i) => fireEvent.click(square("tents", i)));
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(document.querySelector("[data-complete=true]")).not.toBeNull();
      fireEvent.click(square("tents", l.solution[0]));
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      view.rerender(
        <StrictMode>
          <TentsGarden {...p} undoToken={1} />
        </StrictMode>,
      );
      fireEvent.click(square("tents", l.solution.at(-1)!));
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      view.unmount();
    }
  });
});

describe("explicit Tents toolbar target", () => {
  it("keeps a visible named cursor when focus moves into the toolbar", () => {
    render(<TentsGarden {...props()} />);
    const config = tentsLevels[0];
    const free = Array.from({ length: config.size ** 2 }, (_, i) => i).filter(
      (i) => !config.trees.includes(i),
    );
    const index = free[1];
    fireEvent.click(square("tents", index));
    expect(square("tents", index).getAttribute("data-tents-cursor")).toBe(
      "true",
    );
    expect(screen.getByTestId("tents-current-cell").textContent).toContain(
      `第 ${Math.floor(index / config.size) + 1} 行第 ${(index % config.size) + 1} 列`,
    );
    fireEvent.click(screen.getByRole("button", { name: "草地 X" }));
    expect(square("tents", index).getAttribute("data-value")).toBe("0");
    expect(square("tents", index).classList.contains("is-cursor")).toBe(true);
    expect(
      document.querySelectorAll('[data-tents-cursor="true"]'),
    ).toHaveLength(1);
  });
});
