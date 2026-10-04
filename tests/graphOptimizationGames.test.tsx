// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GameProps } from "../src/lib/types";
import UntangleGarden from "../src/games/UntangleGarden";
import MinimumNetwork from "../src/games/MinimumNetwork";
import {
  createUntangleState,
  gardenKeyboardSpot,
  gardenPoint,
  gardenPointOnSegment,
  gardenSegmentsIntersect,
  isUntangleSolved,
  moveGardenNode,
  undoUntangle,
  untangleConflicts,
  untangleHint,
  untangleLevels,
  validGardenPositions,
  verifyUntangleLevel,
  type GardenEdge,
  type UntangleLevel,
} from "../src/games/untangleLogic";
import {
  analyzeNetwork,
  createNetworkState,
  isMinimumNetworkSolved,
  minimumNetworkHint,
  minimumNetworkLevels,
  networkKeyboardEdge,
  networkMinimumCost,
  networkLabelPositions,
  optimalNetworkTree,
  toggleNetworkEdge,
  undoNetwork,
  verifyMinimumNetworkCertificate,
  verifyNetworkGraph,
  type MinimumNetworkLevel,
  type NetworkEdge,
} from "../src/games/minimumNetworkLogic";

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
function spot(index: number) {
  return document.querySelector<HTMLButtonElement>(
    `[data-garden-spot="${index}"]`,
  )!;
}
function flower(index: number) {
  return document.querySelector<HTMLButtonElement>(
    `[data-garden-node="${index}"]`,
  )!;
}
function edge(index: number) {
  return document.querySelector<HTMLButtonElement>(
    `[data-network-edge="${index}"]`,
  )!;
}

// Independent exact oracle using parametric segments and coordinate bounds.
function independentGardenValid(
  level: UntangleLevel,
  placement: readonly number[],
) {
  const points = placement.map((p) => [
    p % level.size,
    Math.floor(p / level.size),
  ]);
  const subtract = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1]];
  const cross = (a: number[], b: number[]) => a[0] * b[1] - a[1] * b[0];
  const on = (p: number[], a: number[], b: number[]) =>
    cross(subtract(p, a), subtract(b, a)) === 0 &&
    p.every(
      (value, k) =>
        value >= Math.min(a[k], b[k]) && value <= Math.max(a[k], b[k]),
    );
  for (const [index, [a, b]] of level.edges.entries()) {
    for (let i = 0; i < points.length; i++)
      if (i !== a && i !== b && on(points[i], points[a], points[b]))
        return false;
    for (const [c, d] of level.edges.slice(index + 1)) {
      if ([a, b].includes(c) || [a, b].includes(d)) continue;
      const r = subtract(points[b], points[a]),
        s = subtract(points[d], points[c]),
        q = subtract(points[c], points[a]);
      const denominator = cross(r, s),
        numeratorT = cross(q, s),
        numeratorU = cross(q, r);
      if (denominator) {
        const t = numeratorT / denominator,
          u = numeratorU / denominator;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return false;
      } else if (
        on(points[c], points[a], points[b]) ||
        on(points[d], points[a], points[b]) ||
        on(points[a], points[c], points[d])
      )
        return false;
    }
  }
  return true;
}
function permutations(items: number[], count: number): number[][] {
  if (!count) return [[]];
  return items.flatMap((value, i) =>
    permutations(
      items.filter((_, j) => i !== j),
      count - 1,
    ).map((tail) => [value, ...tail]),
  );
}
// Independent MST oracle: enumerate subsets and use reachability, no union-find or Kruskal.
function independentTrees(level: MinimumNetworkLevel) {
  let optimum = Infinity;
  const trees: number[][] = [];
  for (let mask = 0; mask < 2 ** level.edges.length; mask++) {
    const selected = level.edges.flatMap((_, i) =>
      mask & (2 ** i) ? [i] : [],
    );
    if (selected.length !== level.stations.length - 1) continue;
    const reached = new Set([0]);
    for (let pass = 0; pass < level.stations.length; pass++)
      for (const i of selected) {
        const { a, b } = level.edges[i];
        if (reached.has(a)) reached.add(b);
        if (reached.has(b)) reached.add(a);
      }
    if (reached.size !== level.stations.length) continue;
    const cost = selected.reduce((sum, i) => sum + level.edges[i].cost, 0);
    if (cost < optimum) {
      optimum = cost;
      trees.length = 0;
    }
    if (cost === optimum) trees.push(selected);
  }
  return { optimum, trees };
}
function smallNetwork(edges: NetworkEdge[]): MinimumNetworkLevel {
  return {
    title: "oracle",
    idea: "",
    stations: Array.from({ length: 4 }, (_, i) => ({
      label: String(i),
      x: 20 + i * 20,
      y: 50,
    })),
    edges,
    certificate: [],
    minimumCost: 0,
  };
}

