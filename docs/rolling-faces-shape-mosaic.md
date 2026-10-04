# 滚面旅程 / 拼片镶嵌

Original MIT modules. No downloaded meshes, textures, images, sounds, runtime network calls, example assets, installs, or additional packages. Three.js uses the project's existing pinned dependency. The modules follow the shared registry and shell contract.

## Integration

| Suggested game ID | Component                    | Level data                                        | Count |
| ----------------- | ---------------------------- | ------------------------------------------------- | ----- |
| `rolling-faces`   | `src/games/RollingFaces.tsx` | `rollingFacesLevels` from `rollingFacesLevels.ts` | 12    |
| `shape-mosaic`    | `src/games/ShapeMosaic.tsx`  | `shapeMosaicLevels` from `shapeMosaicLevels.ts`   | 12    |

Both components default-export the existing `GameProps` contract. All styles are scoped to their own root class. Reset/level changes remount their round. Existing nonzero hint/undo token values are remembered on mount rather than executed as new events. Paused hint/undo requests are consumed and never replay on resume.

Once completed, all mutating actions, including undo and remove, stay disabled until reset or level change. This keeps the internal goal state consistent with the existing shell's latched completion state. Content stays readable. `onComplete()` is guarded per mounted round, including StrictMode and callback identity changes.

## 滚面旅程: rules and independent verification

The cube has six labeled faces A–F. Every move is one orthogonal roll, with fixed world directions: x increases east, y increases south. North always means the top of the 2D map. The preview camera never rotates. The face tuple order is `[top, bottom, north, south, west, east]`; the initial tuple is `[A,F,B,E,C,D]`.

- A wall or board edge blocks a roll.
- A gate tests the **new bottom face after rolling in**. A gate can additionally require previously latched plate bits.
- A plate lights only when its required face is on the bottom. It remains lit afterwards.
- Winning requires the exit cell, the exit's bottom and north faces, and every plate.
- Reaching an already visited cell in a different orientation is a distinct state.

`searchRolling` performs complete current-state BFS. Level validation bounds the product to 30 walkable cells × 24 proper orientations × 8 plate masks = 5,760 states. The result distinguishes `solved`, `unreachable`, and `invalid`; there is no truncated search masquerading as a proof. Hints state a shortest continuation length and one next move, explicitly without claiming uniqueness.

The test oracle represents each labeled face as an integer normal vector and rotates vectors independently of the tuple permutations. It enumerates 24 orientations, checks every direction from every orientation, inverse rolls and four-roll identity, replays every certificate, and performs a separate BFS with a different neighbor order to verify shortest distances.

### Level progression

1. Two-step face prediction; worked tutorial.
2. A wall detour and repeated face tracking.
3. An annular route changes orientation at familiar positions.
4. A gate constrains entry face and changes the shortest route.
5. One latched face plate.
6. A plate-keyed face gate.
7. Two separated plates.
8. A gate and a loop behind the first plate.
9. Two plates, face gates, and a narrow extension.
10. Three plate targets and an oriented exit.
11. Two face gates with backtracking between three plates.
12. Three plates, two face gates, and a whole-board orientation route.

### Certificate schema

`RollingLevel` stores explicit `rows`, `start`, `exit: {x,y,bottom,north}`, `plates`, and `gates`. These are the problem. `certificate: {moves: RollDirection[], shortest: number, visited: number}` is a separately stored shortest witness and reference BFS visit count. Neither goal recognition nor current-state hints read the certificate. Certificate corruption is tested.

All authored BFS opening searches visit at most 1,512 states. Shortest lengths are 2, 6, 9, 11, 7, 6, 8, 11, 12, 16, 18, and 13. Level ordering teaches added rule combinations; it does not claim monotonically increasing shortest path length.

### Three.js resource ownership

`RollingFacesScene` uses procedural box geometry, six self-drawn canvas letter textures, and scene-owned materials. A rotation basis is reconstructed from actual labeled-face state and applied to the cube, and its actual x/y map position is reflected in the preview. It is not a decorative looping cube.

Rendering is on demand only: no timer, easing, animation frame, or continuous animation. Reduced motion is inherently honored, with CSS animations/transitions also disabled under the media query. Pause suppresses drawing. Resize and visibility listeners are removed, ResizeObserver is disconnected, textures/materials/geometry and renderer are disposed, and the canvas is removed on unmount. Context loss switches to the authoritative fallback and cleanup remains safe. The mocked-renderer suite verifies actual position and orientation basis, pause/resume, creation failure, context loss, disposal, listeners, and StrictMode remounts.

The complete 2D map, six-face diagram, explicit plate list, gate list, exit requirements, predicted bottom labels, and four direction buttons remain playable without WebGL.

## 拼片镶嵌: rules and exact-cover proof

Use every labeled piece exactly once to fill the explicit irregular region. Pieces may rotate in quarter turns. Reflection is permitted only for pieces marked `可翻面`. Holes cannot be filled; overlaps and out-of-region cells are rejected. A valid final tiling is accepted whether or not it matches the authored certificate.

