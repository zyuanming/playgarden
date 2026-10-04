/** Original levels, constructed backwards from a single target peg. No level packs. */
export type PegMove = readonly [from: number, over: number, to: number];
export type PegLevel = {
  title: string;
  width: number;
  height: number;
  holes: readonly number[];
  target: number;
  initial: readonly number[];
  solution: readonly PegMove[];
  idea: string;
};
export type PegState = {
  pegs: readonly number[];
  history: readonly (readonly number[])[];
};
export type PegSearch = {
  kind: "solved" | "unsolvable" | "budget" | "invalid";
  moves: PegMove[] | null;
  visited: number;
};
const rectangle = (width: number, height: number, missing: number[] = []) =>
  Array.from({ length: width * height }, (_, i) => i).filter(
    (i) => !missing.includes(i),
  );
function authored(
  title: string,
  width: number,
  height: number,
  holes: number[],
  target: number,
  solution: PegMove[],
  idea: string,
): PegLevel {
  // Undo every authored jump, splitting one peg into two. This is the provenance
  // and a constructive existence proof, checked again by independent replay tests.
  const pegs = new Set([target]);
  for (const [from, over, to] of [...solution].reverse()) {
    if (!pegs.has(to) || pegs.has(from) || pegs.has(over))
      throw new Error(`Invalid reverse construction: ${title}`);
    pegs.delete(to);
    pegs.add(from);
    pegs.add(over);
  }
  return {
    title,
    width,
    height,
    holes,
    target,
    solution,
    initial: [...pegs].sort((a, b) => a - b),
    idea,
  };
}
export const pegLevels: readonly PegLevel[] = [
  authored(
    "第一颗小芽",
    3,
    1,
    [0, 1, 2],
    2,
    [[0, 1, 2]],
    "先点一棵小芽，再点它隔壁小芽后面的空穴。被跨过的小芽会收起来。",
  ),
  authored(
    "转过小弯",
    3,
    3,
    [0, 1, 2, 5, 8],
    8,
    [
      [0, 1, 2],
      [2, 5, 8],
    ],
    "每一跳都必须走直线；落下以后，下一跳可以换方向。",
  ),
  authored(
    "绕过花圃",
    3,
    3,
    [0, 1, 2, 5, 6, 7, 8],
    6,
    [
      [0, 1, 2],
      [2, 5, 8],
      [8, 7, 6],
    ],
    "看看星星在哪里。最后一棵小芽必须停在星星穴里。",
  ),
  authored(
    "九格小院",
    3,
    3,
    rectangle(3, 3),
    0,
    [
      [6, 3, 0],
      [0, 1, 2],
      [7, 4, 1],
      [2, 1, 0],
    ],
    "到过星星以后还可以离开。最后只剩一棵时，才检查它的位置。",
  ),
  authored(
    "长窗花箱",
    4,
    3,
    rectangle(4, 3),
    0,
    [
      [3, 2, 1],
      [0, 1, 2],
      [2, 6, 10],
      [10, 9, 8],
      [8, 4, 0],
    ],
    "一个空穴可能是重要的中转站。留出落点，才能接着跳。",
  ),
  authored(
    "剪角苗圃",
    4,
    4,
    rectangle(4, 4, [0, 15]),
    5,
    [
      [8, 9, 10],
      [14, 10, 6],
      [7, 6, 5],
      [3, 2, 1],
      [1, 5, 9],
      [13, 9, 5],
    ],
    "没有圆穴的地方不能起跳、经过或落下。先看清这块苗圃的形状。",
  ),
  authored(
    "四方接力",
    4,
    4,
    rectangle(4, 4),
    10,
    [
      [15, 14, 13],
      [12, 13, 14],
      [14, 10, 6],
      [6, 5, 4],
      [2, 1, 0],
      [0, 4, 8],
      [8, 9, 10],
    ],
    "边缘的小芽要及时接回来。试着为下一跳准备一对相邻小芽。",
  ),
  authored(
    "叶形庭院",
    5,
    4,
    rectangle(5, 4, [0, 4, 15, 19]),
    7,
    [
      [2, 7, 12],
      [13, 12, 11],
      [5, 6, 7],
      [10, 11, 12],
      [3, 8, 13],
      [7, 12, 17],
      [14, 13, 12],
      [17, 12, 7],
    ],
    "多条路线交会时，先想想哪些小芽会被留下。撤销可以比较两种安排。",
  ),
  authored(
    "来回的小桥",
    5,
    4,
    rectangle(5, 4),
    12,
    [
      [5, 6, 7],
      [8, 7, 6],
      [15, 10, 5],
      [13, 12, 11],
      [5, 6, 7],
      [4, 9, 14],
      [2, 7, 12],
      [11, 12, 13],
      [14, 13, 12],
    ],
    "同一个穴位可以再次使用。变化的是小芽分布，不是已经走过的路线。",
  ),
  authored(
    "圆角花田",
    5,
    5,
    rectangle(5, 5, [0, 4, 20, 24]),
    12,
    [
      [18, 13, 8],
      [3, 8, 13],
      [1, 6, 11],
      [7, 12, 17],
      [10, 11, 12],
      [13, 12, 11],
      [22, 17, 12],
      [12, 11, 10],
      [21, 16, 11],
      [10, 11, 12],
    ],
    "中心并不总是最先要填的地方。为四周的小芽保留通往中心的路。",
  ),
  authored(
    "屋檐下的绿芽",
    5,
    5,
    rectangle(5, 5, [0, 4]),
    17,
    [
      [24, 23, 22],
      [3, 2, 1],
      [22, 17, 12],
      [12, 11, 10],
      [19, 18, 17],
      [1, 6, 11],
      [10, 11, 12],
      [12, 13, 14],
      [16, 17, 18],
      [9, 14, 19],
      [19, 18, 17],
    ],
    "先收拢边缘，再组织最后几跳。提示只建议一步，不会代替你移动。",
  ),
  authored(
    "整座春日花园",
    5,
    5,
    rectangle(5, 5),
    12,
    [
      [18, 17, 16],
      [11, 6, 1],
      [20, 21, 22],
      [23, 22, 21],
      [21, 16, 11],
      [15, 10, 5],
      [8, 7, 6],
      [6, 11, 16],
      [13, 12, 11],
      [0, 5, 10],
      [16, 11, 6],
      [1, 6, 11],
      [10, 11, 12],
    ],
    "把大花田分成几段小接力。每跳都少一棵，最后让唯一的小芽回到星星。",
  ),
];
export const pegSolutions = pegLevels.map((level) => level.solution);
export const pegCellLabel = (level: Pick<PegLevel, "width">, cell: number) =>
  `${String.fromCharCode(65 + (cell % level.width))}${Math.floor(cell / level.width) + 1}`;
