/** Original implementation of the Black Box ray rules. Ports: N, E, S, W;
 * each side is read left-to-right / top-to-bottom (never clockwise).
 * All winning layouts are compared by their COMPLETE observable signature. */
export type BlackboxLevel = {
  id: string;
  title: string;
  chapter: number;
  size: number;
  atoms: number[];
};
export type Probe = { port: number; result: number };
export type Mark = -1 | 0 | 1;
export type MarkChange = { cell: number; before: Mark; after: Mark };
export type BlackboxState = {
  marks: Mark[];
  history: MarkChange[];
  probes: Probe[];
  submitted: boolean;
};
export type BlackboxCandidate = {
  atoms: readonly number[];
  signature: readonly number[];
};
export const BLACKBOX_SAVE_LIMIT = 4096;
export const ABSORBED = -1,
  REFLECTED = -2;
export function validBlackboxSize(size: number): boolean {
  return Number.isInteger(size) && size >= 3 && size <= 5;
}
export function validAtoms(size: number, atoms: unknown): atoms is number[] {
  return (
    validBlackboxSize(size) &&
    Array.isArray(atoms) &&
    atoms.length <= 4 &&
    Array.from(atoms).every(
      (a) => Number.isInteger(a) && a >= 0 && a < size * size,
    ) &&
    new Set(atoms).size === atoms.length
  );
}
export function portName(size: number, port: number): string {
  return (
    ["北", "东", "南", "西"][Math.floor(port / size)] +
    String((port % size) + 1)
  );
}
export function resultName(size: number, result: number): string {
  return result === ABSORBED
    ? "吸收 ●"
    : result === REFLECTED
      ? "返回 ↩"
      : `到 ${portName(size, result)}`;
}
export function cellName(size: number, cell: number): string {
  return `第 ${Math.floor(cell / size) + 1} 行第 ${(cell % size) + 1} 列`;
}
/** Invalid input returns null. A genuine cycle is an invariant error, not reflection. */
export function traceBlackbox(
  size: number,
  atoms: readonly number[],
  port: number,
): number | null {
  if (
    !validAtoms(size, atoms) ||
    !Number.isInteger(port) ||
    port < 0 ||
    port >= size * 4
  )
    return null;
  const occupied = new Set(atoms),
    side = Math.floor(port / size),
    offset = port % size;
  let x = side === 1 ? size : side === 3 ? -1 : offset;
  let y = side === 0 ? -1 : side === 2 ? size : offset;
  let dx = side === 1 ? -1 : side === 3 ? 1 : 0;
  let dy = side === 0 ? 1 : side === 2 ? -1 : 0;
  const has = (a: number, b: number) =>
    a >= 0 && b >= 0 && a < size && b < size && occupied.has(b * size + a);
  if (has(x + dx, y + dy)) return ABSORBED;
  if (has(x + dx - dy, y + dy + dx) || has(x + dx + dy, y + dy - dx))
    return REFLECTED;
  x += dx;
  y += dy;
  const seen = new Set<string>();
  while (true) {
    const key = `${x},${y},${dx},${dy}`;
    if (seen.has(key)) throw new Error("A ray from the boundary cannot cycle");
    seen.add(key);
    if (has(x + dx, y + dy)) return ABSORBED;
    const left = has(x + dx + dy, y + dy - dx),
      right = has(x + dx - dy, y + dy + dx);
    if (left && right) {
      dx = -dx;
      dy = -dy;
    } else if (left) {
      [dx, dy] = [-dy, dx];
    } else if (right) {
      [dx, dy] = [dy, -dx];
    } else {
      x += dx;
      y += dy;
    }
    if (x < 0 || y < 0 || x >= size || y >= size) {
      const exit =
        y < 0
          ? x
          : x >= size
            ? size + y
            : y >= size
              ? 2 * size + x
              : 3 * size + y;
      return exit === port ? REFLECTED : exit;
    }
  }
}
export function blackboxSignature(
  size: number,
  atoms: readonly number[],
): number[] | null {
  if (!validAtoms(size, atoms)) return null;
  return Array.from({ length: 4 * size }, (_, port) =>
    traceBlackbox(size, atoms, port)!,
  );
}
const universes = new Map<string, readonly BlackboxCandidate[]>();
export function blackboxUniverse(
  size: number,
  count: number,
): readonly BlackboxCandidate[] {
  if (
    !validBlackboxSize(size) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 4
  )
    return [];
  const key = `${size}:${count}`,
    cached = universes.get(key);
  if (cached) return cached;
  const all: BlackboxCandidate[] = [];
  function visit(atoms: number[], start: number) {
    if (atoms.length === count) {
      all.push(
        Object.freeze({
          atoms: Object.freeze([...atoms]),
          signature: Object.freeze(blackboxSignature(size, atoms)!),
        }),
      );
      return;
    }
    for (let cell = start; cell <= size * size - (count - atoms.length); cell++)
      visit([...atoms, cell], cell + 1);
  }
  visit([], 0);
  const result = Object.freeze(all);
  universes.set(key, result);
  return result;
}
export function blackboxCandidates(
  size: number,
  count: number,
  probes: readonly Probe[],
): readonly BlackboxCandidate[] {
  if (
    !Array.isArray(probes) ||
    Array.from(probes).some(
      (p) =>
        !p ||
        !Number.isInteger(p.port) ||
        p.port < 0 ||
        p.port >= 4 * size ||
        !Number.isInteger(p.result) ||
        p.result < -2 ||
        p.result >= 4 * size,
    )
  )
    return [];
  return blackboxUniverse(size, count).filter((candidate) =>
    probes.every((p) => candidate.signature[p.port] === p.result),
  );
}
/** Deterministically minimizes expected survivors for an equally likely candidate. */
export function bestBlackboxProbe(
  size: number,
  candidates: readonly BlackboxCandidate[],
  probes: readonly Probe[],
): { port: number; worst: number; partitions: number } | null {
  let best: {
    port: number;
    worst: number;
    partitions: number;
    cost: number;
  } | null = null;
  for (let port = 0; port < 4 * size; port++) {
    if (probes.some((p) => p.port === port)) continue;
    const buckets = new Map<number, number>();
    for (const candidate of candidates) {
      const r = candidate.signature[port];
      buckets.set(r, (buckets.get(r) ?? 0) + 1);
    }
    if (buckets.size < 2) continue;
    const sizes = [...buckets.values()],
      cost = sizes.reduce((sum, n) => sum + n * n, 0),
      worst = Math.max(...sizes);
    if (!best || cost < best.cost || (cost === best.cost && worst < best.worst))
      best = { port, worst, partitions: buckets.size, cost };
  }
  return (
    best && { port: best.port, worst: best.worst, partitions: best.partitions }
  );
}
export function createBlackboxState(level: BlackboxLevel): BlackboxState {
  return {
    marks: Array(level.size * level.size).fill(0),
    history: [],
    probes: [],
    submitted: false,
  };
}
export function markBlackbox(
  state: BlackboxState,
  cell: number,
  value: Mark,
): BlackboxState {
  if (
    state.submitted ||
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell >= state.marks.length ||
    ![-1, 0, 1].includes(value) ||
    state.marks[cell] === value
  )
    return state;
  const marks = [...state.marks];
  marks[cell] = value;
  return {
    ...state,
    marks,
    history: [
      ...state.history,
      { cell, before: state.marks[cell], after: value },
    ],
  };
}
export function undoBlackbox(state: BlackboxState): BlackboxState {
  const change = state.history.at(-1);
  if (state.submitted || !change) return state;
  const marks = [...state.marks];
  marks[change.cell] = change.before;
  return { ...state, marks, history: state.history.slice(0, -1) };
}
export function fireBlackbox(
  level: BlackboxLevel,
  state: BlackboxState,
  port: number,
): BlackboxState {
  if (
    state.submitted ||
    observedBlackbox(state.probes).some((p) => p.port === port)
  )
    return state;
  const result = traceBlackbox(level.size, level.atoms, port);
  if (result === null) return state;
  // The reciprocal exit is learned by this SAME experiment; keep one record per shot.
  return { ...state, probes: [...state.probes, { port, result }] };
}
export function observedBlackbox(probes: readonly Probe[]): Probe[] {
  const result = new Map<number, number>();
  for (const probe of probes) {
    result.set(probe.port, probe.result);
    if (probe.result >= 0) result.set(probe.result, probe.port);
  }
  return [...result].map(([port, result]) => ({ port, result }));
}
export function checkBlackbox(
  level: BlackboxLevel,
  state: BlackboxState,
): {
  state: BlackboxState;
  kind: "count" | "won" | "conflict" | "locked";
  port?: number;
  actual?: number;
  predicted?: number;
} {
  if (state.submitted) return { state, kind: "locked" };
  if (
    !Array.isArray(state.marks) ||
    state.marks.length !== level.size * level.size ||
    !Array.from(state.marks).every((v) => v === -1 || v === 0 || v === 1) ||
    !validAtoms(level.size, level.atoms)
  )
    return { state, kind: "count" };
  const atoms = state.marks.flatMap((v, i) => (v === 1 ? [i] : []));
  if (atoms.length !== level.atoms.length) return { state, kind: "count" };
  const expected = blackboxSignature(level.size, level.atoms)!,
    guessed = blackboxSignature(level.size, atoms)!;
  // Prefer existing evidence before exposing a fresh measurement.
  const ports = [
    ...observedBlackbox(state.probes).map((p) => p.port),
    ...Array.from({ length: 4 * level.size }, (_, i) => i),
  ];
  const port = ports.find((p) => expected[p] !== guessed[p]);
  if (port === undefined)
    return { state: { ...state, submitted: true }, kind: "won" };
  return {
    state: fireBlackbox(level, state, port),
    kind: "conflict",
    port,
    actual: expected[port],
    predicted: guessed[port],
  };
}
export type BlackboxHint =
  | { kind: "mark"; cell: number; value: Mark; reason: string }
  | { kind: "probe"; port: number; reason: string }
  | { kind: "ready" | "equivalent" | "invalid"; reason: string };
