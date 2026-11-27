// SPDX-License-Identifier: GPL-3.0-only
export const dayProofs: readonly (readonly (readonly [string, readonly number[], number])[])[] = [
  [["AB",[0,2],5]],
  [["AB",[4,7],10]],
  [["BCA",[0,5,13],16]],
  [["BCA",[3,5,9],13]],
  [["DCAB",[3,6,8,12],13]],
  [["BACD",[4,6,14,18],20],["BADC",[4,6,15,17],21]],
  [["BCDA",[5,9,13,15],17]],
  [["CAEDB",[5,7,12,15,21],22]],
  [["BDCA",[3,9,17,21],25]],
  [["DBAEC",[2,8,18,20,24],29],["DBEAC",[2,8,16,18,24],29]],
  [["CEFBDA",[2,9,12,15,20,31],34]],
  [["BEFACD",[4,11,25,29,30,34],40]],
];
