/** Original MIT implementation of Dots and Boxes. No external code or assets. */
export type DotsPlayer = 1 | 2;
export type DotsPiece = 0 | DotsPlayer;
export type DotsBoard = {
  rows: number;
  columns: number;
  edges: readonly DotsPiece[];
  boxes: readonly DotsPiece[];
};
export const DOTS_AI_DELAY = 640;
export const DOTS_SEARCH_NODES = 24000;
export const DOTS_SEARCH_DEPTH = 12;
export const DOTS_SELECTORS = {
  board: '[data-testid="dots-board"]',
  edge: (index: number) => `[data-dots-edge="${index}"]`,
  box: (index: number) => `[data-dots-box="${index}"]`,
};
export const dotsEdgeCount = (rows: number, columns: number): number =>
  (rows + 1) * columns + rows * (columns + 1);
export function emptyDotsBoard(rows: number, columns: number): DotsBoard {
  return {
    rows,
    columns,
    edges: Array(dotsEdgeCount(rows, columns)).fill(0),
    boxes: Array(rows * columns).fill(0),
  };
}
/** Horizontal edges precede vertical edges, each in row-major order. */
export function dotsBoxEdges(
  board: Pick<DotsBoard, "rows" | "columns">,
  box: number,
): number[] {
  const { rows, columns } = board,
    r = Math.floor(box / columns),
    c = box % columns,
    vertical = (rows + 1) * columns;
  return [
    r * columns + c,
    (r + 1) * columns + c,
    vertical + r * (columns + 1) + c,
    vertical + r * (columns + 1) + c + 1,
  ];
}
export function validDotsBoard(board: DotsBoard): boolean {
  const { rows, columns, edges, boxes } = board;
  return (
    Number.isInteger(rows) &&
    Number.isInteger(columns) &&
    rows >= 1 &&
    rows <= 3 &&
    columns >= 1 &&
    columns <= 3 &&
    edges.length === dotsEdgeCount(rows, columns) &&
    boxes.length === rows * columns &&
    [...edges, ...boxes].every((p) => p === 0 || p === 1 || p === 2) &&
    boxes.every(
      (owner, i) =>
        Boolean(owner) ===
        dotsBoxEdges(board, i).every((e) => Boolean(edges[e])),
    )
  );
}
export function dotsScores(board: DotsBoard): [number, number] {
  return [
    board.boxes.filter((p) => p === 1).length,
    board.boxes.filter((p) => p === 2).length,
  ];
}
export function dotsWinner(board: DotsBoard): 0 | DotsPlayer | null {
  if (board.edges.some((e) => !e)) return null;
  const [player, opponent] = dotsScores(board);
  return player === opponent ? 0 : player > opponent ? 1 : 2;
}
export function dotsLegalMoves(board: DotsBoard): number[] {
  return validDotsBoard(board) && dotsWinner(board) === null
    ? board.edges.flatMap((e, i) => (e ? [] : [i]))
    : [];
}
export type DotsMove = {
  board: DotsBoard;
  turn: 0 | DotsPlayer;
  edge: number;
  captured: number[];
  extraTurn: boolean;
};
export function drawDotsEdge(
  board: DotsBoard,
  side: DotsPlayer,
  edge: number,
): DotsMove | null {
  if (
    (side !== 1 && side !== 2) ||
    !Number.isInteger(edge) ||
    !dotsLegalMoves(board).includes(edge)
  )
    return null;
  const edges = [...board.edges],
    boxes = [...board.boxes],
    captured: number[] = [];
  edges[edge] = side;
  for (let i = 0; i < boxes.length; i++)
    if (!boxes[i] && dotsBoxEdges(board, i).every((e) => edges[e])) {
      boxes[i] = side;
      captured.push(i);
    }
  const next = { ...board, edges, boxes },
    finished = dotsWinner(next) !== null,
    extraTurn = !finished && captured.length > 0;
  return {
    board: next,
    turn: finished ? 0 : extraTurn ? side : side === 1 ? 2 : 1,
    edge,
    captured,
    extraTurn,
  };
}
export type DotsSearch = {
  move: number | null;
  score: number;
  nodes: number;
  exact: boolean;
  outcome: "win" | "tie" | "loss" | "unknown";
};
/** Future-score minimax with deterministic edge ordering, 24,000-node / 12-ply caps.
 * Turn changes come from captures, never parity. Cutoffs always report unknown. */
