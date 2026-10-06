# 自由五子棋独立验证与原创教学题库

此目录完全独立于产品实现。Python 裁判没有导入、复制或调用产品运行时代码，也没有执行原报告列出的第三方引擎。规则依据为任务提供的研究交接，采用 15×15、黑先、双方交替、横竖双斜连续至少五子获胜、长连获胜、无禁手。

## 文件

- `oracle.py`：纯 Python 规则裁判、合法历史重播、悔棋、全部立即成五点、目标验证、全应手证书及几何规范化。
- `build_corpus.py`：24 个手工设计的局部教学形，生成合法黑先交替历史；补足手数的棋子必须远离教学区，并且不能增加任何初始一步成五点。
- `corpus.json`：完整题库。可直接用于实现。全部用户可见文字均为原创中文。
- `certificates.json`：12 个双威胁/两手胜题的所有合法对手应手及每种应手后的全部立即获胜点，不建议打入前端包。
- `test_oracle.py`：规则与题库测试，不需要第三方依赖。
- `export_fixtures.py` / `rule-fixtures.json`：66 个静态棋盘、210 份完整合法历史、7 份非法历史，可用于跨语言差分。
- 测试日志由运行命令与对应 CI 保留。
- `independent-review.md`：结果、语义、范围和局限。

## 运行

```sh
python3 scripts/gomoku-independent/build_corpus.py
python3 -m unittest discover -s scripts/gomoku-independent -p 'test_*.py'
python3 scripts/gomoku-independent/export_fixtures.py
```

## 格式契约

所有坐标都是从 0 开始的扁平索引：`row * 15 + col`。棋盘值是整数 `0` 空、`1` 黑、`2` 白。

每道题：

```ts
interface Exercise {
  id: string;
  title: string;
  chapter: 1 | 2 | 3 | 4;
  objective: 'win' | 'defend' | 'fork' | 'two';
  moves: number[]; // 从空棋盘开始的合法黑先交替历史，不是只列黑子/白子
  toMove: 1 | 2;   // 与历史长度严格一致，可从奇偶性推导
  goal: string;
  hint: string;
  solution: number;   // 推荐第一手
  solutions: number[];// 全部正确第一手，判题不应只比较 solution
  continuation: number[]; // 第一项为 solution；fork/two 为玩家、对手、玩家的三手示例
  concepts: string[];
  tacticalCells: number[]; // 局部教学结构，不含补足合法手数的远处棋子
  quietSetupCells: number[];
  proof: {
    initialOpponentWinningMoves: number[];
    winningPointsAfterSolution: number[];
    opponentRepliesVerified: number;
  };
}
```

`moves` 不得当作静态棋盘索引直接按同一种颜色渲染。重播后轮到哪方，玩家就使用哪方；`two-white-diagonal` 特意练习白棋。

## 目标的精确定义

设玩家是 `P`，对手是 `3-P`；`W(B,P)` 是在棋盘 `B` 中落下 `P` 后可以立即形成连续至少五子的全部空点集合。所有首手都必须合法。

- `win`：玩家本手形成至少一条连续五子或更长的线。
- `defend`：初始对方有立即成五点；玩家本手不终局，落子后对方的全部立即成五点都被消除。仅仅挡住某一条线不够。题库保证此类题玩家初始没有立即获胜着法。
- `fork`：玩家本手不终局，落子后玩家至少有两个不同立即成五点，且对方没有立即成五点。此章初始对手没有立即威胁，教学目标是识别构造完成的双威胁。
- `two`：玩家本手不终局，无论对方接下来走哪一个合法点，都不获胜/和棋，而且玩家下一手存在立即获胜着法。每题额外保证初始对方只有一个立即成五点，正确首手必须先守住那里。此章需要实际走完玩家第一手、对方防守、玩家第二手三手。

`fork` 和 `two` 的首手数学判定是等价的，不能宣传成不同规则。区别在教学起始条件与实际操作：主动制造威胁，或在迫切防守中制造威胁并下出后续。证明很短：对手一手最多占一个不同成五点，所以两个成五点至少保留一个；反过来，若只有一个点，对方就能占它。对手自己的即时胜利优先，因此还必须排除。

## 运行时接入建议

- 接受所有满足目标的合法首手，或比较 `solutions`；`fork-open-three` 的两端都是正确答案。
- `defend`/`fork` 当正确第一手完成时即可完成练习。`continuation` 对 fork 只是解释用的完整示例。
- `two` 第一手后，电脑优先堵住玩家成五点的最低索引，这是确定性的最佳防守示例。对手所有回应都已验证同样不能阻止下一手胜利。
- `two` 第二手必须真的形成至少五子才能通过；不能只因落在提示点之外的空格就完成，也不能把第一手完成双威胁当成整题通过。
- 做题失败不应让玩家丢失原题；重置题面可始终重播原始 `moves`。
