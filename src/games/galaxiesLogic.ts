// SPDX-License-Identifier: GPL-3.0-only
// Substantial adaptation of MIT galaxies.c by Simon Tatham and contributors:
// space_opposite_dot; check_complete's component union, bounding-box centre,
// adjacent-dot exclusion and cellwise half-turn symmetry. See vendor/sgtatham-galaxies.
export type GalaxiesLevel = {
  id: string;
  title: string;
  chapter: number;
  size: number;
  centers: number[][];
};
export const GALAXIES_SAVE = "playgarden.galaxies.v1";
export function neighbors(p: GalaxiesLevel, i: number) {
  const n = p.size,
    x = i % n,
    y = Math.floor(i / n);
  return [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ]
    .filter(([a, b]) => a >= 0 && a < n && b >= 0 && b < n)
    .map(([a, b]) => b * n + a);
}
/** Coordinates are doubled: odd = cell centre, even = grid boundary. */
export function opposite(p: GalaxiesLevel, g: number, i: number) {
  const c = p.centers[g];
  if (!c) return -1;
  const x = c[0] - 1 - (i % p.size),
    y = c[1] - 1 - Math.floor(i / p.size);
  return x >= 0 && x < p.size && y >= 0 && y < p.size ? y * p.size + x : -1;
}
export function coreCells(p: GalaxiesLevel, g: number) {
  const [x, y] = p.centers[g];
  return [
    ...new Set(
      [Math.floor((y - 1) / 2), Math.floor(y / 2)].flatMap((b) =>
        [Math.floor((x - 1) / 2), Math.floor(x / 2)].map((a) => b * p.size + a),
      ),
    ),
  ];
}
export function initialGalaxies(p: GalaxiesLevel) {
  const cells = Array(p.size * p.size).fill(-1) as number[];
  p.centers.forEach((_, g) =>
    coreCells(p, g).forEach((i) => {
      cells[i] = g;
    }),
  );
  return cells;
}
/** Regions are represented by cell assignments; their borders are exactly where
 * labels differ. There can be no redundant internal border in this UI. */
