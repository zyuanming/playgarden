// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GameProps } from "../src/lib/types";
import HashiGarden from "../src/games/HashiGarden";
import SlitherlinkGarden from "../src/games/SlitherlinkGarden";
import {
  hashiConflicts,
  hashiCrossings,
  hashiDegrees,
  hashiEdges,
  hashiLevels,
  hashiSolutions,
  getHashiHint,
  isHashiSolved,
  searchHashi,
  validHashiLevel,
  type HashiLevel,
} from "../src/games/hashiLogic";
import {
  getSlitherlinkHint,
  isSlitherlinkSolved,
  searchSlitherlink,
  slitherlinkConflicts,
  slitherlinkCounts,
  slitherlinkEdges,
  slitherlinkLevels,
  slitherlinkSolutions,
  validSlitherlinkLevel,
  type SlitherlinkLevel,
} from "../src/games/slitherlinkLogic";
import {
  createNetworkState,
  cycleNetworkEdge,
  editNetworkEdge,
  undoNetworkEdge,
  networkHint,
  searchNetwork,
} from "../src/games/networkDeductionCore";
import { networkDirectionalIndex } from "../src/games/NetworkDeductionRound";
afterEach(cleanup);
function props(overrides: Partial<GameProps> = {}): GameProps {
  return {
    level: 0,
    resetToken: 0,
    hintToken: 0,
    undoToken: 0,
    paused: false,
    onStatus: vi.fn(),
    onComplete: vi.fn(),
    ...overrides,
  };
}
function hashiIsland(index: number): HTMLButtonElement {
  return document.querySelector(`[data-hashi-island="${index}"]`)!;
}
function loopEdge(index: number): HTMLButtonElement {
  return document.querySelector(`[data-slitherlink-edge="${index}"]`)!;
}
function boardValues(game: "hashi" | "slitherlink") {
  return [...document.querySelectorAll(`[data-${game}-edge]`)].map((element) =>
    Number(element.getAttribute("data-value")),
  );
}
function action(value: number): HTMLButtonElement {
  return document.querySelector(`[data-network-action="${value}"]`)!;
}
// Independent validators deliberately do not call production geometry, solver, or victory code.
function independentHashi(level: HashiLevel, values: number[]) {
  const links: [number, number][] = [];
  for (let a = 0; a < level.islands.length; a++)
    for (let b = a + 1; b < level.islands.length; b++) {
      const p = level.islands[a],
        q = level.islands[b];
      if (p.x !== q.x && p.y !== q.y) continue;
      let blocked = false;
      for (let c = 0; c < level.islands.length; c++)
        if (c !== a && c !== b) {
          const r = level.islands[c];
          if (
            (p.x === q.x && r.x === p.x && (r.y - p.y) * (r.y - q.y) < 0) ||
            (p.y === q.y && r.y === p.y && (r.x - p.x) * (r.x - q.x) < 0)
          )
            blocked = true;
        }
      if (!blocked) links.push([a, b]);
    }
  if (
    links.length !== values.length ||
    values.some((v) => ![0, 1, 2].includes(v))
  )
    return false;
  const totals = level.islands.map(() => 0),
    seen = new Set([0]);
  links.forEach(([a, b], i) => {
    totals[a] += values[i];
    totals[b] += values[i];
  });
  if (totals.some((n, i) => n !== level.islands[i].bridges)) return false;
  for (let pass = 0; pass < level.islands.length; pass++)
    links.forEach(([a, b], i) => {
      if (values[i] && (seen.has(a) || seen.has(b))) {
        seen.add(a);
        seen.add(b);
      }
    });
  if (seen.size !== level.islands.length) return false;
  for (let a = 0; a < links.length; a++)
    for (let b = a + 1; b < links.length; b++) {
      if (!values[a] || !values[b]) continue;
      const [p, q] = links[a].map((i) => level.islands[i]),
        [r, s] = links[b].map((i) => level.islands[i]);
      const cross =
        (p.x === q.x &&
          r.y === s.y &&
          (p.x - r.x) * (p.x - s.x) < 0 &&
          (r.y - p.y) * (r.y - q.y) < 0) ||
        (p.y === q.y &&
          r.x === s.x &&
          (r.x - p.x) * (r.x - q.x) < 0 &&
          (p.y - r.y) * (p.y - s.y) < 0);
      if (cross) return false;
    }
  return true;
}
function independentLoop(level: SlitherlinkLevel, values: number[]) {
  const { rows, cols } = level,
    horizontal = (rows + 1) * cols;
  if (
    values.length !== horizontal + rows * (cols + 1) ||
    values.some((v) => v !== 0 && v !== 1)
  )
    return false;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const sum =
        values[r * cols + c] +
        values[(r + 1) * cols + c] +
        values[horizontal + r * (cols + 1) + c] +
        values[horizontal + r * (cols + 1) + c + 1];
      if (level.clues[r * cols + c] >= 0 && level.clues[r * cols + c] !== sum)
        return false;
    }
  const adjacency = Array.from(
    { length: (rows + 1) * (cols + 1) },
    () => [] as number[],
  );
  values.forEach((value, i) => {
    if (!value) return;
    const row =
        i < horizontal
          ? Math.floor(i / cols)
          : Math.floor((i - horizontal) / (cols + 1)),
      col = i < horizontal ? i % cols : (i - horizontal) % (cols + 1),
      a = row * (cols + 1) + col,
      b = a + (i < horizontal ? 1 : cols + 1);
    adjacency[a].push(b);
    adjacency[b].push(a);
  });
  if (adjacency.some((a) => a.length !== 0 && a.length !== 2)) return false;
  const first = adjacency.findIndex((a) => a.length);
  if (first < 0) return false;
  const seen = new Set([first]),
    queue = [first];
  for (const node of queue)
    for (const next of adjacency[node])
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
  return adjacency.every((a, i) => !a.length || seen.has(i));
}
function exhaustive(
  count: number,
  base: number,
  accepts: (values: number[]) => boolean,
) {
  const solutions: number[][] = [];
  for (let code = 0; code < base ** count; code++) {
    let rest = code;
    const values = Array.from({ length: count }, () => {
      const digit = rest % base;
      rest = Math.floor(rest / base);
      return digit;
    });
    if (accepts(values)) solutions.push(values);
  }
  return solutions.map((values) => values.join()).sort();
}

