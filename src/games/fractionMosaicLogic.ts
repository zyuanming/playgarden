/** Original GPL-3.0-only-licensed fraction planning puzzles. All quantities are exact integer tiles. */
export type FractionPiece = { id: string; units: number };
export type FractionMove =
  | { kind: "join"; first: string; second: string }
  | { kind: "split"; piece: string; parts: 2 | 3 }
  | { kind: "serve"; piece: string; tray: number };
export type FractionBoard = {
  pieces: FractionPiece[];
  filled: boolean[];
  cutsLeft: number;
  nextId: number;
};
export type FractionState = FractionBoard & { history: FractionBoard[] };
export type FractionLevel = {
  title: string;
  denominator: number;
  stock: number[];
  targets: number[];
  cuts: number;
  idea: string;
  solution: FractionMove[];
};
export const FRACTION_SEARCH_LIMIT = 12000;
export const FRACTION_PIECE_LIMIT = 10;
export function formatFraction(units: number, denominator: number): string {
  if (
    !Number.isSafeInteger(units) ||
    units < 0 ||
    !Number.isSafeInteger(denominator) ||
    denominator <= 0
  )
    throw new RangeError(
      "A fraction needs nonnegative safe integer units and a positive denominator.",
    );
  if (units === 0) return "0";
  let a = units,
    b = denominator;
  while (b) [a, b] = [b, a % b];
  return denominator / a === 1
    ? String(units / a)
    : `${units / a}/${denominator / a}`;
}
export function createFractionState(level: FractionLevel): FractionState {
  return {
    pieces: level.stock.map((units, i) => ({ id: `p${i}`, units })),
    filled: level.targets.map(() => false),
    cutsLeft: level.cuts,
    nextId: 0,
    history: [],
  };
}
export function fractionWon(
  level: FractionLevel,
  board: FractionBoard,
): boolean {
  return (
    board.pieces.length === 0 &&
    board.filled.length === level.targets.length &&
    board.filled.every(Boolean)
  );
}
export function validFractionBoard(
  level: FractionLevel,
  board: FractionBoard,
): boolean {
  return (
    Number.isSafeInteger(level.denominator) &&
    level.denominator > 0 &&
    board.pieces.length <= FRACTION_PIECE_LIMIT &&
    new Set(board.pieces.map((p) => p.id)).size === board.pieces.length &&
    board.pieces.every(
      (p) =>
        Number.isSafeInteger(p.units) &&
        p.units > 0 &&
        p.units <= level.denominator,
    ) &&
    board.filled.length === level.targets.length &&
    board.filled.every((v) => typeof v === "boolean") &&
    Number.isSafeInteger(board.cutsLeft) &&
    board.cutsLeft >= 0 &&
    board.cutsLeft <= level.cuts &&
    Number.isSafeInteger(board.nextId) &&
    board.nextId >= 0 &&
    board.pieces.reduce((n, p) => n + p.units, 0) +
      level.targets.reduce(
        (n, value, i) => n + (board.filled[i] ? value : 0),
        0,
      ) ===
      level.stock.reduce((a, b) => a + b, 0)
  );
}
export function applyFractionMove(
  level: FractionLevel,
  board: FractionBoard,
  move: FractionMove,
): FractionBoard | null {
  if (!validFractionBoard(level, board) || fractionWon(level, board))
    return null;
  if (move.kind === "join") {
    const a = board.pieces.find((p) => p.id === move.first),
      b = board.pieces.find((p) => p.id === move.second);
    if (!a || !b || a === b || a.units + b.units > level.denominator)
      return null;
    return {
      ...board,
      pieces: [
        ...board.pieces.filter((p) => p !== a && p !== b),
        { id: `m${board.nextId}`, units: a.units + b.units },
      ],
      nextId: board.nextId + 1,
    };
  }
  const piece = board.pieces.find((p) => p.id === move.piece);
  if (!piece) return null;
  if (move.kind === "split") {
    if (
      (move.parts !== 2 && move.parts !== 3) ||
      board.cutsLeft === 0 ||
      piece.units % move.parts !== 0 ||
      board.pieces.length + move.parts - 1 > FRACTION_PIECE_LIMIT
    )
      return null;
    return {
      ...board,
      pieces: [
        ...board.pieces.filter((p) => p !== piece),
        ...Array.from({ length: move.parts }, (_, i) => ({
          id: `s${board.nextId}-${i}`,
          units: piece.units / move.parts,
        })),
      ],
      cutsLeft: board.cutsLeft - 1,
      nextId: board.nextId + 1,
    };
  }
  if (
    move.kind !== "serve" ||
    !Number.isInteger(move.tray) ||
    move.tray < 0 ||
    move.tray >= level.targets.length ||
    board.filled[move.tray] ||
    piece.units !== level.targets[move.tray]
  )
    return null;
  return {
    ...board,
    pieces: board.pieces.filter((p) => p !== piece),
    filled: board.filled.map((v, i) => i === move.tray || v),
  };
}
export function fractionMove(
  state: FractionState,
  level: FractionLevel,
  move: FractionMove,
): FractionState {
  const next = applyFractionMove(level, state, move);
  return next
    ? {
        ...next,
        history: [
          ...state.history,
          {
            pieces: state.pieces,
            filled: state.filled,
            cutsLeft: state.cutsLeft,
            nextId: state.nextId,
          },
        ],
      }
    : state;
}
export function undoFraction(state: FractionState): FractionState {
  const previous = state.history.at(-1);
  return previous
    ? { ...previous, history: state.history.slice(0, -1) }
    : state;
}
export function legalFractionMoves(
  level: FractionLevel,
  board: FractionBoard,
): FractionMove[] {
  const candidates: FractionMove[] = [];
  for (const piece of board.pieces)
    for (let tray = 0; tray < level.targets.length; tray++)
      candidates.push({ kind: "serve", piece: piece.id, tray });
  // Complete DFS, with promising finished recipes first. Cuts and piece count make the graph finite.
  const joins: FractionMove[] = [];
  for (let i = 0; i < board.pieces.length; i++)
    for (let j = i + 1; j < board.pieces.length; j++)
      joins.push({
        kind: "join",
        first: board.pieces[i].id,
        second: board.pieces[j].id,
      });
  joins.sort((a, b) => {
    const useful = (m: FractionMove) =>
      m.kind === "join" &&
      level.targets.some(
        (value, i) =>
          !board.filled[i] &&
          value ===
            board.pieces.find((p) => p.id === m.first)!.units +
              board.pieces.find((p) => p.id === m.second)!.units,
      );
    return Number(useful(b)) - Number(useful(a));
  });
  candidates.push(...joins);
  for (const piece of board.pieces)
    for (const parts of [2, 3] as const)
      candidates.push({ kind: "split", piece: piece.id, parts });
  return candidates.filter(
    (move) => applyFractionMove(level, board, move) !== null,
  );
}
export type FractionSearch = {
  status: "solved" | "found" | "unsolvable" | "limit" | "invalid";
  moves: FractionMove[];
  visited: number;
};
export function searchFraction(
  level: FractionLevel,
  board: FractionBoard,
  limit = FRACTION_SEARCH_LIMIT,
): FractionSearch {
  if (!validFractionBoard(level, board))
    return { status: "invalid", moves: [], visited: 0 };
  if (fractionWon(level, board))
    return { status: "solved", moves: [], visited: 0 };
  const seen = new Set<string>();
  let bounded = false;
  const budget = Math.max(
    0,
    Math.min(FRACTION_SEARCH_LIMIT, Math.floor(limit) || 0),
  );
  function visit(current: FractionBoard): FractionMove[] | null {
    if (fractionWon(level, current)) return [];
    const key = `${current.pieces
      .map((p) => p.units)
      .sort((a, b) => a - b)
      .join(",")}|${current.filled.map(Number).join("")}|${current.cutsLeft}`;
    if (seen.has(key)) return null;
    if (seen.size >= budget) {
      bounded = true;
      return null;
    }
    seen.add(key);
    for (const move of legalFractionMoves(level, current)) {
      const rest = visit(applyFractionMove(level, current, move)!);
      if (rest) return [move, ...rest];
      if (bounded) return null;
    }
    return null;
  }
  const route = visit(board);
  return {
    status: route ? "found" : bounded ? "limit" : "unsolvable",
    moves: route ?? [],
    visited: seen.size,
  };
}
export function fractionMoveLabel(
  level: FractionLevel,
  board: FractionBoard,
  move: FractionMove,
): string {
  const name = (id: string) =>
    formatFraction(
      board.pieces.find((p) => p.id === id)!.units,
      level.denominator,
    );
  if (move.kind === "join")
    return `把 ${name(move.first)} 和 ${name(move.second)} 合在一起`;
  if (move.kind === "split")
    return `把 ${name(move.piece)} 平均分成 ${move.parts} 片`;
  return `把 ${name(move.piece)} 放进 ${move.tray + 1} 号托盘`;
}

