// SPDX-License-Identifier: GPL-3.0-only
// Original seven-segment transfer implementation and authored teaching exercises.
export const matchDigitMasks = [63, 6, 91, 79, 102, 109, 125, 7, 127, 111] as const;
export const matchSegmentNames = ["顶部", "右上", "右下", "底部", "左下", "左上", "中间"];
export type MatchSlot = { token: number; segment: number };
export type MatchTransfer = { from: MatchSlot; to: MatchSlot };
export type MatchstickLevel = { title: string; lesson: string; initialText: string; solutionText: string; budget: number; initial: number[]; solution: number[]; witness: MatchTransfer[] };
const count = (mask: number) => { let n = 0; for (; mask; mask &= mask - 1) n++; return n; };
export function encodeMatchEquation(text: string): number[] {
  const parts = text.match(/^(\d)([+-])(\d)=(\d{1,2})$/);
  if (!parts) throw new Error("Invalid authored match equation");
  return [matchDigitMasks[Number(parts[1])], parts[2] === "+" ? 3 : 1, matchDigitMasks[Number(parts[3])], ...[...parts[4]].map(x => matchDigitMasks[Number(x)])];
}
export function decodeMatchEquation(board: readonly number[]) {
  const digits = board.map((mask, i) => i === 1 ? -1 : matchDigitMasks.findIndex(m => m === mask));
  const op = board[1] === 1 ? "−" : board[1] === 3 ? "+" : "?";
  const valid = (board.length === 4 || board.length === 5) && op !== "?" && digits.every((d, i) => i === 1 || d >= 0) && (board.length !== 5 || digits[3] !== 0);
  const result = board.length === 5 ? digits[3] * 10 + digits[4] : digits[3];
  const trueEquation = valid && (op === "+" ? digits[0] + digits[2] : digits[0] - digits[2]) === result;
  const char = (i: number) => digits[i] < 0 ? "?" : String(digits[i]);
  return { valid, trueEquation, text: `${char(0)} ${op} ${char(2)} = ${board.slice(3).map((_, i) => char(i + 3)).join("")}` };
}
function transfers(from: readonly number[], to: readonly number[]): MatchTransfer[] {
  const removed: MatchSlot[] = [], added: MatchSlot[] = [];
  from.forEach((m, token) => { for (let segment = 0; segment < (token === 1 ? 2 : 7); segment++) {
    const bit = 1 << segment;
    if ((m & bit) && !(to[token] & bit)) removed.push({ token, segment });
    if (!(m & bit) && (to[token] & bit)) added.push({ token, segment });
  } });
  return removed.length === added.length ? removed.map((source, i) => ({ from: source, to: added[i] })) : [];
}
function lesson(title: string, teaching: string, initialText: string, solutionText: string, budget: number): MatchstickLevel {
  const initial = encodeMatchEquation(initialText), solution = encodeMatchEquation(solutionText);
  return { title, lesson: teaching, initialText, solutionText, budget, initial, solution, witness: transfers(initial, solution) };
}
export const matchstickEquationsLevels: MatchstickLevel[] = [
  lesson("一根就够", "一根火柴可以从数字移到符号，也可以在同一数字内部移动。找一种成立的等式即可。", "6+4=4", "8-4=4", 1),
  lesson("同格换边", "数字 2 和 3 的差别只在下半部。拿起一根，再放到另一条虚线槽里。", "2+3=6", "3+3=6", 1),
  lesson("左右互助", "某个数字可以送出一根，另一个数字接收它。火柴总数一直不变。", "9+3=5", "3+3=6", 1),
  lesson("减法校准", "数字都合法，算式仍可能不成立。观察右数的上半部，能否只改一个数字让减法成立？", "8-3=3", "8-5=3", 1),
  lesson("零的中线", "同样数量的火柴可能拼出不同数字。等号固定，不能改成不等号。", "6+3=0", "6+3=9", 1),
  lesson("两位数结果", "结果的十位与个位是独立数字。仍然只移动一根，留意左下角那一段。", "9+5=16", "9+6=15", 1),
  lesson("两次接力", "现在最多移动两根。中途允许暂时出现问号，最后每一位必须是合法数字。", "1+0=18", "7+8=15", 2),
  lesson("符号也要变", "一根可以改运算符，另一根可以改结果。减号是一横，加号是一横一竖。", "8-4=12", "9+4=13", 2),
  lesson("拆开再重组", "从同一数字取出两根，可以分别帮助两个位置。拿起和放下才算一次完整移动。", "5+1=18", "6+7=13", 2),
  lesson("最后的等式", "在两次移动内同时安排数字和符号。不能增加火柴、丢掉火柴，或改变固定等号。", "5-9=13", "9+4=13", 2),
];
export const matchSlotName = (slot: MatchSlot) => slot.token === 1 ? `运算符${slot.segment === 0 ? "横段" : "竖段"}` : `${slot.token === 0 ? "左数" : slot.token === 2 ? "右数" : slot.token === 3 ? "结果首位" : "结果末位"}的${matchSegmentNames[slot.segment]}段`;
export function moveMatch(board: readonly number[], move: MatchTransfer): number[] | null {
  const { from, to } = move;
  const valid = (slot: MatchSlot) => Number.isInteger(slot.token) && slot.token >= 0 && slot.token < board.length && Number.isInteger(slot.segment) && slot.segment >= 0 && slot.segment < (slot.token === 1 ? 2 : 7);
  if (!valid(from) || !valid(to) || !(board[from.token] & (1 << from.segment)) || (board[to.token] & (1 << to.segment))) return null;
  const next = [...board]; next[from.token] &= ~(1 << from.segment); next[to.token] |= 1 << to.segment; return next;
}
/** Enumerate only legal arithmetic endpoints; distance is the exact number of transfers.
 * This works from incomplete live glyphs too; no saved-witness assumptions. */
export function matchstickHint(board: readonly number[], remaining: number) {
  if (decodeMatchEquation(board).trueEquation) return { move: null, text: "等式已经成立。" };
  let best: MatchTransfer[] | null = null;
  for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) for (const op of ["+", "-"]) {
    const c = op === "+" ? a + b : a - b;
    if (c < 0 || (board.length === 4 ? c > 9 : c < 10 || c > 18)) continue;
    const goal = encodeMatchEquation(`${a}${op}${b}=${c}`);
    const removals = board.reduce((n, m, i) => n + count(m & ~goal[i]), 0), additions = board.reduce((n, m, i) => n + count(goal[i] & ~m), 0);
    if (removals !== additions || removals < 1 || removals > remaining || (best && removals >= best.length)) continue;
    best = transfers(board, goal);
  }
  return best?.length ? { move: best[0], text: `从当前状态有一条 ${best.length} 步接法：把${matchSlotName(best[0].from)}，移到${matchSlotName(best[0].to)}。先选位置卡片，再点下方对应段。` } : { move: null, text: "在剩余次数内找不到成立的等式。请撤销一次完整移动或重来；问号表示还不是合法的数字或符号。" };
}
