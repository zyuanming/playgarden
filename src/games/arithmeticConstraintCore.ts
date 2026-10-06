/** Original GPL-3.0-only finite-domain arithmetic infrastructure. No stored answers enter search. */
export type ArithmeticTable = {
  cells: number[];
  tuples: number[][];
  /** Public clue/rule description, used only to explain a local deduction. */
  source?: string;
};
export type ArithmeticProblem = {
  length: number;
  digits: number;
  active: number[];
  tables: ArithmeticTable[];
};
export type ArithmeticSearch = {
  solutions: number[][];
  nodes: number;
  checks: number;
  status: "complete" | "limit" | "budget" | "invalid";
};
export type ArithmeticHint =
  | {
      kind: "deduction" | "repair";
      index: number;
      value: number;
      reason: string;
    }
  | { kind: "unavailable"; reason: string };
export const ARITHMETIC_NODE_LIMIT = 30000;
export const ARITHMETIC_CHECK_LIMIT = 2000000;
export const ARITHMETIC_HISTORY_LIMIT = 250;
export function searchArithmetic(
  problem: ArithmeticProblem,
  values: readonly number[],
  limit = 2,
  nodeLimit = ARITHMETIC_NODE_LIMIT,
  checkLimit = ARITHMETIC_CHECK_LIMIT,
): ArithmeticSearch {
  const result: ArithmeticSearch = {
    solutions: [],
    nodes: 0,
    checks: 0,
    status: "complete",
  };
  if (
    !problem ||
    !Number.isInteger(problem.length) ||
    problem.length < 1 ||
    problem.length > 49 ||
    !Number.isInteger(problem.digits) ||
    problem.digits < 2 ||
    problem.digits > 9 ||
    !Array.isArray(values) ||
    values.length !== problem.length ||
    !Array.isArray(problem.active) ||
    new Set(problem.active).size !== problem.active.length ||
    !problem.active.length ||
    problem.active.some(
      (i) => !Number.isInteger(i) || i < 0 || i >= problem.length,
    ) ||
    values.some(
      (v, i) =>
        !Number.isInteger(v) ||
        v < 0 ||
        v > problem.digits ||
        (!problem.active.includes(i) && v !== 0),
    ) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 1000 ||
    !Number.isInteger(nodeLimit) ||
    nodeLimit < 1 ||
    nodeLimit > ARITHMETIC_NODE_LIMIT ||
    !Number.isInteger(checkLimit) ||
    checkLimit < 1 ||
    checkLimit > ARITHMETIC_CHECK_LIMIT ||
    !Array.isArray(problem.tables) ||
    problem.tables.length > 80 ||
    problem.tables.some(
      (t) =>
        !t ||
        !Array.isArray(t.cells) ||
        !t.cells.length ||
        t.cells.length > 5 ||
        new Set(t.cells).size !== t.cells.length ||
        t.cells.some((i) => !problem.active.includes(i)) ||
        !Array.isArray(t.tuples) ||
        t.tuples.length > 16000 ||
        t.tuples.some(
          (p) =>
            !Array.isArray(p) ||
            p.length !== t.cells.length ||
            p.some((v) => !Number.isInteger(v) || v < 1 || v > problem.digits),
        ),
    ) ||
    problem.active.some((i) => !problem.tables.some((t) => t.cells.includes(i)))
  )
    return { ...result, status: "invalid" };
  const stopped = () =>
    result.status === "budget" || result.solutions.length >= limit;
  const initial = Array.from({ length: problem.length }, (_, i) =>
    values[i]
      ? [values[i]]
      : problem.active.includes(i)
        ? Array.from({ length: problem.digits }, (_, j) => j + 1)
        : [0],
  );
  function visit(domains: number[][], options: number[][][]): void {
    if (stopped()) return;
    if (result.nodes >= nodeLimit) {
      result.status = "budget";
      return;
    }
    result.nodes++;
    let changed = true;
    while (changed) {
      changed = false;
      for (let t = 0; t < problem.tables.length; t++) {
        const cells = problem.tables[t].cells,
          kept: number[][] = [];
        for (const tuple of options[t]) {
          if (++result.checks > checkLimit) {
            result.status = "budget";
            return;
          }
          if (tuple.every((v, j) => domains[cells[j]].includes(v)))
            kept.push(tuple);
        }
        if (!kept.length) return;
        options[t] = kept;
        for (let j = 0; j < cells.length; j++) {
          const support = new Set(kept.map((tuple) => tuple[j]));
          const next = domains[cells[j]].filter((v) => support.has(v));
          if (!next.length) return;
          if (next.length !== domains[cells[j]].length) {
            changed = true;
            domains[cells[j]] = next;
          }
        }
      }
    }
    let selected = -1;
    for (const i of problem.active)
      if (
        domains[i].length > 1 &&
        (selected < 0 || domains[i].length < domains[selected].length)
      )
        selected = i;
    if (selected < 0) {
      result.solutions.push(domains.map((d) => d[0]));
      return;
    }
    for (const value of domains[selected]) {
      if (stopped()) break;
      const next = domains.map((d) => d.slice());
      next[selected] = [value];
      visit(next, options.slice());
    }
  }
  visit(
    initial,
    problem.tables.map((t) => t.tuples),
  );
  if (result.status !== "budget" && result.solutions.length >= limit)
    result.status = "limit";
  return result;
}
/** Project each visible rule independently: no hidden propagation or solution values.
 * Only called after the current board has been proved feasible. */
