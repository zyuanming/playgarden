// SPDX-License-Identifier: GPL-3.0-only
// Original analytic projectile / staggered hex-grid implementation. No external game source.
import type { BubbleColor, BubbleLevel } from "./bubbleShooterLevels";
export const BUBBLE_COURT = { width: 360, height: 486, radius: 18, rowStep: Math.sqrt(3) * 18, ceiling: 32, launcherX: 180, launcherY: 440, dangerRow: 11 } as const;
export type Bubble = { row: number; col: number; color: BubbleColor };
export type BubblePoint = { x: number; y: number };
export type BubbleShot = { angle: number; color: BubbleColor; path: BubblePoint[]; landing: Bubble | null; bounces: number; removed: number; dropped: number; board: Bubble[] };
export type BubbleState = { board: Bubble[]; history: number[]; cursor: number; phase: "ready" | "won" | "lost"; last: { removed: number; dropped: number; bounces: number } | null };
const EPS = 0.00001;
export const bubbleKey = (bubble: Pick<Bubble, "row" | "col">) => `${bubble.row}:${bubble.col}`;
export const bubbleCenter = (bubble: Pick<Bubble, "row" | "col">): BubblePoint => ({ x: 18 + 36 * bubble.col + (bubble.row % 2) * 18, y: BUBBLE_COURT.ceiling + bubble.row * BUBBLE_COURT.rowStep });
export const bubbleAngle = (angle: number) => Math.round(Math.max(-74, Math.min(74, angle)) * 10) / 10;
const validCell = (row: number, col: number) => row >= 0 && row <= BUBBLE_COURT.dangerRow && col >= 0 && col < (row % 2 ? 9 : 10);
export function bubbleNeighbors(bubble: Pick<Bubble, "row" | "col">) {
  const { row, col } = bubble, shift = row % 2 ? 0 : -1;
  return [[row, col - 1], [row, col + 1], [row - 1, col + shift], [row - 1, col + shift + 1], [row + 1, col + shift], [row + 1, col + shift + 1]]
    .filter(([r, c]) => validCell(r, c)).map(([r, c]) => ({ row: r, col: c }));
}
function connected(board: readonly Bubble[], seeds: readonly Bubble[], color?: BubbleColor): Set<string> {
  const cells = new Map(board.map(bubble => [bubbleKey(bubble), bubble])), seen = new Set<string>(), todo = [...seeds];
  while (todo.length) {
    const current = todo.pop()!, key = bubbleKey(current);
    if (seen.has(key) || !cells.has(key) || (color && current.color !== color)) continue;
    seen.add(key);
    for (const neighbor of bubbleNeighbors(current)) {
      const next = cells.get(bubbleKey(neighbor));
      if (next && !seen.has(bubbleKey(next)) && (!color || next.color === color)) todo.push(next);
    }
  }
  return seen;
}
function nextCursor(level: BubbleLevel, board: readonly Bubble[], cursor: number) {
  const colors = new Set(board.map(bubble => bubble.color));
  while (cursor < level.queue.length && !colors.has(level.queue[cursor])) cursor++;
  return cursor;
}
export function createBubbleState(level: BubbleLevel): BubbleState {
  const board: Bubble[] = [];
  level.rows.forEach((line, row) => [...line].forEach((color, col) => {
    if ("RBGY".includes(color) && validCell(row, col)) board.push({ row, col, color: color as BubbleColor });
  }));
  return { board, history: [], cursor: nextCursor(level, board, 0), phase: "ready", last: null };
}
/** Continuous first-hit ray tracing; the projectile is a circle, not a grid teleport. */
export function traceBubbleShot(board: readonly Bubble[], color: BubbleColor, inputAngle: number): BubbleShot {
  const angle = bubbleAngle(inputAngle), radians = angle * Math.PI / 180;
  let direction = { x: Math.sin(radians), y: -Math.cos(radians) };
  let origin: BubblePoint = { x: BUBBLE_COURT.launcherX, y: BUBBLE_COURT.launcherY };
  const path = [origin], occupied = new Set(board.map(bubbleKey));
  let bounces = 0, landing: Bubble | null = null;
  for (let segment = 0; segment < 8; segment++) {
    const ceilingDistance = (BUBBLE_COURT.ceiling - origin.y) / direction.y;
    const wallDistance = Math.abs(direction.x) < EPS ? Infinity : ((direction.x < 0 ? 18 : 342) - origin.x) / direction.x;
    let distance = ceilingDistance, hit: Bubble | null = null, wall = false;
    if (wallDistance > EPS && wallDistance < distance) { distance = wallDistance; wall = true; }
    for (const bubble of board) {
      const center = bubbleCenter(bubble), ox = origin.x - center.x, oy = origin.y - center.y;
      const projection = ox * direction.x + oy * direction.y;
      const discriminant = projection * projection - (ox * ox + oy * oy - 36 * 36);
      if (discriminant < 0) continue;
      const contact = -projection - Math.sqrt(discriminant);
      if (contact > EPS && contact < distance) { distance = contact; hit = bubble; wall = false; }
    }
    const contact = { x: origin.x + direction.x * distance, y: origin.y + direction.y * distance };
    path.push(contact);
    if (wall) {
      bounces++;
      direction = { x: -direction.x, y: direction.y };
      origin = { x: contact.x + direction.x * EPS, y: contact.y + direction.y * EPS };
      continue;
    }
    const candidates = (hit ? bubbleNeighbors(hit) : Array.from({ length: 10 }, (_, col) => ({ row: 0, col })))
      .filter(cell => !occupied.has(bubbleKey(cell)))
      .sort((a, b) => {
        const ca = bubbleCenter(a), cb = bubbleCenter(b);
        return (ca.x - contact.x) ** 2 + (ca.y - contact.y) ** 2 - (cb.x - contact.x) ** 2 - (cb.y - contact.y) ** 2 || b.row - a.row || a.col - b.col;
      });
    if (candidates.length) { landing = { ...candidates[0], color }; path.push(bubbleCenter(landing)); }
    break;
  }
  if (!landing) return { angle, color, path, landing, bounces, removed: 0, dropped: 0, board: [...board] };
  let result = [...board, landing];
  const group = connected(result, [landing], color);
  let removed = 0, dropped = 0;
  if (group.size >= 3) {
    removed = group.size;
    result = result.filter(bubble => !group.has(bubbleKey(bubble)));
    const anchored = connected(result, result.filter(bubble => bubble.row === 0));
    dropped = result.length - anchored.size;
    result = result.filter(bubble => anchored.has(bubbleKey(bubble)));
  }
  return { angle, color, path, landing, bounces, removed, dropped, board: result };
}
export function shootBubble(level: BubbleLevel, state: BubbleState, angle: number): BubbleState {
  if (state.phase !== "ready" || !Number.isFinite(angle) || angle < -74 || angle > 74) return state;
  const color = level.queue[state.cursor];
  if (!color) return state;
  const shot = traceBubbleShot(state.board, color, angle), history = [...state.history, shot.angle];
  const cursor = nextCursor(level, shot.board, state.cursor + 1);
  const phase = !shot.board.length ? "won" : !shot.landing || shot.board.some(bubble => bubble.row >= BUBBLE_COURT.dangerRow) || cursor >= level.queue.length ? "lost" : "ready";
  return { board: shot.board, history, cursor, phase, last: { removed: shot.removed, dropped: shot.dropped, bounces: shot.bounces } };
}
export function replayBubbleShots(level: BubbleLevel, history: readonly number[]): BubbleState | null {
  if (history.length > level.queue.length) return null;
  let state = createBubbleState(level);
  for (const angle of history) {
    if (typeof angle !== "number" || !Number.isFinite(angle) || angle < -74 || angle > 74 || state.phase !== "ready") return null;
    state = shootBubble(level, state, angle);
  }
  return state;
}
/** A bounded one-shot heuristic, never a claim of a shortest or guaranteed solution. */
export function bubbleHint(level: BubbleLevel, state: BubbleState): number | null {
  if (state.phase !== "ready") return null;
  let bestAngle = 0, bestScore = -Infinity;
  for (let angle = -74; angle <= 74; angle++) {
    const shot = traceBubbleShot(state.board, level.queue[state.cursor], angle);
    if (!shot.landing) continue;
    const touching = shot.removed ? 0 : connected([...state.board, shot.landing], [shot.landing], shot.color).size - 1;
    const score = shot.removed * 12 + shot.dropped * 16 + touching * 4 - shot.landing.row * 0.08 - shot.bounces * 0.15 - Math.abs(angle) * 0.0001;
    if (score > bestScore) { bestScore = score; bestAngle = angle; }
  }
  return bestScore === -Infinity ? null : bestAngle;
}
export function bubbleQueue(level: BubbleLevel, state: BubbleState) {
  const colors = new Set(state.board.map(bubble => bubble.color));
  return level.queue.slice(state.cursor).filter(color => colors.has(color));
}
