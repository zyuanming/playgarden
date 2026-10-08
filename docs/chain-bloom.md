# 连锁花火 / Chain Bloom

An original GPL-3.0-only implementation of generic one-shot chain-reaction mechanics. No third-party game code, levels, imagery, music, fonts or source assets were copied. `public/chain-bloom-art.svg` and the in-game SVG/CSS are original programmatic artwork. The repository GPL and `public/chain-bloom-LICENSE.txt` contain the full license.

## Rules and geometry

Observe bouncing seeds in a 640 × 420 logical arena. Choose a point, then explicitly ignite exactly one initial bloom. Clicking the field only updates a cancellable preview. A bloom grows from radius 4 to its maximum over 0.8 simulation seconds, stays full for 0.9 seconds, and shrinks for 0.8 seconds. The initial maximum radius is 82; subsequent blooms use the level's disclosed geometry (62–72). A seed's radius-6 collision disk touching any live bloom triggers it exactly once, freezes its position, and creates its own bloom. Seed appearance is cosmetic; colors are not match conditions. A round ends when the final bloom expires, and succeeds when the triggered count meets or exceeds the target. The interface keeps showing the whole chain even after the target is reached. Retries are unlimited and restore exactly the same routes.

There is no timed deadline while observing. This is an intentionally real-time placement/timing game, not a grid toggle, number puzzle, clicker or color matching reskin. It has twelve finite authored stages, not twelve different games. There are no random layouts, mirrored copies or target-only duplicated layouts.

## Twelve authored teaching layouts

1. 第一朵花: compact central group; target 5 of 8; learn growth and propagation.
2. 一条花径: opposed shallow horizontal routes; target 7 of 9; propagate in two directions.
3. 等风相遇: inward-facing swarms; target 8 of 10; wait for a bridgeable gap.
4. 斜向交会: two diagonal streams and lower arrivals; target 8 of 11; predict a crossing.
5. 会反弹的风: staggered right-wall approaches; target 9 of 12; use reflected routes.
6. 小桥不能断: two clusters joined by a sparse moving bridge; target 10 of 12; protect continuity.
7. 一圈花环: a hollow perimeter with tangential motion; target 11 of 13; avoid starting in empty space.
8. 接住快车: fast crossing routes and a slower middle; target 10 of 13; ignite ahead of arrivals.
9. 三处花田: three inward-moving groups; target 12 of 14; coordinate convergence.
10. 错开的节拍: counterflow rows with offset bridges; target 12 of 15; exploit overlap timing.
11. 留住接力窗: smaller bloom radius and angled relay groups; target 14 of 17; choose the window.
12. 满园相逢: four approaches and four central relays; target 17 of 20; combine the lessons.

Authored intent is not a claim of automated solvability proof. No sweep, solver, unit test, browser session or build was run by this module contributor under the user's fast-iteration instruction. The integrating owner owns the ordinary build and one final targeted E2E invocation. The E2E plays the first stage via real controls and checks interruption/retry/restore; it does not certify all twelve stages.

## Controls, lifecycle and persistence

- Mouse or touch: tap field to preview; the distinct “点燃这朵花” button commits. A canceled or moved pointer gesture cannot ignite a wave. No pointer capture or global pointer-move listeners are used.
- Keyboard: focus the arena, arrows adjust by 12 logical pixels, Enter/Space ignites, C clears selection. Modifier shortcuts do not ignite. Visible directional buttons provide the same path on touch.
- Pause can be used to study routes and move the preview. Resume is required to ignite. Shell pause, local pause, hidden document and window blur freeze simulation. Backgrounding requires an explicit local resume.
- A requestAnimationFrame loop uses a 50 ms frame cap and at most six 1/120-second physics microsteps per frame. There are at most 20 seeds and 21 active blooms, and no recursive or per-seed timers. Restart, level change, navigation and unmount cancel the old loop. Finished attempts stop scheduling frames.
- Round snapshots use `playgarden.chain-bloom.v1.round.<level>`, and are saved approximately each simulation second, on interactions, pauses and exit. Restores are held paused. Corrupt, oversize, nonfinite, impossible-count or route-mismatched data is discarded. Storage failures are caught and shown without blocking play. Shell `freshStart` prevents stale storage from overriding explicit restart.
- Completion and selected-stage progress use the existing shell's own local browser storage. There is no network, account, ads, analytics, leaderboard, sound or external asset load.

## Integration and final verification

Register `chain-bloom`, 12 stages, `allowUndo: false`, and `resumeKey: "playgarden.chain-bloom.v1"`. Use the supplied SVG artwork and default component `ChainBloom`. Shared shell undo is disabled because reversing a live wave is not a game action; the forgiving retry control replaces it.

The unrun `e2e/chain-bloom.spec.ts` covers a failed corner placement, pointer cancellation, retry, actual central-chain victory, local/shell/background pause, keyboard aim, correct resumed snapshot, explicit reset, touch target sizes, horizontal overflow and post-navigation errors. The existing two Playwright projects cover desktop and touch-size Chromium. This is not real-device, screen-reader, Firefox, Safari or comprehensive accessibility verification.
