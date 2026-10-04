// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GameProps } from "../src/lib/types";
import TownTour from "../src/games/TownTour";
import PostmanRoutes from "../src/games/PostmanRoutes";
import {
  townTourLevels,
  postmanRoutesLevels,
} from "../src/games/routeOptimizationLevels";
import {
  ROUTE_MAX_STEPS,
  analyzeRoute,
  createRouteState,
  isRouteSolved,
  postmanParityMinimum,
  routeCompletion,
  routeHint,
  routeKeyboardRoad,
  routeMinimumCost,
  routeRoadIndex,
  undoRoute,
  verifyRouteCertificate,
  verifyRouteGraph,
  walkRouteRoad,
  type RouteLevel,
  type RouteMode,
  type RouteState,
} from "../src/games/routeOptimizationLogic";

afterEach(cleanup);
const allLevels = [...townTourLevels, ...postmanRoutesLevels];
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
function roadButton(index: number) {
  return document.querySelector<HTMLButtonElement>(
    `[data-route-road="${index}"]`,
  )!;
}
function pathText() {
  return document.querySelector("[data-route-path]")!.textContent!;
}
function roadCost(level: RouteLevel, a: number, b: number) {
  return (
    level.roads.find(
      (e) => (e.a === a && e.b === b) || (e.b === a && e.a === b),
    )?.cost ?? Infinity
  );
}
/** Independent TSP oracle: exhaustive permutation enumeration, no production DP or route analyzer. */
function independentTours(level: RouteLevel) {
  const results: { cost: number; path: number[] }[] = [];
  function visit(path: number[], remaining: number[], cost: number) {
    if (!remaining.length) {
      const final = cost + roadCost(level, path.at(-1)!, level.depot);
      if (Number.isFinite(final))
        results.push({ cost: final, path: [...path, level.depot] });
      return;
    }
    for (const town of remaining) {
      const next = cost + roadCost(level, path.at(-1)!, town);
      if (Number.isFinite(next))
        visit(
          [...path, town],
          remaining.filter((t) => t !== town),
          next,
        );
    }
  }
  visit(
    [level.depot],
    level.towns.map((_, i) => i).filter((i) => i !== level.depot),
    0,
  );
  return results.sort((a, b) => a.cost - b.cost);
}
/** Independent postman oracle: repeated edge relaxation for all-pairs distances, then enumerate all odd-vertex pairings. */
function independentPostman(level: RouteLevel) {
  const degree = level.towns.map(() => 0);
  let base = 0;
  for (const e of level.roads) {
    degree[e.a]++;
    degree[e.b]++;
    base += e.cost;
  }
  const shortest = level.towns.map((_, source) => {
    const distance = level.towns.map((_, i) => (i === source ? 0 : Infinity));
    for (let pass = 0; pass < level.towns.length - 1; pass++)
      for (const e of level.roads) {
        distance[e.a] = Math.min(distance[e.a], distance[e.b] + e.cost);
        distance[e.b] = Math.min(distance[e.b], distance[e.a] + e.cost);
      }
    return distance;
  });
  function pair(vertices: number[]): number {
    if (!vertices.length) return 0;
    let minimum = Infinity;
    for (let j = 1; j < vertices.length; j++)
      minimum = Math.min(
        minimum,
        shortest[vertices[0]][vertices[j]] +
          pair(vertices.filter((_, i) => i !== 0 && i !== j)),
      );
    return minimum;
  }
  return base + pair(degree.flatMap((d, i) => (d % 2 ? [i] : [])));
}
/** Independent certificate inspection reconstructs every edge and checks the task without production helpers. */
function independentlyCheckWalk(level: RouteLevel, path: readonly number[]) {
  expect(path[0]).toBe(level.depot);
  expect(path.at(-1)).toBe(level.depot);
  const covered = new Set<number>();
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const index = level.roads.findIndex(
      (e) => [e.a, e.b].includes(path[i - 1]) && [e.a, e.b].includes(path[i]),
    );
    expect(index).toBeGreaterThanOrEqual(0);
    expect(path[i - 1]).not.toBe(path[i]);
    covered.add(index);
    cost += level.roads[index].cost;
  }
  if (level.mode === "town-tour") {
    expect(path).toHaveLength(level.towns.length + 1);
    expect(new Set(path.slice(0, -1)).size).toBe(level.towns.length);
  } else expect(covered.size).toBe(level.roads.length);
  return cost;
}
function smallGraph(
  mode: RouteMode,
  edges: [number, number, number][],
  n = 4,
): RouteLevel {
  return {
    id: "test",
    title: "test",
    mode,
    depot: 0,
    towns: Array.from({ length: n }, (_, i) => ({
      label: String(i),
      x: 50 + i * 80,
      y: 100,
    })),
    roads: edges.map(([a, b, cost]) => ({ a, b, cost })),
    difficulty: "起步",
    idea: "",
    decision: "",
    certificate: { schema: "playgarden.route.v1", walk: [], minimumCost: 0 },
  };
}
/** Separate forward state search, using a sorted frontier instead of the reverse Dijkstra table. */
function independentRemaining(level: RouteLevel, initialPath: number[]) {
  let initialMask = 0;
  for (let i = 1; i < initialPath.length; i++)
    initialMask |=
      1 <<
      level.roads.findIndex(
        (e) =>
          (e.a === initialPath[i - 1] && e.b === initialPath[i]) ||
          (e.b === initialPath[i - 1] && e.a === initialPath[i]),
      );
  const n = level.towns.length,
    goal = (1 << level.roads.length) - 1;
  const pending = [{ town: initialPath.at(-1)!, mask: initialMask, cost: 0 }],
    visited = new Set<number>();
  while (pending.length) {
    pending.sort((a, b) => b.cost - a.cost);
    const next = pending.pop()!,
      key = next.mask * n + next.town;
    if (visited.has(key)) continue;
    visited.add(key);
    if (next.mask === goal && next.town === level.depot) return next.cost;
    level.roads.forEach((e, i) => {
      const to = e.a === next.town ? e.b : e.b === next.town ? e.a : -1;
      if (to >= 0 && !visited.has((next.mask | (1 << i)) * n + to))
        pending.push({
          town: to,
          mask: next.mask | (1 << i),
          cost: next.cost + e.cost,
        });
    });
  }
  return Infinity;
}

