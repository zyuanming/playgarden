// SPDX-License-Identifier: MIT
import {
  sortConditions,
  sortDomain,
  type SortLevel,
  type SortProgram,
  type SortParcel,
} from "./conditionalSorterLogic";
const program = (
  pairs: [string, number][],
  otherwise: number,
): SortProgram => ({
  rules: pairs.map(([condition, bin]) => ({ condition, bin })),
  otherwise,
});
function level(
  title: string,
  lesson: string,
  size: 2 | 3,
  maxNumber: 2 | 4 | 6,
  bins: number,
  ids: string[],
  solution: SortProgram,
  goal: (p: SortParcel) => number,
): SortLevel {
  const draft: SortLevel = {
    title,
    lesson,
    shapes:
      size === 2 ? ["circle", "square"] : ["circle", "square", "triangle"],
    materials: size === 2 ? ["wood", "glass"] : ["wood", "glass", "metal"],
    numbers: Array.from({ length: maxNumber }, (_, i) => i + 1),
    bins,
    conditions: sortConditions
      .filter((c) => ids.includes(c.id))
      .map((c) => c.id),
    slots: solution.rules.length,
    solution,
    targets: [],
  };
  return { ...draft, targets: sortDomain(draft).map(goal) };
}
/** Goal functions encode the shipping brief independently of the certificates.
 * Domains are complete Cartesian products, never hand-picked examples. */
