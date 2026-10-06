// SPDX-License-Identifier: GPL-3.0-only
/** Original cargo-routing puzzles with distinct LIFO and FIFO storage. */
export type CargoMove =
  | "input-stack"
  | "input-queue"
  | "input-output"
  | "stack-output"
  | "queue-output"
  | "stack-queue"
  | "queue-stack";
export type CargoBoard = {
  cursor: number;
  stack: string[];
  queue: string[];
  output: string[];
};
export type CargoState = { board: CargoBoard; history: CargoBoard[] };
export type CargoLevel = {
  title: string;
  input: string[];
  target: string[];
  stackCapacity: number;
  queueCapacity: number;
  lesson: string;
  solution: CargoMove[];
  par: number;
};
export type CargoSearch = {
  status: "solved" | "unreachable" | "invalid" | "limit";
  solution: CargoMove[] | null;
  visited: number;
};
export const CARGO_STATE_LIMIT = 12000;
export const cargoMoves: CargoMove[] = [
  "input-stack",
  "input-queue",
  "input-output",
  "stack-output",
  "queue-output",
  "stack-queue",
  "queue-stack",
];
export const cargoMoveLabels: Record<CargoMove, string> = {
  "input-stack": "来货 → 栈顶",
  "input-queue": "来货 → 队尾",
  "input-output": "来货 → 发货",
  "stack-output": "栈顶 → 发货",
  "queue-output": "队首 → 发货",
  "stack-queue": "栈顶 → 队尾",
  "queue-stack": "队首 → 栈顶",
};
const clone = (board: CargoBoard): CargoBoard => ({
  cursor: board.cursor,
  stack: [...board.stack],
  queue: [...board.queue],
  output: [...board.output],
});
export function validCargoLevel(level: CargoLevel): boolean {
  return (
    level.input.length >= 2 &&
    level.input.length <= 7 &&
    new Set(level.input).size === level.input.length &&
    level.input.every((item) => /^[A-Z]$/.test(item)) &&
    level.target.length === level.input.length &&
    new Set(level.target).size === level.target.length &&
    level.target.every((item) => level.input.includes(item)) &&
    [level.stackCapacity, level.queueCapacity].every(
      (n) => Number.isInteger(n) && n >= 1 && n <= 6,
    )
  );
}
export function validCargoBoard(level: CargoLevel, board: CargoBoard): boolean {
  if (
    !validCargoLevel(level) ||
    !Number.isInteger(board.cursor) ||
    board.cursor < 0 ||
    board.cursor > level.input.length ||
    board.stack.length > level.stackCapacity ||
    board.queue.length > level.queueCapacity ||
    board.output.length > level.target.length ||
    board.output.some((item, i) => item !== level.target[i])
  )
    return false;
  const moved = [...board.stack, ...board.queue, ...board.output];
  return (
    moved.length === board.cursor &&
    new Set(moved).size === moved.length &&
    moved.every((item) => level.input.slice(0, board.cursor).includes(item))
  );
}
export const initialCargoBoard = (): CargoBoard => ({
  cursor: 0,
  stack: [],
  queue: [],
  output: [],
});
export const createCargoState = (): CargoState => ({
  board: initialCargoBoard(),
  history: [],
});
export function cargoWon(level: CargoLevel, board: CargoBoard): boolean {
  return (
    validCargoBoard(level, board) && board.output.length === level.target.length
  );
}
export function cargoMoveProblem(
  level: CargoLevel,
  board: CargoBoard,
  move: CargoMove,
): string | null {
  if (!validCargoBoard(level, board)) return "当前货物状态无效，请重置。";
  if (!cargoMoves.includes(move)) return "未知路线。";
  if (cargoWon(level, board)) return "全部货物已按顺序发出。";
  const [from, to] = move.split("-");
  const item =
    from === "input"
      ? level.input[board.cursor]
      : from === "stack"
        ? board.stack.at(-1)
        : board.queue[0];
  if (!item)
    return from === "input"
      ? "来货区已空。"
      : from === "stack"
        ? "栈里没有货物。"
        : "队列里没有货物。";
  if (to === "stack" && board.stack.length >= level.stackCapacity)
    return "栈已经满了，先从栈顶取货。";
  if (to === "queue" && board.queue.length >= level.queueCapacity)
    return "队列已经满了，先从队首取货。";
  if (to === "output" && item !== level.target[board.output.length])
    return `下一件必须是 ${level.target[board.output.length]}，这条路线现在会取出 ${item}。`;
  return null;
}
export function applyCargoMove(
  level: CargoLevel,
  board: CargoBoard,
  move: CargoMove,
): CargoBoard | null {
  if (cargoMoveProblem(level, board, move)) return null;
  const next = clone(board),
    [from, to] = move.split("-");
  const item =
    from === "input"
      ? level.input[next.cursor++]
      : from === "stack"
        ? next.stack.pop()!
        : next.queue.shift()!;
  if (to === "stack") next.stack.push(item);
  else if (to === "queue") next.queue.push(item);
  else next.output.push(item);
  return next;
}
export const legalCargoMoves = (
  level: CargoLevel,
  board: CargoBoard,
): CargoMove[] =>
  cargoMoves.filter((move) => cargoMoveProblem(level, board, move) === null);
