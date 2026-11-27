// SPDX-License-Identifier: GPL-3.0-only
export const directions = {
  E: [1, 0], W: [-1, 0], S: [0, 1], N: [0, -1],
  SE: [1, 1], NE: [1, -1], SW: [-1, 1], NW: [-1, -1],
  E2: [2, 0], W2: [-2, 0], S2: [0, 2], N2: [0, -2],
} as const;
export type Direction = keyof typeof directions;
type Point = readonly [number, number];
export type Plate = { anchor: Point; seed: readonly Point[]; target: readonly string[] };
export type Level = { id: string; turns: readonly number[]; steps: readonly Direction[]; copies: readonly number[]; panels: readonly Plate[] };
export type Recipe = { turn: number; step: Direction; copies: number };
export type Cell = "blank" | "match" | "missing" | "extra";

export function printPlate(plate: Plate, recipe: Recipe) {
  const [dx, dy] = directions[recipe.step];
  const printed = new Set<number>();
  let clipped = 0, overlap = 0;
  for (const [sx, sy] of plate.seed) {
    let x = sx, y = sy;
    for (let i = 0; i < recipe.turn / 90; i++) [x, y] = [-y, x];
    for (let i = 0; i < recipe.copies; i++) {
      const xx = x + plate.anchor[0] + i * dx, yy = y + plate.anchor[1] + i * dy;
      if (xx < 0 || xx > 4 || yy < 0 || yy > 4) { clipped++; continue; }
      const c = yy * 5 + xx;
      if (printed.has(c)) overlap++;
      else printed.add(c);
    }
  }
  const cells = [...plate.target.join("")].map((t, i): Cell =>
    t === "#" ? printed.has(i) ? "match" : "missing" : printed.has(i) ? "extra" : "blank");
  return { cells, clipped, overlap, matches: !cells.includes("missing") && !cells.includes("extra") };
}
export const initialRecipe = (l: Level): Recipe => ({ turn: l.turns[0], step: l.steps[0], copies: l.copies[0] });
export const recipeId = (r: Recipe) => r.turn + "/" + r.step + "/" + r.copies;
