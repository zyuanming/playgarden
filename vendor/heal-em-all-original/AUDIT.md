# Heal'em All: complete six-stage source audit

Status: recommended for a complete original-game adaptation, with the concrete lifecycle and content-localization changes below. This is larger than Swap. No upstream program, dependency, package script or installer was executed.

## Fixed source and discovery

- Repository: https://github.com/krzysu/game-off-2013
- Commit: 66950cda39d2b91f114dcf1a0b0307972f24a68f, 2019-07-24T15:41:42Z.
- Actual Git tree: 6b85be69c8239fe502ab47ab8acfeac0a70eb3a2.
- Authors: Krzysztof Urbas (programming/story) and Paweł Madeja (graphics).
- Verified directory chain: https://github.com/bobeff/open-source-games/blob/3a9ab8fc892a2cdadf8989a72ba7624a11e39cec/README.md links Games on GitHub in Other lists; https://github.com/leereilly/games/blob/c67976ddcf6f7aef26dc3884116205ab9ef40f74/README.md lists Heal 'em All under Browser-Based / Arcade.
- License and scope: https://github.com/krzysu/game-off-2013/blob/66950cda39d2b91f114dcf1a0b0307972f24a68f/README.md
- Compiled complete runtime: https://github.com/krzysu/game-off-2013/blob/66950cda39d2b91f114dcf1a0b0307972f24a68f/app/scripts/game.js

## Frozen package

upstream/ contains 71 exact files totaling 1,202,086 bytes:
- LICENSE (complete GPLv3 legal text) and README.md.
- All 48 first-party CoffeeScript modules under app/scripts/game/.
- Complete upstream generated JavaScript app/scripts/game.js; this avoids installing or running CoffeeScript/Grunt.
- Six complete TMX maps and five JSON spritesheet definitions under app/data/.
- Seven runtime PNGs plus optional bg.gif under app/images/.
- Complete unminified bundled app/scripts/lib/quintus-all.js.

Every file, including PNG/GIF bytes, was verified against upstream Git blob SHA-1, declared length and connector SHA; per-file SHA-256 and pinned source URLs are in manifest.json. PNG/GIF were fetched through GitHub fetch_file encoding=base64, then decoded as data. All were recognized as valid images; characters.png was visually inspected. No archive, package dependency, external soundtrack or unverified minified library was included.

licenses/ contains full supplemental CC-BY-4.0, Quintus MIT, Underscore MIT and Resig MIT terms. supplement-manifest.json gives exact fetched license-source URLs and hashes for upstream license texts. Resig-MIT.txt is a labeled notice assembled from the retained author/license header and standard MIT terms, not falsely described as an original upstream file.

audit-reference/index.html is an excluded page-shell reference. transfer.json and supplement-transfer.json are local packaging records, not runtime assets.

## Complete authored campaign

Register six playable levels. Do not count random item arrangements as extra levels.

1. Level1: 30 x 21 tiles, 1 zombie, introduction to key/door, healing gun, health and moving/jumping.
2. Level2: 30 x 21 tiles, 4 zombies, randomly swaps the two authored key/health positions.
3. Level3: 50 x 31 tiles, 8 zombies, authored randomized item placement.
4. Level4: 100 x 46 tiles, 12 zombies, authored randomized item placement.
5. Level5: 100 x 46 tiles, 16 zombies, authored randomized item placement.
6. Level6: 100 x 46 tiles, 24 zombies, four authored door/key/gun/health arrangements.

Each TMX has complete collision and foreground layers of exactly width*height entries. GIDs are 0–10 and fit the supplied 16-tile map_tiles.png sheet. TMX object groups and old embedded image filenames are editor metadata; runtime object spawns are defined by the six CoffeeScript scene modules, not those object groups. Do not create duplicate objects by importing both sources.

The end-of-level summary calls stageEndScreen after completing level6. The explicit end scene says The End, thanks the player and offers Back to all levels. This is a shipped campaign with a genuine ending, not an unfinished level prototype.

## Full original rules and lifecycle

