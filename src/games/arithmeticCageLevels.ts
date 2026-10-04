/** Original MIT connected cage boards; no imported puzzle collection. */
export type ArithmeticCage = {
  cells: number[];
  op: "=" | "+" | "−" | "×" | "÷";
  target: number;
};
export type ArithmeticCageLevel = {
  title: string;
  lesson: string;
  size: number;
  cages: ArithmeticCage[];
};
export const arithmeticCageLevels: ArithmeticCageLevel[] = [
  {
    title: "和数入门",
    lesson: "先解单格，再用两格总和确定剩下的数字。",
    size: 3,
    cages: [
      {
        cells: [0],
        op: "=",
        target: 1,
      },
      {
        cells: [1, 4],
        op: "+",
        target: 4,
      },
      {
        cells: [2, 5],
        op: "+",
        target: 5,
      },
      {
        cells: [3, 6],
        op: "+",
        target: 5,
      },
      {
        cells: [7, 8],
        op: "+",
        target: 3,
      },
    ],
  },
  {
    title: "因数小屋",
    lesson: "乘积给出因数组合：例如 6× 可以从 2 与 3 入手。",
    size: 3,
    cages: [
      {
        cells: [0],
        op: "=",
        target: 2,
      },
      {
        cells: [1, 4],
        op: "+",
        target: 3,
      },
      {
        cells: [2, 5],
        op: "×",
        target: 3,
      },
      {
        cells: [3, 6],
        op: "+",
        target: 4,
      },
      {
        cells: [7, 8],
        op: "+",
        target: 5,
      },
    ],
  },
  {
    title: "大小之差",
    lesson: "两格减法取大数减小数，位置要用行列排除。",
    size: 3,
    cages: [
      {
        cells: [0, 3],
        op: "−",
        target: 2,
      },
      {
        cells: [1],
        op: "=",
        target: 1,
      },
      {
        cells: [2, 5],
        op: "×",
        target: 6,
      },
      {
        cells: [4, 7, 8],
        op: "×",
        target: 6,
      },
      {
        cells: [6],
        op: "=",
        target: 2,
      },
    ],
  },
  {
    title: "整除之门",
    lesson: "除法只接受整数商：3÷ 对应大数是小数的三倍。",
    size: 3,
    cages: [
      {
        cells: [0, 1],
        op: "−",
        target: 1,
      },
      {
        cells: [2],
        op: "=",
        target: 3,
      },
      {
        cells: [3, 6],
        op: "+",
        target: 5,
      },
      {
        cells: [4, 5],
        op: "÷",
        target: 2,
      },
      {
        cells: [7, 8],
        op: "−",
        target: 2,
      },
    ],
  },
  {
    title: "四数工坊",
    lesson: "扩展到 1–4，用和数范围排除过大或过小的组合。",
    size: 4,
    cages: [
      {
        cells: [0, 4],
        op: "+",
        target: 6,
      },
      {
        cells: [1],
        op: "=",
        target: 2,
      },
      {
        cells: [2, 3, 7],
        op: "+",
        target: 8,
      },
      {
        cells: [5, 6],
        op: "−",
        target: 2,
      },
      {
        cells: [8, 12],
        op: "−",
        target: 2,
      },
      {
        cells: [9, 10],
        op: "−",
        target: 2,
      },
      {
        cells: [11],
        op: "=",
        target: 1,
      },
      {
        cells: [13, 14, 15],
        op: "+",
        target: 9,
      },
    ],
  },
  {
    title: "乘积走廊",
    lesson: "四数棋盘的乘积因数比直接试数更有效。",
    size: 4,
    cages: [
      {
        cells: [0, 1],
        op: "×",
        target: 8,
      },
      {
        cells: [2, 6],
        op: "+",
        target: 7,
      },
      {
        cells: [3, 7],
        op: "+",
        target: 4,
      },
      {
        cells: [4, 5, 9],
        op: "+",
        target: 6,
      },
      {
        cells: [8, 12],
        op: "+",
        target: 4,
      },
      {
        cells: [10, 13, 14],
        op: "+",
        target: 7,
      },
      {
        cells: [11, 15],
        op: "+",
        target: 6,
      },
    ],
  },
  {
    title: "和差交错",
    lesson: "先用两格的差缩小数对，再用加法总和与行列限制交叉筛选。",
    size: 4,
    cages: [
      {
        cells: [0, 4],
        op: "+",
        target: 5,
      },
      {
        cells: [1],
        op: "=",
        target: 4,
      },
      {
        cells: [2, 6],
        op: "−",
        target: 1,
      },
      {
        cells: [3, 7],
        op: "+",
        target: 3,
      },
      {
        cells: [5, 9],
        op: "+",
        target: 4,
      },
      {
        cells: [8, 12, 13],
        op: "+",
        target: 7,
      },
      {
        cells: [10, 14],
        op: "−",
        target: 3,
      },
      {
        cells: [11, 15],
        op: "+",
        target: 7,
      },
    ],
  },
  {
    title: "折角运算",
    lesson: "L 形笼跨行跨列，笼内非同行列的数字可以重复。",
    size: 4,
    cages: [
      {
        cells: [0, 4],
        op: "+",
        target: 7,
      },
      {
        cells: [1],
        op: "=",
        target: 3,
      },
      {
        cells: [2, 5, 6],
        op: "+",
        target: 4,
      },
      {
        cells: [3, 7, 11],
        op: "+",
        target: 7,
      },
      {
        cells: [8, 12],
        op: "÷",
        target: 2,
      },
      {
        cells: [9, 10, 13, 14],
        op: "×",
        target: 96,
      },
      {
        cells: [15],
        op: "=",
        target: 3,
      },
    ],
  },
  {
    title: "五数之和",
    lesson: "用 1–5 的总和 15，配合笼内和数寻找缺项。",
    size: 5,
    cages: [
      {
        cells: [0, 5, 6],
        op: "+",
        target: 10,
      },
      {
        cells: [1, 2],
        op: "÷",
        target: 2,
      },
      {
        cells: [3, 8],
        op: "−",
        target: 4,
      },
      {
        cells: [4, 9],
        op: "+",
        target: 5,
      },
      {
        cells: [7, 12, 13],
        op: "+",
        target: 10,
      },
      {
        cells: [10],
        op: "=",
        target: 2,
      },
      {
        cells: [11, 16, 17],
        op: "+",
        target: 7,
      },
      {
        cells: [14, 19, 24],
        op: "+",
        target: 10,
      },
      {
        cells: [15, 20, 21],
        op: "+",
        target: 8,
      },
      {
        cells: [18, 22, 23],
        op: "+",
        target: 11,
      },
    ],
  },
  {
    title: "因数花窗",
    lesson: "五数棋盘加入乘积，先找只含少量因子的目标。",
    size: 5,
    cages: [
      {
        cells: [0],
        op: "=",
        target: 5,
      },
      {
        cells: [1, 6],
        op: "×",
        target: 3,
      },
      {
        cells: [2, 3, 7],
        op: "×",
        target: 60,
      },
      {
        cells: [4],
        op: "=",
        target: 2,
      },
      {
        cells: [5, 10, 11],
        op: "+",
        target: 10,
      },
      {
        cells: [8, 9],
        op: "×",
        target: 8,
      },
      {
        cells: [12, 17],
        op: "+",
        target: 5,
      },
      {
        cells: [13, 18, 23],
        op: "×",
        target: 20,
      },
      {
        cells: [14, 19, 24],
        op: "×",
        target: 15,
      },
      {
        cells: [15, 16],
        op: "÷",
        target: 2,
      },
      {
        cells: [20, 21, 22],
        op: "+",
        target: 6,
      },
    ],
  },
  {
    title: "多格交会",
    lesson: "三格和与多格乘积交叉，注意重复限制来自行列。",
    size: 5,
    cages: [
      {
        cells: [0, 1, 5],
        op: "+",
        target: 12,
      },
      {
        cells: [2, 3, 4],
        op: "+",
        target: 8,
      },
      {
        cells: [6, 7],
        op: "÷",
        target: 3,
      },
      {
        cells: [8, 9],
        op: "−",
        target: 2,
      },
      {
        cells: [10, 15, 20],
        op: "×",
        target: 6,
      },
      {
        cells: [11, 12, 16],
        op: "+",
        target: 12,
      },
      {
        cells: [13, 14, 18],
        op: "+",
        target: 8,
      },
      {
        cells: [17],
        op: "=",
        target: 4,
      },
      {
        cells: [19, 24],
        op: "+",
        target: 7,
      },
      {
        cells: [21],
        op: "=",
        target: 4,
      },
      {
        cells: [22, 23],
        op: "×",
        target: 3,
      },
    ],
  },
  {
    title: "四则总工坊",
    lesson: "在一个棋盘综合和、差、积、商，把运算组合转化成位置。",
    size: 5,
    cages: [
      {
        cells: [0, 1, 5, 6],
        op: "+",
        target: 9,
      },
      {
        cells: [2],
        op: "=",
        target: 5,
      },
      {
        cells: [3, 4, 9, 14],
        op: "×",
        target: 40,
      },
      {
        cells: [7, 8],
        op: "÷",
        target: 2,
      },
      {
        cells: [10, 11, 16, 17],
        op: "+",
        target: 11,
      },
      {
        cells: [12, 13, 18],
        op: "×",
        target: 30,
      },
      {
        cells: [15, 20],
        op: "×",
        target: 20,
      },
      {
        cells: [19, 24],
        op: "−",
        target: 2,
      },
      {
        cells: [21],
        op: "=",
        target: 2,
      },
      {
        cells: [22, 23],
        op: "+",
        target: 7,
      },
    ],
  },
];