function localArithmeticHint(
  problem: ArithmeticProblem,
  values: readonly number[],
  checkLimit: number,
): ArithmeticHint | null {
  type Support = { mask: number; count: number; cells: number; source: string };
  type Proof = { supports: Support[]; candidates: number; cells: number };
  const supports = new Map<number, Support[]>(),
    full = (1 << problem.digits) - 1;
  let checks = 0;
  for (const [t, table] of problem.tables.entries()) {
    const masks = table.cells.map(() => 0);
    for (const tuple of table.tuples) {
      // Share the hint's tuple-check allowance with its feasibility search.
      if (++checks > checkLimit) return null;
      if (
        !tuple.every(
          (v, j) => !values[table.cells[j]] || values[table.cells[j]] === v,
        )
      )
        continue;
      tuple.forEach((v, j) => (masks[j] |= 1 << (v - 1)));
    }
    table.cells.forEach((index, j) => {
      if (values[index] || !masks[j] || masks[j] === full) return;
      const list = supports.get(index) ?? [];
      list.push({
        mask: masks[j],
        count: digits(masks[j]).length,
        cells: table.cells.length,
        source: table.source ?? `第 ${t + 1} 条线索`,
      });
      supports.set(index, list);
    });
  }
  function digits(mask: number) {
    return Array.from({ length: problem.digits }, (_, i) => i + 1).filter(
      (v) => mask & (1 << (v - 1)),
    );
  }
  function simpler(a: Proof, b: Proof) {
    return (
      a.supports.length - b.supports.length ||
      a.candidates - b.candidates ||
      a.cells - b.cells
    );
  }
  let best: { index: number; value: number; proof: Proof } | undefined;
  for (const index of problem.active) {
    // At most 2^9 candidate masks; retain the simplest explanation per mask.
    const proofs = new Map<number, Proof>([
      [full, { supports: [], candidates: 0, cells: 0 }],
    ]);
    for (const support of supports.get(index) ?? [])
      for (const [mask, proof] of [...proofs]) {
        const next = mask & support.mask;
        if (!next || next === mask) continue;
        const candidate: Proof = {
          supports: [...proof.supports, support],
          candidates: proof.candidates + support.count,
          cells: proof.cells + support.cells,
        };
        const previous = proofs.get(next);
        if (!previous || simpler(candidate, previous) < 0)
          proofs.set(next, candidate);
      }
    for (const [mask, proof] of proofs)
      if (
        (mask & (mask - 1)) === 0 &&
        (!best || simpler(proof, best.proof) < 0)
      )
        best = { index, value: digits(mask)[0], proof };
  }
  if (!best) return null;
  return {
    kind: "deduction",
    index: best.index,
    value: best.value,
    reason: `按当前填写，${best.proof.supports
      .map((s) => `${s.source}允许这一格填 {${digits(s.mask).join("、")}}`)
      .join(
        "；",
      )}。${best.proof.supports.length === 1 ? "只剩这一个候选" : "共同候选只有 " + best.value}，因此这里必须填`,
  };
}
export function arithmeticHint(
  problem: ArithmeticProblem | null,
  values: readonly number[],
  reason: string,
  nodeLimit = 12000,
): ArithmeticHint {
  if (!problem)
    return { kind: "unavailable", reason: "题目结构无效，无法可靠推断。" };
  const current = searchArithmetic(problem, values, 2, nodeLimit, 700000);
  if (current.status === "invalid" || current.status === "budget")
    return {
      kind: "unavailable",
      reason: "本次检查达到安全边界，暂时不能确认提示；不会把猜测当成答案。",
    };
  if (current.solutions.length) {
    const local = localArithmeticHint(problem, values, 700000 - current.checks);
    if (local) return local;
  }
  if (current.solutions.length === 1 && current.status === "complete") {
    const index = problem.active.find((i) => !values[i]);
    return index === undefined
      ? { kind: "unavailable", reason: "所有线索已经满足。" }
      : {
          kind: "deduction",
          index,
          value: current.solutions[0][index],
          reason: `${reason}结合当前全部填写，完整枚举只剩这一种解，因此这里必须填`,
        };
  }
  if (current.solutions.length)
    return {
      kind: "unavailable",
      reason: "当前还有多种满足线索的可能，暂不提供未经证明的单格答案。",
    };
  // Unsatisfiability was proved first; a fresh clue-only proof identifies one definitely wrong entry.
  const blank = searchArithmetic(
    problem,
    Array(problem.length).fill(0),
    2,
    nodeLimit,
    700000,
  );
  if (blank.status === "complete" && blank.solutions.length === 1) {
    const index = problem.active.find(
      (i) => values[i] && values[i] !== blank.solutions[0][i],
    );
    if (index !== undefined)
      return {
        kind: "repair",
        index,
        value: 0,
        reason:
          "当前填写无法共同满足线索。仅按公开线索完整枚举后，确认这一格不可能是现在的数字。请先清空它；其他格可能仍需检查。",
      };
  }
  return {
    kind: "unavailable",
    reason:
      "当前填写存在矛盾，但本次未能证明该改哪一格。请检查带 ! 的线索或撤销。",
  };
}
export type ArithmeticState = { values: number[]; history: number[][] };
export function createArithmeticState(length: number): ArithmeticState {
  return { values: Array(length).fill(0), history: [] };
}
export function inputArithmetic(
  state: ArithmeticState,
  index: number,
  value: number,
  active: readonly number[],
  digits: number,
  locked = false,
): ArithmeticState {
  if (
    locked ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > digits ||
    !active.includes(index) ||
    state.values[index] === value
  )
    return state;
  return {
    values: state.values.map((v, i) => (i === index ? value : v)),
    history: [...state.history, state.values.slice()].slice(
      -ARITHMETIC_HISTORY_LIMIT,
    ),
  };
}
export function undoArithmetic(
  state: ArithmeticState,
  locked = false,
): ArithmeticState {
  return locked || !state.history.length
    ? state
    : {
        values: state.history.at(-1)!.slice(),
        history: state.history.slice(0, -1),
      };
}
export function arithmeticPermutations(size: number): number[][] {
  const result: number[][] = [];
  function visit(prefix: number[]) {
    if (prefix.length === size) {
      result.push(prefix);
      return;
    }
    for (let v = 1; v <= size; v++)
      if (!prefix.includes(v)) visit([...prefix, v]);
  }
  visit([]);
  return result;
}
