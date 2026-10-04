// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GameProps } from "../src/lib/types";
import OneStrokeGarden from "../src/games/OneStrokeGarden";
import MapColors from "../src/games/MapColors";
import {
  chooseStrokeNode,
  createOneStrokeState,
  isOneStrokeSolved,
  oneStrokeHint,
  oneStrokeLevels,
  oneStrokeSolutions,
  solveOneStroke,
  strokeDegrees,
  strokeEdgeKey,
  strokeKeyboardNode,
  undoOneStroke,
  usedStrokeEdges,
  validStrokePath,
  verifyOneStrokeLevel,
  verifyStrokeGraph,
  type OneStrokeLevel,
  type StrokeNode,
} from "../src/games/oneStrokeLogic";
import {
  createMapColorsState,
  isMapColorsSolved,
  mapAdjacency,
  mapColorConflicts,
  mapColorPalette,
  mapColorsHint,
  mapColorsLevels,
  mapColorsSolutions,
  paintMapNode,
  solveMapColors,
  undoMapColors,
  verifyMapColorsLevel,
  verifyMapGraph,
  type MapColorsLevel,
} from "../src/games/mapColorsLogic";

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
function node(index: number): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(`[data-node="${index}"]`)!;
}
function color(index: number | "erase"): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(`[data-color="${index}"]`)!;
}
function strokeLevel(edges: [number, number][], count: number): OneStrokeLevel {
  return {
    title: "test",
    nodes: Array.from({ length: count }, (_, i) => ({
      x: 10 + i * 10,
      y: 50,
      label: String(i),
    })),
    edges,
    solution: [],
    idea: "",
  };
}
function signedArea(a: StrokeNode, b: StrokeNode, c: StrokeNode) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function pointOnSegment(a: StrokeNode, b: StrokeNode, c: StrokeNode) {
  return (
    signedArea(a, b, c) === 0 &&
    c.x >= Math.min(a.x, b.x) &&
    c.x <= Math.max(a.x, b.x) &&
    c.y >= Math.min(a.y, b.y) &&
    c.y <= Math.max(a.y, b.y)
  );
}

