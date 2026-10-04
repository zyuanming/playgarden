/** Original MIT Playgarden route puzzles. No external game data or assets. */
export type RouteMode = "town-tour" | "postman-routes";
export type RouteTown = { label: string; x: number; y: number };
export type RouteRoad = { a: number; b: number; cost: number };
export type RouteCertificate = {
  schema: "playgarden.route.v1";
  /** Node indices, including the depot at both ends. */
  walk: readonly number[];
  minimumCost: number;
};
export type RouteLevel = {
  id: string;
  mode: RouteMode;
  title: string;
  towns: readonly RouteTown[];
  roads: readonly RouteRoad[];
  depot: number;
  idea: string;
  difficulty: "起步" | "进阶" | "挑战";
  decision: string;
  certificate: RouteCertificate;
};
export type RouteState = { path: number[] };
export type RouteAnalysis = {
  valid: boolean;
  current: number;
  cost: number;
  townMask: number;
  roadMask: number;
  counts: number[];
  visited: number;
  covered: number;
  repeatedCost: number;
  closed: boolean;
  complete: boolean;
};
export type RouteHint =
  | { kind: "move"; road: number; remainingCost: number }
  | { kind: "undo"; steps: number; excess: number | null }
  | { kind: "complete" | "unavailable" };
export const ROUTE_MAX_STEPS = 128;
const edgeKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;
const bitCount = (mask: number) => {
  let count = 0;
  while (mask) {
    mask &= mask - 1;
    count++;
  }
  return count;
};
export function verifyRouteGraph(level: RouteLevel): boolean {
  const n = level.towns.length,
    m = level.roads.length;
  if (
    n < 3 ||
    n > 8 ||
    m < n - 1 ||
    m > 13 ||
    !Number.isInteger(level.depot) ||
    !level.towns[level.depot]
  )
    return false;
  if (
    !level.towns.every(
      (t) =>
        t.label &&
        Number.isFinite(t.x) &&
        Number.isFinite(t.y) &&
        t.x >= 24 &&
        t.x <= 376 &&
        t.y >= 24 &&
        t.y <= 316,
    )
  )
    return false;
  if (new Set(level.towns.map((t) => t.label)).size !== n) return false;
  const keys = new Set<string>();
  for (const road of level.roads) {
    if (
      ![road.a, road.b, road.cost].every(Number.isInteger) ||
      !level.towns[road.a] ||
      !level.towns[road.b] ||
      road.a === road.b ||
      road.cost < 1 ||
      road.cost > 99
    )
      return false;
    const key = edgeKey(road.a, road.b);
    if (keys.has(key)) return false;
    keys.add(key);
  }
  const reached = new Set([level.depot]);
  for (let pass = 0; pass < n; pass++)
    for (const { a, b } of level.roads) {
      if (reached.has(a)) reached.add(b);
      if (reached.has(b)) reached.add(a);
    }
  return reached.size === n;
}
export const createRouteState = (level: RouteLevel): RouteState => ({
  path: [level.depot],
});
export function routeRoadIndex(
  level: RouteLevel,
  a: number,
  b: number,
): number {
  return level.roads.findIndex(
    (e) => (e.a === a && e.b === b) || (e.b === a && e.a === b),
  );
}
export function analyzeRoute(
  level: RouteLevel,
  path: readonly number[],
): RouteAnalysis {
  const counts = level.roads.map(() => 0);
  let valid =
    path.length >= 1 &&
    path.length <= ROUTE_MAX_STEPS + 1 &&
    path[0] === level.depot;
  let cost = 0,
    townMask = 0,
    roadMask = 0,
    repeatedCost = 0;
  path.forEach((town, i) => {
    if (!Number.isInteger(town) || !level.towns[town]) {
      valid = false;
      return;
    }
    const closing = i === path.length - 1 && i > 0 && town === level.depot;
    if (
      level.mode === "town-tour" &&
      townMask & (1 << town) &&
      !(closing && i === level.towns.length)
    )
      valid = false;
    townMask |= 1 << town;
    if (i > 0) {
      const road = routeRoadIndex(level, path[i - 1], town);
      if (road < 0) {
        valid = false;
        return;
      }
      cost += level.roads[road].cost;
      if (counts[road]) repeatedCost += level.roads[road].cost;
      counts[road]++;
      roadMask |= 1 << road;
    }
  });
  const closed = path.length > 1 && path.at(-1) === level.depot;
  const visited = bitCount(townMask),
    covered = bitCount(roadMask);
  const complete =
    valid &&
    closed &&
    (level.mode === "town-tour"
      ? path.length === level.towns.length + 1 && visited === level.towns.length
      : covered === level.roads.length);
  return {
    valid,
    current: path.at(-1) ?? level.depot,
    cost,
    townMask,
    roadMask,
    counts,
    visited,
    covered,
    repeatedCost,
    closed,
    complete,
  };
}
type Completion = { cost: number; roads: number[] };
type TourTable = {
  distance: (town: number, mask: number) => number;
  next: Map<number, number>;
};
const tourCache = new WeakMap<RouteLevel, TourTable>();
/** Held–Karp tail DP: <= 8 * 2^8 states and 13 road probes/state. */
function tourTable(level: RouteLevel): TourTable {
  const cached = tourCache.get(level);
  if (cached) return cached;
  const all = (1 << level.towns.length) - 1,
    n = level.towns.length;
  const memo = new Map<number, number>(),
    next = new Map<number, number>();
  function distance(town: number, mask: number): number {
    const key = mask * n + town;
    if (memo.has(key)) return memo.get(key)!;
    if (mask === all) {
      const road = routeRoadIndex(level, town, level.depot);
      const value =
        town === level.depot ? 0 : road < 0 ? Infinity : level.roads[road].cost;
      if (road >= 0) next.set(key, road);
      memo.set(key, value);
      return value;
    }
    let best = Infinity;
    level.roads.forEach((road, index) => {
      const to = road.a === town ? road.b : road.b === town ? road.a : -1;
      if (to < 0 || mask & (1 << to)) return;
      const value = road.cost + distance(to, mask | (1 << to));
      if (value < best) {
        best = value;
        next.set(key, index);
      }
    });
    memo.set(key, best);
    return best;
  }
  const result = { distance, next };
  tourCache.set(level, result);
  return result;
}
/** Binary min-heap containing only finite nonnegative distances. */
class RouteHeap {
  entries: [number, number][] = [];
  push(cost: number, state: number) {
    const entry: [number, number] = [cost, state];
    let i = this.entries.length;
    this.entries.push(entry);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.entries[parent][0] <= cost) break;
      this.entries[i] = this.entries[parent];
      i = parent;
    }
    this.entries[i] = entry;
  }
  pop(): [number, number] | undefined {
    if (!this.entries.length) return undefined;
    const first = this.entries[0],
      last = this.entries.pop()!;
    if (this.entries.length) {
      let i = 0;
      while (i * 2 + 1 < this.entries.length) {
        let child = i * 2 + 1;
        if (
          child + 1 < this.entries.length &&
          this.entries[child + 1][0] < this.entries[child][0]
        )
          child++;
        if (this.entries[child][0] >= last[0]) break;
        this.entries[i] = this.entries[child];
        i = child;
      }
      this.entries[i] = last;
    }
    return first;
  }
}
type PostmanTable = {
  costs: Float64Array;
  nextRoad: Int16Array;
  nextState: Int32Array;
  goal: number;
};
const postmanCache = new WeakMap<RouteLevel, PostmanTable>();
/** Reverse Dijkstra on (covered-road mask, current town). At most 8 * 2^13 = 65,536 states. */
function postmanTable(level: RouteLevel): PostmanTable {
  const cached = postmanCache.get(level);
  if (cached) return cached;
  const n = level.towns.length,
    count = n * (1 << level.roads.length);
  const costs = new Float64Array(count).fill(Infinity),
    nextRoad = new Int16Array(count).fill(-1),
    nextState = new Int32Array(count).fill(-1);
  const goal = count - n + level.depot,
    heap = new RouteHeap();
  const adjacent = level.towns.map((_, town) =>
    level.roads.flatMap((e, index) =>
      e.a === town
        ? [{ to: e.b, index, cost: e.cost }]
        : e.b === town
          ? [{ to: e.a, index, cost: e.cost }]
          : [],
    ),
  );
  costs[goal] = 0;
  heap.push(0, goal);
  while (heap.entries.length) {
    const [distance, state] = heap.pop()!;
    if (distance !== costs[state]) continue;
    const town = state % n,
      mask = Math.floor(state / n);
    for (const road of adjacent[town]) {
      const bit = 1 << road.index;
      if (!(mask & bit)) continue;
      for (const previousMask of [mask, mask ^ bit]) {
        const previous = previousMask * n + road.to,
          value = distance + road.cost;
        if (value < costs[previous]) {
          costs[previous] = value;
          nextRoad[previous] = road.index;
          nextState[previous] = state;
          heap.push(value, previous);
        }
      }
    }
  }
  const result = { costs, nextRoad, nextState, goal };
  postmanCache.set(level, result);
  return result;
}
/** Independent Chinese-postman optimality bound: road sum + minimum odd-vertex shortest-path pairing. */
export function postmanParityMinimum(level: RouteLevel): number {
  if (!verifyRouteGraph(level)) return Infinity;
  const n = level.towns.length,
    degrees = Array(n).fill(0) as number[];
  const distances = Array.from({ length: n }, (_, a) =>
    Array.from({ length: n }, (_, b) => (a === b ? 0 : Infinity)),
  );
  let roadSum = 0;
  for (const { a, b, cost } of level.roads) {
    degrees[a]++;
    degrees[b]++;
    distances[a][b] = distances[b][a] = cost;
    roadSum += cost;
  }
  for (let k = 0; k < n; k++)
    for (let a = 0; a < n; a++)
      for (let b = 0; b < n; b++)
        distances[a][b] = Math.min(
          distances[a][b],
          distances[a][k] + distances[k][b],
        );
  const odd = degrees.flatMap((degree, i) => (degree % 2 ? [i] : [])),
    memo = new Map<number, number>([[0, 0]]);
  function pair(mask: number): number {
    if (memo.has(mask)) return memo.get(mask)!;
    const first = odd.findIndex((_, i) => mask & (1 << i));
    let best = Infinity;
    for (let other = first + 1; other < odd.length; other++)
      if (mask & (1 << other))
        best = Math.min(
          best,
          distances[odd[first]][odd[other]] +
            pair(mask ^ (1 << first) ^ (1 << other)),
        );
    memo.set(mask, best);
    return best;
  }
  return roadSum + pair((1 << odd.length) - 1);
}
export function routeMinimumCost(level: RouteLevel): number {
  if (!verifyRouteGraph(level)) return Infinity;
  return level.mode === "town-tour"
    ? tourTable(level).distance(level.depot, 1 << level.depot)
    : postmanParityMinimum(level);
}
export function routeCompletion(
  level: RouteLevel,
  path: readonly number[],
): Completion | null {
  if (!verifyRouteGraph(level)) return null;
  const analysis = analyzeRoute(level, path);
  if (!analysis.valid) return null;
  if (analysis.complete) return { cost: 0, roads: [] };
  const roads: number[] = [];
  if (level.mode === "town-tour") {
    const table = tourTable(level),
      cost = table.distance(analysis.current, analysis.townMask);
    if (!Number.isFinite(cost)) return null;
    let town = analysis.current,
      mask = analysis.townMask;
    for (let guard = 0; guard <= level.towns.length; guard++) {
      const road = table.next.get(mask * level.towns.length + town);
      if (road === undefined) break;
      roads.push(road);
      const e = level.roads[road];
      town = e.a === town ? e.b : e.a;
      mask |= 1 << town;
      if (town === level.depot) break;
    }
    return { cost, roads };
  }
  const table = postmanTable(level);
  let cursor = analysis.roadMask * level.towns.length + analysis.current;
  const cost = table.costs[cursor];
  if (!Number.isFinite(cost)) return null;
  for (
    let guard = 0;
    cursor !== table.goal && guard < ROUTE_MAX_STEPS;
    guard++
  ) {
    const road = table.nextRoad[cursor];
    if (road < 0) return null;
    roads.push(road);
    cursor = table.nextState[cursor];
  }
  return cursor === table.goal ? { cost, roads } : null;
}
export function isRouteSolved(level: RouteLevel, state: RouteState): boolean {
  const analysis = analyzeRoute(level, state.path);
  return analysis.complete && analysis.cost === routeMinimumCost(level);
}
export type RouteMoveOutcome =
  | "moved"
  | "invalid"
  | "not-adjacent"
  | "revisited-town"
  | "home-early"
  | "finished"
  | "limit";