- Side-view platform movement, jumping, gravity, collision and camera follow across large authored maps. Human player speed330/jumpSpeed-660; zombie player speed140/jumpSpeed-500 in original logical units.
- The primary goal is to collect the key, touch the exit door to unlock it, then press up/action while touching the open door. Healing every zombie is optional and affects stars.
- Find a healing gun with level-specific finite ammunition. Fire facing left/right, one shot per 0.5 seconds. Bullets move at700 units/second, have half-viewport range, and stop on obstacles/enemies.
- Ordinary zombies have one hit point. First conversion replaces them with a human. Humans remain in the world, can be reinfected by zombies after four seconds of immunity, and count toward final stars only if still human when exiting.
- A human reinfected by an ordinary zombie becomes a zombie marked wasHuman; shooting that zombie again produces a noninteractive tombstone instead of another human. A zombie-player conversion follows a different source flag path. Keep this distinction; it is not an unlimited heal/reinfect score loop.
- Zombies patrol, turn at obstacles, detect a nearby human player on roughly the same height within350 units, pursue for three seconds, and avoid cliffs except while chasing/recently remembering the player.
- Start each level with three human lives. Hearts add a life; zombie contact and sufficiently hard landing/falling off-map reduce life. Saved safe positions update periodically on solid ground.
- First exhaustion of human life changes the player into a slower zombie form, with an intro animation and altered HUD. Zombie form can reinfect humans, cannot use ordinary key/gun/heart interactions and cannot exit as a human.
- Falling below the map in zombie form restores human form at the saved position with three lives and the wasZombie flag. Exhausting lives after this return is terminal game over.
- End summary shows health collected, humans saved versus initial zombies, wasted bullets, whether zombie mode was discovered, and 1–3 stars. The ratio thresholds are <=50%=1, >50% and <90%=2, >=90%=3.
- Preserve title, controls, level select/unlock, pause/resume, retry/game over, per-level summary, next level and ending. Save max unlocked level and best stars, using host-scoped storage instead of the upstream global keys.
- Upstream supports keyboard arrows, up/X action/jump, Space/Z fire, Enter confirm and P pause through Quintus; mobile uses a joypad plus action/fire buttons. There is a working original mobile path to adapt, not a keyboard-only design.

Distinctness: the current catalog has runners, hoppers, enemy dodging, Asteroids and A Dark Room, but no six-stage side-scrolling cure/protection campaign with finite ammo, reinfection, alternate player form and key/door exits. No existing game ID or source matches.

## Licenses: exact scope and obligations

### First-party source and authored data

README explicitly states all source code GPLv3, copyright2013 Krzysztof Urbas and Paweł Madeja. LICENSE supplies complete GPLv3. This is GPL-3.0-only as declared, not an invented “or later” grant based on the boilerplate example at the end of GPL text. Retain all notices, full GPL text, exact commit and preferred-form CoffeeScript plus maps and adapted JavaScript. Label modifications and their date; distribute corresponding source/build instructions. The host may need an honest GPL-3.0-only adapted-source enum value.

TMX/JSON game-data files are authored source in the same project and have no conflicting license declaration. No external level pack was imported.

### Artwork

README explicitly says all art assets in app/images/ are CC-BY-4.0, artist Paweł Madeja. This covers the exact supplied characters.png, items.png, hud.png, others.png, bullet.png, map_tiles.png, gradient-top.png and bg.gif. Preserve artist attribution, license link/full text, source link and indication of changes. No screenshot/photo scraping or replacement asset inference was used.

CC-BY-4.0 legal text supplement is from pinned SPDX license-list-data@31ba1a50e5397e00a304dbadc76531740e89ee48/text/CC-BY-4.0.txt. The license itself is https://creativecommons.org/licenses/by/4.0/.

Character artwork is cartoon zombies, a scientist and tombstones, visually verified; this is a content consideration for a child-oriented catalog, not a license blocker.

### Engine and embedded dependencies

The exact vendored Quintus file explicitly grants MIT or GPLv2; select MIT. Preserve its “(c)2012 Pascal Rettig, Cykod LLC” header. Include full MIT-LICENSE.txt from Cykod/Quintus@b6da4d0fcd786b162144ace7d7844541b4993808 (which itself says Copyright2011 Cykod LLC); preserve both truthful notices rather than rewriting dates.

The engine includes a small subset of Underscore utilities, with explicit “(c)2009–2012 Jeremy Ashkenas, DocumentCloud Inc.” and MIT header. The full contemporaneous MIT terms are supplied from jashkenas/underscore@87cac5bd057ceafd6f779b1df33de61ca21b5e1d/LICENSE (tag1.4.2). Do not add the full Underscore library: these utilities are embedded already.

The engine also includes John Resig's Simple JavaScript Inheritance, explicitly MIT Licensed, with source attribution. The official author page confirms that grant: https://johnresig.com/blog/simple-javascript-inheritance/. Preserve that header and full MIT terms supplied in Resig-MIT.txt. No separate jQuery dependency is used by this self-contained bundled version despite an outdated introductory comment mentioning it.

### Excluded dependencies/assets

