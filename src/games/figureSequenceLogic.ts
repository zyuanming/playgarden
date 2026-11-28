// SPDX-License-Identifier: GPL-3.0-only
export const moves = {
  R: {name:"顺时针转 90°",glyph:"↻"}, L: {name:"逆时针转 90°",glyph:"↺"},
  H: {name:"左右翻转",glyph:"↔"}, V: {name:"上下翻转",glyph:"↕"},
  T: {name:"中心翻色",glyph:"⊙"}, K: {name:"左上角翻色",glyph:"◩"},
  C: {name:"四角翻色",glyph:"◈"}, E: {name:"边中翻色",glyph:"✚"},
} as const;
export type Move = keyof typeof moves;
export type Rule = Move | `${Move}${Move}`;
export type FigureBoard = {
  id: string;
  title: string;
  shown: readonly [number, ...(number|null)[]];
  rules: readonly Rule[];
};
const toggles = {T:1<<4, K:1, C:0b101000101, E:0b010101010};
export const ruleMoves = (rule: Rule) => [...rule] as Move[];
export const moveAt = (rule: Rule, step: number) => ruleMoves(rule)[(step-1)%rule.length];
export function transform(frame: number, move: Move): number {
  if (move === "T" || move === "K" || move === "C" || move === "E") return frame ^ toggles[move];
  let result = 0;
  for (let bit=0; bit<9; bit++) {
    if (!(frame & (1<<bit))) continue;
    const x=bit%3, y=Math.floor(bit/3);
    const to = move==="R" ? (2-y)+3*x : move==="L" ? y+3*(2-x)
      : move==="H" ? (2-x)+3*y : x+3*(2-y);
    result |= 1<<to;
  }
  return result;
}
export function trace(board: FigureBoard, rule: Rule) {
  const frames = [board.shown[0]];
  const mismatches: number[] = [];
  for(let step=1;step<board.shown.length;step++){
    const next=transform(frames[step-1], moveAt(rule, step)), given=board.shown[step];
    frames.push(next);
    if(given!==null && next!==given) mismatches.push(step);
  }
  return {frames,mismatches};
}
