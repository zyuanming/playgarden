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

## Campaign: 18 authored levels

Six 3×3 lessons teach wrapping, intersections, central columns, a four-step commutator, staggered rows, and all-row/all-column interactions. Six 3×4 lessons introduce unequal row/column cycle lengths, flanking columns, separated rows sharing a column, chained swaps, edge routing, and a combined rectangular route. Six 4×4 lessons use corners, central interweaving, diagonal relays, double row shifts, ordered commutators, and a final ten-move interleaving.

Each board is constructed by its own explicit legal disturbance sequence from the target. No mirrored/rotated template batch or unseeded random runtime levels are counted. The construction is an existence witness only; no optimality or exhaustive independent proof is claimed. The starting disturbances range from one to ten steps. A player may use any legal route without a time limit or move budget.

## Hint and storage contracts

Hints concatenate the known scramble and the player's witnessed move list, erase repeated-state loops, and invert the last remaining move. Therefore each confirmed hint has a legal route to the target, including after exploratory play. The route may backtrack and is explicitly not advertised as shortest. A hint only selects a preview; the player confirms it.

The browser resume prefix is `playgarden.loopover.v1`. Per-level storage records a version, stable level ID, and legal move list. Load validates every move, reconstructs the board, and rejects moves after a win. A saved board or win flag is never trusted. The bounded 2,000-move history has a visible recovery message rather than silently losing undo or save integrity. Pausing discards unconfirmed previews; undo discards a committed move; restart reconstructs the starting board. Completion is reported once per mounted round.

## Verification boundary

No unit tests, campaign solver sweep, unfamiliar upstream execution, package installation, or independent review was performed for this module. `e2e/loopover.spec.ts` is authored for the integration owner's one final `npm run test:e2e -- e2e/loopover.spec.ts` invocation. It uses desktop and touch controls, independently checks forward cyclic displacement, completes representative first/middle/final levels through real input, captures those board states, checks controls at least 44px, and covers preview cancellation, repeated input, current-state hints, pause, undo, restart, reload, and invalid saved data. Authoring the scenario is not a claim that it has passed.
