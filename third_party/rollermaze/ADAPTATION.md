# Rollermaze: complete original 25-map integration

Original: Jasper Renow-Clarke (picosonic), 2024, MIT.
Pinned source: https://github.com/picosonic/js13k-2024/tree/2a08f83fa3935fc981ac6efce26e2b9d6d34a5ed

All 25 original `assets/level1.tmx`–`level25.tmx` and the byte-identical `levels.js` are included. Map identity is checked by parsing data, not by solving campaigns. The original cuboctahedron, tree, sentinel and aircraft meshes, checkerboard generation, camera, 2-unit movement, 13-second route clock, nearest-button rule, reset spots, collision/return-to-start rule, 0.04 sentinel chase speed and native celebrations are retained. This is a timed continuous rolling/route-planning game, distinct from the host's turn-based rolling-face/block puzzles.

## Rights and exclusions

`original/` preserves the exact permitted source bytes; SOURCE-MANIFEST lists upstream Git blobs, sizes and SHA-256. MIT copyright and full license are preserved. `w.js` credits xem's MicroW; official pinned README explicitly dedicates it to the public domain, reproduced with provenance. Its adapted renderer reuses two WebGL buffers instead of allocating two buffers per object per frame; shaders are validated and released after linking. Geometry/shading rules remain unchanged.

The upstream README calls the 4×8 font Repton-inspired and identifies Schubert's composition as public domain, but the repository does not independently identify the font design or particular MIDI arrangement. `font.js`, `music.js`, `assets/trout.mid`, the editor tile image and all promotional/development screenshots are excluded, including from this source distribution. Original index.html is retained only as source provenance and references those omitted original files; it is not the runtime entry point. System monospace text and newly authored simple sine feedback replace them. The cover is an original SVG diagram, not an upstream promotional image. The upstream README mentions the omitted resources and its original credits; that is documentation, not a bundled asset or a claim about its rights.

## Integration boundaries

The original classic scripts are wrapped in one closure and an opaque-origin `sandbox="allow-scripts"` iframe. No host storage or DOM access, external requests, orientation sensor, upstream dependencies or build tools are required. Parent/frame messages verify WindowProxy, opaque frame origin at the host, session nonce and fixed revision. Observability exposes cloned read-only snapshots, no completion API.

Only actual entry into a forest tile emits a completion event. Selecting any level or directly visiting level 25 does not award credit. The original five-second next-level transition requests host-owned selection; the final scene remains visible and distinguishes finishing the last map from earning all 25. No success, board, timer or input sequence is injected into a game session.

A game-owned RAF queue supplies a logical clock to the adapted original timeline/clock calls without monkey-patching browser globals. Pause/hidden state freezes callbacks and time; resume discards background elapsed time. Pointer up/cancel/lost capture, real window blur, pause, remount and exit release input. Disposal cancels RAF/timelines and closes the owned AudioContext/WebGL context. Old decorative timelines are stopped on level reload. Original keyboard and cardinal-drag controls remain; accessible host direction buttons send the same directional actions. A keyboard-activated button tap waits for an eligible native logic update, then releases only its own added key bits; it is never released merely because a high-refresh paint callback occurred. Unsupported WebGL or blocked resources show a retry state.

Only earned map indices are stored in `playgarden.rollermaze.native.v1`; no mid-run positions, timers or NPC state are saved. Host selection/badges remain host-owned. Failed/corrupt storage is reported; a short-lived same-session receipt preserves already-earned indices across remounts but is cleared on lobby exit. R and host restart reset the current original level without deleting earned indices.

## Build and source distribution

In a complete Playgarden checkout, use its official locked `npm ci`, then `npm run build`. `node scripts/rollermaze/build.mjs` validates source rights/map identities, concatenates the inspected sources in explicit order, syntax-checks the result and produces `public/games/rollermaze/runtime.js` plus a deterministic `source.tar.gz`. It does not install or execute the upstream project/build scripts and requires no new runtime dependency. New adapter, host, cover and build tooling are GPL-3.0-only; original files retain MIT and MicroW provenance.

The archive includes the preferred original/adapted/bridge source, host component/style, runtime entry/CSS/cover, exact host lock/build context and the focused E2E journey. It is the complete game module source, not a copy of the entire host app. Full host source: https://github.com/zyuanming/playgarden .

## Bounded verification

`npm run build` is the required typechecked host build and source/license verification. One `npm run test:e2e -- e2e/rollermaze.spec.ts` invocation covers real desktop and touch controls, a genuine first-map finish, button/blocked-path interaction, safe-spot refill, sentinel collision, timer failure, pause/cancel/restart, final-map selection without credit, reload/save boundaries, local-only requests and screenshots. Actual mobile screenshots must be independently reviewed before merge. No unit suite, all-game E2E or 25-map solution sweep is required.
