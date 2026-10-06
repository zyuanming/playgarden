// SPDX-License-Identifier: GPL-3.0-only
/** Original resource-bounded Mealy machines. Outputs modify named physical locks. */
export type LockOutput = {
  door: number;
  mode: "open" | "close" | "toggle";
} | null;
export type LockTransition = { to: number; output: LockOutput };
export type LockInput = { label: string; symbol: string; count: number };
export type MachineLockLevel = {
  title: string;
  lesson: string;
  states: string[];
  inputs: LockInput[];
  transitions: LockTransition[][];
  forbidden: number[];
  start: number;
  target: number;
  doors: string[];
  initialDoors: boolean[];
  targetDoors: boolean[];
  solution: number[];
  par: number;
};
export type MachineLockBoard = {
  state: number;
  doors: boolean[];
  remaining: number[];
};
export type MachineLockState = {
  board: MachineLockBoard;
  history: { board: MachineLockBoard; input: number }[];
};
export const MACHINE_LOCK_SEARCH_LIMIT = 30000;
const range = (v: number, min: number, max: number) =>
  Number.isInteger(v) && v >= min && v <= max;
export function validMachineLockLevel(l: MachineLockLevel): boolean {
  return (
    l.states.length >= 3 &&
    l.states.length <= 7 &&
    new Set(l.states).size === l.states.length &&
    l.inputs.length >= 2 &&
    l.inputs.length <= 3 &&
    l.inputs.every((i) => range(i.count, 1, 6)) &&
    l.inputs.reduce((n, i) => n + i.count, 0) <= 12 &&
    l.doors.length >= 1 &&
    l.doors.length <= 3 &&
    new Set(l.doors).size === l.doors.length &&
    l.initialDoors.length === l.doors.length &&
    l.targetDoors.length === l.doors.length &&
    [...l.initialDoors, ...l.targetDoors].every(
      (d) => typeof d === "boolean",
    ) &&
    range(l.start, 0, l.states.length - 1) &&
    range(l.target, 0, l.states.length - 1) &&
    l.forbidden.length > 0 &&
    l.forbidden.every((s) => range(s, 0, l.states.length - 1)) &&
    !l.forbidden.includes(l.start) &&
    !l.forbidden.includes(l.target) &&
    l.transitions.length === l.states.length &&
    l.transitions.every(
      (row) =>
        row.length === l.inputs.length &&
        row.every(
          (t) =>
            range(t.to, 0, l.states.length - 1) &&
            (t.output === null ||
              (range(t.output.door, 0, l.doors.length - 1) &&
                ["open", "close", "toggle"].includes(t.output.mode))),
        ),
    )
  );
}
export function validMachineLockBoard(
  l: MachineLockLevel,
  b: MachineLockBoard,
): boolean {
  return (
    validMachineLockLevel(l) &&
    range(b.state, 0, l.states.length - 1) &&
    b.doors.length === l.doors.length &&
    b.doors.every((d) => typeof d === "boolean") &&
    b.remaining.length === l.inputs.length &&
    b.remaining.every((n, i) => range(n, 0, l.inputs[i].count))
  );
}
export function initialMachineLockBoard(l: MachineLockLevel): MachineLockBoard {
  return {
    state: l.start,
    doors: [...l.initialDoors],
    remaining: l.inputs.map((i) => i.count),
  };
}
export function createMachineLockState(l: MachineLockLevel): MachineLockState {
  return { board: initialMachineLockBoard(l), history: [] };
}
export function machineLocksWon(
  l: MachineLockLevel,
  b: MachineLockBoard,
): boolean {
  return (
    validMachineLockBoard(l, b) &&
    !l.forbidden.includes(b.state) &&
    b.state === l.target &&
    b.doors.every((d, i) => d === l.targetDoors[i])
  );
}
export function machineOutputLabel(
  l: MachineLockLevel,
  output: LockOutput,
): string {
  return output === null
    ? "锁不变"
    : `${l.doors[output.door]}${output.mode === "open" ? "打开" : output.mode === "close" ? "关闭" : "翻转开 / 关"}`;
}
const clone = (b: MachineLockBoard): MachineLockBoard => ({
  state: b.state,
  doors: [...b.doors],
  remaining: [...b.remaining],
});
/** Forbidden transitions are executable mistakes, then require undo/reset. */
export function applyMachineLockInput(
  l: MachineLockLevel,
  b: MachineLockBoard,
  input: number,
): MachineLockBoard | null {
  if (
    !validMachineLockBoard(l, b) ||
    !range(input, 0, l.inputs.length - 1) ||
    b.remaining[input] === 0 ||
    l.forbidden.includes(b.state) ||
    machineLocksWon(l, b)
  )
    return null;
  const next = clone(b),
    t = l.transitions[b.state][input];
  next.state = t.to;
  next.remaining[input]--;
  if (t.output)
    next.doors[t.output.door] =
      t.output.mode === "open"
        ? true
        : t.output.mode === "close"
          ? false
          : !next.doors[t.output.door];
  return next;
}
export function moveMachineLock(
  l: MachineLockLevel,
  state: MachineLockState,
  input: number,
): MachineLockState {
  const board = applyMachineLockInput(l, state.board, input);
  return board
    ? {
        board,
        history: [...state.history, { board: clone(state.board), input }],
      }
    : state;
}
export function undoMachineLock(state: MachineLockState): MachineLockState {
  const step = state.history.at(-1);
  return step
    ? { board: clone(step.board), history: state.history.slice(0, -1) }
    : state;
}
export type MachineLockSearch = {
  status: "found" | "solved" | "unsolvable" | "limit" | "invalid";
  solution: number[] | null;
  visited: number;
};
/** Breadth-first search over machine state, every door, and remaining resources.
 * No certificate use; shortest path is claimed only after an actual found goal. */
