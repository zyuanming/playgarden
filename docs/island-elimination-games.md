# 数字留白与群岛海图

新增两个原创 MIT 益智模块，各 12 关。关卡尺寸依次为 3、3、4、4、4、5、5、5、5、6、6、6。实现、关卡、图形与测试均为项目原创；没有复制第三方游戏代码、关卡、图片、字体或音乐，没有新增依赖。

## 游戏契约

- `HitoriGarden.tsx` 默认导出 `HitoriGarden`，遵循 `GameProps`。
- `NurikabeGarden.tsx` 默认导出 `NurikabeGarden`，遵循 `GameProps`。
- `hitoriLogic.ts`、`nurikabeLogic.ts` 分别公开 `*Levels`、`create*State`、`set*Cell`、`cycle*Cell`、`undo*`、`valid*Level`、`valid*Board`、`*Conflicts`、`is*Solved`、`solve*`、`get*Hint`。
- 纯逻辑与 UI 分离。未知为 `-1`，白格/岛屿为 `0`，黑格/海水为 `1`。
- 为避免把未判断格误当答案，全部可编辑格都必须明确标记。群岛的数字格固定为岛屿。
- 点击、原生 Enter/空格循环标记；方向键使用单一 Tab 焦点移动；键盘 1/0、B/W 或 S/I 直接标记，Delete/Backspace 清空；亦可选格后使用大按钮操作。
- 暂停禁用棋盘与辅助按钮，暂停时收到的提示/撤销令牌会被消费而不会在恢复时重播。关卡或重置令牌变更创建全新局面。
- 最近 300 步可撤销。每次尝试通关回调最多触发一次，撤销后再次完成不重复计分，重置后可再次报告完成。

## 规则与搜索

数字留白：白格同行同列不允许重复数字；黑格不可上下左右相邻；所有白格四向连通。生产搜索对重复对、黑格邻接与白格可达性传播，再分支单格。

群岛海图：每个四向相连的岛恰有一个数字，面积等于数字；不同岛四向分离；海水四向连通，不可出现 2×2 全海水。生产搜索使用总面积、满岛边界、三海水方块、各岛可达区域和海水可连通性传播，再分支单格。

单次生产搜索的硬上限是 50,000 节点；提示的总预算是 12,000 节点（包括修复尝试）。结果区分 `complete`、`limit`、`budget`、`invalid`。只有穷尽当前局面所有可行解时才给出共同单格提示；预算耗尽或解数封顶不会被解释为矛盾。修复提示先证明当前局面无解，再找到清除单格后的具体可行解。提示不读取答案证书，也不自动改变棋盘。

## 独立验证

- `tests/fixtures/generateIslandElimination.py`：固定随机种子 2026100417 的原创关卡生成器。Hitori 独立枚举行掩码；Nurikabe 独立枚举连通岛形。可重现两组关卡及证书。
- `tests/fixtures/islandEliminationCertificates.ts`：24 个完整答案及独立搜索节点数，仅测试使用。
- `tests/fixtures/islandEliminationOracle.ts`：不导入生产运行时逻辑的第二套 TypeScript 验证器。Hitori 枚举完整行，Nurikabe 选择独立岛形，再检查全部规则。
- 独立验证器每关上限 200,000 节点，超限直接抛错，不会把截断误报为唯一解。
- 全部 24 关的独立结果恰有一个解，并与生产搜索逐格一致；生产搜索在每关均穷尽，且低于 12,000 节点。
- 穷尽所有 2×2 Hitori 数字棋盘及三态部分标记，逐一比对完成判定和所有可行解。
- 穷尽所有合法 2×2 Nurikabe 数字布局及三态部分标记，逐一比对完成判定和所有可行解。
- 24 关在 React StrictMode DOM 中按独立证书实际输入并通关。其余测试覆盖所有关卡提示与错误修复、零预算/截断、固定数字、历史不变性、暂停/恢复、重置、换关、令牌消费、键盘/点击和完成幂等。

## 自动化入口与验证边界

```sh
NODE_OPTIONS=--max-old-space-size=384 npx vitest run tests/islandEliminationGames.test.tsx --maxWorkers=1
NODE_OPTIONS=--max-old-space-size=512 npx tsc --noEmit --incremental false
```

2026-10-04：聚焦测试 62/62 通过，仓库 TypeScript 检查通过。未运行生产构建、真实浏览器、截图审查、真机或辅助技术检查；DOM 键盘测试不能代替完整无障碍验收。所有 CSS 使用 `ie-` 模块前缀并适配小屏与 reduced-motion。

DOM 入口：容器 `[data-island-game="hitori"|"nurikabe"]`，完成状态 `data-complete`；格子 `[data-hitori-cell="索引"]` / `[data-nurikabe-cell="索引"]`，属性 `data-value` 与 `data-fixed`；提示 `[data-island-hint="deduction"|"repair"|"unavailable"]`。
