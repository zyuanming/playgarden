# Cube Composer / 方块函数工坊

完整移植 David Peter（sharkdp）的 Cube Composer，固定 commit `a891ffe5de79b072819da04718820d0452b9a201`。计 **1 款游戏、25 有限原关卡、6 章**，各章 4 / 4 / 5 / 3 / 5 / 4 关；不拆章计游戏，不生成或替换题目。

## 来源与许可

- 原作：https://github.com/sharkdp/cube-composer/tree/a891ffe5de79b072819da04718820d0452b9a201
- MIT，Copyright (c) 2015–2016 David Peter；完整原文在 `vendor/cube-composer-original/upstream/LICENSE` 与公开 `public/cube-composer-LICENSE.txt`。
- 溯源链：bobeff/open-source-games 固定 `3a9ab8fc892a2cdadf8989a72ba7624a11e39cec` 的 Other lists → leereilly/games 固定 `c67976ddcf6f7aef26dc3884116205ab9ef40f74` 的 Puzzle / cube-composer → 原作。两份目录原文保存在 `vendor/cube-composer-original/source-chain/`。
- 46 份固定版本原始文本均逐字保留，共 600343 字节；包括原始 PureScript 规则/关卡/胜利比较、原 HTML/CSS、CLI、构建清单、MIT 及原 SVG。
- `source-manifest.json` 记录每个文件的 Git blob、SHA256 与字节长度；`upstream-tree.json` 保留原树。
- 原作纯规则和题目为 MIT；`src/vendor/cubeComposerCore.ts` 是其带署名的 MIT TypeScript 翻译。中文 React UI、交互、存档、验证脚本与新绘制封面采用项目 GPL-3.0-only。

## 完整内容与规则映射

`src/games/cubeComposerLevelsData.json` 与上游数据清单完全一致，保留每关原 ID、英文名、难度、说明、initial、target、原数据表达式以及章节函数 ID 和原标签。`extract-levels.py --check` 重新静态读取六个 `.purs` 文件，比较全部字段；没有执行 PureScript。Chapter5 的数字列表只按原 1/2/4 位数据编码展开。

所有 28 个不同函数 ID、31 个按章出现的函数，均在 `cubeComposerCore.ts` 完整实现：

- 替换单色、单块变多块、逐列顶部添加；删除颜色后清掉空列；只保留含红整列；逐列上下翻转。
- Chapter2 `stackEqualColumns` 只合并连续相邻、整个数组逐项相等的组，每个候选都与组的原始第一列比较，不与增长中的合并结果比较。
- Chapter3 从底到顶不重叠扫描。`mapCXtoX` 消耗青块与其上方一块并保留后者，落单青块保留；`mapOOtoC` 两橙换青，落单橙保留；`mapXtoOX` 的新橙块放在原方块下方。
- Chapter4 稳定分区，先输出不含指定颜色的列，再输出含色列，两组内部的相对顺序都保留。
- Chapter5 只读取前三格，橙色为 0、其余为 1；底、中、顶权重 1/2/4。加、减、乘、平方通过保留低三位实现模 8，包括 0−1=7；筛偶数删除整列。
- 程序严格按数组顺序执行，当前章的每个函数 ID 最多用一次。不允许未知、跨章或重复 ID。全部中间墙含原始墙都能查看。
- 终局只比较完整程序最后结果与原目标的有序二维数组：列数、高度、顺序、颜色全相同才赢。查看历史步骤不影响终局计算，颜色总数相同也不会误判。

## 有意的界面适配

- 沿用站点 shell 的自由选关、前后关、暂停、重来、完成标记和退出。全部 25 关可直接选择，最后一关返回大厅。
- 自绘带立体侧面的 SVG 方块，列按数据顺序从左向右，每列从底向上。颜色有中文字及可访问的文字排列，不只依赖色觉。数字章另标每列十进制值。
- 原 PureScript/Sortable 拖放改为点击添加、移除和前移/后移按钮；触摸与键盘均可，不要求拖动。函数说明明确 `[下, 上]` 顺序。
- 每关程序和最多 100 次编辑历史存在 `playgarden.cube-composer.v1.round.<index>`，shell 使用相同 resumeKey。只保存允许的函数 ID，不保存计算墙或胜利标志；读档重新由原始墙计算。存储异常不阻碍当前局继续操作。
- 撤销、可撤销清空和规则提示是站点便利功能；提示不替用户执行程序，不注入解。完成后编辑锁定，重来可重新探索。
- 原关说明译为中文，原文完整保留在数据中。原作 GitHub 作者邀请的文字保留为说明；没有加入题目编辑器或额外生成关卡。

## 运行边界

未安装、运行或构建旧 PureScript 0.11.6、Bower、Gulp 工程；保留源码仅为许可、溯源与可编辑证据。原 Analytics、Google Fonts、ghbtns、Sortable、旧 DOM 包及第三方依赖不进入发布 bundle。不运行原 CLI solver，不把根 MIT 误套到未引入的依赖。运行时无外联字体、统计、iframe、fetch 或原始 HTML 注入。

## 验证与真实限制

已通过：固定预检包 SHA256；46 文件字节/哈希/Git blob；原 MIT 全文；25 关全部原数据与按章函数集静态等同性；所有函数 ID/中文标签存在；无运行时网络/HTML 注入；SVG XML；严格 TypeScript（含 E2E 类型）；独立 esbuild ESM/CSS 浏览器 bundle。

未执行：集成仓库 build、真实浏览器旅程、桌面/390px/320px截图审阅、CI、部署。当前环境不能开本地浏览器服务；最终浏览器验收交由唯一集成者的既有 GitHub CI。没有执行单元套件、穷举 solver、全关证明或旧游戏扫测。

`e2e/cube-composer.spec.ts` 只有一个目标旅程，在既有 desktop/mobile 两个项目各执行一次。手工推导输入实际完成原关 0.1、2.1、3.1、4.1、5.4，检查错误程序不通关、重复函数不可用、规则提示不改状态、增删/重排、全部中间态、撤销/清空/重来、暂停、键盘/真实触控按钮、进度保存、刷新、离开重进、320px布局与 pageerror。未注入程序、墙、得分、存档或完成标记，也没有运行求解器。该 spec 已编译，尚未跑浏览器，不能据此声称上述行为已实测通过。

唯一最终入口：`npm run test:e2e -- e2e/cube-composer.spec.ts`，PR body 加 `Final E2E: e2e/cube-composer.spec.ts`，交由现有定向 CI；不要同时再手工触发同一 revision。实际移动截图通过后才合并发布。
