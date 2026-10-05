// SPDX-License-Identifier: MIT
import type {
  BagEvent,
  BagTarget,
  ProbabilityBagLevel,
  Rational,
} from "./probabilityBagLogic";
const t = (label: string, event: BagEvent, target: Rational): BagTarget => ({
  label,
  event,
  target,
});
const single = (colors: number[]): BagEvent => ({ kind: "single", colors });
const conditional = (colors: number[], given: number[]): BagEvent => ({
  kind: "conditional",
  colors,
  given,
});
const pair = (
  rule: Extract<BagEvent, { kind: "pair" }>["rule"],
  replacement: boolean,
  colors?: number[],
): BagEvent => ({ kind: "pair", rule, replacement, colors });
export const probabilityBagLevels: readonly ProbabilityBagLevel[] = [
  {
    id: "pb-01",
    title: "一半是什么",
    lesson: "概率是符合条件的片数占全部片数的比例。其余两种片也要留在袋里。",
    size: 6,
    initial: [1, 1, 1],
    minimum: [0, 1, 1],
    targets: [t("一次抽到 A", single([0]), [1, 2])],
  },
  {
    id: "pb-02",
    title: "合并两个事件",
    lesson:
      "A 与 B 不会在同一次抽取中同时出现，所以“抽到 A 或 B”的片数可以直接相加。",
    size: 8,
    initial: [1, 1, 1],
    minimum: [1, 1, 1],
    maximum: [3, 8, 8],
    targets: [t("一次抽到 A 或 B", single([0, 1]), [3, 4])],
  },
  {
    id: "pb-03",
    title: "缩小观察范围",
    lesson: "“已知不是 A”会改变分母：只在 B 和 C 中比较比例。",
    size: 9,
    initial: [1, 1, 1],
    targets: [
      t("一次抽到 A", single([0]), [1, 3]),
      t("已知抽到 B 或 C，抽到 B", conditional([1], [1, 2]), [1, 3]),
    ],
  },
  {
    id: "pb-04",
    title: "抽后不放回",
    lesson:
      "每一片都有独立身份。同类型的第二片只有 n−1 个选择，不能再次抽到手里的那一片。",
    size: 6,
    initial: [1, 1, 1],
    minimum: [1, 1, 1],
    targets: [t("两次同类型（不放回）", pair("same", false), [1, 5])],
  },
  {
    id: "pb-05",
    title: "两个顺序都算",
    lesson:
      "“A 和 B 各一片”包含先 A 后 B，以及先 B 后 A。两条互斥路径的概率相加。",
    size: 6,
    initial: [1, 1, 1],
    minimum: [1, 1, 1],
    targets: [
      t(
        "A、B 各一片（不放回，不计先后）",
        pair("oneEach", false, [0, 1]),
        [2, 5],
      ),
    ],
  },
  {
    id: "pb-06",
    title: "先后不能交换",
    lesson: "这次只要先 A 后 B。反向结果不算成功，因此不能乘 2。",
    size: 8,
    initial: [2, 1, 1],
    minimum: [1, 1, 1],
    targets: [
      t("先 A 后 B（不放回）", pair("ordered", false, [0, 1]), [3, 14]),
    ],
  },
  {
    id: "pb-07",
    title: "放回改变了什么",
    lesson: "放回并重新混匀后，第二次仍有 N 片。两次相同类型也允许是同一片。",
    size: 6,
    initial: [1, 1, 1],
    minimum: [1, 1, 1],
    targets: [t("两次同类型（放回）", pair("same", true), [7, 18])],
  },
  {
    id: "pb-08",
    title: "至少一次",
    lesson:
      "至少一次 A = 1 − 两次都不是 A。注意本关放回；再用条件概率分配剩余片。",
    size: 8,
    initial: [1, 1, 1],
    targets: [
      t("至少一次 A（放回）", pair("atLeastOne", true, [0]), [7, 16]),
      t("已知抽到 B 或 C，抽到 B", conditional([1], [1, 2]), [2, 3]),
    ],
  },
  {
    id: "pb-09",
    title: "有限材料",
    lesson:
      "同类型事件对 A、B、C 的名字不敏感，但材料点数不同。用预算区分可行配置。",
    size: 9,
    initial: [1, 1, 1],
    minimum: [1, 1, 1],
    costs: [3, 2, 1],
    budget: 16,
    targets: [t("两次同类型（不放回）", pair("same", false), [5, 18])],
  },
  {
    id: "pb-10",
    title: "两种实验协议",
    lesson: "每条目标都标明是否放回。同一个袋子要同时满足两种不同的实验规则。",
    size: 10,
    initial: [2, 2, 2],
    targets: [
      t("至少一次 A（不放回）", pair("atLeastOne", false, [0]), [2, 3]),
      t("先 B 后 C（放回）", pair("ordered", true, [1, 2]), [2, 25]),
      t("已知抽到 B 或 C，抽到 B", conditional([1], [1, 2]), [1, 3]),
    ],
  },
  {
    id: "pb-11",
    title: "平方与相邻乘积",
    lesson:
      "同类不放回使用 n(n−1)，异类放回使用 n₁n₂。结合至少 4 个 A 的条件推理。",
    size: 12,
    initial: [2, 2, 2],
    minimum: [4, 1, 1],
    targets: [
      t("两次同类型（不放回）", pair("same", false), [19, 66]),
      t(
        "A、C 各一片（放回，不计先后）",
        pair("oneEach", true, [0, 2]),
        [5, 24],
      ),
    ],
  },
  {
    id: "pb-12",
    title: "设计一个公平实验",
    lesson:
      "把条件比例、不同类型的配对概率和材料预算一起满足。所有计算使用精确分数，运气不会决定过关。",
    size: 15,
    initial: [3, 3, 3],
    minimum: [1, 1, 1],
    costs: [3, 2, 1],
    budget: 28,
    targets: [
      t("已知抽到 A 或 B，抽到 A", conditional([0], [0, 1]), [4, 9]),
      t("两次不同类型（不放回）", pair("different", false), [74, 105]),
    ],
  },
];
