
## Cube Composer / 方块函数工坊（完整 25 原关卡）

Original work: Cube Composer by David Peter (sharkdp), Copyright (c) 2015–2016 David Peter.

- Source: https://github.com/sharkdp/cube-composer/tree/a891ffe5de79b072819da04718820d0452b9a201
- Fixed commit: `a891ffe5de79b072819da04718820d0452b9a201`
- License: MIT. Full unmodified notice: `public/cube-composer-LICENSE.txt`, also preserved in `vendor/cube-composer-original/upstream/LICENSE`.
- Adapted scope: all 6 chapters / 25 original puzzles, exact initial and target ordered cube arrays, chapter function sets, map/filter/list-pattern/stable-partition/three-bit arithmetic rules, one-use-per-function composition, intermediate states, and exact structural win comparison.
- Preferred original sources: `vendor/cube-composer-original/upstream/src/Transformer.purs`, `src/Levels/Chapter0.purs` through `Chapter5.purs`, `src/Main.purs`, `src/Types.purs`, and `src/Levels.purs`. All 46 retained original text files are byte/hash/Git-blob verified.
- Runtime adaptation: `src/vendor/cubeComposerCore.ts` retains MIT attribution; exact original data is in `src/games/cubeComposerLevelsData.json`. Playgarden's Chinese React interface, native controls, local save/undo, accessibility text, scripts and new `public/cube-composer-art.svg` are GPL-3.0-only.
- Upstream source and old dependency/build manifests are retained as evidence, not executed or bundled. No legacy PureScript/Bower/Gulp runtime or third-party libraries, analytics, remote fonts, social widgets or iframes are loaded.
- Data equality/source checks: `scripts/cube-composer/extract-levels.py --check` and `scripts/cube-composer/verify-sources.py`. Source/data preservation is not a claim that gameplay or deployment testing has run.

