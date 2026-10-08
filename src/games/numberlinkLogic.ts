// SPDX-License-Identifier: GPL-3.0-only
import type { NumberlinkLevel } from "./numberlinkLevels";
export type NumberlinkAction = { kind: "start" | "step"; pair: number; cell: number } | { kind: "clear"; pair: number };
export type NumberlinkState = { paths: number[][]; history: NumberlinkAction[] };
export const NUMBERLINK_HISTORY_LIMIT = 4096;
export const numberlinkMarks = [
  { symbol: "●", name: "圆点", color: "#bd5146", pale: "#fae2db" },
  { symbol: "◆", name: "菱形", color: "#286ba3", pale: "#dfedf9" },
  { symbol: "▲", name: "三角", color: "#488345", pale: "#e5efdc" },
  { symbol: "★", name: "星星", color: "#9362a8", pale: "#eee2f5" },
  { symbol: "✚", name: "十字", color: "#98651b", pale: "#fff0c8" },
] as const;
export const createNumberlinkState = (level: NumberlinkLevel): NumberlinkState => ({ paths: level.pairs.map(() => []), history: [] });
export const endpointPair = (level: NumberlinkLevel, cell: number) => level.pairs.findIndex(pair => pair.includes(cell));
export function numberlinkAdjacent(level: NumberlinkLevel, a: number, b: number): boolean {
  return Math.abs(Math.floor(a / level.cols) - Math.floor(b / level.cols)) + Math.abs(a % level.cols - b % level.cols) === 1;
}
export function pairConnected(level: NumberlinkLevel, paths: readonly (readonly number[])[], pair: number): boolean {
  const path = paths[pair], ends = level.pairs[pair];
  return path.length >= 2 && ends.includes(path[0]) && ends.includes(path[path.length - 1]) && path[0] !== path[path.length - 1];
}
/** Validates the actual rule constraints, never compares with the authored example. */
export function numberlinkPathsValid(level: NumberlinkLevel, paths: readonly (readonly number[])[]): boolean {
  if (paths.length !== level.pairs.length) return false;
  const occupied = new Set<number>();
  for (let pair = 0; pair < paths.length; pair++) {
    const path = paths[pair];
    if (path.length && !level.pairs[pair].includes(path[0])) return false;
    for (let i = 0; i < path.length; i++) {
      const cell = path[i], owner = endpointPair(level, cell);
      if (!Number.isInteger(cell) || cell < 0 || cell >= level.rows * level.cols || level.holes.includes(cell) || occupied.has(cell)) return false;
      if (i > 0 && !numberlinkAdjacent(level, path[i - 1], cell)) return false;
      if (owner !== -1 && (owner !== pair || (i !== 0 && i !== path.length - 1))) return false;
      occupied.add(cell);
    }
  }
  return true;
}
export function numberlinkCovered(level: NumberlinkLevel, paths: readonly (readonly number[])[]): number {
  return new Set([...level.pairs.flat(), ...paths.flat()]).size;
}
export function numberlinkSolved(level: NumberlinkLevel, paths: readonly (readonly number[])[]): boolean {
  return numberlinkPathsValid(level, paths) && paths.every((_, pair) => pairConnected(level, paths, pair)) && numberlinkCovered(level, paths) === level.rows * level.cols - level.holes.length;
}
export function numberlinkActionValid(value: unknown, level: NumberlinkLevel): value is NumberlinkAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Record<string, unknown>;
  if (!Number.isInteger(action.pair) || (action.pair as number) < 0 || (action.pair as number) >= level.pairs.length) return false;
  if (action.kind === "clear") return true;
  return (action.kind === "start" || action.kind === "step") && Number.isInteger(action.cell) && (action.cell as number) >= 0 && (action.cell as number) < level.rows * level.cols;
}
export type NumberlinkResult = { state: NumberlinkState; error?: string };
export function playNumberlinkAction(level: NumberlinkLevel, state: NumberlinkState, action: NumberlinkAction): NumberlinkResult {
  const reject = (error: string): NumberlinkResult => ({ state, error });
  if (!numberlinkActionValid(action, level)) return reject("请选择花园中的格子。");
  if (numberlinkSolved(level, state.paths)) return reject("花园已经连好了。");
  if (state.history.length >= NUMBERLINK_HISTORY_LIMIT) return reject("操作记录已满，请撤销一步或重来。");
  const paths = state.paths.map(path => [...path]), current = paths[action.pair];
  if (action.kind === "clear") {
    if (!current.length) return reject("这条线还没有开始。");
    paths[action.pair] = [];
  } else if (action.kind === "start") {
    if (!level.pairs[action.pair].includes(action.cell)) return reject("请从相同符号的一个端点出发。");
    if (current.length === 1 && current[0] === action.cell) return reject("已选中这个端点，接着点相邻格。");
    paths[action.pair] = [action.cell];
  } else {
    if (!current.length) return reject("先点这对伙伴的一个端点。");
    const back = current.indexOf(action.cell);
    if (back >= 0) {
      if (back === current.length - 1) return reject("这是线头，请接着点相邻格。");
      paths[action.pair] = current.slice(0, back + 1);
    } else {
      if (pairConnected(level, paths, action.pair)) return reject("这条线已接通。点回线上的格子，或清除后再画。");
      if (level.holes.includes(action.cell)) return reject("石凳不能经过。");
      if (paths.some((path, pair) => pair !== action.pair && path.includes(action.cell))) return reject("这格已有另一条线。路线不能重叠或交叉。");
      const owner = endpointPair(level, action.cell);
      if (owner !== -1 && owner !== action.pair) return reject("这是另一对伙伴的端点，不能经过。");
      if (!numberlinkAdjacent(level, current[current.length - 1], action.cell)) return reject("每一步只能点线头上下左右相邻的一格。");
      paths[action.pair].push(action.cell);
    }
  }
  if (!numberlinkPathsValid(level, paths)) return reject("这一步不能形成有效路线。");
  const clean: NumberlinkAction = action.kind === "clear" ? { kind: "clear", pair: action.pair } : { kind: action.kind, pair: action.pair, cell: action.cell };
  return { state: { paths, history: [...state.history, clean] } };
}
export function replayNumberlinkActions(level: NumberlinkLevel, history: readonly unknown[]): NumberlinkState | null {
  if (history.length > NUMBERLINK_HISTORY_LIMIT) return null;
  let state = createNumberlinkState(level);
  for (const action of history) {
    if (!numberlinkActionValid(action, level)) return null;
    const next = playNumberlinkAction(level, state, action);
    if (next.error) return null;
    state = next.state;
  }
  return state;
}
export function undoNumberlinkAction(level: NumberlinkLevel, state: NumberlinkState): NumberlinkState {
  return state.history.length ? replayNumberlinkActions(level, state.history.slice(0, -1)) ?? createNumberlinkState(level) : state;
}