export function inspectGalaxies(p: GalaxiesLevel, state: number[]) {
  if (
    state.length !== p.size * p.size ||
    Array.from(state).some((g) => !Number.isInteger(g) || g < -1 || g >= p.centers.length)
  ) {
    return {
      missing: p.size * p.size,
      valid: new Set<number>(),
      invalid: new Set(Array.from({ length: p.size * p.size }, (_, i) => i)),
      completeRegions: p.centers.map(() => false),
      won: false,
    };
  }
  const n = p.size,
    total = n * n,
    parent = Array.from({ length: total }, (_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (state[i] < 0) continue;
      if (x + 1 < n && state[i] === state[i + 1]) union(i, i + 1);
      if (y + 1 < n && state[i] === state[i + n]) union(i, i + n);
    }
  const components = new Map<number, number[]>();
  for (let i = 0; i < total; i++)
    if (state[i] >= 0) {
      const r = find(i);
      components.set(r, [...(components.get(r) ?? []), i]);
    }
  const valid = new Set<number>(),
    invalid = new Set<number>();
  for (const cells of components.values()) {
    const xs = cells.map((i) => i % n),
      ys = cells.map((i) => Math.floor(i / n));
    const cx = Math.min(...xs) + Math.max(...xs) + 1,
      cy = Math.min(...ys) + Math.max(...ys) + 1;
    const g = p.centers.findIndex((c) => c[0] === cx && c[1] === cy),
      root = find(cells[0]);
    let ok =
      g >= 0 &&
      cells.every((i) => state[i] === g) &&
      coreCells(p, g).every((i) => find(i) === root);
    if (ok)
      p.centers.forEach((_, h) => {
        if (h !== g && coreCells(p, h).some((i) => find(i) === root))
          ok = false;
      });
    if (ok)
      ok = cells.every((i) => {
        const j = opposite(p, g, i);
        return j >= 0 && find(j) === root;
      });
    for (const i of cells) (ok ? valid : invalid).add(i);
  }
  const missing = state.filter((g) => g < 0).length;
  const completeRegions = p.centers.map(
    (_, g) =>
      state.some((v, i) => v === g && valid.has(i)) &&
      state.every((v, i) => v !== g || valid.has(i)),
  );
  return {
    missing,
    valid,
    invalid,
    completeRegions,
    won:
      state.length === total &&
      missing === 0 &&
      invalid.size === 0 &&
      completeRegions.every(Boolean),
  };
}
export function changeGalaxies(
  p: GalaxiesLevel,
  state: number[],
  i: number,
  g: number,
) {
  if (
    !Number.isInteger(i) ||
    i < 0 ||
    i >= state.length ||
    !Number.isInteger(g) ||
    g < -1 ||
    g >= p.centers.length ||
    initialGalaxies(p)[i] >= 0 ||
    inspectGalaxies(p, state).won ||
    state[i] === g
  )
    return state;
  const next = [...state];
  next[i] = g;
  return next;
}
export function parseGalaxiesSave(
  raw: string | null,
  p: GalaxiesLevel,
): number[][] {
  const fresh = [initialGalaxies(p)];
  if (!raw) return fresh;
  try {
    const value = JSON.parse(raw),
      fixed = fresh[0];
    if (
      value.id !== p.id ||
      !Array.isArray(value.history) ||
      value.history.length < 1 ||
      value.history.length > 2001
    )
      return fresh;
    if (
      !value.history.every(
        (s: unknown) =>
          Array.isArray(s) &&
          s.length === fixed.length &&
          s.every(
            (g: unknown, i: number) =>
              typeof g === "number" &&
              Number.isInteger(g) &&
              g >= -1 &&
              g < p.centers.length &&
              (fixed[i] < 0 || fixed[i] === g),
          ),
      )
    )
      return fresh;
    return value.history;
  } catch {
    return fresh;
  }
}
/** Original bounded domain solver. Opposite pairs and reachability prune domains;
 * the upstream completion validator remains the final authority. */
export function solveGalaxies(
  p: GalaxiesLevel,
  state: number[],
  budget = 20000,
): { kind: "solution"; cells: number[] } | { kind: "none" | "budget" } {
  const n = p.size,
    total = n * n;
  let nodes = 0,
    exhausted = false;
  let answer: number[] | null = null;
  const fixed = initialGalaxies(p);
  const initial = Array.from(
    { length: total },
    (_, i) =>
      new Set(
        p.centers.flatMap((_, g) =>
          opposite(p, g, i) >= 0 &&
          (state[i] < 0 || state[i] === g) &&
          (fixed[i] < 0 || fixed[i] === g)
            ? [g]
            : [],
        ),
      ),
  );
  function search(ds: Set<number>[]) {
    if (++nodes > budget) {
      exhausted = true;
      return;
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (let g = 0; g < p.centers.length; g++) {
        const start = coreCells(p, g)[0],
          seen = new Set([start]),
          queue = [start];
        if (!ds[start].has(g)) return;
        for (const i of queue)
          for (const j of neighbors(p, i)) {
            const k = opposite(p, g, j);
            if (k >= 0 && !seen.has(j) && ds[j].has(g) && ds[k].has(g)) {
              seen.add(j);
              queue.push(j);
            }
          }
        for (let i = 0; i < total; i++) {
          const k = opposite(p, g, i);
          if (ds[i].has(g) && (!seen.has(i) || k < 0 || !ds[k].has(g))) {
            ds[i].delete(g);
            changed = true;
          }
        }
      }
      if (ds.some((d) => !d.size)) return;
      for (let i = 0; i < total; i++)
        if (ds[i].size === 1) {
          const g = [...ds[i]][0],
            j = opposite(p, g, i);
          if (j < 0 || !ds[j].has(g)) return;
          if (ds[j].size !== 1) {
            ds[j] = new Set([g]);
            changed = true;
          }
        }
    }
    let best = -1;
    for (let i = 0; i < total; i++)
      if (ds[i].size > 1 && (best < 0 || ds[i].size < ds[best].size)) best = i;
    if (best < 0) {
      const cells = ds.map((d) => [...d][0]);
      if (inspectGalaxies(p, cells).won) answer = cells;
      return;
    }
    for (const g of ds[best]) {
      const next = ds.map((d) => new Set(d));
      next[best] = new Set([g]);
      search(next);
      if (answer || exhausted) return;
    }
  }
  search(initial);
  return answer
    ? { kind: "solution", cells: answer }
    : { kind: exhausted ? "budget" : "none" };
}
