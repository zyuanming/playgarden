// SPDX-License-Identifier: GPL-3.0-only
// Original hand-authored layouts. Witnesses support optional hints only;
// completion is determined by the player's area, boundary and connectivity.
export type PerimeterGardenLevel = {
  id: string;
  title: string;
  size: number;
  area: number;
  perimeter: number;
  required: number[];
  blocked: number[];
  witness: number[];
  lesson: string;
};

export const perimeterGardenLevels: PerimeterGardenLevel[] = [
  {
    id: "perim-01", title: "四格小花圃", size: 4, area: 4, perimeter: 8,
    required: [5], blocked: [], witness: [5, 6, 9, 10],
    lesson: "四格花圃可以有不同的轮廓。把花格紧紧靠在一起，共享的边就不需要围栏。",
  },
  {
    id: "perim-02", title: "绕过石板", size: 4, area: 4, perimeter: 10,
    required: [0], blocked: [1, 2], witness: [0, 4, 8, 9],
    lesson: "面积仍是四格，围栏却多了两段。沿着石板向下走，试试细长或弯曲的形状。",
  },
  {
    id: "perim-03", title: "紧凑的苗床", size: 5, area: 6, perimeter: 10,
    required: [0, 6], blocked: [], witness: [0, 1, 2, 5, 6, 7],
    lesson: "六格花圃只给十段围栏。让更多花格共享边，观察周长怎样缩短。",
  },
  {
    id: "perim-04", title: "台阶花径", size: 5, area: 6, perimeter: 14,
    required: [0, 12], blocked: [], witness: [0, 1, 6, 7, 12, 13],
    lesson: "两颗固定星星隔着两行两列。只在角上碰到不算相连，要用完整的边接起来。",
  },
  {
    id: "perim-05", title: "墙下长花坛", size: 5, area: 8, perimeter: 12,
    required: [5, 13], blocked: [0, 1, 2, 3, 4], witness: [5, 6, 7, 8, 10, 11, 12, 13],
    lesson: "石板不能种花，靠石板或棋盘边缘的围栏仍要计数。八格花坛怎样排得紧凑？",
  },
  {
    id: "perim-06", title: "石井边的花环", size: 5, area: 8, perimeter: 16,
    required: [6, 18], blocked: [12], witness: [6, 7, 8, 11, 13, 16, 17, 18],
    lesson: "试着绕开中央石井。花圃里若留下空洞，内圈的围栏也算周长；花环只是可行的形状之一。",
  },
  {
    id: "perim-07", title: "横梁与花枝", size: 5, area: 10, perimeter: 20,
    required: [0, 4, 12], blocked: [], witness: [0, 1, 2, 3, 4, 7, 11, 12, 16, 17],
    lesson: "三颗星星相距较远。连接它们后，再调整花枝的宽窄，让面积与围栏同时达到目标。",
  },
  {
    id: "perim-08", title: "带庭院的大花园", size: 6, area: 12, perimeter: 20,
    required: [7, 22, 27], blocked: [15], witness: [7, 8, 9, 10, 13, 14, 16, 19, 20, 21, 22, 27],
    lesson: "十二格、二十段围栏，还要连到下方的星星。可以围出庭院，也可以寻找自己的轮廓。",
  },
];
