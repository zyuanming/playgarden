// SPDX-License-Identifier: GPL-3.0-only
export type FleetMark = "unknown" | "ship" | "sea";
export type FleetFragment =
  "sea" | "ship" | "single" | "N" | "E" | "S" | "W" | "middle-h" | "middle-v";
export type FleetClue = { cell: number; fragment: FleetFragment };
export type FleetProblem = {
  id: string;
  title: string;
  lesson: string;
  size: number;
  fleet: readonly number[];
  rowTotals: readonly number[];
  colTotals: readonly number[];
  clues: readonly FleetClue[];
};
export type FleetLevel = FleetProblem & {
  certificate: { occupied: readonly number[]; unique: true; nodes: number };
};
export type FleetState = {
  marks: readonly FleetMark[];
  history: readonly (readonly FleetMark[])[];
};
export const FLEET_NODE_LIMIT = 200_000;
export const FLEET_FRAGMENT_LABELS: Record<FleetFragment, string> = {
  sea: "已知海水",
  ship: "已知船格，形状未定",
  single: "独立单格船",
  N: "船的北端，向南延伸",
  E: "船的东端，向西延伸",
  S: "船的南端，向北延伸",
  W: "船的西端，向东延伸",
  "middle-h": "横向船的中段，左右均有船格",
  "middle-v": "纵向船的中段，上下均有船格",
};
const fragments = Object.keys(FLEET_FRAGMENT_LABELS);
export function validFleetProblem(l: FleetProblem): boolean {
  const n = l.size,
    sum = (a: readonly number[]) => a.reduce((a, b) => a + b, 0);
  return (
    Number.isInteger(n) &&
    n >= 2 &&
    n <= 6 &&
    l.fleet.length > 0 &&
    l.fleet.length <= 6 &&
    l.fleet.every((v) => Number.isInteger(v) && v >= 1 && v <= 3) &&
    [l.rowTotals, l.colTotals].every(
      (a) =>
        a.length === n &&
        a.every((v) => Number.isInteger(v) && v >= 0 && v <= n) &&
        sum(a) === sum(l.fleet),
    ) &&
    l.clues.length <= n * n &&
    new Set(l.clues.map((c) => c.cell)).size === l.clues.length &&
    l.clues.every(
      (c) =>
        Number.isInteger(c.cell) &&
        c.cell >= 0 &&
        c.cell < n * n &&
        fragments.includes(c.fragment),
    )
  );
}
export function fleetFragment(
  n: number,
  occupied: readonly boolean[],
  cell: number,
): FleetFragment {
  if (!occupied[cell]) return "sea";
  const r = Math.floor(cell / n),
    c = cell % n,
    west = c > 0 && occupied[cell - 1],
    east = c < n - 1 && occupied[cell + 1],
    north = r > 0 && occupied[cell - n],
    south = r < n - 1 && occupied[cell + n];
  if (!west && !east && !north && !south) return "single";
  if (west && east) return "middle-h";
  if (north && south) return "middle-v";
  if (east) return "W";
  if (west) return "E";
  if (south) return "N";
  return "S";
}
export type FleetCheck = { valid: boolean; message: string; ships: number[] };
/** Runtime completion checks rules, never a certificate or one stored answer. */
export function checkFleet(
  l: FleetProblem,
  occupied: readonly boolean[],
): FleetCheck {
  const fail = (message: string): FleetCheck => ({
    valid: false,
    message,
    ships: [],
  });
  if (
    !validFleetProblem(l) ||
    occupied.length !== l.size * l.size ||
    occupied.some((v) => typeof v !== "boolean")
  )
    return fail("局面数据无效。");
  const n = l.size;
  for (let r = 0; r < n; r++)
    if (
      occupied.slice(r * n, (r + 1) * n).filter(Boolean).length !==
      l.rowTotals[r]
    )
      return fail(`第 ${r + 1} 行船格数还不等于 ${l.rowTotals[r]}。`);
  for (let c = 0; c < n; c++)
    if (
      Array.from({ length: n }, (_, r) => occupied[r * n + c]).filter(Boolean)
        .length !== l.colTotals[c]
    )
      return fail(`第 ${c + 1} 列船格数还不等于 ${l.colTotals[c]}。`);
  for (const clue of l.clues)
    if (
      clue.fragment === "ship"
        ? !occupied[clue.cell]
        : fleetFragment(n, occupied, clue.cell) !== clue.fragment
    )
      return fail("有船形线索尚未满足。");
  const seen = new Set<number>(),
    ships: number[] = [];
  for (let cell = 0; cell < n * n; cell++) {
    if (!occupied[cell]) continue;
    const r = Math.floor(cell / n),
      c = cell % n;
    for (const dr of [-1, 1])
      for (const dc of [-1, 1])
        if (
          r + dr >= 0 &&
          r + dr < n &&
          c + dc >= 0 &&
          c + dc < n &&
          occupied[(r + dr) * n + c + dc]
        )
          return fail("不同船不能斜角相碰。");
    if (seen.has(cell)) continue;
    const component = [cell];
    seen.add(cell);
    for (let h = 0; h < component.length; h++) {
      const at = component[h],
        y = Math.floor(at / n),
        x = at % n;
      for (const [dy, dx] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ])
        if (y + dy >= 0 && y + dy < n && x + dx >= 0 && x + dx < n) {
          const next = (y + dy) * n + x + dx;
          if (occupied[next] && !seen.has(next)) {
            seen.add(next);
            component.push(next);
          }
        }
    }
    if (
      !component.every((x) => Math.floor(x / n) === r) &&
      !component.every((x) => x % n === c)
    )
      return fail("船必须是笔直的一段，不能转弯。");
    ships.push(component.length);
  }
  if (
    ships.sort((a, b) => b - a).join() !==
    [...l.fleet].sort((a, b) => b - a).join()
  )
    return fail("船只的长度或数量与船队清单不符。");
  return {
    valid: true,
    message: "行列计数、船形线索和整支船队都正确。",
    ships,
  };
}
export function initialFleetMarks(l: FleetProblem): FleetMark[] {
  const m: Array<FleetMark> = Array(l.size * l.size).fill("unknown");
  for (const c of l.clues) m[c.cell] = c.fragment === "sea" ? "sea" : "ship";
  return m;
}
export const createFleetState = (l: FleetProblem): FleetState => ({
  marks: initialFleetMarks(l),
  history: [],
});
export const fleetWon = (l: FleetProblem, marks: readonly FleetMark[]) =>
  marks.length === l.size * l.size &&
  marks.every((m) => m === "ship" || m === "sea") &&
  checkFleet(
    l,
    marks.map((m) => m === "ship"),
  ).valid;
