// SPDX-License-Identifier: MIT
/** Original fixed-width register puzzles. Each card is consumed when executed. */
export type BinaryOp = "SHL" | "SHR" | "AND" | "OR" | "XOR" | "NOT";
export type BinaryCard = { op: BinaryOp; operand: number; count: number };
export type BinaryLevel = {
  title: string;
  width: number;
  start: number;
  target: number;
  cards: BinaryCard[];
  lesson: string;
  solution: number[];
  par: number;
};
export type BinaryBoard = { value: number; remaining: number[] };
export type BinaryState = {
  board: BinaryBoard;
  history: { board: BinaryBoard; card: number }[];
};
export type BinarySearch = {
  status: "solved" | "unreachable" | "invalid" | "limit";
  solution: number[] | null;
  visited: number;
};
export const BINARY_STATE_LIMIT = 12000;
export const binaryOps: BinaryOp[] = ["SHL", "SHR", "AND", "OR", "XOR", "NOT"];
export const binaryBits = (width: number, value: number): string =>
  value.toString(2).padStart(width, "0");
export function binaryCardLabel(width: number, card: BinaryCard): string {
  if (card.op === "SHL") return `左移 ${card.operand} 位`;
  if (card.op === "SHR") return `右移 ${card.operand} 位`;
  if (card.op === "NOT") return "非 NOT · 全位翻转";
  const names = { AND: "与 AND", OR: "或 OR", XOR: "异或 XOR" };
  return `${names[card.op]} ${binaryBits(width, card.operand)}`;
}
export function validBinaryLevel(level: BinaryLevel): boolean {
  const mask = 2 ** level.width - 1;
  return (
    Number.isInteger(level.width) &&
    level.width >= 2 &&
    level.width <= 8 &&
    [level.start, level.target].every(
      (n) => Number.isInteger(n) && n >= 0 && n <= mask,
    ) &&
    level.cards.length >= 1 &&
    level.cards.length <= 8 &&
    level.cards.reduce((sum, card) => sum + card.count, 0) <= 10 &&
    level.cards.every(
      (card) =>
        binaryOps.includes(card.op) &&
        Number.isInteger(card.count) &&
        card.count >= 1 &&
        card.count <= 3 &&
        Number.isInteger(card.operand) &&
        (card.op === "NOT"
          ? card.operand === 0
          : card.op === "SHL" || card.op === "SHR"
            ? card.operand >= 1 && card.operand < level.width
            : card.operand >= 0 && card.operand <= mask),
    )
  );
}
export function validBinaryBoard(
  level: BinaryLevel,
  board: BinaryBoard,
): boolean {
  return (
    validBinaryLevel(level) &&
    Number.isInteger(board.value) &&
    board.value >= 0 &&
    board.value < 2 ** level.width &&
    board.remaining.length === level.cards.length &&
    board.remaining.every(
      (n, i) => Number.isInteger(n) && n >= 0 && n <= level.cards[i].count,
    )
  );
}
const clone = (board: BinaryBoard): BinaryBoard => ({
  value: board.value,
  remaining: [...board.remaining],
});
export const initialBinaryBoard = (level: BinaryLevel): BinaryBoard => ({
  value: level.start,
  remaining: level.cards.map((card) => card.count),
});
export const createBinaryState = (level: BinaryLevel): BinaryState => ({
  board: initialBinaryBoard(level),
  history: [],
});
/** Logical shifts fill with zero; left overflow is discarded. NOT is width-limited. */
export function executeBinaryOp(
  width: number,
  value: number,
  card: BinaryCard,
): number {
  const mask = 2 ** width - 1;
  switch (card.op) {
    case "SHL":
      return (value << card.operand) & mask;
    case "SHR":
      return value >>> card.operand;
    case "AND":
      return value & card.operand;
    case "OR":
      return value | card.operand;
    case "XOR":
      return value ^ card.operand;
    case "NOT":
      return value ^ mask;
  }
}
export function binaryWon(level: BinaryLevel, board: BinaryBoard): boolean {
  return validBinaryBoard(level, board) && board.value === level.target;
}
export function applyBinaryCard(
  level: BinaryLevel,
  board: BinaryBoard,
  card: number,
): BinaryBoard | null {
  if (
    !validBinaryBoard(level, board) ||
    !Number.isInteger(card) ||
    card < 0 ||
    card >= level.cards.length ||
    board.remaining[card] === 0 ||
    binaryWon(level, board)
  )
    return null;
  const next = clone(board);
  next.value = executeBinaryOp(level.width, board.value, level.cards[card]);
  next.remaining[card]--;
  return next;
}
export function moveBinary(
  level: BinaryLevel,
  state: BinaryState,
  card: number,
): BinaryState {
  const board = applyBinaryCard(level, state.board, card);
  return board
    ? {
        board,
        history: [...state.history, { board: clone(state.board), card }],
      }
    : state;
}
export function undoBinary(state: BinaryState): BinaryState {
  const last = state.history.at(-1);
  return last
    ? { board: clone(last.board), history: state.history.slice(0, -1) }
    : state;
}
/** Breadth-first search over the actual value AND remaining inventory. */
export function searchBinary(
  level: BinaryLevel,
  start: BinaryBoard = initialBinaryBoard(level),
  maxStates = BINARY_STATE_LIMIT,
): BinarySearch {
  if (!validBinaryBoard(level, start))
    return { status: "invalid", solution: null, visited: 0 };
  if (binaryWon(level, start))
    return { status: "solved", solution: [], visited: 1 };
  const limit = Number.isFinite(maxStates)
    ? Math.max(1, Math.min(BINARY_STATE_LIMIT, Math.floor(maxStates)))
    : BINARY_STATE_LIMIT;
  const key = (board: BinaryBoard) =>
    `${board.value}:${board.remaining.join(",")}`;
  const nodes = [{ board: clone(start), parent: -1, card: -1 }];
  const seen = new Set([key(start)]);
  for (let head = 0; head < nodes.length; head++) {
    for (let card = 0; card < level.cards.length; card++) {
      const board = applyBinaryCard(level, nodes[head].board, card);
      if (!board || seen.has(key(board))) continue;
      if (seen.size >= limit)
        return { status: "limit", solution: null, visited: seen.size };
      seen.add(key(board));
      nodes.push({ board, parent: head, card });
      if (board.value === level.target) {
        const solution: number[] = [];
        for (
          let i = nodes.length - 1;
          nodes[i].parent !== -1;
          i = nodes[i].parent
        )
          solution.push(nodes[i].card);
        return {
          status: "solved",
          solution: solution.reverse(),
          visited: seen.size,
        };
      }
    }
  }
  return { status: "unreachable", solution: null, visited: seen.size };
}
export function binaryHint(
  level: BinaryLevel,
  board: BinaryBoard,
  maxStates = BINARY_STATE_LIMIT,
): { text: string; card: number | null } {
  const result = searchBinary(level, board, maxStates),
    card = result.solution?.[0] ?? null;
  return {
    card,
    text:
      result.status === "solved"
        ? card === null
          ? "寄存器已与目标完全一致！"
          : `根据当前位型和剩余卡片，试试“${binaryCardLabel(level.width, level.cards[card])}”。最短还需 ${result.solution!.length} 步。`
        : result.status === "unreachable"
          ? "剩余卡片已无法得到目标位型。撤销一步或重置，换一种执行顺序。"
          : result.status === "limit"
            ? `已检查 ${result.visited} 个状态，尚未找到路线；这不代表无解。可先撤销一步再试。`
            : "当前寄存器状态无效，请重置。",
  };
}
const card = (op: BinaryOp, operand = 0): BinaryCard => ({
  op,
  operand,
  count: 1,
});
const level = (
  title: string,
  width: number,
  start: number,
  target: number,
  cards: BinaryCard[],
  lesson: string,
  solution: number[],
): BinaryLevel => ({
  title,
  width,
  start,
  target,
  cards,
  lesson,
  solution,
  par: solution.length,
});
// Explicit original certificates, independently simulated and shortest-path
// certified in tests. Passing is based only on the target, never on the route.
export const binaryCourierLevels: BinaryLevel[] = [
  level(
    "信号起航",
    4,
    0b0011,
    0b0110,
    [card("SHL", 1), card("SHR", 1)],
    "每个小格是一位。左移会把所有信号向左搬，最右边补 0。",
    [0],
  ),
  level(
    "昼夜反转",
    4,
    0b1010,
    0b0101,
    [card("NOT"), card("AND", 0b1100), card("SHR", 1)],
    "非运算会同时翻转所有位：0 变 1，1 变 0。这里只翻转寄存器里的 4 位。",
    [0],
  ),
  level(
    "剪裁与翻转",
    4,
    0b1011,
    0b0001,
    [card("AND", 0b0110), card("OR", 0b1000), card("XOR", 0b0011)],
    "与运算保留掩码中的 1 位；异或只翻转掩码为 1 的位置。两张卡先后顺序很重要。",
    [0, 2],
  ),
  level(
    "溢出的边界",
    5,
    0b10101,
    0b11100,
    [card("SHL", 2), card("OR", 0b00011), card("AND", 0b11100), card("SHR", 1)],
    "移出左边界的位会永久丢弃，不会绕回另一端。先点亮低位，再把它们移动到目标位置。",
    [1, 0],
  ),
  level(
    "低位清理",
    5,
    0b01011,
    0b00011,
    [
      card("XOR", 0b10110),
      card("SHR", 1),
      card("AND", 0b01111),
      card("OR", 0b10001),
    ],
    "逻辑右移在左侧补 0。先移动再加掩码，与先加掩码再移动可能得到不同位型。",
    [1, 0, 2],
  ),
  level(
    "翻转时机",
    5,
    0b11001,
    0b11011,
    [
      card("NOT"),
      card("SHL", 1),
      card("XOR", 0b00111),
      card("SHR", 2),
      card("OR", 0b10000),
    ],
    "翻转也会影响补入的 0。想清楚哪些位置应先被移出，再决定什么时候反转。",
    [1, 3, 0],
  ),
  level(
    "六位接力",
    6,
    0b101101,
    0b100111,
    [
      card("AND", 0b011111),
      card("SHL", 1),
      card("OR", 0b000101),
      card("XOR", 0b110000),
      card("SHR", 2),
    ],
    "卡片不必全部用完。先整理低位，再处理高位，可以避免把刚点亮的信号移走。",
    [4, 1, 2, 3],
  ),
  level(
    "补零再反转",
    6,
    0b011010,
    0b111110,
    [
      card("NOT"),
      card("SHR", 2),
      card("SHL", 1),
      card("XOR", 0b001101),
      card("OR", 0b100000),
    ],
    "左移和右移不是彼此的撤销：丢掉的位回不来。利用新补入的 0 来构造一组 1。",
    [1, 2, 0, 3],
  ),
  level(
    "七位滤波",
    7,
    0b1011010,
    0b0110110,
    [
      card("SHL", 1),
      card("AND", 0b1010111),
      card("SHR", 2),
      card("XOR", 0b0101101),
      card("OR", 0b1000010),
      card("NOT"),
    ],
    "把操作拆成筛选、反转和移动三个阶段。每次掩码作用的都是当时的位型。",
    [1, 5, 4, 2, 0],
  ),
  level(
    "窗口重排",
    7,
    0b0110011,
    0b0010100,
    [
      card("SHR", 1),
      card("XOR", 0b1010101),
      card("SHL", 2),
      card("AND", 0b1111010),
      card("NOT"),
      card("OR", 0b0000101),
    ],
    "需要丢弃的信号和需要保留的信号混在一起。先筛选，再把保留位送到目标窗口。",
    [4, 3, 0, 5, 2],
  ),
  level(
    "字节快递",
    8,
    0b10110101,
    0b10000111,
    [
      card("XOR", 0b01101001),
      card("SHL", 1),
      card("SHR", 2),
      card("NOT"),
      card("AND", 0b11011110),
      card("OR", 0b00100001),
      card("SHL", 2),
    ],
    "一个字节有 8 位。两张左移卡移动的位数不同，选择它们的时机比操作名字更重要。",
    [0, 5, 2, 4, 6, 3],
  ),
  level(
    "位流工程师",
    8,
    0b01011010,
    0b11101010,
    [
      card("SHR", 1),
      card("XOR", 0b11001001),
      card("AND", 0b11100111),
      card("SHL", 2),
      card("NOT"),
      card("OR", 0b00011000),
      card("SHR", 2),
    ],
    "组合移动、掩码和反转，把信号准确送达。所有有效路线都算成功，不必用光卡片。",
    [3, 2, 1, 0, 6, 4],
  ),
];