/** Does not receive hidden atoms: hints cannot use the preset answer. */
export function getBlackboxHint(
  size: number,
  count: number,
  state: Pick<BlackboxState, "marks" | "probes">,
): BlackboxHint {
  if (
    !state ||
    !Array.isArray(state.marks) ||
    state.marks.length !== size * size ||
    !Array.from(state.marks).every((v) => v === -1 || v === 0 || v === 1) ||
    !Array.isArray(state.probes) ||
    Array.from(state.probes).some(
      (p) => !p || !Number.isInteger(p.port) || !Number.isInteger(p.result),
    )
  )
    return { kind: "invalid", reason: "观测记录不一致，请重来这一关。" };
  const candidates = blackboxCandidates(size, count, state.probes);
  if (!candidates.length)
    return { kind: "invalid", reason: "观测记录不一致，请重来这一关。" };
  for (let cell = 0; cell < size * size; cell++)
    if (
      state.marks[cell] !== 1 &&
      candidates.every((c) => c.atoms.includes(cell))
    )
      return {
        kind: "mark",
        cell,
        value: 1,
        reason: `${candidates.length} 种符合已知观测的布局都在${cellName(size, cell)}放星。可以把这里标成 ★。`,
      };
  for (let cell = 0; cell < size * size; cell++)
    if (
      state.marks[cell] === 1 &&
      candidates.every((c) => !c.atoms.includes(cell))
    )
      return {
        kind: "mark",
        cell,
        value: -1,
        reason: `根据已取得的观测，${cellName(size, cell)}在所有候选中都是空格。把这个猜测改成 × 再试试。`,
      };
  const best = bestBlackboxProbe(
    size,
    candidates,
    observedBlackbox(state.probes),
  );
  if (best)
    return {
      kind: "probe",
      port: best.port,
      reason: `还有 ${candidates.length} 种布局符合观测。试试${portName(size, best.port)}：不同候选会给出 ${best.partitions} 类结果，最多留下 ${best.worst} 种。提示只选入口，请你发射。`,
    };
  if (candidates.length === 1)
    return {
      kind: "ready",
      reason:
        "现有证据已确定所有星位。已标好的 ★ 可以提交验证；× 只是你的笔记，不必把每格填满。",
    };
  return {
    kind: "equivalent",
    reason: `剩下 ${candidates.length} 种布局的所有边缘响应完全相同。任一完整等价布局都可通过验证，不需要猜中预设星位。`,
  };
}
