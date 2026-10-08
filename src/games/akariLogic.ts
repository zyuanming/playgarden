// SPDX-License-Identifier: GPL-3.0-only
// Ray traversal, light counts and completion adapted from Simon Tatham's MIT
// lightup.c: list_lights, set_light, number_correct, grid_correct.
// Full unchanged source and licence: vendor/sgtatham-lightup/.
export type AkariLevel = {
  id: string;
  title: string;
  chapter: number;
  size: number;
  board: string;
};
export type AkariState = number[]; // 0 empty, 1 lamp, 2 pencil cross
export const AKARI_SAVE = "playgarden.akari.v1";
export function neighbors(p: AkariLevel, i: number): number[] {
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
/** A wall terminates each ray. Lamps never block a ray. */
export function litCells(p: AkariLevel, i: number): number[] {
  if (
    !Number.isInteger(i) ||
    i < 0 ||
    i >= p.board.length ||
    p.board[i] !== "."
  )
    return [];
  const n = p.size,
    x = i % n,
    y = Math.floor(i / n),
    cells = [i];
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    for (
      let a = x + dx, b = y + dy;
      a >= 0 && a < n && b >= 0 && b < n;
      a += dx, b += dy
    ) {
      const j = b * n + a;
      if (p.board[j] !== ".") break;
      cells.push(j);
    }
  }
  return cells;
}
export function inspectAkari(p: AkariLevel, state: AkariState) {
  const light = Array(p.board.length).fill(0) as number[],
    clashes: number[] = [],
    wrong: number[] = [];
  for (let i = 0; i < state.length; i++)
    if (state[i] === 1) for (const j of litCells(p, i)) light[j]++;
  for (let i = 0; i < p.board.length; i++) {
    if (state[i] === 1 && light[i] > 1) clashes.push(i);
    if (
      /[0-4]/.test(p.board[i]) &&
      neighbors(p, i).filter((j) => state[j] === 1).length !==
        Number(p.board[i])
    )
      wrong.push(i);
  }
  const dark = p.board
    .split("")
    .flatMap((c, i) => (c === "." && light[i] === 0 ? [i] : []));
  const valid =
    state.length === p.board.length &&
    state.every(
      (v, i) =>
        Number.isInteger(v) &&
        v >= 0 &&
        v <= 2 &&
        (p.board[i] === "." || v === 0),
    );
  return {
    light,
    clashes,
    wrong,
    dark,
    won:
      valid && dark.length === 0 && clashes.length === 0 && wrong.length === 0,
  };
}
export function changeAkari(
  p: AkariLevel,
  state: AkariState,
  i: number,
  value: number,
): AkariState {
  if (
    inspectAkari(p, state).won ||
    !Number.isInteger(i) ||
    i < 0 ||
    i >= state.length ||
    p.board[i] !== "." ||
    ![0, 1, 2].includes(value) ||
    state[i] === value
  )
    return state;
  return state.map((v, j) => (j === i ? value : v));
}
/** Original bounded exact constraint search, using current lamps and pencil marks. */
export function solveAkari(
  p: AkariLevel,
  state: AkariState,
  budget = 20000,
):
  | { kind: "solution"; cells: number[] }
  | { kind: "none" }
  | { kind: "budget" } {
  const whites = p.board.split("").flatMap((c, i) => (c === "." ? [i] : [])),
    rays = new Map(whites.map((i) => [i, litCells(p, i)]));
  const clues = p.board.split("").flatMap((c, i) =>
    /[0-4]/.test(c)
      ? [
          {
            cells: neighbors(p, i).filter((j) => p.board[j] === "."),
            target: Number(c),
          },
        ]
      : [],
  );
  let nodes = 0,
    exhausted = false;
  function search(a: number[]): number[] | null {
    if (++nodes > budget) {
      exhausted = true;
      return null;
    }
    let changed = true;
    while (changed) {
      changed = false;
      const assign = (i: number, v: number) => {
        if (a[i] !== -1) return a[i] === v;
        a[i] = v;
        changed = true;
        return true;
      };
      for (const i of whites)
        if (a[i] === 1)
          for (const j of rays.get(i)!)
            if (j !== i && !assign(j, 0)) return null;
      for (const { cells, target } of clues) {
        const got = cells.filter((i) => a[i] === 1).length,
          rest = cells.filter((i) => a[i] === -1);
        if (got > target || got + rest.length < target) return null;
        if (got === target || got + rest.length === target)
          for (const i of rest)
            if (!assign(i, got === target ? 0 : 1)) return null;
      }
      for (const i of whites) {
        const ray = rays.get(i)!;
        if (ray.some((j) => a[j] === 1)) continue;
        const rest = ray.filter((j) => a[j] !== 0);
        if (!rest.length) return null;
        if (rest.length === 1 && !assign(rest[0], 1)) return null;
      }
    }
    const unknown = whites.filter((i) => a[i] === -1);
    if (!unknown.length) return whites.filter((i) => a[i] === 1);
    const candidates = whites
      .filter((i) => !rays.get(i)!.some((j) => a[j] === 1))
      .map((i) => rays.get(i)!.filter((j) => a[j] === -1))
      .filter((a) => a.length)
      .sort((a, b) => a.length - b.length);
    const i = (candidates[0] ?? unknown)[0];
    for (const v of [1, 0]) {
      const next = [...a];
      next[i] = v;
      const answer = search(next);
      if (answer) return answer;
      if (exhausted) return null;
    }
    return null;
  }
  const answer = search(
    state.map((v, i) =>
      p.board[i] !== "." ? 0 : v === 1 ? 1 : v === 2 ? 0 : -1,
    ),
  );
  return answer
    ? { kind: "solution", cells: answer }
    : { kind: exhausted ? "budget" : "none" };
}
export function parseAkariSave(
  raw: string | null,
  p: AkariLevel,
): AkariState[] {
  const initial = () => [Array(p.board.length).fill(0) as number[]];
  try {
    const x = JSON.parse(raw ?? "null");
    if (
      x?.id !== p.id ||
      !Array.isArray(x.history) ||
      !x.history.length ||
      x.history.length > 501
    )
      return initial();
    const history = x.history as number[][];
    if (history[0].length !== p.board.length || history[0].some((v) => v !== 0))
      return initial();
    for (let h = 0; h < history.length; h++) {
      const s = history[h];
      if (
        !Array.isArray(s) ||
        s.length !== p.board.length ||
        s.some(
          (v, i) => ![0, 1, 2].includes(v) || (p.board[i] !== "." && v !== 0),
        )
      )
        return initial();
      if (
        h &&
        (inspectAkari(p, history[h - 1]).won ||
          s.filter((v, i) => v !== history[h - 1][i]).length !== 1)
      )
        return initial();
    }
    return history;
  } catch {
    return initial();
  }
}
