/** Original garden crossing levels. The gardener always travels with the boat. */
export type RiverBank = 0 | 1;
export type RiverBoard = { positions: RiverBank[]; boat: RiverBank };
export type RiverMove = number[];
export type RiverLevel = {
  title: string;
  items: string[];
  capacity: number;
  conflicts: [number, number][];
  start: RiverBoard;
  lesson: string;
  solution: RiverMove[];
  par: number;
};
export type RiverState = { board: RiverBoard; history: RiverBoard[] };
export type RiverSearch = {
  solution: RiverMove[] | null;
  visited: number;
  status: "solved" | "unreachable" | "invalid" | "limit";
};
// Eight items plus the gardener have at most 2⁹ bank assignments.
export const RIVER_STATE_LIMIT = 512;
const copyBoard = (board: RiverBoard): RiverBoard => ({
  positions: [...board.positions],
  boat: board.boat,
});
export function validRiverBoard(level: RiverLevel, board: RiverBoard): boolean {
  const count = level.items.length;
  return (
    count >= 1 &&
    count <= 8 &&
    new Set(level.items).size === count &&
    Number.isInteger(level.capacity) &&
    level.capacity >= 1 &&
    level.capacity <= 3 &&
    board.positions.length === count &&
    [0, 1].includes(board.boat) &&
    board.positions.every((n) => n === 0 || n === 1) &&
    level.conflicts.every(
      ([a, b]) =>
        Number.isInteger(a) &&
        Number.isInteger(b) &&
        a >= 0 &&
        b >= 0 &&
        a < count &&
        b < count &&
        a !== b,
    )
  );
}
export function riverUnattendedConflicts(
  level: RiverLevel,
  board: RiverBoard,
): [number, number][] {
  return level.conflicts.filter(
    ([a, b]) =>
      board.positions[a] === board.positions[b] &&
      board.positions[a] !== board.boat,
  );
}
export const isRiverSafe = (level: RiverLevel, board: RiverBoard): boolean =>
  validRiverBoard(level, board) &&
  riverUnattendedConflicts(level, board).length === 0;
export const riverWon = (level: RiverLevel, board: RiverBoard): boolean =>
  isRiverSafe(level, board) &&
  board.boat === 1 &&
  board.positions.every((p) => p === 1);
export function riverMoveProblem(
  level: RiverLevel,
  board: RiverBoard,
  passengers: readonly number[],
): string | null {
  if (!isRiverSafe(level, board)) return "当前摆渡状态无效，请重来。";
  if (passengers.length > level.capacity)
    return `船上最多带 ${level.capacity} 位伙伴，园丁另有一个座位。`;
  if (
    new Set(passengers).size !== passengers.length ||
    passengers.some(
      (i) => !Number.isInteger(i) || i < 0 || i >= level.items.length,
    )
  )
    return "请选择不同的有效伙伴。";
  if (passengers.some((i) => board.positions[i] !== board.boat))
    return "只能接上园丁所在岸的伙伴。";
  const next = copyBoard(board);
  next.boat = board.boat === 0 ? 1 : 0;
  passengers.forEach((i) => {
    next.positions[i] = next.boat;
  });
  const conflict = riverUnattendedConflicts(level, next)[0];
  return conflict
    ? `这次不能开船：${level.items[conflict[0]]}与${level.items[conflict[1]]}会留在无人照看的${board.boat === 0 ? "左" : "右"}岸。换一组同行伙伴。`
    : null;
}
export function applyRiverMove(
  level: RiverLevel,
  board: RiverBoard,
  passengers: readonly number[],
): RiverBoard | null {
  if (riverMoveProblem(level, board, passengers)) return null;
  const next = copyBoard(board);
  next.boat = board.boat === 0 ? 1 : 0;
  passengers.forEach((i) => {
    next.positions[i] = next.boat;
  });
  return next;
}
export function legalRiverMoves(
  level: RiverLevel,
  board: RiverBoard,
): RiverMove[] {
  if (!isRiverSafe(level, board)) return [];
  const here = board.positions.flatMap((bank, i) =>
    bank === board.boat ? [i] : [],
  );
  const moves: RiverMove[] = [];
  function choose(size: number, start: number, items: number[]) {
    if (items.length === size) {
      if (applyRiverMove(level, board, items)) moves.push([...items]);
      return;
    }
    for (let i = start; i < here.length; i++)
      choose(size, i + 1, [...items, here[i]]);
  }
  for (let size = 0; size <= level.capacity; size++) choose(size, 0, []);
  return moves;
}
const boardKey = (board: RiverBoard) =>
  `${board.boat}:${board.positions.join("")}`;
