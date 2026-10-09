# Coil · 光迹围球

这是 Hakim El Hattab 的完整 Coil 无尽游戏的本地适配，不是同名教学原型。稳定 ID 为 `coil`，`endless: true`，`levelCount: 0`，`allowUndo: false`。不注册虚构关卡、不增加有限关卡总数、不调用外壳 `onComplete`。

## 固定来源

- 上游仓库：<https://github.com/leereilly/Coil>
- 固定提交：`ea6fd3afae10a6d8a53b07e82be4211619206ede`
- 对应树：`afe0a8ccbc5ee80f9429e9424692f6610b2d2e82`
- 原作者：Hakim El Hattab，2011，MIT；完整许可保存在 `public/coil-original/LICENSE.txt` 与 `vendor/coil-original/upstream/LICENSE`。
- 发现链：bobeff/open-source-games 的 Other lists → leereilly/games 的 Arcade → Coil；固定引用见 `vendor/coil-original/reference-commits.json`。
- 全仓 13 个 blob 已分类；10 个文本文件合计 147,210 字节精确留存于 `vendor/coil-original/upstream/`。原网页、CSS、jQuery 仅作非公开源快照，不是运行入口。

## 完整保留的玩法

保留原 `Player` 的 45 点光迹和 0.4 插值；真实自交路径、二次曲线填充及 Canvas cyan 像素检查，不替换成另一套“圈内点”规则。逻辑像素与画布位图 1:1，不使用 DPR 缩放。辅助点号、炸弹叉号和键盘光标位于独立 DOM 层，避免污染碰撞位图。

保留原 100 能量上限；捕获蓝球 +1，蓝球超时 −30，圈中炸弹 −30，炸弹自然到期只淡出。每个捕获基准 30 分、倍率每次 0.2、上限 ×4、同圈多球奖励、存活计分及原 FPS 因子均保留。难度随原时间因子增长，原生成器提高同时存在的球数。原文件声明但未生成的两种 mover 类型仍不另行启用或计数。

原始球体 sprite、光迹、粒子、计分气泡、完整死亡与重开路径保留。蓝球临近到期变黄的原反馈保留。无音频文件，也没有自行添加音频。

## 适配和兼容修正

1. 移除旧 jQuery、社交脚本、远程字体及未清权图片。原本可选的 WebGL 装饰关闭；核心 2D 游戏完整保留。新增背景为 CSS，卡片为原创 SVG。
2. 原初始化早于原型装配；改为 defer 顺序载入几何、原逻辑、桥接，在原型装配完成后显式 initialize。修复两处原隐式全局声明。
3. 原 rAF 每回调更新；现代 120 Hz 显示器会加速按帧逻辑。适配最多 60 次更新/秒，不累积补跑后台帧；保留原帧率计分与时间因子。这是明确记录的兼容修正。
4. Pointer Events 把 client 坐标按画布边界映射至逻辑坐标，支持 pointer capture/cancel、焦点丢失和触屏。只有游戏画布采用 touch-action:none。键盘方向键/WASD 驱动同一个连续光标，仍经原插值和光迹捕获；Enter/空格开始，Escape/P 暂停。
5. 窗口尺寸通过 ResizeObserver 适配，手机使用实际容器宽度，球仍为原 10px 半径。旋转时重映射现有物体坐标，不重开。HUD、菜单与按钮使用自适应 DOM；触点至少 44px。
6. 外壳暂停、游戏内暂停、页面隐藏分别记录，不互相错误恢复。暂停冻结输入、轨迹、球体年龄、难度、分数及所有动画，恢复平移时钟并重置上一帧时间。BFCache pagehide 只暂停，pageshow 恢复；真正卸载取消 rAF、观察器和全部监听。
7. 父子消息同时验证 origin、Window source、挂载 session；只向明确同源 origin 发送。重来重建 iframe；离开时发送 dispose 并移除整个 iframe。
8. 仅保存最高分、最近完成得分、完成局数，键为 `playgarden.coil.original.records`，版本 1。每秒及暂停/结束/退出时尽力保存，禁用存储不影响游玩。不保存或恢复进行中的游戏，不使用误导性的续玩标记。

## 代码和素材授权分开

- MIT：原 Coil 和 Point/Region 几何，原程序化 sprite、光迹、粒子绘制代码。
- GPL-3.0-only：Playgarden 中文 UI、CSS、iframe 外壳、现代输入与生命周期适配、记录保存、E2E、重现脚本及新 SVG 卡片。
- 只在 vendor 源快照：jQuery 1.6.2，采用其 MIT 许可，完整补充文本在 `vendor/coil-original/jquery-MIT-LICENSE.txt`；不进入运行包。
- 明确排除：上游 `images/background.jpg`、`images/texture.png`、`favicon.ico`，缺少独立素材来源清单；未下载、不分发。
- 不捆绑 Google Fonts 或任何外部字体；系统字体即可。

## 重现与验收

运行 `python3 scripts/coil/prepare-adaptation.py` 只对已审计文本应用可审读变换，不安装或运行上游项目。`python3 scripts/coil/verify-sources.py` 验证原 blob、SHA-256、保留核心函数及无远程运行依赖。

最终只执行 `npm run test:e2e -- e2e/coil.spec.ts` 一次，由唯一集成者负责。同一 journey 在 desktop 与 mobile 项目运行：原生键盘/鼠标/CDP 触屏、真实自交捕获、倍率、炸弹惩罚、自然超时死亡、暂停冻结、两种重开、记录保存、退出清理、重新进入、横向溢出、零第三方网络与截图。测试仅固定随机数源，不写得分/寿命/敌人/存储、不调用捕获或成功回调。

静态检查与 TypeScript 检查已单独记录。此交付阶段尚未执行浏览器、实际手机截图审看、整合构建或发布，不代表 E2E 通过；应在最终验收后更新状态。
