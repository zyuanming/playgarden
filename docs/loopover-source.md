# 环移拼盘 / Loopover

## Actual adaptation and license

- Upstream: [Janis Pritzkau's Loopover](https://github.com/janispritzkau/loopover).
- Fixed commit: `e4da7c57841e71beb5035bd4025c66216eec2b69` (2025-02-03).
- Actual source: [`src/game/board.ts`](https://github.com/janispritzkau/loopover/blob/e4da7c57841e71beb5035bd4025c66216eec2b69/src/game/board.ts), Git blob `31aa3e5ae137991ddeaaddf37d54af94057dfecb`.
- Exact license: [`LICENSE`](https://github.com/janispritzkau/loopover/blob/e4da7c57841e71beb5035bd4025c66216eec2b69/LICENSE), Git blob `90580ae29c4c3641ae989debaa0bdd345bf04d7a`.
- MIT, Copyright (c) 2020 Janis Pritzkau. The complete unchanged text is retained in `vendor/janis-loopover/LICENSE` and shipped as `public/loopover-LICENSE.txt`.

`src/vendor/loopoverCore.ts` actually adapts upstream `Board.moveRow`, `Board.moveColumn`, and `Board.isSolved`: modular source indexing, whole-line wrap-around, and identity-order checking remain. The mutable nested-array class has been rewritten into an immutable flat-array function, with explicit move validation and one-cell moves. The retained original is `vendor/janis-loopover/board.ts.upstream.txt`.

The upstream source was read only, never installed or executed. No Vue code, canvas renderer, timer, random scramble code, UI, branding, artwork, levels, fonts, or sounds were imported. The Playgarden React UI, original SVG art, tutorial text, authored disturbance sequences, undo/history handling, hint route logic, browser storage, and E2E scenario are project-authored GPL-3.0-only contributions. The adapted MIT core retains its upstream copyright and license.

## Rules and distinctness

Move one entire selected row left/right or one entire selected column up/down by one cell. All tiles remain on the board; the edge wraps to the other side. Restore increasing numeric order from left to right, top to bottom. There is no empty space and no individual-tile swap. This differs from the catalog's empty-slot sliding puzzle and from its prefix-reversal pancake game.

## Campaign: 100 authored levels

Six 3×3 lessons teach wrapping, intersections, central columns, a four-step commutator, staggered rows, and all-row/all-column interactions. Six 3×4 lessons introduce unequal row/column cycle lengths, flanking columns, separated rows sharing a column, chained swaps, edge routing, and a combined rectangular route. Six 4×4 lessons use corners, central interweaving, diagonal relays, double row shifts, ordered commutators, and a final ten-move interleaving.

The first 18 records, including all starting sequences and storage identifiers, remain unchanged. The 82 added boards form five further chapters:

| Levels | Chapter | Dimensions |
| --- | --- | --- |
| 19–30 | 九格交叉 | 3×3 |
| 31–48 | 长方环路 | 3×4 |
| 49–66 | 四阶借位 | 4×4 |
| 67–84 | 交线远行 | 4×4 |
| 85–100 | 全盘织结 | 4×4 |

Each is built from its own reversible sequence, not created by randomly shuffling at runtime or counting translated, mirrored, rotated or inverse copies. Offline comparison checked the new starts against the legacy campaign and each other, and found shortest opening routes of 4–10 moves. In-game hints after arbitrary player moves still do not promise shortest paths. Any valid solution wins without a time limit or move budget.

## Hint and storage contracts

Hints concatenate the known scramble and the player's witnessed move list, erase repeated-state loops, and invert the last remaining move. Therefore each confirmed hint has a legal route to the target, including after exploratory play. The route may backtrack and is explicitly not advertised as shortest. A hint only selects a preview; the player confirms it.

The browser resume prefix is `playgarden.loopover.v1`. Per-level storage records a version, stable level ID, and legal move list. Load validates every move, reconstructs the board, and rejects moves after a win. A saved board or win flag is never trusted. The bounded 2,000-move history has a visible recovery message rather than silently losing undo or save integrity. Pausing discards unconfirmed previews; undo discards a committed move; restart reconstructs the starting board. Completion is reported once per mounted round.

## Verification boundary

Run only the game-scoped `npm run test:e2e -- e2e/loopover.spec.ts`. It preserves the legacy first/middle/final and corruption checks; clears all 82 new boards through actual preview and confirmation on desktop keyboard and touch; checks the initial tile order and forward displacement independently; reopens a version-1 partial level 18 and advances to level 19; and finishes level 100 after a detour, refresh, undo and current-state hints. The expansion does not change the movement core, source attribution, game shell, storage, or hint logic.
