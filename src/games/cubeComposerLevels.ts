// SPDX-License-Identifier: GPL-3.0-only
// Original 25-level data and function IDs remain MIT, Copyright 2015–2016 David Peter.
import original from "./cubeComposerLevelsData.json" with { type: "json" };
import type { Wall } from "../vendor/cubeComposerCore";
export type CubeLevel = { id: string; number: number; chapter: number; name: string; difficulty: string; help: string | null; initial: Wall; target: Wall; functions: readonly string[] };
export const cubeChapterNames = ["初识函数", "替换与翻转", "相同列堆叠", "模式与通配", "稳定分区", "三位二进制"] as const;
export const cubeLevelHelp: Readonly<Record<string, string>> = {
  "0.1": "试着加入「黄色变红色」，观察整面墙怎样一次改变。",
  "0.2": "删除指定颜色时，试试函数库中的「移除」。",
  "0.3": "把「每列顶上加黄」和「移除所有黄色」放在一起。想想它们的先后次序。",
  "0.4": "这次自己试一试：你需要组合三个函数。",
  "1.1": "本章增加了几种函数。你可以随时跳过一关，稍后再回来。",
  "1.2": "「只留含红的列」会删除没有红块的整列。",
  "1.3": "「每列上下翻转」可以颠倒一列的上下顺序。",
  "1.4": "原作者的小注：这些关卡名称是随意选择的。",
  "2.1": "新函数会把相邻且完全相同的列堆叠在一起。试试看！",
  "2.2": "从这里开始，自己探索函数的组合吧。",
  "3.1": "本章引入通配符 X，它代表任意颜色的一个方块。",
  "4.1": "分区把不含红的列放左边，把含红的列放右边。",
  "4.2": "注意两组各自内部的列顺序，会与分区之前保持一致。",
  "4.3": "想想这里能怎样使用分区。",
  "5.1": "从顶向下读三位二进制。所有计算都对 8 取模。",
  "5.4": "这是原作的最后一关。原作者也欢迎玩家在开源仓库中设计自己的谜题。",
};
export const cubeComposerLevels: readonly CubeLevel[] = original.chapters.flatMap(chapter => chapter.levels.map(level => ({
  id: level.id, number: 0, chapter: chapter.chapter, name: level.name, difficulty: level.difficulty, help: level.help,
  initial: level.initial as Wall, target: level.target as Wall, functions: chapter.transformers.map(item => item.id),
}))).map((level, index) => ({ ...level, number: index + 1 }));
export const cubeFunctionLabels: Readonly<Record<string, { title: string; detail: string; notation: string }>> = {
  replaceYbyR: { title: "黄色变红色", detail: "每一个黄块替换为红块。", notation: "黄 → 红" },
  stackY: { title: "每列顶上加黄", detail: "在每一列的顶部添加一个黄块。", notation: "顶部 + 黄" },
  replaceYbyYR: { title: "黄块长出红块", detail: "每一个黄块变成下黄、上红两块。", notation: "黄 → [黄, 红]" },
  rejectY: { title: "移除所有黄色", detail: "删除每列的黄块，并删除空列。", notation: "删除 黄" },
  mapYtoYR: { title: "黄块长出红块", detail: "每一个黄块变成下黄、上红两块。", notation: "黄 → [黄, 红]" },
  mapCtoRC: { title: "青块底下加红", detail: "每一个青块变成下红、上青两块。", notation: "青 → [红, 青]" },
  rejectC: { title: "移除所有青色", detail: "删除每列的青块，并删除空列。", notation: "删除 青" },
  filterContainsR: { title: "只留含红的列", detail: "保留至少有一个红块的整列；其余整列删除。", notation: "保留 含红列" },
  stackR: { title: "每列顶上加红", detail: "在每一列的顶部添加一个红块。", notation: "顶部 + 红" },
  mapReverse: { title: "每列上下翻转", detail: "倒转每列的上下顺序，列的位置不变。", notation: "每列 ↕" },
  replaceYbyB: { title: "黄色变棕色", detail: "每一个黄块替换为棕块。", notation: "黄 → 棕" },
  replaceYbyBY: { title: "黄块底下加棕", detail: "每一个黄块变成下棕、上黄两块。", notation: "黄 → [棕, 黄]" },
  replaceBbyOO: { title: "棕块变双橙块", detail: "每一个棕块替换为上下两个橙块。", notation: "棕 → [橙, 橙]" },
  rejectO: { title: "移除所有橙色", detail: "删除每列的橙块，并删除空列。", notation: "删除 橙" },
  stackEqualColumns: { title: "堆叠相邻相同列", detail: "把连续相邻、逐块完全相同的列堆在一起；非相邻列不合并。", notation: "相邻等列 ⇧" },
  mapXtoOX: { title: "每块底下加橙", detail: "X 代表任意颜色。在每一个块下方插入橙块。", notation: "X → [橙, X]" },
  mapCXtoX: { title: "青色托底消除", detail: "从底向上读取，每遇到青块及其上方任意块，保留上方块并跳过这两块；落单青块保留。", notation: "[青, X] → X" },
  mapOOtoC: { title: "双橙合成青", detail: "从底向上，不重叠地把连续两个橙块换成一个青块；落单橙块保留。", notation: "[橙, 橙] → 青" },
  mapCtoO: { title: "青色变橙色", detail: "每一个青块替换为橙块。", notation: "青 → 橙" },
  replaceRbyC: { title: "红色变青色", detail: "每一个红块替换为青块。", notation: "红 → 青" },
  replaceCbyY: { title: "青色变黄色", detail: "每一个青块替换为黄块。", notation: "青 → 黄" },
  partitionContainsC: { title: "含青列移到右侧", detail: "不含青的列在左，含青的列在右；两组各自保留原顺序。", notation: "无青 | 含青" },
  partitionContainsR: { title: "含红列移到右侧", detail: "不含红的列在左，含红的列在右；两组各自保留原顺序。", notation: "无红 | 含红" },
  mapAdd1: { title: "每列数值加一", detail: "每个三位二进制数加 1；7 加 1 回到 0。", notation: "+1 · 模 8" },
  mapSub1: { title: "每列数值减一", detail: "每个三位二进制数减 1；0 减 1 回到 7。", notation: "−1 · 模 8" },
  mapMul2: { title: "每列数值乘二", detail: "每个三位二进制数乘 2，只保留低三位。", notation: "×2 · 模 8" },
  mapPow2: { title: "每列数值平方", detail: "每个三位二进制数乘自身，只保留低三位。", notation: "平方 · 模 8" },
  filterEven: { title: "只保留偶数列", detail: "保留数值为 0、2、4、6 的列，其余整列删除。", notation: "保留 偶数" },
};
export const cubeChapterHelp = [
  "把左侧函数加入程序，按顺序改变整面方块墙。每个函数只能用一次；先观察替换、添加和删除各自的效果。",
  "有的函数逐块替换，有的删除整列；上下翻转只改变一列内部的顺序。空列会在删除方块后一起移除。",
  "堆叠只合并连续相邻、完整内容相同的列。先改变颜色还是先合并，会得到不同的高度与排列。",
  "X 是任意颜色。模式从列底开始读取，已经匹配过的方块不再参与下一次匹配；留意落单方块。",
  "分区保留两组内部的原有顺序。先换色再分区，和先分区再换色，可能得到不同的结果。",
  "橙色是 0，棕色是 1。底、中、顶的权重是 1、2、4；结果只保留三位，相当于对 8 取模。",
] as const;
