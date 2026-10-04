// SPDX-License-Identifier: MIT
/** Original letter-addition rules. Certificates are never inputs to play or search. */
export type CarryMapping = Record<string, number | null>;
export type CarryProblem = {
  addends: string[];
  result: string;
  givens: Record<string, number>;
};
export type CarryLevel = CarryProblem & {
  id: string;
  title: string;
  lesson: string;
  certificate: { mapping: Record<string, number>; carries: number[] };
};
export type CarryState = { values: CarryMapping; history: CarryMapping[] };
export const CARRY_NODE_LIMIT = 800_000;
export function carrySymbols(p: CarryProblem): string[] {
  return [...new Set(p.addends.join("") + p.result)].sort();
}
export function publicCarry(p: CarryProblem): CarryProblem {
  return { addends: [...p.addends], result: p.result, givens: { ...p.givens } };
}
export function validCarryProblem(p: CarryProblem): boolean {
  const words = [...p.addends, p.result],
    symbols = carrySymbols(p);
  return (
    p.addends.length >= 2 &&
    p.addends.length <= 3 &&
    symbols.length >= 2 &&
    symbols.length <= 7 &&
    words.every((w) => /^[A-Z]{1,5}$/.test(w)) &&
    Object.entries(p.givens).every(
      ([s, n]) =>
        symbols.includes(s) && Number.isInteger(n) && n >= 0 && n <= 9,
    ) &&
    new Set(Object.values(p.givens)).size === Object.keys(p.givens).length &&
    words.every((w) => w.length === 1 || p.givens[w[0]] !== 0)
  );
}
export function carryAssignmentValid(
  p: CarryProblem,
  values: CarryMapping,
): boolean {
  if (!validCarryProblem(p)) return false;
  const symbols = carrySymbols(p),
    assigned = symbols.map((s) => values[s]).filter((n) => n != null);
  return (
    Object.keys(values).every((s) => symbols.includes(s)) &&
    assigned.every((n) => Number.isInteger(n) && n! >= 0 && n! <= 9) &&
    new Set(assigned).size === assigned.length &&
    Object.entries(p.givens).every(([s, n]) => values[s] === n) &&
    [...p.addends, p.result].every((w) => w.length === 1 || values[w[0]] !== 0)
  );
}
export function carryNumber(word: string, values: CarryMapping): number | null {
  if ([...word].some((s) => values[s] == null)) return null;
  return [...word].reduce((n, s) => n * 10 + values[s]!, 0);
}
export function carryWon(p: CarryProblem, values: CarryMapping): boolean {
  if (
    !carryAssignmentValid(p, values) ||
    carrySymbols(p).some((s) => values[s] == null)
  )
    return false;
  return (
    p.addends.reduce((n, w) => n + carryNumber(w, values)!, 0) ===
    carryNumber(p.result, values)
  );
}
export function createCarryState(p: CarryProblem): CarryState {
  return {
    values: Object.fromEntries(
      carrySymbols(p).map((s) => [s, p.givens[s] ?? null]),
    ),
    history: [],
  };
}
export function editCarry(
  p: CarryProblem,
  state: CarryState,
  symbol: string,
  digit: number | null,
): CarryState {
  if (
    carryWon(p, state.values) ||
    !carrySymbols(p).includes(symbol) ||
    symbol in p.givens ||
    (digit !== null && (!Number.isInteger(digit) || digit < 0 || digit > 9)) ||
    state.values[symbol] === digit
  )
    return state;
  return {
    values: { ...state.values, [symbol]: digit },
    history: [...state.history, { ...state.values }],
  };
}
export function undoCarry(p: CarryProblem, state: CarryState): CarryState {
  if (carryWon(p, state.values) || !state.history.length) return state;
  return {
    values: { ...state.history.at(-1)! },
    history: state.history.slice(0, -1),
  };
}
export type CarryColumn = {
  column: number;
  incoming: number | null;
  total: number | null;
  digit: number | null;
  outgoing: number | null;
  matches: boolean | null;
};
export function carryColumns(
  p: CarryProblem,
  values: CarryMapping,
): CarryColumn[] {
  let incoming: number | null = 0;
  return Array.from(
    { length: Math.max(...p.addends.map((w) => w.length), p.result.length) },
    (_, column) => {
      const parts = p.addends
        .map((w) => w.at(-1 - column))
        .filter((s): s is string => s !== undefined);
      const total: number | null =
        incoming === null || parts.some((s) => values[s] == null)
          ? null
          : parts.reduce((n, s) => n + values[s]!, incoming);
      const resultSymbol = p.result.at(-1 - column),
        digit = resultSymbol ? (values[resultSymbol] ?? null) : 0;
      const outgoing: number | null =
        total === null ? null : Math.floor(total / 10);
      const row = {
        column,
        incoming,
        total,
        digit,
        outgoing,
        matches: total === null || digit === null ? null : total % 10 === digit,
      };
      incoming = outgoing;
      return row;
    },
  );
}
export type CarrySearchResult = {
  complete: boolean;
  nodes: number;
  count: number;
  first: Record<string, number> | null;
  candidates: Record<string, number[]>;
};
/** Column-wise CSP, yielding at every partial node. A cap means unknown, never impossible. */
export function createCarrySearch(
  problem: CarryProblem,
  values: CarryMapping,
  requestedLimit = CARRY_NODE_LIMIT,
) {
  const p = publicCarry(problem),
    symbols = carrySymbols(p),
    current = { ...values };
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(0, Math.min(CARRY_NODE_LIMIT, Math.floor(requestedLimit)))
    : 0;
  const possible = Object.fromEntries(
    symbols.map((s) => [s, new Set<number>()]),
  );
  const leading = new Set(
    [...p.addends, p.result].filter((w) => w.length > 1).map((w) => w[0]),
  );
  const used = new Set(
    Object.values(current).filter((n): n is number => n != null),
  );
  const width = Math.max(...p.addends.map((w) => w.length), p.result.length);
  let nodes = 0,
    count = 0,
    capped = false,
    done = false,
    first: Record<string, number> | null = null;
  function* visit(): Generator<void> {
    if (nodes >= limit) {
      capped = true;
      return;
    }
    nodes++;
    yield;
  }
  function* column(index: number, incoming: number): Generator<void> {
    yield* visit();
    if (capped) return;
    if (index === width) {
      if (incoming !== 0) return;
      count++;
      const solution = Object.fromEntries(symbols.map((s) => [s, current[s]!]));
      if (!first) first = solution;
      symbols.forEach((s) => possible[s].add(solution[s]));
      return;
    }
    const parts = p.addends
      .map((w) => w.at(-1 - index))
      .filter((s): s is string => s !== undefined);
    const unknown = [...new Set(parts)].filter((s) => current[s] == null);
    function* assign(at: number): Generator<void> {
      if (capped) return;
      if (at < unknown.length) {
        const s = unknown[at];
        for (let d = 0; d <= 9 && !capped; d++) {
          if (used.has(d) || (d === 0 && leading.has(s))) continue;
          yield* visit();
          if (capped) return;
          current[s] = d;
          used.add(d);
          yield* assign(at + 1);
          used.delete(d);
          current[s] = null;
        }
        return;
      }
      const sum = parts.reduce((n, s) => n + current[s]!, incoming),
        digit = sum % 10;
      const resultSymbol = p.result.at(-1 - index);
      if (!resultSymbol) {
        if (digit === 0) yield* column(index + 1, Math.floor(sum / 10));
        return;
      }
      if (current[resultSymbol] != null) {
        if (current[resultSymbol] === digit)
          yield* column(index + 1, Math.floor(sum / 10));
      } else if (
        !used.has(digit) &&
        !(digit === 0 && leading.has(resultSymbol))
      ) {
        yield* visit();
        if (capped) return;
        current[resultSymbol] = digit;
        used.add(digit);
        yield* column(index + 1, Math.floor(sum / 10));
        used.delete(digit);
        current[resultSymbol] = null;
      }
    }
    yield* assign(0);
  }
  function* run(): Generator<void> {
    if (carryAssignmentValid(p, current)) yield* column(0, 0);
  }
  const iterator = run();
  function result(): CarrySearchResult {
    return {
      complete: !capped,
      nodes,
      count,
      first: first ? { ...first } : null,
      candidates: Object.fromEntries(
        symbols.map((s) => [s, [...possible[s]].sort((a, b) => a - b)]),
      ),
    };
  }
  return {
    get done() {
      return done;
    },
    get nodes() {
      return nodes;
    },
    step(budget = 1024): CarrySearchResult | null {
      if (!Number.isInteger(budget) || budget < 1)
        throw new Error("Positive integer chunk required");
      for (let i = 0; i < budget && !done; i++)
        done = Boolean(iterator.next().done);
      return done ? result() : null;
    },
  };
}
export type CarryHint = {
  kind: "forced" | "choice" | "contradiction" | "unknown" | "complete";
  symbol?: string;
  digit?: number;
  text: string;
  nodes: number;
};
export function carryHintFromSearch(
  p: CarryProblem,
  values: CarryMapping,
  result: CarrySearchResult,
): CarryHint {
  const nodes = result.nodes;
  if (!result.complete)
    return {
      kind: "unknown",
      nodes,
      text: "达到搜索预算，尚不能确认候选。请先检查已填数字、各列进位，或再填一格后重试。",
    };
  if (!result.count)
    return {
      kind: "contradiction",
      nodes,
      text: "当前填写无法满足公开算式。检查重复数字、首位 0 和各列进位，或撤销最近的填写。",
    };
  const empty = carrySymbols(p).filter((s) => values[s] == null),
    forced = empty.find((s) => result.candidates[s].length === 1);
  if (forced)
    return {
      kind: "forced",
      nodes,
      symbol: forced,
      digit: result.candidates[forced][0],
      text: `结合当前填写与全部列约束，${forced} 只能是 ${result.candidates[forced][0]}。先核对相关列，再自行填入。`,
    };
  if (!empty.length)
    return { kind: "complete", nodes, text: "全部数字已满足公开算式。" };
  const symbol = [...empty].sort(
    (a, b) => result.candidates[a].length - result.candidates[b].length,
  )[0];
  return {
    kind: "choice",
    symbol,
    nodes,
    text: `${symbol} 仍可取 ${result.candidates[symbol].join("、")}；还没有可确认的单一数字。试着结合最低未完成列与数字不重复规则。`,
  };
}
export async function findCarryHint(
  p: CarryProblem,
  values: CarryMapping,
  options: { signal?: AbortSignal; chunk?: number; limit?: number } = {},
): Promise<CarryHint | null> {
  const search = createCarrySearch(p, values, options.limit);
  while (!options.signal?.aborted) {
    const result = search.step(options.chunk ?? 1024);
    if (result)
      return options.signal?.aborted
        ? null
        : carryHintFromSearch(p, values, result);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return null;
}
