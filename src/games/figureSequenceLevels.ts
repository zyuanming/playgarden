// SPDX-License-Identifier: GPL-3.0-only
import type { FigureBoard } from "./figureSequenceLogic";

export const figureSequenceLevels = [
  {"id":"figure-sequence-01","title":"沿同一个方向","shown":[55,436,472,null],"rules":["E","R","L"]},
  {"id":"figure-sequence-02","title":"翻一格","shown":[461,477,461,null],"rules":["T","H","C"]},
  {"id":"figure-sequence-03","title":"反射方向","shown":[249,444,249,null],"rules":["H","K","L","V"]},
  {"id":"figure-sequence-04","title":"看清翻色的位置","shown":[284,438,284,null],"rules":["H","E","R","K"]},
  {"id":"figure-sequence-05","title":"两张牌轮流","shown":[400,88,72,3,null],"rules":["RL","KH","TC","RT"]},
  {"id":"figure-sequence-06","title":"先镜像再翻角","shown":[42,42,43,46,47,null],"rules":["HT","KL","LT","HK"]},
  {"id":"figure-sequence-07","title":"轮到谁","shown":[390,45,360,null,195,360],"rules":["CL","TR","HR","LR","LC"]},
  {"id":"figure-sequence-08","title":"中间那一格","shown":[377,125,null,470,377,125],"rules":["VE","VC","VR","HK","LR"]},
  {"id":"figure-sequence-09","title":"两次留白","shown":[426,234,null,175,null,426,427],"rules":["TH","RK","CR","LK","RL"]},
  {"id":"figure-sequence-10","title":"先后不同","shown":[218,202,null,434,218,null,418],"rules":["RK","HT","VT","TH","TC"]},
  {"id":"figure-sequence-11","title":"结尾一样","shown":[370,null,31,181,null,472,null,181],"rules":["VK","KR","KV","HV","EV"]},
  {"id":"figure-sequence-12","title":"用两处线索复原","shown":[124,125,null,406,376,null,215,214],"rules":["LE","CT","KR","KC","KV","KL"]},
] as const satisfies readonly FigureBoard[];