describe("untangle original certified levels and exact geometry", () => {
  it("has twelve progressively larger connected boards, independently valid certificates and finite hints", () => {
    expect(untangleLevels).toHaveLength(12);
    expect(new Set(untangleLevels.map((l) => l.title)).size).toBe(12);
    for (const [index, level] of untangleLevels.entries()) {
      expect(verifyUntangleLevel(level), level.title).toBe(true);
      expect(independentGardenValid(level, level.solution), level.title).toBe(
        true,
      );
      expect(independentGardenValid(level, level.initial), level.title).toBe(
        false,
      );
      if (index)
        expect(level.edges.length).toBeGreaterThanOrEqual(
          untangleLevels[index - 1].edges.length,
        );
      let state = createUntangleState(level);
      for (
        let step = 0;
        step < level.labels.length * 2 && !isUntangleSolved(level, state);
        step++
      ) {
        const hint = untangleHint(level, state);
        expect(hint.kind).toBe("move");
        if (hint.kind !== "move")
          throw new Error("Expected a legal relocation");
        const next = moveGardenNode(level, state, hint.node, hint.spot);
        expect(next).not.toBe(state);
        state = next;
      }
      expect(isUntangleSolved(level, state), level.title).toBe(true);
      expect(independentGardenValid(level, state.positions)).toBe(true);
    }
  });
  it("agrees with the independent geometry oracle on every 3-node placement and every square graph", () => {
    const triples = permutations([0, 1, 2, 3, 4, 5, 6, 7, 8], 3);
    const threeEdges: GardenEdge[] = [
      [0, 1],
      [0, 2],
      [1, 2],
    ];
    for (let mask = 1; mask < 8; mask++) {
      const level: UntangleLevel = {
        title: "oracle",
        idea: "",
        size: 3,
        labels: ["A", "B", "C"],
        edges: threeEdges.filter((_, i) => mask & (2 ** i)),
        initial: [],
        solution: [],
      };
      for (const positions of triples)
        expect(isUntangleSolved(level, { positions })).toBe(
          independentGardenValid(level, positions),
        );
    }
    const all: GardenEdge[] = [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ];
    for (let mask = 1; mask < 64; mask++) {
      const level: UntangleLevel = {
        title: "square",
        idea: "",
        size: 2,
        labels: ["A", "B", "C", "D"],
        edges: all.filter((_, i) => mask & (2 ** i)),
        initial: [],
        solution: [],
      };
      for (const positions of permutations([0, 1, 2, 3], 4))
        expect(isUntangleSolved(level, { positions })).toBe(
          independentGardenValid(level, positions),
        );
    }
  });
  it("counts collinear overlap, vertex-through-edge, crossings and shared endpoints correctly", () => {
    const p = (x: number, y: number) => ({ x, y });
    expect(gardenSegmentsIntersect(p(0, 0), p(4, 4), p(0, 4), p(4, 0))).toBe(
      true,
    );
    expect(gardenSegmentsIntersect(p(0, 0), p(4, 0), p(2, 0), p(5, 0))).toBe(
      true,
    );
    expect(gardenSegmentsIntersect(p(0, 0), p(1, 0), p(2, 0), p(3, 0))).toBe(
      false,
    );
    expect(gardenPointOnSegment(p(0, 0), p(4, 4), p(2, 2))).toBe(true);
    const level: UntangleLevel = {
      title: "through",
      idea: "",
      size: 3,
      labels: ["A", "B", "C"],
      edges: [
        [0, 1],
        [0, 2],
      ],
      initial: [0, 2, 1],
      solution: [0, 2, 3],
    };
    expect(untangleConflicts(level, level.initial).throughNodes).toEqual([
      [0, 2],
    ]);
    expect(untangleConflicts(level, level.solution).total).toBe(0);
    expect(gardenPoint(5, 13)).toEqual({ x: 3, y: 2 });
  });
  it("supports every alternate valid layout and plans from arbitrary current placements", () => {
    const level = untangleLevels[2];
    for (const positions of permutations([0, 4, 20, 24], 4)) {
      let state = { positions, history: [] as number[][] };
      expect(isUntangleSolved(level, state)).toBe(
        independentGardenValid(level, positions),
      );
      for (let i = 0; i < 8 && !isUntangleSolved(level, state); i++) {
        const hint = untangleHint(level, state);
        expect(hint.kind).toBe("move");
        if (hint.kind === "move")
          state = moveGardenNode(level, state, hint.node, hint.spot);
      }
      expect(isUntangleSolved(level, state)).toBe(true);
    }
  });
  it("rejects malformed boards and illegal moves without mutating history", () => {
    const level = untangleLevels[0],
      original = createUntangleState(level),
      snapshot = JSON.stringify(original);
    for (const [node, destination] of [
      [-1, 5],
      [0, -1],
      [0, 25],
      [0, 1.5],
      [1.1, 5],
      [0, original.positions[1]],
    ])
      expect(moveGardenNode(level, original, node, destination)).toBe(original);
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(undoUntangle(original)).toBe(original);
    expect(validGardenPositions(level, [0, 0, 1, 2])).toBe(false);
    expect(verifyUntangleLevel({ ...level, edges: [[0, 12]] })).toBe(false);
    expect(
      verifyUntangleLevel({
        ...level,
        edges: [
          [0, 1],
          [1, 0],
        ],
      }),
    ).toBe(false);
    expect(
      isUntangleSolved(
        { ...level, edges: [[0, 12]] },
        { positions: [...level.solution] },
      ),
    ).toBe(false);
    expect(
      untangleHint({ ...level, solution: [0, 0, 1, 2] }, original).kind,
    ).toBe("invalid");
    const hint = untangleHint(level, original);
    if (hint.kind !== "move") throw Error("hint");
    const moved = moveGardenNode(level, original, hint.node, hint.spot);
    expect(undoUntangle(moved)).toEqual(original);
    const solved = { positions: [...level.solution], history: [] };
    expect(moveGardenNode(level, solved, 0, 12)).toBe(solved);
  });
});

