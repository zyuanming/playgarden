# 金字塔纸牌

Original GPL-3.0-only implementation, eight hand-authored teaching deals, and programmatic SVG artwork. No upstream code, card illustrations, trademarks, or third-party puzzle data were copied. Standard pair-to-thirteen / two-child-cover solitaire ideas are implemented independently. Unlike Freecell, there are no foundations, suit ordering, free cells, or card-column transfers; unlike arithmetic puzzles, availability is a changing support graph and stock is a one-way resource.

## Rules and scope

Eight compact fixed teaching deals contain 6–10 pyramid cards, three or four rows, and 0–3 reserve cards. This is explicitly not a full 52-card randomized solitaire game. Suits do not matter. A=1, J=11, Q=12, K=13. Exposed cards whose values sum to 13 can be removed, including pyramid + waste; a K can be removed alone. A pyramid card is exposed only after both direct children are removed. Bottom cards start exposed. Draw consumes one reserve card, discarding an existing waste; discarded waste cannot be revisited, except through undo. Emptying the pyramid wins even with reserve cards left.

Lessons teach pair arithmetic, cross-layer pairs, unlocking a waiting partner, reserve timing, four-layer dependency chains, duplicate-rank traps, two-sided rescue, and an interleaved final route. They are original authored layouts, not random shuffles or eight cosmetic skins of the same fixed position.

## Interaction / correctness

Native buttons support touch and Tab + Enter/Space. Main card/draw buttons are at least 44 px. Covered and removed cards cannot be used. Invalid pairs do not mutate the position; selection moves to the last clicked card. Pause and victory disable all game buttons. Undo restores the full previous legal-move state including reserve index and waste; selection is cleared. Reset/remount reconstructs the selected lesson. Victory checks the entire removed bitset, fires completion once and locks all further moves.

A memoized depth-first hint search uses the live position and a 30,000-node limit, returning a move only after finding a complete clearing path. If exhausted it says the current position is unsolvable; if capped it explicitly makes no such claim. Every transition removes at least a card or consumes reserve, so the search is acyclic.

## Verification handoff

Authoring only: no unit suite, campaign proof, browser, or E2E run performed by this worker. Parent integration must typecheck/build, then run exactly the targeted `e2e/pyramid-cards.spec.ts` journey in the final E2E workflow. The authored journey exercises actual first and final wins, native desktop keyboard/mobile taps, bad pairs, coverage, pause, undo, reset, current-state hints, first/final starting and winning screenshots, overflow, 44 px controls, progress, and post-win shell undo disabled. No test-only win switch exists.
