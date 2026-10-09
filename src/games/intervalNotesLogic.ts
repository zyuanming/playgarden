// SPDX-License-Identifier: GPL-3.0-only
// Original lessons and generic diatonic-interval rules. No third-party source.
export const intervalNotesScale = [
  { name: "C4", syllable: "do", midi: 60 },
  { name: "D4", syllable: "re", midi: 62 },
  { name: "E4", syllable: "mi", midi: 64 },
  { name: "F4", syllable: "fa", midi: 65 },
  { name: "G4", syllable: "sol", midi: 67 },
  { name: "A4", syllable: "la", midi: 69 },
  { name: "B4", syllable: "si", midi: 71 },
  { name: "C5", syllable: "do", midi: 72 },
] as const;

export type IntervalPosition = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type IntervalPair = readonly [IntervalPosition, IntervalPosition];
export type IntervalNotesLevel = {
  title: string;
  lesson: string;
  pairs: readonly [IntervalPair, IntervalPair, IntervalPair];
};

export const intervalNotesLabels = [
  "同度", "二度", "三度", "四度", "五度", "六度", "七度", "八度",
] as const;

export const intervalNotesLevels: readonly IntervalNotesLevel[] = [
  {
    title: "从同一个音出发",
    lesson: "同一个位置也要数一次。相邻两个音的位置一起数，就是二度。",
    pairs: [[0, 0], [0, 1], [4, 4]],
  },
  {
    title: "相邻与隔一个",
    lesson: "E 到 F、B 到高音 C 都是相邻位置。这里数音名位置，不数半音。",
    pairs: [[2, 3], [6, 7], [5, 3]],
  },
  {
    title: "三度的小跳跃",
    lesson: "中间隔一个位置时，把起点、中间、终点都算进去。别漏掉起音。",
    pairs: [[0, 2], [3, 5], [6, 5]],
  },
  {
    title: "跨过小山坡",
    lesson: "四度和五度只差一个位置。沿着音名一格一格数，下降时也一样。",
    pairs: [[0, 3], [1, 5], [7, 4]],
  },
  {
    title: "把耳朵伸远",
    lesson: "距离变远时，继续把两端都算上。听音是辅助，看图也能完成所有题。",
    pairs: [[0, 5], [1, 7], [2, 6]],
  },
  {
    title: "回到另一个 do",
    lesson: "C4 到 C5 跨过八个音名位置，是八度；C4 回到 C4 则是同度。",
    pairs: [[0, 7], [7, 0], [4, 4]],
  },
  {
    title: "沿阶梯向下",
    lesson: "方向改变，级数距离不变。先找到两个音的位置，再数包含两端的音名。",
    pairs: [[6, 2], [5, 2], [7, 4]],
  },
  {
    title: "最后的三封音符信",
    lesson: "把短距离、长距离和下降八度放在一起。每题独立判断，答对三题完成这一课。",
    pairs: [[3, 1], [0, 6], [7, 0]],
  },
];

/** Generic diatonic size only: endpoints included, direction ignored. */
export function intervalNotesDegree(pair: IntervalPair): number {
  return Math.abs(pair[1] - pair[0]) + 1;
}

export function intervalNotesMatches(pair: IntervalPair, choice: number): boolean {
  return Number.isInteger(choice) && choice >= 1 && choice <= 8 &&
    choice === intervalNotesDegree(pair);
}

export function intervalNotesFrequency(position: IntervalPosition): number {
  return 440 * 2 ** ((intervalNotesScale[position].midi - 69) / 12);
}

export function intervalNotesHint(pair: IntervalPair): string {
  const degree = intervalNotesDegree(pair);
  const direction = pair[1] >= pair[0] ? 1 : -1;
  const names = Array.from({ length: degree }, (_, i) =>
    intervalNotesScale[pair[0] + i * direction].name,
  );
  return `${names.join(" → ")}。两端都算，共 ${degree} 个音名位置，是${intervalNotesLabels[degree - 1]}。`;
}
