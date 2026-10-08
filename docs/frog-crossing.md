# 池塘过客 / Pond Crossing

Original Playgarden contribution, authored 2026-10-08. License: GPL-3.0-only.

## Mechanic and provenance

This implements general real-time crossing rules: a frog hops in four directions, avoids continuously moving vehicles, rides moving logs over water, and reaches each distinct goal pad. No external game source, commercial level pack, artwork, character, sound, font or brand asset was copied. It is an original implementation, not an upstream adaptation or a claim to have invented the general crossing genre. The code, authored stage data, CSS, inline geometry, card SVG and E2E scenario are GPL-3.0-only. The complete license is `public/frog-crossing-LICENSE.txt`, copied unchanged from the project license. No dependencies, external requests or audio assets were added.

This is different from the existing turn-based river passenger/conflict puzzle, automatic-forward runner, snake and paddle games: time moves each hazard lane independently, safe banks allow waiting, and the player is horizontally carried by a supporting log while choosing a two-dimensional route.

## Twelve authored stages

Each stage is a hand-authored lane sequence, with independent signed speeds, wrapping periods, vehicle/log lengths, phase positions, rest banks and destinations. Stages are not generated mirrors, rotations or reskins.

1. First ripple: a sparse road, rest bank, broad moving log and central destination.
2. Two-way lane: consecutive opposing roads, then a log approach to a right destination.
3. Two neighbours: river–bank–road–bank–river and two separate arrivals; introduces retained checkpoints.
4. Opposing currents: consecutive counterflow logs, with a landing bank beyond them.
5. Long and short: slow long vehicles alongside faster short vehicles.
6. Island picnic: alternating road and water, with two separated observation islands.
7. Upstream transfer: fast left current feeding a slower right current, then road and final current.
8. Uneven traffic: three contiguous roads with distinct periods/speeds and a river finish.
9. Three porches: three destinations, a two-current middle and final road.
10. Short rafts: three contiguous rivers with shorter, differently spaced support intervals.
11. Edge flowers: three destinations including both edges, requiring earlier positioning before logs leave the screen.
12. Evening visit: eight traversal lanes mixing road, river, rest island, opposing roads and final river.

These are 12 finite playable crossings, not a claim of solver-certified difficulty, uniqueness or optimality. Unlimited retries and the default 70% leisurely speed make timing forgiving. Standard pace is optional. There is no deadline or limited life count. Failed attempts preserve already-arrived frogs; the shell's restart clears the entire current stage.

## Lifecycle, controls and storage

- Four large labelled buttons, arrow keys or WASD. One press is one hop; keyboard repeat is ignored. Touch needs no swipe or drag.
- Logs continuously carry the frog. Collision checks use bounded 1/90-second substeps. Off-screen log drift and water landings fail visibly; entering an occupied or misaligned goal is rejected without removing earlier arrivals.
- Shell pause and explicit local rest freeze movement. Visibility loss, window blur or a frame longer than 250ms cause a local hold requiring explicit resume. No hidden-time catch-up is performed. Leaving/changing levels cancels the outstanding animation frame, with a local alive guard.
- Only versioned arrived-goal indexes are saved per stage, under `playgarden.frog-crossing.v1.round.<level>`. At most twelve small records exist; reads reject records longer than 256 characters, wrong stage/version, out-of-range/duplicate goals and full-stage saves. There is no persisted running timer, input buffer, location history or replay.
- Re-entry starts on the safe bank with retained arrivals. The shared shell owns completed-level progress and selected-level persistence. Storage failure does not stop gameplay and is shown after a failed checkpoint write.
- Decorative motion is absent; reduced-motion users see the same required gameplay motion. Labels, arrow directions and shapes supplement color. This is not a screen-reader or WCAG certification claim.

## Verification boundary

The contributor did not run tests, builds, installation or browser sessions. `e2e/frog-crossing.spec.ts` is delivered unrun for exactly one final targeted invocation through the existing desktop and touch-size projects. It uses real directional controls and rendered state to cover a road/water retry, log riding, first-stage completion, two distinct arrivals with lobby/reload checkpoint retention, shell pause, visibility/blur interruption, explicit resume without time jumps, mid-run stage navigation and corrupt checkpoint fallback. It previews the middle and final stages but does not sweep the campaign or import the engine to solve it.

The integration owner performs normal build/type/license checks and the targeted E2E. This document does not claim those checks passed, nor that real iOS/Android hardware or other browser engines were tested.
