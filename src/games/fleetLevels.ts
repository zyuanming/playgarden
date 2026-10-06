// SPDX-License-Identifier: GPL-3.0-only
// Original authored fleets; explicit counts and clues are independent of verification certificates.
import type { FleetLevel } from "./fleetLogic";
export const fleetLevels: readonly FleetLevel[] = [
  {
    id: "fleet-01",
    title: "从零行开始",
    lesson: "数字表示这一行或列的船格总数。总数为零的整行都是海水。",
    size: 4,
    fleet: [2, 1],
    rowTotals: [2, 0, 1, 0],
    colTotals: [1, 1, 0, 1],
    clues: [
      {
        cell: 12,
        fragment: "sea",
      },
    ],
    certificate: {
      occupied: [0, 1, 11],
      unique: true,
      nodes: 3,
    },
  },
  {
    id: "fleet-02",
    title: "朝南的船头",
    lesson: "北端线索指明船向南延伸；船的周围连斜角都要留海水。",
    size: 4,
    fleet: [2, 1, 1],
    rowTotals: [2, 1, 0, 1],
    colTotals: [2, 0, 1, 1],
    clues: [
      {
        cell: 0,
        fragment: "N",
      },
      {
        cell: 3,
        fragment: "single",
      },
    ],
    certificate: {
      occupied: [0, 3, 4, 14],
      unique: true,
      nodes: 6,
    },
  },
  {
    id: "fleet-03",
    title: "中段告诉你",
    lesson: "横向中段两侧必有船格。结合清单，它属于三格长船。",
    size: 4,
    fleet: [3, 2],
    rowTotals: [3, 0, 0, 2],
    colTotals: [2, 2, 1, 0],
    clues: [
      {
        cell: 1,
        fragment: "middle-h",
      },
    ],
    certificate: {
      occupied: [0, 1, 2, 12, 13],
      unique: true,
      nodes: 3,
    },
  },
  {
    id: "fleet-04",
    title: "孤船的留白",
    lesson: "单格船四周八格都不能再放船。用这圈海水缩小其余船的位置。",
    size: 5,
    fleet: [3, 2, 1, 1],
    rowTotals: [3, 1, 1, 1, 1],
    colTotals: [3, 1, 0, 2, 1],
    clues: [
      {
        cell: 18,
        fragment: "single",
      },
    ],
    certificate: {
      occupied: [0, 3, 4, 5, 10, 18, 21],
      unique: true,
      nodes: 11,
    },
  },
  {
    id: "fleet-05",
    title: "船尾反推",
    lesson: "东端的船向西延伸。注意两格船和三格船的长度区别。",
    size: 5,
    fleet: [3, 2, 1, 1],
    rowTotals: [3, 0, 2, 0, 2],
    colTotals: [1, 2, 2, 1, 1],
    clues: [
      {
        cell: 12,
        fragment: "E",
      },
    ],
    certificate: {
      occupied: [1, 2, 3, 11, 12, 20, 24],
      unique: true,
      nodes: 28,
    },
  },
  {
    id: "fleet-06",
    title: "纵向中段",
    lesson: "竖直中段确定一条三格船；再利用剩余行列计数找其他船。",
    size: 5,
    fleet: [3, 2, 2, 1],
    rowTotals: [2, 2, 1, 2, 1],
    colTotals: [4, 0, 1, 3, 0],
    clues: [
      {
        cell: 5,
        fragment: "middle-v",
      },
    ],
    certificate: {
      occupied: [0, 3, 5, 8, 10, 17, 18, 20],
      unique: true,
      nodes: 11,
    },
  },
  {
    id: "fleet-07",
    title: "把长船先落位",
    lesson: "最长的船占据连续三格。确定它后，从行列总数扣除已知部分。",
    size: 6,
    fleet: [3, 2, 2, 1, 1],
    rowTotals: [4, 1, 0, 2, 1, 1],
    colTotals: [3, 1, 1, 1, 1, 2],
    clues: [
      {
        cell: 2,
        fragment: "E",
      },
      {
        cell: 21,
        fragment: "single",
      },
    ],
    certificate: {
      occupied: [0, 1, 2, 5, 11, 18, 21, 24, 34],
      unique: true,
      nodes: 20,
    },
  },
  {
    id: "fleet-08",
    title: "两种方向",
    lesson: "船可以横放或竖放，但不能拐弯。利用端点判断方向。",
    size: 6,
    fleet: [3, 2, 2, 1, 1],
    rowTotals: [3, 1, 1, 2, 0, 2],
    colTotals: [4, 0, 0, 2, 2, 1],
    clues: [
      {
        cell: 6,
        fragment: "middle-v",
      },
      {
        cell: 4,
        fragment: "E",
      },
      {
        cell: 21,
        fragment: "W",
      },
    ],
    certificate: {
      occupied: [0, 3, 4, 6, 12, 21, 22, 30, 35],
      unique: true,
      nodes: 15,
    },
  },
  {
    id: "fleet-09",
    title: "双长船的边界",
    lesson: "两条三格船也必须彼此留白。相同长度的船无需编号。",
    size: 6,
    fleet: [3, 3, 2, 1, 1],
    rowTotals: [3, 0, 3, 1, 1, 2],
    colTotals: [3, 1, 2, 1, 1, 2],
    clues: [
      {
        cell: 18,
        fragment: "middle-v",
      },
      {
        cell: 16,
        fragment: "W",
      },
    ],
    certificate: {
      occupied: [1, 2, 3, 12, 16, 17, 18, 24, 32, 35],
      unique: true,
      nodes: 15,
    },
  },
  {
    id: "fleet-10",
    title: "海峡不接触",
    lesson: "即使行列总数相符，两艘船也不能在角上接触。",
    size: 6,
    fleet: [3, 2, 2, 1, 1],
    rowTotals: [3, 1, 1, 1, 1, 2],
    colTotals: [4, 0, 0, 3, 1, 1],
    clues: [
      {
        cell: 3,
        fragment: "W",
      },
      {
        cell: 27,
        fragment: "S",
      },
    ],
    certificate: {
      occupied: [0, 3, 4, 6, 12, 21, 27, 30, 35],
      unique: true,
      nodes: 25,
    },
  },
  {
    id: "fleet-11",
    title: "最后一格海水",
    lesson: "船队清单和海水线索共同约束剩余位置；不要只按行列数字填。",
    size: 6,
    fleet: [3, 3, 2, 1, 1],
    rowTotals: [4, 1, 1, 1, 2, 1],
    colTotals: [3, 1, 2, 0, 1, 3],
    clues: [
      {
        cell: 11,
        fragment: "middle-v",
      },
      {
        cell: 18,
        fragment: "N",
      },
      {
        cell: 28,
        fragment: "single",
      },
    ],
    certificate: {
      occupied: [0, 1, 2, 5, 11, 17, 18, 24, 28, 32],
      unique: true,
      nodes: 12,
    },
  },
  {
    id: "fleet-12",
    title: "完整海图",
    lesson: "同时核对两条长船、一条短船和三条单格船，以及所有斜角留白。",
    size: 6,
    fleet: [3, 3, 2, 1, 1, 1],
    rowTotals: [4, 1, 2, 1, 1, 2],
    colTotals: [4, 0, 1, 1, 3, 2],
    clues: [
      {
        cell: 6,
        fragment: "middle-v",
      },
      {
        cell: 4,
        fragment: "middle-h",
      },
      {
        cell: 26,
        fragment: "single",
      },
    ],
    certificate: {
      occupied: [0, 3, 4, 5, 6, 12, 16, 22, 26, 30, 35],
      unique: true,
      nodes: 41,
    },
  },
];