export const conditionalSorterLevels: SortLevel[] = [
  level(
    "圆件专线",
    "圆形包裹进 A 箱，其余进 B 箱。形状以外的属性不影响这次分拣。",
    2,
    2,
    2,
    ["circle", "square", "wood", "glass"],
    program([["circle", 0]], 1),
    (p) => (p.shape === "circle" ? 0 : 1),
  ),
  level(
    "单双号班车",
    "偶数号码进 B 箱，奇数号码进 A 箱。每种形状和材质都遵守这条规则。",
    2,
    4,
    2,
    ["circle", "glass", "odd", "even", "high", "low"],
    program([["even", 1]], 0),
    (p) => (p.number % 2 === 0 ? 1 : 0),
  ),
  level(
    "易碎优先",
    "所有玻璃件都进 C 箱。其余包裹中，圆形进 A 箱、方形进 B 箱。先命中的规则决定去向。",
    2,
    4,
    3,
    ["circle", "square", "wood", "glass", "odd", "even"],
    program(
      [
        ["glass", 2],
        ["circle", 0],
      ],
      1,
    ),
    (p) => (p.material === "glass" ? 2 : p.shape === "circle" ? 0 : 1),
  ),
  level(
    "号码先行",
    "3、4 号全进 B 箱；剩余的方形进 C 箱，剩余的圆形进 A 箱。试着比较规则交换前后。",
    2,
    4,
    3,
    ["circle", "square", "wood", "glass", "odd", "high", "low"],
    program(
      [
        ["high", 1],
        ["square", 2],
      ],
      0,
    ),
    (p) => (p.number >= 3 ? 1 : p.shape === "square" ? 2 : 0),
  ),
  level(
    "双条件窗口",
    "圆形玻璃进 C 箱，其他圆形进 A 箱，所有方形进 B 箱。“且”要求两个条件同时成立。",
    2,
    4,
    3,
    ["circle", "square", "wood", "glass", "odd", "circle-glass"],
    program(
      [
        ["circle-glass", 2],
        ["circle", 0],
      ],
      1,
    ),
    (p) => (p.shape !== "circle" ? 1 : p.material === "glass" ? 2 : 0),
  ),
  level(
    "四路调度",
    "从完整测试表推导三条规则。比较只改变材质、奇偶或形状的一对包裹，找出哪些条件会覆盖另一个条件。箱号和先后次序都需要你判断。",
    3,
    4,
    4,
    [
      "circle",
      "square",
      "triangle",
      "wood",
      "glass",
      "metal",
      "odd",
      "even",
      "high",
    ],
    program(
      [
        ["metal", 2],
        ["odd", 1],
        ["triangle", 0],
      ],
      3,
    ),
    (p) =>
      p.material === "metal"
        ? 2
        : p.number % 2
          ? 1
          : p.shape === "triangle"
            ? 0
            : 3,
  ),
  level(
    "方件例外",
    "这一关有相互重叠的属性。挑两件只差一个属性的包裹，观察目标箱何时改变；先处理的条件必须兼容所有目标。",
    3,
    4,
    4,
    [
      "circle",
      "square",
      "triangle",
      "wood",
      "glass",
      "metal",
      "odd",
      "even",
      "square-even",
    ],
    program(
      [
        ["square-even", 2],
        ["glass", 1],
        ["square", 0],
      ],
      3,
    ),
    (p) =>
      p.shape === "square" && p.number % 2 === 0
        ? 2
        : p.material === "glass"
          ? 1
          : p.shape === "square"
            ? 0
            : 3,
  ),
  level(
    "质数快件",
    "完整表包含 1–6 号包裹。质数是 2、3、5，1 不是质数。利用表格判断单条件与“且”条件怎样组合，不要只验证选中的一件。",
    3,
    6,
    4,
    [
      "circle",
      "square",
      "glass",
      "metal",
      "odd",
      "even",
      "high",
      "low",
      "prime",
      "metal-high",
    ],
    program(
      [
        ["prime", 0],
        ["metal-high", 2],
        ["circle", 1],
      ],
      3,
    ),
    (p) =>
      [2, 3, 5].includes(p.number)
        ? 0
        : p.material === "metal" && p.number >= 3
          ? 2
          : p.shape === "circle"
            ? 1
            : 3,
  ),
  level(
    "层层例外",
    "从表格归纳不同属性的例外关系。先比较同时满足两种候选条件的包裹，再决定规则先后；总共只有三条规则可用。",
    3,
    4,
    4,
    [
      "circle",
      "square",
      "triangle",
      "wood",
      "glass",
      "metal",
      "odd",
      "even",
      "glass-odd",
    ],
    program(
      [
        ["glass-odd", 3],
        ["triangle", 2],
        ["even", 1],
      ],
      0,
    ),
    (p) =>
      p.material === "glass" && p.number % 2
        ? 3
        : p.shape === "triangle"
          ? 2
          : p.number % 2 === 0
            ? 1
            : 0,
  ),
  level(
    "回到同一箱",
    "不同条件命中后可以去同一个箱，最后的否则也不必使用独占箱号。依据全部目标表推导四条规则，而不是按箱号一箱一条。",
    3,
    4,
    4,
    [
      "circle",
      "square",
      "triangle",
      "wood",
      "glass",
      "metal",
      "odd",
      "high",
      "low",
      "circle-glass",
    ],
    program(
      [
        ["circle-glass", 3],
        ["metal", 2],
        ["high", 1],
        ["square", 0],
      ],
      3,
    ),
    (p) =>
      p.shape === "circle" && p.material === "glass"
        ? 3
        : p.material === "metal"
          ? 2
          : p.number >= 3
            ? 1
            : p.shape === "square"
              ? 0
              : 3,
  ),
  level(
    "三角快件",
    "表格给出了每种包裹的目标。把具有相同去向的包裹按属性分组，再检查组与组重叠时应先测试哪个条件。四条规则需要共同覆盖完整范围。",
    3,
    6,
    4,
    [
      "circle",
      "square",
      "triangle",
      "wood",
      "glass",
      "metal",
      "odd",
      "even",
      "prime",
      "triangle-prime",
    ],
    program(
      [
        ["triangle-prime", 2],
        ["wood", 0],
        ["even", 3],
        ["square", 1],
      ],
      2,
    ),
    (p) =>
      p.shape === "triangle" && [2, 3, 5].includes(p.number)
        ? 2
        : p.material === "wood"
          ? 0
          : p.number % 2 === 0
            ? 3
            : p.shape === "square"
              ? 1
              : 2,
  ),
  level(
    "总调度挑战",
    "总调度只提供 54 种包裹的目标表和可选条件。请自行归纳四条有顺序的规则及否则去向。比较重叠属性的反例，证明每一类包裹都能正确到达。",
    3,
    6,
    4,
    [
      "circle",
      "square",
      "triangle",
      "wood",
      "glass",
      "metal",
      "odd",
      "even",
      "high",
      "prime",
      "metal-odd",
      "glass-high",
    ],
    program(
      [
        ["metal-odd", 3],
        ["glass-high", 2],
        ["square", 1],
        ["prime", 0],
      ],
      2,
    ),
    (p) =>
      p.material === "metal" && p.number % 2
        ? 3
        : p.material === "glass" && p.number >= 3
          ? 2
          : p.shape === "square"
            ? 1
            : [2, 3, 5].includes(p.number)
              ? 0
              : 2,
  ),
];
