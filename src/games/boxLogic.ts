/** Twelve original tiny warehouses. Certificates contain individual walking/pushing directions. */
export type BoxDirection = "U" | "D" | "L" | "R";
export type BoxSnapshot = {
  player: number;
  boxes: number[];
  moves: number;
  pushes: number;
};
export type BoxState = BoxSnapshot & { history: BoxSnapshot[] };
export type BoxLevel = {
  title: string;
  lesson: string;
  map: string[];
  width: number;
  height: number;
  walls: number[];
  goals: number[];
  player: number;
  boxes: number[];
  solution: BoxDirection[];
};
const authored: [string, string, string[], string][] = [
  [
    "直直的小路",
    "站到箱子后面，把它推向圆圈。",
    ["#######", "#@ $ .#", "#     #", "#######"],
    "RRR",
  ],
  [
    "转一个弯",
    "箱子要转弯，搬运员也要绕到另一侧。",
    ["#######", "#    .#", "#  $  #", "# @   #", "#######"],
    "URRDRU",
  ],
  [
    "绕过花墙",
    "先留出绕行路线，别把箱子推到墙角。",
    ["#######", "# .   #", "#  $  #", "#  # @#", "#     #", "#######"],
    "ULLULLDDRU",
  ],
  [
    "两份小礼物",
    "一次只能推一个箱子，两箱不能一起移动。",
    ["#######", "# . . #", "# $ $ #", "#  @  #", "#######"],
    "LUDRRU",
  ],
  [
    "花墙两边",
    "先观察自己要走哪条路，再决定推箱顺序。",
    ["########", "# .  . #", "# $  $ #", "#   #  #", "# @    #", "########"],
    "UUDDRRRUU",
  ],
  [
    "窄门相遇",
    "狭窄的通道里，正确顺序比速度更重要。",
    ["########", "# . .  #", "#  #   #", "#  $$  #", "# @    #", "########"],
    "RRUUDLDLUU",
  ],
  [
    "左右借道",
    "给另一个箱子留下通道，才能都送到家。",
    ["########", "# .  . #", "#   #  #", "# $$   #", "#   @  #", "########"],
    "LLUUDRRDRUU",
  ],
  [
    "先让一步",
    "箱子可能要先离开目标，才有转身的空间。",
    ["########", "#  .   #", "#  # $ #", "#  $ . #", "# @    #", "########"],
    "URDRUUDRRUULDUL",
  ],
  [
    "三朵礼物",
    "三只箱子，三个圆圈；每一次推都要留有余地。",
    ["########", "# . . .#", "# $ $ $#", "#   @  #", "########"],
    "UDLLUDRRRRU",
  ],
  [
    "回廊分送",
    "先送容易到家的箱子，再为另一箱绕路。",
    [
      "########",
      "# .  . #",
      "#    $ #",
      "# $ #  #",
      "#  $ . #",
      "# @    #",
      "########",
    ],
    "UUUDDRRDRRUULU",
  ],
  [
    "排队进花房",
    "墙的两侧都能绕行，注意箱子之间的距离。",
    [
      "########",
      "# . .  #",
      "#   # .#",
      "# $$ $ #",
      "#      #",
      "#  @   #",
      "########",
    ],
    "UUULURDDDLUUDRRRDRU",
  ],
  [
    "花园调度员",
    "先为中间的箱子腾地方，再安排三箱的终点。",
    [
      "########",
      "# . . .#",
      "#   #  #",
      "# $ $$ #",
      "# #    #",
      "#  @   #",
      "########",
    ],
    "URRUURULLLDDRDRUURULDDLLULLDRRRRDRUU",
  ],
];
export function makeBoxLevel(
  title: string,
  map: string[],
  solution = "",
  lesson = "把每只箱子推到圆圈里。",
): BoxLevel {
  const width = map[0]?.length ?? 0;
  const cells = map.join("").split("");
  if (
    width < 3 ||
    map.length < 3 ||
    map.some((row) => row.length !== width || /[^# .$@*+]/.test(row)) ||
    cells.filter((c) => c === "@" || c === "+").length !== 1
  )
    throw new Error("Invalid box garden map.");
  const walls = cells.flatMap((c, i) => (c === "#" ? [i] : []));
  const goals = cells.flatMap((c, i) => (".*+".includes(c) ? [i] : []));
  const boxes = cells.flatMap((c, i) => ("$*".includes(c) ? [i] : []));
  if (
    !boxes.length ||
    boxes.length !== goals.length ||
    /[^UDLR]/.test(solution)
  )
    throw new Error(
      "A box garden needs one goal per box and a valid certificate.",
    );
  return {
    title,
    lesson,
    map: [...map],
    width,
    height: map.length,
    walls,
    goals,
    boxes,
    player: cells.findIndex((c) => c === "@" || c === "+"),
    solution: solution.split("") as BoxDirection[],
  };
}
export const boxLevels: BoxLevel[] = authored.map(
  ([title, lesson, map, solution]) =>
    makeBoxLevel(title, map, solution, lesson),
);
export function createBoxState(level: BoxLevel): BoxState {
  return {
    player: level.player,
    boxes: [...level.boxes],
    moves: 0,
    pushes: 0,
    history: [],
  };
}
export function boxNeighbor(
  level: Pick<BoxLevel, "width" | "height">,
  index: number,
  direction: BoxDirection,
): number | null {
  const delta: Record<BoxDirection, [number, number]> = {
    U: [-1, 0],
    D: [1, 0],
    L: [0, -1],
    R: [0, 1],
  };
  if (
    !delta[direction] ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= level.width * level.height
  )
    return null;
  const [dr, dc] = delta[direction];
  const row = Math.floor(index / level.width) + dr,
    col = (index % level.width) + dc;
  return row < 0 || row >= level.height || col < 0 || col >= level.width
    ? null
    : row * level.width + col;
}
export function boxSolved(
  level: BoxLevel,
  state: Pick<BoxSnapshot, "boxes">,
): boolean {
  return (
    state.boxes.length === level.goals.length &&
    new Set(state.boxes).size === state.boxes.length &&
    state.boxes.every((box) => level.goals.includes(box))
  );
}
function transitionBox(
  level: BoxLevel,
  state: BoxSnapshot,
  direction: BoxDirection,
): BoxSnapshot | null {
  const next = boxNeighbor(level, state.player, direction);
  if (next === null || level.walls.includes(next)) return null;
  let boxes = state.boxes;
  let pushed = false;
  if (boxes.includes(next)) {
    const target = boxNeighbor(level, next, direction);
    if (
      target === null ||
      level.walls.includes(target) ||
      boxes.includes(target)
    )
      return null;
    boxes = boxes
      .map((box) => (box === next ? target : box))
      .sort((a, b) => a - b);
    pushed = true;
  }
  return {
    player: next,
    boxes,
    moves: state.moves + 1,
    pushes: state.pushes + (pushed ? 1 : 0),
  };
}
export function moveBox(
  level: BoxLevel,
  state: BoxState,
  direction: BoxDirection,
  paused = false,
): BoxState {
  if (paused || boxSolved(level, state)) return state;
  const next = transitionBox(level, state, direction);
  if (!next) return state;
  const { history, ...snapshot } = state;
  return { ...next, history: [...history, snapshot] };
}
export function undoBox(state: BoxState): BoxState {
  const previous = state.history.at(-1);
  return previous
    ? { ...previous, history: state.history.slice(0, -1) }
    : state;
}
export function boxDirectionFromKey(key: string): BoxDirection | null {
  const directions: Record<string, BoxDirection> = {
    ArrowUp: "U",
    ArrowDown: "D",
    ArrowLeft: "L",
    ArrowRight: "R",
    w: "U",
    s: "D",
    a: "L",
    d: "R",
  };
  return directions[key] ?? directions[key.toLowerCase()] ?? null;
}
export function boxHasCornerDeadlock(
  level: BoxLevel,
  boxes: readonly number[],
): boolean {
  const wall = (cell: number | null) =>
    cell === null || level.walls.includes(cell);
  return boxes.some(
    (box) =>
      !level.goals.includes(box) &&
      (
        [
          ["U", "L"],
          ["U", "R"],
          ["D", "L"],
          ["D", "R"],
        ] as BoxDirection[][]
      ).some(
        ([a, b]) =>
          wall(boxNeighbor(level, box, a)) && wall(boxNeighbor(level, box, b)),
      ),
  );
}
export type BoxSearch = {
  status: "solved" | "deadlock" | "limit";
  solution: BoxDirection[] | null;
  visited: number;
};
/** Breadth-first search in move space: the returned certificate is shortest in walking + pushing steps. */
export function searchBoxSolution(
  level: BoxLevel,
  start: BoxSnapshot = createBoxState(level),
  maxStates = 120_000,
): BoxSearch {
  if (boxSolved(level, start))
    return { status: "solved", solution: [], visited: 1 };
  if (boxHasCornerDeadlock(level, start.boxes))
    return { status: "deadlock", solution: null, visited: 1 };
  const key = (state: BoxSnapshot) =>
    `${state.player}:${[...state.boxes].sort((a, b) => a - b).join(",")}`;
  const nodes: {
    state: BoxSnapshot;
    parent: number;
    direction: BoxDirection | null;
  }[] = [{ state: start, parent: -1, direction: null }];
  const visited = new Set([key(start)]);
  for (let head = 0; head < nodes.length; head++) {
    for (const direction of ["U", "D", "L", "R"] as BoxDirection[]) {
      const next = transitionBox(level, nodes[head].state, direction);
      if (!next || boxHasCornerDeadlock(level, next.boxes)) continue;
      const id = key(next);
      if (visited.has(id)) continue;
      visited.add(id);
      nodes.push({ state: next, parent: head, direction });
      if (boxSolved(level, next)) {
        const solution: BoxDirection[] = [];
        for (
          let index = nodes.length - 1;
          nodes[index].parent !== -1;
          index = nodes[index].parent
        )
          solution.push(nodes[index].direction!);
        return {
          status: "solved",
          solution: solution.reverse(),
          visited: visited.size,
        };
      }
      if (visited.size >= maxStates)
        return { status: "limit", solution: null, visited: visited.size };
    }
  }
  return { status: "deadlock", solution: null, visited: visited.size };
}
export function solveBox(
  level: BoxLevel,
  start: BoxSnapshot = createBoxState(level),
): BoxDirection[] | null {
  return searchBoxSolution(level, start).solution;
}
