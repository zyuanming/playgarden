// SPDX-License-Identifier: GPL-3.0-only
/** Original finite weighted spatial-cover puzzle. Distances are Manhattan blocks. */
export type BudgetTownService = "g" | "r" | "w";
export const BUDGET_TOWN_SERVICES: Record<
  BudgetTownService,
  { label: string; short: string }
> = {
  g: { label: "绿地", short: "绿" },
  r: { label: "阅读", short: "书" },
  w: { label: "供水", short: "水" },
};
export type BudgetTownKind =
  "g" | "r" | "w" | "G" | "R" | "W" | "gr" | "gw" | "rw" | "all";
export type BudgetTownFacility = {
  label: string;
  services: readonly BudgetTownService[];
  radius: number;
  cost: number;
};
export const BUDGET_TOWN_FACILITIES: Record<
  BudgetTownKind,
  BudgetTownFacility
> = {
  g: { label: "街角花园", services: ["g"], radius: 2, cost: 3 },
  r: { label: "小书亭", services: ["r"], radius: 2, cost: 3 },
  w: { label: "小水站", services: ["w"], radius: 2, cost: 3 },
  G: { label: "大公园", services: ["g"], radius: 3, cost: 5 },
  R: { label: "流动书屋", services: ["r"], radius: 3, cost: 5 },
  W: { label: "大水塔", services: ["w"], radius: 3, cost: 5 },
  gr: { label: "阅读花园", services: ["g", "r"], radius: 2, cost: 5 },
  gw: { label: "水景花园", services: ["g", "w"], radius: 2, cost: 5 },
  rw: { label: "泉边书屋", services: ["r", "w"], radius: 2, cost: 5 },
  all: { label: "社区共享站", services: ["g", "r", "w"], radius: 2, cost: 7 },
};
export type BudgetTownHome = {
  id: string;
  x: number;
  y: number;
  needs: BudgetTownService[];
};
export type BudgetTownProposal = {
  id: string;
  x: number;
  y: number;
  kind: BudgetTownKind;
};
export type BudgetTownLevel = {
  title: string;
  width: number;
  height: number;
  budget: number;
  homes: BudgetTownHome[];
  proposals: BudgetTownProposal[];
  lesson: string;
  discovery: string;
  /** Offline certificate. Runtime goal recognition and search never read it. */
  certificate: {
    built: string[];
    cost: number;
    minimumCost: number;
    optimalPlans: number;
  };
};
export type BudgetTownState = { built: string[]; history: string[][] };
export type BudgetTownEvaluation = {
  valid: boolean;
  spent: number;
  remaining: number;
  covered: number;
  required: number;
  homes: {
    id: string;
    met: BudgetTownService[];
    missing: BudgetTownService[];
  }[];
  won: boolean;
};
export const BUDGET_TOWN_SEARCH_LIMIT = 32768;
export function validBudgetTownLevel(level: BudgetTownLevel): boolean {
  if (
    !level ||
    !Number.isInteger(level.width) ||
    !Number.isInteger(level.height) ||
    level.width < 2 ||
    level.width > 8 ||
    level.height < 2 ||
    level.height > 8 ||
    !Number.isInteger(level.budget) ||
    level.budget < 1 ||
    !Array.isArray(level.homes) ||
    !Array.isArray(level.proposals) ||
    level.homes.length < 1 ||
    level.homes.length > 10 ||
    level.proposals.length < 1 ||
    level.proposals.length > 15
  )
    return false;
  const occupied = new Set<string>();
  const ids = new Set<string>();
  for (const item of [...level.homes, ...level.proposals]) {
    if (
      !item ||
      typeof item.id !== "string" ||
      !item.id ||
      ids.has(item.id) ||
      !Number.isInteger(item.x) ||
      !Number.isInteger(item.y) ||
      item.x < 0 ||
      item.x >= level.width ||
      item.y < 0 ||
      item.y >= level.height ||
      occupied.has(`${item.x},${item.y}`)
    )
      return false;
    ids.add(item.id);
    occupied.add(`${item.x},${item.y}`);
  }
  return (
    level.homes.every(
      (home) =>
        Array.isArray(home.needs) &&
        home.needs.length > 0 &&
        home.needs.length <= 3 &&
        new Set(home.needs).size === home.needs.length &&
        home.needs.every((service) =>
          Object.hasOwn(BUDGET_TOWN_SERVICES, service),
        ),
    ) &&
    level.proposals.every((proposal) =>
      Object.hasOwn(BUDGET_TOWN_FACILITIES, proposal.kind),
    )
  );
}
export function validBudgetTownPlan(
  level: BudgetTownLevel,
  built: readonly string[],
): boolean {
  return (
    validBudgetTownLevel(level) &&
    Array.isArray(built) &&
    new Set(built).size === built.length &&
    built.every((id) => level.proposals.some((proposal) => proposal.id === id))
  );
}
export function budgetTownDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
export function budgetTownCovers(
  proposal: BudgetTownProposal,
  home: BudgetTownHome,
  service: BudgetTownService,
): boolean {
  const facility = BUDGET_TOWN_FACILITIES[proposal.kind];
  return (
    facility.services.includes(service) &&
    budgetTownDistance(proposal, home) <= facility.radius
  );
}
export function evaluateBudgetTown(
  level: BudgetTownLevel,
  built: readonly string[],
): BudgetTownEvaluation {
  if (!validBudgetTownPlan(level, built))
    return {
      valid: false,
      spent: 0,
      remaining: 0,
      covered: 0,
      required: 0,
      homes: [],
      won: false,
    };
  const proposals = level.proposals.filter((proposal) =>
    built.includes(proposal.id),
  );
  const spent = proposals.reduce(
    (total, proposal) => total + BUDGET_TOWN_FACILITIES[proposal.kind].cost,
    0,
  );
  const homes = level.homes.map((home) => ({
    id: home.id,
    met: home.needs.filter((service) =>
      proposals.some((proposal) => budgetTownCovers(proposal, home, service)),
    ),
    missing: home.needs.filter(
      (service) =>
        !proposals.some((proposal) =>
          budgetTownCovers(proposal, home, service),
        ),
    ),
  }));
  const covered = homes.reduce((total, home) => total + home.met.length, 0);
  const required = level.homes.reduce(
    (total, home) => total + home.needs.length,
    0,
  );
  return {
    valid: true,
    spent,
    remaining: level.budget - spent,
    covered,
    required,
    homes,
    won: spent <= level.budget && covered === required,
  };
}
export const budgetTownWon = (
  level: BudgetTownLevel,
  built: readonly string[],
) => evaluateBudgetTown(level, built).won;
export const createBudgetTownState = (): BudgetTownState => ({
  built: [],
  history: [],
});
export function toggleBudgetTown(
  level: BudgetTownLevel,
  state: BudgetTownState,
  id: string,
): BudgetTownState {
  if (
    !validBudgetTownPlan(level, state.built) ||
    budgetTownWon(level, state.built) ||
    !level.proposals.some((proposal) => proposal.id === id)
  )
    return state;
  const built = state.built.includes(id)
    ? state.built.filter((item) => item !== id)
    : [...state.built, id];
  return { built, history: [...state.history, [...state.built]] };
}
export function undoBudgetTown(state: BudgetTownState): BudgetTownState {
  const last = state.history.at(-1);
  return last
    ? { built: [...last], history: state.history.slice(0, -1) }
    : state;
}
export type BudgetTownSearch = {
  status: "found" | "solved" | "invalid" | "unsolvable" | "limit";
  visited: number;
  target: string[] | null;
  edits: number;
  next: { id: string; build: boolean } | null;
};
/** Enumerate the bounded set of candidate subsets. Optimize edits from the CURRENT
 * plan, then total cost. Remove unwanted proposals before recommending additions.
 * No certificate, fixed route or initially empty-board answer is consulted. */
