/** Original 4×4 Sudoku layouts; 0 is empty. Each has exactly one solution. */
export type SudokuLevel = {
  title: string;
  givens: number[];
  solution: number[];
  hint: string;
};
export type SudokuSnapshot = { values: number[]; notes: number[][] };
export type SudokuState = SudokuSnapshot & { history: SudokuSnapshot[] };
const layouts: [number[], number[]][] = [
  [
    [1, 3, 4, 0, 2, 4, 3, 1, 0, 1, 2, 4, 4, 2, 0, 0],
    [1, 3, 4, 2, 2, 4, 3, 1, 3, 1, 2, 4, 4, 2, 1, 3],
  ],
  [
    [3, 0, 4, 1, 0, 1, 3, 0, 2, 3, 0, 4, 1, 4, 0, 3],
    [3, 2, 4, 1, 4, 1, 3, 2, 2, 3, 1, 4, 1, 4, 2, 3],
  ],
  [
    [4, 3, 0, 0, 2, 1, 3, 4, 1, 0, 4, 0, 0, 0, 2, 1],
    [4, 3, 1, 2, 2, 1, 3, 4, 1, 2, 4, 3, 3, 4, 2, 1],
  ],
  [
    [0, 3, 2, 1, 2, 0, 4, 3, 0, 0, 3, 4, 0, 4, 0, 0],
    [4, 3, 2, 1, 2, 1, 4, 3, 1, 2, 3, 4, 3, 4, 1, 2],
  ],
  [
    [0, 4, 2, 3, 0, 0, 4, 0, 0, 0, 3, 2, 0, 3, 1, 0],
    [1, 4, 2, 3, 3, 2, 4, 1, 4, 1, 3, 2, 2, 3, 1, 4],
  ],
  [
    [2, 0, 4, 0, 4, 0, 0, 1, 3, 0, 1, 0, 1, 2, 0, 0],
    [2, 1, 4, 3, 4, 3, 2, 1, 3, 4, 1, 2, 1, 2, 3, 4],
  ],
  [
    [0, 4, 3, 0, 0, 0, 4, 2, 0, 2, 0, 0, 3, 0, 0, 4],
    [2, 4, 3, 1, 1, 3, 4, 2, 4, 2, 1, 3, 3, 1, 2, 4],
  ],
  [
    [0, 0, 3, 0, 0, 4, 0, 1, 0, 3, 1, 2, 1, 0, 0, 0],
    [2, 1, 3, 4, 3, 4, 2, 1, 4, 3, 1, 2, 1, 2, 4, 3],
  ],
  [
    [0, 1, 0, 3, 3, 0, 0, 4, 0, 4, 0, 0, 2, 0, 0, 0],
    [4, 1, 2, 3, 3, 2, 1, 4, 1, 4, 3, 2, 2, 3, 4, 1],
  ],
  [
    [3, 0, 0, 0, 1, 2, 3, 0, 0, 0, 0, 0, 4, 0, 0, 1],
    [3, 4, 1, 2, 1, 2, 3, 4, 2, 1, 4, 3, 4, 3, 2, 1],
  ],
  [
    [0, 0, 0, 0, 2, 0, 3, 1, 0, 0, 0, 0, 1, 0, 0, 2],
    [3, 1, 2, 4, 2, 4, 3, 1, 4, 2, 1, 3, 1, 3, 4, 2],
  ],
  [
    [0, 0, 0, 4, 0, 1, 0, 0, 2, 0, 0, 0, 0, 0, 3, 0],
    [3, 2, 1, 4, 4, 1, 2, 3, 2, 3, 4, 1, 1, 4, 3, 2],
  ],
];
const titles = [
  "第一颗种子",
  "寻找缺席者",
  "行与列",
  "小方块的秘密",
  "交叉线索",
  "数对伙伴",
  "留下可能",
  "连锁推理",
  "六颗种子",
  "留白花园",
  "五点星光",
  "四角挑战",
];
export const sudokuLevels: SudokuLevel[] = layouts.map(
  ([givens, solution], i) => ({
    title: titles[i],
    givens,
    solution,
    hint: "每行、每列、每个粗线围成的 2×2 小方块，都要恰好有 1、2、3、4。先找缺得最少的一组。",
  }),
);
export function validSudokuValues(values: readonly number[]): boolean {
  return (
    values.length === 16 &&
    values.every((v) => Number.isInteger(v) && v >= 0 && v <= 4)
  );
}
export function sudokuPeers(index: number): number[] {
  if (!Number.isInteger(index) || index < 0 || index >= 16) return [];
  const r = Math.floor(index / 4),
    c = index % 4;
  return Array.from({ length: 16 }, (_, i) => i).filter(
    (i) =>
      i !== index &&
      (Math.floor(i / 4) === r ||
        i % 4 === c ||
        (Math.floor(i / 8) === Math.floor(r / 2) &&
          Math.floor((i % 4) / 2) === Math.floor(c / 2))),
  );
}
export function sudokuConflicts(values: readonly number[]): number[] {
  if (!validSudokuValues(values)) return values.map((_, i) => i);
  return values.flatMap((v, i) =>
    v && sudokuPeers(i).some((j) => values[j] === v) ? [i] : [],
  );
}
export function sudokuCandidates(
  values: readonly number[],
  index: number,
): number[] {
  if (
    !validSudokuValues(values) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 16 ||
    values[index]
  )
    return [];
  const taken = new Set(sudokuPeers(index).map((i) => values[i]));
  return [1, 2, 3, 4].filter((v) => !taken.has(v));
}
export function isSudokuSolved(
  level: SudokuLevel,
  values: readonly number[],
): boolean {
  return (
    validSudokuValues(values) &&
    values.every(
      (v, i) => v !== 0 && (!level.givens[i] || level.givens[i] === v),
    ) &&
    sudokuConflicts(values).length === 0
  );
}
/** Stops at `limit`, enough to prove uniqueness without doing unbounded work. */
export function solveSudoku(values: readonly number[], limit = 2): number[][] {
  if (
    !validSudokuValues(values) ||
    sudokuConflicts(values).length ||
    !Number.isInteger(limit) ||
    limit < 1
  )
    return [];
  const answers: number[][] = [],
    board = [...values];
  function search(): void {
    if (answers.length >= limit) return;
    let index = -1,
      choices: number[] = [];
    for (let i = 0; i < 16; i++)
      if (!board[i]) {
        const possible = sudokuCandidates(board, i);
        if (!possible.length) return;
        if (index === -1 || possible.length < choices.length) {
          index = i;
          choices = possible;
        }
      }
    if (index === -1) {
      answers.push([...board]);
      return;
    }
    for (const v of choices) {
      board[index] = v;
      search();
      board[index] = 0;
      if (answers.length >= limit) return;
    }
  }
  search();
  return answers;
}
export function createSudokuState(level: SudokuLevel): SudokuState {
  return {
    values: [...level.givens],
    notes: Array.from({ length: 16 }, () => []),
    history: [],
  };
}
export function sudokuInput(
  state: SudokuState,
  level: SudokuLevel,
  index: number,
  value: number,
  noteMode = false,
): SudokuState {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 16 ||
    level.givens[index] ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 4 ||
    isSudokuSolved(level, state.values)
  )
    return state;
  const values = [...state.values],
    notes = state.notes.map((ns) => [...ns]);
  if (noteMode && value !== 0) {
    if (values[index]) return state;
    notes[index] = notes[index].includes(value)
      ? notes[index].filter((v) => v !== value)
      : [...notes[index], value].sort();
  } else {
    if (values[index] === value && notes[index].length === 0) return state;
    values[index] = value;
    notes[index] = [];
  }
  return {
    values,
    notes,
    history: [...state.history, { values: state.values, notes: state.notes }],
  };
}
export function undoSudoku(state: SudokuState): SudokuState {
  const previous = state.history.at(-1);
  return previous
    ? { ...previous, history: state.history.slice(0, -1) }
    : state;
}
export function sudokuHint(
  level: SudokuLevel,
  values: readonly number[],
): { index: number; value: number; correction: boolean } | null {
  if (!validSudokuValues(values)) return null;
  const wrong = values.findIndex(
    (v, i) => v !== 0 && v !== level.solution[i] && !level.givens[i],
  );
  if (wrong >= 0)
    return { index: wrong, value: level.solution[wrong], correction: true };
  let index = values.findIndex(
    (v, i) => !v && sudokuCandidates(values, i).length === 1,
  );
  if (index < 0) index = values.indexOf(0);
  return index < 0
    ? null
    : { index, value: level.solution[index], correction: false };
}
