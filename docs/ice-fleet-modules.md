# IceStops and FleetLogic

Original Playgarden modules and fixtures, GPL-3.0-only licensed. No imported game code, graphics, assets, network service, or package additions. Registry/catalog integration is intentionally outside this module contribution.

## Integration

- `IceStops.tsx`, default export, accepts the shared `GameProps`; 12 zero-indexed levels from `iceStopsLevels.ts`.
- `FleetLogic.tsx`, default export, accepts the shared `GameProps`; 12 zero-indexed levels from `fleetLevels.ts`.
- Each imports only its own stylesheet and pure logic/level modules, plus React and shared types. Out-of-range level indices fall back to level one.
- Level/reset changes remount round state. Tokens received during pause or after completion are consumed without replay. Completion is read-only until reset/level change; `onComplete` fires once per round, including StrictMode. Undo stores immutable snapshots and cannot reopen a finished round.

## IceStops: movable stopping points

Three labeled pucks A/B/C slide all the way along a cardinal direction until the next step would hit a wall, edge, or another puck. The other pucks are movable stopping points. A target is just a labeled destination: it neither arrests a crossing puck nor freezes a parked one. The win condition matches each puck to its own target. It is not a one-step walking, pushing, or traffic-lane game.

Twelve authored map geometries introduce walls, borrowed stops, moving a puck back off its target, ring lanes, crossing corridors, interior parking, and the final completely open 6×5 rink. Certified shortest routes are 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, and 15 slides. The first is a wall-stop tutorial; subsequent certificates use the other pucks as stops. Level four explicitly moves an already parked puck again.

### Data and solver contract

`IceProblem`: `id`, `title`, `lesson`, rectangular `rows` (`.` ice, `#` wall), `start: [A,B,C]`, `goals: [A,B,C]`. Cells are row-major integers. Width/height ≤6 and walkable cells ≤30; all three starts and all three targets are distinct walkable cells.

`IceLevel.certificate`: `moves: {puck: 0|1|2, direction: N|E|S|W}[]`, `shortest`, `visited`. Neither movement, completion, nor hint generation reads this certificate. Corrupting it cannot change the game's answer.

`searchIce` runs complete BFS, with all 12 actions and no heuristic pruning or budget cutoff. At most 30×29×28 = 24,360 labeled states are possible. It returns `solved`, `unreachable` (only after exhausting reachable states), or `invalid`. Initial fixture searches visit 89–12,762 states; a Node 24 smoke timing measured approximately 1–30 ms per initial search in this environment. These are engine timings, not browser responsiveness measurements. An actual-state hint returns one shortest continuation and explicitly does not call it the unique route. Hinting does not move a puck.

### Controls and selectors

- Click/focus a puck, then use the four direction buttons or arrow keys. Digits 1/2/3 select A/B/C while the board has focus.
- Puck DOM keys remain stable when grid coordinates change, preserving keyboard focus. A viewport-only horizontal reveal follows the selected puck after moves or selection changes without changing focus or scrolling the document.
- `data-game="ice-stops"`, `data-ice-won`, `data-ice-puck="0|1|2"`, `data-position`, `data-ice-direction="N|E|S|W"`, `data-ice-moves`, `data-ice-status`, `data-ice-viewport`, `data-ice-goal-legend`, `data-ice-goal`.
- A persistent A/B/C goal legend gives all target coordinates even when a puck covers a target. Labels describe wall/ice/goal cells and each puck's current row/column and underlying target, including another puck's target. Colors supplement letters. Controls and pucks have 44 px minimum touch targets; narrow layouts have a visible horizontal-scroll cue and allow board scrolling rather than shrinking the targets. Browser Ctrl/Command/Alt shortcuts are never consumed. Disabled content remains legible.

## FleetLogic: reconstruct a hidden fleet

Mark each cell as unknown, ship, or sea. The clues supply row/column ship-cell counts, a complete fleet inventory, and fixed sea/ship fragments. All vessels are straight; different vessels must have a one-cell gap, including diagonally. Players edit the whole board, not a displayed answer.

The twelve authored fleets progress from 4×4 count and zero-row reasoning to 5×5 and 6×6 mixed fleets. Lessons cover endpoint orientation, three-cell middles, singleton halos, subtracting known ships from totals, identical-length ships, and combined deductions. The final inventory has two length-three ships, one length-two ship, and three singletons. All twelve occupied boards are unique under their explicit clues.

### Data and solver contract

`FleetProblem`: `id`, `title`, `lesson`, square `size` (2–6; authored levels 4–6), `fleet` (≤6 ships, each length 1–3), `rowTotals`, `colTotals`, and distinct fixed `clues: {cell, fragment}[]`.

