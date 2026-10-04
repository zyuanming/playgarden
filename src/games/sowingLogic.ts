/** Original four-pit Kalah rules. Ring order is P1..P4, player store,
 * O4..O1, opponent store. Opposite pits always sum to eight. */
export type SowingPlayer = 1 | 2;
export type SowingBoard = readonly number[];
export const SOWING_PITS = 4;
export const SOWING_AI_DELAY = 680;
export const SOWING_SEARCH_NODES = 10000;
export const SOWING_SEARCH_DEPTH = 22;
export const SOWING_SELECTORS = {
  board: '[data-testid="sowing-board"]',
  pit: (index: number) => `[data-sowing-pit="${index}"]`,
  playerStore: '[data-testid="sowing-player-store"]',
  opponentStore: '[data-testid="sowing-opponent-store"]',
};
export type SowingMove = {
  board: number[];
  turn: 0 | SowingPlayer;
  pit: number;
  last: number;
  path: number[];
  captured: number;
  extraTurn: boolean;
  swept: number;
};
export const sowingTotal = (board: SowingBoard): number =>
  board.reduce((a, b) => a + b, 0);
export function validSowingBoard(board: SowingBoard): boolean {
  return (
    board.length === 10 &&
    board.every((n) => Number.isInteger(n) && n >= 0) &&
    sowingTotal(board) <= 192
  );
}
const pitIndexes = (side: SowingPlayer): number[] =>
  side === 1 ? [0, 1, 2, 3] : [5, 6, 7, 8];
const storeIndex = (side: SowingPlayer): number => (side === 1 ? 4 : 9);
const sideEmpty = (board: SowingBoard, side: SowingPlayer): boolean =>
  pitIndexes(side).every((i) => !board[i]);
/** Sweep is immediate when either player's row becomes empty. */
export function sweepSowingBoard(board: SowingBoard): number[] {
  const next = [...board];
  if (sideEmpty(next, 1) || sideEmpty(next, 2)) {
    for (const side of [1, 2] as const)
      for (const pit of pitIndexes(side)) {
        next[storeIndex(side)] += next[pit];
        next[pit] = 0;
      }
  }
  return next;
}
/** null is an ongoing game, zero is a genuine tie. */
export function sowingWinner(board: SowingBoard): 0 | SowingPlayer | null {
  if (!sideEmpty(board, 1) && !sideEmpty(board, 2)) return null;
  const end = sweepSowingBoard(board);
  return end[4] === end[9] ? 0 : end[4] > end[9] ? 1 : 2;
}
export function sowingLegalMoves(
  board: SowingBoard,
  side: SowingPlayer,
): number[] {
  if (!validSowingBoard(board) || sowingWinner(board) !== null) return [];
  return pitIndexes(side).filter((i) => board[i] > 0);
}
export function sowSeeds(
  board: SowingBoard,
  side: SowingPlayer,
  pit: number,
): SowingMove | null {
  if (!Number.isInteger(pit) || !sowingLegalMoves(board, side).includes(pit))
    return null;
  const next = [...board],
    path: number[] = [];
  let seeds = next[pit],
    cursor = pit,
    captured = 0;
  next[pit] = 0;
  while (seeds > 0) {
    cursor = (cursor + 1) % 10;
    if (cursor === storeIndex(side === 1 ? 2 : 1)) continue;
    next[cursor]++;
    path.push(cursor);
    seeds--;
  }
  if (
    pitIndexes(side).includes(cursor) &&
    next[cursor] === 1 &&
    next[8 - cursor] > 0
  ) {
    captured = 1 + next[8 - cursor];
    next[storeIndex(side)] += captured;
    next[cursor] = 0;
    next[8 - cursor] = 0;
  }
  const swept =
    sideEmpty(next, 1) || sideEmpty(next, 2)
      ? pitIndexes(1)
          .concat(pitIndexes(2))
          .reduce((sum, i) => sum + next[i], 0)
      : 0;
  const finished = sideEmpty(next, 1) || sideEmpty(next, 2);
  const extraTurn = !finished && cursor === storeIndex(side);
  return {
    board: sweepSowingBoard(next),
    turn: finished ? 0 : extraTurn ? side : side === 1 ? 2 : 1,
    pit,
    last: cursor,
    path,
    captured,
    extraTurn,
    swept,
  };
}
export type SowingSearch = {
  move: number | null;
  score: number;
  exact: boolean;
  nodes: number;
  outcome: "win" | "tie" | "loss" | "unknown";
};
function evaluate(board: SowingBoard): number {
  return (
    (board[4] - board[9]) * 1000 +
    pitIndexes(1).reduce((sum, i) => sum + board[i], 0) * 20 -
    pitIndexes(2).reduce((sum, i) => sum + board[i], 0) * 20
  );
}
/** Bounded deterministic alpha-beta. An exact result has reached terminal
 * states without any depth/node cutoff; an estimate never claims a forced win.
 * Search order and limits are fixed, including after a player's detour. */
