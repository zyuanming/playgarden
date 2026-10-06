// SPDX-License-Identifier: GPL-3.0-only
/** Original finite, non-preemptive scheduling puzzles. Times are abstract slots. */
export type KitchenStation = "prep" | "oven" | "plate";
export type KitchenTask = {
  id: string;
  name: string;
  station: KitchenStation;
  duration: number;
  after: string[];
};
export type KitchenPlacement = { task: string; start: number | null };
export type KitchenSchedule = Record<string, number>;
export type KitchenLevel = {
  title: string;
  deadline: number;
  lesson: string;
  tasks: KitchenTask[];
  /** Authored witness, never consulted by the verifier or hint solver. */
  solution: { task: string; start: number }[];
};
export type KitchenState = {
  schedule: KitchenSchedule;
  history: KitchenSchedule[];
};
export type KitchenIssue = {
  kind: "station" | "dependency";
  tasks: string[];
  text: string;
};
export type KitchenReport = {
  valid: boolean;
  issues: KitchenIssue[];
  assigned: number;
  complete: boolean;
  makespan: number;
};
export type KitchenSearch = {
  status: "solved" | "conflict" | "impossible" | "limit" | "invalid";
  schedule: KitchenSchedule | null;
  visited: number;
  checks: number;
};
export const kitchenStations: KitchenStation[] = ["prep", "oven", "plate"];
export const kitchenStationLabels: Record<KitchenStation, string> = {
  prep: "配料台",
  oven: "烤箱",
  plate: "装盘台",
};
export const KITCHEN_SEARCH_LIMIT = 6000;
export const KITCHEN_CHECK_LIMIT = 240000;
export function validKitchenLevel(level: KitchenLevel): boolean {
  if (
    !Number.isInteger(level.deadline) ||
    level.deadline < 1 ||
    level.deadline > 16 ||
    !Array.isArray(level.tasks) ||
    level.tasks.length < 1 ||
    level.tasks.length > 8
  )
    return false;
  const ids = level.tasks.map((task) => task.id);
  if (new Set(ids).size !== ids.length) return false;
  if (
    level.tasks.some(
      (task) =>
        !/^[A-H]$/.test(task.id) ||
        !kitchenStations.includes(task.station) ||
        !Number.isInteger(task.duration) ||
        task.duration < 1 ||
        task.duration > 5 ||
        !Array.isArray(task.after) ||
        new Set(task.after).size !== task.after.length ||
        task.after.some((id) => id === task.id || !ids.includes(id)),
    )
  )
    return false;
  const done = new Set<string>();
  for (let round = 0; round < level.tasks.length; round++)
    level.tasks.forEach((task) => {
      if (task.after.every((id) => done.has(id))) done.add(task.id);
    });
  return done.size === level.tasks.length;
}
export function validKitchenSchedule(
  level: KitchenLevel,
  schedule: KitchenSchedule,
): boolean {
  return (
    validKitchenLevel(level) &&
    schedule !== null &&
    typeof schedule === "object" &&
    !Array.isArray(schedule) &&
    Object.entries(schedule).every(([id, start]) => {
      const task = level.tasks.find((candidate) => candidate.id === id);
      return (
        !!task &&
        Number.isInteger(start) &&
        start >= 0 &&
        start + task.duration <= level.deadline
      );
    })
  );
}
export function inspectKitchen(
  level: KitchenLevel,
  schedule: KitchenSchedule,
): KitchenReport {
  if (!validKitchenSchedule(level, schedule))
    return {
      valid: false,
      issues: [],
      assigned: 0,
      complete: false,
      makespan: 0,
    };
  const issues: KitchenIssue[] = [];
  let makespan = 0;
  for (const task of level.tasks) {
    const start = schedule[task.id];
    if (start === undefined) continue;
    makespan = Math.max(makespan, start + task.duration);
    for (const parentId of task.after) {
      const parent = level.tasks.find(
        (candidate) => candidate.id === parentId,
      )!;
      const parentStart = schedule[parentId];
      if (parentStart !== undefined && parentStart + parent.duration > start)
        issues.push({
          kind: "dependency",
          tasks: [parent.id, task.id],
          text: `${task.id} 必须等 ${parent.id} 在刻度 ${parentStart + parent.duration} 完成后再开始；现在 ${task.id} 从 ${start} 开始。`,
        });
    }
  }
  for (let i = 0; i < level.tasks.length; i++)
    for (let j = i + 1; j < level.tasks.length; j++) {
      const a = level.tasks[i],
        b = level.tasks[j],
        sa = schedule[a.id],
        sb = schedule[b.id];
      if (
        sa !== undefined &&
        sb !== undefined &&
        a.station === b.station &&
        sa < sb + b.duration &&
        sb < sa + a.duration
      )
        issues.push({
          kind: "station",
          tasks: [a.id, b.id],
          text: `${a.id} 和 ${b.id} 同时占用${kitchenStationLabels[a.station]}（${Math.max(sa, sb)}→${Math.min(sa + a.duration, sb + b.duration)}）；请错开它们。`,
        });
    }
  const assigned = Object.keys(schedule).length;
  return {
    valid: true,
    issues,
    assigned,
    makespan,
    complete: assigned === level.tasks.length && issues.length === 0,
  };
}
export const kitchenWon = (
  level: KitchenLevel,
  schedule: KitchenSchedule,
): boolean => inspectKitchen(level, schedule).complete;
export const createKitchenState = (): KitchenState => ({
  schedule: {},
  history: [],
});
export function editKitchen(
  level: KitchenLevel,
  state: KitchenState,
  move: KitchenPlacement,
): KitchenState {
  if (
    !validKitchenSchedule(level, state.schedule) ||
    kitchenWon(level, state.schedule) ||
    !level.tasks.some((task) => task.id === move.task)
  )
    return state;
  const next = { ...state.schedule };
  if (move.start === null) delete next[move.task];
  else next[move.task] = move.start;
  if (
    !validKitchenSchedule(level, next) ||
    next[move.task] === state.schedule[move.task]
  )
    return state;
  return { schedule: next, history: [...state.history, { ...state.schedule }] };
}
export function undoKitchen(
  level: KitchenLevel,
  state: KitchenState,
): KitchenState {
  if (kitchenWon(level, state.schedule)) return state;
  const previous = state.history.at(-1);
  return previous
    ? { schedule: { ...previous }, history: state.history.slice(0, -1) }
    : state;
}
/**
 * Finite-domain CSP: fixed assignments are singleton domains. Arc consistency
 * prunes only values with no compatible partner; exhaustive MRV branching then
 * decides the remainder. Both node and pair-check budgets are hard bounds.
 * No certificate lookup, greedy impossibility claim, or silent rescheduling.
 */
