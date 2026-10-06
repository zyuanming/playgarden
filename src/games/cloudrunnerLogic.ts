// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 YuanMing; original route, lifecycle, and campaign integration.
import {
  createInitialPlayer,
  step,
  type Intent,
  type PlayerState,
} from "../vendor/cloudrunner/player/index";
import {
  nextBatch,
  LANES,
  type Placement,
  type Lane,
} from "../vendor/cloudrunner/track/index";
import { resolve } from "../vendor/cloudrunner/collision/index";
import {
  begin,
  crash,
  createInitialState,
  tick,
  type GameState,
} from "../vendor/cloudrunner/game/state";
import {
  curve,
  generatorDifficulty,
} from "../vendor/cloudrunner/difficulty/index";
import { scoreFor } from "../vendor/cloudrunner/scoring/index";
export type TurnDirection = "left" | "right";
export type RouteTurn = { z: number; direction: TurnDirection };
export type Lesson = {
  title: string;
  caption: string;
  length: number;
  placements: Placement[];
  turns: RouteTurn[];
};
const gate = (z: number, type: Placement["type"]): Placement[] =>
  LANES.map((lane) => ({ lane, z, type }));
const coins = (zs: number[], lane: Lane): Placement[] =>
  zs.map((z) => ({ lane, z, type: "coin" }));
