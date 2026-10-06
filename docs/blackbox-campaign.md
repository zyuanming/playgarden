# 星雾探测：84 关原创实验谜题

## 玩什么

从四边发射光束，根据 **吸收 ●、返回入口 ↩、从另一端出口** 的响应，推断隐藏星位。星位不会因为标记而改变。内部点选 ★ 星、× 空或擦除；不用拖动、不计时、不限制探测次数。撤销只回退标注，已经取得的实验记录保留。

这与大厅的光线实验室不同：光线实验室在可见布局里调整镜面连接目标；星雾探测要主动选择实验来了解看不见的布局。棋盘大小或星数变化不另计游戏。

填够指定星数后“验证星图”会检查所有边缘响应。若与既有记录矛盾，显示相应入口的真实响应和猜测响应；若矛盾尚未被探测过，补做这一项实验并计入探测数。失败不会判死局，随时修改、撤销或重来。贯通的入口和出口是同一条实验，反向回看不重复计数。

## 判题与提示的边界

Black Box 并不天然唯一。例如 3×3 两星 `[0,8]` 和 `[2,6]` 的全部边缘响应一致。生产判题按**固定星数及完整响应签名**判断，绝不把“是否等于预置星位”当作唯一标准。这个反例已用于生产回归与独立 oracle 自测。

这84道正式关卡都在相同大小、相同星数的全部组合中筛出唯一签名，再去除 D4 旋转/镜像重复。尽管题库已过滤，通用判题仍接受所有完整观测等价布局，以免未来关卡扩展造成误判。

提示函数只接收尺寸、总星数、玩家标记及已取得观测，接口不接收秘密星位：

1. 从固定星数的全部合法布局中按真实观测过滤候选，玩家猜测不参与过滤。
2. 若所有候选都含某格星位，提示该必然星；若玩家标星在所有候选中都为空，建议修正。
3. 否则按响应分桶，选让等概率候选的期望剩余数最小的探测入口。比较 `sum(bucketSize²)`，平局比较最大桶，再按端口顺序。
4. 只高亮并聚焦，不替玩家点击、标星或发射。所有候选完整响应相同而星位不同，明确提示等价性。

题库里的 `greedyProbes` 是这条确定策略实际获得唯一布局的实验数，**不是理论最少探测次数，也不是通关步数上限**。界面不以它设置惩罚。

## 章节与原创性

| 章 | 内容 | 尺寸/星数 | 关卡 | 证据策略范围 |
|---|---|---|---:|---:|
| 1 | 听懂一颗星 | 3×3 / 1 | 3 | 2 |
| 2 | 两颗星的影子 | 4×4 / 2 | 9 | 2–4 |
| 3 | 转弯遇上转弯 | 4×4 / 3 | 12 | 3–8 |
| 4 | 把视野放宽 | 5×5 / 2 | 16 | 2–5 |
| 5 | 让证据交汇 | 5×5 / 3 | 20 | 3–9 |
| 6 | 星雾深处 | 5×5 / 4 | 24 | 4–12 |

第一章恰好覆盖一星小盘的全部3个D4位置类，不靠转向副本凑关。其余各章在唯一签名且 D4 去重的候选中，按信息策略深度、边缘星数、正交相邻星对与返回信号分组，再确定性取样；章内从短证据链往长证据链排列。第四章扩大视野时退回两星，作为新尺寸的缓冲；不声称章节间难度严格单调。

固定种子散列、原始配置、完整响应签名、逐探测剩余候选数、分桶统计与布局结构指标在 `docs/blackbox/campaign.json`。生产只载入小体积关卡常量，不打包证明文件、oracle 或上游参考源码。

## 重现与验证

```sh
node scripts/blackbox/generate.mjs --check
node scripts/blackbox/verify-runtime.mjs /tmp/blackbox-runtime.json
python3 scripts/blackbox-independent/selftest.py --all-small-boards
python3 scripts/blackbox-independent/validate_campaign.py --repo . --output /tmp/blackbox-independent.json
python3 scripts/blackbox-independent/test_validator_mutations.py --repo .
npm run typecheck
npm test
npm run build -- --base=/playgarden/
npx playwright test e2e/blackbox-campaign.spec.ts
npx playwright test --config=playwright.pages.config.ts e2e-pages/blackbox-deployment.spec.ts
```

- Python oracle使用独立几何/边界算法，只读题库JSON，不导入生产JS。第二个自测模型采用带边框的一维数组和逐次90°转向，与第一个模型交叉检查。
- 题库检验重枚举15,939布局及315,988个端口；84关逐项核唯一性、全签名、D4去重、每一步探测策略、候选数、指标和runtime常量一致性。
- 生产 TypeScript 与独立Python对3–5格、1–4星的全部18,046布局/348,816端口逐项差分。输出向量每次动态生成，不保留大文件作为“真理表”。
- 独立双模型额外穷尽所有≤4×4任意星数及5×5的1–4星，共81,341布局、1,360,356端口；检查互逆、D4变换与边缘可达循环。盘内不可从边缘到达的循环确实存在，异常保护不会把循环伪装成返回。
- 保存数据验证完整标记历史、初始全空状态、端口/响应合法性和最终签名。无效JSON、伪造历史、跨关ID、重复或错误观测及未被合法标记见证的“完成”会回退新局。存储读写/删除失败不阻断继续玩；显式重来仍由freshStart生效。
- 所有84关有真实DOM和浏览器动作完成流程。浏览器覆盖1536×1024桌面及390×844触屏模拟、键盘/修饰键/焦点、重复事件、提示不代操作、暂停/刷新/换关、存储异常和完成幂等。控件按实际geometry检查至少44px，并验证页面不横向溢出与滚动可达。
- Pages预览及公网检查精确提交meta、生产子路径/资源MIME和末关中途恢复后真实完成。截图仍需人工像素复核；测试源码存在或单片成功都不是发布证明。真机触控与屏幕阅读器体验不在自动化保证范围内。

## 固定来源与资产许可

规则只读核对 Simon Tatham's Portable Puzzle Collection，固定提交 `a7c7826bce5cbb9b9c337c11b9b7f8b278e76fba`：

- [blackbox.c](https://github.com/notpeter/sgtatham-puzzles/blob/a7c7826bce5cbb9b9c337c11b9b7f8b278e76fba/blackbox.c)
- [puzzles.but](https://github.com/notpeter/sgtatham-puzzles/blob/a7c7826bce5cbb9b9c337c11b9b7f8b278e76fba/puzzles.but)
- [完整MIT许可](https://github.com/notpeter/sgtatham-puzzles/blob/a7c7826bce5cbb9b9c337c11b9b7f8b278e76fba/LICENCE)

副本与校验值保留在 `vendor/sgtatham-blackbox/`，完整作者与MIT许可随生产产物分发为 `blackbox-LICENCE.txt`，并列入THIRD_PARTY_NOTICES。未编译/执行/移植上游代码或上游题库；原游戏历史署名不授予商业品牌、包装、美术权利。

界面、中文教学、TypeScript实现、Python oracle、原创枚举题库与星雾插画均由本项目创作。插画源为 `scripts/blackbox/art.svg`，用官方npm包 `@resvg/resvg-js@2.6.2` 栅格化，再编码WebP；没有外部字体或图像。图中的两次偏转也对应合法布局与端口响应，而非错误规则示意。
