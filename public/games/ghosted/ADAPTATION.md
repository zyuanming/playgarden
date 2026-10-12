# Ghosted source and adaptation boundary

Pinned upstream: https://github.com/jani-nykanen/ghosted/tree/846454c3b2f7509515cbcbf8852b09f7b7d98b24

Commit `846454c3b2f7509515cbcbf8852b09f7b7d98b24` has root tree `83ff106812650c02d8138d93a7073575965695ed`. `original/` contains every one of its 52 Git files, including unchanged original Git LFS pointers. `lfs/` contains all four exact PNG objects identified by those pointers. Runtime uses the two actual `f.png` and `g.png` objects, never pointer text. `SOURCE-MANIFEST.json` records all bytes, SHA256 values and original Git blob hashes.

## Rights and attribution

The original repository has no separate LICENSE file. The rights basis is its unchanged root README's MIT declaration and original `(c) 2024 Jani Nykänen` notice. `LICENSE-MIT.txt` is explicitly an integrator-assembled copy of that notice and the complete linked MIT terms. Original code, maps, glyphs, game atlas, editor assets and synthesis sequences remain attributed to the original author under the repository declaration. This does not claim independently obtained per-asset grants. No font binary or substitute artwork/music is added.

New Playgarden host, bridge, build/verification scripts and adapter contributions are GPL-3.0-only. The original parts retain their MIT notices. `PLAYGARDEN-COPYING.txt` contains the full GPL-3.0 terms. The unaltered original title/author/JS13K screens remain in the game.

## Original experience retained

The original 26-module local TypeScript engine remains the implementation. `leveldata.ts` is byte-identical; all 13 original TMX maps remain intact. Normal play retains the title, audio/data menu, control guide, original 4×3 level menu, 12 freely selectable ordinary puzzles, the naturally unlocked 13th nightmare puzzle, stage-clear animation, and actual `THANK YOU FOR PLAYING!` ending. The original human/ghost movement, pushes, turns, coins, apples, holes, slime, switches, conveyors, undo buffer and reset rules are not replaced.

The source's `levelsBeaten` still requires all first twelve original completion flags before automatic entry into nightmare. A host selection of 13 without that prerequisite opens the original menu and a clear prerequisite explanation, never fabricates completion. The explicit selected-stage entry path used by a host restart or a legitimate native level transition repeats the same final-level prerequisite guard.

## Scoped changes to original-derived modules

- `main.ts`: converts the original window.onload bootstrap into a lifecycle-owned factory, retains the original assets/scenes/actions, seeds only normal-menu cursor selection, and returns copied observations, and accepts only the bridge-validated native-session continuation at construction.
- `program.ts`: cancellable animation ownership, pause without elapsed-time catch-up, re-entry/disposal, optional stage entry for an actual host navigation, and bounded frame/audio/resource-readiness observations.
- `event.ts`: removable keyboard/blur/cancel listeners, bounded recognized key map, input release on interruption, local image error reporting and disposal, master audio ownership, scene identity observations.
- `canvas.ts`: removable resize listener and owned canvas disposal; safe zero stacking level inside the dedicated frame.
- `sample.ts`: owned oscillator/gain disconnection and immediate stop when muted/disposed. Original note sequences and synthesis envelopes are retained.
- `progress.ts`: isolated `playgarden.ghosted.original-progress.v1`; accepts exactly 12–13 binary digits, returns 13 booleans, rejects impossible final completion without the first twelve, catches storage failure. No cross-game deletion or ongoing state-setting API. A constructor-only continuation copies actual previously observed earned flags/save status without pretending failed persistence succeeded.
- `game.ts`: read-only copied board/player/readiness snapshot, valid 1–13 entry guard, and stage/completion observations emitted only from the original entry and actual coin-clear branches. Final completion is reported to Playgarden after the real ending scene is entered.
- `levelmenu.ts`: selected normal-menu cursor and read-only selection/readiness observation.
- `titlescreen.ts`: read-only title phase/readiness observation.
- `gameobject.ts`: read-only active automatic-motion observation so an inactive fallen object cannot block test readiness.

The remaining sixteen modules, all level data and all original art/music sequences are unchanged.

## Host and lifecycle boundary

`GhostedGame.tsx` uses existing GameProps only. Every inbound/outbound frame message validates the fixed source label, exact source window, same origin, fresh session nonce and expected revision. Normal operation supports lifecycle flags and ordinary key/tap/cancel input only. There is no ongoing board/coin/progress/completion/arbitrary-scene setter. `window.__ghostedSnapshot()` returns detached bounded observations; `__ghostedDispose()` provides synchronous lifecycle cleanup.

