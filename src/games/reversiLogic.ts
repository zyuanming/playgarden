/** Original, pure implementation of classic disc-flipping rules. */
export type ReversiPiece = 0 | 1 | 2;
export type ReversiBoard = readonly ReversiPiece[];
export const reversiDirections: readonly (readonly [number, number])[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];
export function initialReversiBoard(size: number): ReversiPiece[] {
  const board: ReversiPiece[] = Array(size * size).fill(0),
    middle = size / 2;
  board[(middle - 1) * size + middle - 1] = 2;
  board[middle * size + middle] = 2;
  board[(middle - 1) * size + middle] = 1;
  board[middle * size + middle - 1] = 1;
  return board;
}
export function reversiFlips(
  board: ReversiBoard,
  size: number,
  index: number,
  side: 1 | 2,
): number[] {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= size * size ||
    board[index] !== 0
  )
    return [];
  const row = Math.floor(index / size),
    col = index % size,
    opponent = side === 1 ? 2 : 1;
  const flips: number[] = [];
  for (const [dr, dc] of reversiDirections) {
    let r = row + dr,
      c = col + dc;
    const ray: number[] = [];
    while (
      r >= 0 &&
      r < size &&
      c >= 0 &&
      c < size &&
      board[r * size + c] === opponent
    ) {
      ray.push(r * size + c);
      r += dr;
      c += dc;
    }
    if (
      ray.length &&
      r >= 0 &&
      r < size &&
      c >= 0 &&
      c < size &&
      board[r * size + c] === side
    )
      flips.push(...ray);
  }
  return flips;
}
export function reversiLegalMoves(
  board: ReversiBoard,
  size: number,
  side: 1 | 2,
): number[] {
  return board.flatMap((piece, index) =>
    piece === 0 && reversiFlips(board, size, index, side).length ? [index] : [],
  );
}
export function reversiPlace(
  board: ReversiBoard,
  size: number,
  index: number,
  side: 1 | 2,
): ReversiPiece[] | null {
  const flips = reversiFlips(board, size, index, side);
  if (!flips.length) return null;
  const next = [...board];
  for (const cell of [index, ...flips]) next[cell] = side;
  return next;
}
export function reversiScore(board: ReversiBoard): {
  player: number;
  opponent: number;
  empty: number;
} {
  return {
    player: board.filter((p) => p === 1).length,
    opponent: board.filter((p) => p === 2).length,
    empty: board.filter((p) => p === 0).length,
  };
}
export function reversiWinner(
  board: ReversiBoard,
  size: number,
): ReversiPiece | null {
  if (
    reversiLegalMoves(board, size, 1).length ||
    reversiLegalMoves(board, size, 2).length
  )
    return null;
  const { player, opponent } = reversiScore(board);
  return player === opponent ? 0 : player > opponent ? 1 : 2;
}
/** After a move, skip a side with no moves; 0 means neither side can move. */
export function reversiNextTurn(
  board: ReversiBoard,
  size: number,
  played: 1 | 2,
): ReversiPiece {
  const next = played === 1 ? 2 : 1;
  if (reversiLegalMoves(board, size, next).length) return next;
  return reversiLegalMoves(board, size, played).length ? played : 0;
}
function reversiMoveOrder(moves: number[], size: number): number[] {
  const corners = [0, size - 1, size * (size - 1), size * size - 1];
  return [...moves].sort(
    (a, b) =>
      Number(corners.includes(b)) - Number(corners.includes(a)) || a - b,
  );
}
export const REVERSI_ENDGAME_MAX_EMPTY = 8;
/** Exact endgame minimax. Eight remaining squares bound the whole tree to
 * at most sum(P(8,k), k=0..8) = 109601 placements, plus forced-pass nodes. */