describe("original network puzzle certificates", () => {
  it("provides 12 distinct progressive, bounded boards per game", () => {
    expect(hashiLevels).toHaveLength(12);
    expect(slitherlinkLevels).toHaveLength(12);
    expect(hashiLevels.map((l) => l.islands.length)).toEqual([
      4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16,
    ]);
    expect(slitherlinkLevels.map((l) => l.rows)).toEqual([
      2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5,
    ]);
    expect(
      slitherlinkLevels.map((l) => l.clues.filter((n) => n < 0).length),
    ).toEqual([0, 1, 0, 2, 3, 2, 4, 6, 4, 6, 8, 10]);
    expect(
      new Set(hashiLevels.map((l) => JSON.stringify(l.islands))).size,
    ).toBe(12);
    expect(
      new Set(slitherlinkLevels.map((l) => JSON.stringify(l.solution))).size,
    ).toBe(12);
    hashiLevels
      .slice(6)
      .forEach((l) => expect(hashiCrossings(l).length).toBeGreaterThan(0));
  });
  for (const [index, level] of hashiLevels.entries()) {
    it(`Hashi ${index + 1}: independently valid certificate and unique public-clue solution`, () => {
      expect(validHashiLevel(level)).toBe(true);
      expect(independentHashi(level, level.solution)).toBe(true);
      const clueOnly = { ...level, solution: level.solution.map(() => 99) },
        proof = searchHashi(clueOnly);
      expect(proof.status).toBe("complete");
      expect(proof.solutions).toEqual([level.solution]);
      expect(hashiSolutions[index]).toEqual(level.solution);
      expect(isHashiSolved(clueOnly, level.solution)).toBe(true);
      expect(hashiConflicts(level, level.solution)).toEqual([]);
      expect(
        isHashiSolved(
          level,
          level.solution.map((v) => (v === 0 ? -1 : v)),
        ),
      ).toBe(true);
    });
    it(`Hashi ${index + 1}: current-state hints solve without certificate access`, () => {
      const clueOnly = { ...level, solution: [] };
      let state = createNetworkState(hashiEdges(level).length);
      for (
        let n = 0;
        n < state.values.length && !isHashiSolved(clueOnly, state.values);
        n++
      ) {
        const hint = getHashiHint(clueOnly, state.values);
        expect(hint?.kind).toBe("deduction");
        if (!hint || hint.kind === "unavailable") throw Error("missing proof");
        expect(hint.value).toBe(level.solution[hint.index]);
        expect(state.values[hint.index]).toBe(-1);
        state = editNetworkEdge(state, hint.index, hint.value, 2);
      }
      expect(isHashiSolved(clueOnly, state.values)).toBe(true);
      expect(getHashiHint(clueOnly, state.values)).toBeNull();
    });
  }
  for (const [index, level] of slitherlinkLevels.entries()) {
    it(`Slitherlink ${index + 1}: independently valid certificate and unique public-clue solution`, () => {
      expect(validSlitherlinkLevel(level)).toBe(true);
      expect(independentLoop(level, level.solution)).toBe(true);
      const clueOnly = { ...level, solution: level.solution.map(() => 99) },
        proof = searchSlitherlink(clueOnly);
      expect(proof.status).toBe("complete");
      expect(proof.solutions).toEqual([level.solution]);
      expect(slitherlinkSolutions[index]).toEqual(level.solution);
      expect(isSlitherlinkSolved(clueOnly, level.solution)).toBe(true);
      expect(slitherlinkConflicts(level, level.solution)).toEqual([]);
      expect(
        isSlitherlinkSolved(
          level,
          level.solution.map((v) => (v === 0 ? -1 : v)),
        ),
      ).toBe(true);
    });
    it(`Slitherlink ${index + 1}: current-state hints solve without certificate access`, () => {
      const clueOnly = { ...level, solution: [] };
      let state = createNetworkState(slitherlinkEdges(level).length);
      for (
        let n = 0;
        n < state.values.length && !isSlitherlinkSolved(clueOnly, state.values);
        n++
      ) {
        const hint = getSlitherlinkHint(clueOnly, state.values);
        expect(hint?.kind).toBe("deduction");
        if (!hint || hint.kind === "unavailable") throw Error("missing proof");
        expect(hint.value).toBe(level.solution[hint.index]);
        expect(state.values[hint.index]).toBe(-1);
        state = editNetworkEdge(state, hint.index, hint.value, 1);
      }
      expect(isSlitherlinkSolved(clueOnly, state.values)).toBe(true);
      expect(getSlitherlinkHint(clueOnly, state.values)).toBeNull();
    });
  }
  it("matches independent exhaustive enumeration on all 2×2 loop clue sets obtained from all edge assignments", () => {
    const base: SlitherlinkLevel = {
      title: "exhaustive",
      rows: 2,
      cols: 2,
      clues: [-1, -1, -1, -1],
      solution: [],
      idea: "",
    };
    const validLoops = exhaustive(12, 2, (values) =>
      independentLoop(base, values),
    ).map((s) => s.split(",").map(Number));
    expect(validLoops.length).toBeGreaterThan(5);
    const clueSets = new Map<string, number[]>();
    for (const loop of validLoops) {
      const clues = slitherlinkCounts(base, loop);
      if (clues.some((c) => c > 3)) continue;
      for (let mask = 0; mask < 16; mask++) {
        const c = clues.map((v, i) => (mask & (1 << i) ? v : -1));
        clueSets.set(c.join(), c);
      }
    }
    for (const clues of clueSets.values()) {
      const level = { ...base, clues },
        expected = validLoops
          .filter((v) => independentLoop(level, v))
          .map((v) => v.join())
          .sort(),
        actual = searchSlitherlink(level, undefined, 1000);
      expect(actual.status).toBe("complete");
      expect(actual.solutions.map((v) => v.join()).sort()).toEqual(expected);
    }
  });
  it("matches independent exhaustive ternary enumeration for every 4-island square degree tuple", () => {
    const square: HashiLevel = {
      title: "square",
      width: 2,
      height: 2,
      islands: [
        { x: 0, y: 0, bridges: 1 },
        { x: 1, y: 0, bridges: 1 },
        { x: 0, y: 1, bridges: 1 },
        { x: 1, y: 1, bridges: 1 },
      ],
      solution: [],
      idea: "",
    };
    for (let code = 0; code < 4 ** 4; code++) {
      let n = code;
      const level = {
          ...square,
          islands: square.islands.map((p) => {
            const bridges = (n % 4) + 1;
            n = Math.floor(n / 4);
            return { ...p, bridges };
          }),
        },
        proof = searchHashi(level, undefined, 1000);
      expect(proof.status).toBe("complete");
      expect(proof.solutions.map((v) => v.join()).sort()).toEqual(
        exhaustive(4, 3, (v) => independentHashi(level, v)),
      );
    }
  });
});