describe("route optimization: authored progression and independent certificates", () => {
  it("has 12 distinct levels per game with bounded, readable maps and literal certificates", () => {
    expect(townTourLevels).toHaveLength(12);
    expect(postmanRoutesLevels).toHaveLength(12);
    expect(new Set(allLevels.map((l) => l.id)).size).toBe(24);
    for (const l of allLevels) {
      expect(verifyRouteGraph(l), l.id).toBe(true);
      expect(l.idea.length).toBeGreaterThan(10);
      expect(l.decision.length).toBeGreaterThan(10);
      for (const [i, a] of l.towns.entries())
        for (const b of l.towns.slice(i + 1))
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(65);
      expect(l.roads.length).toBeLessThanOrEqual(13);
      expect(l.towns.length).toBeLessThanOrEqual(8);
      expect(l.certificate.schema).toBe("playgarden.route.v1");
    }
  });
  it("keeps numerical teaching claims consistent with each graph's actual odd junctions", () => {
    for (const level of postmanRoutesLevels) {
      const degree = level.towns.map(() => 0);
      for (const road of level.roads) {
        degree[road.a]++;
        degree[road.b]++;
      }
      const odd = degree.filter((d) => d % 2).length;
      const text = `${level.title} ${level.idea} ${level.decision}`;
      if (text.includes("四个奇数路口")) expect(odd, level.id).toBe(4);
      if (text.includes("六个奇数路口")) expect(odd, level.id).toBe(6);
    }
  });
  it.each(allLevels.map((l) => [l.id, l] as const))(
    "independently proves %s optimal and replays its literal certificate",
    (_, level) => {
      const optimum =
        level.mode === "town-tour"
          ? independentTours(level)[0].cost
          : independentPostman(level);
      expect(independentlyCheckWalk(level, level.certificate.walk)).toBe(
        optimum,
      );
      expect(level.certificate.minimumCost).toBe(optimum);
      expect(routeMinimumCost(level)).toBe(optimum);
      expect(routeCompletion(level, [level.depot])?.cost).toBe(optimum);
      expect(verifyRouteCertificate(level)).toBe(true);
      let state = createRouteState(level);
      for (const town of level.certificate.walk.slice(1)) {
        const hint = routeHint(level, state);
        expect(hint.kind).toBe("move");
        const road = routeRoadIndex(level, state.path.at(-1)!, town),
          next = walkRouteRoad(level, state, road);
        expect(next.outcome).toBe("moved");
        state = next.state;
      }
      expect(isRouteSolved(level, state)).toBe(true);
      expect(routeHint(level, state).kind).toBe("complete");
      expect(
        isRouteSolved(level, { path: [...level.certificate.walk].reverse() }),
      ).toBe(true);
      expect(
        verifyRouteCertificate({
          ...level,
          certificate: { ...level.certificate, minimumCost: optimum + 1 },
        }),
      ).toBe(false);
      expect(
        verifyRouteCertificate({
          ...level,
          certificate: {
            ...level.certificate,
            walk: level.certificate.walk.slice(0, -1),
          },
        }),
      ).toBe(false);
    },
  );
  it("contains genuine cost choices in every tour and necessary repeated roads in every postman level", () => {
    for (const l of townTourLevels)
      expect(
        new Set(independentTours(l).map((t) => t.cost)).size,
        l.id,
      ).toBeGreaterThanOrEqual(2);
    const ties = independentTours(townTourLevels[4]).filter(
      (t) => t.cost === townTourLevels[4].certificate.minimumCost,
    );
    expect(ties.length).toBeGreaterThanOrEqual(4);
    for (const route of ties)
      expect(isRouteSolved(townTourLevels[4], { path: route.path })).toBe(true);
    for (const l of postmanRoutesLevels) {
      expect(l.certificate.minimumCost).toBeGreaterThan(
        l.roads.reduce((s, e) => s + e.cost, 0),
      );
      expect(
        analyzeRoute(l, l.certificate.walk).counts.some((n) => n > 1),
      ).toBe(true);
    }
  });
  it("does not present road buttons in certificate order or make first available moves universally optimal", () => {
    let misleadingFirstTours = 0;
    for (const l of allLevels) {
      const certificateEdges = l.certificate.walk
        .slice(1)
        .map((to, i) => routeRoadIndex(l, l.certificate.walk[i], to));
      expect(
        certificateEdges.every((road, i) => road === i),
        l.id,
      ).toBe(false);
      if (l.mode === "town-tour") {
        const first = l.roads.findIndex(
          (e) => e.a === l.depot || e.b === l.depot,
        );
        if (
          routeHint(l, walkRouteRoad(l, createRouteState(l), first).state)
            .kind === "undo"
        )
          misleadingFirstTours++;
      }
    }
    expect(misleadingFirstTours).toBeGreaterThanOrEqual(4);
  });
});