export function searchDots(
  board: DotsBoard,
  side: DotsPlayer = 1,
  nodeLimit = DOTS_SEARCH_NODES,
  depthLimit = DOTS_SEARCH_DEPTH,
): DotsSearch {
  if (!validDotsBoard(board) || (side !== 1 && side !== 2))
    return { move: null, score: 0, nodes: 0, exact: false, outcome: "unknown" };
  const limit = Number.isFinite(nodeLimit)
    ? Math.max(1, Math.min(DOTS_SEARCH_NODES, Math.floor(nodeLimit)))
    : DOTS_SEARCH_NODES;
  const depth = Number.isFinite(depthLimit)
    ? Math.max(1, Math.min(DOTS_SEARCH_DEPTH, Math.floor(depthLimit)))
    : DOTS_SEARCH_DEPTH;
  let nodes = 0,
    exact = true;
  const scoreBoard = (b: DotsBoard) => {
    const [one, two] = dotsScores(b);
    return (one - two) * 100;
  };
  // Future-score transpositions omit old edge owners and already-scored boxes:
  // neither affects who completes the next box. This keeps endgames compact.
  const memo = new Map<string, number>();
  function visit(b: DotsBoard, player: DotsPlayer, remaining: number): number {
    if (dotsWinner(b) !== null) return 0;
    const signature = `${b.edges.map((e) => (e ? 1 : 0)).join("")}:${player}:${remaining}`;
    const cached = memo.get(signature);
    if (cached !== undefined) return cached;
    if (nodes >= limit || !remaining) {
      exact = false;
      return 0;
    }
    nodes++;
    let best = player === 1 ? -Infinity : Infinity;
    const wasExact = exact;
    for (const edge of dotsLegalMoves(b)) {
      const next = drawDotsEdge(b, player, edge)!;
      const gain = next.captured.length * (player === 1 ? 100 : -100);
      const value =
        gain + (next.turn ? visit(next.board, next.turn, remaining - 1) : 0);
      best = player === 1 ? Math.max(best, value) : Math.min(best, value);
      if (nodes >= limit) {
        exact = false;
        break;
      }
    }
    if (wasExact && exact) memo.set(signature, best);
    return best;
  }
  let move: number | null = null,
    score =
      dotsWinner(board) !== null
        ? scoreBoard(board)
        : side === 1
          ? -Infinity
          : Infinity;
  for (const edge of dotsLegalMoves(board)) {
    if (nodes >= limit) {
      exact = false;
      break;
    }
    const next = drawDotsEdge(board, side, edge)!;
    const value =
      scoreBoard(board) +
      next.captured.length * (side === 1 ? 100 : -100) +
      (next.turn ? visit(next.board, next.turn, depth - 1) : 0);
    if (move === null || (side === 1 ? value > score : value < score)) {
      move = edge;
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
      : score === 0
        ? "tie"
        : (side === 1 ? score > 0 : score < 0)
          ? "win"
          : "loss",
  };
}
export const chooseDotsMove = (
  board: DotsBoard,
  side: DotsPlayer = 2,
): number | null => searchDots(board, side).move;
export function dotsBoardFromMoves(
  rows: number,
  columns: number,
  moves: readonly number[],
): { board: DotsBoard; turn: 0 | DotsPlayer } {
  let board = emptyDotsBoard(rows, columns),
    turn: 0 | DotsPlayer = 1;
  for (const [index, edge] of moves.entries()) {
    const move: DotsMove | null = turn ? drawDotsEdge(board, turn, edge) : null;
    if (!move) throw new Error(`Invalid Dots opening at ${index}`);
    board = move.board;
    turn = move.turn;
  }
  return { board, turn };
}
export type DotsLevel = {
  title: string;
  rows: number;
  columns: number;
  startMoves: readonly number[];
  board: DotsBoard;
  idea: string;
  solution: readonly number[];
};
export type DotsSnapshot = {
  board: DotsBoard;
  turn: 0 | DotsPlayer;
  moves: number;
  lastMove: (DotsMove & { player: DotsPlayer }) | null;
  playerTurnOpen: boolean;
};
export type DotsState = DotsSnapshot & { history: DotsSnapshot[] };
export function createDotsState(level: Pick<DotsLevel, "board">): DotsState {
  if (!validDotsBoard(level.board)) throw new Error("Invalid Dots board");
  return {
    board: {
      ...level.board,
      edges: [...level.board.edges],
      boxes: [...level.board.boxes],
    },
    turn: dotsWinner(level.board) === null ? 1 : 0,
    moves: 0,
    lastMove: null,
    playerTurnOpen: false,
    history: [],
  };
}
export function playDotsTurn(
  state: DotsState,
  edge: number,
  paused = false,
): DotsState {
  if (paused || state.turn !== 1) return state;
  const move = drawDotsEdge(state.board, 1, edge);
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
export function replyDotsTurn(state: DotsState): DotsState {
  if (state.turn !== 2) return state;
  const edge = chooseDotsMove(state.board);
  if (edge === null) return state;
  const move = drawDotsEdge(state.board, 2, edge)!;
  return {
    ...state,
    board: move.board,
    turn: move.turn,
    lastMove: { ...move, player: 2 },
    playerTurnOpen: move.turn === 2,
  };
}
export function undoDotsTurn(state: DotsState): DotsState {
  const previous = state.history.at(-1);
  return previous
    ? { ...previous, history: state.history.slice(0, -1) }
    : state;
}
const dotsStudies: Omit<DotsLevel, "board">[] = [
  {
    title: "两格接力",
    rows: 1,
    columns: 3,
    startMoves: [1, 8, 4, 0, 6, 3, 9, 2],
    solution: [5, 7],
    idea: "一条边可能同时完成两个相邻方格，先看看它的两侧。",
  },
  {
    title: "补上第三片",
    rows: 2,
    columns: 2,
    startMoves: [9, 5, 3, 11, 7, 2, 6, 10, 1],
    solution: [0, 4, 8],
    idea: "已经落后一格也没关系，连续围地可以追回来。",
  },
  {
    title: "共享的边",
    rows: 2,
    columns: 2,
    startMoves: [0, 7, 5, 2, 1, 6, 8, 3],
    solution: [4, 10, 11],
    idea: "不要只看第一格；完成它后，还能不能继续围下一格？",
  },
  {
    title: "让出一小格",
    rows: 2,
    columns: 2,
    startMoves: [4, 8, 7, 9, 5, 10, 2],
    solution: [0, 3, 11],
    idea: "有时先送出一小片，才能把较长的连锁留给自己。",
  },
  {
    title: "收获的顺序",
    rows: 2,
    columns: 2,
    startMoves: [3, 10, 11, 7, 9, 2],
    solution: [4, 5, 0, 8],
    idea: "额外回合让顺序变得重要，先收哪一格会改变下一步。",
  },
  {
    title: "细长的花田",
    rows: 2,
    columns: 3,
    startMoves: [0, 6, 7, 2, 15, 9, 11, 5, 13, 12, 1],
    solution: [8, 10, 4, 14],
    idea: "细长的花田里，留给对手的入口和出口同样重要。",
  },
  {
    title: "花季接力",
    rows: 2,
    columns: 3,
    startMoves: [9, 2, 1, 8, 16, 4, 6, 5, 7, 10],
    solution: [11, 12, 14, 3, 13],
    idea: "把连锁分成几段看，别急着画下危险的第三条边。",
  },
  {
    title: "留边与回收",
    rows: 2,
    columns: 3,
    startMoves: [16, 2, 6, 12, 14, 8, 9, 3, 13],
    solution: [7, 15, 5, 11, 0],
    idea: "留出一条边，可能让你在对手走完后收回主动权。",
  },
  {
    title: "九格大花园",
    rows: 3,
    columns: 3,
    startMoves: [10, 12, 18, 20, 2, 8, 0, 22, 4, 23, 19, 13, 17, 11, 5, 14],
    solution: [1, 3, 7, 15, 21, 6],
    idea: "九格花园里，先算可以连续圈下的那一串。",
  },
  {
    title: "从落后追赶",
    rows: 3,
    columns: 3,
    startMoves: [3, 17, 16, 11, 8, 9, 19, 4, 18, 5, 21, 13, 6, 10, 20],
    solution: [7, 22, 23, 1, 12, 2],
    idea: "当前分数不决定胜负，未围好的花田才是机会。",
  },
  {
    title: "长链的尽头",
    rows: 3,
    columns: 3,
    startMoves: [6, 10, 2, 23, 3, 21, 9, 5, 20, 22, 18, 4, 7, 19],
    solution: [8, 11, 17, 16, 13, 12, 1],
    idea: "追踪长链的尾端，想想谁会被迫打开下一条链。",
  },
  {
    title: "最后一片花海",
    rows: 3,
    columns: 3,
    startMoves: [0, 18, 22, 11, 1, 23, 8, 15, 2, 20, 5, 13, 9],
    solution: [14, 4, 19, 10, 21, 7, 17, 3],
    idea: "把额外回合、交出回合与最后计分一起考虑。",
  },
];
export const dotsLevels: readonly DotsLevel[] = dotsStudies.map((level) => {
  const opening = dotsBoardFromMoves(
    level.rows,
    level.columns,
    level.startMoves,
  );
  if (opening.turn !== 1)
    throw new Error("Dots challenge must start on player turn");
  return { ...level, board: opening.board };
});
export function dotsCertifiedWin(level: DotsLevel): boolean {
  let state = createDotsState(level);
  for (const edge of level.solution) {
    const next = playDotsTurn(state, edge);
    if (next === state) return false;
    state = next;
    let guard = 0;
    while (state.turn === 2 && guard++ < 25) state = replyDotsTurn(state);
    if (state.turn === 2) return false;
  }
  return state.turn === 0 && dotsWinner(state.board) === 1;
}
