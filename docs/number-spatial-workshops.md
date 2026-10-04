# 分数拼盘 / 坐标寻宝

These two original games and their levels are covered by the repository MIT license (Copyright © 2026 YuanMing). No external source code, assets, runtime packages, network APIs or randomness were added. All copy is Chinese, and both games use the existing `GameProps` shell interface.

## Integration

| Proposed stable ID    | Component default export           | Level data                                                   | Category | Levels |
| --------------------- | ---------------------------------- | ------------------------------------------------------------ | -------- | ------ |
| `fraction-mosaic`     | `src/games/FractionMosaic.tsx`     | `fractionMosaicLevels` from `fractionMosaicLogic.ts`         | 数字推理 | 12     |
| `coordinate-treasure` | `src/games/CoordinateTreasure.tsx` | `coordinateTreasureLevels` from `coordinateTreasureLogic.ts` | 空间想象 | 12     |

The components each import `numberSpatialWorkshops.css`; all rules are scoped under `.nsw-game`. Their registry, catalog, shell and artwork integration is deliberately left to the integration owner. They use no game artwork internally.

Suggested short descriptions:

- 分数拼盘: 合并与等分有限材料，把每份分数配方装进托盘。
- 坐标寻宝: 用有限向量卡规划航线，收齐宝石并抵达终点。

## FractionMosaic

This is a resource-transformation planning game, not a multiple-choice quiz. The player selects physical fraction pieces, joins any two whose sum does not exceed one whole, splits a selected piece into two or three equal pieces, then delivers exactly one completed piece into each recipe tray. All stock must be used, and each cut spends a finite cutting allowance. Deliveries are reversible through undo; completed rounds are locked until reset or level change.

Exact arithmetic uses integer tile counts over the level denominator (4, 6, 8, 12 or 24). There is no epsilon, rounding or decimal comparison. Fractions are reduced only for display, e.g. 8/24 displays as 1/3. A split is legal only if its result consists of whole tiles. The table holds at most 10 pieces. These constraints are visible in the Chinese rules and disabled controls.

Exports from `fractionMosaicLogic.ts`:

- `fractionMosaicLevels`, `fractionMosaicSolutions`
- `createFractionState`, `validFractionBoard`, `fractionWon`
- `applyFractionMove` (pure transition or null), `fractionMove` (history-preserving transition), `undoFraction`
- `legalFractionMoves`, `searchFraction`, `fractionMoveLabel`, `formatFraction`
- `FRACTION_SEARCH_LIMIT = 12000`, `FRACTION_PIECE_LIMIT = 10`
- Types `FractionPiece`, `FractionMove`, `FractionBoard`, `FractionState`, `FractionLevel`, `FractionSearch`

Every level includes an exact ordered `solution` of piece-ID moves. Original recipe blueprints are compiled into deterministic, validated certificates when the module loads. Tests independently replay every certificate using BigInt conservation, then independently establish reachability with a separate ID-free multiset solver.

Current-state hints run bounded deterministic DFS over canonical piece multisets, filled trays and remaining cuts. The search never reads the stored certificate and returns `found`, `solved`, `unsolvable`, `limit` or `invalid`. A found path is a valid route, with no shortest-path claim. Only an exhausted search may claim impossibility; the UI reports uncertainty on a budget limit. Tests check every certificate prefix and every legal first move, including losing branches, against independent rules.

Selectors:

- Root `[data-number-spatial-game="fraction"]`
- Pieces `[data-fraction-piece="p0"]`, `data-units`, `aria-pressed`
- Trays `[data-fraction-tray="0"]`, `data-filled`
- Controls `[data-fraction-action="join|split-2|split-3|clear"]`
- Remaining cuts `[data-fraction-cuts]`

## CoordinateTreasure

This is immediate navigation with consumable vector cards. It does not edit or run a robot-program sequence. Select a card, preview its exact route and endpoint, then confirm using the action button or the highlighted destination tile. A card changes both coordinate components simultaneously. Cardinal and 45-degree vectors can span several cells; every intermediate grid cell must be inside the map and free of rocks. Gems are collected only on landing. The player wins after collecting every gem and stopping at the flag; spare cards are allowed.

The 12 original maps progress from positive coordinates on 4×4 boards to signed 7×7 coordinates, repeated cards, diagonal routes and six gems. Cards are sorted by vector instead of certificate order. Each board contains an independently checked original route and obstacle layout.

Exports from `coordinateTreasureLogic.ts`:

- `coordinateTreasureLevels`, `coordinateTreasureSolutions`
- `createCoordinateState`, `validCoordinateBoard`, `coordinateWon`
- `coordinateEqual`, `coordinateLabel`, `vectorLabel`, `insideCoordinate`, `coordinatePath`
- `applyCoordinateMove` (pure transition or null), `coordinateMove` (history), `undoCoordinate`, `searchCoordinate`
- `COORDINATE_SEARCH_LIMIT = 30000`
- Types `Coordinate`, `VectorCard`, `CoordinateLevel`, `CoordinateBoard`, `CoordinateState`, `CoordinateSearch`

Every `solution` is an ordered array of card indices. Independent tests walk each route cell-by-cell, check stock, collect only at endpoints and verify the final goal. A separate implementation of breadth-first search independently establishes the shortest distance on all levels and all legal first moves. Runtime bounded BFS searches the current position, collection mask and remaining counts, without reading any certificate. It returns the same five honest outcomes as the fraction search. UI hints only preview a suggested move; they never move automatically.

Selectors:

- Root `[data-number-spatial-game="coordinate"]`
- Cards `[data-vector-card="0"]`, `data-remaining`, `aria-pressed`
- Map `[data-coordinate-cell="-3,-3"]`, `data-preview`, `data-destination`
- Controls `[data-coordinate-action="move|clear"]`
- Status values `[data-coordinate-position]`, `[data-coordinate-collected]`

## Lifecycle and verification

Both components remount on `level` or `resetToken` changes. Pause freezes gameplay, consumes hint/undo token changes without queuing work, and retains selection. Undo restores one whole move, including all resources and collected/served objectives. Hints clear stale selections before presenting current-state choices. Completion is guarded by a per-round ref, including StrictMode and callback-identity changes; a new reset permits a new completion. Repeated action clicks do not reuse stale selection/state.

All controls are native buttons: touch/click, Tab, Enter and Space work without drag precision. Local feedback uses `role="status"` / `aria-live="polite"`; icon meaning and map cells have textual labels. Maps and stock layouts have mobile-scoped CSS, and all functionality has button-based keyboard access.

Verification commands (no dependencies installed):

```
NODE_OPTIONS=--max-old-space-size=384 npx vitest run tests/numberSpatialWorkshops.test.tsx --maxWorkers=1
NODE_OPTIONS=--max-old-space-size=384 npx tsc --noEmit --incremental false
```

69 focused tests cover all 24 certificate replays, independent solvers, actual UI solutions, invalid and exhausted resources, exact conservation, current-state and off-route hints, bounded-search uncertainty, undo/reset/level changes, pause/resume, native keyboard events, repeated clicks and StrictMode idempotence. TypeScript is checked across the available checkout. Full application build, browser rendering, screenshots and shell integration are not performed by this work unit.
