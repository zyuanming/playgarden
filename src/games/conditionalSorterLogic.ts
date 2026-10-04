// SPDX-License-Identifier: MIT
/** Original first-match decision-list puzzles; the entire finite domain is tested. */
export type ParcelShape = "circle" | "square" | "triangle";
export type ParcelMaterial = "wood" | "glass" | "metal";
export type SortParcel = {
  shape: ParcelShape;
  material: ParcelMaterial;
  number: number;
};
export type SortAtom =
  ParcelShape | ParcelMaterial | "odd" | "even" | "high" | "low" | "prime";
export type SortCondition = { id: string; atoms: SortAtom[]; label: string };
export type SortRule = { condition: string | null; bin: number };
export type SortProgram = { rules: SortRule[]; otherwise: number | null };
export type SortLevel = {
  title: string;
  lesson: string;
  shapes: ParcelShape[];
  materials: ParcelMaterial[];
  numbers: number[];
  conditions: string[];
  bins: number;
  slots: number;
  targets: number[];
  solution: SortProgram;
};
export type SortState = { program: SortProgram; history: SortProgram[] };
export type SortMove =
  | { type: "condition"; row: number; value: string | null }
  | { type: "bin"; row: number; value: number }
  | { type: "otherwise"; value: number }
  | { type: "swap"; row: number; other: number };
export const SORT_SEARCH_LIMIT = 20000;
export const shapeLabels: Record<ParcelShape, string> = {
  circle: "圆形",
  square: "方形",
  triangle: "三角形",
};
export const materialLabels: Record<ParcelMaterial, string> = {
  wood: "木质",
  glass: "玻璃",
  metal: "金属",
};
export const sortBinLabel = (bin: number | null) =>
  bin === null ? "待选" : `${String.fromCharCode(65 + bin)} 箱`;
export const sortConditions: SortCondition[] = [
  { id: "circle", atoms: ["circle"], label: "形状是圆形" },
  { id: "square", atoms: ["square"], label: "形状是方形" },
  { id: "triangle", atoms: ["triangle"], label: "形状是三角形" },
  { id: "wood", atoms: ["wood"], label: "材质是木质" },
  { id: "glass", atoms: ["glass"], label: "材质是玻璃" },
  { id: "metal", atoms: ["metal"], label: "材质是金属" },
  { id: "odd", atoms: ["odd"], label: "号码是奇数" },
  { id: "even", atoms: ["even"], label: "号码是偶数" },
  { id: "high", atoms: ["high"], label: "号码 ≥ 3" },
  { id: "low", atoms: ["low"], label: "号码 ≤ 2" },
  { id: "prime", atoms: ["prime"], label: "号码是质数（2、3、5）" },
  { id: "circle-glass", atoms: ["circle", "glass"], label: "圆形 且 玻璃" },
  { id: "square-even", atoms: ["square", "even"], label: "方形 且 偶数" },
  { id: "metal-high", atoms: ["metal", "high"], label: "金属 且 号码 ≥ 3" },
  { id: "glass-odd", atoms: ["glass", "odd"], label: "玻璃 且 奇数" },
  {
    id: "triangle-prime",
    atoms: ["triangle", "prime"],
    label: "三角形 且 质数",
  },
  { id: "metal-odd", atoms: ["metal", "odd"], label: "金属 且 奇数" },
  { id: "glass-high", atoms: ["glass", "high"], label: "玻璃 且 号码 ≥ 3" },
];
export function sortConditionLabel(id: string | null): string {
  return sortConditions.find((c) => c.id === id)?.label ?? "跳过这条";
}
export function parcelLabel(p: SortParcel): string {
  return `${shapeLabels[p.shape]} · ${materialLabels[p.material]} · ${p.number} 号`;
}
export function sortDomain(level: SortLevel): SortParcel[] {
  return level.shapes.flatMap((shape) =>
    level.materials.flatMap((material) =>
      level.numbers.map((number) => ({ shape, material, number })),
    ),
  );
}
export function sortAtomMatches(atom: SortAtom, p: SortParcel): boolean {
  switch (atom) {
    case "circle":
    case "square":
    case "triangle":
      return p.shape === atom;
    case "wood":
    case "glass":
    case "metal":
      return p.material === atom;
    case "odd":
      return p.number % 2 === 1;
    case "even":
      return p.number % 2 === 0;
    case "high":
      return p.number >= 3;
    case "low":
      return p.number <= 2;
    case "prime":
      return [2, 3, 5].includes(p.number);
  }
}
export function sortMatches(id: string, parcel: SortParcel): boolean {
  const condition = sortConditions.find((c) => c.id === id);
  return (
    !!condition &&
    condition.atoms.every((atom) => sortAtomMatches(atom, parcel))
  );
}
const integerRange = (n: number, min: number, max: number) =>
  Number.isInteger(n) && n >= min && n <= max;
