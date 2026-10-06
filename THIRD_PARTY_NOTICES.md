# Third-party notices

The original Playgarden code is MIT licensed; see LICENSE. This inventory covers direct dependencies, not a claim that every future candidate game or asset has been audited. Installed packages retain their upstream license files. See package-lock.json for exact resolved versions.

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

本项目自行实现同类连通消除、重力及空列压紧规则；生成器、100 关题库、中文教学与 `public/samegame-art.webp` 程序化插画均为原创并沿用本项目 MIT 许可。不包含第三方 Same Game 代码、关卡、美术、字体或音频。完整生成与独立验证范围见 `docs/samegame-campaign.md`。


## 煎饼翻排（原创实现）

前缀反转排序是数学机制参考，不引入外部游戏代码、论文图表或商业素材。`src/games/pancake*`、`PancakeKitchen.tsx`、生成器、固定排列题库、说明和 `public/pancake-art.webp` 均为本项目原创，遵循仓库 MIT 许可。卡片图由原创 `scripts/pancake/art.svg` 渲染，不使用外部字体、图片或网络请求。图形仅表达大小不同的煎饼、盘子和翻转方向。

机制背景：W. H. Gates 与 C. H. Papadimitriou，1979，Bounds for sorting by prefix reversal，DOI https://doi.org/10.1016/0012-365X(79)90068-2。引用只说明数学背景，不把论文视为软件或素材许可证。所有最短距离由本仓库自产完整 BFS 与独立 Python 验证器重算。
