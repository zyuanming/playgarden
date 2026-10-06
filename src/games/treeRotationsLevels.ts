// SPDX-License-Identifier: GPL-3.0-only
import type { TreeLevel } from "./treeRotationsLogic";
/** Goals and weights are public literals independent from solution witnesses. */
export const treeRotationsLevels: readonly TreeLevel[] = [
  {
    id: "tree-rotations-01",
    title: "直立的小树",
    lesson:
      "右边一条长链让最深的键需要更多比较。让右孩子上升，看看中序顺序是否改变。",
    order: [1, 2, 3],
    weights: [1, 1, 1],
    goal: {
      maxHeight: 2,
    },
    certificate: {
      moves: [
        {
          key: 1,
          direction: "left",
        },
      ],
      shortest: 1,
    },
  },
  {
    id: "tree-rotations-02",
    title: "弯折的枝条",
    lesson:
      "孩子朝向与祖父不同时，一次旋转可能还不够。先处理内部小弯，再整理整棵树。",
    order: [3, 1, 2],
    weights: [1, 1, 1],
    goal: {
      maxHeight: 2,
    },
    certificate: {
      moves: [
        {
          key: 1,
          direction: "left",
        },
        {
          key: 3,
          direction: "right",
        },
      ],
      shortest: 2,
    },
  },
  {
    id: "tree-rotations-03",
    title: "指定新树根",
    lesson:
      "树高与树根是两个独立条件。把键 3 提升到根，同时保留全部键的搜索顺序。",
    order: [1, 4, 2, 3],
    weights: [1, 1, 1, 1],
    goal: {
      maxHeight: 3,
      root: 3,
    },
    certificate: {
      moves: [
        {
          key: 2,
          direction: "left",
        },
        {
          key: 4,
          direction: "right",
        },
        {
          key: 1,
          direction: "left",
        },
      ],
      shortest: 3,
    },
  },
  {
    id: "tree-rotations-04",
    title: "每枝都要平衡",
    lesson: "只让整棵树变矮并不够：每个节点的左右子树高度差都必须至多 1。",
    order: [1, 2, 3, 4, 5],
    weights: [1, 1, 1, 1, 1],
    goal: {
      maxHeight: 3,
      balanced: true,
    },
    certificate: {
      moves: [
        {
          key: 1,
          direction: "left",
        },
        {
          key: 2,
          direction: "left",
        },
      ],
      shortest: 2,
    },
  },
  {
    id: "tree-rotations-05",
    title: "夹在中间的枝",
    lesson:
      "旋转会把上升节点的内侧子树交给下降的旧父节点。它不会消失，也不能留在原来的父节点下。",
    order: [5, 2, 1, 4, 3],
    weights: [1, 1, 1, 1, 1],
    goal: {
      maxHeight: 3,
      balanced: true,
      root: 3,
    },
    certificate: {
      moves: [
        {
          key: 4,
          direction: "right",
        },
        {
          key: 2,
          direction: "left",
        },
        {
          key: 5,
          direction: "right",
        },
      ],
      shortest: 3,
    },
  },
  {
    id: "tree-rotations-06",
    title: "先升哪个节点",
    lesson:
      "同样五个键可以有不同的合格树形。规划局部调整，不必强求唯一一张图。",
    order: [2, 1, 3, 5, 4],
    weights: [1, 1, 1, 1, 1],
    goal: {
      maxHeight: 3,
      balanced: true,
    },
    certificate: {
      moves: [
        {
          key: 2,
          direction: "left",
        },
      ],
      shortest: 1,
    },
  },
  {
    id: "tree-rotations-07",
    title: "六键展枝",
    lesson:
      "六个键的平衡树不必左右完全对称。注意高度是最长搜索路径上的节点数。",
    order: [6, 1, 5, 2, 4, 3],
    weights: [1, 1, 1, 1, 1, 1],
    goal: {
      maxHeight: 3,
      balanced: true,
    },
    certificate: {
      moves: [
        {
          key: 1,
          direction: "left",
        },
        {
          key: 1,
          direction: "left",
        },
        {
          key: 2,
          direction: "left",
        },
        {
          key: 5,
          direction: "right",
        },
        {
          key: 6,
          direction: "right",
        },
      ],
      shortest: 5,
    },
  },
  {
    id: "tree-rotations-08",
    title: "深处先整理",
    lesson:
      "这棵树的根附近看起来宽松，真正的长链藏在右子树内。选择任何节点进行局部旋转。",
    order: [2, 1, 6, 3, 5, 4],
    weights: [1, 1, 1, 1, 1, 1],
    goal: {
      maxHeight: 3,
      balanced: true,
      root: 4,
    },
    certificate: {
      moves: [
        {
          key: 5,
          direction: "right",
        },
        {
          key: 3,
          direction: "left",
        },
        {
          key: 6,
          direction: "right",
        },
        {
          key: 2,
          direction: "left",
        },
      ],
      shortest: 4,
    },
  },
  {
    id: "tree-rotations-09",
    title: "七键树冠",
    lesson:
      "七个键限制到三层后，每个位置都很珍贵。用旋转把长链展开成完整的树冠。",
    order: [1, 7, 2, 6, 3, 5, 4],
    weights: [1, 1, 1, 1, 1, 1, 1],
    goal: {
      maxHeight: 3,
      balanced: true,
    },
    certificate: {
      moves: [
        {
          key: 5,
          direction: "right",
        },
        {
          key: 3,
          direction: "left",
        },
        {
          key: 7,
          direction: "right",
        },
        {
          key: 1,
          direction: "left",
        },
        {
          key: 7,
          direction: "right",
        },
        {
          key: 6,
          direction: "right",
        },
        {
          key: 2,
          direction: "left",
        },
      ],
      shortest: 7,
    },
  },
  {
    id: "tree-rotations-10",
    title: "热门键优先",
    lesson:
      "每个键有访问权重，成本等于权重乘深度的总和。键 2 很热门，最矮的树未必最便宜。",
    order: [4, 2, 6, 1, 3, 5, 7],
    weights: [1, 8, 1, 1, 1, 1, 1],
    goal: {
      maxHeight: 4,
      maxCost: 26,
    },
    certificate: {
      moves: [
        {
          key: 4,
          direction: "right",
        },
      ],
      shortest: 1,
    },
  },
  {
    id: "tree-rotations-11",
    title: "双热点路线",
    lesson: "键 2 和键 6 都常被查找。兼顾两条搜索路线，在四层以内压低总成本。",
    order: [7, 6, 5, 4, 3, 2, 1],
    weights: [1, 7, 1, 1, 1, 6, 1],
    goal: {
      maxHeight: 4,
      maxCost: 35,
    },
    certificate: {
      moves: [
        {
          key: 3,
          direction: "right",
        },
        {
          key: 5,
          direction: "right",
        },
        {
          key: 4,
          direction: "right",
        },
        {
          key: 7,
          direction: "right",
        },
        {
          key: 6,
          direction: "right",
        },
      ],
      shortest: 5,
    },
  },
  {
    id: "tree-rotations-12",
    title: "平衡与代价",
    lesson:
      "同时满足逐节点平衡、四层上限和加权成本。公开权重决定目标，任何达标树形都可以。",
    order: [5, 1, 7, 2, 6, 4, 3],
    weights: [5, 1, 1, 7, 1, 1, 4],
    goal: {
      maxHeight: 4,
      balanced: true,
      maxCost: 44,
    },
    certificate: {
      moves: [
        {
          key: 1,
          direction: "left",
        },
        {
          key: 2,
          direction: "left",
        },
        {
          key: 5,
          direction: "right",
        },
        {
          key: 7,
          direction: "right",
        },
        {
          key: 5,
          direction: "left",
        },
      ],
      shortest: 5,
    },
  },
];