export function solveReversiEndgame(
  board: ReversiBoard,
  size: number,
  side: 1 | 2,
): { move: number | null; score: number } {
  if (reversiScore(board).empty > REVERSI_ENDGAME_MAX_EMPTY) {
    throw new RangeError("Endgame search is limited to eight empty squares");
  }
  const cache = new Map<
    string,
    { value: number; flag: "exact" | "lower" | "upper" }
  >();
  function search(
    current: ReversiBoard,
    turn: 1 | 2,
    alpha: number,
    beta: number,
  ): number {
    const key = current.join("") + turn;
    const originalAlpha = alpha,
      originalBeta = beta;
    const cached = cache.get(key);
    if (cached) {
      if (cached.flag === "exact") return cached.value;
      if (cached.flag === "lower") alpha = Math.max(alpha, cached.value);
      else beta = Math.min(beta, cached.value);
      if (alpha >= beta) return cached.value;
    }
    const moves = reversiMoveOrder(
      reversiLegalMoves(current, size, turn),
      size,
    );
    if (!moves.length) {
      if (!reversiLegalMoves(current, size, turn === 1 ? 2 : 1).length) {
        const score = reversiScore(current);
        return score.player - score.opponent;
      }
      return search(current, turn === 1 ? 2 : 1, alpha, beta);
    }
    let value = turn === 1 ? -Infinity : Infinity;
    for (const move of moves) {
      const next = reversiPlace(current, size, move, turn)!;
      const score = search(next, turn === 1 ? 2 : 1, alpha, beta);
      value = turn === 1 ? Math.max(value, score) : Math.min(value, score);
      if (turn === 1) alpha = Math.max(alpha, value);
      else beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    cache.set(key, {
      value,
      flag:
        value <= originalAlpha
          ? "upper"
          : value >= originalBeta
            ? "lower"
            : "exact",
    });
    return value;
  }
  const moves = reversiMoveOrder(reversiLegalMoves(board, size, side), size);
  if (!moves.length)
    return { move: null, score: search(board, side, -Infinity, Infinity) };
  let best = side === 1 ? -Infinity : Infinity,
    chosen: number | null = null;
  for (const move of moves) {
    const score = search(
      reversiPlace(board, size, move, side)!,
      side === 1 ? 2 : 1,
      -Infinity,
      Infinity,
    );
    if (chosen === null || (side === 1 ? score > best : score < best)) {
      best = score;
      chosen = move;
    }
  }
  return { move: chosen, score: best };
}
export const chooseReversiMove = (
  board: ReversiBoard,
  size: number,
  side: 1 | 2 = 2,
): number | null => solveReversiEndgame(board, size, side).move;
export type ReversiLevel = {
  title: string;
  theme: string;
  goal: string;
  hint: string;
  size: number;
  startMoves: readonly number[];
  board: ReversiBoard;
  target: number;
  solution: readonly number[];
};
export function reversiBoardFromMoves(
  size: number,
  moves: readonly number[],
): ReversiPiece[] {
  let board = initialReversiBoard(size),
    turn: ReversiPiece = 1;
  for (const move of moves) {
    if (!turn) throw new Error("Starting game already ended");
    const next = reversiPlace(board, size, move, turn);
    if (!next) throw new Error(`Illegal starting move ${move}`);
    board = next;
    turn = reversiNextTurn(board, size, turn);
  }
  if (turn !== 1) throw new Error("The player must move first in a challenge");
  return board;
}
const reversiSetups = [
  {
    title: "守住一个角",
    theme: "角落不会翻转",
    size: 4,
    moves: [1, 2, 3, 0, 14, 7, 8, 15, 11, 13],
    solution: [12],
    target: 9,
    hint: "角落一旦变成你的颜色，就不会再被夹住。比较两个落点的最终结果。",
  },
  {
    title: "两端的选择",
    theme: "先后顺序",
    size: 4,
    moves: [14, 15, 11, 13, 12, 4, 0, 7, 8],
    solution: [3, 2],
    target: 9,
    hint: "先拿右上角，再观察最后一个可以翻转的方向。",
  },
  {
    title: "留下一格",
    theme: "提前结束",
    size: 4,
    moves: [11, 13, 0, 7, 15, 3, 8, 4],
    solution: [1, 2],
    target: 8,
    hint: "棋盘不一定填满才结束；双方都不能翻子时就会数分。",
  },
  {
    title: "借边生长",
    theme: "让对手停一手",
    size: 4,
    moves: [14, 13, 4, 15, 7, 11, 1],
    solution: [8, 3, 0],
    target: 10,
    hint: "落子多不一定更好。试试左边中间的空位，留住后续的角。",
  },
  {
    title: "耐心的边线",
    theme: "保留后手",
    size: 4,
    moves: [14, 15, 11, 13, 0, 2],
    solution: [1, 7, 4, 12],
    target: 10,
    hint: "从上边开始；对手无合法落点时，你会自动再走一手。",
  },
  {
    title: "小园终局",
    theme: "七格深算",
    size: 4,
    moves: [4, 8, 14, 0, 11],
    solution: [12, 15, 7, 3],
    target: 9,
    hint: "先从左下角打开局面，右下角也值得保护。",
  },
  {
    title: "走进大花园",
    theme: "六乘六棋盘",
    size: 6,
    moves: [
      27, 16, 8, 26, 32, 25, 18, 34, 17, 31, 30, 7, 33, 11, 35, 24, 6, 28, 23,
      2, 19, 12, 9, 0, 13, 10, 22, 29, 1,
    ],
    solution: [5, 3],
    target: 25,
    hint: "棋盘更大了，角落的价值没有变。先观察右上方。",
  },
  {
    title: "沿边留白",
    theme: "边角呼应",
    size: 6,
    moves: [
      22, 26, 19, 16, 9, 12, 28, 2, 32, 27, 11, 25, 4, 23, 10, 8, 18, 13, 1, 31,
      30, 0, 6, 29, 17, 33, 7, 3,
    ],
    solution: [35, 24],
    target: 20,
    hint: "选一个稳固的角，之后再处理左边的空位。",
  },
  {
    title: "最后的主动权",
    theme: "应对自动跳过",
    size: 6,
    moves: [
      8, 9, 16, 11, 17, 7, 3, 4, 22, 26, 19, 24, 2, 27, 18, 12, 28, 35, 10, 1,
      5, 13, 0, 29, 6, 34, 25,
    ],
    solution: [30, 31],
    target: 22,
    hint: "左下角可以稳住优势。有时你需要让对手连续走完余下几步。",
  },
  {
    title: "向四周展开",
    theme: "多方向翻转",
    size: 6,
    moves: [
      27, 28, 8, 7, 13, 19, 35, 10, 16, 34, 0, 3, 1, 22, 26, 9, 29, 32, 5, 17,
      33, 6, 25, 24, 4, 11,
    ],
    solution: [23, 2, 18, 31],
    target: 31,
    hint: "右边第四行的空位能改变局面的连通关系。",
  },
  {
    title: "角与节奏",
    theme: "七步终局",
    size: 6,
    moves: [
      22, 28, 13, 16, 35, 26, 17, 7, 31, 8, 1, 25, 29, 27, 24, 23, 34, 32, 0,
      33, 2, 19, 18, 9, 10,
    ],
    solution: [5, 12, 3, 6],
    target: 21,
    hint: "先保住右上角，再用左侧的落点改变边线。",
  },
  {
    title: "终局园艺师",
    theme: "八格全局",
    size: 6,
    moves: [
      8, 7, 13, 9, 16, 18, 2, 17, 23, 1, 22, 10, 6, 3, 0, 26, 4, 27, 31, 32, 34,
      25, 19, 24,
    ],
    solution: [33, 30, 35, 29],
    target: 22,
    hint: "不要急着抢眼前的角。最下方第四列会为后续两角铺路。",
  },
];
export const reversiLevels: readonly ReversiLevel[] = reversiSetups.map(
  (setup) => ({
    ...setup,
    startMoves: setup.moves,
    board: reversiBoardFromMoves(setup.size, setup.moves),
    goal: `对局结束时至少拥有 ${setup.target} 颗绿色棋子，并比对手更多。`,
  }),
);
export function reversiCertifiedWin(level: ReversiLevel): boolean {
  let board = [...level.board],
    turn: ReversiPiece = 1,
    index = 0;
  while (turn) {
    const move =
      turn === 1
        ? level.solution[index++]
        : chooseReversiMove(board, level.size);
    if (move === null || move === undefined) return false;
    const next = reversiPlace(board, level.size, move, turn);
    if (!next) return false;
    board = next;
    turn = reversiNextTurn(board, level.size, turn);
  }
  return (
    reversiWinner(board, level.size) === 1 &&
    reversiScore(board).player >= level.target &&
    index === level.solution.length
  );
}

export type ReversiSnapshot = {
  board: ReversiBoard;
  turn: ReversiPiece;
  moves: number;
  lastMove: number | null;
  flipped: readonly number[];
  skipped: ReversiPiece;
};
export type ReversiState = ReversiSnapshot & {
  history: readonly ReversiSnapshot[];
};
export function createReversiState(level: ReversiLevel): ReversiState {
  return {
    board: [...level.board],
    turn: 1,
    moves: 0,
    lastMove: null,
    flipped: [],
    skipped: 0,
    history: [],
  };
}
function settleReversiMove(
  state: ReversiState,
  size: number,
  index: number,
  side: 1 | 2,
): ReversiState {
  const board = reversiPlace(state.board, size, index, side);
  if (!board) return state;
  const turn = reversiNextTurn(board, size, side);
  return {
    ...state,
    board,
    turn,
    lastMove: index,
    flipped: reversiFlips(state.board, size, index, side),
    skipped: turn === side ? (side === 1 ? 2 : 1) : 0,
  };
}
export function playReversiTurn(
  state: ReversiState,
  level: ReversiLevel,
  index: number,
  paused = false,
): ReversiState {
  if (paused || state.turn !== 1) return state;
  const next = settleReversiMove(state, level.size, index, 1);
  if (next === state) return state;
  const { history, ...snapshot } = state;
  return { ...next, moves: state.moves + 1, history: [...history, snapshot] };
}
export function replyReversiTurn(
  state: ReversiState,
  level: ReversiLevel,
  paused = false,
): ReversiState {
  if (paused || state.turn !== 2) return state;
  const move = chooseReversiMove(state.board, level.size);
  if (move === null)
    return {
      ...state,
      turn: reversiNextTurn(state.board, level.size, 2),
      skipped: 2,
    };
  return settleReversiMove(state, level.size, move, 2);
}
export function undoReversiTurn(
  state: ReversiState,
  paused = false,
): ReversiState {
  const previous = state.history.at(-1);
  return paused || !previous
    ? state
    : { ...previous, history: state.history.slice(0, -1) };
}
