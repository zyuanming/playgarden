// SPDX-License-Identifier: GPL-3.0-only
export type PipeNode = { label: string; balance: number; x: number; y: number };
export type PipeEdge = {
  from: number;
  to: number;
  capacity: number;
  cost: number;
};
export type PipePublic = {
  nodes: PipeNode[];
  edges: PipeEdge[];
  budget?: number;
};
export type PipeLevel = PipePublic & {
  id: string;
  title: string;
  lesson: string;
  certificate: { flows: number[]; cost: number };
};
export type PipeState = {
  flows: (number | null)[];
  history: (number | null)[][];
};
export const PIPE_NODE_LIMIT = 8,
  PIPE_EDGE_LIMIT = 10,
  PIPE_AUGMENT_LIMIT = 70;
const int = (n: number, low: number, high: number) =>
  Number.isInteger(n) && n >= low && n <= high;
// Deliberately copy only public fields; even a throwing certificate getter is never read.
export function publicPipe(l: PipePublic): PipePublic {
  return {
    nodes: l.nodes.map((n) => ({
      label: n.label,
      balance: n.balance,
      x: n.x,
      y: n.y,
    })),
    edges: l.edges.map((e) => ({
      from: e.from,
      to: e.to,
      capacity: e.capacity,
      cost: e.cost,
    })),
    ...(l.budget === undefined ? {} : { budget: l.budget }),
  };
}
export function validPipe(l: PipePublic): boolean {
  return (
    l.nodes.length >= 2 &&
    l.nodes.length <= PIPE_NODE_LIMIT &&
    l.edges.length > 0 &&
    l.edges.length <= PIPE_EDGE_LIMIT &&
    l.nodes.every(
      (n) =>
        int(n.balance, -10, 10) && Number.isFinite(n.x) && Number.isFinite(n.y),
    ) &&
    l.nodes.reduce((a, n) => a + n.balance, 0) === 0 &&
    l.nodes.reduce((a, n) => a + Math.max(0, n.balance), 0) <= 20 &&
    l.nodes.some((n) => n.balance > 0) &&
    l.edges.every(
      (e) =>
        int(e.from, 0, l.nodes.length - 1) &&
        int(e.to, 0, l.nodes.length - 1) &&
        e.from !== e.to &&
        int(e.capacity, 1, 5) &&
        int(e.cost, 0, 9),
    ) &&
    new Set(l.edges.map((e) => `${e.from}:${e.to}`)).size === l.edges.length &&
    (l.budget === undefined || int(l.budget, 0, 450))
  );
}
export function createPipeState(l: PipePublic): PipeState {
  return { flows: l.edges.map(() => null), history: [] };
}
export function pipeCost(l: PipePublic, flows: (number | null)[]): number {
  return l.edges.reduce((sum, e, i) => sum + (flows[i] ?? 0) * e.cost, 0);
}
export function pipeBalance(
  l: PipePublic,
  flows: (number | null)[],
  node: number,
): number {
  return l.edges.reduce(
    (sum, e, i) =>
      sum + (e.from === node ? 1 : e.to === node ? -1 : 0) * (flows[i] ?? 0),
    0,
  );
}
export function pipeWon(l: PipePublic, flows: (number | null)[]): boolean {
  return (
    validPipe(l) &&
    flows.length === l.edges.length &&
    flows.every((v, i) => v !== null && int(v, 0, l.edges[i].capacity)) &&
    l.nodes.every((n, i) => pipeBalance(l, flows, i) === n.balance) &&
    (l.budget === undefined || pipeCost(l, flows) <= l.budget)
  );
}
export function assignPipe(
  l: PipePublic,
  state: PipeState,
  edge: number,
  value: number | null,
): PipeState {
  if (
    !int(edge, 0, l.edges.length - 1) ||
    (value !== null && !int(value, 0, l.edges[edge].capacity)) ||
    state.flows[edge] === value
  )
    return state;
  const flows = state.flows.slice();
  flows[edge] = value;
  return { flows, history: [...state.history, state.flows.slice()] };
}
export function undoPipe(state: PipeState): PipeState {
  return state.history.length
    ? {
        flows: state.history.at(-1)!.slice(),
        history: state.history.slice(0, -1),
      }
    : state;
}
export type PipeSolution = {
  status: "solved" | "impossible" | "invalid";
  flows?: number[];
  cost?: number;
  augmentations: number;
  reason: string;
};
/** Integral min-cost flow on unknown edges, with fixed flows subtracted from balances.
 * At most 10 nodes including terminals, 18 residual edge pairs, 70 unit augmentations.
 * Bellman-Ford handles negative reverse edges. No certificates, random seeds or search cutoff. */
