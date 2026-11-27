// SPDX-License-Identifier: GPL-3.0-only
import { makeBoard } from "./magneticMazeLogic";

export const magneticBoards = [
  makeBoard("magnetic-maze-01", ["PES"], "N", "第一次吸引"),
  makeBoard("magnetic-maze-02", ["NP.E"], "N", "同极推开"),
  makeBoard("magnetic-maze-03", ["...o","NP..","..NE","...S"], "N", "换一条滑轨"),
  makeBoard("magnetic-maze-04", ["....","oPEN","S#..","N..."], "N", "到翻转台"),
  makeBoard("magnetic-maze-05", ["#S.#","...S","SE.o","NP.."], "N", "别滑过头"),
  makeBoard("magnetic-maze-06", ["..S..",".N...","..EN#","#PoS."], "N", "翻极接力"),
  makeBoard("magnetic-maze-07", ["PES..","o..#.","..oN.","N.#N#"], "S", "跨过两排磁铁"),
  makeBoard("magnetic-maze-08", ["#..S.","N.PS.","o..oS",".ES..","##.#."], "N", "先找落点"),
  makeBoard("magnetic-maze-09", ["ES...",".P.N#","o.N#.","S..#.",".o.S#"], "S", "原路也能变"),
  makeBoard("magnetic-maze-10", ["...o#","#.N.#","S..P.","E.oS#",".S..N"], "S", "一极多用"),
  makeBoard("magnetic-maze-11", [".N.o#","#...#","S..P.","..oS#","ES..N"], "S", "不同磁铁，同一落点"),
  makeBoard("magnetic-maze-12", ["#o.S.","N.PS.","...oS","..S..","##.#E"], "S", "磁场回路"),
] as const;
