// SPDX-License-Identifier: GPL-3.0-only
export type GolfPoint = { x: number; y: number };
export type GolfWall = { x: number; y: number; width: number; height: number };
export type MiniGolfLevel = {
  title: string;
  lesson: string;
  start: GolfPoint;
  hole: GolfPoint;
  walls: GolfWall[];
  par: number;
};
export const miniGolfLevels: MiniGolfLevel[] = [
  {
    title: "第一杆青草",
    lesson: "先试一条直线。力度越大，球在草地上滚得越远。",
    start: { x: 70, y: 210 },
    hole: { x: 385, y: 210 },
    walls: [],
    par: 1,
  },
  {
    title: "斜向小径",
    lesson: "角度以向右为零，正角度顺时针。先看球与洞口的相对位置。",
    start: { x: 65, y: 265 },
    hole: { x: 405, y: 75 },
    walls: [{ x: 205, y: 205, width: 65, height: 70 }],
    par: 1,
  },
  {
    title: "借过南墙",
    lesson: "中间花坛挡住直线，可以借下方边墙反弹，也可以分几杆绕过。",
    start: { x: 70, y: 260 },
    hole: { x: 390, y: 260 },
    walls: [{ x: 215, y: 90, width: 50, height: 185 }],
    par: 1,
  },
  {
    title: "拐角练习",
    lesson: "不用急着一杆进洞。先把球送到花坛下方的安全位置，再调整下一杆。",
    start: { x: 65, y: 80 },
    hole: { x: 405, y: 245 },
    walls: [{ x: 170, y: 25, width: 45, height: 185 }],
    par: 2,
  },
  {
    title: "两座花岛",
    lesson: "两座花坛之间留着宽敞通道。看清每次停球的位置，再决定下一杆。",
    start: { x: 60, y: 260 },
    hole: { x: 415, y: 60 },
    walls: [
      { x: 155, y: 35, width: 55, height: 155 },
      { x: 280, y: 140, width: 55, height: 140 },
    ],
    par: 3,
  },
  {
    title: "回廊果岭",
    lesson: "四周与花坛都会反弹，草地则持续减速。轻杆适合调整最后的小距离。",
    start: { x: 70, y: 75 },
    hole: { x: 395, y: 80 },
    walls: [
      { x: 150, y: 20, width: 45, height: 195 },
      { x: 300, y: 110, width: 45, height: 185 },
    ],
    par: 3,
  },
  {
    title: "窄口穿行",
    lesson: "中间缺口比球宽。对齐缺口后，可以用接下来的球杆走向洞口。",
    start: { x: 60, y: 80 },
    hole: { x: 420, y: 260 },
    walls: [
      { x: 215, y: 10, width: 50, height: 118 },
      { x: 215, y: 185, width: 50, height: 125 },
    ],
    par: 2,
  },
  {
    title: "花园回弹赛",
    lesson:
      "正前方有花坛，下方保留一条反弹通道。观察角度与力度如何一起改变落点。",
    start: { x: 70, y: 260 },
    hole: { x: 390, y: 260 },
    walls: [
      { x: 210, y: 80, width: 60, height: 195 },
      { x: 40, y: 90, width: 100, height: 65 },
      { x: 340, y: 30, width: 80, height: 100 },
    ],
    par: 2,
  },
];
export type GolfShot = { points: GolfPoint[]; end: GolfPoint; won: boolean };
export function simulateGolf(
  level: MiniGolfLevel,
  start: GolfPoint,
  angle: number,
  power: number,
): GolfShot {
  if (!Number.isFinite(angle) || !Number.isFinite(power))
    return { points: [start], end: start, won: false };
  const theta = (angle * Math.PI) / 180,
    speed = 4 * Math.max(15, Math.min(100, power)),
    dt = 1 / 60,
    r = 6;
  let x = start.x,
    y = start.y,
    vx = Math.cos(theta) * speed,
    vy = Math.sin(theta) * speed;
  const points: GolfPoint[] = [{ x, y }];
  for (let n = 0; n < 480; n++) {
    const oldX = x,
      oldY = y;
    x += vx * dt;
    y += vy * dt;
    if (x < r) {
      x = 2 * r - x;
      vx = Math.abs(vx) * 0.88;
    } else if (x > 480 - r) {
      x = 2 * (480 - r) - x;
      vx = -Math.abs(vx) * 0.88;
    }
    if (y < r) {
      y = 2 * r - y;
      vy = Math.abs(vy) * 0.88;
    } else if (y > 320 - r) {
      y = 2 * (320 - r) - y;
      vy = -Math.abs(vy) * 0.88;
    }
    for (const w of level.walls) {
      const left = w.x - r,
        right = w.x + w.width + r,
        top = w.y - r,
        bottom = w.y + w.height + r;
      if (x <= left || x >= right || y <= top || y >= bottom) continue;
      if (oldX <= left) {
        x = left;
        vx = -Math.abs(vx) * 0.88;
      } else if (oldX >= right) {
        x = right;
        vx = Math.abs(vx) * 0.88;
      } else if (oldY <= top) {
        y = top;
        vy = -Math.abs(vy) * 0.88;
      } else if (oldY >= bottom) {
        y = bottom;
        vy = Math.abs(vy) * 0.88;
      } else {
        const distances = [
            Math.abs(x - left),
            Math.abs(x - right),
            Math.abs(y - top),
            Math.abs(y - bottom),
          ],
          side = distances.indexOf(Math.min(...distances));
        if (side < 2) {
          x = side === 0 ? left : right;
          vx = (side === 0 ? -1 : 1) * Math.abs(vx) * 0.88;
        } else {
          y = side === 2 ? top : bottom;
          vy = (side === 2 ? -1 : 1) * Math.abs(vy) * 0.88;
        }
      }
    }
    if (Math.hypot(x - level.hole.x, y - level.hole.y) <= 12) {
      points.push({ ...level.hole });
      return { points, end: { ...level.hole }, won: true };
    }
    points.push({ x, y });
    const v = Math.hypot(vx, vy);
    if (v <= 2) break;
    const scale = Math.max(0, v - 90 * dt) / v;
    vx *= scale;
    vy *= scale;
  }
  return { points, end: { x, y }, won: false };
}
export function miniGolfHint(level: MiniGolfLevel, start: GolfPoint) {
  const direct =
      (Math.atan2(level.hole.y - start.y, level.hole.x - start.x) * 180) /
      Math.PI,
    basePower = Math.max(
      15,
      Math.min(
        100,
        Math.round(
          Math.sqrt(
            180 * Math.hypot(level.hole.x - start.x, level.hole.y - start.y),
          ) / 4,
        ),
      ),
    );
  let best: {
    angle: number;
    power: number;
    shot: GolfShot;
    distance: number;
  } | null = null;
  const angles = [
      0,
      ...Array.from({ length: 36 }, (_, i) => (i + 1) * 5).flatMap((a) => [
        a,
        -a,
      ]),
    ],
    powers = [basePower, ...Array.from({ length: 18 }, (_, i) => 15 + i * 5)];
  for (const delta of angles)
    for (const power of powers) {
      const angle = Math.round(((direct + delta + 540) % 360) - 180),
        shot = simulateGolf(level, start, angle, power),
        distance = Math.hypot(
          shot.end.x - level.hole.x,
          shot.end.y - level.hole.y,
        );
      if (shot.won) return { angle, power, shot, exact: true };
      if (!best || distance < best.distance)
        best = { angle, power, shot, distance };
    }
  return best
    ? { angle: best.angle, power: best.power, shot: best.shot, exact: false }
    : null;
}
