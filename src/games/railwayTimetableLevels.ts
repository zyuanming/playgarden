// SPDX-License-Identifier: GPL-3.0-only
import type { RailLevel } from "./railwayTimetableLogic";
// Authored directed tracks and targets; certificates are offline test witnesses, never runtime rules.
export const railwayTimetableLevels: RailLevel[] = [
  {
    id: "rt-01",
    title: "交叉口轮流走",
    lesson:
      "两列车同时移动。先让一辆通过汇合点，下一步另一辆可以进入刚空出的站。",
    nodes: [
      {
        label: "A",
        x: 140,
        y: 125,
        next: [2],
      },
      {
        label: "B",
        x: 285,
        y: 125,
        next: [2],
      },
      {
        label: "C",
        x: 430,
        y: 125,
        next: [3, 4],
      },
      {
        label: "D",
        x: 575,
        y: 125,
        next: [],
      },
      {
        label: "E",
        x: 140,
        y: 260,
        next: [],
      },
    ],
    starts: [0, 1],
    goals: [3, 4],
    holdAllowed: [true, true],
    certificate: {
      actions: [
        {
          switches: [0],
          holds: [false, true],
        },
        {
          switches: [0],
          holds: [false, false],
        },
        {
          switches: [1],
          holds: [false, false],
        },
      ],
      ticks: 3,
    },
  },
  {
    id: "rt-02",
    title: "共用长走廊",
    lesson:
      "共用走廊可以前后跟车：进入刚离开的站是允许的，但同时到同一站不行。",
    nodes: [
      {
        label: "A",
        x: 140,
        y: 125,
        next: [2],
      },
      {
        label: "B",
        x: 285,
        y: 125,
        next: [2],
      },
      {
        label: "C",
        x: 430,
        y: 125,
        next: [3],
      },
      {
        label: "D",
        x: 575,
        y: 125,
        next: [4, 5],
      },
      {
        label: "E",
        x: 140,
        y: 260,
        next: [],
      },
      {
        label: "F",
        x: 285,
        y: 260,
        next: [],
      },
    ],
    starts: [0, 1],
    goals: [4, 5],
    holdAllowed: [true, true],
    certificate: {
      actions: [
        {
          switches: [0],
          holds: [false, true],
        },
        {
          switches: [0],
          holds: [false, false],
        },
        {
          switches: [0],
          holds: [false, false],
        },
        {
          switches: [1],
          holds: [false, false],
        },
      ],
      ticks: 4,
    },
  },
  {
    id: "rt-03",
    title: "侧线避开对撞",
    lesson: "迎面对换也会冲突。把一辆车引进侧线，另一辆才能通过。",
    nodes: [
      {
        label: "A",
        x: 140,
        y: 125,
        next: [1],
      },
      {
        label: "B",
        x: 285,
        y: 125,
        next: [2, 4],
      },
      {
        label: "C",
        x: 430,
        y: 125,
        next: [1, 3],
      },
      {
        label: "D",
        x: 575,
        y: 125,
        next: [2],
      },
      {
        label: "E",
        x: 140,
        y: 260,
        next: [2],
      },
    ],
    starts: [0, 3],
    goals: [3, 1],
    holdAllowed: [true, true],
    certificate: {
      actions: [
        {
          switches: [0, 0],
          holds: [false, false],
        },
        {
          switches: [1, 0],
          holds: [false, false],
        },
        {
          switches: [0, 0],
          holds: [false, false],
        },
        {
          switches: [0, 1],
          holds: [false, false],
        },
      ],
      ticks: 4,
    },
  },
  {
    id: "rt-04",
    title: "终点也占位置",
    lesson: "终点不是消失点。让另一辆先经过中途终点，再把 α 停进去。",
    nodes: [
      {
        label: "A",
        x: 140,
        y: 125,
        next: [2],
      },
      {
        label: "B",
        x: 285,
        y: 125,
        next: [3],
      },
      {
        label: "C",
        x: 430,
        y: 125,
        next: [4],
      },
      {
        label: "D",
        x: 575,
        y: 125,
        next: [2],
      },
      {
        label: "E",
        x: 140,
        y: 260,
        next: [5],
      },
      {
        label: "F",
        x: 285,
        y: 260,
        next: [],
      },
    ],
    starts: [0, 1],
    goals: [2, 5],
    holdAllowed: [true, true],
    certificate: {
      actions: [
        {
          switches: [],
          holds: [true, false],
        },
        {
          switches: [],
          holds: [true, false],
        },
        {
          switches: [],
          holds: [false, false],
        },
        {
          switches: [],
          holds: [false, false],
        },
      ],
      ticks: 4,
    },
  },
  {
    id: "rt-05",
    title: "蓝车不停站",
    lesson: "β 没有等待信号，只会持续前进直到终点。安排 α 的路线和节奏配合它。",
    nodes: [
      {
        label: "A",
        x: 140,
        y: 125,
        next: [2],
      },
      {
        label: "B",
        x: 285,
        y: 125,
        next: [3],
      },
      {
        label: "C",
        x: 430,
        y: 125,
        next: [4],
      },
      {
        label: "D",
        x: 575,
        y: 125,
        next: [2],
      },
      {
        label: "E",
        x: 140,
        y: 260,
        next: [5, 6],
      },
      {
        label: "F",
        x: 285,
        y: 260,
        next: [],
      },
      {
        label: "G",
        x: 430,
        y: 260,
        next: [],
      },
    ],
    starts: [0, 1],
    goals: [5, 6],
    holdAllowed: [true, false],
    certificate: {
      actions: [
        {
          switches: [0],
          holds: [false, false],
        },
        {
          switches: [0],
          holds: [false, false],
        },
        {
          switches: [0],
          holds: [false, false],
        },
        {
          switches: [1],
          holds: [false, false],
        },
      ],
      ticks: 4,
    },
    deadline: 6,
  },
  {
    id: "rt-06",
    title: "环线回头路",
    lesson: "同一个道岔会用不止一次。先汇入环线，再让每辆车选择各自出口。",
    nodes: [
      {
        label: "A",
        x: 140,
        y: 125,
        next: [2],
      },
      {
        label: "B",
        x: 285,
        y: 125,
        next: [3],
      },
      {
        label: "C",
        x: 430,
        y: 125,
        next: [3, 4],
      },
      {
        label: "D",
        x: 575,
        y: 125,
        next: [2, 5],
      },
      {
        label: "E",
        x: 140,
        y: 260,
        next: [6],
      },
      {
        label: "F",
        x: 285,
        y: 260,
        next: [7],
      },
      {
        label: "G",
        x: 430,
        y: 260,
        next: [],
      },
      {
        label: "H",
        x: 575,
        y: 260,
        next: [],
      },
    ],
    starts: [0, 1],
    goals: [7, 6],
    holdAllowed: [true, true],
    certificate: {
      actions: [
        {
          switches: [0, 0],
          holds: [false, true],
        },
        {
          switches: [0, 0],
          holds: [false, true],
        },
        {
          switches: [0, 1],
          holds: [false, false],
        },
        {
          switches: [0, 0],
          holds: [false, false],
        },
        {
          switches: [1, 0],
          holds: [false, false],
        },
        {
          switches: [0, 0],
          holds: [false, false],
        },
      ],
      ticks: 6,
    },
  },
  {
    id: "rt-07",
    title: "两端交错",
    lesson:
      "两个方向共用一对道岔。走进对方终点并不停车，但到自己的终点就会永久停驻。",
    nodes: [
      {
        label: "A",
        x: 140,
        y: 125,
        next: [2],
      },
      {
        label: "B",
        x: 285,
        y: 125,
        next: [3],
      },
      {
        label: "C",
        x: 430,
        y: 125,
        next: [3, 4],
      },
      {
        label: "D",
        x: 575,
        y: 125,
        next: [2, 5],
      },
      {
        label: "E",
        x: 140,
        y: 260,
        next: [3],
      },
      {
        label: "F",
        x: 285,
        y: 260,
        next: [2],
      },
    ],
    starts: [0, 1],
    goals: [5, 4],
    holdAllowed: [true, true],
    certificate: {
      actions: [
        {
          switches: [0, 0],
          holds: [false, false],
        },
        {
          switches: [0, 1],
          holds: [false, false],
        },
        {
          switches: [0, 0],
          holds: [true, false],
        },
        {
          switches: [1, 1],
          holds: [false, false],
        },
      ],
      ticks: 4,
    },
  },
  {
    id: "rt-08",
    title: "短路与绕路",
    lesson: "两条路径长短不同。比较分岔后的汇合位置，避免把车送进错误的尽头。",
    nodes: [
      {
        label: "A",
        x: 140,
        y: 125,
        next: [2],
      },
      {
        label: "B",
        x: 285,
        y: 125,
        next: [3],
      },
      {
        label: "C",
        x: 430,
        y: 125,
        next: [3, 4],
      },
      {
        label: "D",
        x: 575,
        y: 125,
        next: [5, 6],
      },
      {
        label: "E",
        x: 140,
        y: 260,
        next: [6],
      },
      {
        label: "F",
        x: 285,
        y: 260,
        next: [7],
      },
      {
        label: "G",
        x: 430,
        y: 260,
        next: [8],
      },
      {
        label: "H",
        x: 575,
        y: 260,
        next: [],
      },
      {
        label: "I",
        x: 140,
        y: 395,
        next: [],
      },
    ],
    starts: [0, 1],
    goals: [8, 7],
    holdAllowed: [true, true],
    certificate: {
      actions: [
        {
          switches: [0, 0],
          holds: [false, false],
        },
        {
          switches: [0, 0],
          holds: [false, false],
        },
        {
          switches: [0, 1],
          holds: [false, false],
        },
        {
          switches: [0, 0],
          holds: [false, false],
        },
      ],
      ticks: 4,
    },
    deadline: 6,
  },
  {
    id: "rt-09",
    title: "一站不能先停",
    lesson:
      "α 的终点是 β 的必经之地。预算只容许少量等待，先给 β 留出通过窗口。",
    nodes: [
      {
        label: "A",
        x: 140,
        y: 125,
        next: [2],
      },
      {
        label: "B",
        x: 285,
        y: 125,
        next: [3],
      },
      {
        label: "C",
        x: 430,
        y: 125,
        next: [4],
      },
      {
        label: "D",
        x: 575,
        y: 125,
        next: [2],
      },
      {
        label: "E",
        x: 140,
        y: 260,
        next: [5, 6],
      },
      {
        label: "F",
        x: 285,
        y: 260,
        next: [],
      },
      {
        label: "G",
        x: 430,
        y: 260,
        next: [],
      },
    ],
    starts: [0, 1],
    goals: [4, 6],
    holdAllowed: [true, true],
    certificate: {
      actions: [
        {
          switches: [0],
          holds: [true, false],
        },
        {
          switches: [0],
          holds: [true, false],
        },
        {
          switches: [0],
          holds: [false, false],
        },
        {
          switches: [1],
          holds: [false, false],
        },
      ],
      ticks: 4,
    },
    deadline: 5,
  },
  {
    id: "rt-10",
    title: "双车借用侧线",
    lesson: "侧线让你绕回之前的道岔。注意另一辆车停在终点后，会封住哪条出口。",
    nodes: [
      {
        label: "A",
        x: 140,
        y: 125,
        next: [2],
      },
      {
        label: "B",
        x: 285,
        y: 125,
        next: [5],
      },
      {
        label: "C",
        x: 430,
        y: 125,
        next: [3, 6],
      },
      {
        label: "D",
        x: 575,
        y: 125,
        next: [4],
      },
      {
        label: "E",
        x: 140,
        y: 260,
        next: [3, 7],
      },
      {
        label: "F",
        x: 285,
        y: 260,
        next: [4],
      },
      {
        label: "G",
        x: 430,
        y: 260,
        next: [4],
      },
      {
        label: "H",
        x: 575,
        y: 260,
        next: [2],
      },
    ],
    starts: [0, 1],
    goals: [7, 6],
    holdAllowed: [true, true],
    certificate: {
      actions: [
        {
          switches: [0, 0],
          holds: [false, false],
        },
        {
          switches: [0, 0],
          holds: [false, false],
        },
        {
          switches: [0, 1],
          holds: [false, false],
        },
        {
          switches: [0, 0],
          holds: [true, false],
        },
        {
          switches: [1, 1],
          holds: [false, false],
        },
      ],
      ticks: 5,
    },
    deadline: 8,
  },
  {
    id: "rt-11",
    title: "信号灯的空档",
    lesson:
      "β 不可等待，α 需要留出恰好一个空档。两个道岔的选择要在相应车离站前设好。",
    nodes: [
      {
        label: "A",
        x: 140,
        y: 125,
        next: [2],
      },
      {
        label: "B",
        x: 285,
        y: 125,
        next: [3],
      },
      {
        label: "C",
        x: 430,
        y: 125,
        next: [4],
      },
      {
        label: "D",
        x: 575,
        y: 125,
        next: [4],
      },
      {
        label: "E",
        x: 140,
        y: 260,
        next: [5, 6],
      },
      {
        label: "F",
        x: 285,
        y: 260,
        next: [7],
      },
      {
        label: "G",
        x: 430,
        y: 260,
        next: [8],
      },
      {
        label: "H",
        x: 575,
        y: 260,
        next: [6, 9],
      },
      {
        label: "I",
        x: 140,
        y: 395,
        next: [10],
      },
      {
        label: "J",
        x: 285,
        y: 395,
        next: [],
      },
      {
        label: "K",
        x: 430,
        y: 395,
        next: [],
      },
    ],
    starts: [0, 1],
    goals: [10, 9],
    holdAllowed: [true, false],
    certificate: {
      actions: [
        {
          switches: [0, 0],
          holds: [false, false],
        },
        {
          switches: [0, 0],
          holds: [true, false],
        },
        {
          switches: [0, 0],
          holds: [false, false],
        },
        {
          switches: [1, 0],
          holds: [false, false],
        },
        {
          switches: [0, 1],
          holds: [false, false],
        },
        {
          switches: [0, 0],
          holds: [false, false],
        },
      ],
      ticks: 6,
    },
    deadline: 8,
  },
  {
    id: "rt-12",
    title: "终点前的会车",
    lesson:
      "五步期限等于最短可行行程。β 要先经过 α 的终点，再绕回自己的出口；顺序不能颠倒。",
    nodes: [
      {
        label: "A",
        x: 140,
        y: 125,
        next: [2],
      },
      {
        label: "B",
        x: 285,
        y: 125,
        next: [4],
      },
      {
        label: "C",
        x: 430,
        y: 125,
        next: [3, 6],
      },
      {
        label: "D",
        x: 575,
        y: 125,
        next: [4],
      },
      {
        label: "E",
        x: 140,
        y: 260,
        next: [3, 7],
      },
      {
        label: "F",
        x: 285,
        y: 260,
        next: [4],
      },
      {
        label: "G",
        x: 430,
        y: 260,
        next: [5],
      },
      {
        label: "H",
        x: 575,
        y: 260,
        next: [8],
      },
      {
        label: "I",
        x: 140,
        y: 395,
        next: [2],
      },
    ],
    starts: [0, 1],
    goals: [7, 6],
    holdAllowed: [true, true],
    certificate: {
      actions: [
        {
          switches: [0, 0],
          holds: [false, false],
        },
        {
          switches: [0, 1],
          holds: [false, false],
        },
        {
          switches: [0, 0],
          holds: [false, false],
        },
        {
          switches: [0, 0],
          holds: [true, false],
        },
        {
          switches: [1, 1],
          holds: [false, false],
        },
      ],
      ticks: 5,
    },
    deadline: 5,
  },
];
