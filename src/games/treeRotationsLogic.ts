// SPDX-License-Identifier: GPL-3.0-only
export type SearchTree = {
  key: number;
  left: SearchTree | null;
  right: SearchTree | null;
};
export type TreeMove = { key: number; direction: "left" | "right" };
export type TreeGoal = {
  maxHeight: number;
  balanced?: boolean;
  root?: number;
  maxCost?: number;
};
export type TreeLevel = {
  id: string;
  title: string;
  lesson: string;
  order: readonly number[];
  weights: readonly number[];
  goal: TreeGoal;
  certificate: { moves: readonly TreeMove[]; shortest: number };
};
export type TreeState = { tree: SearchTree; history: readonly SearchTree[] };
export const TREE_STATE_LIMIT = 429; // Catalan(7), all ordered binary-tree shapes with fixed keys.
const integer = (n: number, lo: number, hi: number) =>
  Number.isInteger(n) && n >= lo && n <= hi;
export function validTreeLevel(l: TreeLevel): boolean {
  const n = l.order.length;
  return (
    integer(n, 3, 7) &&
    new Set(l.order).size === n &&
    l.order.every((k) => integer(k, 1, n)) &&
    l.weights.length === n &&
    l.weights.every((w) => integer(w, 1, 20)) &&
    integer(l.goal.maxHeight, 1, n) &&
    (l.goal.root === undefined || integer(l.goal.root, 1, n)) &&
    (l.goal.balanced === undefined || typeof l.goal.balanced === "boolean") &&
    (l.goal.maxCost === undefined || integer(l.goal.maxCost, 1, 980))
  );
}
export function initialTree(l: TreeLevel): SearchTree {
  const insert = (t: SearchTree | null, key: number): SearchTree =>
    !t
      ? { key, left: null, right: null }
      : key < t.key
        ? { ...t, left: insert(t.left, key) }
        : { ...t, right: insert(t.right, key) };
  let t: SearchTree | null = null;
  for (const k of l.order) t = insert(t, k);
  return t!;
}
export const createTreeState = (l: TreeLevel): TreeState => ({
  tree: initialTree(l),
  history: [],
});
export function validSearchTree(l: TreeLevel, t: SearchTree): boolean {
  if (!validTreeLevel(l)) return false;
  const keys = new Set<number>(),
    nodes = new Set<SearchTree>();
  const walk = (n: SearchTree | null, lo: number, hi: number): boolean => {
    if (n === null) return true;
    if (!n || nodes.has(n) || !integer(n.key, lo, hi) || keys.has(n.key))
      return false;
    nodes.add(n);
    keys.add(n.key);
    return walk(n.left, lo, n.key - 1) && walk(n.right, n.key + 1, hi);
  };
  return walk(t, 1, l.order.length) && keys.size === l.order.length;
}
export function treeMetrics(
  t: SearchTree | null,
  weights: readonly number[],
  depth = 1,
): {
  height: number;
  cost: number;
  balanced: boolean;
  depths: Record<number, number>;
} {
  if (!t) return { height: 0, cost: 0, balanced: true, depths: {} };
  const a = treeMetrics(t.left, weights, depth + 1),
    b = treeMetrics(t.right, weights, depth + 1);
  return {
    height: 1 + Math.max(a.height, b.height),
    cost: depth * weights[t.key - 1] + a.cost + b.cost,
    balanced: a.balanced && b.balanced && Math.abs(a.height - b.height) <= 1,
    depths: { ...a.depths, ...b.depths, [t.key]: depth },
  };
}
function meetsGoal(l: TreeLevel, t: SearchTree): boolean {
  const m = treeMetrics(t, l.weights),
    g = l.goal;
  return (
    m.height <= g.maxHeight &&
    (!g.balanced || m.balanced) &&
    (g.root === undefined || g.root === t.key) &&
    (g.maxCost === undefined || m.cost <= g.maxCost)
  );
}
export const treeWon = (l: TreeLevel, t: SearchTree): boolean =>
  validSearchTree(l, t) && meetsGoal(l, t);
