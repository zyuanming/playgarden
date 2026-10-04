/** Original MIT puzzle infrastructure. All searches use public constraints, never certificates. */
export type NetworkSearch = {
  solutions: number[][];
  nodes: number;
  status: "complete" | "limit" | "budget" | "invalid";
};
export type NetworkState = { values: number[]; history: number[][] };
export type NetworkHint =
  | {
      kind: "deduction" | "repair";
      index: number;
      value: number;
      reason: string;
    }
  | { kind: "unavailable"; reason: string };
export const NETWORK_NODE_LIMIT = 50000;
export type SumRule = { edges: number[]; totals: number[] };
export function createNetworkState(count: number): NetworkState {
  return { values: Array.from({ length: count }, () => -1), history: [] };
}
export function editNetworkEdge(
  state: NetworkState,
  index: number,
  value: number,
  maximum: number,
  paused = false,
): NetworkState {
  if (
    paused ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= state.values.length ||
    !Number.isInteger(value) ||
    value < -1 ||
    value > maximum ||
    state.values[index] === value
  )
    return state;
  return {
    values: state.values.map((v, i) => (i === index ? value : v)),
    history: [...state.history, state.values.slice()],
  };
}
export function cycleNetworkEdge(
  state: NetworkState,
  index: number,
  maximum: number,
  paused = false,
): NetworkState {
  const current = state.values[index];
  return editNetworkEdge(
    state,
    index,
    current === -1
      ? 1
      : current === maximum
        ? 0
        : current === 0
          ? -1
          : current + 1,
    maximum,
    paused,
  );
}
export function undoNetworkEdge(
  state: NetworkState,
  paused = false,
): NetworkState {
  return paused || !state.history.length
    ? state
    : {
        values: state.history.at(-1)!.slice(),
        history: state.history.slice(0, -1),
      };
}
export function validNetworkValues(
  values: readonly number[],
  count: number,
  maximum: number,
): boolean {
  return (
    Array.isArray(values) &&
    values.length === count &&
    values.every((v) => Number.isInteger(v) && v >= -1 && v <= maximum)
  );
}
const options = (mask: number) =>
  [0, 1, 2].filter((value) => mask & (1 << value));
