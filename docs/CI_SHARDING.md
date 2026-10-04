# 浏览器检查如何扩展到 100 款游戏

类型检查、单元测试和构建先在 `validate` 作业执行一次。通过后，所有 Playwright 场景按 8 个分片分配，每片仍包含真实游戏操作；最多同时运行 4 个浏览器作业。桌面和触屏模拟两个项目都会参与分片，没有排除任何旧游戏或关卡。

`fullyParallel: true` 让 Playwright 按测试场景划分。每款游戏的一个场景会完整游玩该游戏的全部关卡，避免把单个关卡流程切断。验证总数必须按所有分片相加；不能把单片成功当作整个仓库通过。

本地完整执行：`npm run test:e2e`。

复现一片：`npx playwright test --shard=1/8`，将分子替换为 1–8。用 `--list` 可先检查分配。

截图和错误上下文按分片保存，失败追踪单独保存；保留 3 天，减少持续扩展带来的存储占用。需要长期留存的发布截图应另行保存。所有工作流权限仍只有 `contents: read`，checkout 不保留凭据，不部署网站。

参考：[Playwright 官方分片说明](https://playwright.dev/docs/test-sharding)、[GitHub Actions 矩阵说明](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/run-job-variations)。
