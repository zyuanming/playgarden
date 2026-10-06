# Rectangle Garden and Forest Campsite

> Historical 12+12 module report. Shikaku now preserves these twelve and appends 188 levels; see [the 200-level campaign report](shikaku-campaign.md). Tents now also preserves its twelve and appends 188 levels; see [the Tents campaign report](tents-campaign.md).

Two original GPL-3.0-only modules, with 24 newly authored puzzles. No imported puzzle banks, libraries, artwork, network calls, timers, or runtime randomness. The inline tree/tent SVGs and styles were created for these modules.

## Integration

- Suggested ID/title: `shikaku` / `矩形花园`.
- Suggested ID/title: `tents` / `林间帐篷`.
- Each has 12 levels and a default component accepting the unchanged `GameProps` contract.
- Import `ShikakuGarden` from `src/games/ShikakuGarden.tsx` and `TentsGarden` from `src/games/TentsGarden.tsx`.
- Level/certificate exports: `shikakuLevels`, `shikakuSolutions` from `shikakuLogic.ts`; `tentsLevels`, `tentsSolutions` from `tentsLogic.ts`.
- Shared module-local stylesheet: `src/games/regionCamping.css`; every selector is scoped under `.rc-layout`.
- No registry, catalog, App, package, global stylesheet, or existing game was changed by this module work.

### Rule details

Shikaku: cover every cell with non-overlapping rectangles. Each rectangle must contain exactly one clue, and its area must equal that clue. Click two opposite corners to draw; click a placed rectangle to remove it. Invalid areas, overlapping placements, or multiple-clue rectangles are rejected without changing history. Locally valid but globally incorrect rectangles remain editable and get honest contradiction hints.

Tents: place one tent per tree, with an orthogonally adjacent one-to-one matching. Extra adjacency to another tree is allowed when a bijection exists; the player need not draw matching edges. No two tents touch, even diagonally. Every row and column has an exact target. Grass marks are notes; unmarked non-tent cells do not prevent completion.

## Certificates

Authoring source: `tests/fixtures/generateRegionCamping.py`, a deterministic Python generator seeded with `202610041647`. It constructs partitions/tent layouts and keeps only uniquely solvable public clue sets. Generated static data are in `shikakuLevels.ts` and `tentsLevels.ts`. The `solution` fields and exported certificates are **never used by runtime solving, validation, hints, or UI**.

Independent validation is in `tests/regionCampingGames.test.tsx`:

- Shikaku enumerates every coordinate rectangle and assigns one per clue; runtime instead enumerates factor-based candidates and branches on an uncovered cell.
- Tents assigns one adjacent tent to each tree and deduplicates complete layouts; runtime instead enumerates row bitmasks and independently checks a bipartite matching.
- Neither test certificate uses production solver, candidate, adjacency, matching, or validation helpers.
- Every authored board has exactly one rectangle tiling or tent placement. This does not assert uniqueness of a tree/tent matching where multiple assignments yield the same legal tent placement.

| Level | Shikaku size | Independent nodes | Runtime nodes | Tents size | Independent nodes | Runtime nodes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 3×3 | 4 | 4 | 4×4 | 4 | 5 |
| 2 | 3×3 | 5 | 5 | 4×4 | 4 | 5 |
| 3 | 4×4 | 16 | 6 | 4×4 | 8 | 5 |
| 4 | 4×4 | 16 | 7 | 5×5 | 11 | 8 |
| 5 | 5×5 | 40 | 8 | 5×5 | 11 | 16 |
| 6 | 5×5 | 46 | 10 | 5×5 | 9 | 16 |
| 7 | 5×5 | 74 | 12 | 6×6 | 20 | 20 |
| 8 | 6×6 | 98 | 12 | 6×6 | 29 | 42 |
| 9 | 6×6 | 149 | 11 | 6×6 | 27 | 45 |
| 10 | 6×6 | 172 | 12 | 7×7 | 79 | 48 |
| 11 | 7×7 | 307 | 16 | 7×7 | 33 | 20 |
| 12 | 7×7 | 266 | 17 | 7×7 | 32 | 49 |

Sizes and the number of regions/trees grow across the pack. Search-node counts are correctness/performance evidence, not a claim that human difficulty increases strictly at each level.

## Limits and hint guarantees

- Maximum board dimensions: Shikaku 7×7; Tents 7×7.
- Maximum 50,000 search nodes, 128 retained solutions; explicit `complete`, `limit`, `budget`, and `invalid` results.
- Both hint functions first solve from the **current** rectangles/marks. A deduction requires agreement across all enumerated solutions, and enumeration must be complete.
- On contradictory states, hints attempt one retraction that demonstrably restores at least one complete solution. All these checks share the same total 50,000-node hint budget. If no single retraction is certified, the hint explicitly calls the retraction an exploratory repair and does not label it the unique error.
- Ambiguous and budget-limited positions never masquerade as proven deductions. The tests deliberately replace answer certificates with empty arrays and solve every authored level using hints.
- Undo retains the most recent 300 mutations. Invalid moves and no-ops do not create snapshots. Level/reset-token changes remount clean state.
- Paused rounds block mouse/touch, keyboard, apply-hint, and undo changes. Hint/undo tokens arriving while paused are consumed and are not replayed on resume.
- Completion is idempotent for a round, including StrictMode and undo/replay. A reset starts a new completion lifetime.

## Automation selectors and controls

Both modules:

- Root: `[data-region-game="shikaku"]` or `[data-region-game="tents"]`.
- Completion state: root `data-complete="true"`.
- Hint: `[data-region-hint="deduction"|"repair"|"unavailable"]`.
- A visible `role="status"` contains local feedback. Every board cell has a Chinese row/column/state accessible name.

Shikaku:

- Cells: `[data-shikaku-cell="0"]`, row-major zero-based indices.
- Cell `data-region` is the placed-region array index, or `-1`.
- `[data-region-count]` records the number of placed regions.
- `[data-anchor]` is the first selected corner, or the empty string.
- Arrow keys move focus; native Enter/Space select a corner or remove a region. Delete/Backspace remove the focused region; Escape cancels an active corner selection. Visible buttons include `取消选角`, `采用这个矩形`, and `撤回这块矩形`.

Tents:

- Cells: `[data-tents-cell="0"]`, row-major zero-based indices.
- Cell `data-value` is `-1` unknown, `0` grass, or `1` tent; `data-tree="true"` identifies fixed trees (stored as zero).
- Counts: `[data-tents-clue="row-0"]` or `column-0`, with `data-count` showing the current tent count.
- Arrow keys move focus; Enter/Space cycle marks; T/1 place a tent; X/G/0 mark grass; Delete/Backspace clear. Visible selected-cell controls: `搭帐篷 T`, `草地 X`, `清空`. Hint actions: `采用这一步` / `清除这个标记`.

## Verification

Passed on the final implementation:

```sh
NODE_OPTIONS=--max-old-space-size=384 ./node_modules/.bin/tsc --noEmit --incremental false
NODE_OPTIONS=--max-old-space-size=384 ./node_modules/.bin/vitest run tests/regionCampingGames.test.tsx --maxWorkers=1
```

52 focused tests passed. Coverage includes all 24 independent unique-solution certificates, malformed inputs, budgets, ambiguity, matching failures despite adjacency, immutable bounded history, poisoned certificates, complete click-only play of all levels, keyboard focus/native activation, pause/token consumption, reset/level switching, hints, invalid moves, and once-per-round completion.

No aggregate build, new dependency installation, browser run, publication, or registry integration was performed in this module task. Responsive styles are implemented; real-browser and touch-device visual validation remain integration work.