export function searchBudgetTown(
  level: BudgetTownLevel,
  built: readonly string[],
  maxStates = BUDGET_TOWN_SEARCH_LIMIT,
): BudgetTownSearch {
  const result = (
    status: BudgetTownSearch["status"],
    visited = 0,
  ): BudgetTownSearch => ({
    status,
    visited,
    target: null,
    edits: 0,
    next: null,
  });
  if (!validBudgetTownPlan(level, built)) return result("invalid");
  if (budgetTownWon(level, built))
    return { ...result("solved", 1), target: [...built] };
  const limit = Number.isFinite(maxStates)
    ? Math.max(1, Math.min(BUDGET_TOWN_SEARCH_LIMIT, Math.floor(maxStates)))
    : BUDGET_TOWN_SEARCH_LIMIT;
  const requirements = level.homes.flatMap((home) =>
    home.needs.map((service) => ({ home, service })),
  );
  const full = (1 << requirements.length) - 1;
  const masks = level.proposals.map((proposal) =>
    requirements.reduce(
      (mask, { home, service }, index) =>
        budgetTownCovers(proposal, home, service) ? mask | (1 << index) : mask,
      0,
    ),
  );
  const costs = level.proposals.map(
    (proposal) => BUDGET_TOWN_FACILITIES[proposal.kind].cost,
  );
  const current = level.proposals.reduce(
    (mask, proposal, index) =>
      built.includes(proposal.id) ? mask | (1 << index) : mask,
    0,
  );
  const count = 1 << level.proposals.length;
  const coverage = new Int32Array(count),
    cost = new Uint16Array(count);
  let best = -1,
    bestEdits = Infinity,
    bestCost = Infinity;
  for (let mask = 1; mask < count; mask++) {
    if (mask >= limit) return result("limit", limit);
    const bit = mask & -mask,
      index = 31 - Math.clz32(bit),
      rest = mask ^ bit;
    coverage[mask] = coverage[rest] | masks[index];
    cost[mask] = cost[rest] + costs[index];
    if (coverage[mask] !== full || cost[mask] > level.budget) continue;
    // XOR can exceed the current enumeration index; popcount is independent.
    let difference = mask ^ current,
      edits = 0;
    while (difference) {
      difference &= difference - 1;
      edits++;
    }
    if (edits < bestEdits || (edits === bestEdits && cost[mask] < bestCost)) {
      best = mask;
      bestEdits = edits;
      bestCost = cost[mask];
    }
  }
  if (best < 0) return result("unsolvable", count);
  const target = level.proposals
    .filter((_, index) => Boolean(best & (1 << index)))
    .map((proposal) => proposal.id);
  const removal = level.proposals.find(
    (proposal) => built.includes(proposal.id) && !target.includes(proposal.id),
  );
  const addition = level.proposals.find(
    (proposal) => target.includes(proposal.id) && !built.includes(proposal.id),
  );
  return {
    status: "found",
    visited: count,
    target,
    edits: bestEdits,
    next: removal
      ? { id: removal.id, build: false }
      : addition
        ? { id: addition.id, build: true }
        : null,
  };
}
export function budgetTownHint(
  level: BudgetTownLevel,
  built: readonly string[],
  maxStates = BUDGET_TOWN_SEARCH_LIMIT,
): BudgetTownSearch & { text: string } {
  const search = searchBudgetTown(level, built, maxStates);
  if (search.next) {
    const proposal = level.proposals.find(
      (item) => item.id === search.next!.id,
    )!;
    const facility = BUDGET_TOWN_FACILITIES[proposal.kind];
    return {
      ...search,
      text: `可以先${search.next.build ? "建造" : "撤下"} ${proposal.id} 地块的${facility.label}（${facility.cost} 币）。从当前方案出发，至少还需调整 ${search.edits} 处；${search.next.build ? "留意它能补上的服务。" : "撤下会全额退回游戏币，给另一种组合留空间。"}`,
    };
  }
  const text =
    search.status === "solved"
      ? "所有住区服务已满足，而且没有超出预算。"
      : search.status === "limit"
        ? "这次搜索达到计算上限，尚不能判断。可以撤销一次，或比较遗漏的服务。"
        : search.status === "unsolvable"
          ? "这些候选设施在预算内没有完整覆盖方案。"
          : "当前方案数据不完整，请重置本关。";
  return { ...search, text };
}