export function searchRiver(
  level: RiverLevel,
  start: RiverBoard = level.start,
  maxStates = RIVER_STATE_LIMIT,
): RiverSearch {
  if (!isRiverSafe(level, start))
    return { solution: null, visited: 0, status: "invalid" };
  if (riverWon(level, start))
    return { solution: [], visited: 1, status: "solved" };
  const limit = Number.isFinite(maxStates)
    ? Math.max(1, Math.min(RIVER_STATE_LIMIT, Math.floor(maxStates)))
    : RIVER_STATE_LIMIT;
  const queue = [
    { board: copyBoard(start), parent: -1, move: null as RiverMove | null },
  ];
  const seen = new Set([boardKey(start)]);
  for (let head = 0; head < queue.length; head++) {
    for (const move of legalRiverMoves(level, queue[head].board)) {
      const next = applyRiverMove(level, queue[head].board, move)!;
      if (seen.has(boardKey(next))) continue;
      if (seen.size >= limit)
        return { solution: null, visited: seen.size, status: "limit" };
      seen.add(boardKey(next));
      queue.push({ board: next, parent: head, move });
      if (riverWon(level, next)) {
        const route: RiverMove[] = [];
        for (
          let i = queue.length - 1;
          queue[i].parent !== -1;
          i = queue[i].parent
        )
          route.push(queue[i].move!);
        return {
          solution: route.reverse(),
          visited: seen.size,
          status: "solved",
        };
      }
    }
  }
  return { solution: null, visited: seen.size, status: "unreachable" };
}
export const solveRiver = (
  level: RiverLevel,
  board: RiverBoard = level.start,
) => searchRiver(level, board).solution;
export const createRiverState = (level: RiverLevel): RiverState => ({
  board: copyBoard(level.start),
  history: [],
});
export function riverMove(
  state: RiverState,
  level: RiverLevel,
  passengers: readonly number[],
): RiverState {
  if (riverWon(level, state.board)) return state;
  const board = applyRiverMove(level, state.board, passengers);
  return board
    ? { board, history: [...state.history, copyBoard(state.board)] }
    : state;
}
export function undoRiver(state: RiverState): RiverState {
  const previous = state.history.at(-1);
  return previous
    ? { board: copyBoard(previous), history: state.history.slice(0, -1) }
    : state;
}
export function riverMoveLabel(
  level: RiverLevel,
  board: RiverBoard,
  passengers: readonly number[],
): string {
  return `${passengers.length ? `带上${passengers.map((i) => level.items[i]).join("、")}` : "园丁独自"}到${board.boat === 0 ? "右" : "左"}岸`;
}