GameShell keys game instances on selected level and restart. A native-menu or legitimately earned nightmare transition freezes the old game, observes its current snapshot synchronously, then produces a receipt containing only thirteen actual earned booleans, the native AUDIO choice, real save-status, source session, target level and random nonce. The parent authenticates that exact source frame/message and copies the receipt into one bounded in-memory handoff. The matching immediate remount receives it only in the authenticated bootstrap command, with a matching nonce in its URL; no progress bits enter the URL or storage. The old owner's unclaimed handoff expires after one second and is cleared in its cleanup microtask. The first twelve original completion flags remain the nightmare prerequisite at both native transition and engine entry. No missing flag is invented, merged, inferred from platform badges or marked saved.

Explicit host restart and same-game host level selection synchronously read the authenticated departing frame's existing read-only observer and use the same receipt boundary. A restart resets the board, while preserving actual earned flags and native AUDIO OFF even if localStorage writes failed. A selected locked finale still opens the original menu with the current partial earned flags. A real exit clears the owner/receipt; a later entry reads only actual disk data and original default audio. React StrictMode dispose/connect within one frame instead reuses that frame's own last actual native snapshot, with no board restoration. Initial entry retains the original title/control flow; explicit same-session stage selection or restart can enter the selected unlocked board directly. Completion can credit only the current selected stage, never a prior host level.

The permanent frame bridge listener exists only in its dedicated iframe and supports validated reconnect after React StrictMode cleanup. Program keyboard/resize listeners, rAF, image callbacks, audio nodes and context, observation timer and outstanding tap releases are all removed/stopped by disposal. Mute immediately silences already-running synthesis; pause freezes simulation and audio and releases keys. Document hiding freezes the frame. Host touch controls send the same keys as physical keyboard input and release on pointerup/cancel/lost capture/blur.

Only native completion flags are persisted. In-memory continuity during the same legitimate session does not make a failed save successful; the warning remains visible and real exit discards unsaved flags. A reload replays the original opening flow and starts selected puzzles from their initial board, matching the original save scope. Native DELETE DATA clears only this game's native progress; Playgarden's independent completion badges are outside this module's GameProps API and remain separately stored. This distinction is disclosed in the host help.

A missing bridge/import is bounded by a ten-second host startup error and a normal retry button. The bridge catches synchronous bootstrap failure and observes asynchronous runtime errors, disposes owned resources and reports a visible error. Ready is sent only after the original local image assets load. Retry first captures the current authenticated frame observer, including its last real observation after disposal, so later-earned flags/audio/save-status supersede the original bootstrap receipt. Only when no current observer exists does it retain that original receipt. It preserves the prior title/direct entry mode, creates a new frame/session, and does not fabricate progress or repair storage availability.

## Build and verification

Run `node scripts/ghosted/build.mjs` only after the repository's normal locked `npm ci` has supplied official TypeScript. It compiles original-derived code using the upstream compiler strictness, emits declarations, compiles the new bridge with `strict: true`, checks that the actual generated engine declaration satisfies its explicit typed boundary, creates the reproducible corresponding-source archive, and verifies runtime local import closure. It never runs original make/Closure/converter code or downloads build tools.

The module source archive includes all 52 original Git files, all four LFS PNGs, all adapted source, bridge source, host code/CSS, complete notices, build/check scripts, HTML/frame CSS, and the targeted E2E/trace material when present. It includes its own per-file byte/hash manifest and deterministic archive metadata. This is the Ghosted module, not a standalone copy of the complete Playgarden site: BUILDING.md explains the matching complete host revision requirement. When built inside that repository, selected exact host package/lock/type/helper/config files are included if present. The deployed site footer separately links the complete source for its exact revision. Runtime modules are emitted by the official compiler at build time; a source-only package without emitted modules is not a deployable runtime.

At isolated preparation time: original-copy identity was checked against preflight; independent upstream review previously verified every Git blob/root tree and all 13 TMX/packed maps. The two later-recovered editor PNG objects match their pointers. Local TypeScript compilation, browser gameplay, touch screenshots, actual audio, natural completion and ending have NOT been performed in this executor. Candidate input traces are planning artifacts, not runtime evidence. The owner must finish independent adapter review before running the one targeted desktop/mobile E2E and retain actual screenshot evidence.

## Honest editor limitation

The original editor_tiles.tsx declares 8 tiles and 128×16 while its actual PNG is 128×48 and maps use higher GIDs. Preserve that upstream metadata unchanged. Runtime packed map identity was independently checked, but this is not a claim of a tested Tiled editor project.

## Targeted regression coverage prepared after static review

The same single real-input journey first verifies four requested existing-game card captions without launching those games. It then blocks only the local Ghosted bridge request, expects a bounded error and recovers through the normal retry button. Stage 1 is earned and saved normally, then actually reloaded. From stage 2 onward the test simulates only native-key setItem failure; native AUDIO OFF is selected through its original pause menu. Every remaining flag through the real nightmare/ending is earned by physical inputs, and stage 3 additionally exercises host restart with unsaved flags/audio OFF. After actual exit/re-entry, only the truly persisted stage-1 flag returns. These are prepared assertions, not runtime results. No completed flag, board, clock or forced win is injected.
