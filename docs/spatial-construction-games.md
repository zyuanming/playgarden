# Spatial construction modules

Original Playgarden source and authored levels, distributed under the repository's GPL-3.0-only license. No external assets, models, puzzle packs, or copied game code.

## Integration

- `src/games/VoxelViews.tsx`: default `VoxelViews(GameProps)`, suggested ID `voxel-views`, Chinese title **三视方块**, category 空间想象, 12 levels.
- `src/games/CubeNetWorkshop.tsx`: default `CubeNetWorkshop(GameProps)`, suggested ID `cube-net`, Chinese title **立方纸模**, category 空间想象, 12 levels.
- Both import `spatialConstructionGames.css`, `spatialConstructionRound.ts` and `SpatialConstructionScene.tsx` directly. No shared registry/App/type changes are needed within these modules.
- `voxelViewsLogic.ts` exports `voxelViewsLevels`, `voxelViewsCertificates`, `createVoxelBoard`, `validVoxelBoard`, `toggleVoxel`, `voxelWon`, `voxelProjection`, `voxelRay`, `voxelIndex`, `voxelCoordinates`, `solveVoxel`, `VOXEL_SEARCH_LIMIT` and related types.
- `cubeNetLogic.ts` exports `cubeNetLevels`, `cubeNetCertificates`, `createCubeNetBoard`, `validCubeNetBoard`, `placeNetFace`, `foldCubeNet`, `cubeNetWon`, `describeCubeNet`, `solveCubeNet`, `netNeighbors`, `oppositeNormals`, `NET_FACE_NAMES`, `CUBE_NET_SEARCH_LIMIT` and related types.

## Rules and progression

### 三视方块

Construct a binary voxel object in a 2³ or 3³ grid. Each target is the exact number of cubes along one axis-aligned ray; occluded cubes still count. This is explicitly labeled as a counting/tomography puzzle, not a silhouette-only projection. All three sets of counts must agree. There is no gravity/support restriction. Players edit individual positions on labeled z layers; each edit changes one front, side and top count. The first four levels introduce two-layer intersections; later levels add a third coordinate value, cavities, three-height constructions, a small number of locked reference cubes and unrestricted final reconstruction.

Certificates list filled voxel indices (`z*n*n + y*n + x`). Target arrays are independently stored literals, not calculated from certificates when the game loads. Any matching construction wins, not only the authored example.

Hints search extensions that retain the player's currently occupied cubes, using exact integer constraint propagation and binary DFS. Budget: at most **20,000 search nodes** and 27 binary cells. Hints identify an example compatible placement, not a logically forced move. Exhaustion reports uncertainty; an exhaustive failure says that keeping all occupied cubes is impossible and suggests removal/undo, not that the puzzle is unsolvable.

### 立方纸模

Place six uniquely labeled faces A–F on allowed cells of a 5×5 board. Fixed faces cannot move. The six squares must be edge-connected and fold at right angles into the six different cube faces. Later levels add one, two and finally three required opposite-face pairings. The first eleven certificates cover **all eleven geometrically distinct free cube-net shapes**; the twelfth is a label/board-constrained final challenge, not an extra claimed game or shape.

Certificates list A–F cell positions. Validation propagates signed integer orthonormal bases, detects inconsistent fold cycles and duplicate normals, then checks required opposites. No floating-point tolerances determine success. Alternate legal nets and labelings are accepted.

Hints enumerate connected cell sets, prune partial fold collisions and assign unplaced labels, preserving existing placements. Budget: at most **30,000 combined geometry/label nodes**. Found hints describe one compatible completion. If the current arrangement is impossible or the budget expires, a clearly labeled certificate-based repair may suggest collecting one misplaced face; it does not assert that the face is wrong in every possible solution.

## Controls and lifecycle

Click/touch and native Enter/Space activation; no dragging. Voxel arrows move between positions, PageUp/PageDown change layers. Paper-grid arrows move spatial focus, including blocked cells so that navigation does not skip geometry. Disabled/fixed/occupied destinations are guarded in pure reducers as well as the UI. Undo restores the previous construction; reset and level changes create fresh rounds. Paused hint/undo tokens are consumed without replaying on resume. Completion is guarded synchronously during actions and reported once per round, including StrictMode.

The optional Three.js view renders the actual current construction. Voxel layers use different colors. Paper faces use colors plus procedural dot counts 1–6 for A–F; the preview can switch between the current flat arrangement and a 90° folded view. Disconnected/inconsistent paper arrangements retain the flat view. Repeated-direction faces are reported as overlap. No hidden certificate model is used for rendering.

One renderer, two shared geometries and nine shared materials live for the mounted scene. Input changes replace mesh references without recreating the renderer or GPU resources. Unmount releases geometries, materials, render lists, renderer/context, observers and listeners. Context loss shows a DOM fallback and restoration redraws. There is **no requestAnimationFrame loop**, so pause, hidden tabs and reduced-motion preferences never leave animation running. The DOM controls and text checks are fully playable without WebGL.

## Stable QA selectors

- Root: `[data-spatial-game="voxel"]` / `[data-spatial-game="cube-net"]`.
- Voxel: `[data-voxel-cell="index"]`, `data-filled="0|1"`; `[data-voxel-projection="front|side|top:index"]`, `data-state="under|match|over"`; `[data-voxel-count]`.
- Cube: `[data-net-face="0..5"]` with `data-position="cell|-1"`; `[data-net-cell="0..24"]` with `data-face="A..F|"`; `[data-net-action="remove|clear|preview"]`; `[data-net-count]`; `[data-net-pair="face:face"]`; `[data-net-inspection]`.

## Verification scope

`tests/spatialConstructionGames.test.tsx` independently validates all certificates; exhaustively compares all 256 voxel boards for each 2³ level; enumerates all 35 free hexominoes against an independent rigid-hinge/Rodrigues coordinate oracle and finds exactly 11 valid nets; checks bounded searches, malformed states, alternative solutions and immutable updates; replays all 24 levels through DOM controls; and tests keyboard, pause/resume, undo, reset, hints and one-shot completion.

`tests/spatialConstructionScene.test.tsx` uses real Three.js geometry with a mocked WebGLRenderer to inspect actual scene content and verify persistent renderer/resource disposal, pause/visibility/reduced-motion safety, context loss/restoration, failed initialization and StrictMode cleanup. This is lifecycle verification, not a claim of actual GPU/browser screenshot testing.

Verified in this implementation pass: both focused Vitest files passed, **45 tests total**, with a 384 MB Node heap and `--maxWorkers=1`. Full repository TypeScript `tsc --noEmit` passed with a 512 MB Node heap. No browser, external installation, deployment or publication was performed by this module implementation.
