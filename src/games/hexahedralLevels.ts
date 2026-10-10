// Original Hexahedral levels, Copyright (c) 2018 Matthew Miner, MIT.
// Every layout, starting position and move budget matches a2641001.
export type HexahedralLevel={id:string;maxMoves:number;start:number;rows:string[];chapter:string};
export const hexahedralLevels:readonly HexahedralLevel[]=[
  {
    "id": "hexahedral-01",
    "maxMoves": 3,
    "start": 1,
    "rows": [
      "0_",
      "00"
    ],
    "chapter": "初阶"
  },
  {
    "id": "hexahedral-02",
    "maxMoves": 4,
    "start": 2,
    "rows": [
      "_0",
      "0x"
    ],
    "chapter": "初阶"
  },
  {
    "id": "hexahedral-03",
    "maxMoves": 8,
    "start": 6,
    "rows": [
      "_00",
      "00x",
      "0_0"
    ],
    "chapter": "初阶"
  },
  {
    "id": "hexahedral-04",
    "maxMoves": 8,
    "start": 1,
    "rows": [
      "_00",
      "0x0",
      "_00"
    ],
    "chapter": "初阶"
  },
  {
    "id": "hexahedral-05",
    "maxMoves": 6,
    "start": 4,
    "rows": [
      "_0x",
      "0_0",
      "x_0"
    ],
    "chapter": "初阶"
  },
  {
    "id": "hexahedral-06",
    "maxMoves": 7,
    "start": 8,
    "rows": [
      "_x0",
      "000",
      "_x0"
    ],
    "chapter": "初阶"
  },
  {
    "id": "hexahedral-07",
    "maxMoves": 8,
    "start": 7,
    "rows": [
      "00_",
      "0x_",
      "_x0"
    ],
    "chapter": "初阶"
  },
  {
    "id": "hexahedral-08",
    "maxMoves": 10,
    "start": 4,
    "rows": [
      "00x",
      "0_0",
      "0x0"
    ],
    "chapter": "初阶"
  },
  {
    "id": "hexahedral-09",
    "maxMoves": 12,
    "start": 2,
    "rows": [
      "x0_",
      "0x_",
      "___"
    ],
    "chapter": "初阶"
  },
  {
    "id": "hexahedral-10",
    "maxMoves": 12,
    "start": 2,
    "rows": [
      "0_0",
      "_x_",
      "0_0"
    ],
    "chapter": "初阶"
  },
  {
    "id": "hexahedral-11",
    "maxMoves": 12,
    "start": 2,
    "rows": [
      "_0__",
      "x_x_",
      "0_00",
      "0000"
    ],
    "chapter": "进阶"
  },
  {
    "id": "hexahedral-12",
    "maxMoves": 13,
    "start": 15,
    "rows": [
      "__x0",
      "x___",
      "0_x0",
      "_x00"
    ],
    "chapter": "进阶"
  },
  {
    "id": "hexahedral-13",
    "maxMoves": 10,
    "start": 9,
    "rows": [
      "_x00",
      "0_0_",
      "x_0_",
      "_0__"
    ],
    "chapter": "进阶"
  },
  {
    "id": "hexahedral-14",
    "maxMoves": 11,
    "start": 11,
    "rows": [
      "x00x",
      "_000",
      "x_0x",
      "0_xx"
    ],
    "chapter": "进阶"
  },
  {
    "id": "hexahedral-15",
    "maxMoves": 12,
    "start": 12,
    "rows": [
      "000_",
      "0x_0",
      "00_0",
      "_x__"
    ],
    "chapter": "进阶"
  },
  {
    "id": "hexahedral-16",
    "maxMoves": 9,
    "start": 6,
    "rows": [
      "__0_",
      "x000",
      "_00_",
      "_0__"
    ],
    "chapter": "进阶"
  },
  {
    "id": "hexahedral-17",
    "maxMoves": 17,
    "start": 1,
    "rows": [
      "00__",
      "x_x_",
      "x_x0",
      "x0x0"
    ],
    "chapter": "进阶"
  },
  {
    "id": "hexahedral-18",
    "maxMoves": 20,
    "start": 9,
    "rows": [
      "00x0",
      "x000",
      "00x0",
      "00x0"
    ],
    "chapter": "进阶"
  },
  {
    "id": "hexahedral-19",
    "maxMoves": 13,
    "start": 9,
    "rows": [
      "_x00",
      "00_0",
      "_x0x",
      "000_"
    ],
    "chapter": "进阶"
  },
  {
    "id": "hexahedral-20",
    "maxMoves": 12,
    "start": 10,
    "rows": [
      "0_00",
      "_0_0",
      "____",
      "0___"
    ],
    "chapter": "进阶"
  },
  {
    "id": "hexahedral-21",
    "maxMoves": 17,
    "start": 19,
    "rows": [
      "__0__",
      "_xx_x",
      "0_0_0",
      "x0xxx",
      "_0000"
    ],
    "chapter": "高阶"
  },
  {
    "id": "hexahedral-22",
    "maxMoves": 21,
    "start": 13,
    "rows": [
      "00000",
      "x_0_0",
      "0_0_0",
      "0_x_0",
      "00000"
    ],
    "chapter": "高阶"
  },
  {
    "id": "hexahedral-23",
    "maxMoves": 27,
    "start": 10,
    "rows": [
      "x0000",
      "00x00",
      "x0_00",
      "0__00",
      "00000"
    ],
    "chapter": "高阶"
  },
  {
    "id": "hexahedral-24",
    "maxMoves": 27,
    "start": 11,
    "rows": [
      "00000",
      "x0x00",
      "x000_",
      "00x00",
      "_0000"
    ],
    "chapter": "高阶"
  },
  {
    "id": "hexahedral-25",
    "maxMoves": 21,
    "start": 22,
    "rows": [
      "___00",
      "0x0x0",
      "_x_x0",
      "_x0x0",
      "0__00"
    ],
    "chapter": "高阶"
  },
  {
    "id": "hexahedral-26",
    "maxMoves": 20,
    "start": 12,
    "rows": [
      "00_00",
      "0_0_0",
      "000__",
      "___00",
      "x__00"
    ],
    "chapter": "高阶"
  },
  {
    "id": "hexahedral-27",
    "maxMoves": 24,
    "start": 12,
    "rows": [
      "00_00",
      "0x_x0",
      "__000",
      "0x_x_",
      "0_0__"
    ],
    "chapter": "高阶"
  },
  {
    "id": "hexahedral-28",
    "maxMoves": 23,
    "start": 8,
    "rows": [
      "00x00",
      "00_x0",
      "0x_0_",
      "000_0",
      "x____"
    ],
    "chapter": "高阶"
  },
  {
    "id": "hexahedral-29",
    "maxMoves": 17,
    "start": 18,
    "rows": [
      "00_xx",
      "0___x",
      "____0",
      "_00x0",
      "_00_x"
    ],
    "chapter": "高阶"
  },
  {
    "id": "hexahedral-30",
    "maxMoves": 23,
    "start": 13,
    "rows": [
      "___00",
      "0000_",
      "0x0x_",
      "00x__",
      "_00_0"
    ],
    "chapter": "高阶"
  }
];