describe("minimum networks and independent optimality certificates", () => {
  it("has twelve progressive independently certified levels and accepts all enumerated optimal trees", () => {
    expect(minimumNetworkLevels).toHaveLength(12);
    expect(new Set(minimumNetworkLevels.map((l) => l.title)).size).toBe(12);
    for (const [index, level] of minimumNetworkLevels.entries()) {
      expect(verifyNetworkGraph(level), level.title).toBe(true);
      expect(verifyMinimumNetworkCertificate(level), level.title).toBe(true);
      if (index)
        expect(level.edges.length).toBeGreaterThanOrEqual(
          minimumNetworkLevels[index - 1].edges.length,
        );
      const oracle = independentTrees(level);
      expect(oracle.optimum, level.title).toBe(level.minimumCost);
      expect(networkMinimumCost(level)).toBe(oracle.optimum);
      for (const selected of oracle.trees)
        expect(isMinimumNetworkSolved(level, { selected })).toBe(true);
      let state = createNetworkState();
      for (let i = 0; i < level.stations.length; i++) {
        const hint = minimumNetworkHint(level, state);
        if (hint.kind !== "add") break;
        state = toggleNetworkEdge(level, state, hint.edge);
      }
      expect(isMinimumNetworkSolved(level, state)).toBe(true);
    }
  });
  it("matches exhaustive enumeration for every four-node graph with absent/1/2-cost edges", () => {
    const pairs = [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ];
    for (let code = 0; code < 3 ** pairs.length; code++) {
      let value = code;
      const edges: NetworkEdge[] = [];
      for (const [a, b] of pairs) {
        const cost = value % 3;
        value = Math.floor(value / 3);
        if (cost) edges.push({ a, b, cost });
      }
      const level = smallNetwork(edges),
        oracle = independentTrees(level),
        computed = optimalNetworkTree(level);
      expect(networkMinimumCost(level)).toBe(
        Number.isFinite(oracle.optimum) ? oracle.optimum : null,
      );
      if (!computed) {
        expect(oracle.trees).toHaveLength(0);
        continue;
      }
      for (const selected of oracle.trees)
        expect(isMinimumNetworkSolved(level, { selected })).toBe(true);
      const preferred = edges.flatMap((_, i) => (i % 2 === 0 ? [i] : [])),
        tree = optimalNetworkTree(level, preferred)!;
      const overlap = (selection: number[]) =>
        selection.filter((i) => preferred.includes(i)).length;
      expect(overlap(tree)).toBe(Math.max(...oracle.trees.map(overlap)));
      expect(
        verifyMinimumNetworkCertificate({
          ...level,
          certificate: computed,
          minimumCost: oracle.optimum,
        }),
      ).toBe(true);
    }
  });
  it("repairs arbitrary selections using executable bounded current-state hints", () => {
    const level = minimumNetworkLevels[1];
    for (let mask = 0; mask < 2 ** level.edges.length; mask++) {
      let state = {
        selected: level.edges.flatMap((_, i) => (mask & (2 ** i) ? [i] : [])),
        history: [] as number[][],
      };
      for (
        let step = 0;
        step < level.edges.length + level.stations.length &&
        !isMinimumNetworkSolved(level, state);
        step++
      ) {
        const hint = minimumNetworkHint(level, state);
        expect(["add", "remove"]).toContain(hint.kind);
        if (hint.kind === "add" || hint.kind === "remove") {
          expect(state.selected.includes(hint.edge)).toBe(
            hint.kind === "remove",
          );
          state = toggleNetworkEdge(level, state, hint.edge);
        }
      }
      expect(isMinimumNetworkSolved(level, state)).toBe(true);
    }
  });
  it("rejects disconnected, cyclic, costly and invalid selections and forged certificates", () => {
    const level = minimumNetworkLevels[0];
    const original = [
      [0, 1],
      [1, 2],
      [2, 3],
      [0, 2],
      [0, 3],
    ].map(([a, b]) => level.edges.findIndex((e) => e.a === a && e.b === b));
    const [ab, bc, , ac, ad] = original;
    expect(analyzeNetwork(level, [ab, bc, ac]).cycle).toBe(true);
    expect(isMinimumNetworkSolved(level, { selected: [0, 1] })).toBe(false);
    expect(isMinimumNetworkSolved(level, { selected: [ab, bc, ad] })).toBe(
      false,
    );
    expect(isMinimumNetworkSolved(level, { selected: [0, 1, 2, 3] })).toBe(
      false,
    );
    expect(isMinimumNetworkSolved(level, { selected: [0, 0, 2] })).toBe(false);
    expect(
      verifyMinimumNetworkCertificate({
        ...level,
        certificate: [ab, bc, ad],
        minimumCost: 8,
      }),
    ).toBe(false);
    expect(verifyMinimumNetworkCertificate({ ...level, minimumCost: 5 })).toBe(
      false,
    );
    expect(
      verifyNetworkGraph({ ...level, edges: [{ a: 0, b: 4, cost: 1 }] }),
    ).toBe(false);
    expect(
      verifyNetworkGraph({ ...level, edges: [{ a: 0, b: 1, cost: -1 }] }),
    ).toBe(false);
    expect(
      verifyNetworkGraph({ ...level, edges: [level.edges[0], level.edges[0]] }),
    ).toBe(false);
    expect(optimalNetworkTree({ ...level, edges: [] })).toBeNull();
    const empty = createNetworkState();
    expect(undoNetwork(empty)).toBe(empty);
    for (const invalid of [-1, 99, 1.1])
      expect(toggleNetworkEdge(level, empty, invalid)).toBe(empty);
    const added = toggleNetworkEdge(level, empty, 0);
    expect(empty.selected).toEqual([]);
    expect(undoNetwork(added)).toEqual(empty);
    const solved = { selected: [...level.certificate], history: [] };
    expect(toggleNetworkEdge(level, solved, 0)).toBe(solved);
    expect(
      minimumNetworkHint(level, { selected: [99], history: [] }).kind,
    ).toBe("invalid");
  });
});

