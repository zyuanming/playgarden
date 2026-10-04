// SPDX-License-Identifier: MIT
/** Original finite, non-recursive subroutine synthesis puzzle. Certificates are never read at runtime. */
export type PenCommand = "F" | "L" | "R";
export type FunctionCall = "A" | "B";
export type TraceDirection = "E" | "S" | "W" | "N";
export type FactoryProgram = {
  A: (PenCommand | null)[];
  B: (PenCommand | null)[];
  main: (FunctionCall | null)[];
};
export type FactoryLevel = {
  title: string;
  lesson: string;
  lengths: readonly [number, number];
  calls: number;
  target: string;
  finalHeading: TraceDirection;
  certificate: { A: string; B: string; main: string };
};
export type FactoryState = {
  program: FactoryProgram;
  history: FactoryProgram[];
};
export type FactorySlot = { section: "A" | "B" | "main"; index: number };
export type FactorySearch = {
  status: "solved" | "unreachable" | "limit" | "cancelled" | "invalid";
  program: FactoryProgram | null;
  checked: number;
};
export const FACTORY_SEARCH_LIMIT = 450000;
export const factoryDirections = ["E", "S", "W", "N"] as const;
export const factoryDirectionNames: Record<TraceDirection, string> = {
  E: "东",
  S: "南",
  W: "西",
  N: "北",
};
export const copyFactoryProgram = (p: FactoryProgram): FactoryProgram => ({
  A: [...p.A],
  B: [...p.B],
  main: [...p.main],
});
export function initialFactoryProgram(level: FactoryLevel): FactoryProgram {
  return {
    A: Array(level.lengths[0]).fill(null),
    B: Array(level.lengths[1]).fill(null),
    main: Array(level.calls).fill(null),
  };
}
export function createFactoryState(level: FactoryLevel): FactoryState {
  return { program: initialFactoryProgram(level), history: [] };
}
export function validFactoryLevel(level: FactoryLevel): boolean {
  return (
    level.lengths.length === 2 &&
    Number.isInteger(level.lengths[0]) &&
    level.lengths[0] >= 2 &&
    level.lengths[0] <= 4 &&
    Number.isInteger(level.lengths[1]) &&
    (level.lengths[1] === 0 ||
      (level.lengths[1] >= 2 && level.lengths[1] <= 4)) &&
    Number.isInteger(level.calls) &&
    level.calls >= (level.lengths[1] ? 4 : 2) &&
    level.calls <= 6 &&
    /^[ESWN]{1,24}$/.test(level.target) &&
    factoryDirections.includes(level.finalHeading)
  );
}
export function validFactoryProgram(
  level: FactoryLevel,
  p: FactoryProgram,
): boolean {
  return (
    validFactoryLevel(level) &&
    p.A.length === level.lengths[0] &&
    p.B.length === level.lengths[1] &&
    p.main.length === level.calls &&
    [...p.A, ...p.B].every(
      (c) => c === null || c === "F" || c === "L" || c === "R",
    ) &&
    p.main.every(
      (c) => c === null || c === "A" || (c === "B" && p.B.length > 0),
    )
  );
}
export function editFactory(
  level: FactoryLevel,
  state: FactoryState,
  slot: FactorySlot,
  value: PenCommand | FunctionCall | null,
): FactoryState {
  if (
    !validFactoryProgram(level, state.program) ||
    !Number.isInteger(slot.index) ||
    slot.index < 0 ||
    slot.index >= state.program[slot.section].length ||
    state.program[slot.section][slot.index] === value
  )
    return state;
  const p = copyFactoryProgram(state.program);
  if (slot.section === "main") {
    if (value !== null && value !== "A" && value !== "B") return state;
    p.main[slot.index] = value;
  } else {
    if (value !== null && value !== "F" && value !== "L" && value !== "R")
      return state;
    p[slot.section][slot.index] = value;
  }
  return validFactoryProgram(level, p)
    ? {
        program: p,
        history: [...state.history, copyFactoryProgram(state.program)],
      }
    : state;
}
export function undoFactory(state: FactoryState): FactoryState {
  const p = state.history.at(-1);
  return p
    ? { program: copyFactoryProgram(p), history: state.history.slice(0, -1) }
    : state;
}
/** Executes real definitions in call order, including turns and retraced strokes. */
export function interpretFactory(
  level: FactoryLevel,
  p: FactoryProgram,
): {
  trace: string;
  heading: TraceDirection;
  complete: boolean;
  steps: number;
} {
  let direction = 0,
    trace = "",
    steps = 0;
  if (!validFactoryProgram(level, p))
    return { trace, heading: "E", complete: false, steps };
  for (const call of p.main) {
    if (!call)
      return {
        trace,
        heading: factoryDirections[direction],
        complete: false,
        steps,
      };
    for (const command of p[call]) {
      if (!command)
        return {
          trace,
          heading: factoryDirections[direction],
          complete: false,
          steps,
        };
      if (command === "F") trace += factoryDirections[direction];
      else direction = (direction + (command === "R" ? 1 : 3)) % 4;
      steps++;
    }
  }
  return {
    trace,
    heading: factoryDirections[direction],
    complete: true,
    steps,
  };
}
/** Goal is public strokes + heading + true abstraction/reuse, never a certificate match. */
export function verifyFactory(level: FactoryLevel, p: FactoryProgram): boolean {
  if (
    !validFactoryProgram(level, p) ||
    [...p.A, ...p.B, ...p.main].includes(null)
  )
    return false;
  if (
    p.main.filter((c) => c === "A").length < 2 ||
    (p.B.length > 0 &&
      (p.main.filter((c) => c === "B").length < 2 ||
        p.A.join("") === p.B.join("")))
  )
    return false;
  // Independently stream-check the public specification instead of trusting
  // the preview interpreter or allocating its complete trace.
  let facing: TraceDirection = "E",
    stroke = 0;
  const left: Record<TraceDirection, TraceDirection> = {
    E: "N",
    N: "W",
    W: "S",
    S: "E",
  };
  const right: Record<TraceDirection, TraceDirection> = {
    E: "S",
    S: "W",
    W: "N",
    N: "E",
  };
  for (const call of p.main)
    for (const command of p[call!]) {
      if (command === "F") {
        if (level.target[stroke++] !== facing) return false;
      } else if (command === "L") facing = left[facing];
      else if (command === "R") facing = right[facing];
      else return false;
    }
  return stroke === level.target.length && facing === level.finalHeading;
}
export function factoryTracePoints(trace: string): { x: number; y: number }[] {
  const points = [{ x: 0, y: 0 }];
  for (const d of trace) {
    const last = points.at(-1)!;
    points.push({
      x: last.x + (d === "E" ? 1 : d === "W" ? -1 : 0),
      y: last.y + (d === "S" ? 1 : d === "N" ? -1 : 0),
    });
  }
  return points;
}
/** Exhaustive enumeration of assignments extending the actual editor state. Largest domain: 3^8 * 2^6 = 419904 candidates. */
export function* factorySearchSteps(
  level: FactoryLevel,
  current: FactoryProgram,
  cap = FACTORY_SEARCH_LIMIT,
): Generator<number, FactorySearch, void> {
  if (!validFactoryProgram(level, current))
    return { status: "invalid", program: null, checked: 0 };
  const limit = Number.isFinite(cap)
    ? Math.max(0, Math.min(FACTORY_SEARCH_LIMIT, Math.floor(cap)))
    : FACTORY_SEARCH_LIMIT;
  const p = copyFactoryProgram(current),
    blanks: FactorySlot[] = [];
  for (const section of ["A", "B", "main"] as const)
    p[section].forEach((value, index) => {
      if (value === null) blanks.push({ section, index });
    });
  let checked = 0,
    found: FactoryProgram | null = null,
    limited = false;
  function* visit(depth: number): Generator<number, void, void> {
    if (found || limited) return;
    if (depth === blanks.length) {
      if (checked >= limit) {
        limited = true;
        return;
      }
      checked++;
      if (verifyFactory(level, p)) found = copyFactoryProgram(p);
      if (checked % 128 === 0) yield checked;
      return;
    }
    const slot = blanks[depth];
    if (slot.section === "main") {
      for (const c of (p.B.length ? ["A", "B"] : ["A"]) as FunctionCall[]) {
        p.main[slot.index] = c;
        yield* visit(depth + 1);
        if (found || limited) break;
      }
    } else {
      for (const c of ["F", "L", "R"] as PenCommand[]) {
        p[slot.section][slot.index] = c;
        yield* visit(depth + 1);
        if (found || limited) break;
      }
    }
    if (slot.section === "main") p.main[slot.index] = null;
    else p[slot.section][slot.index] = null;
  }
  yield* visit(0);
  return {
    status: found ? "solved" : limited ? "limit" : "unreachable",
    program: found,
    checked,
  };
}
export function searchFactory(
  level: FactoryLevel,
  current: FactoryProgram,
  cap = FACTORY_SEARCH_LIMIT,
): FactorySearch {
  const iterator = factorySearchSteps(level, current, cap);
  let next = iterator.next();
  while (!next.done) next = iterator.next();
  return next.value;
}
export async function searchFactoryAsync(
  level: FactoryLevel,
  current: FactoryProgram,
  options: {
    signal?: AbortSignal;
    cap?: number;
    onProgress?: (checked: number) => void;
    yieldTask?: () => Promise<void>;
  } = {},
): Promise<FactorySearch> {
  const iterator = factorySearchSteps(level, current, options.cap);
  let checked = 0;
  while (true) {
    if (options.signal?.aborted) {
      iterator.return({ status: "cancelled", program: null, checked });
      return { status: "cancelled", program: null, checked };
    }
    const next = iterator.next();
    if (next.done) return next.value;
    checked = next.value;
    options.onProgress?.(checked);
    await (options.yieldTask
      ? options.yieldTask()
      : new Promise<void>((resolve) => setTimeout(resolve, 0)));
  }
}
export function factoryHintFromSearch(
  current: FactoryProgram,
  result: FactorySearch,
): { text: string; slot: FactorySlot | null; value: string | null } {
  if (result.status !== "solved" || !result.program)
    return {
      slot: null,
      value: null,
      text:
        result.status === "unreachable"
          ? "保留当前所有格子的填法已经无法完成。请撤销或清空一个已填格，再找可复用的片段。"
          : result.status === "limit"
            ? `已检查 ${result.checked} 种填法，达到搜索上限；尚不能判断有无解。`
            : result.status === "cancelled"
              ? "提示搜索已取消，程序没有改变。"
              : "程序状态无效，请重置。",
    };
  for (const section of ["A", "B", "main"] as const) {
    const index = current[section].indexOf(null);
    if (index !== -1) {
      const value = result.program[section][index]!;
      return {
        slot: { section, index },
        value,
        text: `保留现有填法，${section === "main" ? "主程序" : `函数 ${section}`} 第 ${index + 1} 格可填 ${value}。这里只建议一格，请自己试运行。`,
      };
    }
  }
  return {
    text: "这份程序满足目标。点击试运行来检查作品。",
    slot: null,
    value: null,
  };
}
