// SPDX-License-Identifier: GPL-3.0-only
/** Original Playgarden layouts, written by hand. Dots are empty hex cells. */
export type BubbleColor = "R" | "B" | "G" | "Y";
export type BubbleLevel = { id: string; title: string; lesson: string; rows: readonly string[]; queue: readonly BubbleColor[] };
const stage = (id: string, title: string, lesson: string, rows: string[], queue: string): BubbleLevel => ({ id, title, lesson, rows, queue: [...queue] as BubbleColor[] });
export const bubbleShooterLevels: readonly BubbleLevel[] = [
  stage("first-meeting", "初次相遇", "红色已连成一对。看准虚线的落点，再发射第三颗。", ["....RR...."], "RRR"),
  stage("two-shores", "隔岸来信", "两座小岛要分别配色。试试向右墙瞄准，让红泡泡反弹到左边。", [".RR...BB.."], "RBRBRB"),
  stage("layer-cake", "双色夹心", "先打开下面的蓝色一层，再寻找上面的红色。", ["...RRR....", "...BB...."], "BRBRBR"),
  stage("three-bells", "三只风铃", "三串泡泡挂在天花板上。每串底端不同，先看完整的颜色队列。", ["RR..BB..GG", "R...B...G", "Y...R...Y."], "YYRBGYRBGY"),
  stage("loose-ribbon", "松开的缎带", "顶部红色是悬挂点。消掉连接处，失去天花板连接的泡泡会一起落下。", ["...RR.....", "...R.....", "..BBG.....", "..BYG...."], "BRGBYRGB"),
  stage("hanging-mobile", "悬挂风车", "从黄叶开始：消掉一组，留意它旁边失去支撑的小泡泡。", ["...RR.....", "...R.....", "...BB.....", "...B.....", "..GYY....."], "YBRGYBR"),
  stage("side-corridors", "两侧航道", "中间的长灯笼挡住直线。墙壁能把泡泡送往两侧，虚线会显示反弹。", ["RR..YY..BB", "....Y....", "...GGG....", "...GG....", "...RRR...."], "RBGYRBGRYB"),
  stage("paper-arch", "纸风拱门", "蓝、绿两端托着一座红色拱桥。观察一次消除会切断哪些连接。", ["..BB..GG..", "..RRRRR..", "...Y.Y....", "...YYY..."], "YRBGRYBG"),
  stage("offset-shelves", "错层书架", "每一层向旁边错开。先看落点轮廓，别把不同颜色的泡泡粘在一起。", [".RR....YY.", ".RB....YG", "..BB..GG..", "..B...G..", "..YY.RR..."], "YRBGYRBGRY"),
  stage("make-a-pair", "先交一个朋友", "黄色暂时只有一颗：第一发结伴，下一发才凑成三颗。没有消除也可能是准备。", [".RR....BB.", ".R.....B.", ".Y.....GG."], "YYGRBYYGRB"),
  stage("woven-canopy", "编织天幕", "四个颜色都连着天花板。下层花穗互相搭着，清空后再整理上面的彩带。", [".RRBBGGYY.", ".R.B.G.Y.", ".BB.YY.RR.", "..B.Y..R.", "..GGG..BB."], "GBYRGBYRGBYRGB"),
  stage("festival-lanterns", "灯会谢幕", "两串长灯笼各有四层。规划颜色顺序，也可以从侧面切断高处的悬挂点。", [".RR....YY.", ".R.....Y.", ".BB...GG..", ".B....G..", ".GG..BB...", ".G...B...", ".YY..RR..."], "YRGBBGRYYRGBBGRY"),
];