export function solvePipe(
  l: PipePublic,
  fixed: (number | null)[] = l.edges.map(() => null),
): PipeSolution {
  const failure = (
    status: "invalid" | "impossible",
    reason: string,
    augmentations = 0,
  ): PipeSolution => ({ status, reason, augmentations });
  if (
    !validPipe(l) ||
    fixed.length !== l.edges.length ||
    fixed.some((v, i) => v !== null && !int(v, 0, l.edges[i].capacity))
  )
    return failure("invalid", "图或已填数值超出支持范围。");
  type Arc = { to: number; rev: number; cap: number; cost: number };
  const size = l.nodes.length + 2,
    source = size - 2,
    sink = size - 1,
    graph: Arc[][] = Array.from({ length: size }, () => []);
  function add(from: number, to: number, cap: number, cost: number): Arc {
    const a = { to, rev: graph[to].length, cap, cost },
      b = { to: from, rev: graph[from].length, cap: 0, cost: -cost };
    graph[from].push(a);
    graph[to].push(b);
    return a;
  }
  const balance = l.nodes.map((n) => n.balance),
    refs: (Arc | null)[] = l.edges.map((e, i) => {
      const v = fixed[i];
      if (v !== null) {
        balance[e.from] -= v;
        balance[e.to] += v;
        return null;
      }
      return add(e.from, e.to, e.capacity, e.cost);
    });
  let required = 0;
  balance.forEach((b, i) => {
    if (b > 0) {
      add(source, i, b, 0);
      required += b;
    } else if (b < 0) add(i, sink, -b, 0);
  });
  let sent = 0,
    augmentations = 0;
  while (sent < required) {
    const distance = Array(size).fill(Infinity),
      prevNode = Array(size).fill(-1),
      prevArc = Array(size).fill(-1);
    distance[source] = 0;
    for (let pass = 0; pass < size - 1; pass++) {
      let changed = false;
      for (let n = 0; n < size; n++)
        for (let i = 0; i < graph[n].length; i++) {
          const a = graph[n][i];
          if (a.cap > 0 && distance[n] + a.cost < distance[a.to]) {
            distance[a.to] = distance[n] + a.cost;
            prevNode[a.to] = n;
            prevArc[a.to] = i;
            changed = true;
          }
        }
      if (!changed) break;
    }
    if (!Number.isFinite(distance[sink]))
      return failure(
        "impossible",
        "保留所有已填流量后，无法满足每个节点的供需守恒。",
        augmentations,
      );
    let amount = required - sent;
    for (let n = sink; n !== source; n = prevNode[n])
      amount = Math.min(amount, graph[prevNode[n]][prevArc[n]].cap);
    for (let n = sink; n !== source; n = prevNode[n]) {
      const a = graph[prevNode[n]][prevArc[n]];
      a.cap -= amount;
      graph[n][a.rev].cap += amount;
    }
    sent += amount;
    augmentations++;
  }
  const flows = l.edges.map((e, i) => fixed[i] ?? e.capacity - refs[i]!.cap),
    cost = pipeCost(l, flows);
  if (l.budget !== undefined && cost > l.budget)
    return {
      ...failure(
        "impossible",
        `保留已填流量的最低费用是 ${cost}，超过预算 ${l.budget}。请撤销或把某条已填管道改回“？”后重试。`,
        augmentations,
      ),
      cost,
    };
  return {
    status: "solved",
    flows,
    cost,
    augmentations,
    reason: "找到保留全部已填数值的完整可行流量。",
  };
}
export type PipeHint = { text: string; edge?: number; value?: number };
export function pipeHint(l: PipePublic, state: PipeState): PipeHint {
  const result = solvePipe(l, state.flows);
  if (result.status !== "solved")
    return {
      text: `${result.reason} 已填的 0 也会保留；提示不会偷偷改动它们。`,
    };
  const edge = state.flows.findIndex((v) => v === null);
  if (edge < 0) return { text: "所有需求和预算已经满足。" };
  const e = l.edges[edge],
    value = result.flows![edge];
  return {
    edge,
    value,
    text: `保留你已填的所有流量，可把 ${l.nodes[e.from].label} → ${l.nodes[e.to].label} 设为 ${value}（容量 ${e.capacity}）。这是一种可行补全，未必是唯一选择；完整费用 ${result.cost}。`,
  };
}

export type PipeRoutePoint = { x: number; y: number };
/** Shortest orthogonal route through open lanes around station cards and labels.
 * Endpoints use left, right or top ports so arrows never pass through goal labels.
 * Coordinates are presentation only; routes never change graph connectivity. */