describe("network legality, budgets and state", () => {
  it("generates only visible nearest-neighbor Hashi edges and rejects crossing bridges", () => {
    const l: HashiLevel = {
      title: "cross",
      width: 3,
      height: 3,
      islands: [
        { x: 0, y: 1, bridges: 1 },
        { x: 2, y: 1, bridges: 1 },
        { x: 1, y: 0, bridges: 1 },
        { x: 1, y: 2, bridges: 1 },
      ],
      solution: [],
      idea: "",
    };
    expect(hashiEdges(l)).toEqual([
      { a: 0, b: 1 },
      { a: 2, b: 3 },
    ]);
    expect(hashiCrossings(l)).toEqual([[0, 1]]);
    expect(hashiConflicts(l, [1, 1])).toEqual([0, 1]);
    expect(searchHashi(l).solutions).toEqual([]);
    expect(isHashiSolved(l, [1, 1])).toBe(false);
    const withCenter = {
      ...l,
      islands: [...l.islands, { x: 1, y: 1, bridges: 4 }],
    };
    expect(hashiEdges(withCenter)).toHaveLength(4);
    expect(hashiCrossings(withCenter)).toEqual([]);
  });
  it("rejects disconnected degree-satisfied Hashi islands", () => {
    const l: HashiLevel = {
      title: "split",
      width: 2,
      height: 2,
      islands: [
        { x: 0, y: 0, bridges: 1 },
        { x: 1, y: 0, bridges: 1 },
        { x: 0, y: 1, bridges: 1 },
        { x: 1, y: 1, bridges: 1 },
      ],
      solution: [],
      idea: "",
    };
    expect(hashiDegrees(l, [1, 0, 0, 1])).toEqual([1, 1, 1, 1]);
    expect(isHashiSolved(l, [1, 0, 0, 1])).toBe(false);
    expect(hashiConflicts(l, [1, 0, 0, 1])).toEqual([0, 3]);
    expect(searchHashi(l).solutions).toHaveLength(0);
  });
  it("rejects multiple loops, branch vertices, empty loops and clue mismatch", () => {
    const l: SlitherlinkLevel = {
      title: "split",
      rows: 1,
      cols: 3,
      clues: [-1, -1, -1],
      solution: [],
      idea: "",
    };
    const split = [1, 0, 1, 1, 0, 1, 1, 1, 1, 1];
    expect(isSlitherlinkSolved(l, split)).toBe(false);
    expect(independentLoop(l, split)).toBe(false);
    expect(isSlitherlinkSolved(l, Array(10).fill(0))).toBe(false);
    const b = slitherlinkLevels[0],
      values = b.solution.slice();
    values[values.findIndex((v) => v === 0)] = 1;
    expect(isSlitherlinkSolved(b, values)).toBe(false);
    expect(slitherlinkConflicts(b, values).length).toBeGreaterThan(0);
  });
  it("does not pretend budget exhaustion or ambiguity proves a move", () => {
    expect(searchHashi(hashiLevels[0], undefined, 2, 0)).toMatchObject({
      status: "budget",
      nodes: 0,
      solutions: [],
    });
    expect(
      searchSlitherlink(slitherlinkLevels[0], undefined, 2, 0).status,
    ).toBe("budget");
    expect(
      getHashiHint(
        hashiLevels[0],
        createNetworkState(hashiEdges(hashiLevels[0]).length).values,
        0,
      )?.kind,
    ).toBe("unavailable");
    expect(
      getSlitherlinkHint(
        slitherlinkLevels[0],
        createNetworkState(slitherlinkEdges(slitherlinkLevels[0]).length)
          .values,
        0,
      )?.kind,
    ).toBe("unavailable");
    const ambiguous = { ...slitherlinkLevels[0], clues: [-1, -1, -1, -1] };
    expect(searchSlitherlink(ambiguous).status).toBe("limit");
    expect(searchSlitherlink(ambiguous).solutions).toHaveLength(2);
    expect(getSlitherlinkHint(ambiguous, Array(12).fill(-1))?.kind).toBe(
      "unavailable",
    );
    expect(
      networkHint(
        [-1],
        () => ({ solutions: [[1]], status: "budget", nodes: 1 }),
        false,
      )?.kind,
    ).toBe("unavailable");
    expect(
      networkHint(
        [-1],
        () => ({ solutions: [[1]], status: "limit", nodes: 1 }),
        false,
      )?.kind,
    ).toBe("unavailable");
  });
  it("repairs a false bridge, cross, or loop line without changing unrelated work", () => {
    for (const game of ["hashi", "slitherlink"] as const) {
      const level = game === "hashi" ? hashiLevels[0] : slitherlinkLevels[0],
        hintFn =
          game === "hashi"
            ? (v: number[]) => getHashiHint(level as HashiLevel, v)
            : (v: number[]) => getSlitherlinkHint(level as SlitherlinkLevel, v);
      for (const index of [0, level.solution.findIndex((v) => v > 0)]) {
        const values = Array(level.solution.length).fill(-1);
        values[index] = level.solution[index] === 0 ? 1 : 0;
        const hint = hintFn(values);
        expect(hint).toMatchObject({ kind: "repair", index, value: -1 });
        expect(values[index]).not.toBe(-1);
      }
    }
  });
  it("rejects malformed dimensions, coordinates, clues, marks and search options", () => {
    for (const level of [
      { ...hashiLevels[0], width: 0 },
      { ...hashiLevels[0], islands: [] },
      {
        ...hashiLevels[0],
        islands: [hashiLevels[0].islands[0], hashiLevels[0].islands[0]],
      },
    ])
      expect(searchHashi(level).status).toBe("invalid");
    for (const level of [
      { ...slitherlinkLevels[0], rows: NaN },
      { ...slitherlinkLevels[0], clues: [4] },
      { ...slitherlinkLevels[0], cols: 7 },
    ])
      expect(searchSlitherlink(level).status).toBe("invalid");
    expect(searchHashi(hashiLevels[0], [-1]).status).toBe("invalid");
    expect(
      searchSlitherlink(slitherlinkLevels[0], Array(12).fill(2)).status,
    ).toBe("invalid");
    expect(searchHashi(hashiLevels[0], undefined, 0).status).toBe("invalid");
    expect(
      searchSlitherlink(slitherlinkLevels[0], undefined, 2, -1).status,
    ).toBe("invalid");
    expect(isHashiSolved(hashiLevels[0], [Infinity])).toBe(false);
    expect(isSlitherlinkSolved(slitherlinkLevels[0], [])).toBe(false);
    expect(
      searchNetwork({
        values: [-1],
        maximum: 1,
        rules: [{ edges: [2], totals: [1] }],
        accept: () => true,
      }).status,
    ).toBe("invalid");
  });
  it("cycles and undoes immutable exact snapshots and ignores invalid or paused input", () => {
    const initial = createNetworkState(3);
    let state = initial;
    const states = [initial];
    for (let i = 0; i < 4; i++) {
      state = cycleNetworkEdge(state, 0, 2);
      states.push(state);
    }
    expect(states.map((s) => s.values[0])).toEqual([-1, 1, 2, 0, -1]);
    for (let i = 3; i >= 0; i--) {
      state = undoNetworkEdge(state);
      expect(state).toEqual(states[i]);
    }
    expect(undoNetworkEdge(initial)).toBe(initial);
    for (const index of [-1, 3, NaN, 0.1])
      expect(editNetworkEdge(initial, index, 1, 2)).toBe(initial);
    for (const value of [-2, 3, NaN, 0.1])
      expect(editNetworkEdge(initial, 0, value, 2)).toBe(initial);
    expect(editNetworkEdge(initial, 0, -1, 2)).toBe(initial);
    expect(cycleNetworkEdge(initial, 0, 2, true)).toBe(initial);
    expect(undoNetworkEdge(states[1], true)).toBe(states[1]);
    expect(initial.values).toEqual([-1, -1, -1]);
    expect(
      cycleNetworkEdge(
        cycleNetworkEdge(cycleNetworkEdge(initial, 0, 1), 0, 1),
        0,
        1,
      ).values[0],
    ).toBe(-1);
  });
  it("direction navigation stays bounded and uses spatial neighbors", () => {
    const p = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    expect(networkDirectionalIndex(p, 0, "ArrowRight")).toBe(1);
    expect(networkDirectionalIndex(p, 0, "ArrowDown")).toBe(2);
    expect(networkDirectionalIndex(p, 0, "ArrowLeft")).toBe(0);
    expect(networkDirectionalIndex(p, 0, "Tab")).toBe(0);
  });
});

