# Black Hole Square: module source and build instructions

This archive contains the Black Hole Square game module and the exact upstream
preferred-source subset it derives from. It is not the entire Playgarden host.
The host supplies React, GameProps, the game shell, catalog, badge storage, and
its official locked build/test dependencies. An integrated archive also includes
that checkout's package/lock/configuration context. It does not include third-party
node_modules. Do not run the original package.json scripts or install its legacy
webpack chain.

## Original work and rights

Original author: Quinten Clause. Official source:
https://github.com/Quinten/black-hole-square/tree/8d48aae2097613782ab18d5062e8a3906741baaa

Selected commit: 8d48aae2097613782ab18d5062e8a3906741baaa, original root tree
18df1cca987fdcdc0861ac25b3d194eaf8839c6f. This is the author's 2024 released source
which already opens all 18 puzzles; both native sequences are identical. The
2026 tip is a different gated revision and is not part of this module.

Original code, all 18 maps and budgets, geometric artwork, authoring files,
procedural star tunnel, native Web Audio synthesizer, and note patterns retain
the original MIT grant in LICENSE-MIT.txt. SOURCE-MANIFEST.json authenticates all
79 supplied original files by exact byte count, SHA-256 and Git blob SHA-1.
Only the obsolete upstream package lock and four generated public files are
outside this selected preferred-source subset. Original package.json, webpack
configuration, PWA manifest and service worker remain inert provenance; no worker,
monetization metadata, original built bundle, or legacy dependency executes here.

The original outlined title is derived from Gugi, copyright 2017 TAE System &
Typefaces Co. The separate SIL OFL 1.1 grant, official font-source links and hash
records are in font-provenance and LICENSE-MANIFEST.json. Only the existing title
outlines are used. No font binary is bundled or downloaded. Gugi's own OFL grant
is not relabeled MIT or GPL. The outlined artwork remains part of the author's
MIT work; OFL permits such graphics independently of the font-software license.
See https://openfontlicense.org/ofl-faq/ (questions 1.1–1.1.2).

New host UI, bridge, storage contract, scripts and integration changes are
GPL-3.0-only; see PLAYGARDEN-COPYING.txt. Unchanged adapted copies retain their
original grant. Modified original modules identify original MIT and added GPL
portions. This combined distribution preserves both notices.

## Preserved content and bounded changes

LEVELS.json describes exactly 18 original 6×6 boards, in this sequence:
click (4), wait (5), push (6), move (5), tango (6), substitute (6), wander (15),
double (5), conflict (10), extract (5), grab (9), twin (11), snare (9), sink (6),
support (8), snatch (12), swivel (14), turmoil (20). Numbers are move limits.
Title, instructions and ending are not counted as puzzles. No new maps,
rotations, reskins, fabricated rewards, or alternate success rules are added.

Original puzzle activation, line shifts, main/overlay object swaps, clear test,
budget failure, no-clickables failure, and stuck detection remain in their
original order. Draw and home-update modules are retained. The nine integration
seams are addressed as follows:

1. Four webpack require.context sites become alphabetically explicit static ESM
   registries. Component JSON cloning and per-entity component iteration remain.
2. Only a validated, game-specific host storage key is read/written. Current
   sequence index is 0–20; solved IDs are the 18 original IDs; successful replay
   arrays contain 1–20 valid cell indices and at most the original move budget.
   Up to 64 distinct successful replay records per puzzle are retained. Invalid,
   huge or inaccessible saves cannot prevent startup. The actual original save
   scope is selection, solved history and successful solutions, not an unfinished
   board. Platform badges are separate, and platform selection takes precedence.
3. The frame owns its RAF and real elapsed-time accumulator. Integration steps
   are capped at 34ms, and resuming pause/visibility resets the elapsed-time
   origin. No fake clock/random generator is introduced. Disposal releases
   canvas, listeners, input and audio. Resize verifies the actual fresh canvas
   backing size as well as viewport size, covering same-document reconnects.