export function validSortLevel(level: SortLevel): boolean {
  return (
    level.shapes.length >= 1 &&
    level.shapes.length <= 3 &&
    new Set(level.shapes).size === level.shapes.length &&
    level.shapes.every((s) => s in shapeLabels) &&
    level.materials.length >= 1 &&
    level.materials.length <= 3 &&
    new Set(level.materials).size === level.materials.length &&
    level.materials.every((m) => m in materialLabels) &&
    level.numbers.length >= 1 &&
    level.numbers.length <= 6 &&
    new Set(level.numbers).size === level.numbers.length &&
    level.numbers.every((n) => integerRange(n, 1, 6)) &&
    integerRange(level.bins, 2, 4) &&
    integerRange(level.slots, 1, 4) &&
    level.conditions.length > 0 &&
    level.conditions.length <= 12 &&
    new Set(level.conditions).size === level.conditions.length &&
    level.conditions.every((id) => sortConditions.some((c) => c.id === id)) &&
    level.targets.length ===
      level.shapes.length * level.materials.length * level.numbers.length &&
    level.targets.every((n) => integerRange(n, 0, level.bins - 1))
  );
}
export function validSortProgram(
  level: SortLevel,
  program: SortProgram,
): boolean {
  return (
    validSortLevel(level) &&
    program.rules.length === level.slots &&
    program.rules.every(
      (r) =>
        (r.condition === null || level.conditions.includes(r.condition)) &&
        integerRange(r.bin, 0, level.bins - 1),
    ) &&
    (program.otherwise === null ||
      integerRange(program.otherwise, 0, level.bins - 1))
  );
}
export function traceSort(
  program: SortProgram,
  parcel: SortParcel,
): { bin: number | null; row: number | null; checked: number[] } {
  const checked: number[] = [];
  for (let row = 0; row < program.rules.length; row++) {
    const rule = program.rules[row];
    if (rule.condition === null) continue;
    checked.push(row);
    if (sortMatches(rule.condition, parcel))
      return { bin: rule.bin, row, checked };
  }
  return { bin: program.otherwise, row: null, checked };
}
export function verifySort(level: SortLevel, program: SortProgram) {
  const domain = sortDomain(level);
  if (!validSortProgram(level, program))
    return {
      valid: false,
      passed: 0,
      total: domain.length,
      firstFailure: null as number | null,
    };
  let passed = 0,
    firstFailure: number | null = null;
  domain.forEach((parcel, i) => {
    if (traceSort(program, parcel).bin === level.targets[i]) passed++;
    else if (firstFailure === null) firstFailure = i;
  });
  return { valid: true, passed, total: domain.length, firstFailure };
}
export function sortWon(level: SortLevel, program: SortProgram): boolean {
  const result = verifySort(level, program);
  return (
    result.valid && program.otherwise !== null && result.passed === result.total
  );
}
const cloneProgram = (p: SortProgram): SortProgram => ({
  rules: p.rules.map((r) => ({ ...r })),
  otherwise: p.otherwise,
});
export const createSortState = (level: SortLevel): SortState => ({
  program: {
    rules: Array.from({ length: level.slots }, () => ({
      condition: null,
      bin: 0,
    })),
    otherwise: null,
  },
  history: [],
});
export function applySortMove(
  level: SortLevel,
  program: SortProgram,
  move: SortMove,
): SortProgram | null {
  if (!validSortProgram(level, program)) return null;
  const next = cloneProgram(program);
  if (move.type === "otherwise") {
    if (
      !integerRange(move.value, 0, level.bins - 1) ||
      program.otherwise === move.value
    )
      return null;
    next.otherwise = move.value;
  } else {
    if (!integerRange(move.row, 0, level.slots - 1)) return null;
    if (move.type === "condition") {
      if (
        (move.value !== null && !level.conditions.includes(move.value)) ||
        program.rules[move.row].condition === move.value
      )
        return null;
      next.rules[move.row].condition = move.value;
    } else if (move.type === "bin") {
      if (
        !integerRange(move.value, 0, level.bins - 1) ||
        program.rules[move.row].bin === move.value ||
        program.rules[move.row].condition === null
      )
        return null;
      next.rules[move.row].bin = move.value;
    } else if (move.type === "swap") {
      if (
        !integerRange(move.other, 0, level.slots - 1) ||
        Math.abs(move.row - move.other) !== 1 ||
        JSON.stringify(next.rules[move.row]) ===
          JSON.stringify(next.rules[move.other])
      )
        return null;
      [next.rules[move.row], next.rules[move.other]] = [
        next.rules[move.other],
        next.rules[move.row],
      ];
    } else return null;
  }
  return next;
}
export function moveSort(
  level: SortLevel,
  state: SortState,
  move: SortMove,
): SortState {
  if (sortWon(level, state.program)) return state;
  const program = applySortMove(level, state.program, move);
  return program
    ? { program, history: [...state.history, cloneProgram(state.program)] }
    : state;
}
export function undoSort(state: SortState): SortState {
  const program = state.history.at(-1);
  return program
    ? { program: cloneProgram(program), history: state.history.slice(0, -1) }
    : state;
}
export type SortSearch = {
  status: "found" | "solved" | "unsolvable" | "limit" | "invalid";
  program: SortProgram | null;
  visited: number;
};
/** Bounded decision-list synthesis. A branch may capture only parcels with one
 * target bin. Search reads targets, never the stored certificate. It tries the
 * current row first but does not promise the fewest edits. */
