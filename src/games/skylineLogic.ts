import {
  CONSTRAINT_NODE_LIMIT,
  constraintHint,
  latinConflicts,
  latinPermutations,
  searchLatinDomains,
  validLatinValues,
  type ConstraintHint,
  type ConstraintSearch,
} from "./futoshikiLogic";
export type SkylineSide = "top" | "right" | "bottom" | "left";
export type SkylineClues = Record<SkylineSide, number[]>;
export type SkylineLevel = {
  title: string;
  size: number;
  givens: number[];
  clues: SkylineClues;
  solution: number[];
};
/** Count strict record heights viewed left-to-right. 0/invalid heights are not buildings. */
export function visibleBuildings(line: readonly number[]): number {
  if (
    !Array.isArray(line) ||
    !line.length ||
    line.some((v) => !Number.isInteger(v) || v < 1)
  )
    return 0;
  let tallest = 0,
    count = 0;
  for (const height of line)
    if (height > tallest) {
      tallest = height;
      count++;
    }
  return count;
}
export function skylineLineOptions(
  size: number,
  near: number,
  far: number,
  partial?: readonly number[],
): number[][] {
  if (
    !Number.isInteger(size) ||
    size < 3 ||
    size > 5 ||
    ![near, far].every((c) => Number.isInteger(c) && c >= 0 && c <= size) ||
    (partial !== undefined &&
      (!Array.isArray(partial) ||
        partial.length !== size ||
        partial.some((v) => !Number.isInteger(v) || v < 0 || v > size)))
  )
    return [];
  const values = partial ?? Array(size).fill(0);
  return latinPermutations(size).filter(
    (line) =>
      line.every((v, i) => !values[i] || values[i] === v) &&
      (!near || visibleBuildings(line) === near) &&
      (!far || visibleBuildings([...line].reverse()) === far),
  );
}
export function validSkylineLevel(level: SkylineLevel): boolean {
  return (
    !!level &&
    !!level.clues &&
    validLatinValues(level.size, level.givens) &&
    (["top", "right", "bottom", "left"] as const).every(
      (side) =>
        Array.isArray(level.clues[side]) &&
        level.clues[side].length === level.size &&
        level.clues[side].every(
          (v) => Number.isInteger(v) && v >= 0 && v <= level.size,
        ),
    )
  );
}
/** Board-coordinate order: top/bottom are left→right, left/right are top→bottom. */
export function skylineLine(
  level: SkylineLevel,
  values: readonly number[],
  side: SkylineSide,
  index: number,
): number[] {
  if (
    !validLatinValues(level.size, values) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= level.size
  )
    return [];
  const line = Array.from(
    { length: level.size },
    (_, i) =>
      values[
        side === "left" || side === "right"
          ? index * level.size + i
          : i * level.size + index
      ],
  );
  return side === "right" || side === "bottom" ? line.reverse() : line;
}
export function skylineClueState(
  level: SkylineLevel,
  values: readonly number[],
  side: SkylineSide,
  index: number,
): "empty" | "pending" | "satisfied" | "conflict" {
  if (
    !validSkylineLevel(level) ||
    !validLatinValues(level.size, values) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= level.size
  )
    return "conflict";
  const clue = level.clues[side][index];
  if (!clue) return "empty";
  const line = skylineLine(level, values, side, index);
  if (!skylineLineOptions(level.size, clue, 0, line).length) return "conflict";
  return line.every(Boolean) ? "satisfied" : "pending";
}
export function skylineConflicts(
  level: SkylineLevel,
  values: readonly number[],
): number[] {
  if (!validSkylineLevel(level) || !validLatinValues(level.size, values))
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
  for (let i = 0; i < level.size; i++) {
    const row = skylineLine(level, values, "left", i),
      column = skylineLine(level, values, "top", i);
    if (
      !skylineLineOptions(
        level.size,
        level.clues.left[i],
        level.clues.right[i],
        row,
      ).length
    )
      row.forEach((v, c) => {
        if (v) conflicts.add(i * level.size + c);
      });
    if (
      !skylineLineOptions(
        level.size,
        level.clues.top[i],
        level.clues.bottom[i],
        column,
      ).length
    )
      column.forEach((v, r) => {
        if (v) conflicts.add(r * level.size + i);
      });
  }
  return [...conflicts].sort((a, b) => a - b);
}
export function isSkylineSolved(
  level: SkylineLevel,
  values: readonly number[],
): boolean {
  return (
    validSkylineLevel(level) &&
    validLatinValues(level.size, values) &&
    values.every(Boolean) &&
    skylineConflicts(level, values).length === 0
  );
}
export function solveSkyline(
  level: SkylineLevel,
  values: readonly number[] = level.givens,
  limit = 2,
  nodeLimit = CONSTRAINT_NODE_LIMIT,
): ConstraintSearch {
  if (
    !validSkylineLevel(level) ||
    !validLatinValues(level.size, values) ||
    latinConflicts(level.size, values).length ||
    values.some((v, i) => level.givens[i] && v !== level.givens[i])
  )
    return { solutions: [], nodes: 0, status: "invalid" };
  const rows = Array.from({ length: level.size }, (_, r) =>
    skylineLineOptions(
      level.size,
      level.clues.left[r],
      level.clues.right[r],
      skylineLine(level, values, "left", r),
    ),
  );
  const columns = Array.from({ length: level.size }, (_, c) =>
    skylineLineOptions(
      level.size,
      level.clues.top[c],
      level.clues.bottom[c],
      skylineLine(level, values, "top", c),
    ),
  );
  return searchLatinDomains(level.size, rows, columns, [], limit, nodeLimit);
}
export function skylineCandidates(
  level: SkylineLevel,
  values: readonly number[],
  index: number,
): number[] {
  if (
    !validSkylineLevel(level) ||
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
    return solveSkyline(level, board, 1).solutions.length > 0;
  });
}
export function getSkylineHint(
  level: SkylineLevel,
  values: readonly number[],
): ConstraintHint | null {
  if (!validLatinValues(level.size, values)) return null;
  return constraintHint(
    level.givens,
    values,
    (board) => solveSkyline(level, board),
    "结合当前行列与四边可见栋数，所有可行填法都要求这里填入",
  );
}

