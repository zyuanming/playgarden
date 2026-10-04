/** Original TypeScript number-merging rules and authored seeded challenge data.
 * Familiar 2048 mechanics; no upstream code, artwork, or level data is used. */
export type MergeDirection = "up" | "right" | "down" | "left";
export type MergeLevel = {
  title: string;
  target: number;
  board: number[];
  seed: number;
  solution: MergeDirection[];
  lesson: string;
};
export type MergeSnapshot = {
  board: number[];
  seed: number;
  score: number;
  route: MergeDirection[] | null;
};
export type MergeState = MergeSnapshot & {
  target: number;
  history: MergeSnapshot[];
  spawned: number | null;
};
export type MergeHint =
  | { kind: "move"; direction: MergeDirection }
  | { kind: "undo"; steps: number }
  | { kind: "finished" };
export const mergeDirections: MergeDirection[] = [
  "up",
  "right",
  "down",
  "left",
];
export const mergeDirectionLabels: Record<MergeDirection, string> = {
  up: "向上",
  right: "向右",
  down: "向下",
  left: "向左",
};

export function validMergeBoard(board: readonly number[]): boolean {
  return (
    board.length === 16 &&
    board.every(
      (value) =>
        Number.isSafeInteger(value) &&
        (value === 0 || (value >= 2 && Math.log2(value) % 1 === 0)),
    )
  );
}
/** Compact then merge adjacent equal pairs once. A newly merged tile cannot merge again this turn. */
export function mergeLine(line: readonly number[]): {
  line: number[];
  score: number;
} {
  const compact = line.filter(Boolean),
    result: number[] = [];
  let score = 0;
  for (let i = 0; i < compact.length; i++) {
    if (compact[i] === compact[i + 1]) {
      const value = compact[i] * 2;
      result.push(value);
      score += value;
      i++;
    } else result.push(compact[i]);
  }
  while (result.length < line.length) result.push(0);
  return { line: result, score };
}
export function slideMergeBoard(
  board: readonly number[],
  direction: MergeDirection,
): { board: number[]; score: number; changed: boolean } {
  if (!validMergeBoard(board) || !mergeDirections.includes(direction))
    return { board: [...board], score: 0, changed: false };
  const next = [...board];
  let score = 0;
  for (let lane = 0; lane < 4; lane++) {
    const indices = Array.from({ length: 4 }, (_, step) =>
      direction === "left"
        ? lane * 4 + step
        : direction === "right"
          ? lane * 4 + 3 - step
          : direction === "up"
            ? step * 4 + lane
            : (3 - step) * 4 + lane,
    );
    const merged = mergeLine(indices.map((index) => board[index]));
    indices.forEach((index, step) => {
      next[index] = merged.line[step];
    });
    score += merged.score;
  }
  return {
    board: next,
    score,
    changed: next.some((value, index) => value !== board[index]),
  };
}
export function nextMergeSeed(seed: number): number {
  return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
}
export function nextMergeValue(seed: number): number {
  return (nextMergeSeed(seed) >>> 16) % 10 === 0 ? 4 : 2;
}
export function spawnMergeTile(
  board: readonly number[],
  seed: number,
): { board: number[]; seed: number; index: number | null } {
  const empty = board.flatMap((value, index) => (value === 0 ? [index] : []));
  if (!empty.length) return { board: [...board], seed, index: null };
  const nextSeed = nextMergeSeed(seed),
    index = empty[nextSeed % empty.length],
    next = [...board];
  next[index] = nextMergeValue(seed);
  return { board: next, seed: nextSeed, index };
}
export function isMergeWon(board: readonly number[], target: number): boolean {
  return board.some((value) => value >= target);
}
export function legalMergeMoves(board: readonly number[]): MergeDirection[] {
  return mergeDirections.filter(
    (direction) => slideMergeBoard(board, direction).changed,
  );
}
export function isMergeGameOver(board: readonly number[]): boolean {
  return validMergeBoard(board) && legalMergeMoves(board).length === 0;
}
export function createMergeState(level: MergeLevel): MergeState {
  return {
    board: [...level.board],
    seed: level.seed,
    score: 0,
    target: level.target,
    route: [...level.solution],
    history: [],
    spawned: null,
  };
}
export function mergeMove(
  state: MergeState,
  direction: MergeDirection,
): MergeState {
  if (isMergeWon(state.board, state.target)) return state;
  const moved = slideMergeBoard(state.board, direction);
  if (!moved.changed) return state; // No-op moves never consume the seed, create tiles, or add history.
  const spawned = spawnMergeTile(moved.board, state.seed);
  // A different direction may still arrive at the same certified successor.
  let route: MergeDirection[] | null = null;
  if (state.route?.length) {
    const expected = slideMergeBoard(state.board, state.route[0]);
    if (moved.board.every((value, index) => value === expected.board[index]))
      route = state.route.slice(1);
  }
  return {
    ...state,
    board: spawned.board,
    seed: spawned.seed,
    spawned: spawned.index,
    score: state.score + moved.score,
    route,
    history: [
      ...state.history,
      {
        board: state.board,
        seed: state.seed,
        score: state.score,
        route: state.route,
      },
    ],
  };
}
export function undoMerge(state: MergeState): MergeState {
  const previous = state.history.at(-1);
  return previous
    ? {
        ...state,
        ...previous,
        spawned: null,
        history: state.history.slice(0, -1),
      }
    : state;
}
/** Off-route merging is irreversible. Hints honestly guide undo to the last certified position rather than promising a false move. */
export function mergeHint(state: MergeState): MergeHint {
  if (isMergeWon(state.board, state.target)) return { kind: "finished" };
  if (
    state.route?.length &&
    legalMergeMoves(state.board).includes(state.route[0])
  )
    return { kind: "move", direction: state.route[0] };
  for (let i = state.history.length - 1; i >= 0; i--)
    if (state.history[i].route?.length)
      return { kind: "undo", steps: state.history.length - i };
  return { kind: "undo", steps: state.history.length };
}