export function pipeRoute(l: PipePublic, edge: number): PipeRoutePoint[] {
  const { from, to } = l.edges[edge];
  const ordinal = edge;
  const offset = ((ordinal % 5) - 2) * 5;
  const padX = 58 + ordinal * 3,
    topPort = padX,
    bottomLane = 86 + ordinal * 3;
  const boxes = l.nodes.map((n) => ({
    left: n.x - 36,
    right: n.x + 36,
    top: n.y - 34,
    bottom: n.y + 62,
  }));
  const xs = [
    ...new Set([
      0,
      ...l.nodes.flatMap((n) => [
        n.x - padX,
        n.x - 44,
        n.x,
        n.x + offset,
        n.x + 44,
        n.x + padX,
      ]),
      Math.max(...l.nodes.map((n) => n.x)) + 150,
    ]),
  ].sort((a, b) => a - b);
  const ys = [
    ...new Set([
      0,
      ...l.nodes.flatMap((n) => [
        n.y - topPort,
        n.y - 44,
        n.y,
        n.y + offset,
        n.y + bottomLane,
      ]),
      Math.max(...l.nodes.map((n) => n.y)) + 160,
    ]),
  ].sort((a, b) => a - b);
  const point = (id: number): PipeRoutePoint => ({
    x: xs[id % xs.length],
    y: ys[Math.floor(id / xs.length)],
  });
  const id = (p: PipeRoutePoint) =>
    ys.indexOf(p.y) * xs.length + xs.indexOf(p.x);
  const ports = (n: { x: number; y: number }) => [
    { x: n.x - 44, y: n.y + offset },
    { x: n.x + 44, y: n.y + offset },
    { x: n.x + offset, y: n.y - 44 },
  ];
  const blocked = (p: PipeRoutePoint) =>
    boxes.some(
      (b) => p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom,
    );
  const openSegment = (a: PipeRoutePoint, b: PipeRoutePoint) =>
    !boxes.some((r) =>
      a.x === b.x
        ? a.x >= r.left &&
          a.x <= r.right &&
          Math.max(a.y, b.y) >= r.top &&
          Math.min(a.y, b.y) <= r.bottom
        : a.y >= r.top &&
          a.y <= r.bottom &&
          Math.max(a.x, b.x) >= r.left &&
          Math.min(a.x, b.x) <= r.right,
    );
  const starts = ports(l.nodes[from]).filter((p) => !blocked(p)),
    ends = new Set(
      ports(l.nodes[to])
        .filter((p) => !blocked(p))
        .map(id),
    );
  const distance = Array(xs.length * ys.length).fill(Infinity),
    previous = Array(distance.length).fill(-1);
  const heap: { id: number; cost: number }[] = [];
  function push(entry: { id: number; cost: number }) {
    heap.push(entry);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].cost <= entry.cost) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = entry;
  }
  function pop() {
    const first = heap[0],
      last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (2 * i + 1 < heap.length) {
        let child = 2 * i + 1;
        if (child + 1 < heap.length && heap[child + 1].cost < heap[child].cost)
          child++;
        if (heap[child].cost >= last.cost) break;
        heap[i] = heap[child];
        i = child;
      }
      heap[i] = last;
    }
    return first;
  }
  for (const p of starts) {
    const k = id(p);
    distance[k] = 0;
    push({ id: k, cost: 0 });
  }
  let finish = -1;
  while (heap.length) {
    const current = pop();
    if (current.cost !== distance[current.id]) continue;
    if (ends.has(current.id)) {
      finish = current.id;
      break;
    }
    const a = point(current.id),
      column = current.id % xs.length,
      row = Math.floor(current.id / xs.length);
    const neighbors = [
      column > 0 ? current.id - 1 : -1,
      column + 1 < xs.length ? current.id + 1 : -1,
      row > 0 ? current.id - xs.length : -1,
      row + 1 < ys.length ? current.id + xs.length : -1,
    ];
    for (const next of neighbors) {
      if (next < 0) continue;
      const b = point(next);
      if (blocked(b) || !openSegment(a, b)) continue;
      const cost = current.cost + Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (cost >= distance[next]) continue;
      distance[next] = cost;
      previous[next] = current.id;
      push({ id: next, cost });
    }
  }
  if (finish < 0) return []; // Never draw a misleading straight fallback through a station.
  const path: PipeRoutePoint[] = [];
  for (let at = finish; at !== -1; at = previous[at]) path.push(point(at));
  path.reverse();
  const attach = (
    n: { x: number; y: number },
    port: PipeRoutePoint,
    radius: number,
  ) => {
    return Math.abs(port.x - n.x) > Math.abs(port.y - n.y)
      ? { x: n.x + Math.sign(port.x - n.x) * radius, y: port.y }
      : { x: port.x, y: n.y - radius };
  };
  const full = [
    attach(l.nodes[from], path[0], 24),
    ...path,
    attach(l.nodes[to], path.at(-1)!, 29),
  ];
  return full.filter(
    (p, i) =>
      i === 0 ||
      i === full.length - 1 ||
      !(
        (full[i - 1].x === p.x && p.x === full[i + 1].x) ||
        (full[i - 1].y === p.y && p.y === full[i + 1].y)
      ),
  );
}
