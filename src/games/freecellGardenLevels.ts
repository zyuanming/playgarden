// SPDX-License-Identifier: GPL-3.0-only
export const FREECELL_SUITS = ['S', 'H', 'C', 'D'] as const;
export type FreecellSuit = typeof FREECELL_SUITS[number];
export type FreecellCard = `${FreecellSuit}${number}`;
export type FreecellDeal = {
  id: string; title: string; lesson: string; maxRank: number;
  columns: FreecellCard[][]; cells: (FreecellCard | null)[];
  foundations: [number, number, number, number];
  /** Authored illustration, not a runtime hint or an executed proof.
   * A bare card goes to its suit foundation; @0 / @1 denote a free cell,
   * and #4 denotes column five (all indices here are zero based). */
  exampleRoute: string[];
};
const row = (text: string): FreecellCard[] => text ? text.split(' ') as FreecellCard[] : [];
const route = (text: string): string[] => text.split(' ');
const deal = (id: string, title: string, lesson: string, maxRank: number,
  columns: string[], cells: (FreecellCard | null)[], foundations: FreecellDeal['foundations'], example: string): FreecellDeal =>
  ({ id, title, lesson, maxRank, columns: columns.map(row), cells, foundations, exampleRoute: route(example) });

// Every array runs from the covered bottom card to the playable top card.
// These are small, deliberately composed teaching decks, not 52-card deals.
export const freecellGardenLevels: FreecellDeal[] = [
  deal('first-four-suits', '四个小小归宿', '先认识 A。可以先把一张 A 停在空位，再送进对应花色的归位区。', 3,
    ['S3 H2 S1', 'H3 S2 H1', 'C3 D2 C1', 'D3 C2 D1'], [null, null], [0, 0, 0, 0],
    'S1@0 S1 H1 C1 D1 H2 S2 D2 C2 S3 H3 C3 D3'),
  deal('crossed-aces', '互相挡住的 A', '红桃 2 和黑桃 2 互相挡着 A。留一个空位，就能打破这个小环。也可以先清空别列。', 3,
    ['S3 S1 H2', 'H3 H1 S2', 'C3 C2 C1', 'D3 D2 D1'], [null], [0, 0, 0, 0],
    'H2@0 S1 S2 H1 H2 C1 C2 D1 D2 S3 H3 C3 D3'),
  deal('three-column-chain', '三列接力', '牌列变窄了。先观察 A 藏在哪里，再暂存挡路牌；所有露出的牌都能作为起点。', 3,
    ['S3 H1 C2 S1', 'H3 C1 D2 H2', 'C3 D3 S2 D1'], [null, null], [0, 0, 0, 0],
    'S1 D1 S2 H2@0 D2 C1 C2 H1 H2 S3 H3 D3 C3'),
  deal('aces-already-home', '从 2 开始', '四张 A 已经归位。归位区下一张要 2；暂存 3，才能露出相互挡住的 2。', 4,
    ['S4 S2 H3', 'H4 H2 S3', 'C4 D3 C2', 'D4 C3 D2'], [null, null], [1, 1, 1, 1],
    'H3@0 S2 S3 H2 H3 C2 D2 D3 C3 S4 H4 C4 D4'),
  deal('empty-column-door', '空列是一扇门', '唯一空位已停着黑桃 4。空列能放任意一张牌，适合暂时搬开挡路的红桃 2。', 4,
    ['C2 S1 H2', 'H4 H1 S2 C1', 'C4 D2 C3 D1', 'D4 H3 S3 D3', ''], ['S4'], [0, 0, 0, 0],
    'H2#4 S1 C1 C2 S2 H1 H2 D1 C3 D2 C4 D3 S3 H3 D4 S4 H4'),
  deal('uneven-foundations', '四条不同的进度', '黑桃和红桃已有 A，另外两种花色仍在等 A。别把四个归位区当成同一条数列。', 4,
    ['S4 S2 C1 H3', 'H4 H2 C2 S3', 'C4 D2 D1', 'D4 C3 D3'], [null, null], [1, 1, 0, 0],
    'H3@0 C1 S2 S3 C2 H2 H3 D1 D2 D3 C3 C4 D4 S4 H4'),
  deal('twenty-card-weave', '二十张的交织', '现在每种花色到 5。先解开底部小牌的交错，较大的牌会逐步露出来。', 5,
    ['S5 H4 C3 S1 H2', 'H5 S4 D3 H1 S2', 'C5 D4 C2 C1 D2', 'D5 C4 H3 S3 D1'], [null, null], [0, 0, 0, 0],
    'H2@0 S1 S2 H1 H2 D1 D2 C1 C2 C3 S3 H3 H4 D3 S4 H5 D4 C4 D5 C5 S5'),
  deal('one-parking-place', '一个空位够用吗', '只有一个空位。暂存梅花 4 后，尽早整理小牌，让它能离开空位继续流转。', 5,
    ['S5 H3 S2 C4', 'H5 C3 H2', 'C5 D3 C2', 'D5 S4 D2', 'H4 D4 S3'], [null], [1, 1, 1, 1],
    'C4@0 S2 H2 C2 D2 S3 C3 D3 H3 C4 S4 D4 H4 S5 H5 C5 D5'),
  deal('deep-three-columns', '深牌列里的出口', '三条长牌列里，几个 A 都被压住了。空位能破环，但别把每个空位都当成永久停车场。', 5,
    ['S5 H4 C4 S3 H3 S1 C2', 'H5 D4 D3 C1 D2 H1 S2', 'C5 D5 S4 C3 D1 H2'], [null, null, null], [0, 0, 0, 0],
    'C2@0 S1 S2 H1 H2 D1 D2 C1 C2 H3 S3 C3 D3 D4 S4 C4 H4 S5 H5 D5 C5'),
  deal('two-layer-detour', '两层挡路牌', '每种花色到 6。挡路牌可能有两层；暂存、露出小牌、释放空位，是一组连续的决定。', 6,
    ['S6 C5 S2 D3 H4', 'H6 D5 H2 C3 S4', 'C6 H5 C2 S3', 'D6 S5 D2 H3', 'C4 D4'], [null, null], [1, 1, 1, 1],
    'H4@0 D3@1 S2 S3 C2 S4 C3 H2 H3 D2 D3 H4 D4 C4 C5 S5 D5 H5 S6 H6 C6 D6'),
  deal('late-card-parking', '让 5 先等一会', '两种花色已到 2，另外两种仍从 A 开始。较大的暂存牌要等待同花色的小牌。', 6,
    ['S6 S5 H4 S3 C1', 'H6 H5 C4 H3 D2', 'C6 D5 C3 D3 C2', 'D6 D4 S4 D1 C5'], [null], [2, 2, 0, 0],
    'C5@0 D1 D2 H3 C1 C2 D3 C3 S3 H4 C4 C5 S4 D4 D5 H5 S5 S6 H6 C6 D6'),
  deal('open-garden-finale', '把花园留得宽一点', '二十四张牌与一条空列。选择自己的整理顺序：空列和空位都能中转，最终四种花色全部到 6。', 6,
    ['S6 H5 C4 S3 S1 D2', 'H6 C5 D4 H1 C2', 'C6 D5 S4 C1 H2', 'D6 S5 H3 D1', 'H4 D3 C3 S2', ''], [null, null], [0, 0, 0, 0],
    'D1 D2 S1 S2 H2#5 C1 C2 H1 H2 C3 D3 H3 S3 C4 H4 D4 S4 C5 D5 S5 H5 S6 H6 C6 D6'),
];