export function validPegBoard(
  level: PegLevel,
  pegs: readonly number[],
): boolean {
  return (
    pegs.length > 0 &&
    new Set(pegs).size === pegs.length &&
    pegs.every((n) => Number.isInteger(n) && level.holes.includes(n))
  );
}
export function validPegGeometry(level: PegLevel): boolean {
  return (
    Number.isInteger(level.width) &&
    Number.isInteger(level.height) &&
    level.width > 0 &&
    level.height > 0 &&
    level.width * level.height <= 25 &&
    level.holes.length >= 3 &&
    new Set(level.holes).size === level.holes.length &&
    level.holes.every(
      (n) => Number.isInteger(n) && n >= 0 && n < level.width * level.height,
    ) &&
    level.holes.includes(level.target)
  );
}
export function pegJumpGeometry(
  level: PegLevel,
  from: number,
  to: number,
): PegMove | null {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    !level.holes.includes(from) ||
    !level.holes.includes(to)
  )
    return null;
  const dx = (to % level.width) - (from % level.width),
    dy = Math.floor(to / level.width) - Math.floor(from / level.width);
  if (!((Math.abs(dx) === 2 && dy === 0) || (Math.abs(dy) === 2 && dx === 0)))
    return null;
  const over = (from + to) / 2;
  return level.holes.includes(over) ? [from, over, to] : null;
}
export function legalPegMoves(
  level: PegLevel,
  pegs: readonly number[],
): PegMove[] {
  if (!validPegBoard(level, pegs)) return [];
  const occupied = new Set(pegs),
    moves: PegMove[] = [];
  for (const from of pegs)
    for (const to of level.holes) {
      const jump = pegJumpGeometry(level, from, to);
      if (jump && occupied.has(jump[1]) && !occupied.has(to)) moves.push(jump);
    }
  return moves;
}
export function createPegState(level: PegLevel): PegState {
  return { pegs: [...level.initial], history: [] };
}
export function isPegSolved(
  level: PegLevel,
  state: Pick<PegState, "pegs">,
): boolean {
  return (
    state.pegs.length === 1 &&
    state.pegs[0] === level.target &&
    level.holes.includes(level.target)
  );
}
export function movePeg(
  level: PegLevel,
  state: PegState,
  from: number,
  to: number,
): PegState {
  if (isPegSolved(level, state) || !validPegBoard(level, state.pegs))
    return state;
  const jump = pegJumpGeometry(level, from, to);
  if (
    !jump ||
    !state.pegs.includes(from) ||
    !state.pegs.includes(jump[1]) ||
    state.pegs.includes(to)
  )
    return state;
  return {
    pegs: [...state.pegs.filter((p) => p !== from && p !== jump[1]), to].sort(
      (a, b) => a - b,
    ),
    history: [...state.history, state.pegs],
  };
}
export function undoPeg(state: PegState): PegState {
  return state.history.length
    ? { pegs: state.history.at(-1)!, history: state.history.slice(0, -1) }
    : state;
}
/** Returns null on an illegal certificate, including a wrongly recorded jumped peg. */
export function replayPegCertificate(
  level: PegLevel,
  moves: readonly PegMove[] = level.solution,
): PegState | null {
  if (!validPegGeometry(level) || !validPegBoard(level, level.initial))
    return null;
  let state = createPegState(level);
  for (const [from, over, to] of moves) {
    if (pegJumpGeometry(level, from, to)?.[1] !== over) return null;
    const next = movePeg(level, state, from, to);
    if (next === state) return null;
    state = next;
  }
  return state;
}
export function verifyPegLevel(level: PegLevel): boolean {
  const replay = replayPegCertificate(level);
  return (
    !!replay &&
    isPegSolved(level, replay) &&
    level.solution.length === level.initial.length - 1
  );
}
const pegMask = (pegs: readonly number[]) =>
  pegs.reduce((mask, p) => mask | (1 << p), 0);