describe("exact route solvers, actual-prefix hints and invalid states", () => {
  it("agrees with independent permutation enumeration across 40 different complete weighted graphs", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const roads: [number, number, number][] = [];
      for (let a = 0; a < 4; a++)
        for (let b = a + 1; b < 4; b++)
          roads.push([a, b, 1 + ((seed * (a + 2) + b * b + a * b) % 9)]);
      const l = smallGraph("town-tour", roads),
        routes = independentTours(l);
      expect(routeMinimumCost(l)).toBe(routes[0].cost);
      for (const route of routes)
        expect(isRouteSolved(l, { path: route.path })).toBe(
          route.cost === routes[0].cost,
        );
    }
  });
  it("agrees with independent forward shortest walks for every connected 4-town simple graph and every one-step prefix", () => {
    const possible: [number, number, number][] = [
      [0, 1, 2],
      [0, 2, 5],
      [0, 3, 3],
      [1, 2, 1],
      [1, 3, 4],
      [2, 3, 2],
    ];
    for (let mask = 1; mask < 64; mask++) {
      const l = smallGraph(
        "postman-routes",
        possible.filter((_, i) => mask & (1 << i)),
      );
      if (!verifyRouteGraph(l)) continue;
      expect(routeCompletion(l, [0])?.cost).toBe(independentRemaining(l, [0]));
      expect(postmanParityMinimum(l)).toBe(independentRemaining(l, [0]));
      for (const e of l.roads.filter((e) => e.a === 0 || e.b === 0)) {
        const prefix = [0, e.a === 0 ? e.b : e.a];
        expect(routeCompletion(l, prefix)?.cost).toBe(
          independentRemaining(l, prefix),
        );
      }
    }
  });
  it.each(allLevels.map((l) => [l.id, l] as const))(
    "current-prefix hints finish %s without ever mutating the player's path",
    (_, l) => {
      let state = createRouteState(l);
      for (let step = 0; step < 40 && !isRouteSolved(l, state); step++) {
        const snapshot = [...state.path],
          hint = routeHint(l, state);
        expect(state.path).toEqual(snapshot);
        expect(hint.kind).toBe("move");
        if (hint.kind !== "move") throw new Error("Expected a valid move hint");
        state = walkRouteRoad(l, state, hint.road).state;
      }
      expect(isRouteSolved(l, state)).toBe(true);
    },
  );
  it("finds the minimum necessary undo for an expensive or impossible tour prefix", () => {
    const l = townTourLevels[0],
      expensive = independentTours(l).at(-1)!;
    const state = { path: expensive.path },
      hint = routeHint(l, state);
    expect(hint.kind).toBe("undo");
    if (hint.kind !== "undo") throw new Error("Expected undo");
    expect(hint.excess).toBe(expensive.cost - routeMinimumCost(l));
    for (let i = 0; i < hint.steps; i++) {
      const prefix = state.path.slice(0, state.path.length - i),
        remaining = routeCompletion(l, prefix);
      expect(
        remaining &&
          analyzeRoute(l, prefix).cost + remaining.cost === routeMinimumCost(l),
      ).toBeFalsy();
    }
    const prefix = state.path.slice(0, -hint.steps),
      remaining = routeCompletion(l, prefix)!;
    expect(analyzeRoute(l, prefix).cost + remaining.cost).toBe(
      routeMinimumCost(l),
    );
    const sparse = townTourLevels[5];
    let dead: RouteState | null = null;
    function explore(current: RouteState) {
      if (dead || current.path.length > sparse.towns.length) return;
      if (!routeCompletion(sparse, current.path)) {
        dead = current;
        return;
      }
      for (let e = 0; e < sparse.roads.length; e++) {
        const next = walkRouteRoad(sparse, current, e).state;
        if (next !== current) explore(next);
      }
    }
    explore(createRouteState(sparse));
    expect(dead).not.toBeNull();
    expect(routeHint(sparse, dead!)).toMatchObject({
      kind: "undo",
      excess: null,
    });
  });
  it("requires undo for wasteful postman repeats instead of presenting an over-budget finish as success", () => {
    const l = postmanRoutesLevels[0],
      state = { path: [0, 1, 0] };
    const hint = routeHint(l, state);
    expect(hint).toMatchObject({ kind: "undo", steps: 1 });
    expect(
      isRouteSolved(l, { path: [0, 1, 0, ...l.certificate.walk.slice(1)] }),
    ).toBe(false);
    expect(routeHint(l, undoRoute(state)).kind).toBe("move");
    const analysis = analyzeRoute(l, [0, 1, 3, 1]);
    expect(analysis.repeatedCost).toBe(2);
    expect(analysis.covered).toBe(2);
  });
  it("guards invalid inputs, early return, repeated towns, disconnected roads, and bounded history", () => {
    const t = townTourLevels[0],
      p = postmanRoutesLevels[0],
      start = createRouteState(t),
      ab = routeRoadIndex(t, 0, 1),
      after = walkRouteRoad(t, start, ab).state;
    expect(walkRouteRoad(t, after, ab).outcome).toBe("home-early");
    const mid = { path: [0, 1, 3] };
    expect(walkRouteRoad(t, mid, routeRoadIndex(t, 3, 1)).outcome).toBe(
      "revisited-town",
    );
    expect(walkRouteRoad(t, start, routeRoadIndex(t, 2, 3)).outcome).toBe(
      "not-adjacent",
    );
    for (const edge of [-1, 0.5, 100, NaN])
      expect(walkRouteRoad(t, start, edge).state).toBe(start);
    for (const path of [[], [1], [0, 100], [0, 0], [0, 1, 0], [0, 1.5]])
      expect(routeCompletion(t, path)).toBeNull();
    expect(undoRoute(start)).toBe(start);
    expect(undoRoute(after).path).toEqual([0]);
    const long = {
      path: Array.from({ length: ROUTE_MAX_STEPS + 1 }, (_, i) => i % 2),
    };
    expect(walkRouteRoad(p, long, routeRoadIndex(p, 0, 1)).outcome).toBe(
      "limit",
    );
    const invalidGraphs = [
      { ...p, roads: [...p.roads, p.roads[0]] },
      { ...p, roads: p.roads.map((e, i) => (i ? e : { ...e, cost: 0 })) },
      { ...p, roads: p.roads.map((e, i) => (i ? e : { ...e, cost: 1.5 })) },
      { ...p, roads: p.roads.map((e, i) => (i ? e : { ...e, a: 10 })) },
      { ...p, depot: -1 },
      { ...p, towns: [...p.towns, ...p.towns, ...p.towns] },
    ];
    for (const l of invalidGraphs) {
      expect(verifyRouteGraph(l)).toBe(false);
      expect(routeCompletion(l, [0])).toBeNull();
      expect(routeMinimumCost(l)).toBe(Infinity);
      expect(verifyRouteCertificate(l)).toBe(false);
    }
  });
});

