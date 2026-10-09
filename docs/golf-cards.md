# 逐张纸牌

Original GPL-3.0-only rule engine, eight authored miniature teaching deals, interface, and SVG. No third-party source, card faces, or level data. Implements the traditional rank-adjacency Golf solitaire idea independently: only exposed column bottoms can move to waste; there are no pair-to-thirteen removals, foundations, free cells, suit order, or card-column transfers. Changing the active waste rank is the defining mechanic.

## Rules and lessons

Every play takes the bottom remaining card from one column to waste, requiring an absolute rank difference of exactly one. A=1/J=11/Q=12/K=13; no A-K wrap and no equal-rank moves. At any time a player may draw the next finite stock card, replacing waste. Old waste and spent stock cannot be revisited except by undo. Clearing every column wins; unused reserve cards are fine. All tableau cards and future stock order are visible: these are open-information authored planning lessons, not standard full-deck random deals.

Lessons contain 6–12 column cards across 3–4 columns with one or two stock cards: adjacency, direction reversal, interleaved unlocking, non-wrapping boundaries, stock bridging, duplicate-rank branching, deep four-column relay, and high/low-rank final traversal. Choosing a currently legal card is not always strategically safe. Drawing while another play exists is allowed and can be wasteful.

## State and accessibility

Native keyboard buttons and touch targets at least 44 px. Only exposed cards may be selected, but exposed nonadjacent cards intentionally give a rule explanation without changing state. History restores column heights, active waste and stock index. Pause, reset, undo and hints conform to GameProps; victory checks every column height, signals completion once, and locks the full board. Search hints solve the live state with a memoized 30,000-node cap; capped/unsolvable messages are distinguished, and suggested actions only come from a complete discovered path.

## Verification handoff

Worker authored without browser/E2E/unit/proof execution. Parent should run the typechecked build and final targeted `e2e/golf-cards.spec.ts`. The single authored journey covers first/final actual wins, wrong-rank no-op, finite stock, pause/undo/reset/hint, keyboard versus mobile .tap, initial/final starting and win screenshots, overflow, 44 px targets, saved completion, and disabled post-win shell undo.
