// SPDX-License-Identifier: GPL-3.0-only
type Mode = { plots: number[]; cost: number };
type Valve = { tank: number; modes: Mode[] };
export type IrrigationLevel = {
  id: string;
  width: number;
  height: number;
  needs: number[];
  caps: number[];
  valves: Valve[];
  solution: number[];
};
export const tankNames = ["Ⅰ", "Ⅱ"];
export const modeNames = ["关闭", "窄喷", "宽喷"];
export const plotName = (i: number) => String.fromCharCode(65 + i);
const pack = [
  ["2×1", "11", "4", "I(A:2) I(B:2)", "11"],
  ["3×1", "111", "4", "I(A:2,AB:3) I(C:1,BC:3)", "21"],
  [
    "3×2",
    "121111",
    "10",
    "I(C:1,BC:2) I(F:3,EF:5) I(AB:4,ABC:5) I(DE:3,DEF:4)",
    "2012",
  ],
  [
    "3×2",
    "221111",
    "9",
    "I(DE:2,ADE:3) I(F:3,EF:5) I(B:1,BC:3) I(AB:2,ABD:3) I(C:2,CF:3)",
    "20112",
  ],
  [
    "3×2",
    "121221",
    "12",
    "I(BE:3,ABE:5) I(C:1,CF:2) I(BE:2,BDE:3) I(F:2,EF:3) I(D:2,DE:4)",
    "22201",
  ],
  [
    "3×2",
    "211111",
    "5/4",
    "I(A:2,AB:4) II(AB:4,ABE:5) I(C:2,BC:4) II(AD:2,ADE:4) I(CF:2,BCF:3)",
    "10022",
  ],
  [
    "3×2",
    "121221",
    "5/5",
    "I(F:1,EF:2) II(BC:2,BCF:3) I(DE:2,ADE:3) II(F:1,EF:3) I(AD:2,ABD:3)",
    "01122",
  ],
  [
    "3×2",
    "122211",
    "4/10",
    "I(B:1,BE:2) II(BC:2,BCE:3) I(CF:3,CEF:5) II(D:3,DE:5) I(EF:3,CEF:5) II(A:2,AD:4)",
    "121102",
  ],
  [
    "3×2",
    "221211",
    "5/7",
    "I(EF:2,DEF:4) II(AD:3,ADE:5) I(BC:4,BCF:5) II(AD:2,ABD:4) I(AD:3,ABD:4) II(BC:3,ABC:5)",
    "100211",
  ],
  [
    "3×2",
    "121331",
    "8/8",
    "I(DE:2,BDE:3) II(E:2,DE:4) I(F:1,CF:2) II(AD:3,ABD:5) I(A:3,AD:4) II(BC:2,BCE:4)",
    "221022",
  ],
  [
    "3×2",
    "112122",
    "7/8",
    "I(DE:2,ADE:4) II(DE:2,ADE:4) I(BE:3,BCE:5) II(CF:4,BCF:5) I(EF:3,DEF:4) II(EF:4,BEF:6) I(AD:2,ABD:4)",
    "0021011",
  ],
  [
    "3×2",
    "132132",
    "9/10",
    "I(DE:2,DEF:4) II(B:2,BC:4) I(EF:3,CEF:4) II(B:3,BE:5) I(C:3,CF:4) II(AB:3,ABC:5) I(B:1,AB:3)",
    "2022021",
  ],
] as const;
export const irrigationLevels: IrrigationLevel[] = pack.map(
  ([size, needs, caps, valves, answer], i) => {
    const [width, height] = size.split("×").map(Number);
    return {
      id: `irrigation-plan-${String(i + 1).padStart(3, "0")}`,
      width,
      height,
      needs: [...needs].map(Number),
      caps: caps.split("/").map(Number),
      valves: valves.split(" ").map((token) => {
        const m = /^(I|II)\(([^)]+)\)$/.exec(token);
        if (!m) throw Error("Invalid valve");
        return {
          tank: m[1].length - 1,
          modes: [
            { plots: [], cost: 0 },
            ...m[2].split(",").map((row) => {
              const [plots, cost] = row.split(":");
              return {
                plots: [...plots].map((plot) => plot.charCodeAt(0) - 65),
                cost: Number(cost),
              };
            }),
          ],
        };
      }),
      solution: [...answer].map(Number),
    };
  },
);
export const initial = (level: IrrigationLevel) => level.valves.map(() => 0);
export function inspect(level: IrrigationLevel, modes: readonly number[]) {
  const doses = level.needs.map(() => 0),
    spent = level.caps.map(() => 0);
  for (const [i, valve] of level.valves.entries()) {
    const mode = valve.modes[modes[i]];
    if (!mode) continue;
    spent[valve.tank] += mode.cost;
    for (const plot of mode.plots) doses[plot]++;
  }
  const exact = doses.every((dose, i) => dose === level.needs[i]);
  const underCaps = spent.every((cost, i) => cost <= level.caps[i]);
  return { doses, spent, exact, underCaps, won: exact && underCaps };
}
export function edit(
  level: IrrigationLevel,
  current: readonly number[],
  valve: number,
  mode: number,
) {
  if (
    !level.valves[valve]?.modes[mode] ||
    mode === current[valve] ||
    inspect(level, current).won
  )
    return current;
  return current.map((m, i) => (i === valve ? mode : m));
}
// Search the public constraints, not the replay. Every board has at most 3^7 drafts.
// The nearest valid plan gives actionable hints even from an overfilled draft.
export function hint(level: IrrigationLevel, current: readonly number[]) {
  let nearest: number[] | null = null,
    best = Infinity;
  const draft = initial(level);
  function search(index: number, distance: number) {
    if (distance >= best) return;
    if (index === level.valves.length) {
      if (inspect(level, draft).won) {
        nearest = draft.slice();
        best = distance;
      }
      return;
    }
    for (let mode = 0; mode < level.valves[index].modes.length; mode++) {
      draft[index] = mode;
      search(index + 1, distance + Number(mode !== current[index]));
    }
  }
  search(0, 0);
  const plan = nearest as number[] | null;
  if (!plan) return null;
  const valve = plan.findIndex((mode, i) => mode !== current[i]);
  return valve < 0 ? null : { valve, mode: plan[valve] };
}