describe("one-stroke graph certificates", () => {
  it("has twelve original, increasing, connected planar levels with valid Euler certificates", () => {
    expect(oneStrokeLevels).toHaveLength(12);
    expect(new Set(oneStrokeLevels.map((l) => l.title)).size).toBe(12);
    expect(oneStrokeLevels.at(-1)!.edges).toHaveLength(14);
    for (const [index, level] of oneStrokeLevels.entries()) {
      expect(verifyOneStrokeLevel(level), level.title).toBe(true);
      expect(oneStrokeSolutions[index]).toEqual(level.solution);
      expect(validStrokePath(level, level.solution)).toBe(true);
      expect(solveOneStroke(level)).not.toBeNull();
      expect(strokeDegrees(level).filter((d) => d % 2).length).toBeOneOf([
        0, 2,
      ]);
      if (index)
        expect(level.edges.length).toBeGreaterThanOrEqual(
          oneStrokeLevels[index - 1].edges.length,
        );
      // No crossings and no invisible vertices in the middle of a drawn edge.
      for (const [i, [a, b]] of level.edges.entries()) {
        for (let n = 0; n < level.nodes.length; n++)
          if (n !== a && n !== b)
            expect(
              pointOnSegment(level.nodes[a], level.nodes[b], level.nodes[n]),
              `${level.title} node ${n} on ${a}-${b}`,
            ).toBe(false);
        for (const [c, d] of level.edges.slice(i + 1)) {
          if ([a, b].includes(c) || [a, b].includes(d)) continue;
          const ab1 = signedArea(
              level.nodes[a],
              level.nodes[b],
              level.nodes[c],
            ),
            ab2 = signedArea(level.nodes[a], level.nodes[b], level.nodes[d]),
            cd1 = signedArea(level.nodes[c], level.nodes[d], level.nodes[a]),
            cd2 = signedArea(level.nodes[c], level.nodes[d], level.nodes[b]);
          expect(
            ab1 * ab2 < 0 && cd1 * cd2 < 0,
            `${level.title} crossing edges`,
          ).toBe(false);
        }
      }
    }
  });
  it("accepts each reversed certificate, and hints preserve every valid certificate prefix", () => {
    for (const level of oneStrokeLevels)
      for (const route of [level.solution, [...level.solution].reverse()]) {
        let state = createOneStrokeState();
        for (const next of route) {
          state = chooseStrokeNode(level, state, next).state;
          const continuation = solveOneStroke(level, state.path)!;
          expect(continuation).not.toBeNull();
          expect(
            isOneStrokeSolved(level, {
              path: [...state.path.slice(0, -1), ...continuation],
            }),
          ).toBe(true);
          expect(oneStrokeHint(level, state).undoSteps).toBe(0);
        }
        expect(isOneStrokeSolved(level, state)).toBe(true);
        expect(usedStrokeEdges(state).size).toBe(level.edges.length);
      }
  });
  it("diagnoses every possible first edge on every level, including bad starting points", () => {
    for (const level of oneStrokeLevels)
      for (let start = 0; start < level.nodes.length; start++) {
        const initial = chooseStrokeNode(
          level,
          createOneStrokeState(),
          start,
        ).state;
        for (const [a, b] of level.edges) {
          if (a !== start && b !== start) continue;
          const state = chooseStrokeNode(
            level,
            initial,
            a === start ? b : a,
          ).state;
          const hint = oneStrokeHint(level, state);
          const remaining = solveOneStroke(level, state.path);
          expect(hint.kind).toBe(remaining ? "move" : "undo");
          if (remaining) {
            expect(remaining[1]).toBe(hint.node);
            expect(
              isOneStrokeSolved(level, {
                path: [...state.path.slice(0, -1), ...remaining],
              }),
            ).toBe(true);
          } else {
            const repaired = state.path.slice(
              0,
              state.path.length - hint.undoSteps,
            );
            expect(solveOneStroke(level, repaired)).not.toBeNull();
            for (let smaller = 0; smaller < hint.undoSteps; smaller++)
              expect(
                solveOneStroke(
                  level,
                  state.path.slice(0, state.path.length - smaller),
                ),
              ).toBeNull();
          }
        }
      }
  });
  it("rejects disconnected, duplicate, self-loop, isolated, malformed and four-odd graphs", () => {
    expect(
      solveOneStroke(
        strokeLevel(
          [
            [0, 1],
            [2, 3],
          ],
          4,
        ),
      ),
    ).toBeNull();
    expect(
      solveOneStroke(
        strokeLevel(
          [
            [0, 1],
            [0, 2],
            [0, 3],
          ],
          4,
        ),
      ),
    ).toBeNull();
    expect(
      verifyStrokeGraph(
        strokeLevel(
          [
            [0, 1],
            [1, 0],
          ],
          2,
        ),
      ),
    ).toBe(false);
    expect(
      verifyStrokeGraph(
        strokeLevel(
          [
            [0, 0],
            [0, 1],
          ],
          2,
        ),
      ),
    ).toBe(false);
    expect(verifyStrokeGraph(strokeLevel([[0, 1]], 3))).toBe(false);
    expect(verifyStrokeGraph(strokeLevel([[0, 9]], 2))).toBe(false);
    expect(verifyStrokeGraph(strokeLevel([[0, 1.5]], 2))).toBe(false);
    expect(
      solveOneStroke({
        ...oneStrokeLevels[0],
        nodes: Array.from({ length: 33 }, (_, i) => ({
          x: i,
          y: 0,
          label: `${i}`,
        })),
      }),
    ).toBeNull();
    expect(solveOneStroke(oneStrokeLevels[0], [0, 2])).toBeNull();
    expect(solveOneStroke(oneStrokeLevels[0], [0, 1, 0])).toBeNull();
  });
  it("rejects edge reuse and jumping, but allows returning to the same vertex via a new edge", () => {
    const level = oneStrokeLevels[3];
    const start = createOneStrokeState();
    expect(chooseStrokeNode(level, start, -1)).toEqual({
      state: start,
      outcome: "invalid-node",
    });
    expect(chooseStrokeNode(level, start, 0.5).state).toBe(start);
    const a = chooseStrokeNode(level, start, 0).state,
      b = chooseStrokeNode(level, a, 1).state;
    expect(chooseStrokeNode(level, b, 0)).toEqual({
      state: b,
      outcome: "used-edge",
    });
    expect(chooseStrokeNode(level, b, 3)).toEqual({
      state: b,
      outcome: "no-edge",
    });
    const c = chooseStrokeNode(level, b, 2).state,
      back = chooseStrokeNode(level, c, 0).state;
    expect(back.path).toEqual([0, 1, 2, 0]);
    expect(isOneStrokeSolved(level, back)).toBe(false);
    expect(undoOneStroke(back)).toEqual(c);
    expect(undoOneStroke(a)).toEqual(start);
    expect(undoOneStroke(start)).toBe(start);
    expect(a.path).toEqual([0]);
  });
  it("detects incorrect starts and disconnected remaining paths, and gives the shortest useful undo", () => {
    const line = oneStrokeLevels[0];
    expect(oneStrokeHint(line, { path: [1] })).toEqual({
      kind: "undo",
      undoSteps: 1,
      node: 0,
    });
    const tail = oneStrokeLevels[2],
      bad = { path: [1, 4] };
    expect(solveOneStroke(tail, bad.path)).toBeNull();
    const hint = oneStrokeHint(tail, bad);
    expect(hint.kind).toBe("undo");
    expect(hint.undoSteps).toBe(1);
    expect(solveOneStroke(tail, undoOneStroke(bad).path)).not.toBeNull();
    const further = { path: [0, 1, 4] };
    expect(oneStrokeHint(tail, further).undoSteps).toBe(3);
  });
  it("moves keyboard focus spatially without changing the route", () => {
    const nodes = oneStrokeLevels[2].nodes;
    expect(strokeKeyboardNode(nodes, 0, "ArrowRight")).toBe(1);
    expect(strokeKeyboardNode(nodes, 0, "ArrowDown")).toBe(3);
    expect(strokeKeyboardNode(nodes, 0, "ArrowLeft")).toBe(0);
    expect(strokeKeyboardNode(nodes, 4, "Home")).toBe(0);
    expect(strokeKeyboardNode(nodes, 0, "End")).toBe(4);
    expect(strokeKeyboardNode(nodes, 0, "x")).toBe(0);
  });
});

