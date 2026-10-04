import type { Point } from "../lib/types";
export type Mirror = Point & { slash: boolean };
export type LightLevel = {
  size: number;
  start: Point;
  direction: number;
  target: Point;
  mirrors: Mirror[];
  solution: boolean[];
  hint: string;
};
export const lightLevels: LightLevel[] = [
  {
    size: 5,
    start: { x: 0, y: 2 },
    direction: 0,
    target: { x: 2, y: 0 },
    mirrors: [{ x: 2, y: 2, slash: false }],
    solution: [true],
    hint: "向右走的光遇到 / 镜子，就会向上转弯。",
  },
  {
    size: 5,
    start: { x: 0, y: 3 },
    direction: 0,
    target: { x: 4, y: 1 },
    mirrors: [
      { x: 2, y: 3, slash: false },
      { x: 2, y: 1, slash: true },
    ],
    solution: [true, true],
    hint: "先让光向上，再让它向右：两面镜子都可以使用 /。",
  },
  {
    size: 6,
    start: { x: 0, y: 4 },
    direction: 0,
    target: { x: 5, y: 1 },
    mirrors: [
      { x: 2, y: 4, slash: false },
      { x: 2, y: 2, slash: true },
      { x: 4, y: 2, slash: false },
      { x: 4, y: 1, slash: false },
    ],
    solution: [true, true, true, true],
    hint: "沿着四个转角追踪光线。每面 / 镜子都能把这条路径接起来。",
  },
];
const directions = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
export function traceLight(level: LightLevel, mirrors: Mirror[]) {
  let { x, y } = level.start;
  let d = level.direction;
  const path: Point[] = [{ x, y }],
    seen = new Set<string>();
  let won = false;
  for (let n = 0; n < level.size * level.size * 4; n++) {
    const key = `${x},${y},${d}`;
    if (seen.has(key)) break;
    seen.add(key);
    const m = mirrors.find((m) => m.x === x && m.y === y);
    if (m) d = m.slash ? [3, 2, 1, 0][d] : [1, 0, 3, 2][d];
    x += directions[d][0];
    y += directions[d][1];
    if (x < 0 || y < 0 || x >= level.size || y >= level.size) break;
    path.push({ x, y });
    if (x === level.target.x && y === level.target.y) {
      won = true;
      break;
    }
  }
  return { path, won };
}