export function searchMachineLocks(
  l: MachineLockLevel,
  start = initialMachineLockBoard(l),
  limit = MACHINE_LOCK_SEARCH_LIMIT,
): MachineLockSearch {
  if (!validMachineLockBoard(l, start))
    return { status: "invalid", solution: null, visited: 0 };
  if (machineLocksWon(l, start))
    return { status: "solved", solution: [], visited: 0 };
  if (!Number.isInteger(limit) || limit < 1)
    return { status: "limit", solution: null, visited: 0 };
  if (l.forbidden.includes(start.state))
    return { status: "unsolvable", solution: null, visited: 0 };
  const key = (b: MachineLockBoard) =>
    `${b.state}:${b.doors.map(Number).join("")}:${b.remaining.join(",")}`;
  const queue = [{ board: clone(start), parent: -1, input: -1 }],
    seen = new Set([key(start)]);
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    for (let input = 0; input < l.inputs.length; input++) {
      const next = applyMachineLockInput(l, node.board, input);
      if (!next || l.forbidden.includes(next.state)) continue;
      const encoded = key(next);
      if (seen.has(encoded)) continue;
      if (seen.size >= limit)
        return { status: "limit", solution: null, visited: seen.size };
      seen.add(encoded);
      queue.push({ board: next, parent: head, input });
      if (machineLocksWon(l, next)) {
        const solution: number[] = [];
        for (
          let at = queue.length - 1;
          queue[at].parent !== -1;
          at = queue[at].parent
        )
          solution.unshift(queue[at].input);
        return { status: "found", solution, visited: seen.size };
      }
    }
  }
  return { status: "unsolvable", solution: null, visited: seen.size };
}
export function machineLockHint(
  l: MachineLockLevel,
  b: MachineLockBoard,
): { input: number | null; text: string; status: MachineLockSearch["status"] } {
  const result = searchMachineLocks(l, b),
    input = result.solution?.[0] ?? null;
  if (input !== null) {
    const t = l.transitions[b.state][input];
    return {
      input,
      status: result.status,
      text: `从当前状态还需最少 ${result.solution!.length} 步：先输入「${l.inputs[input].label}」，${l.states[b.state]} → ${l.states[t.to]}，${machineOutputLabel(l, t.output)}。提示只指出下一步，不自动执行。`,
    };
  }
  return {
    input: null,
    status: result.status,
    text:
      result.status === "solved"
        ? "状态和所有门锁都与目标一致。"
        : result.status === "limit"
          ? "搜索达到预算，还不能断言能否完成。查看状态表，尝试保留关键输入。"
          : result.status === "invalid"
            ? "当前机器数据无效，请重置。"
            : "当前状态和剩余输入已经无法到达目标。撤销一步或重置，换一种输入顺序。",
  };
}
const t = (
  to: number,
  door?: number,
  mode: "open" | "close" | "toggle" = "toggle",
): LockTransition => ({
  to,
  output: door === undefined ? null : { door, mode },
});
function machine(
  title: string,
  lesson: string,
  names: string[],
  counts: number[],
  rows: LockTransition[][],
  doors: number,
  target: number,
  solution: number[],
  initial: boolean[] = Array(doors).fill(false),
): MachineLockLevel {
  const forbidden = names.length,
    inputs = counts.map((count, i) => ({
      label: ["脉冲 A", "回声 B", "方波 C"][i],
      symbol: ["●", "≋", "◇"][i],
      count,
    }));
  return {
    title,
    lesson,
    states: [...names, "禁止态"],
    inputs,
    transitions: [...rows, inputs.map(() => t(forbidden))],
    forbidden: [forbidden],
    start: 0,
    target,
    doors: ["月门", "日门", "星门"].slice(0, doors),
    initialDoors: initial,
    targetDoors: Array(doors).fill(true),
    solution,
    par: solution.length,
  };
}
export const stateMachineLocksLevels: MachineLockLevel[] = [
  machine(
    "先唤醒再开锁",
    "同一个输入会因当前状态产生不同结果。先从待机进入待验，再让月门打开并回到待机。",
    ["待机", "待验"],
    [2, 1],
    [
      [t(1), t(2)],
      [t(0), t(0, 0)],
    ],
    1,
    0,
    [0, 1],
  ),
  machine(
    "三拍握手",
    "状态记住已经进行到哪一步。月门只会在确认状态收到 A 时打开，完成后还要回到待机。",
    ["待机", "待验", "确认"],
    [2, 2],
    [
      [t(1), t(0)],
      [t(3), t(2)],
      [t(0, 0, "open"), t(1, 0, "close")],
    ],
    1,
    0,
    [0, 1, 0],
  ),
  machine(
    "两把独立锁",
    "先后访问两个分支来打开两扇门。输入 A 在待机打开月门，在日检则打开日门。",
    ["待机", "月检", "日检"],
    [2, 2],
    [
      [t(1, 0), t(2)],
      [t(0, 0, "close"), t(0)],
      [t(0, 1), t(3)],
    ],
    2,
    0,
    [0, 1, 1, 0],
  ),
  machine(
    "不要误触回路",
    "开门的输出发生在返回时。日检收到 B 会关闭月门并跳到月检，仔细看当前行。",
    ["待机", "月检", "日检"],
    [2, 3],
    [
      [t(1), t(2)],
      [t(3), t(0, 0)],
      [t(0, 1), t(1, 0, "close")],
    ],
    2,
    0,
    [0, 1, 1, 0],
  ),
  machine(
    "只剩一次回声",
    "B 只剩一次。绕行确认状态能让同一个返回流程依次打开两扇门。C 是另一种输入，不是通用复位键。",
    ["待机", "预热", "转接", "确认"],
    [3, 1, 1],
    [
      [t(1), t(2, 0, "close"), t(0, 1, "close")],
      [t(3), t(0, 0), t(2, 1, "close")],
      [t(0, 1), t(4), t(1)],
      [t(4), t(2, 0), t(0, 1)],
    ],
    2,
    0,
    [0, 0, 1, 0],
  ),
  machine(
    "翻转与归位",
    "翻转会把打开的门重新关上。目标是两扇门都开，并停在回响；状态正确而门没开也不算完成。",
    ["待机", "回响", "反向"],
    [3, 2, 1],
    [
      [t(1, 0), t(2, 1), t(0, 0, "close")],
      [t(0, 1), t(2, 0), t(0)],
      [t(1, 1), t(0, 0), t(0, 1, "close")],
    ],
    2,
    1,
    [0, 0, 2, 0],
  ),
  machine(
    "第三扇门",
    "三扇门共用控制器。C 只剩一次，星检收到 A 后会开星门并进入月检，能接着完成另一扇门。",
    ["待机", "月检", "日检", "星检"],
    [2, 2, 1],
    [
      [t(1), t(2), t(3)],
      [t(4), t(0, 0), t(2, 2, "close")],
      [t(0, 1), t(4), t(1, 0, "close")],
      [t(1, 2), t(0), t(4)],
    ],
    3,
    0,
    [2, 0, 1, 1, 0],
  ),
  machine(
    "安全返回",
    "开门后还有返回步骤。月路的 A 会关日门，C 能保留门锁；计划好两条回路的先后。",
    ["待机", "月预检", "月返回", "日预检", "日返回"],
    [2, 3, 1],
    [
      [t(1), t(3), t(0, 0, "close")],
      [t(5), t(2, 0, "open"), t(0)],
      [t(0, 1, "close"), t(5), t(0)],
      [t(4, 1, "open"), t(1, 0, "close"), t(0)],
      [t(5), t(0), t(2, 0, "close")],
    ],
    2,
    0,
    [0, 1, 2, 1, 0, 1],
  ),
  machine(
    "成对确认",
    "打开不等于完成：从返回态选错输入会关掉另一扇门。先比较两条回路每一行的输出。",
    ["待机", "月预检", "月返回", "日预检", "日返回"],
    [3, 3, 1],
    [
      [t(1), t(3), t(2, 0, "close")],
      [t(2, 0, "open"), t(0), t(3, 1, "close")],
      [t(0, 1, "close"), t(0), t(5)],
      [t(4, 1, "open"), t(1, 0, "close"), t(2)],
      [t(0, 0, "close"), t(0), t(5)],
    ],
    2,
    0,
    [0, 0, 1, 1, 0, 1],
  ),
  machine(
    "三路巡检",
    "月、日、星三条回路需要不同的输入长度。C 只有一次，不能在星路开到一半随意返回。",
    ["待机", "月返回", "日检", "星预检", "星确认"],
    [4, 2, 1],
    [
      [t(1, 0, "open"), t(2), t(3)],
      [t(0, 2, "close"), t(0), t(5)],
      [t(0, 1, "open"), t(1, 0, "close"), t(5)],
      [t(4), t(0, 0, "close"), t(5)],
      [t(0, 2, "open"), t(2, 1, "close"), t(1)],
    ],
    3,
    0,
    [0, 1, 1, 0, 2, 0, 0],
  ),
  machine(
    "总控回环",
    "三条回路长短不同，返回还可能破坏已经完成的锁。用剩余次数和输出表一起规划，三扇门全开并回到待机。",
    ["待机", "月检", "日预检", "日确认", "星预检", "星确认"],
    [4, 3, 1],
    [
      [t(1), t(2), t(4)],
      [t(0, 2, "close"), t(0, 0), t(3, 1, "close")],
      [t(3), t(0, 0, "close"), t(6)],
      [t(0, 1), t(1, 2, "close"), t(6)],
      [t(5), t(2, 0, "close"), t(0)],
      [t(0, 1, "close"), t(0, 2), t(1)],
    ],
    3,
    0,
    [0, 1, 1, 0, 0, 2, 0, 1],
  ),
  machine(
    "最后一次翻转",
    "月门一开始已经打开，但进入月检会翻转它。目标必须停在月检且三门全开；提前准备最后一次进入，不要只看门的数量。",
    ["待机", "月检", "日预检", "日确认", "星预检", "星确认"],
    [5, 3, 1],
    [
      [t(1, 0), t(2), t(4)],
      [t(0, 2, "close"), t(0), t(3, 1, "close")],
      [t(3), t(1, 0), t(6)],
      [t(0, 1), t(1, 2, "close"), t(6)],
      [t(5), t(2, 0, "close"), t(0)],
      [t(0, 1, "close"), t(0, 2), t(1)],
    ],
    3,
    1,
    [0, 1, 1, 0, 0, 2, 0, 1, 0],
    [true, false, false],
  ),
];