/** Fixed deterministic routes are replay-certified in tests; no random solvability promises. */
export const mergeLevels: MergeLevel[] = [
  {
    title: "第一片嫩芽",
    target: 16,
    board: [4, 4, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    seed: 21,
    solution: ["left", "down"],
    lesson: "先合成两个 8，再让它们相遇。",
  },
  {
    title: "成双的叶子",
    target: 16,
    board: [4, 2, 2, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 0, 2, 0],
    seed: 23164,
    solution: ["right", "up", "right"],
    lesson: "一行里四个 2，会先变成两个 4。",
  },
  {
    title: "小径交汇",
    target: 32,
    board: [0, 0, 2, 4, 0, 4, 0, 4, 4, 0, 4, 4, 0, 2, 4, 4],
    seed: 29136,
    solution: ["left", "down", "up", "right"],
    lesson: "横着聚拢，竖着整理。留出下一次合并的空间。",
  },
  {
    title: "转角见花",
    target: 32,
    board: [0, 2, 0, 4, 4, 0, 0, 4, 2, 4, 4, 2, 4, 4, 2, 0],
    seed: 57509,
    solution: ["right", "right", "left", "up", "right"],
    lesson: "新叶会改变空格。相同方向也可能值得再走一次。",
  },
  {
    title: "六十四朵花",
    target: 64,
    board: [2, 0, 8, 2, 0, 0, 0, 8, 0, 8, 0, 0, 16, 8, 0, 16],
    seed: 20916,
    solution: ["down", "up", "left", "down", "right"],
    lesson: "把大数字放在一侧，慢慢为它准备伙伴。",
  },
  {
    title: "花园回旋",
    target: 64,
    board: [2, 0, 0, 8, 0, 0, 8, 8, 0, 0, 2, 8, 0, 16, 8, 8],
    seed: 5878,
    solution: ["right", "left", "up", "right", "down", "right"],
    lesson: "两个相同的大数字之间，不要夹进小数字。",
  },
  {
    title: "层层向上",
    target: 128,
    board: [16, 2, 0, 0, 16, 16, 0, 16, 2, 0, 0, 16, 16, 16, 0, 16],
    seed: 53020,
    solution: ["up", "right", "down", "up", "left", "up"],
    lesson: "先照顾成对的 16，再把合并链条接起来。",
  },
  {
    title: "绿叶迷宫",
    target: 128,
    board: [0, 16, 2, 16, 2, 0, 8, 0, 0, 0, 8, 16, 16, 16, 16, 16],
    seed: 27779,
    solution: ["up", "right", "up", "down", "left", "up", "up"],
    lesson: "两个 8 藏在大数字之间。给它们留一个会面的机会。",
  },
  {
    title: "繁茂的角落",
    target: 256,
    board: [2, 0, 0, 2, 0, 32, 0, 0, 64, 32, 0, 0, 32, 0, 64, 32],
    seed: 99691,
    solution: ["up", "right", "left", "down", "left", "up", "right"],
    lesson: "空间看起来宽敞，也要提前想好最后两个 128 怎样相遇。",
  },
  {
    title: "五百一十二",
    target: 512,
    board: [64, 0, 64, 64, 2, 0, 0, 128, 2, 64, 64, 0, 64, 0, 0, 0],
    seed: 67808,
    solution: ["up", "up", "down", "right", "up", "up", "left", "up"],
    lesson: "每一步都看一眼下一片叶子。固定种子让重试可以复盘。",
  },
  {
    title: "千叶之庭",
    target: 1024,
    board: [128, 128, 128, 2, 128, 128, 2, 128, 64, 0, 0, 0, 64, 0, 64, 64],
    seed: 410521871,
    solution: ["up", "right", "down", "left", "up", "right", "up"],
    lesson: "先合成四个 256，再把它们送到同一条合并路径。",
  },
  {
    title: "二〇四八花冠",
    target: 2048,
    board: [0, 256, 256, 128, 0, 256, 0, 2, 256, 256, 256, 256, 128, 0, 0, 2],
    seed: 1668,
    solution: [
      "down",
      "right",
      "up",
      "left",
      "down",
      "right",
      "up",
      "left",
      "up",
    ],
    lesson: "从预置的花园出发，完成最后一串合并。稳稳把 2048 带回家。",
  },
];
