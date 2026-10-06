# 浏览器检查与题库扩展

`validate` 先运行类型检查、全量单元/DOM 测试及生产构建。选择器对公共外壳、目录、工具、未知依赖或手动检查使用 full 模式：8 片，最多同时 4 个作业。局部游戏变更使用 focused 模式，并保留当前存档/外壳 smoke。

focused 通常为 1 片；包含矩形花园或林间帐篷 200 关时使用 4 片，测试仍覆盖各自全部 200 关的桌面与移动尺寸。`fullyParallel: true` 按完整测试场景划分；矩形花园和林间帐篷每场最多 5 关、Slant 按尺寸 2–10 关、Lights Out 按章节，不会跨进程拆开一局。其他现有游戏的全部流程保留。单片成功不等于整个仓库通过。

完整执行：`npm run test:e2e`。单片：`npx playwright test --shard=1/8`。矩形聚焦：`npx playwright test e2e/shikaku-campaign.spec.ts e2e/current-save-smoke.spec.ts --shard=1/4`。帐篷聚焦：`npx playwright test e2e/tents-campaign.spec.ts e2e/region-number.spec.ts e2e/current-save-smoke.spec.ts --shard=1/4`。`--list` 可核对各片实际分配，两种 viewport 均应出现。每个场景保持原 120 秒门槛，工作流 browser 保持 20 分钟，不用放宽超时掩盖过长流程。

截图和错误上下文按分片保存，失败 trace 单独保存，保留 3 天。正式发布的关键截图与机器验题摘要需另存。Pages 构建/预览测试通过，并且全部 browser 片通过后，现有 pages-deploy 才发布当前 main。validate/browser 保持只读 contents；仅原有部署作业持有 Pages 部署权限。不修改分支保护、凭据或权限。

## 林间帐篷的证据范围

新 `tents-campaign.spec.ts` 提供 40 场五关流程，两种 viewport 合计 80 场真实通关流程，另有两场中断/修复流程和一场当前十二关存档流程（两种尺寸均执行）。所有通关只点击真实棋盘控制，不注入组件、DOM 或存档状态；每一关核对行列计数、通关标记和已完成存档。每场末尾也实际点下一关，覆盖全部批次和章节边界，第 200 关验证返回大厅。旧 `region-number.spec.ts` 保留第 1、6、12 关以及所选格工具栏 smoke，其他游戏流程不变。

五章的首、中、末共 15 关分别保存开始与完成截图；第 12、200 关另保存键盘焦点、暂停、错误标记修复和当前状态提示截图。每种 viewport 至少 38 张帐篷专项截图。截图随现有只读 browser 作业上传，不能把测试清单、DOM 测试或未实际打开的 PNG 当成视觉验收。小格、行列数字与图标有尺寸/溢出断言；最终像素仍需查看 CI 产物。

`tests/tentsCampaign.test.ts` 通过真实 DOM 控件逐关完成 200 关，在每章首/中/末把答案证书属性改成抛错 getter，再验证当前状态提示、错误草地修复、撤销和重来，以确保运行时不读取证书。它同时锁定原十二关对象和现有 v2 成就索引。JSON 游戏数据只在静态依赖和游戏见证可追踪时参与 focused 选择；未知/删除/动态依赖继续 full。