/** Bounded DFS. A budget result means unknown, never a proof of impossibility. */
export function solvePeg(
  level: PegLevel,
  pegs: readonly number[],
  maxNodes = 12000,
): PegSearch {
  if (!validPegGeometry(level) || !validPegBoard(level, pegs))
    return { kind: "invalid", moves: null, visited: 0 };
  const limit = Math.max(
    0,
    Math.min(50000, Number.isFinite(maxNodes) ? Math.floor(maxNodes) : 12000),
  );
  const jumps = level.holes.flatMap((from) =>
    level.holes.flatMap((to) => {
      const m = pegJumpGeometry(level, from, to);
      return m ? [m] : [];
    }),
  );
  const dead = new Set<number>(),
    goal = 1 << level.target;
  let visited = 0,
    exhausted = false;
  function dfs(mask: number): PegMove[] | null {
    if (mask === goal) return [];
    if (dead.has(mask)) return null;
    if (visited >= limit) {
      exhausted = true;
      return null;
    }
    visited++;
    for (const move of jumps) {
      const [from, over, to] = move;
      if (!(mask & (1 << from)) || !(mask & (1 << over)) || mask & (1 << to))
        continue;
      const rest = dfs(mask ^ (1 << from) ^ (1 << over) ^ (1 << to));
      if (rest) return [move, ...rest];
      if (exhausted) return null;
    }
    dead.add(mask);
    return null;
  }
  const moves = dfs(pegMask(pegs));
  return {
    kind: moves ? "solved" : exhausted ? "budget" : "unsolvable",
    moves,
    visited,
  };
}
export type PegHint = {
  kind: "move" | "undo" | "complete" | "unavailable";
  move: PegMove | null;
  undoSteps: number;
  reason: "certificate" | "search" | "budget" | "dead-end" | "invalid";
};
export function pegHint(
  level: PegLevel,
  state: PegState,
  maxNodes = 12000,
): PegHint {
  if (isPegSolved(level, state))
    return {
      kind: "complete",
      move: null,
      undoSteps: 0,
      reason: "certificate",
    };
  const certificate = replayPegCertificate(level);
  const known = new Map<number, PegMove>();
  if (certificate && isPegSolved(level, certificate))
    certificate.history.forEach((pegs, i) =>
      known.set(pegMask(pegs), level.solution[i]),
    );
  const certifiedMove = validPegBoard(level, state.pegs)
    ? known.get(pegMask(state.pegs))
    : undefined;
  if (certifiedMove)
    return {
      kind: "move",
      move: certifiedMove,
      undoSteps: 0,
      reason: "certificate",
    };
  const search = solvePeg(level, state.pegs, maxNodes);
  if (search.moves?.length)
    return {
      kind: "move",
      move: search.moves[0],
      undoSteps: 0,
      reason: "search",
    };
  const reason =
    search.kind === "budget"
      ? "budget"
      : search.kind === "invalid"
        ? "invalid"
        : "dead-end";
  for (let i = state.history.length - 1; i >= 0; i--)
    if (
      validPegBoard(level, state.history[i]) &&
      known.has(pegMask(state.history[i]))
    )
      return {
        kind: "undo",
        move: known.get(pegMask(state.history[i]))!,
        undoSteps: state.history.length - i,
        reason,
      };
  return { kind: "unavailable", move: null, undoSteps: 0, reason };
}
/** Arrow keys move focus along the same row/column, skipping missing holes. */
export function pegKeyboardCell(
  level: Pick<PegLevel, "width" | "height" | "holes">,
  cell: number,
  key: string,
): number {
  if (key === "Home") return level.holes[0];
  if (key === "End") return level.holes.at(-1)!;
  const dx = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0,
    dy = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0;
  if (!dx && !dy) return cell;
  let x = (cell % level.width) + dx,
    y = Math.floor(cell / level.width) + dy;
  while (x >= 0 && x < level.width && y >= 0 && y < level.height) {
    if (level.holes.includes(y * level.width + x)) return y * level.width + x;
    x += dx;
    y += dy;
  }
  return cell;
}