for (const [name, Component, levels] of [
  ["TownTour", TownTour, townTourLevels],
  ["PostmanRoutes", PostmanRoutes, postmanRoutesLevels],
] as const) {
  describe(`${name}: rendered game contracts`, () => {
    it.each(levels.map((level, index) => [level.id, index, level] as const))(
      "replays every real road button for %s and verifies every intermediate total",
      (_, index, level) => {
        const p = props({ level: index });
        render(
          <StrictMode>
            <Component {...p} />
          </StrictMode>,
        );
        expect(
          document
            .querySelector("[data-route-solved]")
            ?.getAttribute("data-route-solved"),
        ).toBe("false");
        let spent = 0;
        for (let i = 1; i < level.certificate.walk.length; i++) {
          const from = level.certificate.walk[i - 1],
            to = level.certificate.walk[i],
            road = routeRoadIndex(level, from, to),
            button = roadButton(road);
          expect(button.disabled).toBe(false);
          expect(button.getAttribute("aria-label")).toContain(
            `路费 ${level.roads[road].cost}`,
          );
          fireEvent.click(button);
          spent += level.roads[road].cost;
          expect(document.querySelector("[data-route-cost]")?.textContent).toBe(
            String(spent),
          );
          expect(pathText()).toContain(
            level.certificate.walk
              .slice(0, i + 1)
              .map((t) => level.towns[t].label)
              .join(" → "),
          );
          const analysis = analyzeRoute(
            level,
            level.certificate.walk.slice(0, i + 1),
          );
          level.roads.forEach((_, e) =>
            expect(roadButton(e).getAttribute("data-route-walk-count")).toBe(
              String(analysis.counts[e]),
            ),
          );
        }
        expect(p.onComplete).toHaveBeenCalledTimes(1);
        expect(
          document
            .querySelector("[data-route-solved]")
            ?.getAttribute("data-route-solved"),
        ).toBe("true");
        expect(
          [
            ...document.querySelectorAll<HTMLButtonElement>(
              "[data-route-road]",
            ),
          ].every((b) => b.disabled),
        ).toBe(true);
        fireEvent.click(roadButton(0));
        expect(p.onComplete).toHaveBeenCalledTimes(1);
      },
    );
    it("renders worked instructions, non-color road facts, and distinct goal feedback", () => {
      render(<Component {...props()} />);
      expect(screen.getByText("第一次玩？看一个小例子")).toBeTruthy();
      expect(document.querySelector("details")?.open).toBe(true);
      for (const [index, road] of levels[0].roads.entries()) {
        expect(roadButton(index).textContent).toContain(
          `${levels[0].towns[road.a].label}–${levels[0].towns[road.b].label}`,
        );
        expect(roadButton(index).textContent).toContain("尚未走过");
        expect(roadButton(index).getAttribute("aria-label")).toContain(
          `路费 ${road.cost}，已走 0 次`,
        );
      }
      expect(
        document.querySelector(
          name === "TownTour" ? "[data-route-visited]" : "[data-route-covered]",
        ),
      ).toBeTruthy();
      expect(screen.getByRole("img").getAttribute("aria-label")).toContain(
        "当前位置 A",
      );
    });
    it("consumes paused undo/hint tokens, preserves state, resets cleanly, and switches levels", () => {
      let p = props();
      const view = render(<Component {...p} />),
        l = levels[0];
      const edge = routeRoadIndex(l, 0, l.certificate.walk[1]);
      fireEvent.click(roadButton(edge));
      const before = pathText(),
        cost = document.querySelector("[data-route-cost]")?.textContent;
      p = { ...p, paused: true, hintToken: 1, undoToken: 1 };
      view.rerender(<Component {...p} />);
      for (const b of document.querySelectorAll<HTMLButtonElement>(
        "[data-route-road]",
      )) {
        expect(b.disabled).toBe(true);
        fireEvent.click(b);
      }
      expect(pathText()).toBe(before);
      expect(document.querySelector("[data-route-hint]")).toBeNull();
      p = { ...p, paused: false };
      view.rerender(<Component {...p} />);
      expect(pathText()).toBe(before);
      expect(document.querySelector("[data-route-cost]")?.textContent).toBe(
        cost,
      );
      p = { ...p, undoToken: 2 };
      view.rerender(<Component {...p} />);
      expect(pathText()).toBe("脚步记录A");
      expect(document.querySelector("[data-route-cost]")?.textContent).toBe(
        "0",
      );
      p = { ...p, hintToken: 2 };
      view.rerender(<Component {...p} />);
      expect(
        document
          .querySelector("[data-route-hint]")
          ?.getAttribute("data-route-hint"),
      ).toBe("move");
      expect(pathText()).toBe("脚步记录A");
      p = { ...p, resetToken: 1 };
      view.rerender(<Component {...p} />);
      expect(document.querySelector("[data-route-hint]")).toBeNull();
      expect(pathText()).toBe("脚步记录A");
      p = { ...p, level: 1 };
      view.rerender(<Component {...p} />);
      expect(screen.getByText(levels[1].title)).toBeTruthy();
      expect(document.querySelector("[data-route-cost]")?.textContent).toBe(
        "0",
      );
      expect(p.onComplete).not.toHaveBeenCalled();
    });
    it("supports arrow/Home/End focus and native Enter/Space plus touch-generated click activation", async () => {
      const user = userEvent.setup(),
        p = props(),
        view = render(<Component {...p} />),
        l = levels[0];
      const available = l.roads.flatMap((e, i) =>
        e.a === 0 || e.b === 0 ? [i] : [],
      );
      roadButton(available[0]).focus();
      await user.keyboard("{End}");
      expect(document.activeElement).toBe(roadButton(available.at(-1)!));
      await user.keyboard("{Home}{ArrowRight}");
      expect(document.activeElement).toBe(roadButton(available[1]));
      await user.keyboard("{ArrowLeft}{Enter}");
      expect(pathText()).not.toBe("脚步记录A");
      view.rerender(<Component {...p} resetToken={1} />);
      roadButton(available[0]).focus();
      await user.keyboard(" ");
      expect(pathText()).not.toBe("脚步记录A");
      view.rerender(<Component {...p} resetToken={2} />);
      fireEvent.touchStart(roadButton(available[0]));
      fireEvent.touchEnd(roadButton(available[0]));
      fireEvent.click(roadButton(available[0]));
      expect(pathText()).not.toBe("脚步记录A");
    });
    it("keeps a usable road focus through a complete multi-step keyboard route", async () => {
      const user = userEvent.setup(),
        p = props(),
        l = levels[0];
      render(<Component {...p} />);
      const walk = l.certificate.walk;
      for (let step = 1; step < walk.length; step++) {
        const target = routeRoadIndex(l, walk[step - 1], walk[step]);
        if (step === 1) roadButton(target).focus();
        else {
          const focused = document.activeElement as HTMLButtonElement;
          expect(focused.matches("[data-route-road]")).toBe(true);
          expect(focused.disabled).toBe(false);
          await user.keyboard("{Home}");
          const enabled = [
            ...document.querySelectorAll<HTMLButtonElement>(
              "[data-route-road]:not(:disabled)",
            ),
          ];
          const position = enabled.indexOf(roadButton(target));
          expect(position).toBeGreaterThanOrEqual(0);
          for (let i = 0; i < position; i++)
            await user.keyboard("{ArrowRight}");
        }
        expect(document.activeElement).toBe(roadButton(target));
        await user.keyboard("{Enter}");
      }
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    });
    it("turns an over-budget completed route into actionable undo guidance and accepts an alternate optimum", () => {
      const l = levels[0];
      let p = props();
      const view = render(<Component {...p} />);
      const bad =
        name === "TownTour"
          ? independentTours(l).at(-1)!.path
          : [0, 1, 0, ...l.certificate.walk.slice(1)];
      for (let i = 1; i < bad.length; i++)
        fireEvent.click(roadButton(routeRoadIndex(l, bad[i - 1], bad[i])));
      expect(p.onComplete).not.toHaveBeenCalled();
      expect(
        document.querySelector("[data-route-feedback]")?.textContent,
      ).toContain("撤销");
      p = { ...p, hintToken: 1 };
      view.rerender(<Component {...p} />);
      expect(
        document
          .querySelector("[data-route-hint]")
          ?.getAttribute("data-route-hint"),
      ).toBe("undo");
      expect(
        document.querySelector("[data-route-hint]")?.textContent,
      ).toContain("即使之后都走最省路线");
      p = { ...p, undoToken: 1 };
      view.rerender(<Component {...p} />);
      expect(pathText()).toContain(
        bad
          .slice(0, -1)
          .map((t) => l.towns[t].label)
          .join(" → "),
      );
      p = { ...p, resetToken: 1 };
      view.rerender(<Component {...p} />);
      const reverse = [...l.certificate.walk].reverse();
      for (let i = 1; i < reverse.length; i++)
        fireEvent.click(
          roadButton(routeRoadIndex(l, reverse[i - 1], reverse[i])),
        );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    });
  });
}
it("keyboard index helper wraps only within actionable controls", () => {
  expect(routeKeyboardRoad([2, 5, 8], 2, "ArrowLeft")).toBe(8);
  expect(routeKeyboardRoad([2, 5, 8], 8, "ArrowRight")).toBe(2);
  expect(routeKeyboardRoad([2, 5, 8], 5, "Home")).toBe(2);
  expect(routeKeyboardRoad([2, 5, 8], 5, "End")).toBe(8);
  expect(routeKeyboardRoad([], 5, "ArrowRight")).toBe(5);
  expect(routeKeyboardRoad([2, 5, 8], 5, "x")).toBe(5);
});
