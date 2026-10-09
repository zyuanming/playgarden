# 骰子组合

Original GPL-3.0-only code, eight authored fixed-sequence training scenarios and programmatic SVG. No third-party game source, level data or artwork. Generic five-dice keep/reroll/category-allocation ideas are independently implemented. There are no money, bets, purchases, rewards, gambling odds or random-number claims.

## Honest scope

This is a finite planning trainer, not a random dice simulator. Each lesson has two or three rounds and the same number of scoring categories. Every round has a fixed five-face initial row plus two fixed replacement rows. The face of an unheld die comes from its column in the next row; held dice keep their values. The complete sequence is visible in an expandable panel, the next replacement row is displayed directly, and the interface explicitly states that rolls are not random. Reset replays the same teaching sequence.

Five dice may individually be held or released before either of two optional rerolls. Scoring can happen immediately, after one reroll or after two. Each category is used exactly once, even when scoring zero. Success requires all categories filled AND cumulative points at least the lesson target; a below-target terminal result is a failure that can still be undone. No credit is awarded just for reaching target early.

Categories: highest qualifying pair = rank×2; three-of-a-kind = rank×3; four-of-a-kind = rank×4; exact 3+2 full house =25; distinct 1–5 or 2–6 straight =40; five equal =50; sixes =sum of six-valued dice; chance =sum of all dice. Higher multiplicities qualify for pair/triple/four but not full house. The scorecard labels the actual local formulas.

Eight lessons teach expanding a kept pair, scoring early, repairing a straight, full-house grouping, category opportunity cost, three-round allocation, different hold-set sizes, and a combined three-round final. The current dice and historical scoring choices genuinely affect attainable score.

## Hints, state and UI

Exact hints optimize category allocation across remaining fixed rounds. For one category/round they enumerate at most 31 hold masks for each of at most two rerolls (at most 993 raw nodes before memoization), then use category-assignment dynamic programming. At most three categories and three rounds bound the search; it is a live-state calculation, not an author solution replay. A suggested reroll gives the exact hold set to configure but does not change the UI. A current state that cannot reach target is reported with its exact maximum and an undo suggestion.

History includes hold toggles, rerolls, category allocation and round advancement. Pause locks all game controls; reset reconstructs the lesson; undo after unsuccessful terminal scoring restores play. Successful terminal scoring fires completion once and locks the board and shell undo. Native buttons provide Enter/Space and touch with at least 44 px targets. Dice dots are CSS and accessible names announce die number/value/hold state.

## Verification handoff

Worker did not run browser, E2E, unit or proof suites. Parent runs a clean typechecked build and final targeted `e2e/dice-combinations.spec.ts`. The authored journey uses real first/final winning actions, failed-goal/zero-category handling, undo from failure, pause/reset/current-state hint, desktop keyboard/mobile .tap, first/final starting and win screenshots, viewport overflow, control size, progress and win lock. No simulated payout or test-only success shortcut exists.
