import type { Point } from "../lib/types";
export type Command = "forward" | "left" | "right";
export const commandLabels: Record<Command, string> = {
  forward: "前进",
  left: "左转",
  right: "右转",
};
export type RobotLevel = {
  size: number;
  start: Point;
  direction: number;
  goal: Point;
  walls: Point[];
  solution: Command[];
  repeat: number;
  hint: string;
};
export const robotLevels: RobotLevel[] = [
  {
    size: 5,
    start: { x: 0, y: 2 },
    direction: 0,
    goal: { x: 4, y: 2 },
    walls: [
      { x: 2, y: 1 },
      { x: 2, y: 3 },
    ],
    solution: ["forward"],
    repeat: 4,
    hint: "试试只放一个“前进”，再重复 4 次。",
  },
  {
    size: 5,
    start: { x: 0, y: 4 },
    direction: 0,
    goal: { x: 4, y: 0 },
    walls: [
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      { x: 1, y: 0 },
    ],
    solution: ["forward", "left", "forward", "right"],
    repeat: 4,
    hint: "每次前进、左转、前进、右转，就能沿阶梯走两步。重复 4 次。",
  },
  {
    size: 5,
    start: { x: 0, y: 4 },
    direction: 0,
    goal: { x: 4, y: 0 },
    walls: [
      { x: 2, y: 4 },
      { x: 2, y: 3 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ],
    solution: [
      "forward",
      "left",
      "forward",
      "forward",
      "forward",
      "forward",
      "right",
      "forward",
      "forward",
      "forward",
    ],
    repeat: 1,
    hint: "先前进一步，左转走到最上面，再右转前进三步。",
  },
];
export type RobotState = Point & { direction: number; crashed: boolean };
export function runProgram(
  level: RobotLevel,
  commands: Command[],
  repeat: number,
) {
  let s: RobotState = {
    ...level.start,
    direction: level.direction,
    crashed: false,
  };
  const frames = [s];
  const dirs = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  for (let r = 0; r < repeat; r++)
    for (const c of commands) {
      if (c === "left") s = { ...s, direction: (s.direction + 3) % 4 };
      else if (c === "right") s = { ...s, direction: (s.direction + 1) % 4 };
      else {
        const x = s.x + dirs[s.direction][0],
          y = s.y + dirs[s.direction][1];
        if (
          x < 0 ||
          y < 0 ||
          x >= level.size ||
          y >= level.size ||
          level.walls.some((w) => w.x === x && w.y === y)
        ) {
          frames.push({ ...s, crashed: true });
          return { frames, won: false };
        }
        s = { ...s, x, y };
      }
      frames.push(s);
    }
  return { frames, won: s.x === level.goal.x && s.y === level.goal.y };
}

// Route programs are authored first; walls are placed away from the full solution path.
const extraRobotPrograms: {
  size: number;
  start: Point;
  solution: Command[];
  repeat: number;
  hint: string;
}[] = [
  {
    size: 5,
    start: { x: 0, y: 4 },
    solution: ["forward", "forward", "left", "forward", "right"],
    repeat: 2,
    hint: "一个循环向右走两步，再向上走一步。重复两次。",
  },
  {
    size: 5,
    start: { x: 0, y: 4 },
    solution: ["forward", "left", "forward", "forward", "right"],
    repeat: 2,
    hint: "一个循环向右一步、向上两步。注意转回原来的方向。",
  },
  {
    size: 6,
    start: { x: 0, y: 5 },
    solution: ["forward", "left", "forward", "right"],
    repeat: 4,
    hint: "用四次同样的小阶梯接近旗帜。每次循环结束时保持向右。",
  },
  {
    size: 6,
    start: { x: 0, y: 5 },
    solution: ["forward", "forward", "left", "forward", "forward", "right"],
    repeat: 2,
    hint: "把两格宽、两格高的阶梯看作一个小程序。",
  },
  {
    size: 6,
    start: { x: 0, y: 0 },
    solution: ["forward", "right", "forward", "left"],
    repeat: 4,
    hint: "这次阶梯朝下延伸。把左转和右转的顺序交换一下。",
  },
  {
    size: 7,
    start: { x: 0, y: 6 },
    solution: ["forward", "forward", "left", "forward", "right"],
    repeat: 3,
    hint: "同一段“右两格、上一格”的路线要重复三次。",
  },
  {
    size: 7,
    start: { x: 0, y: 6 },
    solution: ["forward", "left", "forward", "forward", "right"],
    repeat: 3,
    hint: "需要三段“右一格、上两格”。每段最后恢复向右。",
  },
  {
    size: 7,
    start: { x: 0, y: 0 },
    solution: ["forward", "forward", "right", "forward", "forward", "left"],
    repeat: 3,
    hint: "一次循环走一个大阶梯：右两格、下两格。",
  },
  {
    size: 7,
    start: { x: 0, y: 6 },
    solution: [
      "forward",
      "forward",
      "forward",
      "left",
      "forward",
      "forward",
      "forward",
      "right",
    ],
    repeat: 2,
    hint: "把大路线分成两个相同的三格阶梯，用循环缩短程序。",
  },
];
extraRobotPrograms.forEach((p, index) => {
  const seed: RobotLevel = {
    ...p,
    direction: 0,
    goal: { x: -1, y: -1 },
    walls: [],
  };
  const trace = runProgram(seed, p.solution, p.repeat);
  const end = trace.frames.at(-1)!;
  const occupied = new Set(trace.frames.map((f) => `${f.x},${f.y}`));
  const walls: Point[] = [];
  for (let y = 0; y < p.size; y++)
    for (let x = 0; x < p.size; x++)
      if (!occupied.has(`${x},${y}`) && (x * 7 + y * 3 + index) % 5 === 0)
        walls.push({ x, y });
  robotLevels.push({ ...seed, goal: { x: end.x, y: end.y }, walls });
});
