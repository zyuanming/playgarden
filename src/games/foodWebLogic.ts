// SPDX-License-Identifier: GPL-3.0-only
export type Stock = readonly [number, number, number, number, number];
type Menu = readonly [string, string, string];
export type Choices = readonly [string, string, string];
export type Season = { in: readonly [number, number]; menu: Menu };
export type FoodLevel = {
  id: string;
  start: Stock;
  rounds: readonly Season[];
  goal: readonly (readonly [number, number])[];
};

export const resources = ["叶片", "种子", "昆虫", "小鼠", "猫头鹰"];
export const symbols = ["❧", "◆", "✣", "●", "◉"];
const costs: readonly (readonly Stock[])[] = [
  [
    [0, 0, 0, 0, 0],
    [2, 0, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [1, 1, 0, 0, 0],
  ],
  [
    [0, 0, 0, 0, 0],
    [0, 2, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 0, 0, 0],
  ],
  [
    [0, 0, 0, 0, 0],
    [0, 0, 2, 0, 0],
    [0, 0, 0, 2, 0],
    [0, 0, 1, 1, 0],
  ],
];
const outputs = [
  [0, 2, 1, 2],
  [0, 2, 1, 2],
  [0, 1, 1, 1],
];
const mapStock = (fn: (i: number) => number): Stock => [
  fn(0),
  fn(1),
  fn(2),
  fn(3),
  fn(4),
];

export function card(group: number, id: string) {
  const index = Number(id);
  return { cost: costs[group][index], gain: outputs[group][index] };
}
export function openingStock(stock: Stock, season: Season) {
  return mapStock((i) => stock[i] + (season.in[i] ?? 0));
}
export function draftFor(season?: Season): Choices {
  const fixed = (i: number) =>
    season?.menu[i].length === 1 ? season.menu[i] : "";
  return [fixed(0), fixed(1), fixed(2)];
}
export function previewSeason(opening: Stock, season: Season, draft: Choices) {
  const picked = draft.map((id, group) =>
    id.length === 1 && season.menu[group].includes(id) ? card(group, id) : null,
  );
  const full = picked.every(Boolean);
  const cost = mapStock((i) =>
    picked.reduce((sum, c) => sum + (c?.cost[i] ?? 0), 0),
  );
  const gain = mapStock((i) => picked[i - 2]?.gain ?? 0);
  const missing = mapStock((i) => Math.max(0, cost[i] - opening[i]));
  const next =
    full && !missing.some(Boolean)
      ? mapStock((i) => opening[i] - cost[i] + gain[i])
      : null;
  return { cost, gain, missing, next, full };
}
export function meetsGoal(l: FoodLevel, stock: Stock) {
  return l.goal.every(([low, high], i) => stock[i] >= low && stock[i] <= high);
}
export function continuation(
  l: FoodLevel,
  round: number,
  stock: Stock,
): Choices | null {
  const season = l.rounds[round];
  const open = openingStock(stock, season);
  for (const a of season.menu[0])
    for (const b of season.menu[1])
      for (const c of season.menu[2]) {
        const draft: Choices = [a, b, c];
        const { next } = previewSeason(open, season, draft);
        if (
          next &&
          (round + 1 === l.rounds.length
            ? meetsGoal(l, next)
            : continuation(l, round + 1, next))
        )
          return draft;
      }
  return null;
}