export function searchSort(
  level: SortLevel,
  current = createSortState(level).program,
  limit = SORT_SEARCH_LIMIT,
): SortSearch {
  if (!validSortProgram(level, current))
    return { status: "invalid", program: null, visited: 0 };
  if (sortWon(level, current))
    return { status: "solved", program: cloneProgram(current), visited: 0 };
  if (!Number.isInteger(limit) || limit < 1)
    return { status: "limit", program: null, visited: 0 };
  const domain = sortDomain(level),
    full = (1n << BigInt(domain.length)) - 1n;
  const masks = new Map(
    level.conditions.map((id) => [
      id,
      domain.reduce(
        (mask, p, i) => (sortMatches(id, p) ? mask | (1n << BigInt(i)) : mask),
        0n,
      ),
    ]),
  );
  const bins = Array.from({ length: level.bins }, (_, bin) =>
    level.targets.reduce(
      (mask, target, i) => (target === bin ? mask | (1n << BigInt(i)) : mask),
      0n,
    ),
  );
  const failed = new Set<string>();
  let visited = 0,
    capped = false;
  function visit(row: number, remaining: bigint): SortProgram | null {
    if (visited >= limit) {
      capped = true;
      return null;
    }
    visited++;
    const key = `${row}:${remaining}`;
    if (failed.has(key)) return null;
    if (row === level.slots) {
      const fallback = [current.otherwise, ...bins.map((_, i) => i)].find(
        (bin) => bin !== null && (remaining & ~bins[bin]) === 0n,
      );
      return fallback === undefined || fallback === null
        ? null
        : { rules: [], otherwise: fallback };
    }
    const choices: (string | null)[] = [
      current.rules[row].condition,
      ...level.conditions,
      null,
    ].filter((id, i, a) => a.indexOf(id) === i);
    for (const condition of choices) {
      const captured =
        condition === null ? 0n : remaining & masks.get(condition)!;
      // An unreachable condition cannot improve a decision list; skip is equivalent.
      if (condition !== null && captured === 0n) continue;
      const bin =
        condition === null
          ? current.rules[row].bin
          : bins.findIndex((mask) => (captured & ~mask) === 0n);
      if (bin < 0) continue;
      const tail = visit(row + 1, remaining & ~captured);
      if (tail)
        return {
          rules: [{ condition, bin }, ...tail.rules],
          otherwise: tail.otherwise,
        };
      if (capped) return null;
    }
    failed.add(key);
    return null;
  }
  const program = visit(0, full);
  return {
    status: program ? "found" : capped ? "limit" : "unsolvable",
    program,
    visited,
  };
}
export function sortHint(
  level: SortLevel,
  program: SortProgram,
): { move: SortMove | null; text: string; status: SortSearch["status"] } {
  const search = searchSort(level, program);
  if (!search.program)
    return {
      move: null,
      status: search.status,
      text:
        search.status === "limit"
          ? "搜索达到预算，还不能判断。试着检查第一个分错的包裹，观察是哪条规则先接住了它。"
          : "当前规则配置无法验证，请重置后再试。",
    };
  if (search.status === "solved")
    return {
      move: null,
      status: "solved",
      text: "完整范围里的每一种包裹都分对了！",
    };
  let move: SortMove | null = null;
  for (let row = 0; row < level.slots && !move; row++) {
    const a = program.rules[row],
      b = search.program.rules[row];
    if (a.condition !== b.condition)
      move = { type: "condition", row, value: b.condition };
    else if (a.bin !== b.bin && b.condition !== null)
      move = { type: "bin", row, value: b.bin };
  }
  if (!move && program.otherwise !== search.program.otherwise)
    move = { type: "otherwise", value: search.program.otherwise! };
  const change =
    move?.type === "condition"
      ? `第 ${move.row + 1} 条条件改为「${sortConditionLabel(move.value)}」`
      : move?.type === "bin"
        ? `第 ${move.row + 1} 条送往 ${sortBinLabel(move.value)}`
        : move?.type === "otherwise"
          ? `最后的“否则”送往 ${sortBinLabel(move.value)}`
          : "检查当前规则";
  return {
    move,
    status: search.status,
    text: `从当前程序搜索到一种可行改法：${change}。后续规则可能也要改；这一步不保证立即增加正确数，也不一定是唯一答案。`,
  };
}