export function searchSowing(
  board: SowingBoard,
  side: SowingPlayer,
  nodeLimit = SOWING_SEARCH_NODES,
  depthLimit = SOWING_SEARCH_DEPTH,
): SowingSearch {
  if (!validSowingBoard(board))
    return { move: null, score: 0, exact: false, nodes: 0, outcome: "unknown" };
  const limit = Number.isFinite(nodeLimit)
    ? Math.min(SOWING_SEARCH_NODES, Math.max(1, Math.floor(nodeLimit)))
    : SOWING_SEARCH_NODES;
  const maxDepth = Number.isFinite(depthLimit)
    ? Math.min(SOWING_SEARCH_DEPTH, Math.max(1, Math.floor(depthLimit)))
    : SOWING_SEARCH_DEPTH;
  let nodes = 0,
    exact = true;
  function visit(
    current: SowingBoard,
    player: SowingPlayer,
    depth: number,
    alpha: number,
    beta: number,
  ): number {
    if (nodes >= limit) {
      exact = false;
      return evaluate(current);
    }
    nodes++;
    if (sowingWinner(current) !== null) {
      const end = sweepSowingBoard(current);
      return (end[4] - end[9]) * 1000;
    }
    if (!depth) {
      exact = false;
      return evaluate(current);
    }
    let best = player === 1 ? -Infinity : Infinity;
    for (const pit of sowingLegalMoves(current, player)) {
      const next = sowSeeds(current, player, pit)!;
      const value =
        next.turn === 0
          ? (next.board[4] - next.board[9]) * 1000
          : visit(next.board, next.turn, depth - 1, alpha, beta);
      best = player === 1 ? Math.max(best, value) : Math.min(best, value);
      if (player === 1) alpha = Math.max(alpha, best);
      else beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  const legal = sowingLegalMoves(board, side);
  let move: number | null = null,
    score = side === 1 ? -Infinity : Infinity;
  for (const pit of legal) {
    const next = sowSeeds(board, side, pit)!;
    const value =
      next.turn === 0
        ? (next.board[4] - next.board[9]) * 1000
        : visit(next.board, next.turn, maxDepth - 1, -Infinity, Infinity);
    if (move === null || (side === 1 ? value > score : value < score)) {
      move = pit;
      score = value;
    }
  }
  if (!legal.length) {
    const end = sweepSowingBoard(board);
    score = (end[4] - end[9]) * 1000;
  }
  return {
    move,
    score,
    exact,
    nodes,
    outcome: !exact
      ? "unknown"
      : score === 0
        ? "tie"
        : (side === 1 ? score > 0 : score < 0)
          ? "win"
          : "loss",
  };
}
export const chooseSowingMove = (
  board: SowingBoard,
  side: SowingPlayer = 2,
): number | null => searchSowing(board, side).move;
export type SowingSnapshot = {
  board: number[];
  turn: 0 | SowingPlayer;
  moves: number;
  lastMove: (SowingMove & { player: SowingPlayer }) | null;
  playerTurnOpen: boolean;
};
export type SowingState = SowingSnapshot & { history: SowingSnapshot[] };
export type SowingLevel = {
  title: string;
  board: SowingBoard;
  idea: string;
  solution: readonly number[];
};
export function createSowingState(
  level: Pick<SowingLevel, "board">,
): SowingState {
  if (!validSowingBoard(level.board)) throw new Error("Invalid sowing board.");
  const board = sweepSowingBoard(level.board);
  return {
    board,
    turn: sowingWinner(board) === null ? 1 : 0,
    moves: 0,
    lastMove: null,
    playerTurnOpen: false,
    history: [],
  };
}
export function playSowingTurn(
  state: SowingState,
  pit: number,
  paused = false,
): SowingState {
  if (paused || state.turn !== 1) return state;
  const move = sowSeeds(state.board, 1, pit);
  if (!move) return state;
  const { history, ...snapshot } = state;
  return {
    board: move.board,
    turn: move.turn,
    moves: state.moves + 1,
    lastMove: { ...move, player: 1 },
    playerTurnOpen: true,
    history: state.playerTurnOpen ? history : [...history, snapshot],
  };
}
export function replySowingTurn(state: SowingState): SowingState {
  if (state.turn !== 2) return state;
  const pit = chooseSowingMove(state.board, 2);
  if (pit === null) return state;
  const move = sowSeeds(state.board, 2, pit)!;
  return {
    ...state,
    board: move.board,
    turn: move.turn,
    lastMove: { ...move, player: 2 },
    playerTurnOpen: move.turn === 2,
  };
}
export function undoSowingTurn(state: SowingState): SowingState {
  const snapshot = state.history.at(-1);
  return snapshot
    ? { ...snapshot, history: state.history.slice(0, -1) }
    : state;
}
/** Certificates contain every player sow, including bonus sows. Between them,
 * let the local opponent finish ALL of its bonus sows. */
export const sowingLevels: readonly SowingLevel[] = [
  {
    title: "隔岸收获",
    board: [1, 0, 0, 0, 3, 1, 0, 4, 0, 3],
    idea: "最后一颗落进己方空孔，能带走对岸的种子。",
    solution: [0],
  },
  {
    title: "再播一把",
    board: [1, 1, 2, 2, 3, 0, 1, 2, 1, 3],
    idea: "让最后一颗进入自己的粮仓，获得额外播种机会。",
    solution: [2, 1],
  },
  {
    title: "三孔接力",
    board: [0, 1, 1, 1, 3, 1, 3, 0, 0, 3],
    idea: "从靠近粮仓的孔开始，逐步为捕获创造空孔。",
    solution: [3, 2, 1],
  },
  {
    title: "等一场回响",
    board: [1, 1, 0, 2, 3, 0, 2, 1, 2, 3],
    idea: "不要只数眼前的收获，想想对手播完后的对岸。",
    solution: [1, 0, 1],
  },
  {
    title: "绕过空地",
    board: [4, 1, 3, 1, 3, 0, 1, 0, 0, 3],
    idea: "一把种子能越过粮仓。对岸还在生长时，调整播种顺序。",
    solution: [2, 0, 2, 1],
  },
  {
    title: "两次回春",
    board: [1, 2, 1, 1, 3, 2, 1, 1, 0, 3],
    idea: "额外回合与捕获可以接力，别太早交出主动权。",
    solution: [3, 1, 2, 3],
  },
  {
    title: "窄胜的丰收",
    board: [1, 3, 0, 0, 3, 1, 2, 1, 1, 3],
    idea: "每一颗都重要；粮仓只多一颗，也算赢。",
    solution: [1, 0, 3, 2, 3],
  },
  {
    title: "跨岸长播",
    board: [0, 5, 1, 1, 3, 1, 0, 1, 1, 3],
    idea: "五颗种子会穿过自己的粮仓，继续播向对岸。",
    solution: [3, 2, 1, 3, 2, 3],
  },
  {
    title: "四次新芽",
    board: [1, 3, 2, 0, 3, 0, 2, 2, 1, 3],
    idea: "仔细安排距离粮仓的步数，把额外回合串起来。",
    solution: [2, 3, 1, 0, 3, 2, 3],
  },
  {
    title: "连绵花季",
    board: [4, 3, 1, 0, 3, 1, 1, 1, 1, 3],
    idea: "反复补充靠近粮仓的孔，会形成长长的额外回合。",
    solution: [1, 3, 2, 3, 0, 3, 2, 1],
  },
  {
    title: "收仓的时机",
    board: [2, 1, 1, 2, 3, 1, 2, 0, 0, 3],
    idea: "不一定要捕获才能取胜；结束时，剩余种子归各自的粮仓。",
    solution: [0, 3, 2, 3, 1, 3, 2, 3],
  },
  {
    title: "最后的远行",
    board: [0, 2, 1, 0, 3, 1, 3, 3, 2, 3],
    idea: "从稀疏的小田出发，兼顾对手的额外回合与最后的收仓。",
    solution: [1, 0, 0, 2, 3, 1, 3, 2, 3],
  },
];
export function sowingCertifiedWin(level: SowingLevel): boolean {
  let state = createSowingState(level);
  for (const pit of level.solution) {
    const next = playSowingTurn(state, pit);
    if (next === state) return false;
    state = next;
    let guard = 0;
    while (state.turn === 2 && guard++ < 192) state = replySowingTurn(state);
    if (state.turn === 2) return false;
  }
  return state.turn === 0 && sowingWinner(state.board) === 1;
}
