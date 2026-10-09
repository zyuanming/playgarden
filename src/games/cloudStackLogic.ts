// SPDX-License-Identifier: GPL-3.0-only
export type StackFloor = { x: number; width: number };
export const cloudStackLevels = [
  {
    title: "第一座小楼",
    target: 4,
    width: 190,
    speed: 75,
    lesson: "等移动的砖块与下方砖块重合，再轻轻放下。",
  },
  {
    title: "六层晨光",
    target: 6,
    width: 190,
    speed: 85,
    lesson: "伸出边缘的部分会被切掉。对齐越好，下一层越宽。",
  },
  {
    title: "窄一点的地基",
    target: 6,
    width: 155,
    speed: 90,
    lesson: "地基变窄了。看移动砖块的两条边，不只看它的中心。",
  },
  {
    title: "八层云影",
    target: 8,
    width: 185,
    speed: 100,
    lesson: "连续几次偏差会累积。留够宽度，才能继续往上建。",
  },
  {
    title: "交替归来",
    target: 9,
    width: 175,
    speed: 110,
    lesson: "新砖块交替从左右进入。先判断它正在往哪边走。",
  },
  {
    title: "薄云十层",
    target: 10,
    width: 165,
    speed: 115,
    lesson: "高楼需要耐心。提示只说明当前对齐位置，不会替你停下。",
  },
  {
    title: "轻快的屋顶",
    target: 10,
    width: 180,
    speed: 140,
    lesson: "移动更快了。准备好，在砖块经过支撑区时放下。",
  },
  {
    title: "十二层晴空",
    target: 12,
    width: 175,
    speed: 145,
    lesson: "十二次真实落点。至少留下八个单位宽度，楼层才能站稳。",
  },
];
export function stackOverlap(
  base: StackFloor,
  moving: StackFloor,
): StackFloor | null {
  const x = Math.max(base.x, moving.x),
    right = Math.min(base.x + base.width, moving.x + moving.width);
  return right - x >= 8 ? { x, width: right - x } : null;
}
export function stackMotion(
  x: number,
  direction: number,
  width: number,
  speed: number,
  dt: number,
) {
  let next = x + direction * speed * Math.min(Math.max(dt, 0), 0.05),
    dir = direction;
  const edge = 360 - width;
  if (next > edge) {
    next = 2 * edge - next;
    dir = -1;
  }
  if (next < 0) {
    next = -next;
    dir = 1;
  }
  return { x: Math.max(0, Math.min(edge, next)), direction: dir };
}
