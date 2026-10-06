# PlayGarden: reusable game resources

Verified 4 October 2026 from primary sources. Read-only research; no upstream code was installed or run. This is a shortlist, not a full legal/security audit. Links point at current branches, so pin actual imported revisions and repeat the check before release.

## Recommendation

Keep Light Lab, Robot Routes and Bridge Blocks original. Use Three.js plus original procedural geometry; native Web Audio or ZzFX is enough for initial feedback. Avoid adding another full engine to the MVP. Later, add a carefully adapted 2048 module and consider Matter.js for explicit 2D physics lessons. Use Blockly Games and PuzzleScript for educational/rule design references. No X posts were needed to establish licensing; original repositories and creator asset pages were stronger sources.

## Shortlist (11)

### Direct integration candidates

#### Three.js — MIT

[Source](https://github.com/mrdoob/three.js) · [License evidence](https://github.com/mrdoob/three.js/blob/dev/LICENSE)

- Role: 3D rendering library. Best fit for Bridge Blocks; also lightweight 3D presentation for Light Lab and Robot Routes.
- Mobile/format fit: Good with low-poly scenes, capped pixel ratio, limited shadows and pointer/touch controls; requires GPU fallback handling.
- Maintenance: Large current upstream with WebGL/WebGPU renderers and migration documentation; pin a tested release rather than dev.
- Assets: Core license does not establish provenance of every example model, texture or font. Use original procedural geometry or separately cleared assets.
- Third-party scope: Core package manifest lists devDependencies, not runtime dependencies; addons and external decoders need their own audit.
- Adaptation: Mount/unmount lifecycle, GPU disposal, resize, context-loss handling and reduced-motion mode.
- Recommendation: Use now.

#### Matter.js — MIT

[Source](https://github.com/liabru/matter-js) · [License evidence](https://github.com/liabru/matter-js/blob/master/LICENSE)

- Role: 2D physics library. Future balance, lever and bridge-load puzzles. Not a 3D physics engine.
- Mobile/format fit: Good for small fixed-step scenes; cap body count and avoid expensive collision meshes.
- Maintenance: Current repository and package manifest available, version 0.20.0 observed; do not infer release cadence from version alone.
- Assets: Use programmatic shapes; demo imagery is not needed.
- Third-party scope: Observed manifest has development tooling and optional/example helpers including poly-decomp; audit any helper actually bundled.
- Adaptation: Keep educational win conditions deterministic; synchronize physics state with renderer, add reset and pause.
- Recommendation: Later.

#### Phaser — MIT

[Source](https://github.com/phaserjs/phaser) · [License evidence](https://raw.githubusercontent.com/phaserjs/phaser/master/LICENSE.md)

- Role: 2D game framework. Future larger 2D arcade/puzzle catalog with scenes, input and asset loading; unnecessary second engine for the first small games.
- Mobile/format fit: Explicit desktop/mobile browser support with Canvas/WebGL.
- Maintenance: README describes actively maintained Phaser 4; audit and pin version because v3/v4 rendering architecture differs.
- Assets: README explicitly reserves Phaser logo and characters. Example art is not automatically MIT.
- Third-party scope: Vendored engines/plugins and third-party example assets need separate notice review.
- Adaptation: Lazy-load per game; bridge shell pause/restart/progress and destroy the game on navigation.
- Recommendation: Later.

#### 2048 (Gabriele Cirulli) — MIT

[Source](https://github.com/gabrielecirulli/2048) · [License evidence](https://github.com/gabrielecirulli/2048/blob/master/LICENSE.txt)

- Role: Complete 2D number puzzle. Optional number-merge game or source for input/board-state patterns, with new educational explanations.
- Mobile/format fit: Upstream has swipe support; replace legacy viewport that prevents zoom and add visible directional controls.
- Maintenance: Small established legacy codebase; browser compatibility and accessibility require current testing.
- Assets: Do not import branding, icons or bundled fonts without separate provenance review; use system font and original UI.
- Third-party scope: Listed HTML scripts include polyfills; inspect their headers before copying. Index inspected without executing.
- Adaptation: Extract state into module, add undo and seeded tests; keep attribution and remove claims that a derivative is the official site.
- Recommendation: Conditional.

### Algorithm and design references

#### PuzzleScript — MIT

[Source](https://github.com/increpare/PuzzleScript) · [License evidence](https://raw.githubusercontent.com/increpare/PuzzleScript/master/LICENSE)

- Role: 2D rule-based puzzle engine. Reference for grid rules, undo, level syntax and a later creator mode.
- Mobile/format fit: 2D can be economical; exported controls and touch behavior still need validation.
- Maintenance: Current source/docs available; no exact last-commit date established.
- Assets: Engine license is not blanket permission for community games, authored levels or gallery art. Create original games.
- Third-party scope: Build package includes image compression and minification tools; engine/editor third-party credits must be reviewed before bundling.
- Adaptation: Prefer original rule/state implementation for initial games; full integration needs editor/export security and lifecycle work.
- Recommendation: Reference.

#### Blockly Games — Apache-2.0

[Source](https://github.com/blockly-games/blockly-games) · [License evidence](https://raw.githubusercontent.com/blockly-games/blockly-games/master/LICENSE)

- Role: Programming education games. Strong Robot Routes reference for sequencing and progressive programming lessons.
- Mobile/format fit: Block dragging needs small-screen testing; simple tap-to-add instruction cards are safer for initial release.
- Maintenance: Official repository moved from google to blockly-games; current source available, exact release recency not established.
- Assets: Do not assume all game media or third-party subtree uses the top-level license. Use original robot/art/levels.
- Third-party scope: Based on Blockly and includes third-party directory; full subtree inventory remains a release gate.
- Adaptation: Extract pedagogical ideas rather than entire app; if copying files retain Apache license/notices and mark changed files.
- Recommendation: Reference.

#### PathFinding.js — MIT

[Source](https://github.com/qiao/PathFinding.js) · [License evidence](https://github.com/qiao/PathFinding.js#license)

- Role: Grid path algorithms. Robot Routes route validation, hints and solution checks; A*, BFS and corner-crossing behavior.
- Mobile/format fit: Small grids are cheap; do not run unbounded searches on main thread.
- Maintenance: Legacy package manifest uses version 0.4.18 and Gulp 3-era tools; treat as algorithm reference rather than adopt its build chain.
- Assets: No game art needed; visualization dependencies are separate from algorithms.
- Third-party scope: Runtime dependency heap 0.2.5 appears in manifest; inspect that package license before shipping it.
- Adaptation: For tiny puzzles implement/test original BFS, including heading and instruction state when required; a shortest cell path is not always a shortest program.
- Recommendation: Reference.

#### Hextris — GPL-3.0-or-later

[Source](https://github.com/Hextris/hextris) · [License evidence](https://github.com/Hextris/hextris/blob/gh-pages/LICENSE.md)

- Role: Complete 2D rotation puzzle; caution. Optional study of rotational matching; avoid for the current MIT-oriented MVP.
- Mobile/format fit: Canvas/mobile design exists, but legacy viewport disables zoom.
- Maintenance: README says project is not actively maintained.
- Assets: Vendor libraries, Font Awesome, Exo font, icons and social/store branding require independent review.
- Third-party scope: Current index contains AdSense, Google Analytics and several vendor libraries. Never embed upstream as-is for children.
- Adaptation: If code is copied, preserve GPL obligations and corresponding source, do not relabel derivative MIT. Separate deployment alone is not a guarantee against copyleft scope; review integration. Remove tracking/ads and use fresh assets.
- Recommendation: Do not integrate now.

### Art and audio

#### ZzFX — MIT

[Source](https://github.com/KilledByAPixel/ZzFX) · [License evidence](https://github.com/KilledByAPixel/ZzFX/blob/master/LICENSE)

- Role: Procedural sound generator. Small original feedback sounds for all three games without downloadable audio samples.
- Mobile/format fit: Start/resume AudioContext only after user gesture; global mute and conservative volume.
- Maintenance: Current README provides module and micro versions; no exact last-commit date established.
- Assets: Generate original presets; music, songs or third-party presets are separate content and need their own review.
- Third-party scope: README states standalone with no external libraries.
- Adaptation: Use short gentle tones, precache and stop on pause; never make audio the only success/error signal.
- Recommendation: Use now or keep native Web Audio.

#### Kenney Building Kit — CC0-1.0

[Source](https://kenney.nl/assets/building-kit) · [License evidence](https://kenney.nl/assets/building-kit)

- Role: 3D art pack. Optional environment pieces for Bridge Blocks, not required for procedural MVP.
- Mobile/format fit: Inspect polygon counts/materials after download; batch/instance repeated pieces.
- Maintenance: Pack page lists 80 files, version 1.0 released 2024; static asset maintenance is less relevant than formats/provenance.
- Assets: Official pack explicitly CC0. Check downloaded included license and record actual imported filenames; CC0 does not grant trademark rights.
- Third-party scope: No code dependency; chosen loader/decoder has separate license.
- Adaptation: Normalize scale/orientation, simplify materials and keep gameplay silhouettes clear.
- Recommendation: Optional.

#### Kenney Interface Sounds — CC0-1.0

[Source](https://kenney.nl/assets/interface-sounds) · [License evidence](https://kenney.nl/assets/interface-sounds)

- Role: Audio pack. Alternative gentle UI/feedback audio for the hub.
- Mobile/format fit: Load only chosen small clips; user-gesture playback and mute control.
- Maintenance: Official page lists 100 files and version 1.0 released 2020.
- Assets: Explicit CC0 pack; archive included license and source URL with imported filenames.
- Third-party scope: No code dependency; media decoding uses browser APIs.
- Adaptation: Audition for harshness, trim/normalize levels and pair all sounds with visible feedback.
- Recommendation: Optional.

## Copy/distribution conditions

- MIT: retain the original copyright and permission/license notice in copied or substantial code, including shipped bundles via preserved license comments and a distributed third-party notices file. Keep the project's own authorship distinct.
- Apache-2.0: distribute its license, preserve relevant notices, mark changed files and carry forward any applicable NOTICE file. Trademark permission is not included. [Upstream text](https://raw.githubusercontent.com/blockly-games/blockly-games/master/LICENSE).
- GPL-3.0-or-later: copied/adapted Hextris code cannot simply become MIT. Distribution of covered work requires GPL compliance and corresponding source. Browser-delivered JavaScript also matters; a separate iframe is not a blanket legal exemption. [License](https://github.com/Hextris/hextris/blob/gh-pages/LICENSE.md).
- CC0: copying/modification/commercial use is permitted without attribution as a copyright condition, but provenance credits are still good practice. Trademark, privacy and publicity rights are not waived. [CC0 explanation](https://creativecommons.org/publicdomain/zero/1.0/).

## Specific evidence and exclusions

1. Hextris's [current index](https://raw.githubusercontent.com/Hextris/hextris/gh-pages/index.html) loads AdSense and Google Analytics, plus external fonts and vendor scripts. Exclude it from immediate child-facing integration.
2. Phaser's [README](https://github.com/phaserjs/phaser) explicitly reserves its logo/characters despite its MIT code license.
3. 2048's [HTML](https://raw.githubusercontent.com/gabrielecirulli/2048/master/index.html) disables zoom and calls itself official. An adaptation must use accessible viewport settings and truthful branding. Bundled fonts were not successfully cleared in this pass; replace with system fonts.
4. [PathFinding package manifest](https://github.com/qiao/PathFinding.js/blob/master/package.json) identifies heap 0.2.5; the heap license is not yet checked. [Matter manifest](https://raw.githubusercontent.com/liabru/matter-js/master/package.json) and [Three.js manifest](https://raw.githubusercontent.com/mrdoob/three.js/dev/package.json) separate development tools from runtime core. Audit any copied addon or optional helper.
5. [Edge Not Found](https://github.com/Auroriax/js13k-2020) was excluded: its README says the project's Charity License prohibits commercial exploitation, even though two bundled libraries are MIT. Public code is not automatically open-source/reusable on the desired terms.
6. No claim is made that GitHub availability, repository popularity or a README badge clears all assets, game names, music, fonts or third-party code. Community levels and gallery games remain their authors' works.

## Release gate for every imported resource

1. Record exact commit/tag, package version, imported filenames, original source, license text and copyright holder.
2. Review file headers, vendor directories, lockfile runtime dependencies, fonts, sprites, models, sounds and level data separately. Exclude unresolved files.
3. Preserve required notices in source and production artifacts; add a Credits / Licenses page.
4. Inspect network calls; self-host permitted assets, remove ads/analytics/social widgets, require no accounts or personal data for play.
5. Test keyboard and touch, zoom, non-color cues, mute, reduced motion, pause and teardown. Do not call a game educational solely because it is a puzzle; state the specific skill it practices.
6. Keep author logos/trademarks out of hub branding and do not imply endorsement.


## 6 October: actual open-gomoku adaptation

The [MIT source](https://github.com/tombelieber/gomoku/tree/0d8f81e687a04c729b1dfe5b0ce028295528cc17/engine/src) at fixed commit `0d8f81e687a04c729b1dfe5b0ce028295528cc17` now supplies the identifiable rule, evaluation and alpha-beta routines for freestyle Gomoku. Rust was statically reviewed and adapted to TypeScript; no upstream binary was run. See [port mapping](gomoku/port-provenance.md) and [game scope and verification](gomoku-campaign.md). This is an implementation record, separate from the older branch-based shortlist above. Complete MIT attribution ships with source and public assets. The original web analytics, fonts, UI and dependencies are excluded.
