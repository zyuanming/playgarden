# 浏览器检查与题库扩展

`validate` 先运行类型检查、全量单元/DOM 测试及生产构建。选择器对公共外壳、目录、工具、未知依赖或手动检查使用 full 模式：8 片，最多同时 4 个作业。局部游戏变更使用 focused 模式，并保留当前存档/外壳 smoke。

focused 通常为 1 片；包含矩形花园 200 关时使用 4 片，测试仍覆盖所有 200 关的桌面与移动尺寸。`fullyParallel: true` 按完整测试场景划分；矩形花园每场最多 5 关、Slant 按尺寸 2–10 关、Lights Out 按章节，不会跨进程拆开一局。其他现有游戏的全部流程保留。单片成功不等于整个仓库通过。

完整执行：`npm run test:e2e`。单片：`npx playwright test --shard=1/8`。矩形聚焦：`npx playwright test e2e/shikaku-campaign.spec.ts e2e/current-save-smoke.spec.ts --shard=1/4`。`--list` 可核对各片实际分配，两种 viewport 均应出现。每个场景保持原 120 秒门槛，工作流 browser 保持 20 分钟，不用放宽超时掩盖过长流程。

截图和错误上下文按分片保存，失败 trace 单独保存，保留 3 天。正式发布的关键截图与机器验题摘要需另存。Pages 构建/预览测试通过，并且全部 browser 片通过后，现有 pages-deploy 才发布当前 main。validate/browser 保持只读 contents；仅原有部署作业持有 Pages 部署权限。不修改分支保护、凭据或权限。
