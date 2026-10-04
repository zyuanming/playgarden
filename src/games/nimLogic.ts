/** Original normal-play Nim implementation and authored endgame studies. */
export type NimMove = { pile: number; remove: number };
export type NimPlayer = 1 | 2;
export type NimLevel = {
  title: string;
  piles: readonly number[];
  idea: string;
  solution: readonly NimMove[];
};
export const NIM_AI_DELAY = 620;
export const NIM_MAX_PILE = 31;
export const NIM_SELECTORS = {
  board: '[data-testid="nim-board"]',
  pile: (pile: number) => `[data-nim-pile="${pile}"]`,
  remove: (amount: number) => `[data-nim-remove="${amount}"]`,
  confirm: '[data-testid="nim-confirm"]',
};
export function validNimPiles(piles: readonly number[]): boolean {
  return (
    piles.length > 0 &&
    piles.length <= 6 &&
    piles.every((n) => Number.isInteger(n) && n >= 0 && n <= NIM_MAX_PILE)
  );
}
export const nimXor = (piles: readonly number[]): number =>
  piles.reduce((xor, n) => xor ^ n, 0);
export const nimRemaining = (piles: readonly number[]): number =>
  piles.reduce((sum, n) => sum + n, 0);
export function applyNimMove(
  piles: readonly number[],
  move: NimMove,
): number[] | null {
  if (
    !validNimPiles(piles) ||
    !Number.isInteger(move.pile) ||
    move.pile < 0 ||
    move.pile >= piles.length ||
    !Number.isInteger(move.remove) ||
    move.remove < 1 ||
    move.remove > piles[move.pile]
  )
    return null;
  return piles.map((count, pile) =>
    pile === move.pile ? count - move.remove : count,
  );
}
/** Exact normal-play strategy: leave XOR 0 whenever possible; on a losing
 * position, deterministically halve the largest pile (first-index ties). */
export function chooseNimMove(piles: readonly number[]): NimMove | null {
  if (!validNimPiles(piles) || !nimRemaining(piles)) return null;
  const xor = nimXor(piles);
  if (xor) {
    for (let pile = 0; pile < piles.length; pile++) {
      const target = piles[pile] ^ xor;
      if (target < piles[pile]) return { pile, remove: piles[pile] - target };
    }
  }
  const largest = Math.max(...piles);
  return {
    pile: piles.indexOf(largest),
    remove: Math.max(1, Math.floor(largest / 2)),
  };
}
export type NimHint = {
  move: NimMove | null;
  outcome: "win" | "loss" | "finished";
};
export function nimHint(piles: readonly number[]): NimHint {
  if (!validNimPiles(piles) || !nimRemaining(piles))
    return { move: null, outcome: "finished" };
  return {
    move: chooseNimMove(piles),
    outcome: nimXor(piles) ? "win" : "loss",
  };
}
export type NimSnapshot = {
  piles: number[];
  turn: 0 | NimPlayer;
  winner: 0 | NimPlayer;
  moves: number;
  lastMove: (NimMove & { player: NimPlayer }) | null;
};
export type NimState = NimSnapshot & { history: NimSnapshot[] };
export function createNimState(level: Pick<NimLevel, "piles">): NimState {
  if (!validNimPiles(level.piles) || !nimRemaining(level.piles))
    throw new Error("A Nim challenge needs a nonempty valid board.");
  return {
    piles: [...level.piles],
    turn: 1,
    winner: 0,
    moves: 0,
    lastMove: null,
    history: [],
  };
}
export function playNimTurn(
  state: NimState,
  move: NimMove,
  paused = false,
): NimState {
  if (paused || state.turn !== 1) return state;
  const piles = applyNimMove(state.piles, move);
  if (!piles) return state;
  const { history, ...snapshot } = state;
  const finished = nimRemaining(piles) === 0;
  return {
    piles,
    turn: finished ? 0 : 2,
    winner: finished ? 1 : 0,
    moves: state.moves + 1,
    lastMove: { ...move, player: 1 },
    history: [...history, snapshot],
  };
}
export function replyNimTurn(state: NimState): NimState {
  if (state.turn !== 2) return state;
  const move = chooseNimMove(state.piles);
  if (!move) return state;
  const piles = applyNimMove(state.piles, move)!;
  const finished = nimRemaining(piles) === 0;
  return {
    ...state,
    piles,
    turn: finished ? 0 : 1,
    winner: finished ? 2 : 0,
    lastMove: { ...move, player: 2 },
  };
}
export function undoNimTurn(state: NimState): NimState {
  const snapshot = state.history.at(-1);
  return snapshot
    ? { ...snapshot, history: state.history.slice(0, -1) }
    : state;
}
/** Certificates contain player moves only; replay the deterministic AI after
 * each move. These are authored setups, not generated at runtime. */
