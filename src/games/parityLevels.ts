// SPDX-License-Identifier: GPL-3.0-only
// Exact MIT story data: Abe Fehr, Parity @ 730ecbd24d4cd821bd236f2a441f4e5e2b22654f.
import originalLevels from "./parityLevelsData.json";

export type ParityDirection = "u" | "d" | "l" | "r";
export type ParityLevel = {
  id: string;
  number: number;
  mode: "vanilla" | "b&w";
  contents: readonly number[];
  colors: readonly ("w" | "b")[];
  initialSelected: { readonly x: number; readonly y: number };
  solution?: readonly ParityDirection[];
};

/** Preserve all 100 original records, ordering, values, colors, starts and optional routes. */
export const parityLevels: readonly ParityLevel[] = originalLevels
  .map(item => ({
    id: `parity-${item.number}`,
    number: item.number!,
    mode: item.mode as ParityLevel["mode"],
    contents: Object.freeze([...item.contents!]),
    colors: Object.freeze(item.colors ? [...item.colors] as ("w" | "b")[] : Array<"w">(9).fill("w")),
    initialSelected: Object.freeze({ ...item.initialSelected! }),
    ...(item.solution ? { solution: Object.freeze([...item.solution]) as readonly ParityDirection[] } : {}),
  }));

export const parityChapters = ["同数初旅 · 01—50", "黑白回响 · 51—100"] as const;
