/** Original authored replay certificates; verification uses independent test rules. */
export const hexCertificates = [
  {
    size: 3,
    startMoves: [4, 1, 2, 6, 0, 5, 3, 8],
    plies: [7],
  },
  {
    size: 3,
    startMoves: [4, 6, 1, 2, 0, 5],
    plies: [7],
  },
  {
    size: 3,
    startMoves: [5, 8, 4, 7],
    plies: [6, 0, 1],
  },
  {
    size: 3,
    startMoves: [3, 4],
    plies: [2, 0, 1, 5, 6],
  },
  {
    size: 4,
    startMoves: [12, 8, 6, 1, 0, 3, 2, 9, 11, 5],
    plies: [4, 7, 10, 13, 14],
  },
  {
    size: 4,
    startMoves: [6, 1, 3, 14, 9, 8, 7, 11],
    plies: [0, 2, 4, 5, 10, 12, 13],
  },
  {
    size: 4,
    startMoves: [10, 3, 12, 15, 7, 0],
    plies: [2, 1, 4, 5, 6, 8, 9],
  },
  {
    size: 4,
    startMoves: [8, 7, 12, 5, 11, 0],
    plies: [1, 2, 3, 4, 6, 9, 10, 13, 14],
  },
  {
    size: 5,
    startMoves: [
      7, 24, 6, 11, 15, 19, 3, 21, 9, 23, 0, 18, 2, 8, 13, 14, 20, 22,
    ],
    plies: [4, 1, 5, 10, 16, 12, 17],
  },
  {
    size: 5,
    startMoves: [21, 12, 7, 14, 16, 15, 23, 2, 11, 5, 10, 0, 13, 8],
    plies: [1, 3, 4, 6, 9, 17, 18],
  },
  {
    size: 5,
    startMoves: [3, 18, 2, 17, 14, 7, 13, 1, 5, 4, 11, 22, 15, 21, 0, 20],
    plies: [19, 6, 8, 9, 10, 12, 16, 23, 24],
  },
  {
    size: 5,
    startMoves: [20, 8, 4, 16, 7, 21, 11, 0, 1, 14, 23, 2, 15, 3],
    plies: [5, 6, 9, 10, 13, 12, 17, 18, 22],
  },
] as const;
export const dotsCertificates = [
  {
    rows: 1,
    columns: 3,
    startMoves: [1, 8, 4, 0, 6, 3, 9, 2],
    plies: [
      {
        p: 1,
        e: 5,
      },
      {
        p: 1,
        e: 7,
      },
    ],
  },
  {
    rows: 2,
    columns: 2,
    startMoves: [9, 5, 3, 11, 7, 2, 6, 10, 1],
    plies: [
      {
        p: 1,
        e: 0,
      },
      {
        p: 1,
        e: 4,
      },
      {
        p: 1,
        e: 8,
      },
    ],
  },
  {
    rows: 2,
    columns: 2,
    startMoves: [0, 7, 5, 2, 1, 6, 8, 3],
    plies: [
      {
        p: 1,
        e: 4,
      },
      {
        p: 2,
        e: 9,
      },
      {
        p: 1,
        e: 10,
      },
      {
        p: 1,
        e: 11,
      },
    ],
  },
  {
    rows: 2,
    columns: 2,
    startMoves: [4, 8, 7, 9, 5, 10, 2],
    plies: [
      {
        p: 1,
        e: 0,
      },
      {
        p: 2,
        e: 6,
      },
      {
        p: 2,
        e: 1,
      },
      {
        p: 1,
        e: 3,
      },
      {
        p: 1,
        e: 11,
      },
    ],
  },
  {
    rows: 2,
    columns: 2,
    startMoves: [3, 10, 11, 7, 9, 2],
    plies: [
      {
        p: 1,
        e: 4,
      },
      {
        p: 1,
        e: 5,
      },
      {
        p: 1,
        e: 0,
      },
      {
        p: 2,
        e: 6,
      },
      {
        p: 2,
        e: 1,
      },
      {
        p: 1,
        e: 8,
      },
    ],
  },
  {
    rows: 2,
    columns: 3,
    startMoves: [0, 6, 7, 2, 15, 9, 11, 5, 13, 12, 1],
    plies: [
      {
        p: 1,
        e: 8,
      },
      {
        p: 2,
        e: 16,
      },
      {
        p: 2,
        e: 3,
      },
      {
        p: 1,
        e: 10,
      },
      {
        p: 1,
        e: 4,
      },
      {
        p: 1,
        e: 14,
      },
    ],
  },
  {
    rows: 2,
    columns: 3,
    startMoves: [9, 2, 1, 8, 16, 4, 6, 5, 7, 10],
    plies: [
      {
        p: 1,
        e: 11,
      },
      {
        p: 1,
        e: 12,
      },
      {
        p: 1,
        e: 14,
      },
      {
        p: 2,
        e: 15,
      },
      {
        p: 2,
        e: 0,
      },
      {
        p: 1,
        e: 3,
      },
      {
        p: 1,
        e: 13,
      },
    ],
  },
  {
    rows: 2,
    columns: 3,
    startMoves: [16, 2, 6, 12, 14, 8, 9, 3, 13],
    plies: [
      {
        p: 1,
        e: 7,
      },
      {
        p: 2,
        e: 4,
      },
      {
        p: 1,
        e: 15,
      },
      {
        p: 1,
        e: 5,
      },
      {
        p: 1,
        e: 11,
      },
      {
        p: 1,
        e: 0,
      },
      {
        p: 2,
        e: 10,
      },
      {
        p: 2,
        e: 1,
      },
    ],
  },
  {
    rows: 3,
    columns: 3,
    startMoves: [10, 12, 18, 20, 2, 8, 0, 22, 4, 23, 19, 13, 17, 11, 5, 14],
    plies: [
      {
        p: 1,
        e: 1,
      },
      {
        p: 1,
        e: 3,
      },
      {
        p: 1,
        e: 7,
      },
      {
        p: 1,
        e: 15,
      },
      {
        p: 1,
        e: 21,
      },
      {
        p: 1,
        e: 6,
      },
      {
        p: 2,
        e: 9,
      },
      {
        p: 2,
        e: 16,
      },
    ],
  },
  {
    rows: 3,
    columns: 3,
    startMoves: [3, 17, 16, 11, 8, 9, 19, 4, 18, 5, 21, 13, 6, 10, 20],
    plies: [
      {
        p: 1,
        e: 7,
      },
      {
        p: 1,
        e: 22,
      },
      {
        p: 1,
        e: 23,
      },
      {
        p: 1,
        e: 1,
      },
      {
        p: 2,
        e: 14,
      },
      {
        p: 2,
        e: 0,
      },
      {
        p: 1,
        e: 12,
      },
      {
        p: 1,
        e: 2,
      },
      {
        p: 2,
        e: 15,
      },
    ],
  },
  {
    rows: 3,
    columns: 3,
    startMoves: [6, 10, 2, 23, 3, 21, 9, 5, 20, 22, 18, 4, 7, 19],
    plies: [
      {
        p: 1,
        e: 8,
      },
      {
        p: 1,
        e: 11,
      },
      {
        p: 1,
        e: 17,
      },
      {
        p: 1,
        e: 16,
      },
      {
        p: 1,
        e: 13,
      },
      {
        p: 2,
        e: 0,
      },
      {
        p: 1,
        e: 12,
      },
      {
        p: 1,
        e: 1,
      },
      {
        p: 2,
        e: 14,
      },
      {
        p: 2,
        e: 15,
      },
    ],
  },
  {
    rows: 3,
    columns: 3,
    startMoves: [0, 18, 22, 11, 1, 23, 8, 15, 2, 20, 5, 13, 9],
    plies: [
      {
        p: 1,
        e: 14,
      },
      {
        p: 1,
        e: 4,
      },
      {
        p: 1,
        e: 19,
      },
      {
        p: 1,
        e: 10,
      },
      {
        p: 2,
        e: 6,
      },
      {
        p: 1,
        e: 21,
      },
      {
        p: 1,
        e: 7,
      },
      {
        p: 1,
        e: 17,
      },
      {
        p: 1,
        e: 3,
      },
      {
        p: 2,
        e: 12,
      },
      {
        p: 2,
        e: 16,
      },
    ],
  },
] as const;
