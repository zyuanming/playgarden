/** Original GPL-3.0-only levels. Authored with a fixed seed; independently certified in tests. */
export type NurikabeLevel = {
  title: string;
  size: number;
  clues: { index: number; area: number }[];
};
export const nurikabeLevels: NurikabeLevel[] = [
  {
    size: 3,
    clues: [
      {
        index: 0,
        area: 3,
      },
      {
        index: 7,
        area: 1,
      },
    ],
    title: "两座小岛",
  },
  {
    size: 3,
    clues: [
      {
        index: 3,
        area: 1,
      },
      {
        index: 5,
        area: 3,
      },
    ],
    title: "潮间漫步",
  },
  {
    size: 4,
    clues: [
      {
        index: 0,
        area: 4,
      },
      {
        index: 8,
        area: 2,
      },
      {
        index: 11,
        area: 1,
      },
    ],
    title: "浅湾灯塔",
  },
  {
    size: 4,
    clues: [
      {
        index: 0,
        area: 1,
      },
      {
        index: 2,
        area: 1,
      },
      {
        index: 8,
        area: 4,
      },
      {
        index: 15,
        area: 2,
      },
    ],
    title: "沙洲相望",
  },
  {
    size: 4,
    clues: [
      {
        index: 0,
        area: 2,
      },
      {
        index: 7,
        area: 2,
      },
      {
        index: 9,
        area: 1,
      },
      {
        index: 12,
        area: 1,
      },
      {
        index: 15,
        area: 1,
      },
    ],
    title: "海湾分界",
  },
  {
    size: 5,
    clues: [
      {
        index: 3,
        area: 2,
      },
      {
        index: 5,
        area: 3,
      },
      {
        index: 14,
        area: 3,
      },
      {
        index: 15,
        area: 3,
      },
    ],
    title: "远帆小港",
  },
  {
    size: 5,
    clues: [
      {
        index: 2,
        area: 5,
      },
      {
        index: 4,
        area: 4,
      },
      {
        index: 21,
        area: 1,
      },
      {
        index: 24,
        area: 2,
      },
    ],
    title: "碧海回廊",
  },
  {
    size: 5,
    clues: [
      {
        index: 0,
        area: 1,
      },
      {
        index: 9,
        area: 3,
      },
      {
        index: 10,
        area: 4,
      },
      {
        index: 12,
        area: 3,
      },
      {
        index: 23,
        area: 1,
      },
    ],
    title: "群岛信风",
  },
  {
    size: 5,
    clues: [
      {
        index: 3,
        area: 5,
      },
      {
        index: 20,
        area: 3,
      },
      {
        index: 22,
        area: 2,
      },
      {
        index: 24,
        area: 2,
      },
    ],
    title: "潮汐花园",
  },
  {
    size: 6,
    clues: [
      {
        index: 0,
        area: 4,
      },
      {
        index: 9,
        area: 2,
      },
      {
        index: 11,
        area: 3,
      },
      {
        index: 20,
        area: 1,
      },
      {
        index: 22,
        area: 2,
      },
      {
        index: 31,
        area: 4,
      },
      {
        index: 35,
        area: 1,
      },
    ],
    title: "珊瑚迷航",
  },
  {
    size: 6,
    clues: [
      {
        index: 2,
        area: 2,
      },
      {
        index: 11,
        area: 4,
      },
      {
        index: 13,
        area: 1,
      },
      {
        index: 15,
        area: 1,
      },
      {
        index: 18,
        area: 1,
      },
      {
        index: 23,
        area: 1,
      },
      {
        index: 31,
        area: 6,
      },
    ],
    title: "海图深处",
  },
  {
    size: 6,
    clues: [
      {
        index: 2,
        area: 1,
      },
      {
        index: 4,
        area: 3,
      },
      {
        index: 14,
        area: 5,
      },
      {
        index: 16,
        area: 1,
      },
      {
        index: 24,
        area: 1,
      },
      {
        index: 26,
        area: 2,
      },
      {
        index: 29,
        area: 4,
      },
    ],
    title: "群岛之心",
  },
];
