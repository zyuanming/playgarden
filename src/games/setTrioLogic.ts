// SPDX-License-Identifier: GPL-3.0-only
// Original implementation of the general ternary all-same / all-different rule.
import type { TrioCard, TrioLevel } from './setTrioLevels';
export const SET_TRIO_SAVE = 'playgarden.set-trio.v1';
export const TRIO_ATTRIBUTES = ['颜色', '形状', '数量', '填充'] as const;
export const TRIO_COLORS = ['朱红', '靛蓝', '青绿'] as const;
export const TRIO_SHAPES = ['圆形', '三角', '菱形'] as const;
export const TRIO_FILLS = ['实心', '空心', '斜纹'] as const;
export type TrioState = { removed: number[][]; selected: number[] };
export type TrioRelation = 'same' | 'different' | 'mixed';
export const initialTrio = (): TrioState => ({ removed: [], selected: [] });
export function trioCardLabel(card: TrioCard): string {
  return `${TRIO_COLORS[card[0]]}，${TRIO_SHAPES[card[1]]}，${card[2] + 1} 个，${TRIO_FILLS[card[3]]}`;
}
export function trioRemaining(p: TrioLevel, s: TrioState): number[] {
  const removed = new Set(s.removed.flat());
  return p.cards.flatMap((_, i) => removed.has(i) ? [] : [i]);
}
export function trioRelations(cards: readonly TrioCard[]): TrioRelation[] {
  return TRIO_ATTRIBUTES.map((_, attribute) => {
    const different = new Set(cards.map((card) => card[attribute])).size;
    return different === 1 ? 'same' : different === 3 ? 'different' : 'mixed';
  });
}
export function validTrio(p: TrioLevel, ids: readonly number[]): boolean {
  return ids.length === 3 && new Set(ids).size === 3 &&
    ids.every((i) => Number.isInteger(i) && i >= 0 && i < p.cards.length) &&
    trioRelations(ids.map((i) => p.cards[i])).every((r) => r !== 'mixed');
}
export function selectTrio(p: TrioLevel, s: TrioState, card: number): TrioState {
  if (!trioRemaining(p, s).includes(card)) return s;
  if (s.selected.includes(card)) return { ...s, selected: s.selected.filter((i) => i !== card) };
  if (s.selected.length === 3) return s;
  return { ...s, selected: [...s.selected, card] };
}
export function confirmTrio(p: TrioLevel, s: TrioState): TrioState {
  const available = trioRemaining(p, s);
  if (!validTrio(p, s.selected) || !s.selected.every((i) => available.includes(i))) return s;
  return { removed: [...s.removed, [...s.selected]], selected: [] };
}
export function undoTrio(s: TrioState): TrioState {
  if (s.removed.length) return { removed: s.removed.slice(0, -1), selected: [...s.removed[s.removed.length - 1]] };
  return s.selected.length ? { ...s, selected: [] } : s;
}
export function trioWon(p: TrioLevel, s: TrioState): boolean {
  return trioRemaining(p, s).length === 0;
}
/** Exact partition search on at most 12 visible cards (at most 4096 subsets).
 * Pick the lowest remaining card and consider every valid triple containing it.
 * No hidden solution, authored partition, or past hints are consulted. */
export function solveTrio(p: TrioLevel, remaining: readonly number[]): number[][] | null {
  if (remaining.length > 12 || remaining.length % 3 || new Set(remaining).size !== remaining.length ||
      remaining.some((i) => !Number.isInteger(i) || i < 0 || i >= p.cards.length)) return null;
  const cache = new Map<number, number[][] | null>();
  const search = (mask: number): number[][] | null => {
    if (!mask) return [];
    if (cache.has(mask)) return cache.get(mask)!;
    const first = remaining.findIndex((_, i) => (mask & (1 << i)) !== 0);
    for (let b = first + 1; b < remaining.length; b++) {
      if (!(mask & (1 << b))) continue;
      for (let c = b + 1; c < remaining.length; c++) {
        if (!(mask & (1 << c))) continue;
        const group = [remaining[first], remaining[b], remaining[c]];
        if (!validTrio(p, group)) continue;
        const tail = search(mask ^ (1 << first) ^ (1 << b) ^ (1 << c));
        if (tail !== null) { const result = [group, ...tail]; cache.set(mask, result); return result; }
      }
    }
    cache.set(mask, null);
    return null;
  };
  return search((1 << remaining.length) - 1);
}
export type TrioHint = { cards: number[]; text: string };
export function trioHint(p: TrioLevel, s: TrioState): TrioHint {
  const path = solveTrio(p, trioRemaining(p, s));
  if (path?.length) return {
    cards: path[0],
    text: `当前余牌的完整分组搜索找到了清空路径。可先选 ${path[0].map((i) => `第 ${i + 1} 张`).join('、')}；这只是其中一种方案，不会自动选牌。`,
  };
  if (path) return { cards: [], text: '桌面已经清空了。' };
  for (let undo = 1; undo <= s.removed.length; undo++) {
    const previous = { removed: s.removed.slice(0, -undo), selected: [] };
    if (solveTrio(p, trioRemaining(p, previous)) !== null) return {
      cards: [], text: `这些余牌已无法全部分成有效的三张组。至少撤销 ${undo} 次收起，才能回到可清空的局面。提示没有改动任何牌。`,
    };
  }
  return { cards: [], text: '当前没有完整清空路径。请重来；提示没有改动任何牌。' };
}
export function trioFingerprint(p: TrioLevel): string {
  return p.cards.map((c) => c.join('')).join('-');
}
export function serializeTrio(p: TrioLevel, state: TrioState): string {
  return JSON.stringify({ version: 1, id: p.id, board: trioFingerprint(p), actions: state.removed, selected: state.selected });
}
/** Replays only legal removals, then checks the surviving draft. Never trust a saved win flag. */
export function parseTrioSave(raw: string | null, p: TrioLevel): TrioState {
  if (!raw || raw.length > 6000) return initialTrio();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return initialTrio();
    const v = value as Record<string, unknown>;
    if (v.version !== 1 || v.id !== p.id || v.board !== trioFingerprint(p) || !Array.isArray(v.actions) ||
        v.actions.length > p.cards.length / 3 || !Array.isArray(v.selected) || v.selected.length > 3) return initialTrio();
    let state = initialTrio();
    for (const group of v.actions) {
      if (!Array.isArray(group) || !validTrio(p, group) || !group.every((i) => trioRemaining(p, state).includes(i))) return initialTrio();
      state = confirmTrio(p, { ...state, selected: group });
    }
    const selected: unknown[] = v.selected;
    const remaining = trioRemaining(p, state);
    if (new Set(selected).size !== selected.length || !selected.every((i) => typeof i === 'number' && Number.isInteger(i) && remaining.includes(i))) return initialTrio();
    return { ...state, selected: selected as number[] };
  } catch { return initialTrio(); }
}