describe("map coloring certificates and bounded search", () => {
  it("validates all twelve levels, symmetric adjacency and 2–4-color certificates", () => {
    expect(mapColorsLevels).toHaveLength(12);
    expect(new Set(mapColorsLevels.map((l) => l.title)).size).toBe(12);
    expect(new Set(mapColorsLevels.map((l) => l.colorCount))).toEqual(
      new Set([2, 3, 4]),
    );
    for (const [i, level] of mapColorsLevels.entries()) {
      expect(verifyMapColorsLevel(level), level.title).toBe(true);
      expect(mapColorsSolutions[i]).toEqual(level.solution);
      const adjacency = mapAdjacency(level);
      for (const [a, list] of adjacency.entries())
        for (const b of list) expect(adjacency[b]).toContain(a);
      expect(adjacency.flat().length).toBe(level.edges.length * 2);
      const solution = solveMapColors(level);
      expect(solution.status).toBe("solved");
      expect(isMapColorsSolved(level, solution.colors!)).toBe(true);
      expect(solution.visited).toBeLessThan(100);
    }
  });
  it("accepts arbitrary valid alternatives, including all color permutations, rather than a single answer", () => {
    for (const level of mapColorsLevels)
      for (let shift = 1; shift < level.colorCount; shift++) {
        const alternative = level.solution.map(
          (c) => (c + shift) % level.colorCount,
        );
        expect(alternative).not.toEqual(level.solution);
        expect(isMapColorsSolved(level, alternative)).toBe(true);
        expect(solveMapColors(level, alternative).colors).toEqual(alternative);
      }
    expect(isMapColorsSolved(mapColorsLevels[4], [0, 1, 2, 2, 1])).toBe(true);
    const star = mapColorsLevels[2];
    expect(isMapColorsSolved(star, [1, 0, 0, 0, 0])).toBe(true);
  });
  it("finds continuations for every certificate prefix without overriding chosen colors", () => {
    for (const level of mapColorsLevels) {
      let state = createMapColorsState(level);
      for (let i = level.nodes.length - 1; i >= 0; i--) {
        state = paintMapNode(
          level,
          state,
          i,
          (level.solution[i] + 1) % level.colorCount,
        );
        const solution = solveMapColors(level, state.colors);
        expect(solution.status).toBe("solved");
        state.colors.forEach((color, i) => {
          if (color >= 0) expect(solution.colors![i]).toBe(color);
        });
        const hint = mapColorsHint(level, state);
        expect(hint.kind).toBe(i === 0 ? "complete" : "paint");
        expect(hint.undoSteps).toBe(0);
      }
    }
  });
  it("detects both immediate conflicts and non-conflicting impossible partial assignments", () => {
    const level = mapColorsLevels[0];
    let state = paintMapNode(level, createMapColorsState(level), 0, 0);
    state = paintMapNode(level, state, 1, 0);
    expect(mapColorConflicts(level, state.colors)).toEqual([[0, 1]]);
    expect(solveMapColors(level, state.colors).status).toBe("impossible");
    expect(mapColorsHint(level, state).undoSteps).toBe(1);
    state = paintMapNode(level, undoMapColors(state), 3, 0);
    expect(mapColorConflicts(level, state.colors)).toEqual([]);
    expect(solveMapColors(level, state.colors).status).toBe("impossible");
    const hint = mapColorsHint(level, state);
    expect(hint.kind).toBe("undo");
    expect(hint.undoSteps).toBe(1);
    expect(solveMapColors(level, undoMapColors(state).colors).status).toBe(
      "solved",
    );
  });
  it("has genuine recolor/erase history and rejects invalid indexes/colors and redundant moves", () => {
    const level = mapColorsLevels[0],
      initial = createMapColorsState(level);
    for (const [index, color] of [
      [-1, 0],
      [4, 0],
      [0, 2],
      [0, -2],
      [0, 0.5],
      [0.5, 0],
    ])
      expect(paintMapNode(level, initial, index, color)).toBe(initial);
    const painted = paintMapNode(level, initial, 0, 0),
      changed = paintMapNode(level, painted, 0, 1),
      erased = paintMapNode(level, changed, 0, -1);
    expect(paintMapNode(level, painted, 0, 0)).toBe(painted);
    expect(undoMapColors(erased)).toEqual(changed);
    expect(undoMapColors(changed)).toEqual(painted);
    expect(undoMapColors(painted)).toEqual(initial);
    expect(undoMapColors(initial)).toBe(initial);
    expect(initial.colors).toEqual([-1, -1, -1, -1]);
    expect(painted.colors).toEqual([0, -1, -1, -1]);
  });
  it("bounds the solver and rejects malformed levels, incomplete answers and invalid assignments", () => {
    const level = mapColorsLevels[0];
    expect(solveMapColors(level, undefined, 0)).toEqual({
      status: "limit",
      colors: null,
      visited: 0,
    });
    expect(solveMapColors(level, undefined, 1)).toEqual({
      status: "limit",
      colors: null,
      visited: 1,
    });
    expect(solveMapColors(level, [0, 1, 0, 2]).status).toBe("impossible");
    expect(solveMapColors(level, [0, 1]).status).toBe("impossible");
    expect(isMapColorsSolved(level, [0, 1, 0, -1])).toBe(false);
    expect(isMapColorsSolved(level, [0, 1, 1, 0])).toBe(false);
    expect(isMapColorsSolved(level, [0, 1, 0, 1.5])).toBe(false);
    for (const bad of [
      { ...level, colorCount: 5 },
      { ...level, edges: [[0, 0]] },
      {
        ...level,
        edges: [
          [0, 1],
          [1, 0],
        ],
      },
      { ...level, edges: [[0, 10]] },
      {
        ...level,
        edges: [
          [0, 1],
          [2, 3],
        ],
      },
    ] as MapColorsLevel[])
      expect(verifyMapGraph(bad)).toBe(false);
  });
});