export const nimLevels: readonly NimLevel[] = [
  {
    title: "最后一颗",
    piles: [0, 1, 0],
    idea: "先记住常规规则：拿走最后一颗的人获胜。",
    solution: [{ pile: 1, remove: 1 }],
  },
  {
    title: "成双的小径",
    piles: [1, 2],
    idea: "让两堆一样多，再跟随对手的变化。",
    solution: [
      { pile: 1, remove: 1 },
      { pile: 1, remove: 1 },
    ],
  },
  {
    title: "镜中的三颗",
    piles: [3, 4],
    idea: "两堆相同时，对手拿多少，你就在另一堆拿多少。",
    solution: [
      { pile: 1, remove: 1 },
      { pile: 1, remove: 1 },
      { pile: 1, remove: 1 },
      { pile: 1, remove: 1 },
    ],
  },
  {
    title: "三堆的平衡",
    piles: [1, 2, 4],
    idea: "把三堆变成 1、2、3，看看每一列二进制是否成双。",
    solution: [
      { pile: 2, remove: 1 },
      { pile: 0, remove: 1 },
      { pile: 2, remove: 1 },
      { pile: 2, remove: 1 },
    ],
  },
  {
    title: "隐藏的一位",
    piles: [2, 3, 5],
    idea: "最高的孤单二进制位，指出了应该调整哪一堆。",
    solution: [
      { pile: 2, remove: 4 },
      { pile: 2, remove: 1 },
      { pile: 1, remove: 1 },
      { pile: 1, remove: 1 },
    ],
  },
  {
    title: "留下小三角",
    piles: [3, 5, 7],
    idea: "一回合只能改变一堆。寻找异或和为零的局面。",
    solution: [
      { pile: 0, remove: 1 },
      { pile: 0, remove: 1 },
      { pile: 2, remove: 2 },
      { pile: 0, remove: 1 },
      { pile: 2, remove: 1 },
      { pile: 2, remove: 1 },
    ],
  },
  {
    title: "四方花圃",
    piles: [1, 2, 3, 5],
    idea: "不是每堆都要动；有时拿空一堆就能恢复平衡。",
    solution: [
      { pile: 3, remove: 5 },
      { pile: 0, remove: 1 },
      { pile: 2, remove: 1 },
      { pile: 2, remove: 1 },
    ],
  },
  {
    title: "双桥之间",
    piles: [2, 4, 6, 7],
    idea: "四堆也遵守同一条异或规则，逐列观察奇偶。",
    solution: [
      { pile: 1, remove: 1 },
      { pile: 0, remove: 1 },
      { pile: 3, remove: 3 },
      { pile: 0, remove: 1 },
      { pile: 3, remove: 1 },
      { pile: 2, remove: 1 },
      { pile: 2, remove: 1 },
    ],
  },
  {
    title: "五片叶子",
    piles: [1, 3, 4, 6, 7],
    idea: "每次收到对手的局面，都重新计算，而不是照抄上一步。",
    solution: [
      { pile: 2, remove: 1 },
      { pile: 1, remove: 3 },
      { pile: 4, remove: 3 },
      { pile: 0, remove: 1 },
      { pile: 4, remove: 1 },
      { pile: 3, remove: 1 },
      { pile: 3, remove: 1 },
    ],
  },
  {
    title: "高低回响",
    piles: [3, 5, 8, 10],
    idea: "跨过 8 的边界，留意最高位与最低位如何同时变化。",
    solution: [
      { pile: 1, remove: 4 },
      { pile: 2, remove: 1 },
      { pile: 0, remove: 3 },
      { pile: 2, remove: 2 },
      { pile: 1, remove: 1 },
      { pile: 3, remove: 1 },
      { pile: 3, remove: 1 },
    ],
  },
  {
    title: "六畦花园",
    piles: [1, 2, 4, 5, 7, 9],
    idea: "堆数增加，仍然只需把一堆变小到正确的数。",
    solution: [
      { pile: 5, remove: 4 },
      { pile: 1, remove: 1 },
      { pile: 2, remove: 2 },
      { pile: 4, remove: 2 },
      { pile: 0, remove: 1 },
      { pile: 1, remove: 1 },
      { pile: 3, remove: 1 },
      { pile: 5, remove: 1 },
      { pile: 3, remove: 1 },
      { pile: 5, remove: 1 },
    ],
  },
  {
    title: "长路的节奏",
    piles: [3, 6, 9, 12, 15],
    idea: "从第一次平衡到最后一颗，始终把异或和为零的局面交给对手。",
    solution: [
      { pile: 2, remove: 3 },
      { pile: 1, remove: 5 },
      { pile: 4, remove: 6 },
      { pile: 3, remove: 3 },
      { pile: 1, remove: 1 },
      { pile: 3, remove: 1 },
      { pile: 2, remove: 1 },
      { pile: 4, remove: 1 },
      { pile: 2, remove: 1 },
      { pile: 4, remove: 1 },
    ],
  },
];
export function nimCertifiedWin(level: NimLevel): boolean {
  let state = createNimState(level);
  for (const move of level.solution) {
    const next = playNimTurn(state, move);
    if (next === state) return false;
    state = replyNimTurn(next);
  }
  return state.winner === 1;
}