describe("rendered graph optimization controls", () => {
  it("completes every untangle level through visible select-and-destination controls, once", () => {
    for (const [index, config] of untangleLevels.entries()) {
      const p = props({ level: index }),
        view = render(
          <StrictMode>
            <UntangleGarden {...p} />
          </StrictMode>,
        );
      let state = createUntangleState(config);
      for (
        let step = 0;
        step < config.labels.length * 2 && !isUntangleSolved(config, state);
        step++
      ) {
        const hint = untangleHint(config, state);
        if (hint.kind !== "move") throw Error("hint");
        fireEvent.click(flower(hint.node));
        expect(flower(hint.node).getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(spot(hint.spot));
        state = moveGardenNode(config, state, hint.node, hint.spot);
        expect(Number(flower(hint.node).getAttribute("data-garden-spot"))).toBe(
          state.positions[hint.node],
        );
      }
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        document.querySelector('[data-untangle-solved="true"]'),
      ).not.toBeNull();
      view.rerender(
        <StrictMode>
          <UntangleGarden {...p} hintToken={10} undoToken={10} />
        </StrictMode>,
      );
      fireEvent.click(spot(0));
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      view.unmount();
    }
  });
  it("completes every network level via rendered edge buttons and accepts a different optimum", () => {
    for (const [index, config] of minimumNetworkLevels.entries()) {
      const p = props({ level: index }),
        view = render(
          <StrictMode>
            <MinimumNetwork {...p} />
          </StrictMode>,
        );
      const oracle = independentTrees(config),
        solution = oracle.trees.at(-1)!;
      for (const selected of solution) fireEvent.click(edge(selected));
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        document.querySelector('[data-network-solved="true"]'),
      ).not.toBeNull();
      view.rerender(
        <StrictMode>
          <MinimumNetwork {...p} hintToken={5} undoToken={5} />
        </StrictMode>,
      );
      fireEvent.click(edge(0));
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      view.unmount();
    }
    const config = minimumNetworkLevels[1];
    expect(
      independentTrees(config).trees.some(
        (tree) => tree.join() !== config.certificate.join(),
      ),
    ).toBe(true);
  });
  it("shows untangle hints without moving, honors pause tokens, undo, reset and fresh level state", () => {
    const config = untangleLevels[11],
      p = props({ level: 11 }),
      view = render(<UntangleGarden {...p} />);
    const initial = config.initial.join(),
      placement = () =>
        config.labels
          .map((_, i) => flower(i).getAttribute("data-garden-spot"))
          .join();
    view.rerender(<UntangleGarden {...p} hintToken={1} />);
    expect(placement()).toBe(initial);
    expect(screen.getByRole("status").textContent).toContain("先点花朵");
    const hint = untangleHint(config, createUntangleState(config));
    if (hint.kind !== "move") throw Error("hint");
    fireEvent.click(flower(hint.node));
    fireEvent.click(spot(hint.spot));
    expect(placement()).not.toBe(initial);
    view.rerender(<UntangleGarden {...p} paused hintToken={2} undoToken={1} />);
    const frozen = placement();
    fireEvent.click(flower(0));
    fireEvent.click(spot(1));
    expect(placement()).toBe(frozen);
    expect(spot(1).disabled).toBe(true);
    view.rerender(<UntangleGarden {...p} hintToken={2} undoToken={1} />);
    expect(placement()).toBe(frozen);
    view.rerender(<UntangleGarden {...p} hintToken={2} undoToken={2} />);
    expect(placement()).toBe(initial);
    view.rerender(
      <UntangleGarden {...p} resetToken={1} hintToken={50} undoToken={50} />,
    );
    expect(placement()).toBe(initial);
    expect(screen.queryByRole("status")).toBeNull();
    view.rerender(<UntangleGarden {...p} level={1} />);
    expect(flower(0).getAttribute("data-garden-spot")).toBe(
      String(untangleLevels[1].initial[0]),
    );
  });
  it("shows network hints without toggling, cancels edges, ignores paused tokens, undo and reset", () => {
    const p = props(),
      view = render(<MinimumNetwork {...p} />);
    const costly = minimumNetworkLevels[0].edges.findIndex((e) => e.cost === 5);
    const other = minimumNetworkLevels[0].certificate[0];
    fireEvent.click(edge(costly));
    expect(edge(costly).getAttribute("aria-pressed")).toBe("true");
    view.rerender(<MinimumNetwork {...p} hintToken={1} />);
    expect(edge(costly).getAttribute("data-hint-action")).toBe("remove");
    expect(edge(costly).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(edge(costly));
    expect(edge(costly).getAttribute("aria-pressed")).toBe("false");
    view.rerender(<MinimumNetwork {...p} undoToken={1} hintToken={1} />);
    expect(edge(costly).getAttribute("aria-pressed")).toBe("true");
    view.rerender(<MinimumNetwork {...p} paused undoToken={2} hintToken={2} />);
    fireEvent.click(edge(other));
    expect(edge(other).getAttribute("aria-pressed")).toBe("false");
    view.rerender(<MinimumNetwork {...p} undoToken={2} hintToken={2} />);
    expect(edge(costly).getAttribute("aria-pressed")).toBe("true");
    view.rerender(<MinimumNetwork {...p} undoToken={3} hintToken={2} />);
    expect(edge(costly).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(edge(other));
    view.rerender(
      <MinimumNetwork {...p} resetToken={1} hintToken={99} undoToken={99} />,
    );
    expect(edge(other).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("status")).toBeNull();
    view.rerender(<MinimumNetwork {...p} level={11} />);
    expect(document.querySelectorAll("[data-network-edge]")).toHaveLength(
      minimumNetworkLevels[11].edges.length,
    );
  });
  it("supports real keyboard selection, arrows, boundaries, escape and touch-sized semantic buttons", async () => {
    const user = userEvent.setup(),
      p = props(),
      view = render(<UntangleGarden {...p} />);
    flower(0).focus();
    await user.keyboard("{Enter}");
    expect(flower(0).getAttribute("aria-pressed")).toBe("true");
    await user.keyboard("{Escape}");
    expect(flower(0).getAttribute("aria-pressed")).toBe("false");
    spot(0).focus();
    await user.keyboard("{ArrowRight}{ArrowDown}");
    expect(document.activeElement).toBe(spot(6));
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(spot(24));
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(spot(0));
    expect(gardenKeyboardSpot(5, 0, "ArrowLeft")).toBe(0);
    expect(gardenKeyboardSpot(5, 24, "ArrowDown")).toBe(24);
    view.unmount();
    render(<MinimumNetwork {...p} />);
    edge(0).focus();
    await user.keyboard(" ");
    expect(edge(0).getAttribute("aria-pressed")).toBe("true");
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(edge(1));
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(edge(4));
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(edge(0));
    expect(networkKeyboardEdge(5, 0, "ArrowLeft")).toBe(0);
    expect(networkKeyboardEdge(5, 4, "ArrowRight")).toBe(4);
  });
});

describe("shell keyboard ownership", () => {
  it("cancels a selected flower without also pausing the shell", () => {
    const shellEscape = vi.fn();
    window.addEventListener("keydown", shellEscape);
    try {
      render(<UntangleGarden {...props()} />);
      const flower = document.querySelector('[data-garden-node="0"]')!;
      fireEvent.click(flower);
      expect(flower.getAttribute("aria-pressed")).toBe("true");
      fireEvent.keyDown(flower, { key: "Escape" });
      expect(flower.getAttribute("aria-pressed")).toBe("false");
      expect(shellEscape).not.toHaveBeenCalled();
      fireEvent.keyDown(flower, { key: "Escape" });
      expect(shellEscape).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("keydown", shellEscape);
    }
  });
});

describe("Independent playability review regressions", () => {
  it("never exposes a winning first-edge prefix and remaps every certificate", () => {
    for (const level of minimumNetworkLevels) {
      expect(verifyMinimumNetworkCertificate(level)).toBe(true);
      expect(
        isMinimumNetworkSolved(level, {
          selected: Array.from(
            { length: level.stations.length - 1 },
            (_, i) => i,
          ),
        }),
      ).toBe(false);
      const labels = networkLabelPositions(level);
      for (let i = 0; i < labels.length; i++)
        for (let j = 0; j < i; j++)
          expect(
            Math.hypot(labels[i].x - labels[j].x, labels[i].y - labels[j].y),
          ).toBeGreaterThan(5);
    }
  });
  it("keeps a two-step hint visible after selecting its flower and exposes adjacency", () => {
    const initial = props();
    const view = render(<UntangleGarden {...initial} />);
    view.rerender(<UntangleGarden {...initial} hintToken={1} />);
    const hint = untangleHint(
      untangleLevels[0],
      createUntangleState(untangleLevels[0]),
    );
    expect(hint.kind).toBe("move");
    if (hint.kind !== "move") return;
    fireEvent.click(flower(hint.node));
    expect(spot(hint.spot).getAttribute("data-hint-destination")).toBe("true");
    expect(screen.getByText(/先点花朵.*再点/)).toBeTruthy();
    expect(flower(hint.node).getAttribute("aria-label")).toContain("连接");
    fireEvent.click(spot(hint.spot));
    expect(document.querySelector('[data-hint-destination="true"]')).toBeNull();
  });
});
