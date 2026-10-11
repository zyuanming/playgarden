# Descensus 2 adaptation

Original complete 1000-metre descent retained from Tom W Hall, MIT, commit 750003f12815a756ebd18634e88620c1050a1ec5. No synthetic levels.

All ten terrain factories, six wind zones, gravity, material responses, maximum velocities, five initial lives, 30-second checkpoint timer, death fades, three-second shield, extra lives and genuine ground-contact ending remain.

Adaptation changes: system-serif Pixi text and Chinese menus, three generated timber textures in original dimensions, pinned BSD-3-Clause MT source, inlined local cleared image resources for sandbox WebGL; no audio/font/remote asset fetch. Original Pixi vendor differs only in the two documented uniform closures.

Lifecycle fixes: hidden-page state guard; monotonic active clock for snake motors; bar settlement advances only during physics; interrupted drags and pointer ownership reset; one life loss per Active transition; post-step timer processing cannot override a contact transition; restart clears stale flags and held input. Blur now pauses active play, injury/loss animations, the ending and hidden-page transitions; returning from an injury cannot silently resume an unfocused game. The entire iframe is disposed on exit. Records track completed journeys only.

Rendering: the WebGL backing surface matches the initial displayed size and device pixel density, capped at the original resolution. The original 1024×1792 logical camera, menus and input coordinates remain exact. CSS still fits the same aspect ratio after orientation changes; the renderer's resolution remains fixed until the iframe is recreated. This reduces unnecessary downsampling and software-GPU work without changing physics, clocks or difficulty.

Common import case/interface changes are syntax-only. Editable altered modules:

- Assets/loadFonts.ts
- Assets/loadSounds.ts
- Assets/loadTextures.ts
- Bar.ts
- Game/gameLoop.ts
- Pixi/PixiRenderer.ts
- Pixi/buildNavContainer.ts
- Pixi/buildPixiGraph.ts
- Sound/soundPlayer.ts
- Terrain/Objects/Brick.ts
- Terrain/Objects/FreeSaw.ts
- Terrain/Objects/Girder.ts
- Terrain/Objects/Plus1Life.ts
- Terrain/Objects/Saw.ts
- Terrain/Objects/SawSnake.ts
- Terrain/Objects/SawSpinner.ts
- Terrain/Objects/Seesaw.ts
- Terrain/Objects/Snake.ts
- Terrain/Objects/Spinner.ts
- Terrain/Objects/TerrainObject.ts
- Terrain/Objects/terrainObjectKit.ts
- Terrain/terrainBuilder.ts
- Terrain/terrainUtil.ts
- Utility/gameClock.ts
- Utility/randomUtil.ts
- Utility/timer.ts
- ball.ts
- ground.ts
- index.ts
