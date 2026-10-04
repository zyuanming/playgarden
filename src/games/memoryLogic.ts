/** Original deterministic matching layouts and immutable turn rules. */
export const memoryFaces = [
  { symbol: "●", name: "圆形", color: "#b34830" },
  { symbol: "▲", name: "三角", color: "#276254" },
  { symbol: "■", name: "方块", color: "#6951a2" },
  { symbol: "★", name: "星星", color: "#9b6706" },
  { symbol: "◆", name: "菱形", color: "#325e9c" },
  { symbol: "♥", name: "爱心", color: "#a13e66" },
  { symbol: "✚", name: "十字", color: "#3b7254" },
  { symbol: "☾", name: "月牙", color: "#6951a2" },
  { symbol: "☀", name: "太阳", color: "#9b6706" },
  { symbol: "✿", name: "花朵", color: "#a13e66" },
  { symbol: "⌂", name: "小屋", color: "#b34830" },
  { symbol: "♠", name: "黑桃", color: "#325e9c" },
  { symbol: "☂", name: "雨伞", color: "#276254" },
  { symbol: "♫", name: "音符", color: "#6951a2" },
  { symbol: "⚑", name: "旗帜", color: "#b34830" },
  { symbol: "✦", name: "四角星", color: "#9b6706" },
  { symbol: "♣", name: "梅花", color: "#325e9c" },
  { symbol: "∞", name: "无限环", color: "#a13e66" },
] as const;

export type MemoryLevel = {
  title: string;
  columns: number;
  cards: number[];
  pairs: number;
  mismatchMs: number;
};

export function makeMemoryCards(pairs: number, seed: number): number[] {
  if (!Number.isInteger(pairs) || pairs < 1 || pairs > memoryFaces.length)
    throw new RangeError("Invalid pair count");
  const cards = Array.from({ length: pairs * 2 }, (_, i) => i % pairs);
  let value = seed >>> 0;
  for (let i = cards.length - 1; i > 0; i--) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    const j = value % (i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export const memoryLevels: MemoryLevel[] = [
  [3, 3, "三对小发现"],
  [4, 4, "四叶记忆"],
  [5, 5, "多看一眼"],
  [6, 4, "一排排记住"],
  [7, 4, "花园散步"],
  [8, 4, "方格花田"],
  [9, 6, "九种形状"],
  [10, 5, "记忆小径"],
  [12, 6, "十二个朋友"],
  [14, 6, "耐心寻宝"],
  [16, 6, "记忆拼图"],
  [18, 6, "满园花开"],
].map(([pairs, columns, title], i) => ({
  title: String(title),
  pairs: Number(pairs),
  columns: Number(columns),
  cards: makeMemoryCards(Number(pairs), 8191 + i * 7919),
  mismatchMs: 1100,
}));

/** Pairs of card positions, useful for deterministic replay and QA. */
export function memorySolution(config: MemoryLevel): [number, number][] {
  return Array.from({ length: config.pairs }, (_, face) => {
    const first = config.cards.indexOf(face);
    return [first, config.cards.indexOf(face, first + 1)];
  });
}

export type MemorySnapshot = {
  matched: number[];
  open: number[];
  turns: number;
};
export type MemoryState = MemorySnapshot & { history: MemorySnapshot[] };
export function createMemoryState(): MemoryState {
  return { matched: [], open: [], turns: 0, history: [] };
}
export function memoryWon(config: MemoryLevel, state: MemoryState): boolean {
  return (
    config.cards.length > 0 && state.matched.length === config.cards.length
  );
}

export function flipMemoryCard(
  config: MemoryLevel,
  state: MemoryState,
  index: number,
  paused = false,
): MemoryState {
  if (
    paused ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= config.cards.length ||
    memoryWon(config, state) ||
    state.open.length === 2 ||
    state.matched.includes(index) ||
    state.open.includes(index)
  )
    return state;
  if (state.open.length === 0) {
    const previous = {
      matched: [...state.matched],
      open: [],
      turns: state.turns,
    };
    return { ...state, open: [index], history: [...state.history, previous] };
  }
  const first = state.open[0];
  if (config.cards[first] === config.cards[index])
    return {
      ...state,
      open: [],
      matched: [...state.matched, first, index],
      turns: state.turns + 1,
    };
  return { ...state, open: [first, index], turns: state.turns + 1 };
}

export function settleMemoryTurn(
  state: MemoryState,
  paused = false,
): MemoryState {
  return paused || state.open.length !== 2 ? state : { ...state, open: [] };
}

/** Undo always returns to the start of the current or most recent whole turn. */
export function undoMemoryTurn(
  state: MemoryState,
  paused = false,
): MemoryState {
  const previous = state.history.at(-1);
  return paused || !previous
    ? state
    : { ...previous, history: state.history.slice(0, -1) };
}

export function memoryHint(config: MemoryLevel, state: MemoryState): number[] {
  if (state.open.length === 2 || memoryWon(config, state)) return [];
  const first =
    state.open[0] ??
    config.cards.findIndex((_, i) => !state.matched.includes(i));
  const second = config.cards.findIndex(
    (face, i) =>
      i !== first && face === config.cards[first] && !state.matched.includes(i),
  );
  return first < 0 || second < 0 ? [] : [first, second];
}
