// SPDX-License-Identifier: GPL-3.0-only
export const DEBUG_SAVE = 'playgarden.debug-detective.v1';
export const REGISTER = ['A', 'B', 'C'] as const;
export const INPUTS = ['000', '001', '010', '011', '100', '101', '110', '111'] as const;
export type Register = 0 | 1 | 2;
export type Operation = 'NOT' | 'COPY' | 'AND' | 'OR' | 'XOR';
export type Row = readonly [Register, Operation, Register | null];
export type Repair = readonly [number, Operation, Register | null];
export type DebugCase = {
  id: string; title: string; program: readonly Row[]; outputs: readonly [Register, Register];
  candidates: readonly Repair[]; expected: readonly string[]; budget: number;
};
export type Round = { probes: number[]; input: number; pick: number | null; solved: boolean };
export const initial = (): Round => ({ probes: [], input: 0, pick: null, solved: false });
export const expression = ([d, op, s]: Row) => {
  const a = REGISTER[d], b = s === null ? '' : REGISTER[s];
  return a + ' ← ' + (op === 'NOT' ? 'NOT ' + a : op === 'COPY' ? b : a + ' ' + op + ' ' + b);
};
export function execute(p: DebugCase, input: number, repair?: Repair) {
  const r = [input >> 2 & 1, input >> 1 & 1, input & 1];
  const trace = [r.join('')];
  p.program.forEach(([d, originalOp, originalSrc], i) => {
    const [op, src] = repair?.[0] === i ? [repair[1], repair[2]] : [originalOp, originalSrc];
    const a = r[d], b = src === null ? 0 : r[src];
    r[d] = op === 'NOT' ? 1 ^ a : op === 'COPY' ? b : op === 'AND' ? a & b : op === 'OR' ? a | b : a ^ b;
    trace.push(r.join(''));
  });
  return { lamps: p.outputs.map(i => r[i]).join(''), trace };
}
export const predictions = (p: DebugCase) => p.candidates.map(c => INPUTS.map((_, i) => execute(p, i, c).lamps));
export const survivors = (p: DebugCase, table: string[][], probes: readonly number[]) =>
  table.flatMap((row, index) => probes.every(i => row[i] === p.expected[i]) ? [index] : []);
export const fullyMatches = (p: DebugCase, table: string[][], n: number) =>
  table[n]?.every((out, i) => out === p.expected[i]) ?? false;

export function bestProbe(table: readonly (readonly string[])[], possible: number[], used: readonly number[]) {
  // Only candidate predictions are available here; no expected outputs enter the choice.
  function split(ids: number[], input: number) {
    const parts = new Map<string, number[]>();
    for (const id of ids) {
      const key = table[id][input], part = parts.get(key);
      if (part) part.push(id); else parts.set(key, [id]);
    }
    return [...parts.values()];
  }
  const memo = new Map<string, number>();
  const inputs = INPUTS.map((_, i) => i).filter(i => !used.includes(i));
  function need(ids: number[]): number {
    if (ids.length <= 1) return 0;
    const key = ids.join(',');
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const result = Math.min(...inputs.map(i => {
      const parts = split(ids, i);
      return parts.length <= 1 ? Infinity : 1 + Math.max(...parts.map(need));
    }));
    memo.set(key, result);
    return result;
  }
  let choice: { input: number; depth: number; biggest: number } | null = null;
  for (const i of inputs) {
    const parts = split(possible, i);
    if (parts.length < 2) continue;
    const depth = 1 + Math.max(...parts.map(need)), biggest = Math.max(...parts.map(x => x.length));
    if (!choice || depth < choice.depth || (depth === choice.depth && biggest < choice.biggest))
      choice = { input: i, depth, biggest };
  }
  return choice;
}
export function loadRound(p: DebugCase, table: string[][], raw: string | null): Round {
  try {
    const s = JSON.parse(raw ?? 'null');
    if (!s || s.id !== p.id || !Array.isArray(s.probes) || s.probes.length > p.budget ||
      new Set(s.probes).size !== s.probes.length || !s.probes.every((x: unknown) => Number.isInteger(x) && Number(x) >= 0 && Number(x) <= 7) ||
      !Number.isInteger(s.input) || s.input < 0 || s.input > 7 ||
      (s.pick !== null && (!Number.isInteger(s.pick) || s.pick < 0 || s.pick >= p.candidates.length))) return initial();
    const list = survivors(p, table, s.probes);
    return { probes: s.probes, input: s.input, pick: s.pick,
      solved: s.solved === true && list.length === 1 && s.pick === list[0] && fullyMatches(p, table, s.pick) };
  } catch { return initial(); }
}
