# 六向彩环 / Hextris 完整原作适配

本包仅在独立目录准备，未登记游戏、未修改共享目录、未推送或发布。建议紧接 Coil，最终编号由唯一集成者决定。一个完整无尽积分游戏，有限关卡数为 0；不把波形、教程或皮肤另计游戏。

## 固定来源与许可证

原作：Hextris/hextris，固定 commit `3f4847dc8fd7dab3d1c87e6324b9159d92fbd396`，tree `f6d6c8067593b1245e7c82373d877e5aa3933ebd`。

作者为 Logan Engstrom、Garrett Finucane、Noah Moroze、Michael Yang。README 明确 Copyright (C) 2018 Logan Engstrom，授权 GPL 第 3 版或任意更新版本。因此此版本是 **GPL-3.0-or-later，不是 MIT**。GPL 原文原样保存在 `public/hextris-original/LICENSE.txt` 和 vendor 上游快照。Playgarden 新适配、中文界面和卡片同样按 GPL-3.0-or-later 许可；与本站 GPL-3.0-only 项目组合可按 GPLv3 分发。

发现链：

- https://github.com/bobeff/open-source-games/blob/3a9ab8fc892a2cdadf8989a72ba7624a11e39cec/README.md 的 Other lists → Games on GitHub。
- https://github.com/leereilly/games/blob/c67976ddcf6f7aef26dc3884116205ab9ef40f74/README.md 的 Puzzle → Hextris。
- https://github.com/Hextris/hextris/tree/3f4847dc8fd7dab3d1c87e6324b9159d92fbd396

检索时核对 24 个原文文件的 SHA256 和 Git blob SHA1；最终 `vendor/hextris-original/upstream/` 保留 18 份第一方原文，作为公开仓库的源码参考，**不是网站运行目录**。六份未使用的第三方 vendor 依赖曾在初始 PR 中出现，已在合并前从最终源码树删除，只保留来源 hash 与排除记录。原版 HTML 中的历史追踪引用不会执行；公开运行入口已移除全部联网和旧依赖。

## 保留的完整玩法

- 六个方向落块、旋转中央六边形接块；4 种原始颜色。
- 相同颜色在同边内外相邻、相邻两边同层相邻时组成洪泛连通组；首尾边循环相邻；至少 3 块消除。
- 每次得分为块数平方乘连击倍率，原作连击窗口与彩色外环计时条。
- 原始随机、双列、对向、螺旋、整环、半环全部六种波形，包括原始切换逻辑。
- 原始随时间与消除加速的生成节奏、方块速度、难度到 35、四倍加速和无尽失败规则。
- 触屏 7 层、桌面 8 层，超过任意边容量结束。前三高分只在真实结束时写入。
- 原始 Canvas 几何、旋转惯性、碰撞、消除后落下、方块淡入淡出、震动、飘字。角度归一化改为等价常数时间取模，避免坏存档触发长循环。

没有导入关卡，没有人为完成按钮，没有假胜利。上层 `onComplete` 从不调用。

## 修改边界

`prepare-adaptation.py` 根据固定原文可重复生成公开 runtime；没有运行上游脚本、安装上游依赖或执行第三方构建。`fidelity-map.json` 列出逐文件/函数的精确保留与修改。

保留所有 gameplay 函数；原 jQuery UI、keypress 输入、JSONfn 存档、原主循环和初始化替换为原生隔离壳。原 `isInfringing` 原样复制；`addNewBlock` 仅移除开发回放日志，保留原速度乘数与构造。Hex 的开发回放日志换成只读观测计数。消除和接块位置新增计数，不改判断与分数公式。

主动冻结暂停时的 RAF，包括背景、渲染更新、生成、连击时间与物理；浏览器后台自动暂停，继续时重置墙钟，避免积攒时间跳跃。宿主暂停与手动/帮助/后台暂停相互独立，因切到宿主按钮产生的失焦不会导致重复暂停。浏览器前进/后退缓存会暂停保存并在恢复后保留操作能力，而非永久注销缓存页。RAF 每帧仍使用原 `(毫秒 / 16.666) × rush` 算法，只把异常卡顿单帧墙钟差限制到 50ms，避免恢复突跳。正常帧速和四倍加速不变。

重来创建新 Hex、waveGen 与列表，不重复绑定事件。离开 iframe 前保存并撤销 RAF/全部监听；React 卸载同时发送经过来源、窗口和会话校验的 dispose 消息。旧 iframe 销毁提供最终隔离。

响应式画布保持原平台常量。平台判断使用实际触屏/窄屏条件；窗口缩放一次性调整所有已有方块，暂停缩放不会逐帧推进。文字替换为中文系统字体与 HTML 语义按钮；卡片 SVG 为本站自绘。未引入原图片、字体、音频、分享或商店广告。

## 安全存档与隐私

运行时没有外部请求、动态脚本、分数上传、遥测或广告。CSP `connect-src 'none'`、字体/媒体/子框架/worker 禁止，脚本和样式只加载同目录静态文件。

存档键：`playgarden.hextris.original.save.v1`；记录键：`playgarden.hextris.original.records.v1`。所有存储读写捕获失败。存档为严格版本化 JSON，逐层精确字段白名单、数组容量与数值范围检查，拒绝未知字段、函数字符串和畸形值。恢复通过可信源码中的 `new Hex` / `new Block` / `new waveGen` 构造；波形名只能从六个固定名称中选择，计数满足原模式的整数或 1.5 步长，防止畸形螺旋计数变成非法方向索引。绝无 eval、Function 或按存档解析可执行代码。

保存保留得分、波形进度、难度、计时、位置、彩块、删除状态、连击、计数以及平台规则；缩放后的距离换算为基础尺寸，恢复时换算回当前画布。结束的帧会清除未完局存档，排行榜只包含真实结束成绩。复原不重放已计分消除；仍在淡出的块按原删除状态完成后续消除落下。一次性的飘字、震动和历史开发回放不序列化。直接点击“开始新局”会清除之前进度；点击“继续存档”才恢复。

旧存档的任何字段不会赋给方法或原型；不接收上游的通用 `saveState` / `highscores` 键，也不覆盖 `window.history`。损坏存档安全忽略并提示；存储不可用时仍可玩，但 UI 明确提示无法保留。

## 验证范围和交付边界

静态来源、字节校验、语法和独立组件/E2E 类型检查见 `hextris-static-validation.json`。一个 Playwright spec 包含真实桌面键鼠、真实移动触控，读取观察数据选择落点；仅用固定 LCG 随机种子稳定随机过程。不往引擎塞对象/成绩，不伪造成功存档。独立坏存档用例只注入无效 JSON。

浏览器、真实截图、完整宿主 build、实际 CI 和上线未在此隔离包运行。唯一集成者应注册正确 GPL 来源类型，追加 notices/source manifests，完成 `npm run build`，然后只运行一次 `npm run test:e2e -- e2e/hextris.spec.ts`。依据真实失败改动后仅重跑受影响旅程，审阅两端真实截图，再按既定发布流程处理。不要把本包静态检查当成浏览器通过。