// Original conflict graphs and offline shortest certificates.
export const riverLevels: RiverLevel[] = [
  {
    title: "第一次摆渡",
    items: ["小花", "苔球"],
    capacity: 1,
    conflicts: [],
    start: { positions: [0, 0], boat: 0 },
    lesson: "园丁可以独自返航，空船也算一次航行。",
    solution: [[0], [], [1]],
    par: 3,
  },
  {
    title: "记住一对搭档",
    items: ["小花", "苔球", "风铃"],
    capacity: 1,
    conflicts: [[0, 1]],
    start: { positions: [0, 0, 0], boat: 0 },
    lesson: "先照顾需要分开的搭档，其余伙伴可以帮你调整顺序。",
    solution: [[0], [], [2], [], [1]],
    par: 5,
  },
  {
    title: "中间的朋友",
    items: ["小花", "苔球", "风铃"],
    capacity: 1,
    conflicts: [
      [0, 1],
      [1, 2],
    ],
    start: { positions: [0, 0, 0], boat: 0 },
    lesson: "中间的伙伴会和两边都玩闹，可能要坐一次回头船。",
    solution: [[1], [], [0], [1], [2], [], [1]],
    par: 7,
  },
  {
    title: "双座新船",
    items: ["小花", "苔球", "风铃", "风车"],
    capacity: 2,
    conflicts: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
    start: { positions: [0, 0, 0, 0], boat: 0 },
    lesson: "一次可以带两位。试着把互不影响的伙伴分在同一组。",
    solution: [[0, 2], [], [1, 3]],
    par: 3,
  },
  {
    title: "热闹的小花",
    items: ["小花", "苔球", "风铃", "风车"],
    capacity: 2,
    conflicts: [
      [0, 1],
      [0, 2],
      [0, 3],
    ],
    start: { positions: [0, 0, 0, 0], boat: 0 },
    lesson: "一位伙伴和其他三位都需要照看，记得安排返航。",
    solution: [[0], [], [1, 2], [0], [0, 3]],
    par: 5,
  },
  {
    title: "五位排成队",
    items: ["小花", "苔球", "风铃", "风车", "水壶"],
    capacity: 2,
    conflicts: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
    start: { positions: [0, 0, 0, 0, 0], boat: 0 },
    lesson: "留在岸上的组合，比船上有几位更重要。",
    solution: [[1, 3], [], [0], [1], [2, 4], [3], [1, 3]],
    par: 7,
  },
  {
    title: "两组小伙伴",
    items: ["小花", "苔球", "风铃", "风车", "水壶"],
    capacity: 2,
    conflicts: [
      [0, 2],
      [0, 3],
      [0, 4],
      [1, 2],
      [1, 3],
      [1, 4],
    ],
    start: { positions: [0, 0, 0, 0, 0], boat: 0 },
    lesson: "两组之间都需要照看，同组之间可以放心等候。",
    solution: [[0, 1], [], [2], [0, 1], [3, 4], [], [0, 1]],
    par: 7,
  },
  {
    title: "六位来做客",
    items: ["小花", "苔球", "风铃", "风车", "水壶", "种子"],
    capacity: 2,
    conflicts: [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [0, 5],
    ],
    start: { positions: [0, 0, 0, 0, 0, 0], boat: 0 },
    lesson: "船位不多，可以让同一位伙伴多坐几次回头船。",
    solution: [[0], [], [1, 2], [0], [0, 3], [0], [0, 4], [0], [0, 5]],
    par: 9,
  },
  {
    title: "三座环游船",
    items: ["小花", "苔球", "风铃", "风车", "水壶", "种子"],
    capacity: 3,
    conflicts: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 0],
      [0, 2],
    ],
    start: { positions: [0, 0, 0, 0, 0, 0], boat: 0 },
    lesson: "环上还有一条额外联系，整组搬过去后仍要检查返航岸。",
    solution: [[0, 2, 4], [0], [1, 3, 5], [2, 4], [0, 2, 4]],
    par: 5,
  },
  {
    title: "四位爱热闹",
    items: ["小花", "苔球", "风铃", "风车", "水壶", "种子"],
    capacity: 3,
    conflicts: [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ],
    start: { positions: [0, 0, 0, 0, 0, 0], boat: 0 },
    lesson: "前四位任意两位都需要园丁照看，另外两位可以独自等候。",
    solution: [
      [0, 1, 2],
      [0, 1],
      [0, 1, 4],
      [0, 1],
      [0, 1, 5],
      [0, 1],
      [0, 1, 3],
    ],
    par: 7,
  },
  {
    title: "七位接力",
    items: ["小花", "苔球", "风铃", "风车", "水壶", "种子", "彩旗"],
    capacity: 3,
    conflicts: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
    start: { positions: [0, 0, 0, 0, 0, 0, 0], boat: 0 },
    lesson: "长长的搭档链需要分批运送，返回时可以带多位。",
    solution: [[1, 3, 5], [], [0], [1], [2, 4, 6], [3, 5], [1, 3, 5]],
    par: 7,
  },
  {
    title: "花园摆渡师",
    items: ["小花", "苔球", "风铃", "风车", "水壶", "种子", "彩旗", "小鼓"],
    capacity: 3,
    conflicts: [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ],
    start: { positions: [0, 0, 0, 0, 0, 0, 0, 0], boat: 0 },
    lesson: "四位爱热闹的伙伴与四件安静的物品，计划每一次返航。",
    solution: [
      [0, 1, 2],
      [0, 1],
      [0, 1, 4],
      [0, 1],
      [0, 1, 5],
      [0, 1],
      [0, 1, 6],
      [0, 1],
      [0, 1, 7],
      [0, 1],
      [0, 1, 3],
    ],
    par: 11,
  },
];
