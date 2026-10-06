# Hashi and Slitherlink integration

Original implementation, Chinese teaching copy, UI and 24 original levels under the repository's GPL-3.0-only license. No third-party code, levels, assets, packages or services were added.

## Modules

- `src/games/HashiGarden.tsx`: default `HashiGarden`, implementing `GameProps`.
- `src/games/SlitherlinkGarden.tsx`: default `SlitherlinkGarden`, implementing `GameProps`.
- `src/games/hashiLogic.ts`: `hashiLevels`, `hashiSolutions`, `validHashiLevel`, `hashiEdges`, `hashiCrossings`, `hashiDegrees`, `hashiConflicts`, `isHashiSolved`, `searchHashi`, `getHashiHint`.
- `src/games/slitherlinkLogic.ts`: `slitherlinkLevels`, `slitherlinkSolutions`, `validSlitherlinkLevel`, `slitherlinkEdges`, `slitherlinkCounts`, `slitherlinkConflicts`, `isSlitherlinkSolved`, `searchSlitherlink`, `getSlitherlinkHint`.
- `src/games/networkDeductionCore.ts`: deterministic, immutable edge editing/history and bounded public-constraint finite-domain search.
- `src/games/NetworkDeductionRound.tsx`: shared lifecycle, hint toolbar and geometric keyboard navigation only. Game-specific rules remain in their respective engines.
- `src/games/networkDeduction.css`: styles scoped to `.network-game`.
- `tests/networkDeductionGames.test.tsx`: focused logic and DOM coverage.

Suggested catalog labels: 桥岛连心 (Hashi), 数回花环 (Slitherlink). Both expose 12 zero-indexed levels. These files do not register themselves or change App, shared types, package configuration or deployment.

## Levels and certificates

Every level contains an authored `solution` certificate. Hashi's `hashiSolutions` and Slitherlink's `slitherlinkSolutions` export the same arrays for integration tests. These certificates are never consulted by hint search, victory checking, input validation or clue solving.

Hashi progresses through 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 and 16 islands. Later boards introduce mutually crossing candidate bridges, absent routes and global connectivity deductions. `hashiEdges(level)` orders eligible pairs by ascending first and then second island index. Only nearest visible orthogonal neighbors are eligible. Certificate values are 0, 1 or 2 bridges. All islands must be connected; degree satisfaction alone is not victory.

Slitherlink sizes are 2×2, 2×2, 3×3, 3×3, 3×3, 4×4, 4×4, 4×4, 5×5, 5×5, 5×5, 5×5. Hidden clue counts are 0, 1, 0, 2, 3, 2, 4, 6, 4, 6, 8, 10. Edge ordering is all horizontal edges in row-major order, followed by all vertical edges in row-major order. Certificate values are 0 or 1. A complete drawing is one nonempty connected degree-two loop satisfying all displayed clues.

Both solvers search only coordinates, public clues and player marks. Each of the 24 blank puzzles has exactly one solution, checked by exhaustive completion search with a second-solution cutoff. Tests poison/remove solution certificates before solving. Separate independently written validators verify every certificate. Small-family regression tests compare the entire solver result set against brute-force enumeration: all degree tuples on the four-island square, and all displayed/hidden 2×2 clue configurations derived from valid binary loops.

## Interaction and hint contract

State values: `-1` unknown; `0` explicitly excluded; `1` one bridge/line; `2` a double bridge (Hashi only). A valid completed drawing may leave unused edges unknown. Every change has an immutable undo snapshot.

Hashi: select two neighboring islands to cycle a bridge; alternatively choose any route from the native select and use one-line/double/cross/clear buttons. Direction keys move island focus; Enter/Space selects islands; 1/2/X/0/Delete/Backspace modify the selected route.

Slitherlink: click an edge to cycle unknown → line → cross → unknown. Spatial arrow keys move focus, Enter/Space cycles, 1 draws, X/0 excludes, Delete/Backspace clears. Every edge is a native button with position and state in its accessible label.

Hints do not apply themselves. The user reviews the highlighted edge and clicks “采用这一步”. A deduction requires agreement across the complete bounded current-state solution set. An inconsistent-board repair is suggested only if clearing that mark restores a witnessed solution. Search exhaustion or unresolved ambiguity yields an honest unavailable message. Normal search has a hard ceiling of 50,000 nodes; hint search shares a total default 12,000-node budget, including repair trials.

`paused` blocks all state edits and hint/undo token effects. Tokens consumed while paused do not replay on resume. `resetToken` or `level` remounts an empty round with no history, stale hint or inherited token. `onComplete` fires at most once per mounted round, including under StrictMode; reset permits another completion.

## Stable test selectors

Hashi:

- `[data-hashi-board]` diagram
- `[data-hashi-island="INDEX"]` island buttons
- `[data-hashi-route]` native route select; select an edge index
- `[data-hashi-edge="INDEX"]` SVG group with `data-value` and `data-conflict`

Slitherlink:

- `[data-slitherlink-board]` diagram
- `[data-slitherlink-edge="INDEX"]` clickable edge with `data-value` and `data-conflict`
- `[data-slitherlink-cell="INDEX"]` clue label

Shared:

- `[data-network-action="1"]`, `"2"` (Hashi), `"0"`, `"-1"`
- `[data-network-apply-hint]` review-and-apply control
- scoped `[role="status"]` live feedback

## Verification

Run focused checks with the workspace memory limit:

```sh
NODE_OPTIONS=--max-old-space-size=512 npx vitest run tests/networkDeductionGames.test.tsx --maxWorkers=1
NODE_OPTIONS=--max-old-space-size=512 npx tsc --noEmit --incremental false
```

The test suite covers certificate validity/uniqueness, independent exhaustive comparisons, full hint-to-victory traces for all levels, budget/ambiguity honesty, malformed input, crossing/disconnection/multiple-loop rejection, immutable history, touch and keyboard controls, paused/stale tokens, reset/level switching, strict-mode completion, and all 24 certificates replayed through actual rendered controls.

Browser rendering/screenshots and full aggregate builds are intentionally delegated to integration CI; DOM checks do not replace browser visual QA.
