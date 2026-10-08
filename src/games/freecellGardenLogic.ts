// SPDX-License-Identifier: GPL-3.0-only
import { FREECELL_SUITS, type FreecellCard, type FreecellDeal, type FreecellSuit } from './freecellGardenLevels';
export const FREECELL_SAVE = 'playgarden.freecell-garden.v1';
export const SUIT_NAMES: Record<FreecellSuit, string> = { S: '黑桃', H: '红桃', C: '梅花', D: '方块' };
export const SUIT_SYMBOLS: Record<FreecellSuit, string> = { S: '♠', H: '♥', C: '♣', D: '♦' };
export type FreecellSource = { kind: 'column'; index: number } | { kind: 'cell'; index: number };
export type FreecellPlace = FreecellSource | { kind: 'foundation'; index: number };
export type FreecellMove = { from: FreecellSource; to: FreecellPlace };
export type FreecellBoard = {
  columns: FreecellCard[][]; cells: (FreecellCard | null)[];
  foundations: [number, number, number, number];
};
export type FreecellSession = { board: FreecellBoard; moves: FreecellMove[]; selected: FreecellSource | null };
export const cardSuit = (card: FreecellCard) => card[0] as FreecellSuit;
export const cardRank = (card: FreecellCard) => Number(card.slice(1));
export const rankLabel = (rank: number) => rank === 1 ? 'A' : String(rank);
export const cardLabel = (card: FreecellCard) => `${SUIT_NAMES[cardSuit(card)]} ${rankLabel(cardRank(card))}`;
export const redCard = (card: FreecellCard) => ['H', 'D'].includes(cardSuit(card));
export const samePlace = (a: FreecellPlace | null, b: FreecellPlace | null) => Boolean(a && b && a.kind === b.kind && a.index === b.index);
export const placeKey = (place: FreecellPlace) => `${place.kind}-${place.index}`;
export function placeLabel(place: FreecellPlace): string {
  return place.kind === 'column' ? `第 ${place.index + 1} 列` : place.kind === 'cell' ? `空位 ${place.index + 1}` : `${SUIT_NAMES[FREECELL_SUITS[place.index]]}归位区`;
}
export function initialFreecell(deal: FreecellDeal): FreecellSession {
  return { board: { columns: deal.columns.map((column) => [...column]), cells: [...deal.cells], foundations: [...deal.foundations] }, moves: [], selected: null };
}
function validPlace(board: FreecellBoard, place: FreecellPlace): boolean {
  return Number.isInteger(place.index) && place.index >= 0 && (
    place.kind === 'column' ? place.index < board.columns.length : place.kind === 'cell' ? place.index < board.cells.length : place.kind === 'foundation' && place.index < 4);
}
export function topCard(board: FreecellBoard, source: FreecellSource): FreecellCard | null {
  if (!validPlace(board, source)) return null;
  return source.kind === 'cell' ? board.cells[source.index] : board.columns[source.index].at(-1) ?? null;
}
export function freecellWon(deal: FreecellDeal, board: FreecellBoard): boolean {
  return board.foundations.every((rank) => rank === deal.maxRank) && board.cells.every((card) => card === null) && board.columns.every((column) => column.length === 0);
}
export function freecellMoveError(deal: FreecellDeal, board: FreecellBoard, move: FreecellMove): string | null {
  if (freecellWon(deal, board)) return '这局已完成，请重来或换关。';
  if (!validPlace(board, move.from) || !validPlace(board, move.to) || !['cell', 'column'].includes(move.from.kind)) return '这个位置不在牌桌上。';
  if (samePlace(move.from, move.to)) return '这是原来的位置，可以取消选择。';
  const card = topCard(board, move.from);
  if (!card) return '起点没有可移动的牌。';
  if (move.to.kind === 'cell') return board.cells[move.to.index] === null ? null : '一个空位只能停一张牌。';
  if (move.to.kind === 'foundation') {
    if (cardSuit(card) !== FREECELL_SUITS[move.to.index]) return '归位区只接收自己的花色。';
    return cardRank(card) === board.foundations[move.to.index] + 1 ? null : `这里下一张需要 ${rankLabel(board.foundations[move.to.index] + 1)}，不能跳过点数。`;
  }
  const top = board.columns[move.to.index].at(-1);
  if (!top) return null;
  return redCard(card) !== redCard(top) && cardRank(card) === cardRank(top) - 1 ? null : '牌列只能红黑交替，且新牌比顶牌小 1。';
}
export function moveFreecell(deal: FreecellDeal, board: FreecellBoard, move: FreecellMove): FreecellBoard | null {
  if (freecellMoveError(deal, board, move)) return null;
  const card = topCard(board, move.from)!;
  const next: FreecellBoard = { columns: board.columns.map((column) => [...column]), cells: [...board.cells], foundations: [...board.foundations] };
  if (move.from.kind === 'column') next.columns[move.from.index].pop(); else next.cells[move.from.index] = null;
  if (move.to.kind === 'column') next.columns[move.to.index].push(card);
  else if (move.to.kind === 'cell') next.cells[move.to.index] = card;
  else next.foundations[move.to.index]++;
  return next;
}
export function freecellDestinations(deal: FreecellDeal, board: FreecellBoard, from: FreecellSource): FreecellPlace[] {
  const places: FreecellPlace[] = [
    ...board.columns.map((_, index) => ({ kind: 'column' as const, index })),
    ...board.cells.map((_, index) => ({ kind: 'cell' as const, index })),
    ...FREECELL_SUITS.map((_, index) => ({ kind: 'foundation' as const, index })),
  ];
  return places.filter((to) => !freecellMoveError(deal, board, { from, to }));
}
export function undoFreecell(deal: FreecellDeal, state: FreecellSession): FreecellSession {
  if (!state.moves.length) return { ...state, selected: null };
  const moves = state.moves.slice(0, -1);
  let board = initialFreecell(deal).board;
  for (const move of moves) { const next = moveFreecell(deal, board, move); if (!next) return initialFreecell(deal); board = next; }
  return { board, moves, selected: null };
}
export function freecellHint(deal: FreecellDeal, state: FreecellSession): { text: string; source: FreecellSource | null } {
  const sources: FreecellSource[] = state.selected ? [state.selected] : [
    ...state.board.cells.map((_, index) => ({ kind: 'cell' as const, index })),
    ...state.board.columns.map((_, index) => ({ kind: 'column' as const, index })),
  ];
  const available = sources.flatMap((from) => freecellDestinations(deal, state.board, from).map((to) => ({ from, to })));
  const suggestion = available.find((move) => move.to.kind === 'foundation') ?? available.find((move) => move.to.kind === 'column') ?? available[0];
  if (!suggestion) return { text: state.selected ? '所选牌目前没有合法落点。取消后看看别的牌，或撤销一步。' : '当前没有合法单张移动。可以撤销或重来；这不是整局无解的证明。', source: state.selected };
  return { source: suggestion.from, text: `一个合法选择：${placeLabel(suggestion.from)}的${cardLabel(topCard(state.board, suggestion.from)!)} → ${placeLabel(suggestion.to)}。提示只检查这一步合法，不保证后续能清空。` };
}
function fingerprint(deal: FreecellDeal): string {
  return JSON.stringify([deal.id, deal.maxRank, deal.columns, deal.cells, deal.foundations]);
}
export function serializeFreecell(deal: FreecellDeal, state: FreecellSession): string | null {
  if (state.moves.length > 5000) return null;
  return JSON.stringify({ version: 1, deal: fingerprint(deal), moves: state.moves, selected: state.selected });
}
function readPlace(value: unknown, allowFoundation: boolean): FreecellPlace | null {
  if (!value || typeof value !== 'object') return null;
  const place = value as Partial<FreecellPlace>;
  return typeof place.index === 'number' && Number.isInteger(place.index) && ['column', 'cell', ...(allowFoundation ? ['foundation'] : [])].includes(place.kind ?? '') ? place as FreecellPlace : null;
}
export function restoreFreecell(raw: string | null, deal: FreecellDeal): FreecellSession {
  const fresh = initialFreecell(deal);
  if (!raw || raw.length > 1_000_000) return fresh;
  try {
    const save = JSON.parse(raw);
    if (!save || save.version !== 1 || save.deal !== fingerprint(deal) || !Array.isArray(save.moves) || save.moves.length > 5000) return fresh;
    let board = fresh.board;
    const moves: FreecellMove[] = [];
    for (const entry of save.moves) {
      if (!entry || typeof entry !== 'object') return fresh;
      const from = readPlace(entry.from, false) as FreecellSource | null, to = readPlace(entry.to, true);
      if (!from || !to) return fresh;
      const next = moveFreecell(deal, board, { from, to });
      if (!next) return fresh;
      board = next; moves.push({ from, to });
    }
    const selected = readPlace(save.selected, false) as FreecellSource | null;
    return { board, moves, selected: selected && !freecellWon(deal, board) && topCard(board, selected) ? selected : null };
  } catch { return fresh; }
}
