import type { GameId, GameMeta } from "./catalog";
export type CatalogOrder = "featured" | "newest" | "continue";
/** Registry order is the explicit editorial order and never mutated. */
export function orderCatalog<T extends Pick<GameMeta, "id" | "levelCount">>(
  items: readonly T[],
  order: CatalogOrder,
  completed: Partial<Record<GameId, readonly number[]>>,
): T[] {
  if (order === "newest") return [...items].reverse();
  if (order !== "continue") return [...items];
  const ranked = items.map((item, index) => {
    const count = new Set(
      (completed[item.id] ?? []).filter(
        (n) => Number.isInteger(n) && n >= 0 && n < item.levelCount,
      ),
    ).size;
    return {
      item,
      index,
      count,
      group: count > 0 && count < item.levelCount ? 0 : count === 0 ? 1 : 2,
    };
  });
  return ranked
    .sort(
      (a, b) =>
        a.group - b.group ||
        (a.group === 0 ? b.count - a.count : 0) ||
        a.index - b.index,
    )
    .map((entry) => entry.item);
}
