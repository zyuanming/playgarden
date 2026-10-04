# 码符侦探与储能调度

SPDX-License-Identifier: MIT

本次模块的 TypeScript、DOM/SVG 插图与关卡均为原创，沿用仓库 MIT 许可证；不含外部图片、音频、字体、角色或运行时网络访问。

## 接入入口

- `CodeClues.tsx` 默认导出 `GameProps` 组件；建议稳定目录 ID `code-clues`，名称「码符侦探」。12 关，中文标签：推理 / 信息 / 数量。
- `EnergyDispatch.tsx` 默认导出 `GameProps` 组件；建议稳定目录 ID `energy-dispatch`，名称「储能调度」。12 关，中文标签：规划 / 能量 / 时间。
- 作者不修改共享目录、注册表、外壳或端到端测试；集成方加入目录后，以实际组件控件运行浏览器检查。

## 码符侦探

### 规则与教学

2–4 个槽位，2–5 种带形状和文字名称的符号。允许重复，猜测次数不限。反馈分为「就位」与「错位」：先统计位置正确，再按符号数量的交集扣除就位；同一个隐藏符号最多匹配一次。每条公开起始线索也使用同样的反馈形式。

第一关完整示范后，后续关卡只教调查数量、换位、排除和信息量，不提供整套答案。证书是含错误探索猜测的学习轨迹，不是每关只输入一次答案。所有 12 条完整轨迹均经 DOM 操作重放。获胜允许任意合法猜测历史。

### 提示边界

`publicCode()` 显式复制 `slots/symbols/initialClues`，不包含 `secret/certificate`。候选只来自这份公开数据与玩家反馈记录。`createCodeSearch` 比较所有合法猜测的反馈分组，最小化下一步最大分组；平局优先仍可能的答案，再按符号编号字典序。这是精确单步 minimax，**不是全局最优策略**。

最多 625 个猜测 × 625 个候选 = 390625 次评分。`step(budget)` 每次最多执行指定次数；UI 每 2048 次评分让出执行权。编辑、撤销、取消、暂停、重来、换关、卸载均使旧请求失效。没有搜索超时冒充「无解」。矛盾线索会明确报告，单候选可以直接提示。

### 证书与选择器

`codeCluesLevels[i].certificate.guesses` 为 `number[][]`，符号编号 0 圆、1 三角、2 方、3 菱、4 星。依次填写全部槽位并提交，包含每一步错误探索。真实答案仅用于判定新猜测；不会作为 UI data 属性暴露。

- `[data-code-clues-game]`，属性 `data-code-clues-won`、`data-code-clues-guesses`
- `[data-code-clues-slot="0"]`：原生 select，用 `selectOption(String(symbol))`
- `[data-code-clues-submit]`：提交一次
- `[data-code-clues-hint]`、`[data-code-clues-use-hint]`、`[data-code-clues-cancel]`
- `.cc-history .cc-feedback`：按时间排列的猜测与两个文字计数

撤销恢复一次草稿编辑或一次提交。胜利后不接受撤销和编辑，防止与外壳完成状态分离；记录仍可阅读。新一轮必须重来或换关。

## 储能调度

### 精确整数模型

每关公开全部时段的可再生供给、需求、发电单价，以及电池容量、初始电量、最终储备、发电/充放电功率上限、整数充电损耗和总预算。全部为独立字面量问题数据，不由证书派生。

动作 `{generator, battery}`：`generator` 是非负整数；`battery > 0` 是充电**输入**，`battery < 0` 是放电**输出**的负数，零为待机。动作的符号使同时充放电不可能。正充电必须输入大于固定损耗，以存入至少 1 单位。

每段：

1. 选定发电和电池动作，检查整数功率限制。
2. 可再生 + 发电 + 放电 ≥ 需求 + 充电输入；不足不得执行。
3. 新电量 = 旧电量 + 充电输入 − 正充电损耗 − 放电输出，必须在 0 与容量之间。待机和放电无损耗。
4. 弃电 = 可再生 + 发电 + 放电 − 需求 − 充电输入。弃电非负，不返还费用。
5. 费用增加 发电量 × 本段单价。执行全部时段，费用不超过预算且电量至少为储备即通过。

允许中途超预算与终局失败，以便用撤销修复。没有倒计时，所有单位/费用虚构；不是现实电网或金融建议。和静态预算配置、任务排程不同，核心状态是随时间变化且受功率、容量和损耗限制的可转移能量。

### 精确后缀 DP

最多 12 时段、容量 10。状态 `(time, charge)` 至多 13×11=143。每段最多 35 个动作；最多 12×11×35=4620 个尝试转移，低于 5005 上限。已花费用不参与 DP 维度，而是在提示时与最低后续费用相加。

提示不读取证书。若前缀仍可行，返回一条全局最低后续费用方案的第一步；不是只贪心当前最便宜。若失败，沿已执行历史找最近仍有预算内完整方案的前缀，准确报告至少撤销多少个时段。

### 证书与选择器

`energyDispatchLevels[i].certificate`：`{actions: {generator:number,battery:number}[], cost:number, finalCharge:number}`。按顺序选择发电与电池动作，逐段点击推进。此证书只供离线验证；所有其他满足预算和储备的方案同样通过。

- `[data-energy-dispatch-game]`，属性 `data-energy-dispatch-won/time/charge/cost`
- `[data-energy-dispatch-generator="0"]`：选择发电量
- `[data-energy-dispatch-battery="-2"]`：选择电池动作
- `[data-energy-dispatch-commit]`：推进一段
- `[data-energy-dispatch-preview]`：守恒与损耗预览
- `[data-energy-dispatch-period="0"]`：只读查看任意时段，通关后仍可用
- `[data-energy-dispatch-inspection]`：公开数据与已执行动作、储能、损耗、弃电和费用
- `[data-energy-dispatch-hint]`、`[data-energy-dispatch-use-hint]`

撤销一个已提交的完整时段，不撤销尚未提交的按钮选择。获胜后锁住执行与撤销，保留时间线检查。

## 自动化覆盖

独立重复符号消耗式反馈 oracle、单步 minimax 对照、最大搜索边界、秘密/证书破坏与 getter 陷阱、12 条完整学习轨迹、异步取消和过期结果防护。

独立逐步能量/费用守恒、前向最低费用 oracle、无记忆化短时域穷举 oracle、12 个完整调度证书、所有时段/电量/动作组合的物理转移对照、替代解、前缀死路与精确撤销距离。

两款均覆盖真实 DOM 控件、键盘、暂停/恢复、重来、换关、撤销、一次完成回调、StrictMode、获胜只读检查。控件最小高度 44px；原生焦点和按钮语义，非纯颜色反馈；小屏分列与减少动态效果规则。这里没有声称已完成真实浏览器截图、设备或屏幕阅读器验收。

## 本次本地验证记录

2026-10-04：`NODE_OPTIONS=--max-old-space-size=384 vitest run tests/codeClues.test.tsx tests/energyDispatch.test.tsx --maxWorkers=1` 通过 52 项测试；随后 `NODE_OPTIONS=--max-old-space-size=512 tsc --noEmit` 全项目类型检查通过。未启动浏览器或服务器，未执行远端写入；生产构建、目录接入与浏览器截图由集成阶段验证。