describe("Hashi interaction and lifecycle", () => {
  it("cycles neighboring islands, rejects diagonal pairs, and supports the route toolbar", () => {
    render(<HashiGarden {...props()} />);
    const edges = hashiEdges(hashiLevels[0]);
    fireEvent.click(hashiIsland(edges[0].a));
    expect(hashiIsland(edges[0].a).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(hashiIsland(edges[0].b));
    expect(boardValues("hashi")[0]).toBe(1);
    fireEvent.click(hashiIsland(edges[0].a));
    fireEvent.click(hashiIsland(edges[0].b));
    expect(boardValues("hashi")[0]).toBe(2);
    fireEvent.change(screen.getByLabelText("选择桥岛航线"), {
      target: { value: "1" },
    });
    fireEvent.click(action(0));
    expect(boardValues("hashi")[1]).toBe(0);
    fireEvent.click(action(-1));
    expect(boardValues("hashi")[1]).toBe(-1);
    const invalid = hashiLevels[0].islands
      .flatMap((_, a) => hashiLevels[0].islands.map((_, b) => ({ a, b })))
      .find(
        ({ a, b }) =>
          a !== b &&
          !edges.some(
            (e) => (e.a === a && e.b === b) || (e.a === b && e.b === a),
          ),
      )!;
    const before = boardValues("hashi");
    fireEvent.click(hashiIsland(invalid.a));
    fireEvent.click(hashiIsland(invalid.b));
    expect(boardValues("hashi")).toEqual(before);
    expect(screen.getByRole("status").textContent).toContain("不能直连");
  });
  it("supports keyboard-only island selection, numeric bridge input and spatial focus", async () => {
    const user = userEvent.setup();
    render(<HashiGarden {...props()} />);
    hashiIsland(0).focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(hashiIsland(1));
    await user.keyboard("1");
    expect(boardValues("hashi")[0]).toBe(1);
    await user.keyboard("2");
    expect(boardValues("hashi")[0]).toBe(2);
    await user.keyboard("x");
    expect(boardValues("hashi")[0]).toBe(0);
    await user.keyboard("{Delete}");
    expect(boardValues("hashi")[0]).toBe(-1);
    hashiIsland(0).focus();
    await user.keyboard("{Enter}");
    hashiIsland(1).focus();
    await user.keyboard(" ");
    expect(boardValues("hashi")[0]).toBe(1);
  });
  it("pauses all mutation and consumes paused tokens without replay; reset and level remount cleanly", () => {
    const p = props(),
      r = render(<HashiGarden {...p} />);
    fireEvent.click(action(1));
    r.rerender(<HashiGarden {...p} paused hintToken={1} undoToken={1} />);
    fireEvent.click(action(2));
    fireEvent.keyDown(hashiIsland(0), { key: "2" });
    expect(boardValues("hashi")[0]).toBe(1);
    expect(document.querySelector("[data-network-apply-hint]")).toBeNull();
    r.rerender(<HashiGarden {...p} hintToken={1} undoToken={1} />);
    expect(boardValues("hashi")[0]).toBe(1);
    r.rerender(<HashiGarden {...p} hintToken={1} undoToken={2} />);
    expect(boardValues("hashi").every((v) => v < 0)).toBe(true);
    fireEvent.click(action(2));
    r.rerender(<HashiGarden {...p} resetToken={1} hintToken={2} />);
    expect(boardValues("hashi").every((v) => v < 0)).toBe(true);
    expect(document.querySelector("[data-network-apply-hint]")).toBeNull();
    r.rerender(<HashiGarden {...p} level={11} />);
    expect(document.querySelectorAll("[data-hashi-island]")).toHaveLength(16);
  });
  it("offers one explicit hint step and completes once per reset even in StrictMode", () => {
    const p = props(),
      r = render(
        <StrictMode>
          <HashiGarden {...p} />
        </StrictMode>,
      );
    r.rerender(
      <StrictMode>
        <HashiGarden {...p} hintToken={1} />
      </StrictMode>,
    );
    expect(boardValues("hashi").every((v) => v < 0)).toBe(true);
    fireEvent.click(screen.getByText("采用这一步"));
    expect(boardValues("hashi").filter((v) => v >= 0)).toHaveLength(1);
    hashiLevels[0].solution.forEach((v, index) => {
      fireEvent.change(screen.getByLabelText("选择桥岛航线"), {
        target: { value: String(index) },
      });
      fireEvent.click(action(v));
    });
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    fireEvent.click(action(1));
    r.rerender(
      <StrictMode>
        <HashiGarden {...p} hintToken={2} />
      </StrictMode>,
    );
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    r.rerender(
      <StrictMode>
        <HashiGarden {...p} resetToken={1} />
      </StrictMode>,
    );
    expect(boardValues("hashi").every((v) => v < 0)).toBe(true);
    hashiLevels[0].solution.forEach((v, index) => {
      fireEvent.change(screen.getByLabelText("选择桥岛航线"), {
        target: { value: String(index) },
      });
      fireEvent.click(action(v));
    });
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
});

describe("Slitherlink interaction and lifecycle", () => {
  it("cycles touch targets with labels, supports spatial keyboard and toolbar edits", async () => {
    const user = userEvent.setup();
    render(<SlitherlinkGarden {...props()} />);
    fireEvent.click(loopEdge(0));
    expect(boardValues("slitherlink")[0]).toBe(1);
    fireEvent.click(loopEdge(0));
    expect(boardValues("slitherlink")[0]).toBe(0);
    fireEvent.click(loopEdge(0));
    expect(boardValues("slitherlink")[0]).toBe(-1);
    loopEdge(0).focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(loopEdge(1));
    await user.keyboard("1");
    expect(boardValues("slitherlink")[1]).toBe(1);
    await user.keyboard("x");
    expect(boardValues("slitherlink")[1]).toBe(0);
    await user.keyboard("{Backspace}");
    expect(boardValues("slitherlink")[1]).toBe(-1);
    await user.keyboard("{Enter}");
    expect(boardValues("slitherlink")[1]).toBe(1);
    fireEvent.click(action(0));
    expect(boardValues("slitherlink")[1]).toBe(0);
    expect(loopEdge(1).getAttribute("aria-label")).toContain("不画线");
  });
  it("pauses, ignores stale tokens, undoes exact edits and resets between levels", () => {
    const p = props(),
      r = render(<SlitherlinkGarden {...p} />);
    fireEvent.click(loopEdge(0));
    fireEvent.click(loopEdge(1));
    r.rerender(<SlitherlinkGarden {...p} undoToken={1} />);
    expect(boardValues("slitherlink").slice(0, 2)).toEqual([1, -1]);
    r.rerender(<SlitherlinkGarden {...p} paused hintToken={1} undoToken={2} />);
    fireEvent.click(loopEdge(1));
    expect(boardValues("slitherlink").slice(0, 2)).toEqual([1, -1]);
    r.rerender(<SlitherlinkGarden {...p} hintToken={1} undoToken={2} />);
    expect(boardValues("slitherlink").slice(0, 2)).toEqual([1, -1]);
    expect(document.querySelector("[data-network-apply-hint]")).toBeNull();
    r.rerender(<SlitherlinkGarden {...p} resetToken={1} hintToken={1} />);
    expect(boardValues("slitherlink").every((v) => v < 0)).toBe(true);
    r.rerender(<SlitherlinkGarden {...p} level={11} />);
    expect(document.querySelectorAll("[data-slitherlink-cell]")).toHaveLength(
      25,
    );
    expect(boardValues("slitherlink")).toHaveLength(60);
  });
  it("highlights a proven hint without applying it and delivers completion once", () => {
    const p = props(),
      r = render(
        <StrictMode>
          <SlitherlinkGarden {...p} />
        </StrictMode>,
      );
    r.rerender(
      <StrictMode>
        <SlitherlinkGarden {...p} hintToken={1} />
      </StrictMode>,
    );
    expect(boardValues("slitherlink").every((v) => v < 0)).toBe(true);
    expect(document.querySelector(".nd-hinted")).not.toBeNull();
    fireEvent.click(screen.getByText("采用这一步"));
    slitherlinkLevels[0].solution.forEach((v, index) => {
      if (v && boardValues("slitherlink")[index] !== 1)
        fireEvent.click(loopEdge(index));
    });
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    expect(boardValues("slitherlink").includes(-1)).toBe(true);
    expect(
      isSlitherlinkSolved(slitherlinkLevels[0], boardValues("slitherlink")),
    ).toBe(true);
    r.rerender(
      <StrictMode>
        <SlitherlinkGarden {...p} hintToken={2} />
      </StrictMode>,
    );
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    r.rerender(
      <StrictMode>
        <SlitherlinkGarden {...p} resetToken={1} />
      </StrictMode>,
    );
    slitherlinkLevels[0].solution.forEach((v, index) => {
      if (v) fireEvent.click(loopEdge(index));
    });
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
  it("marks local errors accessibly without triggering a false completion", () => {
    const p = props();
    render(<SlitherlinkGarden {...p} />);
    for (const i of [0, 1, 7]) fireEvent.click(loopEdge(i));
    expect(
      document.querySelectorAll('[data-conflict="true"]').length,
    ).toBeGreaterThan(0);
    expect(p.onComplete).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("检查");
  });
});

describe("every level can be completed through its actual rendered controls", () => {
  for (const [index, level] of hashiLevels.entries()) {
    it(`Hashi ${index + 1} completes with its public route selector and bridge buttons`, () => {
      const p = props({ level: index });
      render(<HashiGarden {...p} />);
      level.solution.forEach((value, edge) => {
        if (!value) return;
        fireEvent.change(screen.getByLabelText("选择桥岛航线"), {
          target: { value: String(edge) },
        });
        fireEvent.click(action(value));
      });
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        independentHashi(
          level,
          boardValues("hashi").map((v) => Math.max(0, v)),
        ),
      ).toBe(true);
      expect(
        [
          ...document.querySelectorAll<HTMLButtonElement>(
            "[data-hashi-island]",
          ),
        ].every((button) => button.disabled),
      ).toBe(true);
    });
  }
  for (const [index, level] of slitherlinkLevels.entries()) {
    it(`Slitherlink ${index + 1} completes through clickable edge targets`, () => {
      const p = props({ level: index });
      render(<SlitherlinkGarden {...p} />);
      level.solution.forEach((value, edge) => {
        if (value) fireEvent.click(loopEdge(edge));
      });
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        independentLoop(
          level,
          boardValues("slitherlink").map((v) => Math.max(0, v)),
        ),
      ).toBe(true);
      expect(
        [
          ...document.querySelectorAll<HTMLButtonElement>(
            "[data-slitherlink-edge]",
          ),
        ].every((button) => button.disabled),
      ).toBe(true);
    });
  }
});
