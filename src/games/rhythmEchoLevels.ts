// SPDX-License-Identifier: MIT
import type { RhythmLevel } from "./rhythmEchoLogic";
/** Public motifs and transformations define the goal independently of test certificates. */
export const rhythmEchoLevels: readonly RhythmLevel[] = [
  {
    id: "re-01",
    title: "一格的距离",
    lesson: "间隔是两次敲击之间的距离。短间隔占 1 格；把它原样重复三次。",
    motif: [1],
    parts: [{ transform: "forward", repeat: 3 }],
  },
  {
    id: "re-02",
    title: "一短一中",
    lesson: "先短、再中组成一个小节。把整个小节原样重复两次。",
    motif: [1, 2],
    parts: [{ transform: "forward", repeat: 2 }],
  },
  {
    id: "re-03",
    title: "回声转身",
    lesson:
      "先按原样走一个小节，再把小节的顺序倒过来。倒序只改变先后，不改变长短。",
    motif: [2, 1],
    parts: [
      { transform: "forward", repeat: 1 },
      { transform: "reverse", repeat: 1 },
    ],
  },
  {
    id: "re-04",
    title: "留一点空白",
    lesson: "长间隔占 3 格。长空白也是节奏的一部分，不需要补敲。",
    motif: [1, 3],
    parts: [{ transform: "forward", repeat: 2 }],
  },
  {
    id: "re-05",
    title: "三格小节",
    lesson: "一个小节现在有三个间隔。认清小节边界，再把它重复两次。",
    motif: [1, 1, 2],
    parts: [{ transform: "forward", repeat: 2 }],
  },
  {
    id: "re-06",
    title: "镜中的脚步",
    lesson: "先走短、中、长，再按相反顺序回应。两半在最长的间隔处相遇。",
    motif: [1, 2, 3],
    parts: [
      { transform: "forward", repeat: 1 },
      { transform: "reverse", repeat: 1 },
    ],
  },
  {
    id: "re-07",
    title: "慢一格的回信",
    lesson: "第二遍给每个间隔都加 1 格：短变中，中变长。顺序不变。",
    motif: [1, 2, 1],
    parts: [
      { transform: "forward", repeat: 1 },
      { transform: "lengthen", repeat: 1 },
    ],
  },
  {
    id: "re-08",
    title: "换个开头",
    lesson: "把小节的第一项移到末尾，其他项保持顺序；之后再来一遍原样小节。",
    motif: [1, 3, 2],
    parts: [
      { transform: "rotate", repeat: 1 },
      { transform: "forward", repeat: 1 },
    ],
  },
  {
    id: "re-09",
    title: "三封回声",
    lesson:
      "从同一个原始小节分别做原样、倒序、加一格。每次都从任务卡的小节出发。",
    motif: [1, 2],
    parts: [
      { transform: "forward", repeat: 1 },
      { transform: "reverse", repeat: 1 },
      { transform: "lengthen", repeat: 1 },
    ],
  },
  {
    id: "re-10",
    title: "绕圈再相遇",
    lesson: "先倒序，再把首项移到末尾，最后原样。每种变换都作用于原始小节。",
    motif: [1, 2, 3],
    parts: [
      { transform: "reverse", repeat: 1 },
      { transform: "rotate", repeat: 1 },
      { transform: "forward", repeat: 1 },
    ],
  },
  {
    id: "re-11",
    title: "熟悉的新节奏",
    lesson:
      "这个小节倒过来仍然一样，但移走首项会改变它。先加一格，再倒序，再移首项。",
    motif: [1, 2, 1],
    parts: [
      { transform: "lengthen", repeat: 1 },
      { transform: "reverse", repeat: 1 },
      { transform: "rotate", repeat: 1 },
    ],
  },
  {
    id: "re-12",
    title: "四种回响",
    lesson:
      "用同一个小节组合四种变换：原样、加一格、倒序、移首项。按任务卡从左到右完成。",
    motif: [1, 2],
    parts: [
      { transform: "forward", repeat: 1 },
      { transform: "lengthen", repeat: 1 },
      { transform: "reverse", repeat: 1 },
      { transform: "rotate", repeat: 1 },
    ],
  },
];
