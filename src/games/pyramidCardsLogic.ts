// SPDX-License-Identifier: GPL-3.0-only
// Original compact teaching deals. This is not a standard 52-card solitaire deal.
export type PyramidLevel = { title: string; rows: number; cards: number[]; stock: number[]; lesson: string };
export type PyramidState = { removed: number; stockIndex: number; waste: number | null };
export type PyramidAction = { kind: "draw" } | { kind: "remove"; cards: number[] };
export const pyramidCardsLevels: PyramidLevel[] = [
  { title:"十三的搭档", rows:3, cards:[13,4,9,2,11,13], stock:[], lesson:"从最下层开始：2 与 J 合为 13，K 自己就是 13。清除两张支撑牌才会露出上方的牌。" },
  { title:"跨层配对", rows:3, cards:[13,7,13,4,9,6], stock:[], lesson:"先移走 4 和 9，露出的 7 可以与底层的 6 配对。搭档不必处在同一行。" },
  { title:"等待五点", rows:3, cards:[13,8,13,2,11,5], stock:[], lesson:"先替 8 清出两张支撑，再让它与仍在底层的 5 配对。被压住的牌不能提前使用。" },
  { title:"补牌的时机", rows:3, cards:[13,4,9,6,2,13], stock:[7,11], lesson:"储备牌是有限的：翻出的 7 和 J 分别帮助 6、2 离场。过早翻下一张会丢弃尚未使用的废牌。" },
  { title:"四层花塔", rows:4, cards:[13,4,9,13,6,7,2,11,5,8], stock:[], lesson:"塔长高了。先观察每张牌的两张直接支撑，再从底部打开通往塔顶的路。" },
  { title:"同点的岔路", rows:4, cards:[13,2,11,8,5,13,4,9,5,8], stock:[], lesson:"两个 8 和两个 5 可以跨层配对。每次清牌后检查新露出的牌，不要只看点数，也要看下方的覆盖。" },
  { title:"两侧解围", rows:4, cards:[13,6,7,13,3,10,2,4,9,8], stock:[11,5], lesson:"中间的 4、9 可以直接移走，两侧的 2、8 则需要储备牌。先画清楚支撑关系，避免浪费补牌。" },
  { title:"借道登顶", rows:4, cards:[13,5,8,9,4,13,6,7,2,8], stock:[11,5,4], lesson:"解开底部后，把露出的牌与不同层的牌配对。并非每张储备牌都要用；清空整座金字塔就获胜。" },
];
export const pyramidInitial = (): PyramidState => ({ removed:0, stockIndex:0, waste:null });
export const pyramidRank = (rank:number) => rank === 1 ? "A" : rank === 11 ? "J" : rank === 12 ? "Q" : rank === 13 ? "K" : String(rank);
export function pyramidExposed(config:PyramidLevel, state:PyramidState, cell:number):boolean {
  if (!Number.isInteger(cell) || cell < 0 || cell >= config.cards.length || (state.removed & (1 << cell))) return false;
  let row = 0; while ((row + 1) * (row + 2) / 2 <= cell) row++;
  if (row === config.rows - 1) return true;
  return Boolean((state.removed & (1 << (cell + row + 1))) && (state.removed & (1 << (cell + row + 2))));
}
export const pyramidWon = (config:PyramidLevel, state:PyramidState) => state.removed === (1 << config.cards.length) - 1;
export function pyramidActions(config:PyramidLevel, state:PyramidState):PyramidAction[] {
  if (pyramidWon(config,state)) return [];
  const available = config.cards.map((_,i) => i).filter(i => pyramidExposed(config,state,i));
  if (state.waste !== null) available.push(-1);
  const rank = (i:number) => i === -1 ? state.waste! : config.cards[i];
  const actions:PyramidAction[] = [];
  for (let a = 0; a < available.length; a++) {
    if (rank(available[a]) === 13) actions.push({kind:"remove", cards:[available[a]]});
    for (let b = a + 1; b < available.length; b++) if (rank(available[a]) + rank(available[b]) === 13) actions.push({kind:"remove", cards:[available[a],available[b]]});
  }
  if (state.stockIndex < config.stock.length) actions.push({kind:"draw"});
  return actions;
}
export function pyramidMove(config:PyramidLevel, state:PyramidState, action:PyramidAction):PyramidState | null {
  const valid = pyramidActions(config,state).some(a => a.kind === action.kind && (a.kind === "draw" || (action.kind === "remove" && a.cards.length === action.cards.length && a.cards.every(c => action.cards.includes(c)))));
  if (!valid) return null;
  if (action.kind === "draw") return { ...state, waste:config.stock[state.stockIndex], stockIndex:state.stockIndex + 1 };
  return { ...state, removed:action.cards.reduce((bits,c) => c < 0 ? bits : bits | (1 << c),state.removed), waste:action.cards.includes(-1) ? null : state.waste };
}
export function pyramidHint(config:PyramidLevel, start:PyramidState):{ action:PyramidAction | null; text:string } {
  let visits = 0, capped = false; const failed = new Set<string>();
  function find(state:PyramidState):PyramidAction[] | null {
    if (pyramidWon(config,state)) return [];
    if (++visits > 30000) { capped = true; return null; }
    const key = `${state.removed}/${state.stockIndex}/${state.waste}`; if (failed.has(key)) return null;
    for (const action of pyramidActions(config,state)) { const tail = find(pyramidMove(config,state,action)!); if (tail) return [action,...tail]; if (capped) return null; }
    failed.add(key); return null;
  }
  const path = find(start), action = path?.[0] ?? null;
  const name = (cell:number) => cell < 0 ? `废牌 ${pyramidRank(start.waste!)}` : `第 ${cell + 1} 张 ${pyramidRank(config.cards[cell])}`;
  return { action, text:action ? action.kind === "draw" ? "当前有一条通关路线：翻一张储备牌。注意，旧废牌会被丢弃。" : `当前有一条通关路线：${action.cards.map(name).join(" 与 ")}可以${action.cards.length === 1 ? "单独移除" : "配对移除"}。` : pyramidWon(config,start) ? "金字塔已清空。" : capped ? "本次提示达到搜索上限；没有断言无解。可撤销一步重新观察。" : "当前已没有清空整塔的路线。请撤销或重来；储备牌不会循环。" };
}
