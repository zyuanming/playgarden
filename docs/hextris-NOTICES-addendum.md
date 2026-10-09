## Hextris 原作完整无尽六向消除游戏

Hextris，Copyright (C) 2018 Logan Engstrom；作者 Logan Engstrom、Garrett Finucane、Noah Moroze、Michael Yang。原作在 README 明确授权 GNU General Public License version 3 or, at your option, any later version（GPL-3.0-or-later）。本适配不能标记为 MIT。

原作固定 commit：`3f4847dc8fd7dab3d1c87e6324b9159d92fbd396`。
来源：https://github.com/Hextris/hextris/tree/3f4847dc8fd7dab3d1c87e6324b9159d92fbd396

完整许可证：`public/hextris-original/LICENSE.txt`，与隔离原文 `vendor/hextris-original/upstream/LICENSE.md` 字节一致。检索时核对 24 份原文；最终保留 18 份第一方源码以及文件级 SHA256 / Git blob SHA1 在 `vendor/hextris-original/` 中审计。对应修改源码是 `scripts/hextris/native-adapter.js`、可重复的 `prepare-adaptation.py`、公开可读的 `public/hextris-original/hextris.js`、HTML/CSS 和 React 组件。

Playgarden 于 2026 年修改：保留完整六向旋转落块、同色洪泛、计分连击、全部六种波形、渐进难度、无尽结束、程序化 Canvas 图形；原生中文 UI / 键盘 / 触屏输入与隔离生命周期；纯数据校验存档；命名空间化本机前三高分；系统字体与自绘 SVG。修改同样按 GPL-3.0-or-later 发布。与 Playgarden 整体按 GPLv3 组合分发。

移除远程裸 IP 分数上传、hextris.io 动态脚本、Google Analytics、广告、分享/商店营销、导入字体与图片、旧依赖执行和 JSONfn 函数反序列化。运行代码无网络 API，也不加载第三方代码或素材。六份未使用的上游 vendor 依赖从最终源码树和站点运行时排除，只保留原检索 hash、路径与排除记录。这些文件曾在初始 PR 源码快照中出现，合并前已移除；不将第三方依赖误标为第一方 GPL 代码。

卡片 `public/hextris-original-art.svg` 为新绘矢量图形，GPL-3.0-or-later。无引用人物图片、字体文件、音效或外部美术。有限关卡数 0，不以原无尽模式虚构关卡数量。
