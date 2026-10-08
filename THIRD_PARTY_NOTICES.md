# Third-party notices

Current project-authored and validly relicensable Playgarden contributions are licensed GPL-3.0-only; see LICENSE and docs/licensing.md. Previously distributed MIT versions retain their original grants. Third-party components below retain their own licenses and copyrights; this is not a claim of exclusive ownership or a blanket relabeling of those components. This inventory covers direct dependencies, not a claim that every future candidate game or asset has been audited. Installed packages retain their upstream license files. See package-lock.json for exact resolved versions.

| Package                                                   | License    | Upstream                                           |
| --------------------------------------------------------- | ---------- | -------------------------------------------------- |
| React / React DOM                                         | MIT        | https://github.com/facebook/react                  |
| Three.js                                                  | MIT        | https://github.com/mrdoob/three.js                 |
| lucide-react                                              | ISC        | https://github.com/lucide-icons/lucide             |
| Vite                                                      | MIT        | https://github.com/vitejs/vite                     |
| TypeScript                                                | Apache-2.0 | https://github.com/microsoft/TypeScript            |
| Vitest                                                    | MIT        | https://github.com/vitest-dev/vitest               |
| Prettier                                                  | MIT        | https://github.com/prettier/prettier               |
| Testing Library                                           | MIT        | https://github.com/testing-library                 |
| jsdom                                                     | MIT        | https://github.com/jsdom/jsdom                     |
| Playwright                                                | Apache-2.0 | https://github.com/microsoft/playwright            |
| @types/node, @types/react, @types/react-dom, @types/three | MIT        | https://github.com/DefinitelyTyped/DefinitelyTyped |

The project does not import Three.js example assets. Slant is the first source-adapted game; other entries in docs/OPEN_SOURCE_RESOURCES.md remain candidates, not bundled dependencies.

Catalog art: AI-generated original artwork commissioned for Playgarden, generated using OpenAI image generation on 2026-10-04. No external licensed character, game logo, or stock image is used. Geometry and gameplay content are original. System fonts are used; no font files are bundled.

Redistributors must retain relevant upstream notices when distributing dependency code. The dependency license texts are included in node_modules after npm ci; a license inventory is not a substitute for those texts.


## Simon Tatham’s Slant (MIT)

Fixed source: https://github.com/notpeter/sgtatham-puzzles/blob/a7c7826bce5cbb9b9c337c11b9b7f8b278e76fba/slant.c

Adapted filled-grid, clue generation/removal and description encoding in scripts/slant/adapted-generator.mjs. Original source retained in vendor/sgtatham-slant/slant.c; own RNG, solver, UI and levels. No third-party assets imported. Full notice also shipped as public/slant-LICENCE.txt.

This software is copyright (c) 2004-2024 Simon Tatham.

