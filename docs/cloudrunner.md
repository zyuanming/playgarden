# 云迹跑者 / The Sky Courier

A distinct realtime runner: three lanes, timed jump and slide, full-height lane blockers, collected lights, and genuine 90° route decisions. Six finite introductory routes count as six levels; endless mode, seeds and environments count as neither extra levels nor games. Catalog after this addition: 86 games, 2071 finite levels.

## Source and license boundary

Pinned upstream: https://github.com/markstent/runner/tree/22a0d0dd74f880025559235bf6139a85316da821 . MIT, Copyright (c) 2026 Mark Stent. Eight modules are directly copied/adapted under `src/vendor/cloudrunner/`; original editable snapshots are in `docs/upstream/cloudrunner/`, exact source hashes in `vendor/cloudrunner/source-manifest.json`. Full MIT license ships in the source and website and is linked in the UI. Unmodified player module remains MIT; upstream portions of adapted modules retain MIT, and Playgarden modifications/original contributions are GPL-3.0-only. Existing GPL/source links identify the exact deployed commit.

Actual reuse: the pure player state machine and pose; seeded chunk generation and seamless batch construction; conservative two-lane collision resolution; game phase/distance functions; score and safe storage factory; saturating difficulty curve; keyboard/swipe classifiers; oscillator/noise sound synthesis. This is code reuse, not an attribution for an independent rewrite.

Changes: row spacing 12→24, speed 20–40→14–28 u/s; low-gate clearance also requires actual jump height ≥0.85; local score key and invalid-score handling; original global input binders removed in favor of a bounded game-stage React pointer/keyboard shell; audio gets mute/dispose/error-safe initialization. Existing track `isClearable` remains an upstream limited full-block check and is NOT our fairness proof. Original comments describing upstream settings are historical; the constants and this change record are authoritative.

New original code: distance-based connected orthogonal world route, 28-unit turn-input window with direction correction, 44-unit obstacle exclusion around corners, fixed 120 Hz simulation, bounded retained entities/corners, six teaching routes, lifecycle handling, interface, perspective Canvas renderer, courier character and navigation SVG. No added runtime dependency.

Excluded: `public/avatar.glb`, `src/render/avatarModel.ts`, all externally sourced character/texture/audio/font files, and every Temple Run name/character/asset. The upstream BrainStem model has a separate Poser EULA and is not imported or accepted. No leaderboard, account, analytics, remote score upload, ads or game backend.

## Controls and interruption behavior

- Left/right or A/D: move one lane. Within 28 m of a route corner, the same directions queue the turn instead; the luminous arrow and button labels explicitly change.
- Up/W/Space: jump. Down/S: slide. Opposing vertical actions use the copied short input buffer; lane and vertical actions can be combined.
- Touch: one primary pointer, 24 px directional swipe, cancel clears. Four 44+ px buttons mirror the same actions. Keyboard is scoped to the focused game stage and never catches Ctrl/Meta/Alt, repeats or button keyboard activation.
- Esc/shared pause freezes simulation. Visibility loss, blur, or >250 ms frame interruption holds the run until explicit resume. No time catch-up; transient vertical buffer and pointer gesture are cleared; an already accepted route direction is preserved, so pausing immediately before a corner does not create an unavoidable fall. Every listener, animation callback and audio context is disposed on navigation/restart. Static screens avoid repeated scene drawing.
- A fall/collision ends the run, replay starts at zero. A completed lesson remains locked until shared restart or next lesson, matching shell completion. Realtime actions cannot be undone; the shared undo control is explicitly disabled for this game.
- Global mute includes generated effects. Endless best score is local-only; active realtime position is deliberately not persisted. Teaching completion is stored by the existing shell. Storage denial does not prevent play.

## Fairness and geometry

The generator still uses the actual upstream seven-pattern catalog, with 24-unit row spacing and at most 28 u/s. The 0.857 s minimum row interval exceeds a 0.6 s jump, a 0.5 s slide and two 0.12 s lane changes. Obstacles are excluded within 44 units of every corner. Batches include upstream breathing rows and 48 additional units between their final placement and next batch offset. Generation is bounded ahead and retains at most a small fixed route window. Existence of a safe route does not mean every late input can be rescued.

Collision uses the upstream conservative occupancy of both lanes during a 120 ms move; it is not exact pixel collision. The jump clearance threshold matches the original visible low barrier height; slide silhouette fits under the high-beam underside. World placement and camera use path distance; a turn changes world position and direction, not merely the lane label. Fixed substeps prevent a large legal frame from skipping the collision band. At a large external stall, UI holds instead of advancing.

The renderer is original Canvas perspective projection with vector polygons. It does not require WebGL or downloadable art; reduced-motion preference removes turn camera smoothing, but an active realtime runner necessarily still moves. No claim of physical-device certification, full screen-reader playability, full WCAG audit, universal offline-first cache, or guaranteed phone frame rate is made.

## Verification

Independent continuous collision-band and movement certificates are in `tests/fixtures/cloudrunnerLessons.json`, produced by a separately authored verifier; browser journeys replay them only through real keyboard, pointer gestures or visible buttons, with the browser clock controlling time. All six routes must finish on desktop and mobile. Browser tests also cover failure/replay, both turn directions and mistakes, pause/held lifecycle, modifiers, pointer cancellation, next lesson, mute, reduced motion, 320 px and landscape layouts. Production preview and actual public Pages checks repeat first/middle/final play, fixed license and deployed-SHA checks. Outcomes belong to their actual GitHub Actions commit, not to this plan.
