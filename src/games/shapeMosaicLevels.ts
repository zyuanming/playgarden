// SPDX-License-Identifier: MIT
// Original hand-drawn letter tilings, stored as region + scrambled piece inventory.
// The certificate is one valid tiling, not the acceptance criterion.
import type { MosaicLevel } from "./shapeMosaicLogic";
export const shapeMosaicLevels: readonly MosaicLevel[] = [
  {
    id: "mosaic-01",
    title: "星标先落座",
    lesson: "先看不对称拐角。星标表示最上行最左的一格，它是落位锚点。",
    rows: ["..##", "....", "##.#"],
    pieces: [
      {
        label: "A",
        cells: [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "B",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
          [2, 1],
        ],
        reflect: false,
      },
    ],
    certificate: {
      placements: [
        {
          piece: 0,
          orientation: 3,
          x: 0,
          y: 0,
        },
        {
          piece: 1,
          orientation: 2,
          x: 1,
          y: 1,
        },
      ],
      nodes: 4,
    },
  },
  {
    id: "mosaic-02",
    title: "绕着小天窗",
    lesson: "空洞不能覆盖。相同外形的拼片也要各用一次。",
    rows: ["....", ".#..", "....", ".###"],
    pieces: [
      {
        label: "A",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "B",
        cells: [
          [0, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "C",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "D",
        cells: [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        reflect: false,
      },
    ],
    certificate: {
      placements: [
        {
          piece: 0,
          orientation: 2,
          x: 0,
          y: 0,
        },
        {
          piece: 1,
          orientation: 1,
          x: 2,
          y: 0,
        },
        {
          piece: 2,
          orientation: 0,
          x: 3,
          y: 1,
        },
        {
          piece: 3,
          orientation: 3,
          x: 0,
          y: 2,
        },
      ],
      nodes: 6,
    },
  },
  {
    id: "mosaic-03",
    title: "长臂与凹口",
    lesson: "长臂需要连续空间；先观察窄口，再决定旋转方向。",
    rows: [".....", "..#..", "...##"],
    pieces: [
      {
        label: "A",
        cells: [
          [0, 0],
          [0, 1],
          [0, 2],
          [1, 2],
        ],
        reflect: false,
      },
      {
        label: "B",
        cells: [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "C",
        cells: [
          [0, 0],
          [0, 1],
          [1, 1],
          [0, 2],
        ],
        reflect: false,
      },
    ],
    certificate: {
      placements: [
        {
          piece: 0,
          orientation: 1,
          x: 0,
          y: 0,
        },
        {
          piece: 1,
          orientation: 0,
          x: 3,
          y: 0,
        },
        {
          piece: 2,
          orientation: 3,
          x: 1,
          y: 1,
        },
      ],
      nodes: 4,
    },
  },
  {
    id: "mosaic-04",
    title: "十字庭院",
    lesson: "不要留下只能由已经用过的拼片填补的小洞。",
    rows: [".....", "...#.", "....#", "....."],
    pieces: [
      {
        label: "A",
        cells: [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "B",
        cells: [
          [0, 0],
          [1, 0],
          [1, 1],
          [1, 2],
        ],
        reflect: true,
      },
      {
        label: "C",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
          [2, 1],
          [1, 2],
        ],
        reflect: false,
      },
      {
        label: "D",
        cells: [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        reflect: true,
      },
      {
        label: "E",
        cells: [
          [0, 0],
          [1, 0],
        ],
        reflect: false,
      },
    ],
    certificate: {
      placements: [
        {
          piece: 0,
          orientation: 0,
          x: 0,
          y: 0,
        },
        {
          piece: 1,
          orientation: 5,
          x: 2,
          y: 0,
        },
        {
          piece: 2,
          orientation: 0,
          x: 2,
          y: 1,
        },
        {
          piece: 3,
          orientation: 2,
          x: 0,
          y: 2,
        },
        {
          piece: 4,
          orientation: 0,
          x: 3,
          y: 3,
        },
      ],
      nodes: 11,
    },
  },
  {
    id: "mosaic-05",
    title: "镜像不是旋转",
    lesson: "本关禁止翻面。旋转四次仍不会把左手形变成右手形。",
    rows: ["..#..", ".....", ".....", "#...."],
    pieces: [
      {
        label: "A",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
          [0, 2],
        ],
        reflect: false,
      },
      {
        label: "B",
        cells: [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "C",
        cells: [
          [1, 0],
          [2, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "D",
        cells: [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "E",
        cells: [
          [0, 0],
          [1, 0],
        ],
        reflect: false,
      },
    ],
    certificate: {
      placements: [
        {
          piece: 0,
          orientation: 1,
          x: 0,
          y: 0,
        },
        {
          piece: 1,
          orientation: 0,
          x: 3,
          y: 0,
        },
        {
          piece: 2,
          orientation: 1,
          x: 0,
          y: 1,
        },
        {
          piece: 3,
          orientation: 0,
          x: 2,
          y: 2,
        },
        {
          piece: 4,
          orientation: 1,
          x: 4,
          y: 2,
        },
      ],
      nodes: 6,
    },
  },
  {
    id: "mosaic-06",
    title: "双角小屋",
    lesson: "有些拼片可以翻面。检查每片的许可，再规划内侧转角。",
    rows: [".....", ".....", "..#..", ".....", "#...."],
    pieces: [
      {
        label: "A",
        cells: [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "B",
        cells: [
          [0, 0],
          [0, 1],
          [0, 2],
          [1, 2],
        ],
        reflect: true,
      },
      {
        label: "C",
        cells: [
          [0, 0],
          [1, 0],
          [1, 1],
          [1, 2],
        ],
        reflect: true,
      },
      {
        label: "D",
        cells: [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "E",
        cells: [
          [0, 0],
          [1, 0],
          [2, 0],
          [0, 1],
          [0, 2],
        ],
        reflect: false,
      },
      {
        label: "F",
        cells: [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        reflect: true,
      },
    ],
    certificate: {
      placements: [
        {
          piece: 0,
          orientation: 0,
          x: 0,
          y: 0,
        },
        {
          piece: 1,
          orientation: 7,
          x: 2,
          y: 0,
        },
        {
          piece: 2,
          orientation: 0,
          x: 2,
          y: 1,
        },
        {
          piece: 3,
          orientation: 3,
          x: 0,
          y: 2,
        },
        {
          piece: 4,
          orientation: 2,
          x: 4,
          y: 2,
        },
        {
          piece: 5,
          orientation: 0,
          x: 1,
          y: 3,
        },
      ],
      nodes: 13,
    },
  },
  {
    id: "mosaic-07",
    title: "两扇天窗",
    lesson: "把空洞周围的边看作约束；一次落位可能同时封住两处通道。",
    rows: ["......", "..#...", "...#..", "......", "......"],
    pieces: [
      {
        label: "A",
        cells: [
          [0, 0],
          [1, 0],
          [2, 0],
          [0, 1],
          [0, 2],
        ],
        reflect: true,
      },
      {
        label: "B",
        cells: [
          [0, 0],
          [1, 0],
          [2, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "C",
        cells: [
          [0, 0],
          [1, 0],
          [2, 0],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "D",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
          [0, 2],
        ],
        reflect: true,
      },
      {
        label: "E",
        cells: [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        reflect: true,
      },
      {
        label: "F",
        cells: [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "G",
        cells: [
          [0, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
    ],
    certificate: {
      placements: [
        {
          piece: 0,
          orientation: 0,
          x: 0,
          y: 0,
        },
        {
          piece: 1,
          orientation: 0,
          x: 3,
          y: 0,
        },
        {
          piece: 2,
          orientation: 3,
          x: 1,
          y: 1,
        },
        {
          piece: 3,
          orientation: 0,
          x: 5,
          y: 1,
        },
        {
          piece: 4,
          orientation: 2,
          x: 0,
          y: 3,
        },
        {
          piece: 5,
          orientation: 0,
          x: 2,
          y: 3,
        },
        {
          piece: 6,
          orientation: 3,
          x: 5,
          y: 3,
        },
      ],
      nodes: 61,
    },
  },
  {
    id: "mosaic-08",
    title: "凹岸群岛",
    lesson: "外轮廓与内部缺口同样重要。允许旋转，但本关所有拼片都禁止翻面。",
    rows: ["..#...", "......", "..#..#", "......", "......"],
    pieces: [
      {
        label: "A",
        cells: [
          [0, 0],
          [1, 0],
          [1, 1],
          [2, 1],
        ],
        reflect: false,
      },
      {
        label: "B",
        cells: [
          [0, 0],
          [1, 0],
          [1, 1],
          [1, 2],
        ],
        reflect: false,
      },
      {
        label: "C",
        cells: [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "D",
        cells: [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 2],
        ],
        reflect: false,
      },
      {
        label: "E",
        cells: [
          [0, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "F",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "G",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "H",
        cells: [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        reflect: false,
      },
    ],
    certificate: {
      placements: [
        {
          piece: 0,
          orientation: 0,
          x: 0,
          y: 0,
        },
        {
          piece: 1,
          orientation: 3,
          x: 3,
          y: 0,
        },
        {
          piece: 2,
          orientation: 2,
          x: 0,
          y: 1,
        },
        {
          piece: 3,
          orientation: 1,
          x: 4,
          y: 1,
        },
        {
          piece: 4,
          orientation: 0,
          x: 0,
          y: 3,
        },
        {
          piece: 5,
          orientation: 3,
          x: 1,
          y: 3,
        },
        {
          piece: 6,
          orientation: 2,
          x: 3,
          y: 3,
        },
        {
          piece: 7,
          orientation: 1,
          x: 5,
          y: 3,
        },
      ],
      nodes: 13,
    },
  },
  {
    id: "mosaic-09",
    title: "九片合奏",
    lesson: "九片共享同一区域。注意每个剩余空腔的面积和可用拼片。",
    rows: ["...#..", "......", "......", "#.....", "......", "......"],
    pieces: [
      {
        label: "A",
        cells: [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        reflect: true,
      },
      {
        label: "B",
        cells: [
          [0, 0],
          [0, 1],
          [0, 2],
          [0, 3],
        ],
        reflect: false,
      },
      {
        label: "C",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
          [0, 2],
          [1, 2],
        ],
        reflect: true,
      },
      {
        label: "D",
        cells: [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 2],
        ],
        reflect: true,
      },
      {
        label: "E",
        cells: [
          [0, 0],
          [1, 0],
          [2, 0],
          [2, 1],
        ],
        reflect: false,
      },
      {
        label: "F",
        cells: [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        reflect: true,
      },
      {
        label: "G",
        cells: [
          [0, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "H",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
          [2, 1],
        ],
        reflect: true,
      },
      {
        label: "I",
        cells: [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
    ],
    certificate: {
      placements: [
        {
          piece: 0,
          orientation: 0,
          x: 0,
          y: 0,
        },
        {
          piece: 1,
          orientation: 0,
          x: 2,
          y: 0,
        },
        {
          piece: 2,
          orientation: 7,
          x: 4,
          y: 0,
        },
        {
          piece: 3,
          orientation: 0,
          x: 0,
          y: 1,
        },
        {
          piece: 4,
          orientation: 3,
          x: 3,
          y: 2,
        },
        {
          piece: 5,
          orientation: 2,
          x: 5,
          y: 2,
        },
        {
          piece: 6,
          orientation: 1,
          x: 0,
          y: 4,
        },
        {
          piece: 7,
          orientation: 0,
          x: 2,
          y: 4,
        },
        {
          piece: 8,
          orientation: 0,
          x: 4,
          y: 4,
        },
      ],
      nodes: 19,
    },
  },
  {
    id: "mosaic-10",
    title: "瓶颈两侧",
    lesson: "中间通道决定上下两片空间如何分配，避免只顾局部贴合。",
    rows: ["......", "..#...", "......", "...#..", "......", "......"],
    pieces: [
      {
        label: "A",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
          [2, 1],
        ],
        reflect: true,
      },
      {
        label: "B",
        cells: [
          [2, 0],
          [0, 1],
          [1, 1],
          [2, 1],
          [2, 2],
        ],
        reflect: true,
      },
      {
        label: "C",
        cells: [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "D",
        cells: [
          [0, 0],
          [1, 0],
          [1, 1],
          [2, 1],
        ],
        reflect: true,
      },
      {
        label: "E",
        cells: [
          [0, 0],
          [0, 1],
          [1, 1],
          [0, 2],
        ],
        reflect: false,
      },
      {
        label: "F",
        cells: [
          [0, 0],
          [1, 0],
          [2, 0],
          [1, 1],
          [2, 1],
        ],
        reflect: true,
      },
      {
        label: "G",
        cells: [
          [0, 0],
          [0, 1],
          [1, 1],
          [0, 2],
        ],
        reflect: false,
      },
      {
        label: "H",
        cells: [
          [0, 0],
          [0, 1],
          [1, 1],
          [0, 2],
        ],
        reflect: false,
      },
    ],
    certificate: {
      placements: [
        {
          piece: 0,
          orientation: 2,
          x: 0,
          y: 0,
        },
        {
          piece: 1,
          orientation: 1,
          x: 3,
          y: 0,
        },
        {
          piece: 2,
          orientation: 0,
          x: 4,
          y: 0,
        },
        {
          piece: 3,
          orientation: 3,
          x: 0,
          y: 1,
        },
        {
          piece: 4,
          orientation: 2,
          x: 5,
          y: 2,
        },
        {
          piece: 5,
          orientation: 7,
          x: 0,
          y: 3,
        },
        {
          piece: 6,
          orientation: 0,
          x: 2,
          y: 3,
        },
        {
          piece: 7,
          orientation: 3,
          x: 4,
          y: 4,
        },
      ],
      nodes: 113,
    },
  },
  {
    id: "mosaic-11",
    title: "三处缺口",
    lesson: "禁止翻面的手性片容易卡住。先比较凹边与剩余片的朝向。",
    rows: ["..#...", "......", "..#...", "......", "......", "#....."],
    pieces: [
      {
        label: "A",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
          [0, 2],
        ],
        reflect: false,
      },
      {
        label: "B",
        cells: [
          [0, 0],
          [1, 0],
          [0, 1],
          [0, 2],
        ],
        reflect: false,
      },
      {
        label: "C",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
          [2, 1],
        ],
        reflect: false,
      },
      {
        label: "D",
        cells: [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 2],
        ],
        reflect: false,
      },
      {
        label: "E",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
          [1, 2],
        ],
        reflect: false,
      },
      {
        label: "F",
        cells: [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 2],
        ],
        reflect: false,
      },
      {
        label: "G",
        cells: [
          [0, 0],
          [1, 0],
          [2, 0],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "H",
        cells: [
          [0, 0],
          [1, 0],
          [2, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
    ],
    certificate: {
      placements: [
        {
          piece: 0,
          orientation: 1,
          x: 0,
          y: 0,
        },
        {
          piece: 1,
          orientation: 0,
          x: 3,
          y: 0,
        },
        {
          piece: 2,
          orientation: 3,
          x: 5,
          y: 0,
        },
        {
          piece: 3,
          orientation: 0,
          x: 0,
          y: 1,
        },
        {
          piece: 4,
          orientation: 1,
          x: 4,
          y: 2,
        },
        {
          piece: 5,
          orientation: 0,
          x: 0,
          y: 3,
        },
        {
          piece: 6,
          orientation: 3,
          x: 2,
          y: 3,
        },
        {
          piece: 7,
          orientation: 2,
          x: 4,
          y: 4,
        },
      ],
      nodes: 45,
    },
  },
  {
    id: "mosaic-12",
    title: "镶嵌终章",
    lesson: "给窄处留出可用拼片；所有合法铺法都算成功，不必复现某张答案图。",
    rows: ["....#.", "......", "......", "......", "......", "#....."],
    pieces: [
      {
        label: "A",
        cells: [
          [0, 0],
          [1, 0],
          [0, 1],
          [0, 2],
        ],
        reflect: true,
      },
      {
        label: "B",
        cells: [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "C",
        cells: [
          [0, 0],
          [0, 1],
          [1, 1],
          [0, 2],
        ],
        reflect: true,
      },
      {
        label: "D",
        cells: [
          [0, 0],
          [1, 0],
          [1, 1],
          [1, 2],
        ],
        reflect: true,
      },
      {
        label: "E",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
          [2, 1],
        ],
        reflect: false,
      },
      {
        label: "F",
        cells: [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        reflect: false,
      },
      {
        label: "G",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
          [0, 2],
        ],
        reflect: true,
      },
      {
        label: "H",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
          [0, 2],
        ],
        reflect: true,
      },
      {
        label: "I",
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        reflect: true,
      },
    ],
    certificate: {
      placements: [
        {
          piece: 0,
          orientation: 0,
          x: 0,
          y: 0,
        },
        {
          piece: 1,
          orientation: 0,
          x: 2,
          y: 0,
        },
        {
          piece: 2,
          orientation: 2,
          x: 5,
          y: 0,
        },
        {
          piece: 3,
          orientation: 7,
          x: 1,
          y: 1,
        },
        {
          piece: 4,
          orientation: 0,
          x: 4,
          y: 2,
        },
        {
          piece: 5,
          orientation: 3,
          x: 0,
          y: 3,
        },
        {
          piece: 6,
          orientation: 0,
          x: 2,
          y: 3,
        },
        {
          piece: 7,
          orientation: 3,
          x: 3,
          y: 4,
        },
        {
          piece: 8,
          orientation: 0,
          x: 5,
          y: 4,
        },
      ],
      nodes: 71,
    },
  },
];
