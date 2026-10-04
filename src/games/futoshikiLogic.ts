/** Original Latin/inequality puzzles. No sub-box rules, network data, or imported levels. */
export type Inequality = { less: number; greater: number };
export type FutoshikiLevel = {
  title: string;
  size: number;
  givens: number[];
  inequalities: Inequality[];
  solution: number[];
};
export type ConstraintSnapshot = { values: number[]; notes: number[][] };
export type ConstraintState = ConstraintSnapshot & {
  history: ConstraintSnapshot[];
};
export type ConstraintHint = {
  kind: "deduction" | "correction";
  index: number;
  value: number;
  reason: string;
};
export type ConstraintSearch = {
  solutions: number[][];
  nodes: number;
  status: "complete" | "limit" | "budget" | "invalid";
};
export const CONSTRAINT_NODE_LIMIT = 50000;
export function validLatinValues(
  size: number,
  values: readonly number[],
): boolean {
  return (
    Number.isInteger(size) &&
    size >= 3 &&
    size <= 5 &&
    Array.isArray(values) &&
    values.length === size * size &&
    values.every((v) => Number.isInteger(v) && v >= 0 && v <= size)
  );
}
export function latinConflicts(
  size: number,
  values: readonly number[],
): number[] {
  if (!validLatinValues(size, values))
    return Array.from(
      { length: size >= 3 && size <= 5 ? size * size : 0 },
      (_, i) => i,
    );
  return values.flatMap((v, i) =>
    v &&
    values.some(
      (other, j) =>
        i !== j &&
        v === other &&
        (Math.floor(i / size) === Math.floor(j / size) ||
          i % size === j % size),
    )
      ? [i]
      : [],
  );
}
export function validInequalities(
  size: number,
  inequalities: readonly Inequality[],
): boolean {
  const seen = new Set<string>();
  return (
    Number.isInteger(size) &&
    size >= 3 &&
    size <= 5 &&
    Array.isArray(inequalities) &&
    inequalities.length <= 2 * size * (size - 1) &&
    inequalities.every((edge) => {
      if (!edge || typeof edge !== "object") return false;
      const { less, greater } = edge;
      if (
        ![less, greater].every(
          (i) => Number.isInteger(i) && i >= 0 && i < size * size,
        ) ||
        Math.abs(Math.floor(less / size) - Math.floor(greater / size)) +
          Math.abs((less % size) - (greater % size)) !==
          1
      )
        return false;
      const key = [less, greater].sort((a, b) => a - b).join(":");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  );
}
export function validFutoshikiLevel(level: FutoshikiLevel): boolean {
  return (
    !!level &&
    validLatinValues(level.size, level.givens) &&
    validInequalities(level.size, level.inequalities)
  );
}
export function futoshikiConflicts(
  level: FutoshikiLevel,
  values: readonly number[],
): number[] {
  if (!validFutoshikiLevel(level) || !validLatinValues(level.size, values))
    return Array.from(
      {
        length:
          Number.isInteger(level.size) && level.size >= 3 && level.size <= 5
            ? level.size * level.size
            : 0,
      },
      (_, i) => i,
    );
  const conflicts = new Set(latinConflicts(level.size, values));
  values.forEach((v, i) => {
    if (level.givens[i] && v !== level.givens[i]) conflicts.add(i);
  });
  level.inequalities.forEach(({ less, greater }) => {
    if (values[less] && values[greater] && values[less] >= values[greater]) {
      conflicts.add(less);
      conflicts.add(greater);
    }
  });
  return [...conflicts].sort((a, b) => a - b);
}
export function isFutoshikiSolved(
  level: FutoshikiLevel,
  values: readonly number[],
): boolean {
  return (
    validFutoshikiLevel(level) &&
    validLatinValues(level.size, values) &&
    values.every(Boolean) &&
    futoshikiConflicts(level, values).length === 0
  );
}
/** Shared bounded CSP engine; line domains come solely from public clues, never solutions. */
export function searchLatinDomains(
  size: number,
  rowOptions: number[][][],
  columnOptions: number[][][],
  inequalities: readonly Inequality[],
  limit = 2,
  nodeLimit = CONSTRAINT_NODE_LIMIT,
): ConstraintSearch {
  const result: ConstraintSearch = {
    solutions: [],
    nodes: 0,
    status: "complete",
  };
  // Recursive calls can change this property; keep the check outside flow narrowing.
  const reachedBudget = () => result.status === "budget";
  if (
    !Number.isInteger(size) ||
    size < 3 ||
    size > 5 ||
    !validInequalities(size, inequalities) ||
    ![rowOptions, columnOptions].every(
      (lines) =>
        Array.isArray(lines) &&
        lines.length === size &&
        lines.every(
          (domain) =>
            Array.isArray(domain) &&
            domain.length <= 120 &&
            domain.every(
              (line) =>
                Array.isArray(line) &&
                line.length === size &&
                line.every((v) => Number.isInteger(v) && v >= 1 && v <= size) &&
                new Set(line).size === size,
            ),
        ),
    ) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    !Number.isInteger(nodeLimit) ||
    nodeLimit < 1 ||
    nodeLimit > CONSTRAINT_NODE_LIMIT
  )
    return { ...result, status: "invalid" };
  function search(rows: number[][][], columns: number[][][]): void {
    if (result.solutions.length >= limit || reachedBudget()) return;
    if (result.nodes >= nodeLimit) {
      result.status = "budget";
      return;
    }
    result.nodes++;
    let changed = true;
    while (changed) {
      changed = false;
      if ([...rows, ...columns].some((domain) => !domain.length)) return;
      const possible = Array.from({ length: size * size }, (_, i) => {
        const r = Math.floor(i / size),
          c = i % size;
        const column = new Set(columns[c].map((p) => p[r]));
        return new Set(rows[r].map((p) => p[c]).filter((v) => column.has(v)));
      });
      for (const { less, greater } of inequalities) {
        const a = possible[less],
          b = possible[greater];
        possible[less] = new Set(
          [...a].filter((x) => [...b].some((y) => x < y)),
        );
        possible[greater] = new Set(
          [...b].filter((y) => [...a].some((x) => x < y)),
        );
      }
      if (possible.some((domain) => !domain.size)) return;
      rows = rows.map((domain, r) => {
        const next = domain.filter(
          (p) =>
            p.every((v, c) => possible[r * size + c].has(v)) &&
            inequalities.every(
              ({ less, greater }) =>
                Math.floor(less / size) !== r ||
                Math.floor(greater / size) !== r ||
                p[less % size] < p[greater % size],
            ),
        );
        changed ||= next.length !== domain.length;
        return next;
      });
      columns = columns.map((domain, c) => {
        const next = domain.filter(
          (p) =>
            p.every((v, r) => possible[r * size + c].has(v)) &&
            inequalities.every(
              ({ less, greater }) =>
                less % size !== c ||
                greater % size !== c ||
                p[Math.floor(less / size)] < p[Math.floor(greater / size)],
            ),
        );
        changed ||= next.length !== domain.length;
        return next;
      });
    }
    const domains = [...rows, ...columns];
    if (domains.some((domain) => !domain.length)) return;
    let selected = -1;
    domains.forEach((domain, i) => {
      if (
        domain.length > 1 &&
        (selected < 0 || domain.length < domains[selected].length)
      )
        selected = i;
    });
    if (selected < 0) {
      result.solutions.push(rows.flatMap((domain) => domain[0]));
      return;
    }
    for (const option of domains[selected]) {
      if (result.solutions.length >= limit || reachedBudget()) break;
      const nextRows = rows.map((domain) => domain.slice()),
        nextColumns = columns.map((domain) => domain.slice());
      if (selected < size) nextRows[selected] = [option];
      else nextColumns[selected - size] = [option];
      search(nextRows, nextColumns);
    }
  }
  search(rowOptions, columnOptions);
  if (!reachedBudget() && result.solutions.length >= limit)
    result.status = "limit";
  return result;
}
/** At most 120 permutations for the supported 3–5 sizes. Returned arrays are fresh. */
export function latinPermutations(size: number): number[][] {
  if (!Number.isInteger(size) || size < 3 || size > 5) return [];
  const output: number[][] = [];
  function visit(line: number[]) {
    if (line.length === size) {
      output.push(line);
      return;
    }
    for (let value = 1; value <= size; value++)
      if (!line.includes(value)) visit([...line, value]);
  }
  visit([]);
  return output;
}
export function latinLineDomains(
  size: number,
  values: readonly number[],
): { rows: number[][][]; columns: number[][][] } {
  if (!validLatinValues(size, values)) return { rows: [], columns: [] };
  const permutations = latinPermutations(size);
  return {
    rows: Array.from({ length: size }, (_, r) =>
      permutations.filter((p) =>
        p.every((v, c) => !values[r * size + c] || values[r * size + c] === v),
      ),
    ),
    columns: Array.from({ length: size }, (_, c) =>
      permutations.filter((p) =>
        p.every((v, r) => !values[r * size + c] || values[r * size + c] === v),
      ),
    ),
  };
}
export function solveFutoshiki(
  level: FutoshikiLevel,
  values: readonly number[] = level.givens,
  limit = 2,
  nodeLimit = CONSTRAINT_NODE_LIMIT,
): ConstraintSearch {
  if (
    !validFutoshikiLevel(level) ||
    !validLatinValues(level.size, values) ||
    futoshikiConflicts(level, values).length
  )
    return { solutions: [], nodes: 0, status: "invalid" };
  const { rows, columns } = latinLineDomains(level.size, values);
  return searchLatinDomains(
    level.size,
    rows,
    columns,
    level.inequalities,
    limit,
    nodeLimit,
  );
}
export function futoshikiCandidates(
  level: FutoshikiLevel,
  values: readonly number[],
  index: number,
): number[] {
  if (
    !validFutoshikiLevel(level) ||
    !validLatinValues(level.size, values) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= values.length ||
    values[index]
  )
    return [];
  return Array.from({ length: level.size }, (_, i) => i + 1).filter((value) => {
    const board = [...values];
    board[index] = value;
    return solveFutoshiki(level, board, 1).solutions.length > 0;
  });
}
export function constraintHint(
  givens: readonly number[],
  values: readonly number[],
  solve: (values: readonly number[]) => ConstraintSearch,
  reason: string,
): ConstraintHint | null {
  const current = solve(values);
  if (current.status === "budget") return null;
  if (!current.solutions.length) {
    const baseline = solve(givens);
    if (baseline.status !== "complete" || baseline.solutions.length !== 1)
      return null;
    const index = values.findIndex(
      (v, i) => !givens[i] && v !== 0 && v !== baseline.solutions[0][i],
    );
    return index < 0
      ? null
      : {
          kind: "correction",
          index,
          value: 0,
          reason: "当前填写无法满足全部线索。先清空这一格，再重新推理。",
        };
  }
  // A unique exhaustive result is a proof. Never claim two sampled solutions prove a forced cell.
  if (current.status !== "complete" || current.solutions.length !== 1)
    return null;
  const index = values.findIndex((v) => v === 0);
  return index < 0
    ? null
    : { kind: "deduction", index, value: current.solutions[0][index], reason };
}
export function getFutoshikiHint(
  level: FutoshikiLevel,
  values: readonly number[],
): ConstraintHint | null {
  if (!validLatinValues(level.size, values)) return null;
  return constraintHint(
    level.givens,
    values,
    (board) => solveFutoshiki(level, board),
    "结合当前行列与大小关系，所有可行填法都要求这里填入",
  );
}
export function createConstraintState(
  givens: readonly number[],
): ConstraintState {
  return { values: [...givens], notes: givens.map(() => []), history: [] };
}
export function constraintInput(
  state: ConstraintState,
  givens: readonly number[],
  size: number,
  index: number,
  value: number,
  noteMode = false,
): ConstraintState {
  if (
    !validLatinValues(size, state.values) ||
    !validLatinValues(size, givens) ||
    state.notes.length !== size * size ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= size * size ||
    givens[index] ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > size
  )
    return state;
  if (noteMode && value && state.values[index]) return state;
  const values = [...state.values],
    notes = state.notes.map((note) => [...note]);
  if (noteMode && value)
    notes[index] = notes[index].includes(value)
      ? notes[index].filter((v) => v !== value)
      : [...notes[index], value].sort((a, b) => a - b);
  else {
    if (values[index] === value && !notes[index].length) return state;
    values[index] = value;
    notes[index] = [];
  }
  return {
    values,
    notes,
    history: [
      ...state.history,
      {
        values: [...state.values],
        notes: state.notes.map((note) => [...note]),
      },
    ],
  };
}
export function undoConstraint(state: ConstraintState): ConstraintState {
  const previous = state.history.at(-1);
  return previous
    ? {
        values: [...previous.values],
        notes: previous.notes.map((note) => [...note]),
        history: state.history.slice(0, -1),
      }
    : state;
}

/** Twelve fixed, original layouts; certificates are independently re-counted in tests. */
export const futoshikiLevels: FutoshikiLevel[] = [
  {
    title: "大小萌芽",
    size: 3,
    givens: [2, 0, 0, 0, 0, 0, 0, 0, 0],
    inequalities: [
      { less: 2, greater: 1 },
      { less: 4, greater: 1 },
      { less: 4, greater: 5 },
      { less: 4, greater: 7 },
      { less: 5, greater: 8 },
      { less: 6, greater: 7 },
      { less: 7, greater: 8 },
    ],
    solution: [2, 3, 1, 3, 1, 2, 1, 2, 3],
  },
  {
    title: "窄口与开口",
    size: 3,
    givens: [0, 0, 0, 2, 0, 0, 0, 0, 0],
    inequalities: [
      { less: 1, greater: 0 },
      { less: 3, greater: 4 },
      { less: 5, greater: 2 },
      { less: 6, greater: 3 },
      { less: 7, greater: 4 },
      { less: 7, greater: 8 },
    ],
    solution: [3, 1, 2, 2, 3, 1, 1, 2, 3],
  },
  {
    title: "向上生长",
    size: 3,
    givens: [0, 0, 1, 0, 0, 0, 0, 0, 0],
    inequalities: [
      { less: 2, greater: 1 },
      { less: 6, greater: 3 },
      { less: 6, greater: 7 },
      { less: 8, greater: 5 },
      { less: 8, greater: 7 },
    ],
    solution: [3, 2, 1, 2, 1, 3, 1, 3, 2],
  },
  {
    title: "三格交叉",
    size: 3,
    givens: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    inequalities: [
      { less: 0, greater: 3 },
      { less: 1, greater: 0 },
      { less: 1, greater: 4 },
      { less: 5, greater: 2 },
    ],
    solution: [2, 1, 3, 3, 2, 1, 1, 3, 2],
  },
  {
    title: "四方新叶",
    size: 4,
    givens: [0, 4, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 3, 0],
    inequalities: [
      { less: 0, greater: 1 },
      { less: 0, greater: 4 },
      { less: 2, greater: 3 },
      { less: 4, greater: 8 },
      { less: 7, greater: 11 },
      { less: 10, greater: 6 },
      { less: 10, greater: 14 },
      { less: 13, greater: 9 },
      { less: 13, greater: 12 },
      { less: 13, greater: 14 },
      { less: 15, greater: 11 },
    ],
    solution: [1, 4, 2, 3, 2, 3, 4, 1, 3, 2, 1, 4, 4, 1, 3, 2],
  },
  {
    title: "连锁枝条",
    size: 4,
    givens: [0, 0, 0, 0, 0, 0, 3, 1, 0, 0, 0, 3, 1, 0, 0, 0],
    inequalities: [
      { less: 0, greater: 1 },
      { less: 0, greater: 4 },
      { less: 5, greater: 6 },
      { less: 7, greater: 3 },
      { less: 7, greater: 6 },
      { less: 7, greater: 11 },
      { less: 9, greater: 5 },
      { less: 9, greater: 8 },
      { less: 9, greater: 13 },
      { less: 12, greater: 13 },
    ],
    solution: [3, 4, 1, 2, 4, 2, 3, 1, 2, 1, 4, 3, 1, 3, 2, 4],
  },
  {
    title: "交错藤蔓",
    size: 4,
    givens: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2],
    inequalities: [
      { less: 1, greater: 0 },
      { less: 2, greater: 6 },
      { less: 4, greater: 0 },
      { less: 5, greater: 9 },
      { less: 6, greater: 7 },
      { less: 10, greater: 6 },
      { less: 10, greater: 14 },
      { less: 11, greater: 10 },
      { less: 15, greater: 14 },
    ],
    solution: [4, 2, 1, 3, 2, 1, 3, 4, 3, 4, 2, 1, 1, 3, 4, 2],
  },
  {
    title: "无字花圃",
    size: 4,
    givens: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    inequalities: [
      { less: 0, greater: 1 },
      { less: 2, greater: 1 },
      { less: 4, greater: 0 },
      { less: 7, greater: 3 },
      { less: 7, greater: 6 },
      { less: 10, greater: 14 },
      { less: 11, greater: 7 },
      { less: 11, greater: 10 },
    ],
    solution: [2, 3, 1, 4, 1, 2, 4, 3, 3, 4, 2, 1, 4, 1, 3, 2],
  },
  {
    title: "五重绿意",
    size: 5,
    givens: [
      0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 1, 0, 3, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0,
    ],
    inequalities: [
      { less: 0, greater: 5 },
      { less: 4, greater: 3 },
      { less: 4, greater: 9 },
      { less: 5, greater: 10 },
      { less: 6, greater: 7 },
      { less: 8, greater: 7 },
      { less: 8, greater: 13 },
      { less: 11, greater: 16 },
      { less: 12, greater: 13 },
      { less: 15, greater: 10 },
      { less: 16, greater: 21 },
      { less: 18, greater: 13 },
      { less: 20, greater: 15 },
      { less: 20, greater: 21 },
      { less: 23, greater: 24 },
    ],
    solution: [
      1, 4, 3, 5, 2, 2, 1, 4, 3, 5, 5, 2, 1, 4, 3, 4, 3, 5, 2, 1, 3, 5, 2, 1, 4,
    ],
  },
  {
    title: "隐形次序",
    size: 5,
    givens: [
      0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    inequalities: [
      { less: 0, greater: 5 },
      { less: 4, greater: 3 },
      { less: 6, greater: 1 },
      { less: 7, greater: 12 },
      { less: 8, greater: 3 },
      { less: 8, greater: 13 },
      { less: 10, greater: 5 },
      { less: 11, greater: 6 },
      { less: 13, greater: 12 },
      { less: 16, greater: 21 },
      { less: 18, greater: 17 },
      { less: 22, greater: 17 },
      { less: 23, greater: 22 },
      { less: 24, greater: 23 },
    ],
    solution: [
      1, 4, 2, 5, 3, 5, 2, 1, 3, 4, 3, 1, 5, 4, 2, 2, 3, 4, 1, 5, 4, 5, 3, 2, 1,
    ],
  },
  {
    title: "长枝短枝",
    size: 5,
    givens: [
      0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0,
    ],
    inequalities: [
      { less: 1, greater: 0 },
      { less: 1, greater: 2 },
      { less: 3, greater: 2 },
      { less: 4, greater: 9 },
      { less: 5, greater: 0 },
      { less: 9, greater: 14 },
      { less: 11, greater: 12 },
      { less: 13, greater: 12 },
      { less: 13, greater: 14 },
      { less: 14, greater: 19 },
      { less: 15, greater: 10 },
      { less: 20, greater: 21 },
      { less: 21, greater: 16 },
    ],
    solution: [
      4, 1, 5, 3, 2, 1, 5, 2, 4, 3, 5, 2, 3, 1, 4, 3, 4, 1, 2, 5, 2, 3, 4, 5, 1,
    ],
  },
  {
    title: "不等式花园",
    size: 5,
    givens: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    inequalities: [
      { less: 1, greater: 6 },
      { less: 4, greater: 3 },
      { less: 5, greater: 10 },
      { less: 11, greater: 6 },
      { less: 12, greater: 17 },
      { less: 13, greater: 18 },
      { less: 14, greater: 13 },
      { less: 15, greater: 16 },
      { less: 15, greater: 20 },
      { less: 17, greater: 22 },
      { less: 19, greater: 24 },
      { less: 22, greater: 21 },
    ],
    solution: [
      4, 1, 5, 3, 2, 3, 5, 4, 2, 1, 5, 2, 1, 4, 3, 1, 3, 2, 5, 4, 2, 4, 3, 1, 5,
    ],
  },
];
export const futoshikiSolutions = futoshikiLevels.map((level) => [
  ...level.solution,
]);
