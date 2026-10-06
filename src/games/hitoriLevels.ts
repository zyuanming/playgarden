/** Original GPL-3.0-only levels. Authored with a fixed seed; independently certified in tests. */
export type HitoriLevel = { title: string; size: number; numbers: number[] };
export const hitoriLevels: HitoriLevel[] = [
  {
    size: 3,
    numbers: [3, 2, 3, 3, 2, 2, 2, 3, 1],
    title: "溪边初识",
  },
  {
    size: 3,
    numbers: [2, 2, 1, 1, 2, 2, 2, 1, 3],
    title: "双影留白",
  },
  {
    size: 4,
    numbers: [4, 4, 2, 1, 4, 3, 2, 2, 2, 1, 4, 4, 3, 2, 3, 4],
    title: "竹影相间",
  },
  {
    size: 4,
    numbers: [1, 4, 1, 3, 3, 1, 3, 2, 3, 2, 1, 3, 1, 3, 4, 1],
    title: "数列岔路",
  },
  {
    size: 4,
    numbers: [1, 4, 4, 4, 3, 4, 2, 1, 3, 3, 1, 4, 4, 1, 4, 2],
    title: "石径回环",
  },
  {
    size: 5,
    numbers: [
      2, 3, 3, 4, 5, 5, 4, 1, 3, 2, 2, 3, 5, 2, 4, 4, 2, 1, 3, 3, 2, 5, 1, 1, 2,
    ],
    title: "晨雾庭院",
  },
  {
    size: 5,
    numbers: [
      3, 3, 4, 5, 2, 3, 4, 2, 2, 5, 1, 1, 1, 2, 5, 2, 5, 1, 4, 3, 4, 5, 5, 5, 1,
    ],
    title: "青瓦小巷",
  },
  {
    size: 5,
    numbers: [
      4, 5, 1, 4, 2, 3, 4, 3, 2, 5, 2, 3, 4, 4, 4, 2, 1, 2, 5, 4, 5, 2, 4, 4, 3,
    ],
    title: "花窗寻踪",
  },
  {
    size: 5,
    numbers: [
      4, 5, 1, 5, 2, 2, 4, 5, 3, 3, 3, 1, 4, 1, 3, 3, 5, 2, 1, 4, 2, 2, 3, 5, 5,
    ],
    title: "林间回声",
  },
  {
    size: 6,
    numbers: [
      2, 3, 5, 1, 6, 3, 1, 6, 3, 4, 4, 6, 1, 5, 5, 4, 2, 2, 3, 1, 4, 5, 2, 6, 2,
      3, 2, 6, 5, 1, 5, 2, 5, 3, 3, 4,
    ],
    title: "暮色山路",
  },
  {
    size: 6,
    numbers: [
      5, 6, 2, 4, 2, 1, 6, 3, 3, 5, 6, 2, 2, 5, 3, 1, 1, 6, 1, 5, 6, 2, 5, 3, 3,
      1, 6, 3, 5, 4, 3, 2, 4, 6, 1, 6,
    ],
    title: "星光长廊",
  },
  {
    size: 6,
    numbers: [
      1, 4, 6, 2, 4, 3, 2, 2, 3, 4, 1, 5, 2, 2, 1, 1, 1, 6, 3, 1, 2, 6, 6, 4, 4,
      3, 5, 6, 2, 1, 6, 1, 1, 3, 1, 2,
    ],
    title: "留白之境",
  },
];