An orientation is normalized to its bounding box. The anchor is its first occupied cell in row-major order, not a possibly empty bounding-box corner. The preview marks that occupied cell with ★. Selecting a piece, rotating/flipping it, and clicking an anchor cell requires no dragging. R/F and number shortcuts supplement ordinary button operation; the board supports arrow focus navigation and Enter/Space placement.

A new placement replaces that same piece atomically **only after** the entire candidate board is validated. An invalid replacement returns the unchanged original state and history. Selecting/rotating an already placed piece is a preview; the old position remains in place until a legal replacement. Remove is an explicit undoable action.

`searchMosaic` builds legal placement domains with exact-cover constraints on both cell inventory and piece inventory. It preserves all placed pieces and chooses a most-constrained uncovered cell. Levels are bounded to 36 cells, 9 pieces and at most 8 distinct orientations per piece. Search has a hard 100,000-node cap and returns `solved`, `unreachable`, `limit`, or `invalid`.

`mosaicHint` first finds one continuation. It then excludes the proposed placement and searches again with **only the remaining portion of the same 100,000-node budget**. Only complete exhaustion of that alternative search permits the word `必然`. A found continuation, an alternative found, and budget exhaustion never falsely establish a forced move. Dead ends and budget exhaustion have different explicit copy.

The independent verifier uses affine matrices and coordinate sets rather than the production transforms/placement functions. It checks permitted orientation inventories, exact region coverage, one use per piece, no overlap, no missing cells, and every certificate. A separate piece-first exhaustive solver validates small-board possibilities, dead ends and forced-hint claims. Alternate valid tilings are independently enumerated and replayed through rendered controls. Chiral L tetromino fixtures distinguish rotations from forbidden reflections.

### Level progression

The 12 hand-drawn layouts have 7, 12, 12, 18, 18, 23, 28, 27, 34, 34, 33 and 34 cells, using 2–9 labeled pieces. They progress from a worked asymmetric corner to an internal hole, long-arm pockets, mixed reflection permissions, forbidden-reflection shapes, multiple holes, concave outer boundaries, nine-piece packing, bottlenecks and whole-region cavity planning. Later copy names a planning principle without exposing a full placement sequence.

### Certificate schema

`MosaicLevel` contains explicit `rows` and `pieces: {label,cells,reflect}[]`. Each certificate holds `placements: {piece,orientation,x,y}[]` and `nodes`, a reference opening-search count. The placement array is indexed by piece inventory index. `orientation` indexes the stable deduplicated rotation-then-reflection inventory. `x,y` are the star anchor, not the bounding-box origin.

The authored layout is one witness only. Current-state validation/search does not derive target regions or piece definitions from its placements. A damaged or empty certificate cannot change goal recognition or hint output. All opening searches solve within 113 nodes in this fixture set; the full cap still applies to player-created partial boards.

## Stable selectors for browser checks

### RollingFaces

- Root: `[data-rolling-faces-game]`
- State: root `data-rolling-position="x,y"`, `data-rolling-orientation="051423"`, `data-rolling-plates="0"`, `data-rolling-won="true|false"`
- Direction buttons: `[data-roll-direction="N|E|S|W"]`
- Walkable cell: `[data-rolling-cell="x,y"]`
- Keyboard board: role `group`, accessible name starts with `可操作地图`
- Face diagram: accessible name `当前立方体六面图`

Replay `rollingFacesLevels[level].certificate.moves` by clicking each direction button. Completion is read from the goal-derived data attribute, not inferred from exhausting the sequence.

### ShapeMosaic

- Root: `[data-shape-mosaic-game]`
- State: `data-mosaic-selected`, `data-mosaic-orientation`, `data-mosaic-placed`, `data-mosaic-won`
- Inventory: `[data-mosaic-piece="0"]` etc.
- Actions: `[data-mosaic-rotate]`, `[data-mosaic-flip]`, `[data-mosaic-remove]`
- Anchor cell: `[data-mosaic-cell="x,y"]`
- Rendered cell owner: `data-mosaic-owner="A"` (or empty string)

To replay each certificate placement, select its inventory button, navigate from orientation 0 using the rotate/flip controls, then click the anchor. The helper in `tests/shapeMosaic.test.tsx` finds a short control sequence for each permitted orientation; it never edits component state or storage. All-level test replay verifies every actual button interaction.

## Verification in this isolated checkout

- `NODE_OPTIONS=--max-old-space-size=384 npx vitest run tests/rollingFaces.test.tsx tests/shapeMosaic.test.tsx tests/rollingFacesScene.test.tsx --maxWorkers=1`: 70 passed.
- `NODE_OPTIONS=--max-old-space-size=512 npx tsc -b`: passed.
- All 24 levels replayed through rendered React controls in jsdom.
- Includes pause/resume, reset, level switch, immutable undo, invalid relocation preservation, current-state hints, keyboard/focus, alternative tilings, StrictMode and one completion per round.
- Touch targets have an explicit 44px minimum; largest six-column boards fit a 289px inner width. Color is always accompanied by face/piece letters, stars, symbols or text.
- No browser/socket or remote operations were attempted in this task. Actual browser screenshots, production bundling and aggregate integration tests remain integration gates; jsdom and mocked WebGL checks are not represented as real-browser visual QA.
