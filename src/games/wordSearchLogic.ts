/** Original, seeded Chinese word gardens. All solutions are exact straight cell paths. */
export type WordSearchSolution = {
  word: string;
  path: number[];
  start: number;
  end: number;
};
export type WordSearchLevel = {
  title: string;
  size: number;
  grid: string[];
  words: string[];
  solution: WordSearchSolution[];
  idea: string;
};
export type WordSearchState = {
  start: number | null;
  selectedPath: number[];
  found: WordSearchSolution[];
};
export type WordSearchChoice = {
  state: WordSearchState;
  outcome:
    "start" | "clear" | "invalid" | "miss" | "duplicate" | "found" | "solved";
  word?: string;
};
export const wordSearchDirections: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [1, -1],
  [-1, 1],
];
function validIndex(index: number, size: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < size * size;
}
/** Rejects bent paths and row-wrapping; endpoints are included exactly once. */
export function wordSearchPath(
  size: number,
  start: number,
  end: number,
): number[] | null {
  if (
    !Number.isInteger(size) ||
    size < 2 ||
    !validIndex(start, size) ||
    !validIndex(end, size)
  )
    return null;
  const rowDistance = Math.floor(end / size) - Math.floor(start / size);
  const colDistance = (end % size) - (start % size);
  if (
    rowDistance !== 0 &&
    colDistance !== 0 &&
    Math.abs(rowDistance) !== Math.abs(colDistance)
  )
    return null;
  const length = Math.max(Math.abs(rowDistance), Math.abs(colDistance)) + 1;
  const dr = Math.sign(rowDistance),
    dc = Math.sign(colDistance);
  return Array.from(
    { length },
    (_, i) =>
      (Math.floor(start / size) + i * dr) * size + (start % size) + i * dc,
  );
}
export function wordSearchCoordinate(index: number, size: number): string {
  return `第 ${Math.floor(index / size) + 1} 行第 ${(index % size) + 1} 列`;
}
export function wordSearchDirection(
  path: readonly number[],
  size: number,
): string {
  if (path.length < 2) return "原地";
  const dr = Math.sign(
    Math.floor(path.at(-1)! / size) - Math.floor(path[0] / size),
  );
  const dc = Math.sign((path.at(-1)! % size) - (path[0] % size));
  const names: Record<string, string> = {
    "0,1": "向右 →",
    "0,-1": "向左 ←",
    "1,0": "向下 ↓",
    "-1,0": "向上 ↑",
    "1,1": "右下 ↘",
    "1,-1": "左下 ↙",
    "-1,1": "右上 ↗",
    "-1,-1": "左上 ↖",
  };
  return names[`${dr},${dc}`];
}
export function matchWordSearchPath(
  level: Pick<WordSearchLevel, "size" | "grid" | "words">,
  path: readonly number[],
): WordSearchSolution | null {
  if (
    path.length < 2 ||
    path.some(
      (index) =>
        typeof level.grid[index] !== "string" ||
        Array.from(level.grid[index]).length !== 1,
    )
  )
    return null;
  const straight = wordSearchPath(level.size, path[0], path.at(-1)!);
  if (
    !straight ||
    straight.length !== path.length ||
    !straight.every((index, i) => index === path[i])
  )
    return null;
  const text = path.map((index) => level.grid[index]).join("");
  const reversed = [...path].reverse();
  const reverseText = reversed.map((index) => level.grid[index]).join("");
  // If both directions are target words, the chosen reading direction wins.
  const word =
    level.words.find((target) => target === text) ??
    level.words.find((target) => target === reverseText);
  if (!word) return null;
  const normalizedPath = word === text ? [...path] : reversed;
  return {
    word,
    path: normalizedPath,
    start: normalizedPath[0],
    end: normalizedPath.at(-1)!,
  };
}
export function createWordSearchState(): WordSearchState {
  return { start: null, selectedPath: [], found: [] };
}
export function isWordSearchSolved(
  level: Pick<WordSearchLevel, "words">,
  state: WordSearchState,
): boolean {
  return (
    level.words.length > 0 &&
    level.words.every((word) =>
      state.found.some((found) => found.word === word),
    )
  );
}
export function chooseWordSearchCell(
  level: WordSearchLevel,
  state: WordSearchState,
  index: number,
): WordSearchChoice {
  if (isWordSearchSolved(level, state)) return { state, outcome: "solved" };
  if (!validIndex(index, level.size)) return { state, outcome: "invalid" };
  if (state.start === null)
    return {
      state: { ...state, start: index, selectedPath: [index] },
      outcome: "start",
    };
  if (state.start === index)
    return {
      state: { ...state, start: null, selectedPath: [] },
      outcome: "clear",
    };
  const path = wordSearchPath(level.size, state.start, index);
  if (!path)
    return {
      state: { ...state, start: null, selectedPath: [] },
      outcome: "invalid",
    };
  const base = { ...state, start: null, selectedPath: path };
  const match = matchWordSearchPath(level, path);
  if (!match) return { state: base, outcome: "miss" };
  if (state.found.some((found) => found.word === match.word))
    return { state: base, outcome: "duplicate", word: match.word };
  return {
    state: { ...base, found: [...state.found, match] },
    outcome: "found",
    word: match.word,
  };
}
export function clearWordSearchSelection(
  state: WordSearchState,
): WordSearchState {
  return state.start === null && state.selectedPath.length === 0
    ? state
    : { ...state, start: null, selectedPath: [] };
}
/** Found paths themselves are the undo history; crossing words retain their own cells. */
export function undoWordSearch(state: WordSearchState): WordSearchState {
  if (state.found.length === 0) return clearWordSearchSelection(state);
  return { start: null, selectedPath: [], found: state.found.slice(0, -1) };
}
export function wordSearchHint(
  level: WordSearchLevel,
  state: WordSearchState,
): WordSearchSolution | null {
  return (
    level.solution.find(
      (solution) => !state.found.some((found) => found.word === solution.word),
    ) ?? null
  );
}
export function wordSearchKeyboardCell(
  size: number,
  current: number,
  key: string,
): number {
  if (!validIndex(current, size)) return 0;
  const row = Math.floor(current / size),
    col = current % size;
  if (key === "Home") return row * size;
  if (key === "End") return row * size + size - 1;
  const deltas: Record<string, [number, number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };
  const delta = deltas[key];
  if (!delta) return current;
  const r = row + delta[0],
    c = col + delta[1];
  return r < 0 || r >= size || c < 0 || c >= size ? current : r * size + c;
}

function randomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export type WordSearchBlueprint = {
  title: string;
  size: number;
  words: string[];
  idea: string;
  seed: number;
  directionCount?: number;
};
/** Seeded placement with backtracking; a built-in solution certificate accompanies each grid. */
export function buildWordSearchLevel(
  blueprint: WordSearchBlueprint,
): WordSearchLevel {
  const { size, words } = blueprint;
  if (
    !Number.isInteger(size) ||
    size < 4 ||
    size > 8 ||
    !words.length ||
    new Set(words).size !== words.length ||
    words.some(
      (word) => Array.from(word).length < 2 || Array.from(word).length > size,
    )
  )
    throw new RangeError("Invalid word garden blueprint.");
  const random = randomGenerator(blueprint.seed),
    grid = Array<string>(size * size).fill("");
  const directions = wordSearchDirections.slice(
    0,
    blueprint.directionCount ?? 8,
  );
  if (directions.length === 0)
    throw new RangeError("At least one direction is required.");
  const candidates = words.map((word, wordIndex) => {
    const length = Array.from(word).length;
    const paths: { path: number[]; preference: number; tie: number }[] = [];
    for (let direction = 0; direction < directions.length; direction++) {
      const [dr, dc] = directions[direction];
      for (let start = 0; start < size * size; start++) {
        const r = Math.floor(start / size),
          c = start % size;
        const endRow = r + (length - 1) * dr,
          endCol = c + (length - 1) * dc;
        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size)
          continue;
        paths.push({
          path: Array.from(
            { length },
            (_, i) => (r + i * dr) * size + c + i * dc,
          ),
          preference:
            direction === (wordIndex + blueprint.seed) % directions.length
              ? 1
              : 0,
          tie: random(),
        });
      }
    }
    return paths.sort((a, b) => b.preference - a.preference || a.tie - b.tie);
  });
  const placements: WordSearchSolution[] = [];
  function place(wordIndex: number): boolean {
    if (wordIndex === words.length) return true;
    const word = words[wordIndex],
      letters = Array.from(word);
    for (const { path } of candidates[wordIndex]) {
      if (
        path.some((cell, i) => grid[cell] !== "" && grid[cell] !== letters[i])
      )
        continue;
      const changed = path.filter((cell) => grid[cell] === "");
      path.forEach((cell, i) => {
        grid[cell] = letters[i];
      });
      placements[wordIndex] = {
        word,
        path: [...path],
        start: path[0],
        end: path.at(-1)!,
      };
      if (place(wordIndex + 1)) return true;
      changed.forEach((cell) => {
        grid[cell] = "";
      });
    }
    return false;
  }
  if (!place(0))
    throw new Error(`Could not place the words in ${blueprint.title}.`);
  const fillers = Array.from("山水风云日月星花草木石田鸟虫叶土雨雪竹林果禾");
  for (let i = 0; i < grid.length; i++)
    if (grid[i] === "")
      grid[i] = fillers[Math.floor(random() * fillers.length)];
  return {
    title: blueprint.title,
    size,
    grid,
    words: [...words],
    solution: placements,
    idea: blueprint.idea,
  };
}
const blueprints: WordSearchBlueprint[] = [
  {
    title: "花园初见",
    size: 4,
    words: ["小花", "小草", "白云"],
    seed: 31,
    directionCount: 2,
    idea: "先找右边或下边的邻居，两个字就能组成一个词。",
  },
  {
    title: "四季转转",
    size: 4,
    words: ["春天", "夏天", "秋天", "冬天"],
    seed: 44,
    directionCount: 3,
    idea: "四个季节都带着一个“天”，也可能斜着藏在一起。",
  },
  {
    title: "抬头看看",
    size: 4,
    words: ["月亮", "星星", "太阳", "天空"],
    seed: 58,
    directionCount: 4,
    idea: "一个词里可以有重复的字，像天空中的“星星”。",
  },
  {
    title: "小小动物园",
    size: 5,
    words: ["小猫", "小狗", "小鸟", "小鱼"],
    seed: 77,
    directionCount: 5,
    idea: "往左、往上也找一找；从词尾点回词头也算找到。",
  },
  {
    title: "水果篮子",
    size: 5,
    words: ["苹果", "香蕉", "葡萄", "西瓜"],
    seed: 92,
    idea: "认准一个字，再看看八个方向有没有它的伙伴。",
  },
  {
    title: "走进山林",
    size: 5,
    words: ["山坡", "河流", "石头", "森林", "竹林"],
    seed: 103,
    idea: "不同的词可以共享一个字，找到的格子还能继续使用。",
  },
  {
    title: "一天的颜色",
    size: 6,
    words: ["早晨", "中午", "傍晚", "夜晚", "日出", "月光"],
    seed: 126,
    idea: "从早晨到夜晚，慢慢找到属于每个时刻的词。",
  },
  {
    title: "天气来做客",
    size: 6,
    words: ["微风", "雨水", "雪花", "彩虹", "白云", "阳光"],
    seed: 137,
    idea: "先找不容易混淆的字，再沿直线检查另一个字。",
  },
  {
    title: "池塘边",
    size: 7,
    words: ["荷花", "荷叶", "池塘", "蜻蜓", "青蛙", "小鱼"],
    seed: 152,
    idea: "这一片池塘很热闹，横、竖、斜都要照顾到。",
  },
  {
    title: "花朵的邻居",
    size: 7,
    words: ["蜜蜂", "蝴蝶", "花园", "花朵", "叶子", "种子", "泥土"],
    seed: 163,
    idea: "找到的词会留下对勾，剩下的词可以慢慢找。",
  },
  {
    title: "森林漫步",
    size: 8,
    words: ["小溪", "流水", "大树", "树叶", "松鼠", "竹林", "小路", "果实"],
    seed: 178,
    idea: "把大棋盘分成几小片，一行一行地观察。",
  },
  {
    title: "三字花园",
    size: 8,
    words: [
      "蒲公英",
      "向日葵",
      "萤火虫",
      "牵牛花",
      "三叶草",
      "小蜗牛",
      "小蝌蚪",
      "七星瓢虫",
    ],
    seed: 189,
    idea: "更长的词仍然是一条直线，要把从头到尾的每个字都连上。",
  },
];
export const wordSearchLevels: WordSearchLevel[] =
  blueprints.map(buildWordSearchLevel);
export const wordSearchSolutions = wordSearchLevels.map(
  (level) => level.solution,
);
export function verifyWordSearchLevel(level: WordSearchLevel): boolean {
  return (
    level.grid.length === level.size ** 2 &&
    level.grid.every((cell) => Array.from(cell).length === 1) &&
    new Set(level.words).size === level.words.length &&
    level.solution.length === level.words.length &&
    level.words.every((word) => {
      const solution = level.solution.find((item) => item.word === word);
      return (
        !!solution &&
        solution.start === solution.path[0] &&
        solution.end === solution.path.at(-1) &&
        solution.path.length === Array.from(word).length &&
        solution.path.map((index) => level.grid[index]).join("") === word &&
        matchWordSearchPath(level, solution.path)?.word === word
      );
    })
  );
}