export function walkRouteRoad(
  level: RouteLevel,
  state: RouteState,
  roadIndex: number,
): { state: RouteState; outcome: RouteMoveOutcome } {
  const analysis = analyzeRoute(level, state.path);
  if (
    !analysis.valid ||
    !Number.isInteger(roadIndex) ||
    !level.roads[roadIndex]
  )
    return { state, outcome: "invalid" };
  if (
    isRouteSolved(level, state) ||
    (level.mode === "town-tour" && analysis.complete)
  )
    return { state, outcome: "finished" };
  if (state.path.length > ROUTE_MAX_STEPS) return { state, outcome: "limit" };
  const road = level.roads[roadIndex],
    to =
      road.a === analysis.current
        ? road.b
        : road.b === analysis.current
          ? road.a
          : -1;
  if (to < 0) return { state, outcome: "not-adjacent" };
  if (level.mode === "town-tour") {
    if (to === level.depot && analysis.visited !== level.towns.length)
      return { state, outcome: "home-early" };
    if (to !== level.depot && analysis.townMask & (1 << to))
      return { state, outcome: "revisited-town" };
  }
  return { state: { path: [...state.path, to] }, outcome: "moved" };
}
export function undoRoute(state: RouteState): RouteState {
  return state.path.length > 1 ? { path: state.path.slice(0, -1) } : state;
}
export function routeHint(level: RouteLevel, state: RouteState): RouteHint {
  if (!verifyRouteGraph(level) || !analyzeRoute(level, state.path).valid)
    return { kind: "unavailable" };
  if (isRouteSolved(level, state)) return { kind: "complete" };
  const optimum = routeMinimumCost(level),
    current = analyzeRoute(level, state.path),
    currentCompletion = routeCompletion(level, state.path);
  if (
    currentCompletion &&
    current.cost + currentCompletion.cost === optimum &&
    currentCompletion.roads.length
  )
    return {
      kind: "move",
      road: currentCompletion.roads[0],
      remainingCost: currentCompletion.cost,
    };
  for (let steps = 1; steps < state.path.length; steps++) {
    const prefix = state.path.slice(0, -steps),
      completion = routeCompletion(level, prefix);
    if (
      completion &&
      analyzeRoute(level, prefix).cost + completion.cost === optimum
    )
      return {
        kind: "undo",
        steps,
        excess: currentCompletion
          ? current.cost + currentCompletion.cost - optimum
          : null,
      };
  }
  return { kind: "unavailable" };
}
export function verifyRouteCertificate(level: RouteLevel): boolean {
  if (
    !verifyRouteGraph(level) ||
    level.certificate.schema !== "playgarden.route.v1"
  )
    return false;
  const result = analyzeRoute(level, level.certificate.walk),
    optimum = routeMinimumCost(level);
  const exact = routeCompletion(level, [level.depot]);
  return (
    result.complete &&
    result.cost === level.certificate.minimumCost &&
    result.cost === optimum &&
    exact?.cost === optimum
  );
}
/** Direction keys move focus through the visible road list; activation remains Enter/Space. */
export function routeKeyboardRoad(
  available: readonly number[],
  current: number,
  key: string,
): number {
  if (!available.length) return current;
  if (key === "Home") return available[0];
  if (key === "End") return available.at(-1)!;
  const delta =
    key === "ArrowRight" || key === "ArrowDown"
      ? 1
      : key === "ArrowLeft" || key === "ArrowUp"
        ? -1
        : 0;
  if (!delta) return current;
  const position = available.indexOf(current);
  return available[(position + delta + available.length) % available.length];
}
