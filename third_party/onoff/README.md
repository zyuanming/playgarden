# ONOFF complete original campaign in Playgarden

Upstream: https://github.com/starzonmyarmz/js13k-2018/tree/cb1e2e4615af6195aeb0dade06c08738511dd3b6

Copyright (c) 2018 Daniel Marino and Brad Dunbar; MIT. Original preferred source and full license are under original/. upstream-tree.json records the pinned Git tree and blob identities. The historical package metadata says ISC, but the later root LICENSE commit explicitly supplies MIT for the work; no ISC text is substituted for that grant.

The 25 original level definitions are byte-for-byte unchanged. Levels 12, 14 and 17 use the author's original Math.random-generated arrangements. No artificial stages, rotated copies, seeded QA-only layouts or fake completion targets are added. This game is a two-layer platformer with layer-dependent platforms and spikes, continuous left/right movement, jump, and a star goal. It is distinct from the existing logic/timing titles and the separately integrated Rollermaze/Descensus 2.

## Art, fonts and audio

The author's pinned README (Art Style, Design, and UX; Music and Sound Effects; Development) explicitly describes designing the robot, custom typeface, SVG art, level layouts, and composing the music and synthesizing the effects. No external recording, PNG, OTF, or font download is required. Original numbers and vector art are preserved in the adapted HTML. The unused refs/ Sketch/OTF/M4A source-reference assets are not distributed in this runtime or module archive; the editable vector artwork and synthesized note scores that actually run are fully included.

TinyMusic is the only third-party runtime library. Its full MIT copyright/license is in licenses/TinyMusic-MIT.txt, from the official Kevin Ennis repository pinned at ebc559c8a7a612b8157dc77fef622fbe9fa7a3a5: https://github.com/kevincennis/TinyMusic/blob/ebc559c8a7a612b8157dc77fef622fbe9fa7a3a5/LICENSE. The bundled 2018 copy lives in original/src/tinymusic.js. adapted/src/tinymusic.js only adds explicit oscillator.stop() during disposal.

## Adaptation boundary

adapted/scene.js preserves the original body/bounds/collision/layer mechanics. Its original callbacks are replaced with owned logical-time transitions. The original physics is advanced at its intended 60 Hz; pause/visibility loss does not accumulate background time. Keyboard, multi-pointer buttons and standard gamepad input share the same original left/right/jump/toggle actions. Pause, cancellation, remount and exit clear held input; listeners/RAF/audio are released on teardown.

Only a native goal collision calls the completion bridge. Free level selection, restart, or reaching the last level never awards previous levels. The opaque iframe uses only allow-scripts; host messages authenticate exact WindowProxy, nonce and revision. Native code cannot use host DOM or storage. Host shell persists selection and actual completions; intermediate positions and current-run death count are not persisted. Reset leaves the random layout unchanged; a remount re-evaluates original random definitions as an original page reload did.

The complete 25-level campaign is playable. The original optional level editor and menu/controller reference screens are retained in the source archive, not exposed in the embedded host campaign. They are not needed for any original level. New embedding, lifecycle, input, packaging and Chinese UI are GPL-3.0-only. Original game and TinyMusic retain MIT.

## Reproduce

Use the trusted Playgarden host package-lock.json and npm ci in a supported task environment. No original npm packages or upstream build scripts are installed or executed.

Run node scripts/onoff/build.mjs to generate the local iframe bundle, full licenses, resource hash manifest and source.tar.gz. The source archive is a complete module archive with its exact locked host build context, not the entire 181-game host repository. Then integrate the host/catalog entry and run npm run build.

Targeted browser QA: npm run test:e2e -- e2e/onoff.spec.ts, once after integration in the supported CI path, with desktop and mobile projects. Do not invoke unit suites, full-browser sweeps or a 25-level campaign sweep. No browser pass is claimed until that run and actual mobile screenshot review are complete.

The adapted Body removes an earlier shadowed duplicate bottom setter; the effective original setter remains unchanged. Fixed 60 Hz timing retains the original per-frame movement, gravity, speed limits and collision order at that frame rate.