export const runnerLessons: readonly Lesson[] = [
  {
    title: "01 · 找到空道",
    caption: "琥珀石柱不能跳过。左右换道，绕开它。",
    length: 112,
    turns: [],
    placements: [
      { lane: "center", z: 44, type: "full-block" },
      { lane: "left", z: 80, type: "full-block" },
      ...coins([20, 24, 28], "center"),
      ...coins([40, 46, 52, 56], "right"),
    ],
  },
  {
    title: "02 · 轻轻一跃",
    caption: "靠近珊瑚矮栏时向上滑动。三道矮栏都需要跳跃。",
    length: 136,
    turns: [],
    placements: [
      ...gate(48, "obstacle-low"),
      ...gate(100, "obstacle-low"),
      ...coins([20, 24, 28, 70, 74, 78], "center"),
    ],
  },
  {
    title: "03 · 低头穿过",
    caption: "薄荷横梁下方留有空间。靠近时向下滑动，低身滑过。",
    length: 136,
    turns: [],
    placements: [
      ...gate(48, "obstacle-high"),
      ...gate(100, "obstacle-high"),
      ...coins([20, 24, 28, 70, 74, 78], "center"),
    ],
  },
  {
    title: "04 · 向左看风景",
    caption: "路口倒数变亮后向左滑动，预备左转。错过路口会落下。",
    length: 168,
    turns: [{ z: 96, direction: "left" }],
    placements: [...coins([20, 24, 28, 52, 56, 128, 132, 136], "center")],
  },
  {
    title: "05 · 向右再出发",
    caption: "变亮后向右滑动，预备右转。相机会跟随新方向。",
    length: 168,
    turns: [{ z: 96, direction: "right" }],
    placements: [...coins([20, 24, 28, 52, 56, 128, 132, 136], "center")],
  },
  {
    title: "06 · 云端接力",
    caption: "换道、跳跃、滑铲，再连续转过两个路口。慢慢掌握节奏。",
    length: 432,
    turns: [
      { z: 160, direction: "left" },
      { z: 320, direction: "right" },
    ],
    placements: [
      { lane: "center", z: 40, type: "full-block" },
      ...gate(80, "obstacle-low"),
      ...gate(216, "obstacle-high"),
      ...gate(376, "obstacle-low"),
      ...coins([22, 26, 30, 180, 184, 188, 340, 344, 348], "center"),
    ],
  },
];
export const TURN_WINDOW = 28;
export const TURN_NOTICE = 64;
export const TURN_CLEARANCE = 44;
export const FIXED_STEP = 1 / 120;
export type RunnerState = {
  game: GameState;
  player: PlayerState;
  placements: Placement[];
  turns: RouteTurn[];
  coins: number;
  passed: number;
  turnCount: number;
  nextTurn: number;
  queuedTurn: TurnDirection | null;
  outcome: "running" | "crashed" | "finished";
  reason: string;
  seed: number;
  batch: number;
  generatedTo: number;
  lesson: number | null;
  elapsed: number;
};
function endlessTurns(until: number, after = 0): RouteTurn[] {
  const turns: RouteTurn[] = [];
  for (
    let i = Math.max(0, Math.floor(after / 224) - 2);
    (i + 1) * 224 <= until;
    i++
  )
    turns.push({
      z: (i + 1) * 224,
      direction: i % 4 === 0 || i % 4 === 3 ? "left" : "right",
    });
  return turns;
}
export function createRunner(
  lesson: number | null = null,
  seed = 20261006,
): RunnerState {
  const spec =
    lesson === null ? null : (runnerLessons[lesson] ?? runnerLessons[0]);
  const state: RunnerState = {
    game: createInitialState(),
    player: createInitialPlayer(),
    placements: spec ? spec.placements.map((p) => ({ ...p })) : [],
    turns: spec ? spec.turns.map((t) => ({ ...t })) : endlessTurns(2048),
    coins: 0,
    passed: 0,
    turnCount: 0,
    nextTurn: 0,
    queuedTurn: null,
    outcome: "running",
    reason: "",
    seed: seed >>> 0,
    batch: 0,
    generatedTo: 0,
    lesson: spec ? Math.max(0, runnerLessons.indexOf(spec)) : null,
    elapsed: 0,
  };
  return extendTrack(state);
}
function extendTrack(state: RunnerState): RunnerState {
  if (state.lesson !== null || state.generatedTo > state.game.distance + 190)
    return state;
  const batch = nextBatch(
    state.seed,
    state.batch,
    generatorDifficulty(curve(state.game.distance)),
    state.generatedTo,
  );
  const end = Math.max(...batch.map((p) => p.z)) + 48;
  const turns = endlessTurns(end + 512, state.game.distance);
  const nextTurn = turns.findIndex((t) => t.z > state.game.distance);
  // Keep the actual upstream chunks, but reserve a generous empty zone at every corner.
  // Rows are 24 units apart; at the 28 u/s cap, even two-lane moves and a .6 s jump fit.
  const safe = batch.filter(
    (p) =>
      p.z >= 36 && !turns.some((t) => Math.abs(t.z - p.z) < TURN_CLEARANCE),
  );
  return {
    ...state,
    placements: [...state.placements, ...safe],
    turns,
    nextTurn,
    batch: state.batch + 1,
    generatedTo: end,
  };
}
export function startRunner(state: RunnerState): RunnerState {
  return { ...state, game: begin(state.game) };
}
export function upcomingTurn(state: RunnerState): RouteTurn | null {
  return state.turns[state.nextTurn] ?? null;
}
export function clearBufferedInput(state: RunnerState): RunnerState {
  return {
    ...state,
    player: { ...state.player, buffered: null, bufferAge: 0 },
    // An accepted turn is a committed route choice, not an expiring input.
  };
}
export function inputRunner(state: RunnerState, intent: Intent): RunnerState {
  if (state.game.phase !== "playing" || state.outcome !== "running")
    return state;
  const turn = upcomingTurn(state);
  if (
    (intent === "left" || intent === "right") &&
    turn &&
    turn.z - state.game.distance <= TURN_WINDOW &&
    turn.z >= state.game.distance
  )
    return { ...state, queuedTurn: intent };
  return { ...state, player: step(state.player, intent, 0) };
}
export function advanceRunner(
  initial: RunnerState,
  seconds: number,
): RunnerState {
  if (
    initial.game.phase !== "playing" ||
    initial.outcome !== "running" ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  )
    return initial;
  let state = initial;
  // No tunnelling: the narrowest collision band is crossed in many fixed substeps.
  // UI pauses on stalls above .25 s; this pure seam also supports bounded test/replay chunks.
  for (let left = Math.min(seconds, 2); left > 1e-9; left -= FIXED_STEP) {
    const dt = Math.min(left, FIXED_STEP),
      speed = state.lesson === null ? curve(state.game.distance).speed : 14;
    const player = step(state.player, null, dt),
      game = tick(state.game, dt, speed);
    state = { ...state, game, player, elapsed: state.elapsed + dt };
    const turn = upcomingTurn(state);
    if (turn && game.distance >= turn.z) {
      if (state.queuedTurn !== turn.direction)
        return {
          ...state,
          game: crash(game),
          outcome: "crashed",
          reason: state.queuedTurn
            ? "转错了方向。看清路口箭头，再试一次。"
            : "错过了转弯。箭头变亮时，提前向对应方向滑动。",
        };
      state = {
        ...state,
        nextTurn: state.nextTurn + 1,
        turnCount: state.turnCount + 1,
        queuedTurn: null,
        player: { ...createInitialPlayer() },
      };
    }
    const collision = resolve(state.player, state.placements, game.distance);
    if (collision.hit)
      return {
        ...state,
        game: crash(game),
        outcome: "crashed",
        reason: "碰到障碍了。矮栏跳过，横梁滑过，石柱换道。",
      };
    const collected = new Set(collision.collected);
    const behind = state.placements.filter(
      (p) => p.type !== "coin" && p.z < game.distance - 6,
    ).length;
    state = {
      ...state,
      coins: state.coins + collision.coinsCollected,
      passed: state.passed + behind,
      placements: state.placements.filter(
        (p) => p.z >= game.distance - 6 && !collected.has(p),
      ),
    };
    if (
      state.lesson !== null &&
      game.distance >= runnerLessons[state.lesson].length
    )
      return {
        ...state,
        game: {
          ...game,
          phase: "gameOver",
          distance: runnerLessons[state.lesson].length,
        },
        outcome: "finished",
        reason: "这一段云路，顺利抵达！",
      };
    state = extendTrack(state);
  }
  return state;
}
export function runnerScore(state: RunnerState): number {
  return scoreFor(state.game.distance, state.coins);
}
export function routeFrame(
  turns: readonly RouteTurn[],
  distance: number,
): { x: number; z: number; heading: number } {
  let x = 0,
    z = 0,
    heading = 0,
    at = 0;
  for (const turn of turns) {
    if (turn.z > distance) break;
    x += Math.sin(heading) * (turn.z - at);
    z += Math.cos(heading) * (turn.z - at);
    at = turn.z;
    heading += ((turn.direction === "right" ? 1 : -1) * Math.PI) / 2;
  }
  return {
    x: x + Math.sin(heading) * (distance - at),
    z: z + Math.cos(heading) * (distance - at),
    heading,
  };
}
export function routePoint(
  turns: readonly RouteTurn[],
  distance: number,
  lateral = 0,
): { x: number; z: number; heading: number } {
  const p = routeFrame(turns, distance);
  return {
    ...p,
    x: p.x + Math.cos(p.heading) * lateral,
    z: p.z - Math.sin(p.heading) * lateral,
  };
}
export function nextCue(state: RunnerState): string {
  const turn = upcomingTurn(state),
    d = state.game.distance;
  if (turn && turn.z - d < TURN_NOTICE)
    return `${turn.direction === "left" ? "左" : "右"}转路口 · ${Math.max(0, Math.ceil(turn.z - d))} 米${turn.z - d <= TURN_WINDOW ? " · 现在可预备转弯" : " · 等箭头变亮"}`;
  const next = state.placements.find((p) => p.type !== "coin" && p.z > d + 3);
  if (!next) return "前方开阔 · 跟着光点前进";
  const lanes = { left: "左道", center: "中道", right: "右道" };
  return `${lanes[next.lane]}${next.type === "full-block" ? "石柱 · 换道" : next.type === "obstacle-low" ? "矮栏 · 跳跃" : "横梁 · 滑铲"} · ${Math.ceil(next.z - d)} 米`;
}
