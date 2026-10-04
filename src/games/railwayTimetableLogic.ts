// SPDX-License-Identifier: MIT
/** Deliberately simplified discrete puzzle; never real railway operating guidance. */
export type RailNode = { label: string; x: number; y: number; next: number[] };
export type RailPublic = {
  nodes: RailNode[];
  starts: [number, number];
  goals: [number, number];
  holdAllowed: [boolean, boolean];
  deadline?: number;
};
export type RailAction = { switches: number[]; holds: [boolean, boolean] };
export type RailBoard = { positions: [number, number]; tick: number };
export type RailSnapshot = { board: RailBoard; controls: RailAction };
export type RailState = RailSnapshot & { history: RailSnapshot[] };
export type RailLevel = RailPublic & {
  id: string;
  title: string;
  lesson: string;
  certificate: { actions: RailAction[]; ticks: number };
};
export const RAIL_NODE_LIMIT = 12,
  RAIL_STATE_LIMIT = 132,
  RAIL_ACTION_LIMIT = 16,
  RAIL_TRANSITION_LIMIT = 2112;
const int = (n: number, lo: number, hi: number) =>
  Number.isInteger(n) && n >= lo && n <= hi;
export function publicRail(l: RailPublic): RailPublic {
  return {
    nodes: l.nodes.map((n) => ({
      label: n.label,
      x: n.x,
      y: n.y,
      next: n.next.slice(),
    })),
    starts: [...l.starts],
    goals: [...l.goals],
    holdAllowed: [...l.holdAllowed],
    ...(l.deadline === undefined ? {} : { deadline: l.deadline }),
  };
}
export function railSwitches(l: RailPublic): number[] {
  return l.nodes.flatMap((n, i) => (n.next.length === 2 ? [i] : []));
}
export function validRail(l: RailPublic): boolean {
  return (
    l.nodes.length >= 4 &&
    l.nodes.length <= RAIL_NODE_LIMIT &&
    railSwitches(l).length <= 2 &&
    l.nodes.every(
      (n, i) =>
        Number.isFinite(n.x) &&
        Number.isFinite(n.y) &&
        n.next.length <= 2 &&
        new Set(n.next).size === n.next.length &&
        n.next.every((j) => int(j, 0, l.nodes.length - 1) && j !== i),
    ) &&
    l.starts.length === 2 &&
    l.goals.length === 2 &&
    [...l.starts, ...l.goals].every((n) => int(n, 0, l.nodes.length - 1)) &&
    l.starts[0] !== l.starts[1] &&
    l.goals[0] !== l.goals[1] &&
    l.holdAllowed.length === 2 &&
    l.holdAllowed.every((v) => typeof v === "boolean") &&
    (l.deadline === undefined || int(l.deadline, 1, 24))
  );
}
function cloneAction(a: RailAction): RailAction {
  return { switches: a.switches.slice(), holds: [...a.holds] };
}
function cloneBoard(b: RailBoard): RailBoard {
  return { positions: [...b.positions], tick: b.tick };
}
export function createRailState(l: RailPublic): RailState {
  return {
    board: { positions: [...l.starts], tick: 0 },
    controls: { switches: railSwitches(l).map(() => 0), holds: [false, false] },
    history: [],
  };
}
export function railWon(l: RailPublic, b: RailBoard): boolean {
  return (
    validRail(l) &&
    validBoard(l, b) &&
    b.positions.every((p, i) => p === l.goals[i]) &&
    (l.deadline === undefined || b.tick <= l.deadline)
  );
}
function validBoard(l: RailPublic, b: RailBoard): boolean {
  return (
    b.positions.length === 2 &&
    b.positions.every((n) => int(n, 0, l.nodes.length - 1)) &&
    b.positions[0] !== b.positions[1] &&
    Number.isSafeInteger(b.tick) &&
    b.tick >= 0
  );
}
export function validRailAction(l: RailPublic, a: RailAction): boolean {
  return (
    a.switches.length === railSwitches(l).length &&
    a.switches.every((n) => n === 0 || n === 1) &&
    a.holds.length === 2 &&
    a.holds.every((h, i) => typeof h === "boolean" && (!h || l.holdAllowed[i]))
  );
}
export type RailPreview = { valid: boolean; reason: string; next: RailBoard };
export function railPreview(
  l: RailPublic,
  b: RailBoard,
  a: RailAction,
): RailPreview {
  const fail = (reason: string): RailPreview => ({
    valid: false,
    reason,
    next: cloneBoard(b),
  });
  if (!validRail(l) || !validBoard(l, b) || !validRailAction(l, a))
    return fail("线路、位置或控制设置无效。");
  if (railWon(l, b)) return fail("两列车已经到达各自终点。");
  if (l.deadline !== undefined && b.tick >= l.deadline)
    return fail("已经到达步数期限，请撤销或重来。");
  const switches = railSwitches(l),
    positions = b.positions.map((p, i) =>
      p === l.goals[i] || a.holds[i] || l.nodes[p].next.length === 0
        ? p
        : l.nodes[p].next[
            switches.includes(p) ? a.switches[switches.indexOf(p)] : 0
          ],
    ) as [number, number];
  if (positions[0] === positions[1])
    return fail(
      `冲突：两列车会同时占用 ${l.nodes[positions[0]].label}。改道或让其中一辆等待。`,
    );
  if (positions[0] === b.positions[1] && positions[1] === b.positions[0])
    return fail("冲突：两列车会沿同一段轨道迎面对换。必须先让一辆进入侧线。");
  return {
    valid: true,
    reason: `下一步：α → ${l.nodes[positions[0]].label}；β → ${l.nodes[positions[1]].label}。同时移动，先离开的格可以被另一辆进入。`,
    next: { positions, tick: b.tick + 1 },
  };
}
export function editRail(
  l: RailPublic,
  s: RailState,
  a: RailAction,
): RailState {
  return validRailAction(l, a) ? { ...s, controls: cloneAction(a) } : s;
}
export function advanceRail(l: RailPublic, s: RailState): RailState {
  const p = railPreview(l, s.board, s.controls);
  return p.valid
    ? {
        board: p.next,
        controls: cloneAction(s.controls),
        history: [
          ...s.history,
          { board: cloneBoard(s.board), controls: cloneAction(s.controls) },
        ],
      }
    : s;
}
export function undoRail(s: RailState): RailState {
  const before = s.history.at(-1);
  return before
    ? {
        board: cloneBoard(before.board),
        controls: cloneAction(before.controls),
        history: s.history.slice(0, -1),
      }
    : s;
}
export function railActions(l: RailPublic): RailAction[] {
  const out: RailAction[] = [];
  for (let mask = 0; mask < 2 ** railSwitches(l).length; mask++)
    for (let holds = 0; holds < 4; holds++) {
      const a: RailAction = {
        switches: railSwitches(l).map((_, i) => (mask >> i) & 1),
        holds: [Boolean(holds & 1), Boolean(holds & 2)],
      };
      if (validRailAction(l, a)) out.push(a);
    }
  return out;
}
export type RailSolution = {
  status: "solved" | "impossible" | "invalid";
  actions: RailAction[];
  explored: number;
  transitions: number;
  reason: string;
  minimum?: number;
};
/** BFS over ordered, non-overlapping position pairs: at most 12*11=132 vertices.
 * Switches/holds can be edited freely before each tick, giving at most 16 actions.
 * Earlier arrival dominates later arrival, including with deadlines. */
