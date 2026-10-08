// SPDX-License-Identifier: GPL-3.0-only
// Original Playgarden rules and authored stages. No upstream game code.
export const FROG_COLUMNS = 7;
export type CrossingLane =
  | { kind: "bank"; label: string }
  | { kind: "road" | "river"; speed: number; period: number; pieces: readonly { x: number; width: number }[] };
export type CrossingStage = {
  id: string;
  title: string;
  lesson: string;
  lanes: readonly CrossingLane[]; // Bottom to top; the goal bank is drawn separately.
  goals: readonly number[];
};
const bank = (label = "休息岸") => ({ kind: "bank", label }) as const;
const lane = (kind: "road" | "river", speed: number, period: number, pieces: readonly [number, number][]): CrossingLane =>
  ({ kind, speed, period, pieces: pieces.map(([x, width]) => ({ x, width })) });
const road = (speed: number, period: number, pieces: readonly [number, number][]) => lane("road", speed, period, pieces);
const river = (speed: number, period: number, pieces: readonly [number, number][]) => lane("river", speed, period, pieces);
export const crossingStages: readonly CrossingStage[] = [
  {
    id: "first-ripple", title: "01 · 第一圈涟漪",
    lesson: "先看车，再上木筏。草岸可以一直等，木筏会带着你移动。正前方的花叶就是家。",
    lanes: [bank("出发岸"), road(0.45, 11, [[0.2, 1.1]]), bank(), river(0.3, 9, [[2, 3.4], [7, 2.2]])], goals: [3.5],
  },
  {
    id: "two-way-lane", title: "02 · 来往的小路",
    lesson: "两条路的车方向不同。先在出发岸向右走，越过车流后再找木筏，右侧花叶等着你。",
    lanes: [bank("出发岸"), road(-0.48, 10, [[0.5, 1.2], [6.4, 1.1]]), road(0.58, 11, [[0.4, 1.3], [7.2, 1.1]]), bank(), river(-0.32, 10, [[3.5, 3.1], [9, 2.3]])], goals: [5.5],
  },
  {
    id: "two-neighbours", title: "03 · 两位邻居",
    lesson: "每片花叶送一位伙伴。送到后从岸边再出发；失败也保留已经送到的伙伴。",
    lanes: [bank("出发岸"), river(0.42, 9, [[1, 2.8], [6.3, 2.3]]), bank("小岛"), road(-0.55, 10, [[2.3, 1.2], [8, 1.3]]), bank(), river(0.35, 10, [[0.7, 2.8], [5.2, 2.5]])], goals: [1.5, 5.5],
  },
  {
    id: "opposing-currents", title: "04 · 两股水流",
    lesson: "相邻木筏反向漂流。等它们靠近再换筏，别把水面当作休息处。",
    lanes: [bank("出发岸"), road(0.55, 10, [[0.2, 1.3], [6.5, 1.3]]), bank(), river(0.43, 9, [[1.6, 3], [7, 2.1]]), river(-0.5, 10, [[0, 2.4], [4.7, 3]]), bank()], goals: [3.5],
  },
  {
    id: "long-and-short", title: "05 · 长车与短车",
    lesson: "长车慢慢来，短车更灵巧。不要只看车头：等整辆车离开，再跳进空隙。",
    lanes: [bank("出发岸"), road(0.38, 12, [[0, 2.5], [7.2, 2.1]]), road(-0.82, 10, [[1, 0.95], [5.9, 0.95]]), bank(), river(0.4, 10, [[0.5, 3], [5.8, 2.8]]), bank()], goals: [1.5, 5.5],
  },
  {
    id: "island-picnic", title: "06 · 小岛歇脚",
    lesson: "陆路与水路交替。把两座小岛当作观察台，一次只决定下一段。",
    lanes: [bank("出发岸"), road(0.62, 10, [[0.4, 1.2], [6, 1.3]]), bank("第一座小岛"), river(-0.45, 10, [[1.7, 2.7], [7, 2.5]]), bank("第二座小岛"), road(-0.68, 11, [[0.3, 1.4], [6.3, 1.2]]), river(0.38, 9, [[0.7, 3.1], [5.8, 2.4]])], goals: [1.5, 3.5],
  },
  {
    id: "upstream-transfer", title: "07 · 逆流接力",
    lesson: "先搭向左的快筏，再换向右的慢筏。可以向后跳回草岸，重新等一个时机。",
    lanes: [bank("出发岸"), river(-0.62, 9, [[2, 2.6], [7, 2.3]]), river(0.29, 10, [[0.4, 3.2], [6.2, 2.7]]), bank(), road(-0.75, 11, [[0.4, 1.1], [5.8, 1.4]]), bank(), river(0.52, 10, [[1, 3], [6, 2.7]])], goals: [5.5],
  },
  {
    id: "uneven-traffic", title: "08 · 错拍车流",
    lesson: "三条路没有共同节拍。左右让一步也有用，别因为第一条空着就一口气向前。",
    lanes: [bank("出发岸"), road(0.58, 10, [[0, 1.1], [6, 1.4]]), road(-0.44, 12, [[2, 2.1], [8, 1.6]]), road(0.78, 9, [[0.8, 0.9], [5.5, 1.1]]), bank(), river(-0.4, 10, [[1, 3.2], [6.7, 2.6]])], goals: [1.5, 5.5],
  },
  {
    id: "three-porches", title: "09 · 三处灯火",
    lesson: "三片花叶各接一位。先安排这次要去哪一片；同一片不能重复停靠。",
    lanes: [bank("出发岸"), road(-0.56, 11, [[0.5, 1.4], [6, 1.5]]), bank(), river(0.47, 10, [[0.5, 2.8], [5.5, 3]]), river(-0.37, 11, [[2, 3.1], [7.4, 2.8]]), bank(), road(0.68, 10, [[0, 1.1], [5.7, 1.3]]), bank()], goals: [1.5, 3.5, 5.5],
  },
  {
    id: "short-rafts", title: "10 · 短筏换乘",
    lesson: "短筏的落脚范围更小。先看下一条河的木筏位置，必要时在当前木筏上横跳。",
    lanes: [bank("出发岸"), road(0.52, 11, [[0.5, 1.5], [7, 1.2]]), bank(), river(0.42, 9, [[0.4, 1.9], [3.9, 2], [7.5, 1.8]]), river(-0.5, 10, [[1.1, 2.2], [5.8, 2]]), river(0.35, 9, [[0, 2.1], [4.1, 2.2]]), bank()], goals: [2.5, 5.5],
  },
  {
    id: "edge-flowers", title: "11 · 岸边花叶",
    lesson: "两端的花叶需要提前靠岸。木筏将到画面边缘时就换筏，别随它漂出池塘。",
    lanes: [bank("出发岸"), road(-0.7, 10, [[0.4, 1.1], [5.6, 1.3]]), bank(), river(0.56, 11, [[0, 3.5], [5.6, 3.2]]), river(-0.4, 10, [[0.2, 3], [5.1, 3]])], goals: [0.7, 3.5, 6.3],
  },
  {
    id: "evening-visit", title: "12 · 傍晚的探访",
    lesson: "把车流、换筏和休息岸串起来。没有倒计时，三位伙伴都能从容到家。",
    lanes: [bank("出发岸"), road(0.62, 11, [[0.3, 1.8], [6.5, 1.2]]), river(-0.4, 10, [[1.8, 3], [7, 2.5]]), bank("途中小岛"), road(-0.76, 10, [[0, 1.1], [5.2, 1.2]]), road(0.46, 12, [[2, 2.2], [8.1, 1.8]]), bank(), river(0.48, 10, [[0.4, 2.9], [5.5, 3]])], goals: [1.5, 3.5, 5.5],
  },
];
export type FrogDirection = "up" | "down" | "left" | "right";
export type CrossingState = {
  x: number; row: number; time: number;
  phase: "ready" | "playing" | "stranded" | "won";
  arrived: number[]; message: string; hops: number;
};
export function createCrossing(arrived: readonly number[] = []): CrossingState {
  return { x: 3.5, row: 0, time: 0, phase: "ready", arrived: [...arrived], hops: 0,
    message: arrived.length ? "已经到家的伙伴会等你。准备好再送下一位。" : "看好空隙，再轻轻一跳。" };
}
export type VisiblePiece = { x: number; width: number; key: string };
export function crossingPieces(l: CrossingLane, time: number): VisiblePiece[] {
  if (l.kind === "bank") return [];
  const result: VisiblePiece[] = [];
  l.pieces.forEach((piece, index) => {
    const x = ((piece.x + time * l.speed) % l.period + l.period) % l.period;
    for (const offset of [-l.period, 0, l.period]) {
      const left = x + offset;
      if (left < FROG_COLUMNS && left + piece.width > 0)
        result.push({ x: left, width: piece.width, key: `${index}:${offset}` });
    }
  });
  return result;
}
function danger(stage: CrossingStage, state: CrossingState): string | null {
  const l = stage.lanes[state.row];
  if (!l || l.kind === "bank") return null;
  const pieces = crossingPieces(l, state.time);
  if (l.kind === "road")
    return pieces.some((p) => state.x + 0.23 > p.x && state.x - 0.23 < p.x + p.width)
      ? "碰到小车了。先在草岸看一看车流，再试这次。" : null;
  if (state.x < 0.22 || state.x > FROG_COLUMNS - 0.22)
    return "木筏漂到了边缘。下次早点换筏，已经到家的伙伴仍然保留。";
  return pieces.some((p) => state.x >= p.x + 0.12 && state.x <= p.x + p.width - 0.12)
    ? null : "这一步落在水里了。等木筏靠近，再轻轻一跳。";
}
function checked(stage: CrossingStage, state: CrossingState): CrossingState {
  const message = danger(stage, state);
  return message ? { ...state, phase: "stranded", message } : state;
}
export function hopCrossing(stage: CrossingStage, state: CrossingState, direction: FrogDirection): CrossingState {
  if (state.phase !== "playing") return state;
  const x = state.x + (direction === "left" ? -1 : direction === "right" ? 1 : 0);
  const row = state.row + (direction === "up" ? 1 : direction === "down" ? -1 : 0);
  if (x < 0.22 || x > FROG_COLUMNS - 0.22 || row < 0) return state;
  if (row === stage.lanes.length) {
    const goal = stage.goals.findIndex((center) => Math.abs(center - x) <= 0.62);
    if (goal < 0 || state.arrived.includes(goal))
      return { ...state, message: goal < 0 ? "对准一片空花叶再向前跳。" : "这片花叶已经有伙伴了，换一片空花叶。" };
    const arrived = [...state.arrived, goal].sort((a, b) => a - b);
    if (arrived.length === stage.goals.length)
      return { ...state, x: stage.goals[goal], row, arrived, phase: "won", hops: state.hops + 1, message: "每位伙伴都到家了！这段探访完成。" };
    return { ...createCrossing(arrived), message: "一位伙伴到家了！准备好再送下一位。" };
  }
  return checked(stage, { ...state, x, row, hops: Math.min(99999, state.hops + 1), message: "留意下一条路，也留意脚下的木筏。" });
}
// Bounded substeps prevent vehicles tunnelling; callers pause instead of catching
// up a hidden tab or a long frame. There is deliberately no deadline/life limit.
export function advanceCrossing(stage: CrossingStage, state: CrossingState, seconds: number): CrossingState {
  if (state.phase !== "playing" || !Number.isFinite(seconds) || seconds <= 0 || seconds > 0.25) return state;
  let next = state;
  let remaining = seconds;
  while (remaining > 0 && next.phase === "playing") {
    const dt = Math.min(remaining, 1 / 90);
    const l = stage.lanes[next.row];
    next = checked(stage, { ...next, time: next.time + dt,
      x: next.x + (l?.kind === "river" ? l.speed * dt : 0) });
    remaining -= dt;
  }
  return next;
}
export const CROSSING_STORAGE = "playgarden.frog-crossing.v1";
export function loadCrossingCheckpoint(stage: CrossingStage, level: number): number[] {
  try {
    const raw = localStorage.getItem(`${CROSSING_STORAGE}.round.${level}`);
    if (!raw || raw.length > 256) return [];
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return [];
    const v = value as { version?: unknown; stage?: unknown; arrived?: unknown };
    if (v.version !== 1 || v.stage !== stage.id || !Array.isArray(v.arrived) || v.arrived.length >= stage.goals.length) return [];
    const arrived = v.arrived;
    return new Set(arrived).size === arrived.length && arrived.every((n) => Number.isInteger(n) && n >= 0 && n < stage.goals.length) ? [...arrived] : [];
  } catch { return []; }
}
export function saveCrossingCheckpoint(stage: CrossingStage, level: number, arrived: readonly number[]): boolean {
  try {
    const key = `${CROSSING_STORAGE}.round.${level}`;
    if (!arrived.length || arrived.length === stage.goals.length) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify({ version: 1, stage: stage.id, arrived }));
    return true;
  } catch { return false; }
}