/** Fixed original cities, each with an independently counted unique clue solution. */
export const skylineLevels: SkylineLevel[] = [
  {
    title: "第一条街",
    size: 3,
    givens: [0, 0, 2, 0, 0, 0, 0, 0, 0],
    clues: {
      top: [0, 2, 2],
      bottom: [3, 0, 1],
      left: [1, 0, 3],
      right: [0, 2, 1],
    },
    solution: [3, 1, 2, 2, 3, 1, 1, 2, 3],
  },
  {
    title: "从两边看",
    size: 3,
    givens: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    clues: {
      top: [2, 0, 2],
      bottom: [1, 3, 0],
      left: [2, 3, 1],
      right: [0, 0, 0],
    },
    solution: [2, 3, 1, 1, 2, 3, 3, 1, 2],
  },
  {
    title: "高楼之后",
    size: 3,
    givens: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    clues: {
      top: [1, 2, 0],
      bottom: [2, 2, 1],
      left: [1, 0, 0],
      right: [0, 0, 0],
    },
    solution: [3, 2, 1, 1, 3, 2, 2, 1, 3],
  },
  {
    title: "三层街角",
    size: 3,
    givens: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    clues: {
      top: [0, 0, 2],
      bottom: [0, 2, 0],
      left: [0, 2, 0],
      right: [0, 2, 1],
    },
    solution: [3, 1, 2, 2, 3, 1, 1, 2, 3],
  },
  {
    title: "城市新街",
    size: 4,
    givens: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    clues: {
      top: [2, 1, 0, 2],
      bottom: [0, 3, 2, 2],
      left: [0, 4, 0, 1],
      right: [0, 1, 2, 2],
    },
    solution: [3, 4, 1, 2, 1, 2, 3, 4, 2, 3, 4, 1, 4, 1, 2, 3],
  },
  {
    title: "背面的风景",
    size: 4,
    givens: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    clues: {
      top: [3, 4, 2, 0],
      bottom: [2, 1, 0, 0],
      left: [3, 0, 1, 2],
      right: [0, 2, 3, 0],
    },
    solution: [2, 1, 3, 4, 3, 2, 4, 1, 4, 3, 1, 2, 1, 4, 2, 3],
  },
  {
    title: "交叉视线",
    size: 4,
    givens: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    clues: {
      top: [0, 2, 3, 1],
      bottom: [0, 2, 0, 0],
      left: [3, 0, 2, 1],
      right: [1, 2, 0, 0],
    },
    solution: [2, 3, 1, 4, 1, 4, 2, 3, 3, 1, 4, 2, 4, 2, 3, 1],
  },
  {
    title: "转角之间",
    size: 4,
    givens: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    clues: {
      top: [3, 0, 3, 0],
      bottom: [2, 4, 0, 0],
      left: [2, 0, 0, 0],
      right: [2, 0, 3, 2],
    },
    solution: [1, 4, 2, 3, 2, 3, 1, 4, 4, 2, 3, 1, 3, 1, 4, 2],
  },
  {
    title: "五层天际",
    size: 5,
    givens: [
      0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    clues: {
      top: [3, 0, 2, 3, 1],
      bottom: [2, 1, 4, 2, 3],
      left: [3, 0, 0, 4, 2],
      right: [1, 0, 0, 0, 2],
    },
    solution: [
      2, 4, 1, 3, 5, 3, 1, 5, 4, 2, 5, 3, 4, 2, 1, 1, 2, 3, 5, 4, 4, 5, 2, 1, 3,
    ],
  },
  {
    title: "远近楼影",
    size: 5,
    givens: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    clues: {
      top: [1, 2, 3, 4, 2],
      bottom: [4, 2, 0, 1, 3],
      left: [1, 2, 0, 0, 0],
      right: [0, 0, 1, 3, 0],
    },
    solution: [
      5, 3, 2, 1, 4, 4, 5, 1, 3, 2, 3, 1, 4, 2, 5, 1, 2, 5, 4, 3, 2, 4, 3, 5, 1,
    ],
  },
  {
    title: "稀疏路标",
    size: 5,
    givens: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    clues: {
      top: [3, 2, 2, 0, 4],
      bottom: [0, 0, 2, 3, 0],
      left: [0, 0, 0, 2, 3],
      right: [0, 3, 3, 2, 1],
    },
    solution: [
      1, 4, 3, 5, 2, 4, 3, 5, 2, 1, 5, 2, 1, 4, 3, 3, 5, 2, 1, 4, 2, 1, 4, 3, 5,
    ],
  },
  {
    title: "天空花园",
    size: 5,
    givens: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    clues: {
      top: [0, 0, 4, 2, 1],
      bottom: [0, 0, 2, 3, 2],
      left: [0, 0, 0, 2, 2],
      right: [1, 0, 2, 2, 0],
    },
    solution: [
      3, 2, 1, 4, 5, 5, 4, 2, 3, 1, 1, 3, 4, 5, 2, 4, 1, 5, 2, 3, 2, 5, 3, 1, 4,
    ],
  },
];
export const skylineSolutions = skylineLevels.map((level) => [
  ...level.solution,
]);
