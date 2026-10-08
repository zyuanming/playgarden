# 变词小径 · Word Ladder

## 玩法与区分

12 个手写关卡，每关有公开的有限英语词本和原创简短中文提示。每次必须只替换当前词的一个字母，字母长度、顺序不变，而且新词须在该关词本。达到目标词即成功。不限时、不限制游玩步数；允许所有合法路线、绕路与重新访问已走过的词。撤销收回最近一步，主动走回旧词则计入实际步数。

本模块是词语邻接图上的逐步变词规划。它既不是寻词花园的八方向格内找词，也不是进位字母的算术映射或码符侦探的隐藏密码反馈。没有给旧游戏换皮，不把同一关的多条路线计为新关。

## 关卡编排

下列是创作时的一条示例路线，供阅读理解，不是规则判题答案，也未执行自动全关求解。运行时规则不会与这些路线比较。

1. 猫咪去串门：CAT → COT → DOT → DOG；也可经 COG，BAT 是可退回的短岔路。
2. 帽子里的转弯：HAT → HIT → PIT → PIG；也可从 PAT 搭桥。
3. 两条小支流：PEN → PET → PAT → CAT；PAN → CAN 是另一条路。
4. 追着阳光走：DOG → LOG → LUG → BUG → BUN → SUN；HOG、HUG 构成另一支流。
5. 给冬天加点暖：COLD → CORD → CARD → WARD → WARM；WORD 也能通向 WARD。
6. 从头说到尾：HEAD → HEAL → TEAL → TELL → TALL → TAIL；另有 HEAT、SEAT、SEAL 的长桥。
7. 翻开一本书：BOOK → BOOT → BOAT → BEAT → BEAD → READ；COOK、COOL、COAL、COAT 构成长路。
8. 游向沙滩：FISH → DISH → DASH → CASH → CASE → CANE → SANE → SAND；也可以经 FIST、FAST、CAST。
9. 月亮拜访星星：MOON → MOAN → MOAT → BOAT → BEAT → BEAR → SEAR → STAR；SOON、NOON 帮助练习识别回头路。
10. 词义反方向：LOVE → COVE → CAVE → HAVE → HATE；LIVE、GIVE、GAVE 或 MORE、CARE 均可构成路线。
11. 东西之间的桥：EAST → VAST → VEST → WEST；观察 VEST 如何连接两个词群。
12. 穿过词语森林：GOAT → COAT → COAL → COOL → WOOL → WOOD → GOOD → GOLD → GOLF → WOLF；BOOK 支流和 WORD 支流带来不同长度的路线。

全部 3–4 字母词均为人工选择。少数较难的词带中文辅助，如 TEAL（蓝绿色）、SEAR（煎焦表面）。词本是本关明确的道路边界，不宣称是完整英语词典。正常化仅去首尾空格和转大写；输入错误不改变路径或步数。

## 提示、存档与输入

- 提示只在当前关公开词本上做有限 BFS，从当前词计算最短剩余距离，并填入一条最短路线的下一词。必须由玩家确认；不自动行走。开局最少步数由同一有限图计算，超出它仍可通关。
- 点击词卡只是填候选词，再点“走到这个词”；也可输入后按 Enter。词卡明确标出当前可走的邻词。按钮和输入框至少 44px；局部 CSS 全部以 `.wl-game` 约束。提交按钮使用深色字配浅黄绿底，不依赖全局 `.primary`。
- 无计时器或外部请求。暂停禁止输入及词卡操作。共享工具栏提供撤销、提示、重来、暂停和关卡切换。
- 以 `playgarden.word-ladder.v1.round.<index>` 存每关版本、关卡 ID 和实际词序列，不保存可信棋盘或胜利标记。恢复时从起词逐步回放和重新验证；遇到缺词、多字母变化、终点后追加步骤、错误版本或坏 JSON，整局回到起点。
- 存档最多写入 4096 步，且读取最多 40,000 字符，用于限制异常存档成本；游戏本身没有步数上限。超过可保存范围或浏览器拒绝存储时显示“最新步骤暂时无法保存”，不中断本页游玩和撤销。最近 14 个足迹可见，其余撤销记录仍在。

## 接入

将本目录 `src/games`、`public`、`docs`、`e2e` 的文件保持路径复制到仓库。由唯一集成人更新 catalog 的 `GAME_IDS` 与 registry：读取根目录 `metadata.json` 的展示字段，组件为 `lazy(() => import("../games/WordLadderGarden"))`。保留 `resumeKey`，才能通过共享大厅接回当前未完成关卡。无新依赖或上游源码。

## 原创与许可

经典 word-ladder 规则没有被宣称为发明。本次 TypeScript / React / CSS 实现、12 个小词本及教学文案、中文释义、SVG 图形均为独立编写，GPL-3.0-only。没有抓取词典，没有复制第三方源码或素材，也没有新运行时依赖。适用仓库根目录的完整 GPLv3 `LICENSE`。

## 验证边界

本 worker 未运行构建、安装、单元测试、campaign solver、浏览器或 E2E。只准备了 `e2e/word-ladder.spec.ts`，状态为 UNRUN。它使用真实填写、Enter、点击 / 触摸，覆盖第一关两条不同完成路线、非词本词和多字母错误不变状态、当前岔路提示、回访、暂停、撤销、刷新恢复、重来，以及两个代表性的四字母关卡；不注入胜利、不跑全部 12 关。

集成人在完整接入后按仓库约定执行一次最终针对性调用：`npm run test:e2e -- e2e/word-ladder.spec.ts`，由现有 desktop / mobile 项目覆盖两种尺寸。最终构建和这次 E2E 的结果应由集成人如实补充，不把准备好的测试当作已通过。