export function searchKitchen(
  level: KitchenLevel,
  fixed: KitchenSchedule = {},
  maxStates = KITCHEN_SEARCH_LIMIT,
  maxChecks = KITCHEN_CHECK_LIMIT,
): KitchenSearch {
  const report = inspectKitchen(level, fixed);
  const result = (
    status: KitchenSearch["status"],
    schedule: KitchenSchedule | null = null,
  ): KitchenSearch => ({ status, schedule, visited, checks });
  let visited = 0,
    checks = 0;
  if (!report.valid) return result("invalid");
  if (report.issues.length) return result("conflict");
  if (report.complete) return result("solved", { ...fixed });
  const clamp = (n: number, cap: number) =>
    Number.isFinite(n) ? Math.max(0, Math.min(cap, Math.floor(n))) : cap;
  const nodeLimit = clamp(maxStates, KITCHEN_SEARCH_LIMIT),
    checkLimit = clamp(maxChecks, KITCHEN_CHECK_LIMIT);
  const tasks = level.tasks;
  const domains = tasks.map((task) =>
    fixed[task.id] !== undefined
      ? [fixed[task.id]]
      : Array.from(
          { length: Math.max(0, level.deadline - task.duration + 1) },
          (_, i) => i,
        ),
  );
  const edges: [number, number][] = [];
  for (let i = 0; i < tasks.length; i++)
    for (let j = 0; j < tasks.length; j++)
      if (
        i !== j &&
        (tasks[i].station === tasks[j].station ||
          tasks[i].after.includes(tasks[j].id) ||
          tasks[j].after.includes(tasks[i].id))
      )
        edges.push([i, j]);
  const budget = Symbol("budget");
  function compatible(i: number, si: number, j: number, sj: number): boolean {
    if (checks >= checkLimit) throw budget;
    checks++;
    const a = tasks[i],
      b = tasks[j];
    return (
      !(
        a.station === b.station &&
        si < sj + b.duration &&
        sj < si + a.duration
      ) &&
      !(a.after.includes(b.id) && si < sj + b.duration) &&
      !(b.after.includes(a.id) && sj < si + a.duration)
    );
  }
  function solve(values: number[][]): KitchenSchedule | null {
    if (visited >= nodeLimit) throw budget;
    visited++;
    let changed = true;
    while (changed) {
      changed = false;
      if (values.some((domain) => domain.length === 0)) return null;
      for (const [i, j] of edges) {
        const filtered = values[i].filter((si) =>
          values[j].some((sj) => compatible(i, si, j, sj)),
        );
        if (!filtered.length) return null;
        if (filtered.length !== values[i].length) {
          values[i] = filtered;
          changed = true;
        }
      }
    }
    let next = -1;
    for (let i = 0; i < values.length; i++)
      if (
        values[i].length > 1 &&
        (next === -1 || values[i].length < values[next].length)
      )
        next = i;
    if (next === -1)
      return Object.fromEntries(
        tasks.map((task, i) => [task.id, values[i][0]]),
      );
    for (const start of values[next]) {
      const child = values.map((domain) => [...domain]);
      child[next] = [start];
      const answer = solve(child);
      if (answer) return answer;
    }
    return null;
  }
  try {
    const answer = solve(domains);
    return result(answer ? "solved" : "impossible", answer);
  } catch (error) {
    if (error !== budget) throw error;
    return result("limit");
  }
}
export function kitchenHint(
  level: KitchenLevel,
  schedule: KitchenSchedule,
  maxStates = KITCHEN_SEARCH_LIMIT,
  maxChecks = KITCHEN_CHECK_LIMIT,
): {
  status: KitchenSearch["status"];
  text: string;
  move: KitchenPlacement | null;
} {
  const answer = searchKitchen(level, schedule, maxStates, maxChecks);
  if (answer.status === "invalid")
    return {
      status: answer.status,
      text: "这个时间表的数据无效，请用重来恢复。",
      move: null,
    };
  if (answer.status === "conflict") {
    const issue = inspectKitchen(level, schedule).issues[0],
      task = issue.tasks.at(-1)!;
    return {
      status: answer.status,
      text: `${issue.text} 选中 ${task}，改选开始刻度或点“移出时间轴”；也可以撤销上一次编辑。`,
      move: { task, start: null },
    };
  }
  if (answer.status === "limit")
    return {
      status: answer.status,
      text: `已检查 ${answer.visited} 个分支、${answer.checks} 对时间，达到本次提示预算，尚不能确定能否完成。这不代表无解；可继续编辑，或撤销一次安排再提示。`,
      move: null,
    };
  if (answer.status === "impossible") {
    const task = Object.keys(schedule).at(-1);
    return {
      status: answer.status,
      text: task
        ? `已完整检查：保留当前安排时，无法在 ${level.deadline} 格内完成。先选中 ${task}，点“移出时间轴”再提示，或撤销一次编辑；可能需要一起调整多个工序。`
        : "已完整检查：这个任务单在期限内没有可行时间表。请重来或换关。",
      move: task ? { task, start: null } : null,
    };
  }
  const task = level.tasks.find(
    (item) =>
      schedule[item.id] === undefined &&
      item.after.every((id) => schedule[id] !== undefined),
  );
  if (!task)
    return {
      status: "solved",
      text: "时间表已完成，所有工序满足先后关系且没有争用。",
      move: null,
    };
  const start = answer.schedule![task.id];
  return {
    status: "solved",
    text: `保留你已经安排的工序，试把 ${task.id}「${task.name}」放在 ${start}→${start + task.duration}。其余空位仍有可行安排。`,
    move: { task: task.id, start },
  };
}
