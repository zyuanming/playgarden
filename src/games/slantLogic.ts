/** Playgarden's bounded constraint solver. Independent of the adapted generator. */
export type SlantValue = -1 | 0 | 1;
export type SlantPuzzle = { width: number; height: number; clues: readonly number[] };
export type SlantStats = { nodes: number; rounds: number; clueSteps: number; cycleSteps: number; branches: number; maxDepth: number };
export type SlantResult = { status: "unique" | "multiple" | "unsat" | "timeout"; solutions: SlantValue[][]; stats: SlantStats };
export function slantEdges(p: SlantPuzzle, i: number, v: number): [number, number] {
  const row = Math.floor(i / p.width), col = i % p.width, a = row * (p.width + 1) + col;
  return v === -1 ? [a, a + p.width + 2] : [a + 1, a + p.width + 1];
}
export function validSlantPuzzle(p: SlantPuzzle): boolean {
  return Number.isInteger(p.width) && Number.isInteger(p.height) && p.width > 0 && p.height > 0 && p.width <= 12 && p.height <= 12 &&
    p.clues.length === (p.width + 1) * (p.height + 1) && p.clues.every((c, i) => {
      const x = i % (p.width + 1), y = Math.floor(i / (p.width + 1));
      return Number.isInteger(c) && c >= -1 && c <= (x === 0 || x === p.width ? 1 : 2) * (y === 0 || y === p.height ? 1 : 2);
    });
}
function forest(p: SlantPuzzle, board: readonly number[]) {
  const parent = Array.from({ length: p.clues.length }, (_, i) => i), degrees = parent.map(() => 0);
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  let cycle = false;
  board.forEach((v, i) => { if (!v) return; const [a, b] = slantEdges(p, i, v); degrees[a]++; degrees[b]++; const ra = find(a), rb = find(b); if (ra === rb) cycle = true; else parent[ra] = rb; });
  return { degrees, find, cycle };
}
export function slantWon(p: SlantPuzzle, board: readonly number[]): boolean {
  if (!validSlantPuzzle(p) || board.length !== p.width * p.height || board.some(v => v !== -1 && v !== 1)) return false;
  const f = forest(p, board);
  return !f.cycle && p.clues.every((v, i) => v === -1 || f.degrees[i] === v);
}
export function solveSlant(p: SlantPuzzle, initial?: readonly number[], budget = 25000, cycles = true): SlantResult {
  const stats: SlantStats = { nodes: 0, rounds: 0, clueSteps: 0, cycleSteps: 0, branches: 0, maxDepth: 0 }, solutions: SlantValue[][] = [];
  let timedOut = false;
  if (!validSlantPuzzle(p)) return { status: "unsat", solutions, stats };
  const board = initial ? [...initial] : Array(p.width * p.height).fill(0);
  if (board.length !== p.width * p.height || board.some(v => ![-1, 0, 1].includes(v))) return { status: "unsat", solutions, stats };
  const around: { cell: number; value: number }[][] = p.clues.map(() => []);
  for (let i = 0; i < board.length; i++) for (const value of [-1, 1]) for (const a of slantEdges(p, i, value)) around[a].push({ cell: i, value });
  function visit(b: number[], depth: number) {
    if (solutions.length >= 2 || timedOut) return;
    if (++stats.nodes > budget) { timedOut = true; return; }
    stats.maxDepth = Math.max(stats.maxDepth, depth);
    let changed = true;
    while (changed) {
      changed = false; stats.rounds++;
      const f = forest(p, b);
      if (cycles && f.cycle) return;
      for (let a = 0; a < p.clues.length; a++) {
        const clue = p.clues[a]; if (clue < 0) continue;
        let current = 0; const empty = [];
        for (const e of around[a]) { if (!b[e.cell]) empty.push(e); else if (b[e.cell] === e.value) current++; }
        if (current > clue || current + empty.length < clue) return;
        if (empty.length && (current === clue || current + empty.length === clue)) {
          for (const e of empty) { b[e.cell] = current === clue ? -e.value : e.value; stats.clueSteps++; changed = true; }
        }
      }
      // Rebuild on the next round before cycle deductions after clue placements.
      if (changed) continue;
      if (cycles) for (let i = 0; i < b.length; i++) if (!b[i]) {
        const [a, c] = slantEdges(p, i, -1), [d, e] = slantEdges(p, i, 1);
        const bs = f.find(a) === f.find(c), fs = f.find(d) === f.find(e);
        if (bs && fs) return;
        if (bs || fs) { b[i] = bs ? 1 : -1; stats.cycleSteps++; changed = true; break; }
      }
    }
    if (b.every(Boolean)) { if (slantWon(p, b)) solutions.push(b as SlantValue[]); return; }
    let choice = -1, weight = -1;
    for (let i = 0; i < b.length; i++) if (!b[i]) {
      const corners = [...slantEdges(p, i, -1), ...slantEdges(p, i, 1)];
      const score = corners.reduce((s, a) => s + (p.clues[a] >= 0 ? 5 - around[a].filter(e => !b[e.cell]).length : 0), 0);
      if (score > weight) { weight = score; choice = i; }
    }
    stats.branches++;
    for (const v of [-1, 1]) { const next = b.slice(); next[choice] = v; visit(next, depth + 1); }
  }
  visit(board, 0);
  return { status: solutions.length >= 2 ? "multiple" : timedOut ? "timeout" : solutions.length === 1 ? "unique" : "unsat", solutions, stats };
}
export function slantHint(p: SlantPuzzle, board: readonly number[]) {
  const result = solveSlant(p, board, 12000);
  if (result.status === "timeout") return { message: "这一步推理超出预算。先观察数字附近，或撤销试探。", cell: -1, value: 0 };
  if (result.status === "unsat") return { message: "当前斜线与数字或无环规则冲突。请撤销或擦除最近的试探。", cell: -1, value: 0 };
  if (result.status !== "unique") return { message: "暂时没有得到唯一可靠的一步，请继续检查线索。", cell: -1, value: 0 };
  const cell = board.findIndex(v => !v);
  if (cell < 0) return { message: "所有数字都满足，斜线也没有闭环。", cell: -1, value: 0 };
  const value = result.solutions[0][cell];
  return { cell, value, message: `第 ${Math.floor(cell / p.width) + 1} 行第 ${cell % p.width + 1} 列应填 ${value === -1 ? "反斜线 \\" : "斜线 /"}。${result.stats.branches > 0 ? "搜索验证" : "数字与闭环传播"}证明：另一方向无法同时满足所有数字与无环规则。` };
}
export type SlantState = { board: SlantValue[]; history: SlantValue[][]; moves: number };
export const newSlantState = (p: SlantPuzzle): SlantState => ({ board: Array(p.width * p.height).fill(0), history: [], moves: 0 });
export function playSlant(p: SlantPuzzle, state: SlantState, cell: number, value: number, paused = false): SlantState {
  if (paused || slantWon(p, state.board) || !Number.isInteger(cell) || cell < 0 || cell >= state.board.length || ![-1, 0, 1].includes(value) || state.board[cell] === value) return state;
  const board = state.board.slice(); board[cell] = value as SlantValue;
  return { board, history: [...state.history.slice(-249), state.board], moves: state.moves + 1 };
}
export function undoSlant(p: SlantPuzzle, state: SlantState, paused = false): SlantState {
  if (paused || slantWon(p, state.board) || !state.history.length) return state;
  return { board: state.history.at(-1)!, history: state.history.slice(0, -1), moves: Math.max(0, state.moves - 1) };
}