export function solveRail(
  l: RailPublic,
  board: RailBoard = { positions: [...l.starts], tick: 0 },
): RailSolution {
  const result = (
    status: RailSolution["status"],
    reason: string,
    explored = 0,
    transitions = 0,
    actions: RailAction[] = [],
  ): RailSolution => ({ status, reason, explored, transitions, actions });
  if (!validRail(l) || !validBoard(l, board))
    return result("invalid", "线路或当前位置超出支持范围。");
  const model = publicRail(l);
  delete model.deadline;
  const actions = railActions(model),
    queue: {
      positions: [number, number];
      parent: number;
      action: RailAction | null;
    }[] = [{ positions: [...board.positions], parent: -1, action: null }],
    seen = new Set([board.positions.join(",")]);
  let transitions = 0;
  for (let at = 0; at < queue.length; at++) {
    const item = queue[at];
    if (item.positions.every((n, i) => n === model.goals[i])) {
      const plan: RailAction[] = [];
      for (let p = at; queue[p].parent !== -1; p = queue[p].parent)
        plan.push(cloneAction(queue[p].action!));
      plan.reverse();
      if (l.deadline !== undefined && board.tick + plan.length > l.deadline)
        return {
          ...result(
            "impossible",
            `从当前位置至少还需 ${plan.length} 步，超过剩余 ${Math.max(0, l.deadline - board.tick)} 步。请撤销。`,
            queue.length,
            transitions,
          ),
          minimum: plan.length,
        };
      return {
        ...result(
          "solved",
          `从当前位置最短还需 ${plan.length} 步。`,
          queue.length,
          transitions,
          plan,
        ),
        minimum: plan.length,
      };
    }
    for (const action of actions) {
      transitions++;
      const next = railPreview(
        model,
        { positions: item.positions, tick: 0 },
        action,
      );
      if (!next.valid) continue;
      const key = next.next.positions.join(",");
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ positions: next.next.positions, parent: at, action });
    }
  }
  return result(
    "impossible",
    "这两个当前位置已无法同时到站；停在终点的列车不会再离开。请撤销或重来。",
    queue.length,
    transitions,
  );
}
export type RailHint = { text: string; action?: RailAction };
export function railHint(l: RailPublic, s: RailState): RailHint {
  const r = solveRail(l, s.board);
  if (r.status !== "solved" || !r.actions.length) return { text: r.reason };
  const a = r.actions[0],
    switches = railSwitches(l),
    settings = switches
      .map(
        (n, i) =>
          `${l.nodes[n].label} 道岔 → ${l.nodes[l.nodes[n].next[a.switches[i]]].label}`,
      )
      .join("；");
  return {
    action: a,
    text: `${r.reason} 下一步建议：${settings ? settings + "；" : ""}α ${a.holds[0] ? "等待" : "放行"}，β ${a.holds[1] ? "等待" : "放行"}。已到终点的车保持停驻。先选设置，检查预览再推进。`,
  };
}

