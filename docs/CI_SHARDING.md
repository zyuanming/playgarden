# 浏览器检查与题库扩展

`validate` 先运行类型检查、全量单元/DOM 测试及生产构建。选择器对公共外壳、目录、工具、未知依赖或手动检查使用 full 模式：8 片，最多同时 4 个作业。局部游戏变更使用 focused 模式，并保留当前存档/外壳 smoke。

focused 通常为 1 片；包含矩形花园或林间帐篷 200 关时使用 4 片，测试仍覆盖各自全部 200 关的桌面与移动尺寸。`fullyParallel: true` 按完整测试场景划分；矩形花园和林间帐篷每场最多 5 关、Slant 按尺寸 2–10 关、Lights Out 按章节，不会跨进程拆开一局。其他现有游戏的全部流程保留。单片成功不等于整个仓库通过。

完整执行：`npm run test:e2e`。单片：`npx playwright test --shard=1/8`。矩形聚焦：`npx playwright test e2e/shikaku-campaign.spec.ts e2e/current-save-smoke.spec.ts --shard=1/4`。帐篷聚焦：`npx playwright test e2e/tents-campaign.spec.ts e2e/region-number.spec.ts e2e/current-save-smoke.spec.ts --shard=1/4`。`--list` 可核对各片实际分配，两种 viewport 均应出现。每个场景保持原 120 秒门槛，工作流 browser 保持 20 分钟，不用放宽超时掩盖过长流程。

截图和错误上下文按分片保存，失败 trace 单独保存，保留 3 天。正式发布的关键截图与机器验题摘要需另存。Pages 构建/预览测试通过，并且全部 browser 片通过后，现有 pages-deploy 才发布当前 main。validate/browser 保持只读 contents；仅原有部署作业持有 Pages 部署权限。不修改分支保护、凭据或权限。

## 林间帐篷的证据范围

新 `tents-campaign.spec.ts` 提供 40 场五关流程，两种 viewport 合计 80 场真实通关流程，另有两场中断/修复流程和一场当前十二关存档流程（两种尺寸均执行）。所有通关只点击真实棋盘控制，不注入组件、DOM 或存档状态；每一关核对行列计数、通关标记和已完成存档。每场末尾也实际点下一关，覆盖全部批次和章节边界，第 200 关验证返回大厅。旧 `region-number.spec.ts` 保留第 1、6、12 关以及所选格工具栏 smoke，其他游戏流程不变。

五章的首、中、末共 15 关分别保存开始与完成截图；第 12、200 关另保存键盘焦点、暂停、错误标记修复和当前状态提示截图。每种 viewport 至少 38 张帐篷专项截图。截图随现有只读 browser 作业上传，不能把测试清单、DOM 测试或未实际打开的 PNG 当成视觉验收。小格、行列数字与图标有尺寸/溢出断言；最终像素仍需查看 CI 产物。

`tests/tentsCampaign.test.ts` 通过真实 DOM 控件逐关完成 200 关，在每章首/中/末把答案证书属性改成抛错 getter，再验证当前状态提示、错误草地修复、撤销和重来，以确保运行时不读取证书。它同时锁定原十二关对象和现有 v2 成就索引。JSON 游戏数据只在静态依赖和游戏见证可追踪时参与 focused 选择；未知/删除/动态依赖继续 full。

## 花簇消除的证据范围

`samegame-campaign.spec.ts` 每场五关，两种既有 viewport 覆盖全部 100 关。点选、确认、暂停、取消、撤销、提示、重来、换关和刷新通过真实可访问控制完成，不注入组件状态伪造通关。每章首、中、末各保留开局、预览和完成截图；第 1、50、100 关额外保留暂停和当前局面提示证据。`samegame-deployment.spec.ts` 对生产路径及真实公开站点执行第 100 关中途刷新与实际完成。新目录/注册表/验证脚本触发原有 full 八片模式，原质量门禁和权限不变。

## 煎饼翻排的证据范围

`pancake-campaign.spec.ts` 每场五关，两个既有 viewport 覆盖全部 120 关。六章首、中、末保留开局、范围预览、完成截图，专项检查首段/中段/末关的键盘、暂停、撤销、当前局面提示、重来与刷新；仅使用真实可访问控制，不写存档伪造通关。`pancake-deployment.spec.ts` 在预览和真实公网执行末关中途刷新与完成，核精确提交 meta。目录/外壳可选重来信号/注册表/测试脚本变更触发原 full 八片，全量type/unit/build及原有游戏浏览器回归保持不变。

## 星雾探测的证据范围

`blackbox-campaign.spec.ts` 在两个既有viewport用真实边缘探测、逐格标星与提交验证覆盖84关，按短批次分配；新增规则/保存/生成器及目录变更继续触发full模式。规则唯一性不是靠浏览器答案注入验证：独立Python重枚举全部布局，生产核心另逐项差分18,046布局的所有响应，并回归一个完整观测等价答案。界面测试另查返回入口、互逆回看、冲突实验、当前证据提示、撤销保留证据、暂停/存档恢复/存储拒绝和终局幂等。部署专项覆盖84关末关的中断恢复与真实完成，最终SHA仍须全量CI、原始截图独审及公网一致后才算上线。

## Bounded original-image downloads

The original `browser-evidence-shard-N` artifacts and failure traces remain unchanged. Because some complete screenshot archives exceed the file-materialization limit, each browser job also packages every original `*.png` and `error-context.md` into deterministic, lossless ZIP parts. No pixels are resized, recompressed as images or omitted. `scripts/package-browser-evidence.py` caps each inner ZIP at 23 MiB; the upload service's outer ZIP stays comfortably below 32 MiB. Up to 8 explicit part upload steps are supported; a larger input fails visibly rather than truncating evidence.

Download `browser-evidence-index-shard-N` and all parts it lists. Verify the GitHub artifact digest, extract the outer artifact, then verify each inner ZIP against `index.json`. Its complete per-file map records original path, byte count and SHA-256; each part repeats its subset and the exact build commit. `index.sha256` checks the aggregate index. Missing directories make a valid empty index only when no evidence was produced; the independent browser job result still decides pass/fail. Original large bundles continue to be retained.

The packager rejects symlinks, unsafe/colliding paths, overlapping input/output, oversized single files, too many parts and nonempty output destinations. It checks file stability and CRCs, stages all results before an atomic directory handoff, and has standard-library-only tests for byte-perfect reconstruction, deterministic ZIPs and boundary/failure behavior.