Portions copyright Richard Boulton, James Harvey, Mike Pinna, Jonas
Kölker, Dariusz Olszewski, Michael Schierl, Lambros Lambrou, Bernd
Schmidt, Steffen Bauer, Lennard Sprong, Rogier Goossens, Michael
Quevillon, Asher Gordon, Didi Kohen and Ben Harris.

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation files
(the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of the Software,
and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 花簇消除（Same Game）

本项目自行实现同类连通消除、重力及空列压紧规则；生成器、100 关题库、中文教学与 `public/samegame-art.webp` 程序化插画均为原创并沿用本项目 GPL-3.0-only 许可。不包含第三方 Same Game 代码、关卡、美术、字体或音频。完整生成与独立验证范围见 `docs/samegame-campaign.md`。


## 煎饼翻排（原创实现）

前缀反转排序是数学机制参考，不引入外部游戏代码、论文图表或商业素材。`src/games/pancake*`、`PancakeKitchen.tsx`、生成器、固定排列题库、说明和 `public/pancake-art.webp` 均为本项目原创，遵循仓库 GPL-3.0-only 许可。卡片图由原创 `scripts/pancake/art.svg` 渲染，不使用外部字体、图片或网络请求。图形仅表达大小不同的煎饼、盘子和翻转方向。

机制背景：W. H. Gates 与 C. H. Papadimitriou，1979，Bounds for sorting by prefix reversal，DOI https://doi.org/10.1016/0012-365X(79)90068-2。引用只说明数学背景，不把论文视为软件或素材许可证。所有最短距离由本仓库自产完整 BFS 与独立 Python 验证器重算。

## 星雾探测（原创 Black Box 规则实现）

规则核对固定到 Simon Tatham's Portable Puzzle Collection 快照 `a7c7826bce5cbb9b9c337c11b9b7f8b278e76fba`。只读参考 `blackbox.c` 与 `puzzles.but` 的 Black Box 章节，用于明确入口、正前吸收与前侧转向的优先级；完整快照文件、来源校验和 MIT 许可保留在 `vendor/sgtatham-blackbox/`，许可同时随生产产物分发为 `public/blackbox-LICENCE.txt`。上游 Black Box 模块由 James Harvey 贡献；机制历史见上游文档，不把商业原版品牌、包装或关卡当作 MIT 素材。

Playgarden 的 TypeScript 游戏规则实现、Python 独立求解器、6 章 84 个 D4 非同构题、中文教程、界面、`scripts/blackbox/art.svg` 与由其渲染的 `public/blackbox-art.webp` 均为原创。本游戏不移植上游生成器或关卡，不载入外部美术、字体、音频，也不执行上游源码。完整上游 MIT 版权及许可文本见本文件前述 Simon Tatham 节和独立 `blackbox-LICENCE.txt`；该声明不会替代许可证正文。

## open-gomoku: actual TypeScript source adaptation

- Upstream: https://github.com/tombelieber/gomoku
- Fixed commit: `0d8f81e687a04c729b1dfe5b0ce028295528cc17`
- Copyright (c) 2026 open-gomoku Contributors. MIT License.
- Actual adapted code: `engine/src/board.rs`, `engine/src/ai.rs`, `engine/src/eval.rs`, now `src/games/gomokuLogic.ts` and `gomokuAi.ts`. Original reference copies and byte hashes: `vendor/open-gomoku/`.
- Full unchanged permission/disclaimer: `vendor/open-gomoku/LICENSE`, also shipped as `public/gomoku-LICENSE.txt`.
- Changes: full winning segments, immutable/replay-validated state, exhaustive immediate tactics before truncation, deterministic iterative alpha-beta, budget and cancellable Worker lifecycle. Original UI, SVG/CSS artwork, tutorial corpus, storage and accessibility integration.
- No upstream web UI, remote fonts, analytics, images, accounts, PWA, package dependencies or WASM binary copied. See `docs/gomoku/port-provenance.md` for function mapping and limitations.

MIT License

Copyright (c) 2026 open-gomoku Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## xiangqi.js (China-chess rules, BSD-2-Clause)

The Chinese-chess rules in `src/vendor/xiangqi/xiangqiCore.js` are adapted from lengyanyu258/xiangqi.js at `f9019ac2303d4b80ef0b82fd0515bfb55a80a62b`. The exact upstream `xiangqi.js` and LICENSE are retained in `docs/upstream/xiangqi.js/`; complete notices are also distributed as `public/xiangqi-LICENSE.txt` and linked in the game. Original upstream credits include Jeff Hlywa and lengyanyu258. Upstream portions retain BSD-2-Clause; Playgarden modifications are GPL-3.0-only. The original BSD grant is not relabeled as MIT or GPL.

Changes: ES-module export and narrow typed API, strict FEN integer/digit validation, no king captures, side-effect-free opponent pseudo-move query, repaired legal perft and attack query. The application supplies its own terminal/adjudication layer, including explicitly labeled casual threefold/120-ply rules, rather than claiming full tournament repetition adjudication. UI, SVG artwork, puzzles, persistence and bounded beginner search are original Playgarden code. No third-party game assets, trackers, fonts, account or online engine services are bundled.

Copyright (c) 2017, Jeff Hlywa (jhlywa@gmail.com)
Copyright (c) 2019-2023, lengyanyu258 (lengyanyu258@outlook.com)
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.

## markstent/runner (movement, generator and runner modules, MIT)

Cloudrunner directly adapts eight pure/procedural modules from Mark Stent's runner at commit `22a0d0dd74f880025559235bf6139a85316da821`: player, track, collision, game state, scoring, difficulty, input and audio. Exact original editable files are in `docs/upstream/cloudrunner/`; the fixed-file manifest is in `vendor/cloudrunner/source-manifest.json`. Copyright (c) 2026 Mark Stent. Complete MIT text is preserved in `vendor/cloudrunner/LICENSE`, `docs/upstream/cloudrunner/LICENSE` and `public/cloudrunner-LICENSE.txt`, linked visibly in the game. Upstream portions retain MIT; Playgarden modifications and original route, Canvas art, interface and campaign are GPL-3.0-only.

No avatar.glb, BrainStem/Poser model, avatarModel.ts, external image, font, music or commercial Temple Run asset is included. The title, courier and garden graphics are original procedural artwork. This is an original game inspired by an established runner mechanic, with no affiliation claim. See `docs/cloudrunner.md` for exact adaptations and limitations.

## Breakout collision geometry

`src/vendor/breakout/geometry.ts` adapts segment intersection from `game.js` and paddle response from `breakout.js` in Jake Gordon's javascript-breakout, commit eed59e2affa9423b93d2ac8ff93061bb88b33284. Full MIT notice: [breakout-LICENSE.txt](./breakout-LICENSE.txt). We changed face selection to compare earliest hits, bounded iteration, and constrained the minimum vertical bounce. Original levels and UI are Playgarden GPL-3.0-only. No upstream sounds (separately CC BY-ND 2.0), artwork, fonts, HTML, DOM shims or runner are included.

## Snake movement core

`src/vendor/snake/core.ts` is adapted from Patrick Gillespie's JavaScript-Snake, fixed commit `7c80eddde2de6af669e6ae5133ba8ae60a8d7fb9`, `src/js/snake.js` setDirection/go/eatFood. Full MIT notice is preserved in `src/vendor/snake/LICENSE.txt` and the distributed [snake-LICENSE.txt](./snake-LICENSE.txt). The adaptation retains direction encoding, tail-vacancy movement and food-growth collision semantics, replaces DOM-linked body nodes with immutable cell IDs, validates a bounded turn queue, and replaces random retries with finite empty-cell selection. Upstream artwork, old DOM runtime and third-party z-index snippet are excluded. Playgarden's original interface and storage integration are GPL-3.0-only.

## javascript-tetris / 落块花园

Jake Gordon and contributors; https://github.com/jakesgordon/javascript-tetris/tree/e5c0c42f7dac0f3514a55eff656c6e22e95d68ed

Actual adaptation of bitmask pieces, eachblock, occupied, locking and row removal from index.html. Fixes row-zero omission; original interface and artwork. No texture.jpg or stats.js is included.

Copyright (c) 2011, 2012, 2013, 2014, 2015, 2016 Jake Gordon and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.




## Flood / 染色花园

Source: https://github.com/chrisboyle/sgtpuzzles/tree/d1e10eb57dd80af4999e698a9ab31f546e9a0b9d

The MIT flood.c queue-fill, completed-grid check and legal-move guards are ported into src/games/floodLogic.ts. Original campaign, exact BFS hints, storage, artwork and UI are Playgarden additions under GPL-3.0-only. No Android, Google Play graphics, upstream sound or artwork is included. Complete unmodified source and licence are retained in vendor/sgtatham-flood/.

This software is copyright (c) 2004-2024 Simon Tatham.

Portions copyright Richard Boulton, James Harvey, Mike Pinna, Jonas
Kölker, Dariusz Olszewski, Michael Schierl, Lambros Lambrou, Bernd
Schmidt, Steffen Bauer, Lennard Sprong, Rogier Goossens, Michael
Quevillon, Asher Gordon, Didi Kohen, Ben Harris, Chris Boyle and
Phil Tunstall.

The notice below applies to the source as distributed at
https://github.com/chrisboyle/sgtpuzzles and does not apply to
the additional graphics distributed in the Google Play Store
version.

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation files
(the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of the Software,
and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
