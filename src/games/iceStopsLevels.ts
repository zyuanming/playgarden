// SPDX-License-Identifier: MIT
// Original authored maps. Explicit puzzle data is independent of shortest-path certificates.
import type { IceLevel } from "./iceStopsLogic";
export const iceStopsLevels: readonly IceLevel[] = [
  {
    id: "ice-01",
    title: "先学会停下",
    lesson: "滑动会一直到墙或另一枚冰盘前。先看清每次会在哪里停。",
    rows: ["....", "...."],
    start: [0, 3, 4],
    goals: [4, 0, 7],
    certificate: {
      moves: [
        {
          puck: 2,
          direction: "E",
        },
        {
          puck: 0,
          direction: "S",
        },
        {
          puck: 1,
          direction: "W",
        },
      ],
      shortest: 3,
      visited: 89,
    },
  },
  {
    id: "ice-02",
    title: "借一个刹车",
    lesson: "冰盘能挡住彼此；把同伴临时放在目标后面。",
    rows: ["....", "....", "...."],
    start: [0, 3, 8],
    goals: [7, 0, 6],
    certificate: {
      moves: [
        {
          puck: 0,
          direction: "S",
        },
        {
          puck: 0,
          direction: "E",
        },
        {
          puck: 1,
          direction: "W",
        },
        {
          puck: 2,
          direction: "N",
        },
        {
          puck: 2,
          direction: "E",
        },
      ],
      shortest: 5,
      visited: 507,
    },
  },
  {
    id: "ice-03",
    title: "冰石两侧",
    lesson: "固定冰石和移动冰盘都是挡点，选择合适的停靠边。",
    rows: [".....", "..#..", "....."],
    start: [0, 4, 10],
    goals: [6, 0, 8],
    certificate: {
      moves: [
        {
          puck: 0,
          direction: "S",
        },
        {
          puck: 0,
          direction: "E",
        },
        {
          puck: 2,
          direction: "E",
        },
        {
          puck: 2,
          direction: "N",
        },
        {
          puck: 1,
          direction: "W",
        },
        {
          puck: 2,
          direction: "W",
        },
      ],
      shortest: 6,
      visited: 1112,
    },
  },
  {
    id: "ice-04",
    title: "先离开家",
    lesson: "到达目标的冰盘仍能移动，有时要先让出道路。",
    rows: [".....", ".#...", "....."],
    start: [0, 4, 10],
    goals: [4, 8, 14],
    certificate: {
      moves: [
        {
          puck: 2,
          direction: "E",
        },
        {
          puck: 1,
          direction: "S",
        },
        {
          puck: 0,
          direction: "E",
        },
        {
          puck: 1,
          direction: "W",
        },
        {
          puck: 0,
          direction: "S",
        },
        {
          puck: 1,
          direction: "E",
        },
        {
          puck: 0,
          direction: "N",
        },
      ],
      shortest: 7,
      visited: 1453,
    },
  },
  {
    id: "ice-05",
    title: "环岸接力",
    lesson: "沿外环绕行，把同伴送进能当挡点的位置。",
    rows: [".....", ".....", ".###.", "....."],
    start: [0, 4, 15],
    goals: [19, 7, 8],
    certificate: {
      moves: [
        {
          puck: 1,
          direction: "W",
        },
        {
          puck: 1,
          direction: "S",
        },
        {
          puck: 0,
          direction: "E",
        },
        {
          puck: 2,
          direction: "N",
        },
        {
          puck: 2,
          direction: "E",
        },
        {
          puck: 0,
          direction: "S",
        },
        {
          puck: 2,
          direction: "S",
        },
        {
          puck: 1,
          direction: "E",
        },
      ],
      shortest: 8,
      visited: 2362,
    },
  },
  {
    id: "ice-06",
    title: "双廊换位",
    lesson: "中央冰石分隔滑道，利用交会处交换先后顺序。",
    rows: [".....", "..#..", ".....", "..#.."],
    start: [0, 4, 15],
    goals: [12, 11, 6],
    certificate: {
      moves: [
        {
          puck: 0,
          direction: "S",
        },
        {
          puck: 0,
          direction: "E",
        },
        {
          puck: 1,
          direction: "W",
        },
        {
          puck: 2,
          direction: "N",
        },
        {
          puck: 2,
          direction: "E",
        },
        {
          puck: 1,
          direction: "S",
        },
        {
          puck: 1,
          direction: "E",
        },
        {
          puck: 1,
          direction: "N",
        },
        {
          puck: 0,
          direction: "W",
        },
      ],
      shortest: 9,
      visited: 3021,
    },
  },
  {
    id: "ice-07",
    title: "穿过双礁",
    lesson: "开放水道不一定容易停住；先布置一个临时挡点。",
    rows: ["......", ".#..#.", "......", "......"],
    start: [0, 5, 18],
    goals: [23, 14, 16],
    certificate: {
      moves: [
        {
          puck: 2,
          direction: "E",
        },
        {
          puck: 0,
          direction: "S",
        },
        {
          puck: 1,
          direction: "S",
        },
        {
          puck: 2,
          direction: "W",
        },
        {
          puck: 2,
          direction: "N",
        },
        {
          puck: 0,
          direction: "E",
        },
        {
          puck: 1,
          direction: "W",
        },
        {
          puck: 2,
          direction: "S",
        },
        {
          puck: 2,
          direction: "E",
        },
        {
          puck: 2,
          direction: "N",
        },
      ],
      shortest: 10,
      visited: 4398,
    },
  },
  {
    id: "ice-08",
    title: "中场停车",
    lesson: "内部目标无法靠外墙直接抵达，要让另一枚冰盘协助。",
    rows: [".....", ".....", ".#.#.", ".....", "....."],
    start: [0, 4, 20],
    goals: [17, 16, 12],
    certificate: {
      moves: [
        {
          puck: 0,
          direction: "S",
        },
        {
          puck: 2,
          direction: "E",
        },
        {
          puck: 1,
          direction: "S",
        },
        {
          puck: 1,
          direction: "W",
        },
        {
          puck: 1,
          direction: "S",
        },
        {
          puck: 0,
          direction: "E",
        },
        {
          puck: 2,
          direction: "W",
        },
        {
          puck: 1,
          direction: "N",
        },
        {
          puck: 2,
          direction: "N",
        },
        {
          puck: 0,
          direction: "W",
        },
        {
          puck: 2,
          direction: "S",
        },
      ],
      shortest: 11,
      visited: 6239,
    },
  },
  {
    id: "ice-09",
    title: "折返冰湾",
    lesson: "回到原来的轨道可能必要。别把已经归位的冰盘当成固定墙。",
    rows: ["......", "..##..", "......", ".#..#.", "......"],
    start: [0, 5, 24],
    goals: [15, 14, 16],
    certificate: {
      moves: [
        {
          puck: 0,
          direction: "E",
        },
        {
          puck: 0,
          direction: "S",
        },
        {
          puck: 2,
          direction: "N",
        },
        {
          puck: 0,
          direction: "W",
        },
        {
          puck: 2,
          direction: "E",
        },
        {
          puck: 2,
          direction: "S",
        },
        {
          puck: 1,
          direction: "W",
        },
        {
          puck: 1,
          direction: "S",
        },
        {
          puck: 0,
          direction: "E",
        },
        {
          puck: 1,
          direction: "E",
        },
        {
          puck: 1,
          direction: "S",
        },
        {
          puck: 1,
          direction: "E",
        },
      ],
      shortest: 12,
      visited: 8557,
    },
  },
  {
    id: "ice-10",
    title: "三盘协奏",
    lesson: "规划三枚冰盘的先后关系，逐个建立下一次滑动需要的挡点。",
    rows: ["......", ".#....", "...#..", ".#....", "......"],
    start: [0, 5, 24],
    goals: [16, 21, 10],
    certificate: {
      moves: [
        {
          puck: 0,
          direction: "E",
        },
        {
          puck: 1,
          direction: "S",
        },
        {
          puck: 2,
          direction: "E",
        },
        {
          puck: 2,
          direction: "N",
        },
        {
          puck: 0,
          direction: "W",
        },
        {
          puck: 0,
          direction: "S",
        },
        {
          puck: 0,
          direction: "E",
        },
        {
          puck: 0,
          direction: "N",
        },
        {
          puck: 1,
          direction: "W",
        },
        {
          puck: 0,
          direction: "S",
        },
        {
          puck: 1,
          direction: "E",
        },
        {
          puck: 0,
          direction: "N",
        },
        {
          puck: 1,
          direction: "N",
        },
      ],
      shortest: 13,
      visited: 11658,
    },
  },
  {
    id: "ice-11",
    title: "狭口再会",
    lesson: "狭口两边有不同的滑道；安排冰盘换边，再重新靠拢。",
    rows: ["......", "..#...", "......", "...#..", "......"],
    start: [0, 5, 24],
    goals: [14, 13, 10],
    certificate: {
      moves: [
        {
          puck: 0,
          direction: "E",
        },
        {
          puck: 1,
          direction: "S",
        },
        {
          puck: 2,
          direction: "E",
        },
        {
          puck: 2,
          direction: "N",
        },
        {
          puck: 0,
          direction: "W",
        },
        {
          puck: 1,
          direction: "W",
        },
        {
          puck: 0,
          direction: "S",
        },
        {
          puck: 0,
          direction: "E",
        },
        {
          puck: 1,
          direction: "N",
        },
        {
          puck: 0,
          direction: "W",
        },
        {
          puck: 1,
          direction: "S",
        },
        {
          puck: 0,
          direction: "E",
        },
        {
          puck: 0,
          direction: "N",
        },
        {
          puck: 1,
          direction: "E",
        },
      ],
      shortest: 14,
      visited: 12762,
    },
  },
  {
    id: "ice-12",
    title: "无礁终章",
    lesson: "没有内部冰石，所有中场停靠都要靠另外两枚冰盘完成。",
    rows: ["......", "......", "......", "......", "......"],
    start: [0, 5, 24],
    goals: [21, 20, 5],
    certificate: {
      moves: [
        {
          puck: 0,
          direction: "E",
        },
        {
          puck: 0,
          direction: "S",
        },
        {
          puck: 0,
          direction: "W",
        },
        {
          puck: 0,
          direction: "N",
        },
        {
          puck: 1,
          direction: "W",
        },
        {
          puck: 2,
          direction: "E",
        },
        {
          puck: 0,
          direction: "S",
        },
        {
          puck: 2,
          direction: "W",
        },
        {
          puck: 0,
          direction: "N",
        },
        {
          puck: 1,
          direction: "S",
        },
        {
          puck: 0,
          direction: "E",
        },
        {
          puck: 2,
          direction: "E",
        },
        {
          puck: 0,
          direction: "S",
        },
        {
          puck: 0,
          direction: "W",
        },
        {
          puck: 2,
          direction: "N",
        },
      ],
      shortest: 15,
      visited: 10120,
    },
  },
];