type Recipe =
  ["j", number, number] | ["s", number, 2 | 3] | ["t", number, number];
function makeLevel(
  title: string,
  denominator: number,
  stock: number[],
  targets: number[],
  cuts: number,
  idea: string,
  recipe: Recipe[],
): FractionLevel {
  const level: FractionLevel = {
    title,
    denominator,
    stock,
    targets,
    cuts,
    idea,
    solution: [],
  };
  let board: FractionBoard = createFractionState(level);
  for (const step of recipe) {
    const a = board.pieces.find((p) => p.units === step[1]);
    if (!a) throw new Error(`Missing fraction certificate piece: ${title}`);
    let move: FractionMove;
    if (step[0] === "j") {
      const b = board.pieces.find((p) => p.id !== a.id && p.units === step[2]);
      if (!b) throw new Error(`Missing second certificate piece: ${title}`);
      move = { kind: "join", first: a.id, second: b.id };
    } else if (step[0] === "s")
      move = { kind: "split", piece: a.id, parts: step[2] };
    else move = { kind: "serve", piece: a.id, tray: step[2] };
    const next = applyFractionMove(level, board, move);
    if (!next) throw new Error(`Invalid fraction certificate: ${title}`);
    level.solution.push(move);
    board = next;
  }
  if (!fractionWon(level, board))
    throw new Error(`Incomplete fraction certificate: ${title}`);
  return level;
}
export const fractionMosaicLevels: FractionLevel[] = [
  makeLevel(
    "半块配半块",
    4,
    [1, 1, 2],
    [2, 2],
    0,
    "两片四分之一，恰好是一片二分之一。",
    [
      ["j", 1, 1],
      ["t", 2, 0],
      ["t", 2, 1],
    ],
  ),
  makeLevel(
    "分享一块整饼",
    4,
    [4],
    [2, 2],
    1,
    "平均分成两片，分母会变，整块的总量不会变。",
    [
      ["s", 4, 2],
      ["t", 2, 0],
      ["t", 2, 1],
    ],
  ),
  makeLevel(
    "三位好朋友",
    6,
    [6],
    [2, 2, 2],
    1,
    "三等分的一片是三分之一，不是三分之三。",
    [
      ["s", 6, 3],
      ["t", 2, 0],
      ["t", 2, 1],
      ["t", 2, 2],
    ],
  ),
  makeLevel(
    "留一点给小盘",
    8,
    [4, 4],
    [6, 2],
    1,
    "先分出四分之一，再把另一片和半块拼在一起。",
    [
      ["s", 4, 2],
      ["j", 4, 2],
      ["t", 6, 0],
      ["t", 2, 1],
    ],
  ),
  makeLevel(
    "三片变两份",
    6,
    [2, 2, 2],
    [3, 3],
    1,
    "把三分之一等分成两片六分之一，再分别补给另外两片。",
    [
      ["s", 2, 2],
      ["j", 2, 1],
      ["t", 3, 0],
      ["j", 2, 1],
      ["t", 3, 1],
    ],
  ),
  makeLevel(
    "半块的三等分",
    12,
    [6, 6],
    [8, 2, 2],
    1,
    "把二分之一三等分，每片是六分之一。",
    [
      ["s", 6, 3],
      ["j", 6, 2],
      ["t", 8, 0],
      ["t", 2, 1],
      ["t", 2, 2],
    ],
  ),
  makeLevel(
    "七格与五格",
    12,
    [9, 3],
    [7, 5],
    2,
    "先得到四分之一，再把其中一片细分成十二分之一。",
    [
      ["s", 9, 3],
      ["s", 3, 3],
      ["j", 3, 3],
      ["j", 6, 1],
      ["t", 7, 0],
      ["j", 3, 1],
      ["j", 4, 1],
      ["t", 5, 1],
    ],
  ),
  makeLevel(
    "大小三只盘",
    12,
    [6, 3, 3],
    [5, 4, 3],
    2,
    "四分之一三等分能得到十二分之一；小片也有大用处。",
    [
      ["s", 6, 2],
      ["s", 3, 3],
      ["j", 3, 1],
      ["j", 4, 1],
      ["t", 5, 0],
      ["j", 3, 1],
      ["t", 4, 1],
      ["t", 3, 2],
    ],
  ),
  makeLevel(
    "三盘同样多",
    12,
    [9, 3],
    [4, 4, 4],
    2,
    "先把四分之三分成三份，再给每份补一小片。",
    [
      ["s", 9, 3],
      ["s", 3, 3],
      ["j", 3, 1],
      ["t", 4, 0],
      ["j", 3, 1],
      ["t", 4, 1],
      ["j", 3, 1],
      ["t", 4, 2],
    ],
  ),
  makeLevel(
    "七八九的配方",
    24,
    [18, 6],
    [9, 8, 7],
    3,
    "先保留已经合适的一份，其余材料再拆开规划。",
    [
      ["s", 18, 2],
      ["t", 9, 0],
      ["s", 9, 3],
      ["s", 6, 3],
      ["j", 3, 3],
      ["j", 6, 2],
      ["t", 8, 1],
      ["j", 3, 2],
      ["j", 5, 2],
      ["t", 7, 2],
    ],
  ),
  makeLevel(
    "越分越精细",
    24,
    [8, 8, 8],
    [10, 9, 5],
    3,
    "连续二等分能做出二十四分之一，记得为每盘预留材料。",
    [
      ["s", 8, 2],
      ["s", 4, 2],
      ["s", 2, 2],
      ["j", 8, 2],
      ["t", 10, 0],
      ["j", 8, 1],
      ["t", 9, 1],
      ["j", 4, 1],
      ["t", 5, 2],
    ],
  ),
  makeLevel(
    "最后的宴会",
    24,
    [12, 12],
    [11, 7, 6],
    4,
    "一半用二等分，一半用三等分，大小不同的片也能刚刚好。",
    [
      ["s", 12, 2],
      ["t", 6, 2],
      ["s", 12, 3],
      ["s", 4, 2],
      ["s", 2, 2],
      ["j", 6, 4],
      ["j", 10, 1],
      ["t", 11, 0],
      ["j", 4, 2],
      ["j", 6, 1],
      ["t", 7, 1],
    ],
  ),
];
export const fractionMosaicSolutions = fractionMosaicLevels.map(
  (level) => level.solution,
);
