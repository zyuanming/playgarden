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