export type RailRoutePoint = { x: number; y: number };
/** Shortest orthogonal route through open lanes around station cards and labels.
 * Endpoints use left, right or top ports so arrows never pass through goal labels.
 * Coordinates are presentation only; routes never change graph connectivity. */
export function railRoute(
  l: RailPublic,
  from: number,
  to: number,
): RailRoutePoint[] {
  const ordinal =
    l.nodes.slice(0, from).reduce((sum, n) => sum + n.next.length, 0) +
    l.nodes[from].next.indexOf(to);
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
  const point = (id: number): RailRoutePoint => ({
    x: xs[id % xs.length],
    y: ys[Math.floor(id / xs.length)],
  });
  const id = (p: RailRoutePoint) =>
    ys.indexOf(p.y) * xs.length + xs.indexOf(p.x);
  const ports = (n: { x: number; y: number }) => [
    { x: n.x - 44, y: n.y + offset },
    { x: n.x + 44, y: n.y + offset },
    { x: n.x + offset, y: n.y - 44 },
  ];
  const blocked = (p: RailRoutePoint) =>
    boxes.some(
      (b) => p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom,
    );
  const openSegment = (a: RailRoutePoint, b: RailRoutePoint) =>
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
  const path: RailRoutePoint[] = [];
  for (let at = finish; at !== -1; at = previous[at]) path.push(point(at));
  path.reverse();
  const attach = (
    n: { x: number; y: number },
    port: RailRoutePoint,
    radius: number,
  ) => {
    return Math.abs(port.x - n.x) > Math.abs(port.y - n.y)
      ? { x: n.x + Math.sign(port.x - n.x) * radius, y: port.y }
      : { x: port.x, y: n.y - radius };
  };
  const full = [
    attach(l.nodes[from], path[0], 29),
    ...path,
    attach(l.nodes[to], path.at(-1)!, 34),
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
