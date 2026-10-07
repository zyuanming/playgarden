// SPDX-License-Identifier: MIT
// Adapted from Patrick Gillespie, JavaScript-Snake, src/js/snake.js:
// setDirection, go and eatFood at 7c80eddde2de6af669e6ae5133ba8ae60a8d7fb9.
// See LICENSE.txt. DOM-linked blocks become immutable cell IDs. Tail vacancy
// remains legal; growth retains the tail. Bounded direction queue validates
// each queued turn, replacing the upstream premove overwrite behavior.
export const SIZE = 16;
export type Direction = 0 | 1 | 2 | 3; // up, right, down, left (upstream encoding)
export type SnakeState = {
  body: number[];
  direction: Direction;
  queue: Direction[];
  food: number | null;
  seed: number;
  score: number;
  phase: "ready" | "playing" | "dead" | "won";
  reason?: "wall" | "body";
};
const rows = [-1, 0, 1, 0],
  cols = [0, 1, 0, -1];
export function spawnFood(
  body: number[],
  seed: number,
): { food: number | null; seed: number } {
  const occupied = new Set(body);
  const free = Array.from({ length: SIZE * SIZE }, (_, i) => i).filter(
    (i) => !occupied.has(i),
  );
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return { food: free.length ? free[next % free.length] : null, seed: next };
}
export function createSnake(seed: number): SnakeState {
  return {
    body: [133, 132, 131, 130],
    direction: 1,
    queue: [],
    food: 137,
    seed: seed >>> 0,
    score: 0,
    phase: "ready",
  };
}
export function turnSnake(s: SnakeState, d: Direction): SnakeState {
  if (
    s.phase !== "playing" ||
    !Number.isInteger(d) ||
    d < 0 ||
    d > 3 ||
    s.queue.length >= 2
  )
    return s;
  const previous = s.queue.at(-1) ?? s.direction;
  if (d === previous || Math.abs(d - previous) === 2) return s;
  return { ...s, queue: [...s.queue, d] };
}
export function startSnake(s: SnakeState): SnakeState {
  return s.phase === "ready" ? { ...s, phase: "playing" } : s;
}
export function stepSnake(s: SnakeState): SnakeState {
  if (s.phase !== "playing") return s;
  const direction = s.queue[0] ?? s.direction,
    queue = s.queue.slice(1),
    head = s.body[0];
  const row = Math.floor(head / SIZE) + rows[direction],
    col = (head % SIZE) + cols[direction];
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE)
    return { ...s, direction, queue: [], phase: "dead", reason: "wall" };
  const next = row * SIZE + col,
    eating = next === s.food;
  // The upstream linked-tail movement clears the tail cell before collision
  // lookup. Preserve that rule unless food growth keeps the tail occupied.
  const occupied = eating ? s.body : s.body.slice(0, -1);
  if (occupied.includes(next))
    return { ...s, direction, queue: [], phase: "dead", reason: "body" };
  const body = [next, ...s.body];
  if (!eating) body.pop();
  const fruit = eating
    ? spawnFood(body, s.seed)
    : { food: s.food, seed: s.seed };
  return {
    ...s,
    ...fruit,
    body,
    direction,
    queue,
    score: s.score + (eating ? 1 : 0),
    phase: fruit.food === null ? "won" : "playing",
  };
}
export function snakeInterval(score: number) {
  return Math.max(130, 250 - Math.floor(score / 4) * 12);
}
export function parseSnake(raw: string | null): SnakeState | null {
  try {
    const v = JSON.parse(raw ?? "null");
    if (v?.version !== 1) return null;
    const s = v.state;
    if (
      !s ||
      !Array.isArray(s.body) ||
      s.body.length < 4 ||
      s.body.length > 256 ||
      new Set(s.body).size !== s.body.length
    )
      return null;
    if (
      !s.body.every(
        (n: unknown) =>
          Number.isInteger(n) && Number(n) >= 0 && Number(n) < 256,
      )
    )
      return null;
    for (let i = 1; i < s.body.length; i++) {
      const a = s.body[i - 1],
        b = s.body[i];
      if (
        Math.abs((a % SIZE) - (b % SIZE)) +
          Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)) !==
        1
      )
        return null;
    }
    if (
      !Number.isInteger(s.direction) ||
      s.direction < 0 ||
      s.direction > 3 ||
      !Number.isInteger(s.seed) ||
      s.seed < 0 ||
      s.seed > 0xffffffff ||
      s.score !== s.body.length - 4
    )
      return null;
    if (!["ready", "playing", "dead", "won"].includes(s.phase)) return null;
    if (s.phase === "won") {
      if (s.body.length !== 256 || s.food !== null) return null;
    } else if (
      !Number.isInteger(s.food) ||
      s.food < 0 ||
      s.food >= 256 ||
      s.body.includes(s.food)
    )
      return null;
    return { ...s, body: [...s.body], queue: [] } as SnakeState;
  } catch {
    return null;
  }
}
export function serializeSnake(s: SnakeState) {
  return JSON.stringify({ version: 1, state: { ...s, queue: [] } });
}
