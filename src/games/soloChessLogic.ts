// SPDX-License-Identifier: GPL-3.0-only
// Original reverse-authored capture puzzles and chess movement implementation.
export type SoloPiece = "R" | "B" | "N" | "K";
export type SoloChessMove = { fromCell: number; toCell: number };
export type SoloChessLevel = { id: string; title: string; size: number; start: (SoloPiece | null)[]; solution: SoloChessMove[]; lesson: string };
export type SoloChessState = { board: (SoloPiece | null)[]; history: (SoloPiece | null)[][] };
export const soloChessLevels: SoloChessLevel[] = [
  {
    "id": "solo-01",
    "title": "第一场独奏",
    "size": 4,
    "start": [
      null,
      "R",
      null,
      null,
      null,
      "K",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "B"
    ],
    "solution": [
      {
        "fromCell": 15,
        "toCell": 5
      },
      {
        "fromCell": 1,
        "toCell": 5
      }
    ],
    "lesson": "先让象斜着吃掉一枚棋子，再让车沿直线收尾。"
  },
  {
    "id": "solo-02",
    "title": "斜线与直线",
    "size": 4,
    "start": [
      "B",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "R",
      "B",
      null,
      null,
      null,
      "R",
      null
    ],
    "solution": [
      {
        "fromCell": 9,
        "toCell": 10
      },
      {
        "fromCell": 0,
        "toCell": 10
      },
      {
        "fromCell": 14,
        "toCell": 10
      }
    ],
    "lesson": "车沿行列移动，象沿对角线移动；两者都不能穿过棋子。"
  },
  {
    "id": "solo-03",
    "title": "跳跃登场",
    "size": 4,
    "start": [
      null,
      null,
      null,
      null,
      "N",
      "B",
      null,
      null,
      null,
      null,
      "N",
      "R",
      null,
      null,
      null,
      null
    ],
    "solution": [
      {
        "fromCell": 5,
        "toCell": 10
      },
      {
        "fromCell": 11,
        "toCell": 10
      },
      {
        "fromCell": 4,
        "toCell": 10
      }
    ],
    "lesson": "马走日字，可以越过中间棋子，但落点必须有可吃的棋子。"
  },
  {
    "id": "solo-04",
    "title": "国王的一小步",
    "size": 4,
    "start": [
      null,
      null,
      null,
      null,
      null,
      null,
      "K",
      "B",
      "B",
      "R",
      "K",
      null,
      null,
      null,
      null,
      null
    ],
    "solution": [
      {
        "fromCell": 9,
        "toCell": 8
      },
      {
        "fromCell": 8,
        "toCell": 10
      },
      {
        "fromCell": 7,
        "toCell": 10
      },
      {
        "fromCell": 6,
        "toCell": 10
      }
    ],
    "lesson": "王只走相邻的一格，包括斜角。想好让谁成为最后一枚。"
  },
  {
    "id": "solo-05",
    "title": "四位演奏家",
    "size": 5,
    "start": [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "B",
      "N",
      "R",
      null,
      "K",
      null,
      null,
      null,
      null,
      null,
      "N",
      null,
      null,
      null
    ],
    "solution": [
      {
        "fromCell": 13,
        "toCell": 12
      },
      {
        "fromCell": 15,
        "toCell": 11
      },
      {
        "fromCell": 11,
        "toCell": 12
      },
      {
        "fromCell": 21,
        "toCell": 12
      }
    ],
    "lesson": "吃子后，留下的是发起进攻的棋子，它的走法不会改变。"
  },
  {
    "id": "solo-06",
    "title": "让出通道",
    "size": 5,
    "start": [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "R",
      "R",
      "B",
      null,
      null,
      "N",
      null,
      "K",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "B"
    ],
    "solution": [
      {
        "fromCell": 8,
        "toCell": 9
      },
      {
        "fromCell": 7,
        "toCell": 9
      },
      {
        "fromCell": 9,
        "toCell": 14
      },
      {
        "fromCell": 24,
        "toCell": 12
      },
      {
        "fromCell": 14,
        "toCell": 12
      }
    ],
    "lesson": "直线上的棋子会挡住车和象。先吃掉挡路的，再看后面的机会。"
  },
  {
    "id": "solo-07",
    "title": "留下接力点",
    "size": 5,
    "start": [
      null,
      null,
      "N",
      null,
      null,
      "B",
      null,
      null,
      null,
      null,
      null,
      null,
      "R",
      "K",
      null,
      null,
      null,
      null,
      "N",
      "K",
      "B",
      null,
      null,
      null,
      null
    ],
    "solution": [
      {
        "fromCell": 2,
        "toCell": 5
      },
      {
        "fromCell": 19,
        "toCell": 18
      },
      {
        "fromCell": 13,
        "toCell": 18
      },
      {
        "fromCell": 20,
        "toCell": 12
      },
      {
        "fromCell": 5,
        "toCell": 12
      },
      {
        "fromCell": 18,
        "toCell": 12
      }
    ],
    "lesson": "不要把最后一个能被吃到的棋子留在孤立角落。"
  },
  {
    "id": "solo-08",
    "title": "斜线交响",
    "size": 5,
    "start": [
      null,
      "B",
      null,
      null,
      null,
      null,
      null,
      null,
      "K",
      "R",
      null,
      null,
      "R",
      "K",
      null,
      null,
      null,
      null,
      "N",
      null,
      null,
      null,
      null,
      null,
      "B"
    ],
    "solution": [
      {
        "fromCell": 1,
        "toCell": 13
      },
      {
        "fromCell": 8,
        "toCell": 9
      },
      {
        "fromCell": 9,
        "toCell": 13
      },
      {
        "fromCell": 13,
        "toCell": 18
      },
      {
        "fromCell": 24,
        "toCell": 18
      },
      {
        "fromCell": 18,
        "toCell": 12
      }
    ],
    "lesson": "每次吃子都减少一个落点，开局可走的路线不一定能走到最后。"
  },
  {
    "id": "solo-09",
    "title": "八子和声",
    "size": 5,
    "start": [
      null,
      "R",
      null,
      null,
      null,
      null,
      null,
      null,
      "B",
      null,
      "N",
      null,
      "N",
      null,
      "R",
      null,
      null,
      "K",
      "K",
      null,
      null,
      "B",
      null,
      null,
      null
    ],
    "solution": [
      {
        "fromCell": 21,
        "toCell": 17
      },
      {
        "fromCell": 10,
        "toCell": 1
      },
      {
        "fromCell": 18,
        "toCell": 17
      },
      {
        "fromCell": 17,
        "toCell": 12
      },
      {
        "fromCell": 14,
        "toCell": 12
      },
      {
        "fromCell": 8,
        "toCell": 12
      },
      {
        "fromCell": 1,
        "toCell": 12
      }
    ],
    "lesson": "尝试让不同棋子接力，而不是一直只移动同一枚。"
  },
  {
    "id": "solo-10",
    "title": "最后的独奏",
    "size": 5,
    "start": [
      "R",
      "R",
      null,
      null,
      null,
      null,
      null,
      null,
      "B",
      "K",
      "N",
      null,
      "B",
      "N",
      null,
      null,
      "R",
      "K",
      null,
      null,
      null,
      null,
      null,
      null,
      null
    ],
    "solution": [
      {
        "fromCell": 16,
        "toCell": 1
      },
      {
        "fromCell": 17,
        "toCell": 12
      },
      {
        "fromCell": 9,
        "toCell": 13
      },
      {
        "fromCell": 8,
        "toCell": 12
      },
      {
        "fromCell": 1,
        "toCell": 0
      },
      {
        "fromCell": 13,
        "toCell": 12
      },
      {
        "fromCell": 0,
        "toCell": 10
      },
      {
        "fromCell": 10,
        "toCell": 12
      }
    ],
    "lesson": "每步必须吃掉一枚棋子，只剩一枚时演奏才算完成。"
  }
];
export const SOLO_CHESS_SEARCH_LIMIT = 60000;
export const SOLO_PIECE_NAMES: Record<SoloPiece, string> = { R: "车", B: "象", N: "马", K: "王" };
export const SOLO_PIECE_SYMBOLS: Record<SoloPiece, string> = { R: "♜", B: "♝", N: "♞", K: "♚" };
export const soloChessCoordinate = (level: SoloChessLevel, cell: number) => `${String.fromCharCode(65 + cell % level.size)}${Math.floor(cell / level.size) + 1}`;
export function validSoloChessBoard(level: SoloChessLevel, board: readonly (SoloPiece | null)[]): boolean {
  return board.length === level.size * level.size && board.every((piece) => piece === null || ["R", "B", "N", "K"].includes(piece));
}
export const createSoloChessState = (level: SoloChessLevel): SoloChessState => ({ board: [...level.start], history: [] });
export function soloChessWon(level: SoloChessLevel, board: readonly (SoloPiece | null)[]): boolean {
  return validSoloChessBoard(level, board) && board.filter(Boolean).length === 1;
}
export function canSoloChessCapture(level: SoloChessLevel, board: readonly (SoloPiece | null)[], move: SoloChessMove): boolean {
  const { fromCell, toCell } = move, n = level.size;
  if (!validSoloChessBoard(level, board) || ![fromCell, toCell].every((cell) => Number.isInteger(cell) && cell >= 0 && cell < board.length) || fromCell === toCell || !board[fromCell] || !board[toCell]) return false;
  const row = Math.floor(fromCell / n), col = fromCell % n, dr = Math.floor(toCell / n) - row, dc = toCell % n - col;
  const kind = board[fromCell];
  if (kind === "N") return (Math.abs(dr) === 1 && Math.abs(dc) === 2) || (Math.abs(dr) === 2 && Math.abs(dc) === 1);
  if (kind === "K") return Math.max(Math.abs(dr), Math.abs(dc)) === 1;
  if (kind === "R" && !((dr === 0) !== (dc === 0))) return false;
  if (kind === "B" && (dr === 0 || Math.abs(dr) !== Math.abs(dc))) return false;
  const stepRow = Math.sign(dr), stepCol = Math.sign(dc);
  for (let r = row + stepRow, c = col + stepCol; r !== Math.floor(toCell / n) || c !== toCell % n; r += stepRow, c += stepCol) if (board[r * n + c] !== null) return false;
  return true;
}
export function soloChessMoves(level: SoloChessLevel, board: readonly (SoloPiece | null)[]): SoloChessMove[] {
  if (!validSoloChessBoard(level, board) || soloChessWon(level, board)) return [];
  const cells = board.flatMap((piece, cell) => piece ? [cell] : []), moves: SoloChessMove[] = [];
  for (const fromCell of cells) for (const toCell of cells) if (canSoloChessCapture(level, board, { fromCell, toCell })) moves.push({ fromCell, toCell });
  return moves;
}
export function applySoloChessCapture(level: SoloChessLevel, board: readonly (SoloPiece | null)[], move: SoloChessMove): (SoloPiece | null)[] | null {
  if (soloChessWon(level, board) || !canSoloChessCapture(level, board, move)) return null;
  const next = [...board]; next[move.toCell] = next[move.fromCell]; next[move.fromCell] = null; return next;
}
export function moveSoloChess(level: SoloChessLevel, state: SoloChessState, move: SoloChessMove): SoloChessState {
  const board = applySoloChessCapture(level, state.board, move);
  return board ? { board, history: [...state.history, state.board] } : state;
}
export function undoSoloChess(level: SoloChessLevel, state: SoloChessState): SoloChessState {
  if (soloChessWon(level, state.board) || !state.history.length) return state;
  return { board: state.history[state.history.length - 1], history: state.history.slice(0, -1) };
}
export type SoloChessSearch = { status: "solved" | "impossible" | "limit"; solution: SoloChessMove[] | null; visited: number };
export function solveSoloChess(level: SoloChessLevel, board: readonly (SoloPiece | null)[], maxNodes = SOLO_CHESS_SEARCH_LIMIT): SoloChessSearch {
  if (!validSoloChessBoard(level, board) || !board.some(Boolean)) return { status: "impossible", solution: null, visited: 0 };
  const limit = Number.isFinite(maxNodes) ? Math.max(1, Math.min(SOLO_CHESS_SEARCH_LIMIT, Math.floor(maxNodes))) : SOLO_CHESS_SEARCH_LIMIT;
  const dead = new Set<string>(); let visited = 0, limited = false;
  function search(current: readonly (SoloPiece | null)[]): SoloChessMove[] | null {
    if (visited >= limit) { limited = true; return null; }
    visited++;
    if (soloChessWon(level, current)) return [];
    const key = current.map((piece) => piece ?? ".").join("");
    if (dead.has(key)) return null;
    for (const move of soloChessMoves(level, current)) {
      const path = search(applySoloChessCapture(level, current, move)!);
      if (path) return [move, ...path];
      if (limited) return null;
    }
    dead.add(key); return null;
  }
  const solution = search(board);
  return { status: solution ? "solved" : limited ? "limit" : "impossible", solution, visited };
}