function rotate(t: SearchTree | null, m: TreeMove): SearchTree | null {
  if (!t) return null;
  if (m.key < t.key) {
    const left = rotate(t.left, m);
    return left ? { ...t, left } : null;
  }
  if (m.key > t.key) {
    const right = rotate(t.right, m);
    return right ? { ...t, right } : null;
  }
  if (m.direction === "left" && t.right) {
    const p = t.right;
    return { ...p, left: { ...t, right: p.left } };
  }
  if (m.direction === "right" && t.left) {
    const p = t.left;
    return { ...p, right: { ...t, left: p.right } };
  }
  return null;
}
export function treeStep(
  l: TreeLevel,
  t: SearchTree,
  m: TreeMove,
): SearchTree | null {
  if (
    !validSearchTree(l, t) ||
    !integer(m.key, 1, l.order.length) ||
    (m.direction !== "left" && m.direction !== "right") ||
    meetsGoal(l, t)
  )
    return null;
  return rotate(t, m);
}
export function moveTree(l: TreeLevel, s: TreeState, m: TreeMove): TreeState {
  const tree = treeStep(l, s.tree, m);
  return tree ? { tree, history: [...s.history, s.tree] } : s;
}
export function undoTree(l: TreeLevel, s: TreeState): TreeState {
  return !s.history.length || treeWon(l, s.tree)
    ? s
    : {
        tree: s.history[s.history.length - 1],
        history: s.history.slice(0, -1),
      };
}
export function treeShape(t: SearchTree | null): string {
  return t ? `${t.key}(${treeShape(t.left)})(${treeShape(t.right)})` : ".";
}
export type TreeSearch = {
  status: "solved" | "unreachable" | "limited" | "cancelled" | "invalid";
  moves: TreeMove[];
  visited: number;
};
export function searchTree(
  l: TreeLevel,
  start?: SearchTree,
  options: { limit?: number; cancelled?: () => boolean } = {},
): TreeSearch {
  if (!validTreeLevel(l)) return { status: "invalid", moves: [], visited: 0 };
  start ??= initialTree(l);
  if (!validSearchTree(l, start))
    return { status: "invalid", moves: [], visited: 0 };
  const requestedLimit = options.limit ?? TREE_STATE_LIMIT;
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(TREE_STATE_LIMIT, Math.max(0, Math.floor(requestedLimit)))
    : TREE_STATE_LIMIT;
  const queue: [SearchTree, number, TreeMove | null][] = [[start, -1, null]],
    seen = new Set([treeShape(start)]);
  for (let head = 0; head < queue.length; head++) {
    if (options.cancelled?.())
      return { status: "cancelled", moves: [], visited: seen.size };
    const t = queue[head][0];
    if (meetsGoal(l, t)) {
      const moves: TreeMove[] = [];
      for (let i = head; queue[i][1] >= 0; i = queue[i][1])
        moves.push(queue[i][2]!);
      return { status: "solved", moves: moves.reverse(), visited: seen.size };
    }
    for (let key = 1; key <= l.order.length; key++)
      for (const direction of ["left", "right"] as const) {
        const m = { key, direction },
          next = rotate(t, m);
        if (!next) continue;
        const shape = treeShape(next);
        if (seen.has(shape)) continue;
        if (seen.size >= limit)
          return { status: "limited", moves: [], visited: seen.size };
        seen.add(shape);
        queue.push([next, head, m]);
      }
  }
  return { status: "unreachable", moves: [], visited: seen.size };
}
export function treeHint(l: TreeLevel, t: SearchTree): string {
  const r = searchTree(l, t);
  if (r.status === "invalid") return "树的结构无效，请重来。";
  if (r.status === "limited" || r.status === "cancelled")
    return "搜索已停止，暂时没有可靠建议；这不代表无解。";
  if (r.status === "unreachable")
    return `已穷尽 ${r.visited} 个树形，这些目标无法同时满足。`;
  if (!r.moves.length) return "当前树形已经满足全部目标。";
  const m = r.moves[0];
  return `最短续解还有 ${r.moves.length} 次旋转：可先选节点 ${m.key}，向${m.direction === "left" ? "左" : "右"}旋。任意满足公开目标的树形都可以通关。`;
}
export function findTreeNode(
  t: SearchTree | null,
  key: number,
): SearchTree | null {
  return !t || t.key === key
    ? t
    : findTreeNode(key < t.key ? t.left : t.right, key);
}