export function moveCargo(
  level: CargoLevel,
  state: CargoState,
  move: CargoMove,
): CargoState {
  const board = applyCargoMove(level, state.board, move);
  return board
    ? { board, history: [...state.history, clone(state.board)] }
    : state;
}
export function undoCargo(state: CargoState): CargoState {
  const board = state.history.at(-1);
  return board
    ? { board: clone(board), history: state.history.slice(0, -1) }
    : state;
}
export function searchCargo(
  level: CargoLevel,
  start: CargoBoard = initialCargoBoard(),
  maxStates = CARGO_STATE_LIMIT,
): CargoSearch {
  if (!validCargoBoard(level, start))
    return { status: "invalid", solution: null, visited: 0 };
  if (cargoWon(level, start))
    return { status: "solved", solution: [], visited: 1 };
  const limit = Number.isFinite(maxStates)
    ? Math.max(1, Math.min(CARGO_STATE_LIMIT, Math.floor(maxStates)))
    : CARGO_STATE_LIMIT;
  const key = (b: CargoBoard) =>
    `${b.cursor}:${b.stack.join("")}:${b.queue.join("")}:${b.output.length}`;
  const nodes: { board: CargoBoard; parent: number; move: CargoMove | null }[] =
    [{ board: clone(start), parent: -1, move: null }];
  const seen = new Set([key(start)]);
  for (let head = 0; head < nodes.length; head++) {
    for (const move of cargoMoves) {
      const next = applyCargoMove(level, nodes[head].board, move);
      if (!next || seen.has(key(next))) continue;
      if (seen.size >= limit)
        return { status: "limit", solution: null, visited: seen.size };
      seen.add(key(next));
      nodes.push({ board: next, parent: head, move });
      if (cargoWon(level, next)) {
        const route: CargoMove[] = [];
        for (
          let i = nodes.length - 1;
          nodes[i].parent !== -1;
          i = nodes[i].parent
        )
          route.push(nodes[i].move!);
        return {
          status: "solved",
          solution: route.reverse(),
          visited: seen.size,
        };
      }
    }
  }
  return { status: "unreachable", solution: null, visited: seen.size };
}
export function cargoHint(
  level: CargoLevel,
  board: CargoBoard,
  maxStates = CARGO_STATE_LIMIT,
): { text: string; move: CargoMove | null } {
  const result = searchCargo(level, board, maxStates),
    move = result.solution?.[0] ?? null;
  return {
    move,
    text:
      result.status === "solved"
        ? move
          ? `从当前布局出发，试试“${cargoMoveLabels[move]}”。最短还需 ${result.solution!.length} 步。`
          : "所有货物都已按目标顺序发出！"
        : result.status === "unreachable"
          ? "当前布局已无法完成。请撤销几步或重置，给下一件货预留出口。"
          : result.status === "limit"
            ? `已检查 ${result.visited} 个状态，暂时没找到路线；这不代表无解。可先撤销一步再试。`
            : "当前布局无法检查，请重置。",
  };
}
const makeLevel = (
  title: string,
  input: string,
  target: string,
  stackCapacity: number,
  queueCapacity: number,
  lesson: string,
  certificate: number[],
): CargoLevel => ({
  title,
  input: [...input],
  target: [...target],
  stackCapacity,
  queueCapacity,
  lesson,
  solution: certificate.map((i) => cargoMoves[i]),
  par: certificate.length,
});
// Original, offline-authored shortest certificates. An independent simulator
// and BFS in the tests verify their legality and shortest length.
export const stackQueueLevels: CargoLevel[] = [
  makeLevel(
    "交换两箱",
    "ABC",
    "BAC",
    1,
    1,
    "先暂存 A，让 B 先走。栈只能从同一端存取；来货也能直接发出。",
    [0, 2, 3, 2],
  ),
  makeLevel(
    "等候通道",
    "ABC",
    "CAB",
    1,
    2,
    "先让 C 发出，再保持 A、B 的先后顺序。队列从队尾入、从队首出。",
    [1, 1, 2, 4, 4],
  ),
  makeLevel(
    "倒序装车",
    "ABCD",
    "DCBA",
    3,
    1,
    "后来入栈的货先出来。把三件货叠起来，就能倒转它们的次序。",
    [0, 0, 0, 2, 3, 3, 3],
  ),
  makeLevel(
    "交错发货",
    "ABCD",
    "BDAC",
    1,
    2,
    "需要暂存的箱子不一定放在同一处。先安排好 A 和 C 的出口。",
    [0, 2, 1, 2, 3, 4],
  ),
  makeLevel(
    "分流站",
    "ABCDE",
    "CEABD",
    2,
    2,
    "容量只有四格。选择保序的队列还是倒序的栈，决定后面能否直接发货。",
    [0, 1, 2, 1, 2, 3, 4, 4],
  ),
  makeLevel(
    "满载转弯",
    "ABCDE",
    "EBDAC",
    2,
    2,
    "发出 E 前必须放下四件货。用栈取出较新的 D，用队列保留较早的 B。",
    [0, 1, 1, 0, 2, 4, 3, 3, 4],
  ),
  makeLevel(
    "双序协作",
    "ABCDEF",
    "DACEBF",
    2,
    3,
    "一条缓冲线保留 A，另一条反转 B 和 C。观察下一件目标再选路线。",
    [1, 0, 0, 2, 4, 3, 2, 3, 2],
  ),
  makeLevel(
    "夹层货物",
    "ABCDEF",
    "EDBACF",
    2,
    3,
    "A 和 D 的后进先出，与 B 和 C 的先进先出，需要同时规划。",
    [0, 1, 1, 0, 2, 3, 4, 3, 4, 2],
  ),
  makeLevel(
    "换轨重排",
    "ABCDEF",
    "FCEADB",
    3,
    2,
    "有时直接发货不够。栈顶可以去队尾，队首也能去栈顶，但目标缓冲区必须有空位。",
    [0, 0, 1, 1, 0, 2, 4, 3, 5, 3, 4, 4],
  ),
  makeLevel(
    "七箱接力",
    "ABCDEFG",
    "EBCGAFD",
    2,
    3,
    "在 G 到达之前释放空间，再借一次换轨调整末尾两件货。",
    [0, 0, 1, 1, 2, 1, 3, 4, 2, 3, 6, 4, 3],
  ),
  makeLevel(
    "长队短栈",
    "ABCDEFG",
    "GFADCEB",
    2,
    4,
    "队列虽长，却不能从队尾取货。先把需要靠后的箱子换轨，给最后来的 G 腾出道路。",
    [1, 0, 0, 1, 5, 1, 0, 2, 3, 4, 4, 4, 4, 3],
  ),
  makeLevel(
    "调度总工程师",
    "ABCDEFG",
    "GDBFAEC",
    2,
    4,
    "所有缓冲格都会用到。先在两条通道间重排，再迎接 G；只看眼前的空位会把出口堵住。",
    [0, 0, 1, 1, 5, 1, 6, 5, 0, 2, 4, 4, 3, 3, 4, 4],
  ),
];