describe("one-stroke accessible interactions", () => {
  it.each(oneStrokeLevels.map((level, index) => [index, level.title] as const))(
    "completes authored level %i: %s exactly once",
    (level) => {
      const p = props({ level });
      const view = render(
        <StrictMode>
          <OneStrokeGarden {...p} />
        </StrictMode>,
      );
      for (const index of oneStrokeLevels[level].solution)
        fireEvent.click(node(index));
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(document.querySelectorAll('[data-used="true"]').length).toBe(
        oneStrokeLevels[level].edges.length,
      );
      expect(node(0).disabled).toBe(true);
      fireEvent.click(node(0));
      view.rerender(
        <StrictMode>
          <OneStrokeGarden
            {...p}
            hintToken={1}
            undoToken={1}
            onStatus={vi.fn()}
          />
        </StrictMode>,
      );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    },
  );
  it("supports native keyboard activation, spatial navigation, undo and current-state hints", async () => {
    const user = userEvent.setup(),
      p = props();
    const view = render(<OneStrokeGarden {...p} />);
    node(1).focus();
    await user.keyboard("{Enter}");
    expect(node(1).getAttribute("data-current")).toBe("true");
    view.rerender(<OneStrokeGarden {...p} hintToken={1} />);
    expect(p.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("撤销 1 次"),
    );
    view.rerender(<OneStrokeGarden {...p} hintToken={1} undoToken={1} />);
    expect(screen.getByLabelText("已走路线").textContent).toContain(
      "选择任意路口",
    );
    node(0).focus();
    await user.keyboard(" ");
    expect(node(0).getAttribute("data-current")).toBe("true");
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(node(2));
    expect(node(0).getAttribute("data-current")).toBe("true");
    fireEvent.click(node(2));
    expect(p.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("没有直接"),
    );
    fireEvent.click(node(1));
    fireEvent.click(node(0));
    expect(p.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("已经走过"),
    );
    view.rerender(<OneStrokeGarden {...p} hintToken={2} undoToken={1} />);
    expect(p.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("走到 C"),
    );
  });
  it("freezes paused input and token commands, resets history, and can replay after completion", () => {
    const p = props();
    const view = render(<OneStrokeGarden {...p} />);
    fireEvent.click(node(0));
    fireEvent.click(node(1));
    view.rerender(
      <OneStrokeGarden {...p} paused hintToken={1} undoToken={1} />,
    );
    const calls = vi.mocked(p.onStatus).mock.calls.length;
    fireEvent.click(node(2));
    expect(node(1).getAttribute("data-current")).toBe("true");
    expect(p.onStatus).toHaveBeenCalledTimes(calls);
    view.rerender(<OneStrokeGarden {...p} hintToken={1} undoToken={1} />);
    expect(node(1).getAttribute("data-current")).toBe("true");
    fireEvent.click(node(2));
    fireEvent.click(node(3));
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <OneStrokeGarden {...p} resetToken={1} hintToken={1} undoToken={1} />,
    );
    expect(screen.getByLabelText("已走路线").textContent).toContain(
      "选择任意路口",
    );
    for (const index of oneStrokeLevels[0].solution)
      fireEvent.click(node(index));
    expect(p.onComplete).toHaveBeenCalledTimes(2);
    view.rerender(
      <OneStrokeGarden
        {...p}
        level={1}
        resetToken={1}
        hintToken={1}
        undoToken={1}
      />,
    );
    expect(document.querySelectorAll('[data-used="true"]').length).toBe(0);
    expect(screen.getByLabelText("已走路线").textContent).toContain(
      "选择任意路口",
    );
  });
});