- All app/audio/*: README only says downloaded from OpenGameArt; no per-file authors/license/version mapping. Do not ship, play or derive from these audio files.
- stats.min.js: optional FPS diagnostics; remove initStats/new Stats plus the two Q.stats.begin/end engine calls. Do not accidentally remove only initStats and leave fatal engine calls.
- Old HTML, Google Fonts (Ubuntu, Boogaloo, Jolly Lodger), Google Analytics, Twitter/Dropbox promo embeds, favicon, promo screenshots, bg-blured.jpg and app web-server files.
- Grunt, npm package manifests/install scripts, CoffeeScript compiler and development server. Existing generated source is sufficient.
- bg.gif is licensed but optional; active level scenes use TMX foreground/background tile layers, with the old Background sprite commented out. Excluding it from shipping reduces bytes without affecting rules.

## Network, storage and lifecycle changes needed

The first-party runtime sends GA calls through Game.trackEvent and registers beforeunload analytics. Remove trackEvent implementation/calls and initUnloadEvent. The old page injects Google Analytics and remote fonts; do not reuse it.

Quintus loads local assets through XMLHttpRequest and Image/Audio elements. Restrict configured roots to the local game bundle. All required maps/JSON/PNGs are present; no external request is required. Disable all audio loading and replace AudioManager calls with a no-op adapter or independently generated sounds. Do not include old music.

1. Scope Game and Quintus inside the mounted instance or a carefully sandboxed local iframe. Do not overwrite window.Game, leave generic quintus IDs, or let original page initialization run before host lifecycle is ready.
2. Q.setup maximizes window, changes document.body styles and calls window.scrollTo; use an explicit host canvas and host dimensions, omit maximize and remove touch scroll tricks.
3. Q.setup adds an anonymous orientationchange handler and setTimeout; replace with owned resize handling and cancel it on dispose.
4. Quintus gameLoop starts an untracked first RAF and later stores Q.loop. Fix the initial handle and add a disposed guard so immediate exit during loading/startup cannot resurrect the loop. Pause/cancel all loops on hidden state, unmount and route change; clear stages and input listeners.
5. Asset-load callback can run after the game exits. Cancel/guard pending loads and do not recreate stages into a disposed instance.
6. Keyboard listeners prevent all keys, are anonymous and lack blur cleanup. Scope/release keys, prevent defaults only for handled controls, and remove listeners on disposal.
7. Original canvas touch/joypad handlers need offset/scaled-canvas verification and pointercancel/release-outside protection. Expose labeled mobile movement/jump/fire/pause controls with adequate hit targets and meaningful focus.
8. GameOver does not disable touch controls while end/summary screens do; host cleanup must prevent hidden control overlays and held inputs from leaking into menus/retry.
9. Game.player continues referencing the destroyed human while in zombie mode; AI deliberately stops seeing it through its isDestroyed check. Do not blindly “fix” this by making enemies pursue the zombie player unless intentionally changing/documenting original rules.
10. Gun ammo decrements even on an empty trigger, allowing negative internal counts. Clamp empty ammo if fixing this while retaining shot timing/stat rules.
11. Upstream init/read/write assumes localStorage exists and contains sane values. Validate unlocked level in1..7, clamp rendered selectable levels1..6, validate star integers0..3 and handle disabled storage.
12. Keep logical dimensions and rendering scale explicit: bullet range depends on Q.width and menus use large fixed font sizes. Verify mobile viewport framing without silently changing level geometry/physics.
13. TMX editor metadata names absent PNG files, but runtime uses the supplied map_tiles.png explicitly and parses only layer data. Do not add requests for stale map_tiles_70.png or zombie-background.jpg.

## Content-localization note

The original zombie-mode hint in sprites/hud/info_label.coffee says “I need to kill myself”. It refers solely to the game rule of falling below the map to restore human form. For Playgarden, replace this hint with clear game-specific text such as “跳出地图，恢复人类形态”. Retain the exact original file in provenance, label the localized adapter change, and do not present that original sentence in the game UI. Parent was notified of the cartoon zombie/tombstone theme.

## Minimal complete adaptation

Keep all six authored maps, the complete generated first-party gameplay body, spritesheets/animations and MIT Quintus runtime. Adapt setup/storage/input/network/audio/lifecycle seams; expose host progress and navigation. Preserve CoffeeScript originals as preferred source. This is materially more faithful and faster than rewriting six stages with placeholder rectangles.

Suggested visible notice: “Adapted from Heal'em All by Krzysztof Urbas and Paweł Madeja (2013). Code GPL-3.0-only; artwork by Paweł Madeja, CC-BY-4.0; Quintus and embedded utilities MIT. Playgarden adaptation dated2026-10-10. No warranty.” Link full notices, original fixed commit and corresponding source.

## Verification completed and remaining

Completed: exact byte/Blob/SHA-256 verification; full six-map dimensions/layer-count/GID checks; image decoding/dimensions plus character sheet visual inspection; static full first-party asset/network/dependency scan; shipped ending and all major rule paths reviewed. No game code or unfamiliar dependency ran.

Remaining for integrator: one targeted desktop/touch E2E per repository rule, with movement/jump/fire, healing/reinfection, key/door exit, life/zombie/human flow, pause/retry, level6-to-ending, loading interruption, exit/reentry and mobile screenshot review. Static collection does not claim an all-level playthrough or a passing browser journey.

