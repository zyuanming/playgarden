/** Original GPL-3.0-only implementation of Hex. No external code or assets. */
export type HexPlayer = 1 | 2;
export type HexPiece = 0 | HexPlayer;
export type HexBoard = readonly HexPiece[];
export const HEX_AI_DELAY = 620;
export const HEX_SEARCH_NODES = 24000;
export const HEX_SEARCH_DEPTH = 11;
export const HEX_SELECTORS = {
  board: '[data-testid="hex-board"]',
  cell: (index: number) => `[data-hex-cell="${index}"]`,
};
export function validHexBoard(board: HexBoard, size: number): boolean {
  return (
    Number.isInteger(size) &&
    size >= 2 &&
    size <= 5 &&
    board.length === size * size &&
    board.every((p) => p === 0 || p === 1 || p === 2)
  );
}
export function hexNeighbors(index: number, size: number): number[] {
  const row = Math.floor(index / size),
    col = index % size;
  return [
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
  ].flatMap(([dr, dc]) => {
    const r = row + dr,
      c = col + dc;
    return r >= 0 && r < size && c >= 0 && c < size ? [r * size + c] : [];
  });
}
/** Green connects top/bottom. White connects left/right. Adjacent hexes only. */
export function hexWinningPath(
  board: HexBoard,
  size: number,
  side: HexPlayer,
): number[] {
  const queue: number[] = [],
    previous = new Map<number, number>();
  for (let i = 0; i < size; i++) {
    const index = side === 1 ? i : i * size;
    if (board[index] === side) {
      queue.push(index);
      previous.set(index, -1);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    if (
      side === 1
        ? Math.floor(index / size) === size - 1
        : index % size === size - 1
    ) {
      const path: number[] = [];
      let cursor = index;
      while (cursor !== -1) {
        path.unshift(cursor);
        cursor = previous.get(cursor)!;
      }
      return path;
    }
    for (const neighbor of hexNeighbors(index, size))
      if (board[neighbor] === side && !previous.has(neighbor)) {
        previous.set(neighbor, index);
        queue.push(neighbor);
      }
  }
  return [];
}
export function hexWinner(board: HexBoard, size: number): HexPlayer | null {
  if (hexWinningPath(board, size, 1).length) return 1;
  if (hexWinningPath(board, size, 2).length) return 2;
  return null;
}
export function hexLegalMoves(board: HexBoard, size: number): number[] {
  if (!validHexBoard(board, size) || hexWinner(board, size) !== null) return [];
  return board.flatMap((piece, index) => (piece === 0 ? [index] : []));
}
export function placeHex(
  board: HexBoard,
  size: number,
  side: HexPlayer,
  index: number,
): HexPiece[] | null {
  if (
    (side !== 1 && side !== 2) ||
    !Number.isInteger(index) ||
    !hexLegalMoves(board, size).includes(index)
  )
    return null;
  const next = [...board];
  next[index] = side;
  return next;
}
/** Minimum still-empty cells in a possible route. Blocked routes get size²+1. */
export function hexConnectionCost(
  board: HexBoard,
  size: number,
  side: HexPlayer,
): number {
  const distances = Array<number>(board.length).fill(Infinity),
    used = new Set<number>();
  for (let i = 0; i < size; i++) {
    const index = side === 1 ? i : i * size;
    if (board[index] !== 3 - side) distances[index] = board[index] ? 0 : 1;
  }
  for (let count = 0; count < board.length; count++) {
    let current = -1;
    for (let i = 0; i < board.length; i++)
      if (
        !used.has(i) &&
        Number.isFinite(distances[i]) &&
        (current < 0 || distances[i] < distances[current])
      )
        current = i;
    if (current < 0) break;
    if (
      side === 1
        ? Math.floor(current / size) === size - 1
        : current % size === size - 1
    )
      return distances[current];
    used.add(current);
    for (const next of hexNeighbors(current, size))
      if (board[next] !== 3 - side)
        distances[next] = Math.min(
          distances[next],
          distances[current] + (board[next] ? 0 : 1),
        );
  }
  return size * size + 1;
}
export type HexSearch = {
  move: number | null;
  score: number;
  nodes: number;
  exact: boolean;
  outcome: "win" | "loss" | "unknown";
};
/** Fixed deterministic alpha-beta, at most 24,000 visited nodes and 11 plies.
 * Any budget/depth cutoff makes the whole report an estimate, never a proof. */
export function searchHex(
  board: HexBoard,
  size: number,
  side: HexPlayer = 1,
  nodeLimit = HEX_SEARCH_NODES,
  depthLimit = HEX_SEARCH_DEPTH,
): HexSearch {
  if (!validHexBoard(board, size) || (side !== 1 && side !== 2))
    return { move: null, score: 0, nodes: 0, exact: false, outcome: "unknown" };
  const limit = Number.isFinite(nodeLimit)
    ? Math.max(1, Math.min(HEX_SEARCH_NODES, Math.floor(nodeLimit)))
    : HEX_SEARCH_NODES;
  const depth = Number.isFinite(depthLimit)
    ? Math.max(1, Math.min(HEX_SEARCH_DEPTH, Math.floor(depthLimit)))
    : HEX_SEARCH_DEPTH;
  let nodes = 0,
    exact = true;
  const memo = new Map<string, number>();
  const terminal = (position: HexBoard): number | null => {
    const winner = hexWinner(position, size);
    return winner === null ? null : winner === 1 ? 1000 : -1000;
  };
  const estimate = (position: HexBoard) =>
    (hexConnectionCost(position, size, 2) -
      hexConnectionCost(position, size, 1)) *
    10;
  function visit(
    position: HexBoard,
    player: HexPlayer,
    remaining: number,
    alpha: number,
    beta: number,
  ): number {
    const signature = `${position.join("")}:${player}:${remaining}`;
    const cached = memo.get(signature);
    if (cached !== undefined) return cached;
    if (nodes >= limit) {
      exact = false;
      return estimate(position);
    }
    nodes++;
    const end = terminal(position);
    if (end !== null) return end;
    if (!remaining) {
      exact = false;
      return estimate(position);
    }
    let best = player === 1 ? -Infinity : Infinity;
    const alphaStart = alpha,
      betaStart = beta,
      wasExact = exact;
    for (let i = 0; i < position.length; i++)
      if (!position[i]) {
        const next = [...position];
        next[i] = player;
        const value = visit(
          next,
          player === 1 ? 2 : 1,
          remaining - 1,
          alpha,
          beta,
        );
        best = player === 1 ? Math.max(best, value) : Math.min(best, value);
        if (player === 1) alpha = Math.max(alpha, best);
        else beta = Math.min(beta, best);
        if (nodes >= limit) {
          exact = false;
          break;
        }
        if (alpha >= beta) break;
      }
    if (wasExact && exact && best > alphaStart && best < betaStart)
      memo.set(signature, best);
    return best;
  }
  const end = terminal(board);
  let move: number | null = null,
    score = end ?? (side === 1 ? -Infinity : Infinity);
  if (end === null)
    for (const index of hexLegalMoves(board, size)) {
      if (nodes >= limit) {
        exact = false;
        break;
      }
      const next = [...board];
      next[index] = side;
      const value = visit(
        next,
        side === 1 ? 2 : 1,
        depth - 1,
        -Infinity,
        Infinity,
      );
      if (move === null || (side === 1 ? value > score : value < score)) {
        move = index;
        score = value;
      }
    }
  return {
    move,
    score,
    nodes,
    exact,
    outcome: !exact
      ? "unknown"
      : (side === 1 ? score > 0 : score < 0)
        ? "win"
        : "loss",
  };
}
export const chooseHexMove = (
  board: HexBoard,
  size: number,
  side: HexPlayer = 2,
): number | null => searchHex(board, size, side).move;
export type HexLevel = {
  title: string;
  size: number;
  startMoves: readonly number[];
  board: HexBoard;
  idea: string;
  solution: readonly number[];
};
export function hexBoardFromMoves(
  size: number,
  moves: readonly number[],
): HexPiece[] {
  let board: HexPiece[] = Array(size * size).fill(0);
  for (const [index, move] of moves.entries()) {
    const next = placeHex(board, size, index % 2 ? 2 : 1, move);
    if (!next) throw new Error(`Invalid Hex opening at ${index}`);
    board = next;
  }
  return board;
}
export type HexSnapshot = {
  board: HexPiece[];
  size: number;
  turn: 0 | HexPlayer;
  moves: number;
  lastMove: number | null;
};
export type HexState = HexSnapshot & { history: HexSnapshot[] };
export function createHexState(
  level: Pick<HexLevel, "size" | "board">,
): HexState {
  if (!validHexBoard(level.board, level.size))
    throw new Error("Invalid Hex board");
  return {
    board: [...level.board],
    size: level.size,
    turn: hexWinner(level.board, level.size) === null ? 1 : 0,
    moves: 0,
    lastMove: null,
    history: [],
  };
}
export function playHexTurn(
  state: HexState,
  index: number,
  paused = false,
): HexState {
  if (paused || state.turn !== 1) return state;
  const board = placeHex(state.board, state.size, 1, index);
  if (!board) return state;
  const { history, ...snapshot } = state;
  return {
    ...snapshot,
    board,
    turn: hexWinner(board, state.size) === null ? 2 : 0,
    moves: state.moves + 1,
    lastMove: index,
    history: [...history, snapshot],
  };
}
export function replyHexTurn(state: HexState): HexState {
  if (state.turn !== 2) return state;
  const index = chooseHexMove(state.board, state.size);
  if (index === null) return state;
  const board = placeHex(state.board, state.size, 2, index)!;
  return {
    ...state,
    board,
    turn: hexWinner(board, state.size) === null ? 1 : 0,
    lastMove: index,
  };
}
export function undoHexTurn(state: HexState): HexState {
  const previous = state.history.at(-1);
  return previous
    ? { ...previous, history: state.history.slice(0, -1) }
    : state;
}
const hexStudies: Omit<HexLevel, "board">[] = [
  {
    title: "桥边新芽",
    size: 3,
    startMoves: [4, 1, 2, 6, 0, 5, 3, 8],
    solution: [7],
    idea: "只缺一格就能连通上下绿岸，先沿着绿叶看一遍。",
  },
  {
    title: "两个出口",
    size: 3,
    startMoves: [4, 6, 1, 2, 0, 5],
    solution: [7],
    idea: "两条出路中，哪一格能让上岸与下岸直接相遇？",
  },
  {
    title: "斜向接力",
    size: 3,
    startMoves: [5, 8, 4, 7],
    solution: [6, 1],
    idea: "共享斜边也算相邻。先搭起中间的连接点。",
  },
  {
    title: "争取中路",
    size: 3,
    startMoves: [3, 4],
    solution: [2, 1, 6],
    idea: "对手已经占住中心；试着从一侧连接过去。",
  },
  {
    title: "穿过窄缝",
    size: 4,
    startMoves: [12, 8, 6, 1, 0, 3, 2, 9, 11, 5],
    solution: [4, 10, 14],
    idea: "留意白花之间的窄缝，一枚棋子可以连接两片绿叶。",
  },
  {
    title: "两路汇流",
    size: 4,
    startMoves: [6, 1, 3, 14, 9, 8, 7, 11],
    solution: [0, 4, 10, 13],
    idea: "先保证上岸入口，再把中段与下岸接起来。",
  },
  {
    title: "绕开封锁",
    size: 4,
    startMoves: [10, 3, 12, 15, 7, 0],
    solution: [2, 4, 6, 9],
    idea: "看整条路线，而不是只在已有绿叶旁边落子。",
  },
  {
    title: "守住回环",
    size: 4,
    startMoves: [8, 7, 12, 5, 11, 0],
    solution: [1, 3, 6, 10, 14],
    idea: "每步都要留意左右白岸的距离，再选择自己的转折。",
  },
  {
    title: "五岸寻径",
    size: 5,
    startMoves: [
      7, 24, 6, 11, 15, 19, 3, 21, 9, 23, 0, 18, 2, 8, 13, 14, 20, 22,
    ],
    solution: [4, 5, 16, 17],
    idea: "棋盘变大了，边缘上的绿叶也可以成为重要的连接点。",
  },
  {
    title: "留白的连接",
    size: 5,
    startMoves: [21, 12, 7, 14, 16, 15, 23, 2, 11, 5, 10, 0, 13, 8],
    solution: [1, 4, 9, 18],
    idea: "空白变多，选择也多了；先看哪一边还留着两条出路。",
  },
  {
    title: "迂回长径",
    size: 5,
    startMoves: [3, 18, 2, 17, 14, 7, 13, 1, 5, 4, 11, 22, 15, 21, 0, 20],
    solution: [19, 8, 10, 16, 24],
    idea: "先连稳底部的出口，再修补中间的间隙。",
  },
  {
    title: "最后一座桥",
    size: 5,
    startMoves: [20, 8, 4, 16, 7, 21, 11, 0, 1, 14, 23, 2, 15, 3],
    solution: [5, 9, 13, 17, 22],
    idea: "白花封住直路时，绕行同样能让上下岸相遇。",
  },
];
export const hexLevels: readonly HexLevel[] = hexStudies.map((level) => ({
  ...level,
  board: hexBoardFromMoves(level.size, level.startMoves),
}));
export function hexCertifiedWin(level: HexLevel): boolean {
  let state = createHexState(level);
  for (const move of level.solution) {
    const next = playHexTurn(state, move);
    if (next === state) return false;
    state = replyHexTurn(next);
  }
  return state.turn === 0 && hexWinner(state.board, state.size) === 1;
}