/** Bounded finite-domain solver with exact support propagation for local sum rules. */
export function searchNetwork(args: {
  values: readonly number[];
  maximum: 1 | 2;
  rules: SumRule[];
  incompatible?: [number, number][];
  accept: (values: number[]) => boolean;
  possible?: (domains: number[]) => boolean;
  maxSolutions?: number;
  nodeLimit?: number;
}): NetworkSearch {
  const { values, maximum, rules, accept, possible } = args;
  const maxSolutions = args.maxSolutions ?? 2,
    nodeLimit = args.nodeLimit ?? NETWORK_NODE_LIMIT;
  const result: NetworkSearch = { solutions: [], nodes: 0, status: "complete" };
  if (
    !validNetworkValues(values, values.length, maximum) ||
    !Number.isInteger(maxSolutions) ||
    maxSolutions < 1 ||
    !Number.isInteger(nodeLimit) ||
    nodeLimit < 0 ||
    rules.some((rule) =>
      rule.edges.some(
        (e) => !Number.isInteger(e) || e < 0 || e >= values.length,
      ),
    )
  )
    return { ...result, status: "invalid" };
  const cap = Math.min(NETWORK_NODE_LIMIT, nodeLimit);
  const weights = values.map(
    (_, edge) => rules.filter((rule) => rule.edges.includes(edge)).length,
  );
  function propagate(domains: number[]): boolean {
    let changed = true;
    while (changed) {
      changed = false;
      for (const rule of rules) {
        const support = rule.edges.map(() => 0);
        const picked: number[] = [];
        function combine(position: number, total: number) {
          if (position === rule.edges.length) {
            if (rule.totals.includes(total))
              picked.forEach((v, i) => (support[i] |= 1 << v));
            return;
          }
          for (const value of options(domains[rule.edges[position]])) {
            if (!rule.totals.some((target) => target >= total + value))
              continue;
            picked[position] = value;
            combine(position + 1, total + value);
          }
        }
        combine(0, 0);
        if (support.some((mask) => !mask)) return false;
        rule.edges.forEach((edge, i) => {
          if (domains[edge] !== support[i]) {
            domains[edge] = support[i];
            changed = true;
          }
        });
      }
      for (const [a, b] of args.incompatible ?? []) {
        if (!(domains[a] & 1)) {
          if (!(domains[b] & 1)) return false;
          if (domains[b] !== 1) {
            domains[b] = 1;
            changed = true;
          }
        }
        if (!(domains[b] & 1)) {
          if (!(domains[a] & 1)) return false;
          if (domains[a] !== 1) {
            domains[a] = 1;
            changed = true;
          }
        }
      }
    }
    return !possible || possible(domains);
  }
  function visit(domains: number[]) {
    if (result.status !== "complete") return;
    if (result.nodes >= cap) {
      result.status = "budget";
      return;
    }
    result.nodes++;
    if (!propagate(domains)) return;
    let edge = -1;
    for (let i = 0; i < domains.length; i++) {
      if (options(domains[i]).length < 2) continue;
      if (
        edge < 0 ||
        options(domains[i]).length < options(domains[edge]).length ||
        (options(domains[i]).length === options(domains[edge]).length &&
          weights[i] > weights[edge])
      )
        edge = i;
    }
    if (edge < 0) {
      const solution = domains.map((mask) => options(mask)[0]);
      if (accept(solution)) {
        result.solutions.push(solution);
        if (result.solutions.length >= maxSolutions) result.status = "limit";
      }
      return;
    }
    for (const value of options(domains[edge])) {
      const next = domains.slice();
      next[edge] = 1 << value;
      visit(next);
      if (result.status !== "complete") break;
    }
  }
  visit(values.map((v) => (v < 0 ? (1 << (maximum + 1)) - 1 : 1 << v)));
  return result;
}
/** A hint is justified only by a fully searched current position; exhausted budgets never imply impossibility. */
export function networkHint(
  values: readonly number[],
  search: (values: readonly number[], nodeLimit: number) => NetworkSearch,
  solved: boolean,
  nodeLimit = 12000,
): NetworkHint | null {
  if (solved) return null;
  let remaining = Math.min(
    NETWORK_NODE_LIMIT,
    Math.max(0, Number.isFinite(nodeLimit) ? Math.floor(nodeLimit) : 0),
  );
  const current = search(values, remaining);
  remaining -= current.nodes;
  if (current.status === "invalid")
    return { kind: "unavailable", reason: "棋盘数据无效，请重置后再试。" };
  if (current.status === "budget" || current.status === "limit")
    return {
      kind: "unavailable",
      reason: "本次有限搜索还不能确认下一步；请结合数字、连通性继续推理。",
    };
  if (current.solutions.length) {
    // Favor a useful bridge/line before exclusion marks. Never inspect a level certificate.
    for (const positive of [true, false]) {
      const index = values.findIndex(
        (v, i) =>
          v < 0 &&
          current.solutions[0][i] > 0 === positive &&
          current.solutions.every(
            (solution) => solution[i] === current.solutions[0][i],
          ),
      );
      if (index >= 0)
        return {
          kind: "deduction",
          index,
          value: current.solutions[0][index],
          reason: "检查当前标记后的所有可行解，这条边的状态相同。",
        };
    }
    return {
      kind: "unavailable",
      reason: "当前有多种可行延伸，尚无能确定的单条边。",
    };
  }
  for (let index = 0; index < values.length && remaining > 0; index++) {
    if (values[index] < 0) continue;
    const trial = values.slice();
    trial[index] = -1;
    const repaired = search(trial, remaining);
    remaining -= repaired.nodes;
    if (repaired.solutions.length)
      return {
        kind: "repair",
        index,
        value: -1,
        reason: "当前标记无法完成；清除此处可恢复至少一种可行解。",
      };
  }
  return {
    kind: "unavailable",
    reason: "当前标记存在矛盾；本次搜索未确认单步修复，请撤销或检查最近几步。",
  };
}
