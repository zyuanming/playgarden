// SPDX-License-Identifier: GPL-3.0-only
import type { CodeLevel } from "./codeCluesLogic";
/** Authored public clues and learning certificates; no randomness or imported art. */
export const codeCluesLevels: CodeLevel[] = [
  {
    id: "cc-01",
    title: "两格入门",
    slots: 2,
    symbols: 3,
    initialClues: [],
    secret: [0, 1],
    lesson:
      "把两个反馈分开读：位置对，才算就位；只有符号对则算错位。重复符号也允许。",
    certificate: {
      guesses: [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
    },
  },
  {
    id: "cc-02",
    title: "双胞符号",
    slots: 2,
    symbols: 3,
    initialClues: [{ guess: [0, 0], exact: 0, misplaced: 0 }],
    secret: [2, 2],
    lesson: "排除一种符号后，剩下的符号仍可重复。用混合试探区分数量与位置。",
    certificate: {
      guesses: [
        [0, 2],
        [1, 2],
        [2, 2],
      ],
    },
  },
  {
    id: "cc-03",
    title: "第四位客人",
    slots: 2,
    symbols: 4,
    initialClues: [{ guess: [0, 0], exact: 0, misplaced: 0 }],
    secret: [1, 3],
    lesson:
      "相同符号的试探能调查数量；交换位置则能调查顺序。两种问题别混在一起。",
    certificate: {
      guesses: [
        [1, 1],
        [3, 1],
        [1, 3],
      ],
    },
  },
  {
    id: "cc-04",
    title: "三格变奏",
    slots: 3,
    symbols: 3,
    initialClues: [],
    secret: [0, 2, 1],
    lesson:
      "增加一格之后，同样的反馈可能对应多个排列。保留每条旧记录，逐步取交集。",
    certificate: {
      guesses: [
        [0, 0, 0],
        [1, 1, 2],
        [0, 2, 1],
      ],
    },
  },
  {
    id: "cc-05",
    title: "数量与座位",
    slots: 3,
    symbols: 4,
    initialClues: [{ guess: [0, 2, 0], exact: 0, misplaced: 0 }],
    secret: [1, 1, 3],
    lesson: "一个符号不能匹配两次。两个就位不代表另一个位置一定是新符号。",
    certificate: {
      guesses: [
        [1, 3, 3],
        [3, 1, 1],
        [1, 1, 3],
      ],
    },
  },
  {
    id: "cc-06",
    title: "重复的回声",
    slots: 3,
    symbols: 4,
    initialClues: [{ guess: [1, 1, 3], exact: 0, misplaced: 0 }],
    secret: [2, 0, 2],
    lesson: "先问一种符号有几个，再通过换位定位；错位数不会多算重复的符号。",
    certificate: {
      guesses: [
        [0, 0, 0],
        [2, 2, 0],
        [2, 0, 2],
      ],
    },
  },
  {
    id: "cc-07",
    title: "星星来访",
    slots: 3,
    symbols: 5,
    initialClues: [{ guess: [0, 0, 3], exact: 0, misplaced: 0 }],
    secret: [4, 2, 1],
    lesson: "符号更多，不必逐个碰运气。让一次试探把候选分成大小接近的几组。",
    certificate: {
      guesses: [
        [1, 2, 2],
        [2, 4, 1],
        [4, 2, 1],
      ],
    },
  },
  {
    id: "cc-08",
    title: "四格序曲",
    slots: 4,
    symbols: 4,
    initialClues: [],
    secret: [0, 1, 2, 3],
    lesson:
      "重复一对符号可以探测数量，再安排位置。每次反馈都要与所有旧线索相容。",
    certificate: {
      guesses: [
        [0, 0, 1, 1],
        [2, 3, 2, 3],
        [1, 0, 2, 3],
        [0, 1, 2, 3],
      ],
    },
  },
  {
    id: "cc-09",
    title: "藏在重复里",
    slots: 4,
    symbols: 4,
    initialClues: [{ guess: [3, 3, 3, 3], exact: 0, misplaced: 0 }],
    secret: [2, 2, 0, 1],
    lesson:
      "公开线索排除了一个符号，但没说其余符号出现几次。数量也是需要调查的未知数。",
    certificate: {
      guesses: [
        [0, 1, 0, 1],
        [2, 0, 2, 1],
        [2, 2, 0, 1],
      ],
    },
  },
  {
    id: "cc-10",
    title: "信号研判",
    slots: 4,
    symbols: 5,
    initialClues: [{ guess: [1, 3, 1, 3], exact: 0, misplaced: 0 }],
    secret: [4, 0, 4, 2],
    lesson: "当就位与错位之和等于格数时，符号数量已匹配，只需研究顺序。",
    certificate: {
      guesses: [
        [0, 0, 2, 2],
        [4, 4, 0, 2],
        [4, 0, 4, 2],
      ],
    },
  },
  {
    id: "cc-11",
    title: "信息优先",
    slots: 4,
    symbols: 5,
    initialClues: [],
    secret: [1, 4, 2, 1],
    lesson:
      "一次不可能直接获胜的试探也可能很有信息量。提示比较所有合法试探的下一步最坏分组。",
    certificate: {
      guesses: [
        [0, 0, 1, 1],
        [2, 2, 3, 3],
        [4, 1, 1, 2],
        [1, 4, 2, 1],
      ],
    },
  },
  {
    id: "cc-12",
    title: "侦探终章",
    slots: 4,
    symbols: 5,
    initialClues: [],
    secret: [3, 1, 3, 4],
    lesson:
      "综合数量、位置和排除信息。没有次数上限，也不要求照着某份固定顺序解题。",
    certificate: {
      guesses: [
        [0, 1, 2, 3],
        [3, 3, 4, 4],
        [1, 3, 3, 4],
        [3, 1, 3, 4],
      ],
    },
  },
];