4. Pointer Events use the same canvas-relative coordinate mapping for all phases,
   including touch release. Pointer cancellation, outside release, blur, pause
   and frame exit cancel rather than synthesize activation. Keyboard focus/cell
   selection and visible navigation buttons are additional input routes into
   ordinary original actions.
5. Board and progress-dot bounds are half-open and checked before indexing.
   A new activation waits until the existing main/overlay travel is settled,
   preventing a rapid second click from recycling an uncleared overlay object.
   Native transition input cannot act on a stale level. This bounded input safety
   change leaves the original settled-board move rules and budgets unchanged.
6. Actual clear notifications occur only inside the original clear branch,
   after native solved/solution recording. The bridge also observes an empty
   pushable main board and the original budget. Skip, direct selection, restored
   save and ending display never award platform completion.
7. Previous/reset/next and native progress-dot selection reset module swipe/wheel
   flags, stale input and the per-level update list before initialization. Native
   free skip and ending remain available. There is no invented undo feature.
8. The original synthesis, envelopes, note arrays and delay mix are retained.
   An owned AudioContext is reused/resumed after gesture. Pausing suspends audio
   and its scheduler; mute stops pending notes and disconnects its old effect
   graph without opening a second context. Exit closes the context.
9. The iframe has only sandbox allow-scripts, a local classic-script bundle of
   the static ESM sources, and restrictive CSP. No parent DOM/storage authority,
   external request, font, worker, form or object is allowed. Messages validate
   exact source WindowProxy, origin, random session and revision. Parent-owned
   native records carry real progress through level/reset remounts even if writes
   fail, and disappear on actual lobby exit. Error/timeout UI offers a new frame.
   StrictMode may dispose/reconnect; the last actual native record wins over its
   original startup copy. The sole window observer returns copies and has no
   setters, success hooks or time/random manipulation.

## Build and corresponding source

From the integrated Playgarden checkout with its already locked official tools:

1. python3 scripts/black-hole-square/verify-sources.py
2. node scripts/black-hole-square/build.mjs
3. Run the host's required typechecked build and license/source checks.
4. npm run test:e2e -- e2e/black-hole-square.spec.ts
5. node scripts/black-hole-square/build-identity.mjs (after dist exists)

The build uses the official esbuild version already recorded in the host lock.
Its installed version is checked against that lock. It does not install packages,
execute the original game, call webpack or invoke the original deployment script.
The ESM engine/bridge is bundled as one classic script because the opaque iframe
cannot fetch same-site ESM modules without additional cross-origin permission.
The source map contains the corresponding editable modules. Generated runtime
bytes/source archive may be ignored by Git and reproduced in CI, matching the
host's existing generated-game workflow; the separate build-identity manifest
records the final exact deployed bytes and commit for HTTP verification.

package-source.py makes a deterministic source.tar.gz and per-member manifest.
ADAPTED-MANIFEST.json maps every preferred adapted engine source to its original
file, indicates changed files and hashes, and hashes all new module inputs.
verify-sources.py validates originals, complete 18-board data, grants, bounded
imports, retained gameplay blocks, corresponding-source hashes and, when present,
the archive and built source-map mapping. It never imports the game as a program.

The optional derive-input-plans.py reads only original JSON and uses an independent
settled-grid planning model. Its fixture is explicitly STATIC_DATA_ANALYSIS_ONLY,
not proof that gameplay ran. It is not part of startup or the production bundle.
The targeted E2E uses those cell coordinates only as ordinary pointer/keyboard
input and observes actual board changes. It exercises all 18 clears, first/middle/
last boards, original ending, negative skip, budget failure, reset, keyboard and
pointer cancellation, save/reload, failing storage, pause during load/movement,
exit/remount, sandbox isolation, stale messages, network isolation and 320px UI.
The original has no undo; the host reports that accurately.

At preparation time, compilation, runtime gameplay, E2E and publication have NOT
been performed. They require the independent complete source read and the normal
integration owner's validation. Static plans and source hashes must not be
reported as a runtime pass or a published game.