describe("map colors accessible interactions", () => {
  it.each(mapColorsLevels.map((level, index) => [index, level.title] as const))(
    "completes level %i with a different valid solution: %s",
    (level) => {
      const p = props({ level }),
        config = mapColorsLevels[level];
      const view = render(
        <StrictMode>
          <MapColors {...p} />
        </StrictMode>,
      );
      config.solution.forEach((value, index) => {
        fireEvent.click(color((value + 1) % config.colorCount));
        fireEvent.click(node(index));
      });
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText("配色检查").textContent).toContain(
        "所有邻居都不一样",
      );
      expect(node(0).disabled).toBe(true);
      view.rerender(
        <StrictMode>
          <MapColors {...p} hintToken={1} undoToken={1} onStatus={vi.fn()} />
        </StrictMode>,
      );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    },
  );
  it("shows color symbols and neighbor labels, permits repainting, and faithfully undoes erase and replacement", async () => {
    const user = userEvent.setup(),
      p = props();
    const view = render(<MapColors {...p} />);
    expect(node(0).getAttribute("aria-label")).toContain("邻居 B");
    for (const entry of mapColorPalette.slice(0, 2))
      expect(
        screen.getByRole("button", {
          name: new RegExp(`号画笔，${entry.name} ${entry.symbol}`),
        }),
      ).toBeTruthy();
    node(0).focus();
    await user.keyboard("{Enter}");
    expect(node(0).getAttribute("data-painted")).toBe("0");
    await user.keyboard("2 ");
    expect(node(0).getAttribute("data-painted")).toBe("1");
    await user.keyboard("{Delete}");
    expect(node(0).getAttribute("data-painted")).toBe("-1");
    view.rerender(<MapColors {...p} undoToken={1} />);
    expect(node(0).getAttribute("data-painted")).toBe("1");
    view.rerender(<MapColors {...p} undoToken={2} />);
    expect(node(0).getAttribute("data-painted")).toBe("0");
    view.rerender(<MapColors {...p} undoToken={3} />);
    expect(node(0).getAttribute("data-painted")).toBe("-1");
    fireEvent.click(color(0));
    fireEvent.click(node(0));
    fireEvent.click(color("erase"));
    fireEvent.click(node(0));
    expect(node(0).getAttribute("data-painted")).toBe("-1");
  });
  it("marks conflicts without relying on color, and hints diagnose current dead ends without changing paint", () => {
    const p = props();
    const view = render(<MapColors {...p} />);
    fireEvent.click(node(0));
    fireEvent.click(node(1));
    expect(node(0).getAttribute("data-conflict")).toBe("true");
    expect(screen.getByLabelText("配色检查").textContent).toContain("A–B");
    expect(p.onComplete).not.toHaveBeenCalled();
    view.rerender(<MapColors {...p} hintToken={1} />);
    expect(p.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("撤销 1 次"),
    );
    expect(node(1).getAttribute("data-painted")).toBe("0");
    view.rerender(<MapColors {...p} hintToken={1} undoToken={1} />);
    fireEvent.click(node(3));
    expect(screen.getByLabelText("配色检查").textContent).toContain(
      "没有同色邻居",
    );
    view.rerender(<MapColors {...p} hintToken={2} undoToken={1} />);
    expect(p.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("剩余花房已经无法全部配好"),
    );
    view.rerender(<MapColors {...p} hintToken={2} undoToken={2} />);
    view.rerender(<MapColors {...p} hintToken={3} undoToken={2} />);
    expect(p.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("暖黄 ▲"),
    );
    expect(node(1).className).toContain("gp-hinted");
    expect(node(1).getAttribute("data-painted")).toBe("-1");
  });
  it("freezes paint, palette and keyboard while paused; reset/level changes clear colors and old command tokens", () => {
    const p = props();
    const view = render(<MapColors {...p} />);
    fireEvent.click(node(0));
    view.rerender(<MapColors {...p} paused hintToken={1} undoToken={1} />);
    const calls = vi.mocked(p.onStatus).mock.calls.length;
    fireEvent.click(color(1));
    fireEvent.click(node(1));
    fireEvent.keyDown(node(0), { key: "Delete" });
    fireEvent.keyDown(node(0), { key: "2" });
    expect(node(0).getAttribute("data-painted")).toBe("0");
    expect(node(1).getAttribute("data-painted")).toBe("-1");
    expect(color(0).getAttribute("aria-pressed")).toBe("true");
    expect(p.onStatus).toHaveBeenCalledTimes(calls);
    view.rerender(<MapColors {...p} hintToken={1} undoToken={1} />);
    expect(node(0).getAttribute("data-painted")).toBe("0");
    view.rerender(
      <MapColors {...p} resetToken={1} hintToken={1} undoToken={1} />,
    );
    expect(node(0).getAttribute("data-painted")).toBe("-1");
    for (const [index, value] of mapColorsLevels[0].solution.entries()) {
      fireEvent.click(color(value));
      fireEvent.click(node(index));
    }
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <MapColors {...p} resetToken={2} hintToken={1} undoToken={1} />,
    );
    for (const [index, value] of mapColorsLevels[0].solution.entries()) {
      fireEvent.click(color(value));
      fireEvent.click(node(index));
    }
    expect(p.onComplete).toHaveBeenCalledTimes(2);
    view.rerender(
      <MapColors {...p} level={1} resetToken={2} hintToken={1} undoToken={1} />,
    );
    expect(node(0).getAttribute("data-painted")).toBe("-1");
  });
});