Fragment vocabulary: `sea`, generic `ship`, `single`, `N/E/S/W` outward-pointing endpoints, `middle-h`, and `middle-v`. For example `N` means the north end of a ship which extends south. Visual symbols have equivalent textual accessible labels.

`FleetLevel.certificate`: `occupied` row-major cell indices, `unique: true`, `nodes`. The explicit puzzle counts and clues are not derived from this certificate at runtime. `checkFleet` checks the actual player's board against totals, fragment geometry, connected straight components, diagonal exclusions, and inventory. Any alternative valid board passes if a custom puzzle admits one. Completion requires no unknown marks.

`solveFleet` enumerates ship placements with residual row/column capacity pruning, occupied/halo exclusion, fixed-fragment compatibility, and current sea/ship marks. Identical lengths use increasing placement indices; a set additionally deduplicates by occupied board. Default is at most two solutions, with a hard 200,000-node ceiling. Results distinguish:

- `complete`: search exhausted; zero solutions proves contradiction, one proves uniqueness.
- `solution-limit`: enough witnessed solutions, without a uniqueness claim.
- `budget`: inconclusive, even if no solution was encountered.
- `invalid`: outside the supported input domain.

Authored initial puzzles require only 3–41 CSP nodes and measured under 2 ms each in a Node 24 smoke run here. Partial user marks only restrict the original constraints. A unique exhaustive continuation can justify a forced cell; multiple solutions produce an explicitly optional candidate; budget exhaustion never claims impossibility or forcedness. Hints are computed from the current marks and never auto-fill a solution.

### Controls and selectors

- Ship/sea/unknown brushes. Click to paint; fixed clues are read-only.
- Roving keyboard focus: arrows move across cells, S marks ship, W marks sea, U clears, Enter/Space use the selected brush. Fixed clues remain keyboard-readable. Selected cells are explicitly revealed inside the horizontal board viewport; focus is not moved by hints. Browser Ctrl/Command/Alt shortcuts are not consumed.
- “其余标海水” marks all unknown cells as sea in one undoable operation; it does not consult the answer. “核对海图” reports unsatisfied rules.
- `data-game="fleet-logic"`, `data-fleet-won`, `data-fleet-cell`, `data-mark`, `data-clue`, `data-fleet-brush`, `data-fleet-row`, `data-fleet-column`, `data-fleet-fill-sea`, `data-fleet-check`, `data-fleet-status`, `data-fleet-viewport`.
- Inventory chips state vessel lengths/counts; edge labels include current and required counts. All clickable controls/cells are ≥44 px, using horizontal scrolling and a visible scroll cue on narrow screens. Paused and completed boards retain readable content.

## Verification design

`tests/iceStops.test.tsx` uses a geometric ray-blocker oracle independent of the production stepper, an independent BFS shortest-distance check on every fixture, exhaustive transitions on the small tutorial board, and explicit crossing-target, parked-puck, unreachable, invalid, corruption, and immutable-history checks.

`tests/fleetLogic.test.tsx` uses independent occupied-component geometry and king-distance separation checks. Its uniqueness solver enumerates row bitmasks rather than ship placements; this counts occupied boards without interchangeable-ship permutations. Tests cover every fixture, one-cell certificate corruption, alternative valid solutions, malformed fleets/marks, wrong inventory, bent/diagonally touching ships, fragment mismatches, actual-state contradictory and forced hints, and budget exhaustion.

Both files contain complete DOM journeys for every level: reset, edits/moves, immutable undo, pause/token consumption, hint without auto-solving, successful completion exactly once, post-completion read-only behavior, and another reset. Dedicated user-event keyboard tests verify focus continuity. Synthetic-geometry regressions check horizontal reveal without page/vertical scrolling, a covered target on IceStops level four, and modifier shortcuts retaining their browser defaults. These are jsdom DOM tests, not real-browser layout, touch, or visual QA. No claim is made of actual-browser verification in this module contribution.

### Final isolated verification

- 67 focused tests passed in two files (4.42 seconds): all 24 authored DOM journeys, independent rule/search oracles, target-visibility, modifier-shortcut and synthetic-viewport regressions.
- Full isolated-checkout `tsc -b` passed. Checks ran serially with Vitest `--maxWorkers=1`, 384 MB heap, and TypeScript 512 MB heap.

## Known boundaries

- Finite authored puzzle sets, no procedural level generator, user-created puzzle editor, external game engine, or remote storage.
- Engine search runs synchronously. The measured authored searches are short; the maximum synthetic Fleet CSP budget is a safety cap rather than a frame-time promise. If the supported puzzle dimensions are enlarged, revisit both domain validation and scheduling.
- Registry/catalog wiring and actual-browser responsive checks are validated in the full project.
