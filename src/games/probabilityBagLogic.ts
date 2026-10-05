// SPDX-License-Identifier: MIT
/** Exact rational bag events; exhaustive integer composition, no luck-based judging. */
export type BagCounts = [number, number, number];
export type Rational = readonly [number, number];
export type BagEvent =
  | { kind: "single"; colors: readonly number[] }
  | { kind: "conditional"; colors: readonly number[]; given: readonly number[] }
  | {
      kind: "pair";
      rule: "same" | "different" | "oneEach" | "atLeastOne" | "ordered";
      colors?: readonly number[];
      replacement: boolean;
    };
export type BagTarget = { label: string; event: BagEvent; target: Rational };
export type ProbabilityBagLevel = {
  id: string;
  title: string;
  lesson: string;
  size: number;
  initial: BagCounts;
  targets: readonly BagTarget[];
  minimum?: BagCounts;
  maximum?: BagCounts;
  costs?: BagCounts;
  budget?: number;
};
export type BagState = { counts: BagCounts; history: BagCounts[] };
export const bagTokenNames = ["A 圆片", "B 三角片", "C 方片"] as const;
export function rational(n: number, d: number): Rational | null {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d <= 0 || n < 0)
    return null;
  let a = n,
    b = d;
  while (b) {
    const r = a % b;
    a = b;
    b = r;
  }
  return [n / (a || 1), d / (a || 1)];
}
export const rationalText = (r: Rational | null): string =>
  r ? `${r[0]}/${r[1]}` : "未定义";
export const rationalEqual = (a: Rational | null, b: Rational): boolean =>
  a !== null && a[0] * b[1] === b[0] * a[1];
export const bagSize = (c: readonly number[]): number =>
  c.reduce((a, b) => a + b, 0);
export const bagCost = (l: ProbabilityBagLevel, c: BagCounts): number =>
  c.reduce((sum, n, i) => sum + n * (l.costs?.[i] ?? 0), 0);