export function editFleet(
  l: FleetProblem,
  s: FleetState,
  cell: number,
  mark: FleetMark,
): FleetState {
  if (
    fleetWon(l, s.marks) ||
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell >= s.marks.length ||
    l.clues.some((c) => c.cell === cell) ||
    s.marks[cell] === mark ||
    !["unknown", "ship", "sea"].includes(mark)
  )
    return s;
  const marks = [...s.marks];
  marks[cell] = mark;
  return { marks, history: [...s.history, s.marks] };
}
export function fillFleetSea(l: FleetProblem, s: FleetState): FleetState {
  if (fleetWon(l, s.marks) || !s.marks.includes("unknown")) return s;
  return {
    marks: s.marks.map((m) => (m === "unknown" ? "sea" : m)),
    history: [...s.history, s.marks],
  };
}
export function undoFleet(l: FleetProblem, s: FleetState): FleetState {
  return !s.history.length || fleetWon(l, s.marks)
    ? s
    : {
        marks: s.history[s.history.length - 1],
        history: s.history.slice(0, -1),
      };
}
type Placement = {
  cells: number[];
  halo: number[];
  rows: number[];
  cols: number[];
};
function placements(
  l: FleetProblem,
  length: number,
  marks: readonly FleetMark[],
): Placement[] {
  const n = l.size,
    out: Placement[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      for (const vertical of length === 1 ? [false] : [false, true]) {
        if (r + (vertical ? length : 1) > n || c + (vertical ? 1 : length) > n)
          continue;
        const cells = Array.from(
          { length },
          (_, i) => (r + (vertical ? i : 0)) * n + c + (vertical ? 0 : i),
        );
        if (cells.some((cell) => marks[cell] === "sea")) continue;
        const own = new Set(cells),
          halo = new Set<number>();
        for (const cell of cells)
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const y = Math.floor(cell / n) + dy,
                x = (cell % n) + dx;
              if (y >= 0 && y < n && x >= 0 && x < n && !own.has(y * n + x))
                halo.add(y * n + x);
            }
        if ([...halo].some((cell) => marks[cell] === "ship")) continue;
        const shape = Array.from({ length: n * n }, (_, i) => own.has(i));
        if (
          l.clues.some(
            (clue) =>
              own.has(clue.cell) &&
              (clue.fragment === "sea" ||
                (clue.fragment !== "ship" &&
                  fleetFragment(n, shape, clue.cell) !== clue.fragment)),
          )
        )
          continue;
        const rows = Array(n).fill(0),
          cols = Array(n).fill(0);
        for (const cell of cells) {
          rows[Math.floor(cell / n)]++;
          cols[cell % n]++;
        }
        if (
          rows.some((count, i) => count > l.rowTotals[i]) ||
          cols.some((count, i) => count > l.colTotals[i])
        )
          continue;
        out.push({ cells, halo: [...halo], rows, cols });
      }
  return out;
}
export type FleetSearch = {
  status: "complete" | "solution-limit" | "budget" | "invalid";
  solutions: boolean[][];
  nodes: number;
};
/** Placement CSP. Equal-length ships use increasing placement indices; occupied boards are deduplicated too. */
export function solveFleet(
  l: FleetProblem,
  marks: readonly FleetMark[] = initialFleetMarks(l),
  options: { maxNodes?: number; maxSolutions?: number } = {},
): FleetSearch {
  if (
    !validFleetProblem(l) ||
    marks.length !== l.size * l.size ||
    marks.some((m) => !["unknown", "ship", "sea"].includes(m)) ||
    l.clues.some(
      (c) => marks[c.cell] !== (c.fragment === "sea" ? "sea" : "ship"),
    )
  )
    return { status: "invalid", solutions: [], nodes: 0 };
  const requestedBudget = options.maxNodes ?? FLEET_NODE_LIMIT,
    requestedLimit = options.maxSolutions ?? 2;
  const budget = Number.isFinite(requestedBudget)
      ? Math.max(0, Math.min(FLEET_NODE_LIMIT, Math.floor(requestedBudget)))
      : FLEET_NODE_LIMIT,
    limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.floor(requestedLimit))
      : 2;
  const inventory = [...l.fleet].sort((a, b) => b - a),
    choices = new Map(
      [...new Set(inventory)].map((len) => [len, placements(l, len, marks)]),
    );
  const occupied = Array<boolean>(l.size * l.size).fill(false),
    blocked = Array<number>(l.size * l.size).fill(0),
    row = [...l.rowTotals],
    col = [...l.colTotals],
    solutions: boolean[][] = [],
    keys = new Set<string>();
  let nodes = 0,
    status: FleetSearch["status"] = "complete";
  function walk(depth: number, previous: number) {
    if (status !== "complete") return;
    if (nodes >= budget) {
      status = "budget";
      return;
    }
    nodes++;
    if (depth === inventory.length) {
      if (
        row.some(Boolean) ||
        col.some(Boolean) ||
        marks.some((m, i) => m === "ship" && !occupied[i])
      )
        return;
      const key = occupied.map((v) => (v ? 1 : 0)).join("");
      if (!keys.has(key)) {
        keys.add(key);
        solutions.push([...occupied]);
        if (solutions.length >= limit) status = "solution-limit";
      }
      return;
    }
    // Residual row/column capacity catches impossible water marks without declaring bounded searches exhaustive.
    for (let r = 0; r < l.size; r++)
      if (
        row[r] >
        Array.from({ length: l.size }, (_, c) => r * l.size + c).filter(
          (i) => !blocked[i] && marks[i] !== "sea",
        ).length
      )
        return;
    for (let c = 0; c < l.size; c++)
      if (
        col[c] >
        Array.from({ length: l.size }, (_, r) => r * l.size + c).filter(
          (i) => !blocked[i] && marks[i] !== "sea",
        ).length
      )
        return;
    const list = choices.get(inventory[depth])!;
    for (
      let i =
        depth > 0 && inventory[depth] === inventory[depth - 1]
          ? previous + 1
          : 0;
      i < list.length;
      i++
    ) {
      const p = list[i];
      if (
        p.cells.some((c) => blocked[c]) ||
        p.rows.some((v, r) => v > row[r]) ||
        p.cols.some((v, c) => v > col[c])
      )
        continue;
      for (const c of p.cells) {
        occupied[c] = true;
        blocked[c]++;
      }
      for (const c of p.halo) blocked[c]++;
      for (let j = 0; j < l.size; j++) {
        row[j] -= p.rows[j];
        col[j] -= p.cols[j];
      }
      walk(depth + 1, i);
      for (let j = 0; j < l.size; j++) {
        row[j] += p.rows[j];
        col[j] += p.cols[j];
      }
      for (const c of p.cells) {
        occupied[c] = false;
        blocked[c]--;
      }
      for (const c of p.halo) blocked[c]--;
      if (status !== "complete") return;
    }
  }
  walk(0, -1);
  return { status, solutions, nodes };
}
export type FleetHint = {
  text: string;
  cell: number | null;
  mark: FleetMark | null;
};
/** A recommendation is forced only after a complete uniqueness proof. */
export function fleetHint(
  l: FleetProblem,
  marks: readonly FleetMark[],
  maxNodes = FLEET_NODE_LIMIT,
): FleetHint {
  const search = solveFleet(l, marks, { maxNodes, maxSolutions: 2 }),
    base = { cell: null, mark: null };
  if (search.status === "invalid")
    return { ...base, text: "局面数据无效，请重置。" };
  if (search.status === "budget")
    return {
      ...base,
      text: "搜索达到上限，还不能判断这些标记是否可行或哪一格必定成立。可以先核对行列计数。",
    };
  if (search.solutions.length === 0)
    return {
      ...base,
      text: "已完整检查：当前标记互相矛盾。请撤销最近的船或海水标记，再核对行列计数。",
    };
  const solution = search.solutions[0],
    unknown = marks.findIndex((m) => m === "unknown");
  if (unknown < 0)
    return {
      ...base,
      text: checkFleet(
        l,
        marks.map((m) => m === "ship"),
      ).message,
    };
  const mark: FleetMark = solution[unknown] ? "ship" : "sea";
  if (search.status === "complete" && search.solutions.length === 1)
    return {
      cell: unknown,
      mark,
      text: `结合当前标记、行列计数与船队清单，第 ${Math.floor(unknown / l.size) + 1} 行第 ${(unknown % l.size) + 1} 列必定是${mark === "ship" ? "船格" : "海水"}。提示不会自动填格。`,
    };
  // Multiple witnessed boards are not a proof that shared cells are forced. Show only a safe plan choice.
  return {
    cell: unknown,
    mark,
    text: `当前仍有多种合法船位。一种可行方案把第 ${Math.floor(unknown / l.size) + 1} 行第 ${(unknown % l.size) + 1} 列作为${mark === "ship" ? "船格" : "海水"}；这不是必填结论。`,
  };
}
