// SPDX-License-Identifier: MIT
import type { PaperLevel } from "./paperFoldLogic";
/** Authored public targets are literals, never reconstructed from certificates. */
export const paperFoldLevels: readonly PaperLevel[] = [
  {
    id: "paper-fold-01",
    title: "第一道折痕",
    lesson: "折叠后同一叠层中的两个原格会一起被打穿。先找目标孔之间的对称线。",
    width: 4,
    height: 2,
    maxFolds: 1,
    maxPunches: 1,
    creases: [
      {
        id: "A",
        axis: "x",
        at: 2,
        side: "low",
      },
      {
        id: "B",
        axis: "y",
        at: 1,
        side: "low",
      },
    ],
    target: [1, 2],
    certificate: {
      actions: [
        {
          kind: "fold",
          crease: "A",
        },
        {
          kind: "punch",
          cell: 2,
        },
        {
          kind: "unfold",
        },
      ],
    },
  },
  {
    id: "paper-fold-02",
    title: "偏心小翻页",
    lesson: "折痕不必平分纸张。上边一行翻下后，底边仍然保持单层。",
    width: 4,
    height: 3,
    maxFolds: 1,
    maxPunches: 1,
    creases: [
      {
        id: "A",
        axis: "y",
        at: 1,
        side: "low",
      },
      {
        id: "B",
        axis: "x",
        at: 2,
        side: "high",
      },
      {
        id: "C",
        axis: "y",
        at: 2,
        side: "high",
      },
    ],
    target: [0, 4],
    certificate: {
      actions: [
        {
          kind: "fold",
          crease: "A",
        },
        {
          kind: "punch",
          cell: 4,
        },
        {
          kind: "unfold",
        },
      ],
    },
  },
  {
    id: "paper-fold-03",
    title: "四层交点",
    lesson: "两条垂直折痕可以把四个相距的原格放在同一处。判断它们共同的落点。",
    width: 4,
    height: 4,
    maxFolds: 2,
    maxPunches: 1,
    creases: [
      {
        id: "A",
        axis: "x",
        at: 2,
        side: "high",
      },
      {
        id: "B",
        axis: "y",
        at: 2,
        side: "high",
      },
      {
        id: "C",
        axis: "x",
        at: 2,
        side: "low",
      },
      {
        id: "D",
        axis: "y",
        at: 2,
        side: "low",
      },
    ],
    target: [5, 6, 9, 10],
    certificate: {
      actions: [
        {
          kind: "fold",
          crease: "A",
        },
        {
          kind: "fold",
          crease: "B",
        },
        {
          kind: "punch",
          cell: 5,
        },
        {
          kind: "unfold",
        },
      ],
    },
  },
  {
    id: "paper-fold-04",
    title: "一双与一单",
    lesson:
      "目标包含一对孔和一个孤立孔。利用偏心折叠保留下来的单层区，分配两次打孔。",
    width: 5,
    height: 3,
    maxFolds: 1,
    maxPunches: 2,
    creases: [
      {
        id: "A",
        axis: "x",
        at: 1,
        side: "low",
      },
      {
        id: "B",
        axis: "x",
        at: 4,
        side: "high",
      },
      {
        id: "C",
        axis: "y",
        at: 1,
        side: "low",
      },
    ],
    target: [10, 11, 14],
    certificate: {
      actions: [
        {
          kind: "fold",
          crease: "A",
        },
        {
          kind: "punch",
          cell: 11,
        },
        {
          kind: "punch",
          cell: 14,
        },
        {
          kind: "unfold",
        },
      ],
    },
  },
  {
    id: "paper-fold-05",
    title: "同向纸带",
    lesson:
      "先把纸带合半，再翻转边缘的一叠。已经叠好的纸层会作为整体再次反射。",
    width: 6,
    height: 2,
    maxFolds: 2,
    maxPunches: 1,
    creases: [
      {
        id: "A",
        axis: "x",
        at: 3,
        side: "low",
      },
      {
        id: "B",
        axis: "x",
        at: 5,
        side: "high",
      },
      {
        id: "C",
        axis: "x",
        at: 3,
        side: "high",
      },
      {
        id: "D",
        axis: "y",
        at: 1,
        side: "low",
      },
    ],
    target: [0, 1, 4, 5],
    certificate: {
      actions: [
        {
          kind: "fold",
          crease: "A",
        },
        {
          kind: "fold",
          crease: "B",
        },
        {
          kind: "punch",
          cell: 4,
        },
        {
          kind: "unfold",
        },
      ],
    },
  },
  {
    id: "paper-fold-06",
    title: "六孔配方",
    lesson:
      "五列纸的中间折线留下宽度不同的区域。一次四层孔和一次两层孔组成目标。",
    width: 5,
    height: 4,
    maxFolds: 2,
    maxPunches: 2,
    creases: [
      {
        id: "A",
        axis: "x",
        at: 2,
        side: "low",
      },
      {
        id: "B",
        axis: "y",
        at: 2,
        side: "low",
      },
      {
        id: "C",
        axis: "x",
        at: 3,
        side: "high",
      },
      {
        id: "D",
        axis: "y",
        at: 2,
        side: "high",
      },
    ],
    target: [4, 6, 7, 11, 12, 19],
    certificate: {
      actions: [
        {
          kind: "fold",
          crease: "A",
        },
        {
          kind: "fold",
          crease: "B",
        },
        {
          kind: "punch",
          cell: 12,
        },
        {
          kind: "punch",
          cell: 19,
        },
        {
          kind: "unfold",
        },
      ],
    },
  },
  {
    id: "paper-fold-07",
    title: "八层窗口",
    lesson: "第三道折痕把一条四层纸带再次翻下。打孔前用原格列表核对八个位置。",
    width: 6,
    height: 4,
    maxFolds: 3,
    maxPunches: 1,
    creases: [
      {
        id: "A",
        axis: "x",
        at: 3,
        side: "low",
      },
      {
        id: "B",
        axis: "x",
        at: 5,
        side: "high",
      },
      {
        id: "C",
        axis: "y",
        at: 2,
        side: "low",
      },
      {
        id: "D",
        axis: "x",
        at: 3,
        side: "high",
      },
    ],
    target: [6, 7, 10, 11, 12, 13, 16, 17],
    certificate: {
      actions: [
        {
          kind: "fold",
          crease: "A",
        },
        {
          kind: "fold",
          crease: "B",
        },
        {
          kind: "fold",
          crease: "C",
        },
        {
          kind: "punch",
          cell: 16,
        },
        {
          kind: "unfold",
        },
      ],
    },
  },
  {
    id: "paper-fold-08",
    title: "长边留白",
    lesson:
      "折叠只把一部分原格配对。最后一行仍与上面的四层区不同，不能把所有孔都当成四重。",
    width: 4,
    height: 5,
    maxFolds: 2,
    maxPunches: 2,
    creases: [
      {
        id: "A",
        axis: "x",
        at: 2,
        side: "high",
      },
      {
        id: "B",
        axis: "y",
        at: 2,
        side: "low",
      },
      {
        id: "C",
        axis: "y",
        at: 3,
        side: "high",
      },
      {
        id: "D",
        axis: "x",
        at: 2,
        side: "low",
      },
    ],
    target: [4, 7, 8, 11, 17, 18],
    certificate: {
      actions: [
        {
          kind: "fold",
          crease: "A",
        },
        {
          kind: "fold",
          crease: "B",
        },
        {
          kind: "punch",
          cell: 8,
        },
        {
          kind: "punch",
          cell: 17,
        },
        {
          kind: "unfold",
        },
      ],
    },
  },
  {
    id: "paper-fold-09",
    title: "三页风琴",
    lesson:
      "两端依次向中间折，形成三层而非四层。读清楚原格映射，再选两处不同的行。",
    width: 6,
    height: 4,
    maxFolds: 2,
    maxPunches: 2,
    creases: [
      {
        id: "A",
        axis: "x",
        at: 2,
        side: "low",
      },
      {
        id: "B",
        axis: "x",
        at: 4,
        side: "high",
      },
      {
        id: "C",
        axis: "y",
        at: 2,
        side: "low",
      },
      {
        id: "D",
        axis: "y",
        at: 2,
        side: "high",
      },
    ],
    target: [1, 2, 5, 12, 15, 16],
    certificate: {
      actions: [
        {
          kind: "fold",
          crease: "A",
        },
        {
          kind: "fold",
          crease: "B",
        },
        {
          kind: "punch",
          cell: 2,
        },
        {
          kind: "punch",
          cell: 15,
        },
        {
          kind: "unfold",
        },
      ],
    },
  },
  {
    id: "paper-fold-10",
    title: "上下短折",
    lesson:
      "上下各一条短边可以独立翻入；先后次序可能不同，但展开后的目标孔必须完全相同。",
    width: 5,
    height: 5,
    maxFolds: 3,
    maxPunches: 2,
    creases: [
      {
        id: "A",
        axis: "x",
        at: 2,
        side: "low",
      },
      {
        id: "B",
        axis: "y",
        at: 1,
        side: "low",
      },
      {
        id: "C",
        axis: "y",
        at: 4,
        side: "high",
      },
      {
        id: "D",
        axis: "x",
        at: 3,
        side: "high",
      },
    ],
    target: [1, 2, 6, 7, 15, 18, 20, 23],
    certificate: {
      actions: [
        {
          kind: "fold",
          crease: "A",
        },
        {
          kind: "fold",
          crease: "B",
        },
        {
          kind: "fold",
          crease: "C",
        },
        {
          kind: "punch",
          cell: 7,
        },
        {
          kind: "punch",
          cell: 18,
        },
        {
          kind: "unfold",
        },
      ],
    },
  },
  {
    id: "paper-fold-11",
    title: "厚薄双击",
    lesson:
      "同一张纸同时出现八层区和两层区。先从十个目标孔倒推两个叠层的成员。",
    width: 6,
    height: 5,
    maxFolds: 3,
    maxPunches: 2,
    creases: [
      {
        id: "A",
        axis: "x",
        at: 3,
        side: "high",
      },
      {
        id: "B",
        axis: "y",
        at: 3,
        side: "high",
      },
      {
        id: "C",
        axis: "x",
        at: 1,
        side: "low",
      },
      {
        id: "D",
        axis: "y",
        at: 2,
        side: "low",
      },
    ],
    target: [2, 3, 6, 7, 10, 11, 24, 25, 28, 29],
    certificate: {
      actions: [
        {
          kind: "fold",
          crease: "A",
        },
        {
          kind: "fold",
          crease: "B",
        },
        {
          kind: "fold",
          crease: "C",
        },
        {
          kind: "punch",
          cell: 7,
        },
        {
          kind: "punch",
          cell: 2,
        },
        {
          kind: "unfold",
        },
      ],
    },
  },
  {
    id: "paper-fold-12",
    title: "十二孔终章",
    lesson:
      "把三页风琴与横向对折结合，两次六层打孔。预算不要求用满；任何精确匹配目标的路线都算完成。",
    width: 6,
    height: 6,
    maxFolds: 3,
    maxPunches: 2,
    creases: [
      {
        id: "A",
        axis: "x",
        at: 2,
        side: "low",
      },
      {
        id: "B",
        axis: "x",
        at: 4,
        side: "high",
      },
      {
        id: "C",
        axis: "y",
        at: 3,
        side: "low",
      },
      {
        id: "D",
        axis: "y",
        at: 3,
        side: "high",
      },
    ],
    target: [0, 3, 4, 13, 14, 17, 19, 20, 23, 30, 33, 34],
    certificate: {
      actions: [
        {
          kind: "fold",
          crease: "A",
        },
        {
          kind: "fold",
          crease: "B",
        },
        {
          kind: "fold",
          crease: "C",
        },
        {
          kind: "punch",
          cell: 20,
        },
        {
          kind: "punch",
          cell: 33,
        },
        {
          kind: "unfold",
        },
      ],
    },
  },
];
