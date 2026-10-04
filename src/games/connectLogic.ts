/** Original implementation of the classic four-in-a-row rules. No third-party code. */
export type ConnectPiece = 0 | 1 | 2;
export type ConnectBoard = readonly ConnectPiece[];
export const CONNECT_ROWS = 6;
export const CONNECT_COLUMNS = 7;
export const connectColumnOrder = [3, 2, 4, 1, 5, 0, 6] as const;
export const emptyConnectBoard = (): ConnectPiece[] => Array(42).fill(0);
export function connectLegalMoves(board: ConnectBoard): number[] {
  if (connectWinner(board) !== null) return [];
  return connectColumnOrder.filter((column) => board[column] === 0);
}
export function connectDrop(
  board: ConnectBoard,
  column: number,
  piece: 1 | 2,
): ConnectPiece[] | null {
  if (
    !Number.isInteger(column) ||
    column < 0 ||
    column >= 7 ||
    board[column] !== 0 ||
    connectWinner(board) !== null
  )
    return null;
  for (let row = 5; row >= 0; row--) {
    const index = row * 7 + column;
    if (!board[index]) {
      const next = [...board];
      next[index] = piece;
      return next;
    }
  }
  return null;
}
export const connectLines: readonly (readonly number[])[] = (() => {
  const lines: number[][] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 7; col++) {
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1],
      ]) {
        const endRow = row + 3 * dr,
          endCol = col + 3 * dc;
        if (endRow >= 0 && endRow < 6 && endCol >= 0 && endCol < 7)
          lines.push(
            Array.from(
              { length: 4 },
              (_, i) => (row + i * dr) * 7 + col + i * dc,
            ),
          );
      }
    }
  return lines;
})();
export function connectWinningCells(board: ConnectBoard): number[] {
  return [
    ...new Set(
      connectLines
        .filter(
          (line) =>
            board[line[0]] !== 0 &&
            line.every((i) => board[i] === board[line[0]]),
        )
        .flat(),
    ),
  ];
}
/** null: still playing; 0: draw; 1/2: winner. */
export function connectWinner(board: ConnectBoard): ConnectPiece | null {
  for (const line of connectLines)
    if (board[line[0]] !== 0 && line.every((i) => board[i] === board[line[0]]))
      return board[line[0]];
  return board.every(Boolean) ? 0 : null;
}
function evaluateConnect(board: ConnectBoard, side: 1 | 2): number {
  const opponent = side === 1 ? 2 : 1;
  let score = 0;
  for (const line of connectLines) {
    const own = line.filter((i) => board[i] === side).length;
    const other = line.filter((i) => board[i] === opponent).length;
    if (!other) score += [0, 1, 7, 45, 10000][own];
    if (!own) score -= [0, 1, 7, 45, 10000][other];
  }
  for (let row = 0; row < 6; row++)
    score +=
      board[row * 7 + 3] === side
        ? 3
        : board[row * 7 + 3] === opponent
          ? -3
          : 0;
  return score;
}
function connectNegamax(
  board: ConnectBoard,
  side: 1 | 2,
  depth: number,
  alpha: number,
  beta: number,
): number {
  const winner = connectWinner(board);
  if (winner !== null)
    return winner === 0
      ? 0
      : winner === side
        ? 100000 + depth
        : -100000 - depth;
  if (!depth) return evaluateConnect(board, side);
  let best = -Infinity;
  for (const column of connectLegalMoves(board)) {
    const next = connectDrop(board, column, side)!;
    const score = -connectNegamax(
      next,
      side === 1 ? 2 : 1,
      depth - 1,
      -beta,
      -alpha,
    );
    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  return best;
}
/** Deterministic local opponent. Center-first ties, immediate wins and threats included. */
export function chooseConnectMove(
  board: ConnectBoard,
  side: 1 | 2 = 2,
  depth = 3,
): number | null {
  if (connectWinner(board) !== null) return null;
  const searchDepth = Number.isFinite(depth)
    ? Math.max(1, Math.min(3, Math.floor(depth)))
    : 3;
  let best = -Infinity,
    chosen: number | null = null;
  for (const column of connectLegalMoves(board)) {
    const next = connectDrop(board, column, side)!;
    const score = -connectNegamax(
      next,
      side === 1 ? 2 : 1,
      searchDepth - 1,
      -Infinity,
      -best,
    );
    if (score > best) {
      best = score;
      chosen = column;
    }
  }
  return chosen;
}
export function connectBoardFromMoves(
  moves: readonly number[],
): ConnectPiece[] {
  let board = emptyConnectBoard();
  moves.forEach((column, index) => {
    const next = connectDrop(board, column, index % 2 === 0 ? 1 : 2);
    if (!next) throw new Error(`Illegal starting move ${index}: ${column}`);
    board = next;
  });
  return board;
}
/** Each AI evaluation is capped at three plies (at most 7 + 49 + 343 nodes).
 * A detour hint may spend at most 24 such evaluations and four player turns.
 * Null means no certificate was found within this deterministic work budget.
 */
export const CONNECT_HINT_AI_LIMIT = 24;
export type ConnectSearchResult = {
  solution: number[] | null;
  aiEvaluations: number;
  exhausted: boolean;
};
export function searchConnectChallenge(
  board: ConnectBoard,
  turns: number,
): ConnectSearchResult {
  const cache = new Map<string, number[] | null>();
  let aiEvaluations = 0,
    exhausted = false;
  const evaluate = (position: ConnectBoard, side: 1 | 2) => {
    if (aiEvaluations >= CONNECT_HINT_AI_LIMIT) {
      exhausted = true;
      return null;
    }
    aiEvaluations++;
    return chooseConnectMove(position, side);
  };
  function solve(current: ConnectBoard, remaining: number): number[] | null {
    if (connectWinner(current) === 1) return [];
    if (connectWinner(current) !== null || remaining <= 0 || exhausted)
      return null;
    const key = current.join("") + remaining;
    if (cache.has(key)) return cache.get(key)!;
    const suggested = evaluate(current, 1);
    if (exhausted) return null;
    const options = [
      ...new Set([suggested, ...connectLegalMoves(current)]),
    ].filter((c): c is number => c !== null);
    for (const column of options) {
      let next = connectDrop(current, column, 1)!;
      if (connectWinner(next) === 1) return [column];
      if (remaining === 1) continue;
      const reply = evaluate(next, 2);
      if (exhausted) return null;
      if (reply === null) continue;
      next = connectDrop(next, reply, 2)!;
      const rest = solve(next, remaining - 1);
      if (rest) {
        const result = [column, ...rest];
        cache.set(key, result);
        return result;
      }
    }
    cache.set(key, null);
    return null;
  }
  const remaining = Number.isFinite(turns)
    ? Math.max(0, Math.min(4, Math.floor(turns)))
    : 4;
  const solution = solve(board, remaining);
  return { solution, aiEvaluations, exhausted };
}
export function solveConnectChallenge(
  board: ConnectBoard,
  turns: number,
): number[] | null {
  return searchConnectChallenge(board, turns).solution;
}
export type ConnectLevel = {
  title: string;
  theme: string;
  goal: string;
  hint: string;
  startMoves: readonly number[];
  board: ConnectBoard;
  maxTurns: number;
  solution: readonly number[];
};
// Each setup comes from a legal alternating game; certificates are replayed in tests.
const connectSetups: {
  title: string;
  theme: string;
  hint: string;
  moves: number[];
  solution: number[];
}[] = [
  {
    title: "第一条花径",
    theme: "水平连接",
    hint: "看看最下方的三个圆点，右边还留着一个空位。",
    moves: [0, 6, 1, 6, 2, 5],
    solution: [3],
  },
  {
    title: "向上生长",
    theme: "垂直连接",
    hint: "同一列的三颗种子，再添一颗就能向上连成四颗。",
    moves: [2, 5, 2, 5, 2, 6],
    solution: [2],
  },
  {
    title: "斜坡花园",
    theme: "对角观察",
    hint: "从左下方沿着斜线往右上看；落子需要有下方棋子的支撑。",
    moves: [0, 1, 1, 2, 3, 2, 2, 3, 3, 4],
    solution: [3],
  },
  {
    title: "中间的空隙",
    theme: "两步布局",
    hint: "先在中央补上一颗，为下一手搭出连接。",
    moves: [2, 4, 5, 6, 2, 1, 4, 0, 4, 6, 6, 0, 1, 0, 4, 5, 0, 1, 5, 4],
    solution: [3, 3],
  },
  {
    title: "左右呼应",
    theme: "交叉威胁",
    hint: "让对手忙着防守，再利用它落下的棋子。",
    moves: [1, 3, 1, 6, 0, 2, 2, 6, 2, 2, 5, 1, 3, 0],
    solution: [4, 3],
  },
  {
    title: "高处开花",
    theme: "纵向推进",
    hint: "注意右侧较高的一列，连续的威胁能迫使对手回应。",
    moves: [0, 4, 0, 6, 6, 3, 5, 2, 5, 2, 6, 4, 3, 6, 4, 4, 1, 4],
    solution: [5, 5],
  },
  {
    title: "侧翼阶梯",
    theme: "三步组合",
    hint: "先在右侧搭一层台阶，再回到中间完成连接。",
    moves: [0, 0, 6, 6, 4, 6, 0, 0, 5, 3, 3, 4, 4, 3, 0, 0, 6, 5],
    solution: [5, 5, 2],
  },
  {
    title: "远近协作",
    theme: "转移进攻",
    hint: "边线的棋子也能帮忙，别只盯着棋盘中心。",
    moves: [0, 2, 4, 6, 6, 2, 2, 0, 4, 5, 5, 1, 6, 0, 2, 2],
    solution: [6, 3, 5],
  },
  {
    title: "穿过花丛",
    theme: "连续威胁",
    hint: "比较每一列落子后能够新建的两条连接。",
    moves: [2, 0, 0, 2, 5, 4, 5, 4, 6, 1, 1, 1, 6, 6, 5, 3, 3, 6, 6, 5],
    solution: [2, 4, 3],
  },
  {
    title: "四步小计划",
    theme: "提前规划",
    hint: "先从左侧较矮的列生长，给后面的横向连接留下空间。",
    moves: [1, 4, 0, 4, 3, 6, 4, 2, 4, 5, 4, 4, 1, 0],
    solution: [1, 1, 3, 2],
  },
  {
    title: "交错的枝条",
    theme: "多线观察",
    hint: "从第三列开始，观察对手回应之后新出现的落点。",
    moves: [0, 4, 1, 0, 0, 2, 6, 0, 3, 2, 1, 4, 0, 0],
    solution: [2, 4, 3, 1],
  },
  {
    title: "花径设计师",
    theme: "完整战术",
    hint: "先稳住左侧的连接，再让右侧一列逐步向上生长。",
    moves: [4, 5, 5, 0, 6, 5, 3, 1, 0, 3],
    solution: [2, 4, 4, 4],
  },
];
export const connectLevels: readonly ConnectLevel[] = connectSetups.map(
  (setup) => ({
    title: setup.title,
    theme: setup.theme,
    hint: setup.hint,
    startMoves: setup.moves,
    board: connectBoardFromMoves(setup.moves),
    maxTurns: setup.solution.length,
    goal: `在自己的 ${setup.solution.length} 步内，把四颗绿色棋子连成直线。`,
    solution: setup.solution,
  }),
);
export function connectCertifiedWin(level: ConnectLevel): boolean {
  let board = [...level.board];
  for (const column of level.solution) {
    const next = connectDrop(board, column, 1);
    if (!next) return false;
    board = next;
    if (connectWinner(board) === 1)
      return level.solution.length <= level.maxTurns;
    const reply = chooseConnectMove(board);
    if (reply === null) return false;
    board = connectDrop(board, reply, 2)!;
  }
  return false;
}

export type ConnectSnapshot = {
  board: ConnectBoard;
  turn: ConnectPiece;
  moves: number;
  lastMove: number | null;
};
export type ConnectState = ConnectSnapshot & {
  history: readonly ConnectSnapshot[];
};
export function createConnectState(level: ConnectLevel): ConnectState {
  return {
    board: [...level.board],
    turn: 1,
    moves: 0,
    lastMove: null,
    history: [],
  };
}
export function playConnectTurn(
  state: ConnectState,
  level: ConnectLevel,
  column: number,
  paused = false,
): ConnectState {
  if (paused || state.turn !== 1 || state.moves >= level.maxTurns) return state;
  const board = connectDrop(state.board, column, 1);
  if (!board) return state;
  const { history, ...snapshot } = state;
  return {
    board,
    moves: state.moves + 1,
    lastMove: board.findIndex((p, i) => p !== state.board[i]),
    turn:
      connectWinner(board) !== null || state.moves + 1 >= level.maxTurns
        ? 0
        : 2,
    history: [...history, snapshot],
  };
}
export function replyConnectTurn(
  state: ConnectState,
  paused = false,
): ConnectState {
  if (paused || state.turn !== 2) return state;
  const column = chooseConnectMove(state.board);
  if (column === null) return { ...state, turn: 0 };
  const board = connectDrop(state.board, column, 2)!;
  return {
    ...state,
    board,
    lastMove: board.findIndex((p, i) => p !== state.board[i]),
    turn: connectWinner(board) === null ? 1 : 0,
  };
}
export function undoConnectTurn(
  state: ConnectState,
  paused = false,
): ConnectState {
  const previous = state.history.at(-1);
  return paused || !previous
    ? state
    : { ...previous, history: state.history.slice(0, -1) };
}

/** Prefer the pre-verified route when the board lies on it; search only after a detour. */
export function connectChallengeHint(
  level: ConnectLevel,
  board: ConnectBoard,
  remaining: number,
): number[] | null {
  let certified = level.board;
  for (let step = 0; step < level.solution.length; step++) {
    if (certified.every((piece, index) => piece === board[index]))
      return level.solution.slice(step, step + remaining);
    const next = connectDrop(certified, level.solution[step], 1);
    if (!next || connectWinner(next) !== null) break;
    const reply = chooseConnectMove(next);
    if (reply === null) break;
    certified = connectDrop(next, reply, 2)!;
  }
  return solveConnectChallenge(board, remaining);
}
