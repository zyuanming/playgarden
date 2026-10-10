# Drunken Viking: complete seven-day campaign

Upstream: https://github.com/cxong/DrunkenViking/tree/356d8e19f27060e3330de73fa1e0c68accfc5c79

Original MIT code/data by Cong (2014). This adaptation preserves all seven 20×15 maps, all six layer arrays, the seven original introductions, reversible-time puzzle actions, permissive exits, two separate percentage scores and original direction-based instant replay. The seven days reuse one house with authored object/wall changes; they are not described as seven different environments.

Source snapshots include all 28 audited first-party text files, including seven JSON and seven preferred editable TMX maps. File names end in `.txt` so historical index/JavaScript files remain inert reference material. Their exact bytes and original Git blob/SHA256 hashes are recorded. No original asset or third-party runtime is shipped.

## Rules and deliberately retained quirks

- A move attempts one orthogonal cell. Real walls and restored objects block entry. A broken floor object can be restored while the player stands on its square; it then blocks later entry.
- A wall-mounted broken object can only be restored by an upward bump from below.
- Broken-only tiles count as pickups. Their exact classification is retained, including original vomit tile135 and day7 tile253 with Broken GID210/Good0. No graphic vomit or nudity is drawn; these are shown as symbolic scattered items and a shirt/cloak state.
- Leaving the board completes the day. Collecting or restoring100% is a score goal, never a completion requirement.
- Successful movement records its reverse direction; blocked bumps record the attempted direction. The forward replay consumes those commands backward and blocks only real walls. An attempted bump into restored furniture can therefore become a move during replay. This original quirk is retained, rather than silently replacing the replay with perfect event undo.
- The original seven-day conclusion is retained as a new symbolic ending panel. The common shell supplies explicit next-level navigation instead of automatically replacing a selected level.

## Adaptation boundaries

New TypeScript/React, Chinese translation, validated scoped saves, native keyboard/touch input, original SVG geometry and responsive presentation are GPL-3.0-only. MIT copyright and full upstream permission text remain separate. Original Dawnlike graphics, buttons, VT323 font, all sound recordings and Phaser are omitted. There are no remote fonts, game embeds, recordings, analytics or new dependencies. Gameplay works without game-specific sound.

The browser journey will validate real first/middle/last actions, score below100%, replay and interruption, restored-wall behavior, mobile controls and storage isolation. Test results are recorded in the pull request only after execution; source audits do not count as gameplay tests.
