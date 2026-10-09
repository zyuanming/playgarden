# 云端守护站：Server Survival 原作本地集成

## 实际范围

这是 Server Survival 的本地可玩集成：保留原作全部 **25 个战役关卡、26 类服务、真实流量模拟、经济/声誉/负载/攻击/故障/扩容/GPU 电力机制、生存与自由沙盒**。战役关卡定义、全部目标谓词与服务配置保持上游字节不变。不是外链卡片，也不是此前独立制作的 8 关教学改编；后者未注册，不应一并计数。自由生存与沙盒是同一款游戏的模式，不增加游戏或有限关卡数量。

原作从本站 `server-survival-full/index.html` 以同源 iframe 运行，外壳组件只按需加载；没有访问作者游戏站点。iframe 分离 DOM、样式和生命周期，不宣称它是隔绝同源可信脚本的安全沙箱。原作的三维画面、建设、拓扑规则与目标计算继续由原作代码执行。无 WebGL 时提供可读平面图及键盘/触屏建设台，模拟与目标仍是原作。

## 来源和许可，2026-10-09

- Server Survival：[pshenok/server-survival，固定 7804e5969e28267cd33837e023eb46fa65da72b7](https://github.com/pshenok/server-survival/tree/7804e5969e28267cd33837e023eb46fa65da72b7)，MIT，Copyright (c) 2025 Kostyantyn Pshenychnyy。实际使用的 73 份原始代码、样式、页面、语言文本、README、package 与 LICENSE 在 `vendor/server-survival-full/upstream/` 保留，逐文件 Git blob/字节数在 `sources.json`。没有执行上游安装脚本、测试或构建脚本。
- Three.js 使用与原作相同的 **r128**，不是宿主其余游戏使用的 r180。[固定 d4aa9e00ea29808534a3e082f602c544e5f2419c](https://github.com/mrdoob/three.js/tree/d4aa9e00ea29808534a3e082f602c544e5f2419c)，MIT，Copyright 2010–2021 Three.js Authors。官方原始 `build/three.js`、`build/three.min.js` 与完整 LICENSE 在 `vendor/three-r128/`，Git blob、SHA-256 和固定来源在其 `sources.json`。公开运行的 `three-local.js` 与官方 min 文件逐字节相同。可编辑原始模块见固定树的 `src/`，构建说明见同树 package.json 与 utils/build/rollup.config.js；不要求使用者只依靠压缩文件。
- 原作 Tailwind CDN 替换为静态 CSS。仅使用 [Tailwind CSS v3.4.17，固定 4f9f603e12b51cc53b8a09c7739b8f88c8eb87eb](https://github.com/tailwindlabs/tailwindcss/tree/4f9f603e12b51cc53b8a09c7739b8f88c8eb87eb) 的 MIT preflight 与调色板源码，原文件和许可保存在 `vendor/tailwind-static/`。项目原创 `scripts/server-survival/generate-utilities.py` 静态读取颜色文字并生成 473 条所需工具类；不会运行 Tailwind 或上游 JavaScript。10 个其他类均来自保留的原作样式，不是漏编译。
- 本地外壳、桥接器、静音适配器、无障碍建设台、平面图、静态 CSS 生成器、测试和新增文档，及对上游的项目改动，遵循 **GPL-3.0-only**。上游部分仍保留 MIT，不改写原许可证。卡片 `public/server-survival-art.svg` 为项目原创可编辑 SVG。

## 素材单独审计

运行时场景由原作 MIT JavaScript 中的 Three 几何、材质、文字/Canvas、内嵌 SVG 生成；未引入第三方模型、图片、纹理、字体文件或商业 ROM。原作配乐/MP3、README GIF 等二进制资源不在包内，其独立来源不能仅靠根 MIT 推断；声音服务被明确替换为静音兼容层，因此本版没有音乐或音效。字体使用系统字体，用户界面明确说明静音原因。没有独立下载的商标标识或冒称官方授权。

## 保留、改动及边界

`src/campaign/levels.js`、`src/campaign/objectives.js`、`src/config.js` 均保持上游字节不变；拓扑验证、实体、队列、重试、缓存、GPU、电力、事件和经济运行于本地原模块。`vendor/server-survival-full/sources.json` 精确记录全部实际修改的原文件。

主要改动：移除 CDN、启动网络守卫、分享入口与声音资源；本地化存储命名空间与容错；默认中文；固定 Three r128；将延迟突发请求改为随模拟时钟推进以服从外壳暂停；原作发出真实胜负后通知外壳；外壳允许自由选任一真实关卡，不假造先前通关；关闭自动教学弹窗；增加只调用原作 API 的建设/连接/升级/维修/扩容/拆除表单与最小 44px 触控。

原作战役和外壳进度分别保存。原作数据键限定为 `playgarden.server-survival.original.*`；外壳沿用宿主正常进度机制。外壳退出卸载 iframe，pagehide 释放绘制循环、计时器和 renderer。通信同时校验同源、发件窗口与随机会话 ID；胜利仅由真实战役结束事件报告一次。外壳暂停冻结输入、模拟与速度，恢复原状态。实时模拟不支持逐步撤销，元数据 `allowUndo: false`；可用实际拆除/断线，或重来。

自由模式保留原作浏览器保存/载入及 JSON 导出/导入；有限战役隐藏自由保存按钮以避免混用。浏览器禁止持久存储时会提示本次会话临时保存，不能保证刷新保留。导入存档只按原作规则恢复，不授予外壳战役通关。

## 操作

- 战役选择“原作25关”，先建设，再点“运行 1 倍”或“运行 3 倍”。
- 展开“键盘／触屏建设台”，选择服务及 X/Z 坐标，再建设。坐标在 −60..60，按 4 格对齐；选择连接起点和终点，实际许可与预算照常校验。
- 选中维护对象可升级、修复、扩容或拆除。原三维画布工具、移动、缩放及原作帮助仍保留。
- 上方“暂停/继续游戏”“重来”“提示”分别暂停完整原作、重建本关、解释真实当前目标；提示不代建、不写结果。
- “生存 / 沙盒”中从原菜单开始生存或沙盒。自由沙盒可用原保存按钮保存到本浏览器，再进游戏用“继续”载入。

## 验证与可复核命令

准备阶段完成静态源码/许可/blob 核验、TypeScript 严格检查、静态 AST 网络调用检查及本地模块解析。没有执行原作游戏、没有本地浏览器、没有运行单测或穷举。运行验收应由唯一集成者在最终代码上运行一次定向 `npm run test:e2e -- e2e/server-survival.spec.ts`，含 desktop/mobile；未通过之前不能宣称已可玩验收或已上线。

静态复核：

- `python scripts/server-survival/verify-sources.py`
- `node scripts/server-survival/audit-modules.cjs`，使用宿主已有 TypeScript/esbuild，仅解析，不执行游戏代码。
- `python scripts/server-survival/generate-utilities.py`，只生成静态 CSS。

定向 E2E 覆盖真实空网失败、首关/末关真实构建并胜利、非法连线拒绝、暂停冻结、重来预算恢复、键盘输入、手机触屏、无横向溢出、退出 iframe 卸载、刷新保留首末关通关且未玩关不获奖、沙盒实际保存/再进入载入的拓扑与预算比对、无页面异常、无远程 HTTP(S) 请求，保存首关/失败/末关/载入截图。测试读取只读快照，不注入内部状态、不写 localStorage、不调用隐藏获胜接口。没有对中间 23 关做完整通关或穷举验证的声称。

网络审查：HTML 无远程 script/link；模块图仅本地相对路径；游戏和桥接器 AST 无 fetch/XHR/WebSocket/EventSource/sendBeacon/Audio 调用。官方 Three 包保留通用资源加载能力，但原作未调用远程加载；CSP 明确 `connect-src 'none'`、`media-src 'none'`、`font-src 'none'`，运行验收另检查请求记录。源码注释里的 URL、SVG namespace 与 data favicon 不是远程资源请求。
