// SPDX-License-Identifier: GPL-3.0-only
// Original authored visual-reaction game. No upstream code or art.
export type TapVisitor = { hole: number; kind: 'flower' | 'ladybird'; at: number; duration: number };
export type TapLesson = { id: string; title: string; lesson: string; goal: number; mistakes: number; visitors: TapVisitor[] };
const lesson = (id: string, title: string, text: string, holes: number[], bugs: number[], gap: number, duration: number, mistakes = 2): TapLesson => ({
  id, title, lesson: text, goal: holes.length - bugs.length - mistakes, mistakes,
  visitors: holes.map((hole, index) => ({ hole, kind: bugs.includes(index) ? 'ladybird' : 'flower', at: 0.6 + index * gap, duration })),
});
export const bloomTapLevels: TapLesson[] = [
  lesson('hello-petal', '第一朵来信', '花朵出现时轻点它。空洞不计分；每朵只需点一次。', [4, 0, 8, 2, 6, 4], [], 1.8, 2.1, 1),
  lesson('red-coat', '红衣小客人', '红色瓢虫是朋友，让它自己离开。只收有花瓣的花朵。', [1, 5, 3, 7, 0, 8, 2, 4], [2, 5], 1.65, 1.9, 1),
  lesson('corners', '四角的花香', '花朵会出现在角落。手指回到中央附近，准备下一次。', [0, 8, 6, 2, 4, 0, 2, 8, 6], [4], 1.5, 1.75),
  lesson('two-neighbours', '两朵邻居', '有时两朵花同时在场。先收快离开的那一朵。', [0, 1, 7, 8, 3, 4, 6, 2, 5, 0], [4, 8], 1.05, 1.75),
  lesson('quiet-beat', '慢半拍', '不用一直快点。遇到瓢虫，等待也是正确的一步。', [4, 1, 6, 5, 0, 7, 2, 8, 3, 4], [1, 3, 6], 1.3, 1.65),
  lesson('zigzag-post', '曲折邮路', '目光扫过整片花田；点完的花会留下收好标记。', [2, 3, 8, 1, 6, 5, 0, 7, 4, 2, 6], [2, 7], 1.0, 1.6),
  lesson('paired-petals', '双人舞', '重叠的出现时间更长，但不要误点夹在中间的红衣朋友。', [0, 4, 8, 2, 7, 3, 5, 1, 6, 0, 8, 4], [3, 6, 9], 0.9, 1.6),
  lesson('edge-watch', '边缘来客', '角落和边缘轮流送花。先找花瓣，再下手。', [1, 6, 2, 7, 0, 5, 8, 3, 2, 6, 4, 1], [0, 5, 8], 0.95, 1.45),
  lesson('polite-pause', '礼貌地等一等', '连续的瓢虫也不用点。把注意力留给真正的花。', [4, 0, 8, 3, 6, 1, 5, 2, 7, 4, 0, 6], [1, 2, 6, 7], 1.05, 1.5),
  lesson('garden-weave', '花田织锦', '相邻与远处交替出现，稳稳收花比连点更有效。', [0, 1, 8, 7, 4, 2, 3, 6, 5, 0, 8, 1, 7], [4, 8, 11], 0.88, 1.4),
  lesson('three-postcards', '三封急信', '稍短的停留时间。可以使用悠闲速度，规则和目标不变。', [2, 4, 6, 0, 5, 8, 1, 3, 7, 2, 0, 6, 4, 8], [2, 5, 9, 12], 0.8, 1.3),
  lesson('evening-thanks', '晚风里的谢谢', '把看清、等待与轻点连起来。收够花朵，让瓢虫平安回家。', [4, 0, 5, 7, 2, 6, 1, 8, 3, 4, 6, 2, 0, 8, 5], [1, 4, 7, 11], 0.85, 1.35),
];
export type TapRound = { time: number; caught: number[]; disturbed: number[]; phase: 'ready' | 'playing' | 'won' | 'lost' };
export const newTapRound = (): TapRound => ({ time: 0, caught: [], disturbed: [], phase: 'ready' });
export const tapEnd = (p: TapLesson) => Math.max(...p.visitors.map(v => v.at + v.duration)) + .15;
export function activeVisitors(p: TapLesson, s: TapRound): number[] {
  return p.visitors.flatMap((v, i) => s.time >= v.at && s.time < v.at + v.duration && !s.caught.includes(i) && !s.disturbed.includes(i) ? [i] : []);
}
export function tapMisses(p: TapLesson, s: TapRound) {
  return p.visitors.filter((v, i) => v.kind === 'flower' && s.time >= v.at + v.duration && !s.caught.includes(i)).length + s.disturbed.length;
}
function judge(p: TapLesson, s: TapRound): TapRound {
  if (tapMisses(p, s) > p.mistakes) return { ...s, phase: 'lost' };
  if (s.time >= tapEnd(p)) return { ...s, phase: s.caught.length >= p.goal ? 'won' : 'lost' };
  return s;
}
export function advanceTap(p: TapLesson, s: TapRound, seconds: number): TapRound {
  if (s.phase !== 'playing' || !Number.isFinite(seconds) || seconds <= 0 || seconds > .25) return s;
  return judge(p, { ...s, time: Math.min(tapEnd(p), s.time + seconds) });
}
export function pickVisitor(p: TapLesson, s: TapRound, index: number): TapRound {
  if (s.phase !== 'playing' || !activeVisitors(p, s).includes(index)) return s;
  return judge(p, p.visitors[index].kind === 'flower' ? { ...s, caught: [...s.caught, index] } : { ...s, disturbed: [...s.disturbed, index] });
}
export const TAP_SAVE = 'playgarden.bloom-tap.v1';
export function saveTap(p: TapLesson, level: number, s: TapRound): boolean {
  try { localStorage.setItem(`${TAP_SAVE}.round.${level}`, JSON.stringify({ version: 1, id: p.id, time: s.time, caught: s.caught, disturbed: s.disturbed })); return true; } catch { return false; }
}
export function loadTap(p: TapLesson, level: number): TapRound {
  try {
    const raw = localStorage.getItem(`${TAP_SAVE}.round.${level}`); if (!raw || raw.length > 2000) return newTapRound();
    const v = JSON.parse(raw);
    if (v.version !== 1 || v.id !== p.id || !Number.isFinite(v.time) || v.time < 0 || v.time >= tapEnd(p) || !Array.isArray(v.caught) || !Array.isArray(v.disturbed)) return newTapRound();
    for (const [list, kind] of [[v.caught, 'flower'], [v.disturbed, 'ladybird']] as const) {
      if (list.length > p.visitors.length || new Set(list).size !== list.length || !list.every((i: number) => Number.isInteger(i) && p.visitors[i]?.kind === kind && p.visitors[i].at <= v.time)) return newTapRound();
    }
    const s: TapRound = { time: v.time, caught: v.caught, disturbed: v.disturbed, phase: 'playing' };
    return judge(p, s).phase === 'playing' ? s : newTapRound();
  } catch { return newTapRound(); }
}
