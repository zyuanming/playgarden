/** Original picture puzzles. A line-candidate proof, rather than guessing, solves every level. */
export type NonogramCell = -1 | 0 | 1; // undecided, crossed out, painted
export type NonogramLevel = {
  title: string;
  size: number;
  picture: string[];
  solution: number[];
  rowClues: number[][];
  columnClues: number[][];
};
export type NonogramState = {
  board: NonogramCell[];
  history: NonogramCell[][];
};
export type NonogramHint = {
  index: number;
  value: NonogramCell;
  reason: string;
  kind: "deduction" | "repair";
};

export function nonogramRuns(line: readonly number[]): number[] {
  const runs: number[] = [];
  let run = 0;
  for (const value of [...line, 0]) {
    if (value === 1) run++;
    else if (run) {
      runs.push(run);
      run = 0;
    }
  }
  return runs;
}
export function makeNonogramLevel(
  title: string,
  picture: string[],
): NonogramLevel {
  const size = picture.length;
  if (
    size < 1 ||
    size > 8 ||
    picture.some((row) => row.length !== size || /[^.#]/.test(row))
  )
    throw new Error("A nonogram picture must be a square of dots and hashes.");
  const solution = picture
    .join("")
    .split("")
    .map((cell) => (cell === "#" ? 1 : 0));
  return {
    title,
    size,
    picture: [...picture],
    solution,
    rowClues: picture.map((row) =>
      nonogramRuns(row.split("").map((cell) => (cell === "#" ? 1 : 0))),
    ),
    columnClues: Array.from({ length: size }, (_, col) =>
      nonogramRuns(picture.map((row) => (row[col] === "#" ? 1 : 0))),
    ),
  };
}

export const nonogramLevels: NonogramLevel[] = [
  makeNonogramLevel("第一片嫩芽", [
    "..#..",
    "..#..",
    "#####",
    ".###.",
    "..#..",
  ]),
  makeNonogramLevel("有门的小屋", [
    "..#..",
    ".###.",
    "#####",
    "##.##",
    "#####",
  ]),
  makeNonogramLevel("午后的茶杯", [
    ".....",
    "####.",
    "#..##",
    "#..#.",
    "####.",
  ]),
  makeNonogramLevel("扬起小风帆", [
    "..#..",
    ".##..",
    ".###.",
    "#####",
    ".###.",
  ]),
  makeNonogramLevel("寄给花园的信", [
    "######",
    "##..##",
    "#.##.#",
    "#....#",
    "#....#",
    "######",
  ]),
  makeNonogramLevel("雨后小蘑菇", [
    "..##..",
    ".####.",
    "######",
    "..##..",
    "..##..",
    ".####.",
  ]),
  makeNonogramLevel("花房的钥匙", [
    ".###..",
    ".#.#..",
    ".###..",
    "..#...",
    "..###.",
    "..#...",
  ]),
  makeNonogramLevel("弯弯的郁金香", [
    ".#..#.",
    ".####.",
    "..##..",
    "..#...",
    ".##...",
    "..#...",
  ]),
  makeNonogramLevel("夜读的小灯", [
    "..###..",
    ".##.##.",
    "#######",
    "...#...",
    "...#...",
    "..###..",
    ".#####.",
  ]),
  makeNonogramLevel("松树的枝叶", [
    "...#...",
    "..###..",
    ".#.#.#.",
    "..###..",
    ".#.#.#.",
    "#######",
    "...#...",
  ]),
  makeNonogramLevel("蝴蝶停一停", [
    "##...##",
    "###.###",
    ".#####.",
    "..###..",
    ".#####.",
    "###.###",
    "##...##",
  ]),
  makeNonogramLevel("游动的小鲸鱼", [
    ".......",
    "..####.",
    ".######",
    "######.",
    "#####..",
    ".####..",
    "...##..",
  ]),
];

/** All legal arrangements for one clue, optionally respecting current pencil marks. */
export function nonogramLineOptions(
  size: number,
  clues: readonly number[],
  known?: readonly NonogramCell[],
): number[][] {
  if (
    !Number.isInteger(size) ||
    size < 1 ||
    size > 8 ||
    (known && known.length !== size) ||
    clues.some((n) => !Number.isInteger(n) || n <= 0)
  )
    return [];
  const options: number[][] = [];
  for (let mask = 0; mask < 2 ** size; mask++) {
    const line = Array.from({ length: size }, (_, i) => (mask >> i) & 1);
    if (known?.some((value, i) => value !== -1 && value !== line[i])) continue;
    const runs = nonogramRuns(line);
    if (
      runs.length === clues.length &&
      runs.every((value, i) => value === clues[i])
    )
      options.push(line);
  }
  return options;
}

/** Enumerate up to `limit` solutions from clues alone; useful as a uniqueness certificate. */
export function solveNonogram(
  level: NonogramLevel,
  board?: readonly NonogramCell[],
  limit = 2,
): number[][] {
  const { size, rowClues, columnClues } = level;
  if (
    limit < 1 ||
    (board &&
      (board.length !== size * size ||
        board.some((v) => ![-1, 0, 1].includes(v))))
  )
    return [];
  const rows = rowClues.map((clue, row) =>
    nonogramLineOptions(size, clue, board?.slice(row * size, (row + 1) * size)),
  );
  const cols = columnClues.map((clue, col) =>
    nonogramLineOptions(
      size,
      clue,
      board
        ? Array.from({ length: size }, (_, row) => board[row * size + col])
        : undefined,
    ),
  );
  const answers: number[][] = [];
  function visit(row: number, chosen: number[][], candidates: number[][][]) {
    if (answers.length >= limit) return;
    if (row === size) {
      answers.push(chosen.flat());
      return;
    }
    for (const option of rows[row]) {
      const remaining = candidates.map((list, col) =>
        list.filter((line) => line[row] === option[col]),
      );
      if (remaining.some((list) => !list.length)) continue;
      visit(row + 1, [...chosen, option], remaining);
      if (answers.length >= limit) return;
    }
  }
  visit(0, [], cols);
  return answers;
}

function lineDeduction(
  level: NonogramLevel,
  board: readonly NonogramCell[],
): NonogramHint | null {
  const { size } = level;
  let emptyHint: NonogramHint | null = null;
  for (const axis of ["row", "column"] as const) {
    for (let line = 0; line < size; line++) {
      const indices = Array.from({ length: size }, (_, i) =>
        axis === "row" ? line * size + i : i * size + line,
      );
      const clues =
        axis === "row" ? level.rowClues[line] : level.columnClues[line];
      const options = nonogramLineOptions(
        size,
        clues,
        indices.map((i) => board[i]),
      );
      if (!options.length) continue;
      for (let offset = 0; offset < size; offset++) {
        const index = indices[offset];
        if (
          board[index] !== -1 ||
          !options.every((option) => option[offset] === options[0][offset])
        )
          continue;
        const value = options[0][offset] as 0 | 1;
        const hint: NonogramHint = {
          index,
          value,
          kind: "deduction",
          reason: `第 ${line + 1} ${axis === "row" ? "行" : "列"}的线索 ${clues.join("、") || "0"}，共有 ${options.length} 种符合当前标记的放法；这一格在每一种里都${value ? "需要涂色" : "是空白"}。`,
        };
        if (value === 1) return hint;
        emptyHint ??= hint;
      }
    }
  }
  return emptyHint;
}

/** Produces an auditable sequence of forced cells. It never reads the stored picture. */
export function solveNonogramLogically(level: NonogramLevel): {
  board: NonogramCell[];
  steps: NonogramHint[];
  solved: boolean;
} {
  const board = Array<NonogramCell>(level.size ** 2).fill(-1);
  const steps: NonogramHint[] = [];
  for (let i = 0; i < board.length; i++) {
    const step = lineDeduction(level, board);
    if (!step) break;
    board[step.index] = step.value;
    steps.push(step);
  }
  return { board, steps, solved: board.every((value) => value !== -1) };
}

export function createNonogramState(level: NonogramLevel): NonogramState {
  return { board: Array<NonogramCell>(level.size ** 2).fill(-1), history: [] };
}
export function setNonogramCell(
  state: NonogramState,
  index: number,
  value: NonogramCell,
  paused = false,
): NonogramState {
  if (
    paused ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= state.board.length ||
    ![-1, 0, 1].includes(value) ||
    state.board[index] === value
  )
    return state;
  const board = [...state.board];
  board[index] = value;
  return { board, history: [...state.history, state.board] };
}
export function cycleNonogramCell(
  state: NonogramState,
  index: number,
  paused = false,
): NonogramState {
  return setNonogramCell(
    state,
    index,
    state.board[index] === -1 ? 1 : state.board[index] === 1 ? 0 : -1,
    paused,
  );
}
export function undoNonogram(state: NonogramState): NonogramState {
  const previous = state.history.at(-1);
  return previous
    ? { board: previous, history: state.history.slice(0, -1) }
    : state;
}
export function nonogramSolved(
  level: NonogramLevel,
  board: readonly NonogramCell[],
): boolean {
  return (
    board.length === level.solution.length &&
    board.every(
      (value, i) =>
        [-1, 0, 1].includes(value) &&
        (value === 1) === (level.solution[i] === 1),
    )
  );
}
export function getNonogramHint(
  level: NonogramLevel,
  board: readonly NonogramCell[],
): NonogramHint | null {
  if (board.length !== level.size ** 2 || nonogramSolved(level, board))
    return null;
  // Since each puzzle has a certified unique solution, this identifies an actual contradictory mark.
  // Ask to clear it, then resume clue deductions; never silently replace the player's work.
  const conflict = board.findIndex(
    (value, i) => value !== -1 && value !== level.solution[i],
  );
  if (conflict !== -1)
    return {
      index: conflict,
      value: -1,
      kind: "repair",
      reason:
        "当前标记无法同时满足全部行列线索。先清空这一格，再根据线索继续推理；其他格子会保留。",
    };
  return lineDeduction(level, board);
}
export function nonogramLineComplete(
  clues: readonly number[],
  line: readonly NonogramCell[],
): boolean {
  const runs = nonogramRuns(line);
  return (
    runs.length === clues.length && runs.every((run, i) => run === clues[i])
  );
}