export function bagEventProbability(
  c: BagCounts,
  e: BagEvent,
): Rational | null {
  if (c.length !== 3 || c.some((n) => !Number.isSafeInteger(n) || n < 0))
    return null;
  const n = bagSize(c);
  if (e.kind === "single")
    return rational(
      c.reduce((a, v, i) => a + (e.colors.includes(i) ? v : 0), 0),
      n,
    );
  if (e.kind === "conditional")
    return rational(
      c.reduce(
        (a, v, i) => a + (e.colors.includes(i) && e.given.includes(i) ? v : 0),
        0,
      ),
      c.reduce((a, v, i) => a + (e.given.includes(i) ? v : 0), 0),
    );
  const denominator = n * (e.replacement ? n : n - 1);
  let numerator = 0;
  for (let a = 0; a < 3; a++)
    for (let b = 0; b < 3; b++) {
      const colors = e.colors ?? [];
      const matches =
        e.rule === "same"
          ? a === b
          : e.rule === "different"
            ? a !== b
            : e.rule === "oneEach"
              ? (a === colors[0] && b === colors[1]) ||
                (b === colors[0] && a === colors[1])
              : e.rule === "ordered"
                ? a === colors[0] && b === colors[1]
                : a === colors[0] || b === colors[0];
      if (matches)
        numerator += c[a] * (c[b] - (!e.replacement && a === b ? 1 : 0));
    }
  return rational(numerator, denominator);
}
export function bagEventExplanation(e: BagEvent): string {
  if (e.kind === "single") return "一次抽取：符合事件的片数 ÷ 总片数 N。";
  if (e.kind === "conditional")
    return `一次抽取，已知属于 ${e.given.map((i) => "ABC"[i]).join(" 或 ")}：分母只数这些片；分子再数其中符合事件的片。分母为 0 时未定义，不能通过。`;
  return `${e.replacement ? "抽后放回并重新混匀：两次独立，所有有序结果的分母 N×N。" : "抽后不放回：第二次剩 N−1 片，所有有序结果的分母 N×(N−1)。"}${e.rule === "oneEach" ? "各一片不计先后，因此 AB 与 BA 都计入。" : e.rule === "ordered" ? "顺序固定，反向不计入。" : e.rule === "atLeastOne" ? "至少一次含指定类型，包括两次都是它。" : e.rule === "same" ? "相同类型：累加 AA、BB、CC。" : "不同类型：两次类型不同，两个顺序都计入。"}`;
}
export function validBagLevel(l: ProbabilityBagLevel): boolean {
  const validCounts = (c: readonly number[]) =>
    c.length === 3 &&
    c.every((n) => Number.isInteger(n) && n >= 0 && n <= l.size);
  return (
    Number.isInteger(l.size) &&
    l.size >= 2 &&
    l.size <= 18 &&
    validCounts(l.initial) &&
    bagSize(l.initial) <= l.size &&
    l.targets.length > 0 &&
    l.targets.every(
      (t) => t.target[1] > 0 && t.target[0] >= 0 && t.target[0] <= t.target[1],
    ) &&
    (!l.minimum || validCounts(l.minimum)) &&
    (!l.maximum || validCounts(l.maximum)) &&
    (!l.costs || validCounts(l.costs)) &&
    (l.budget === undefined || (Number.isInteger(l.budget) && l.budget >= 0))
  );
}
export function bagWon(l: ProbabilityBagLevel, c: BagCounts): boolean {
  return (
    validBagLevel(l) &&
    c.length === 3 &&
    c.every(
      (n, i) =>
        Number.isInteger(n) &&
        n >= (l.minimum?.[i] ?? 0) &&
        n <= (l.maximum?.[i] ?? l.size),
    ) &&
    bagSize(c) === l.size &&
    (l.budget === undefined || bagCost(l, c) <= l.budget) &&
    l.targets.every((t) =>
      rationalEqual(bagEventProbability(c, t.event), t.target),
    )
  );
}
export const createBagState = (l: ProbabilityBagLevel): BagState => ({
  counts: [...l.initial],
  history: [],
});
export function changeBagCount(
  l: ProbabilityBagLevel,
  state: BagState,
  color: number,
  delta: number,
): BagState {
  if (
    bagWon(l, state.counts) ||
    !Number.isInteger(color) ||
    color < 0 ||
    color > 2 ||
    (delta !== 1 && delta !== -1)
  )
    return state;
  const counts = [...state.counts] as BagCounts;
  counts[color] += delta;
  if (counts[color] < 0 || bagSize(counts) > l.size) return state;
  return { counts, history: [...state.history, state.counts] };
}
export function undoBag(l: ProbabilityBagLevel, state: BagState): BagState {
  if (bagWon(l, state.counts) || !state.history.length) return state;
  return {
    counts: [...state.history[state.history.length - 1]],
    history: state.history.slice(0, -1),
  };
}
export type BagHint =
  | { status: "found"; color: number; delta: -1 | 1; distance: number }
  | { status: "solved" | "none" | "budget" | "cancelled" };
export const BAG_HINT_LIMIT = 256;
export function* bagHintSteps(
  l: ProbabilityBagLevel,
  counts: BagCounts,
  limit = BAG_HINT_LIMIT,
): Generator<void, BagHint> {
  if (bagWon(l, counts)) return { status: "solved" };
  let searched = 0,
    best: BagCounts | null = null,
    distance = Infinity;
  for (let a = 0; a <= l.size; a++)
    for (let b = 0; b <= l.size - a; b++) {
      if (searched >= limit) return { status: "budget" };
      const c: BagCounts = [a, b, l.size - a - b];
      searched++;
      if (bagWon(l, c)) {
        const d = c.reduce((s, n, i) => s + Math.abs(n - counts[i]), 0);
        if (d < distance) {
          best = c;
          distance = d;
        }
      }
      if (searched % 32 === 0) yield;
    }
  if (!best) return { status: "none" };
  const target = best as BagCounts;
  const remove = counts.findIndex((n, i) => n > target[i]);
  const color =
    remove >= 0 ? remove : counts.findIndex((n, i) => n < target[i]);
  return { status: "found", color, delta: remove >= 0 ? -1 : 1, distance };
}
export function searchBagHint(
  l: ProbabilityBagLevel,
  counts: BagCounts,
  limit = BAG_HINT_LIMIT,
): BagHint {
  const g = bagHintSteps(l, counts, limit);
  let s = g.next();
  while (!s.done) s = g.next();
  return s.value;
}
