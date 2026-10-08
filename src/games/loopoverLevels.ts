// SPDX-License-Identifier: GPL-3.0-only
// Original authored disturbances. These are reversible construction witnesses,
// not optimal solutions, randomly padded levels, or claimed shortest paths.
import { shiftLoopLine, type LoopMove } from "../vendor/loopoverCore";
export type LoopLevel = {
  id: string; title: string; chapter: number; lesson: string;
  rows: number; cols: number; scramble: readonly LoopMove[]; initial: readonly number[];
};
const R = (index: number, delta: -1 | 1): LoopMove => ({ axis: "row", index, delta });
const C = (index: number, delta: -1 | 1): LoopMove => ({ axis: "column", index, delta });
function level(id: number, title: string, chapter: number, rows: number, cols: number, lesson: string, scramble: LoopMove[]): LoopLevel {
  return { id: `loopover-${String(id).padStart(2, "0")}`, title, chapter, rows, cols, lesson, scramble,
    initial: scramble.reduce((board, move) => shiftLoopLine(board, rows, cols, move), Array.from({ length: rows * cols }, (_, i) => i)) };
}
export const loopoverChapters = ["认识环移", "交织长方盘", "四阶织锦"] as const;
export const loopoverLevels: readonly LoopLevel[] = [
  level(1, "绕一圈回家", 0, 3, 3, "整行一起走：最右边会从左边出现。把第一行送回 1、2、3。", [R(0, 1)]),
  level(2, "拐角交会", 0, 3, 3, "行与列会在交叉格互相影响。先看看哪一列带走了末行的数字。", [R(2, -1), C(0, 1)]),
  level(3, "中柱穿针", 0, 3, 3, "上下也会环绕。试着先理清右列，再观察第一行和中列。", [C(1, -1), R(0, 1), C(2, 1)]),
  level(4, "小小三角换位", 0, 3, 3, "来回移动一行、一列，不一定回到原样：中途的交叉改变了成员。", [R(0, 1), C(0, 1), R(0, -1), C(0, -1)]),
  level(5, "错层花带", 0, 3, 3, "暂时移开排好的数字也没关系。只靠一个方向不能解开交织。", [R(1, 1), C(2, -1), R(0, -1), C(1, 1), R(2, 1)]),
  level(6, "三路会合", 0, 3, 3, "三行三列都参与了变化。用目标小图追踪数字真正的家。", [C(0, 1), R(2, 1), C(2, -1), R(0, 1), C(1, 1), R(1, -1)]),
  level(7, "长行新节奏", 1, 3, 4, "长方盘的行绕四步、列绕三步。同一个方向的循环长度不同。", [R(0, 1), R(0, 1), C(3, 1)]),
  level(8, "双列夹心", 1, 3, 4, "两列穿过同一行。预览能看出这次会把哪些数字送入下一列。", [C(0, -1), C(3, 1), R(1, 1), C(0, 1)]),
  level(9, "隔行借道", 1, 3, 4, "上下两行借中间列传递数字；排好一行后仍可能需要借道。", [R(0, -1), C(2, 1), R(2, 1), C(2, -1), R(1, -1)]),
  level(10, "接力换位", 1, 3, 4, "先改变交叉点，再还原经过的行列，可以只留下少量换位。", [C(1, 1), R(0, 1), C(1, -1), R(0, -1), R(2, 1), C(3, -1)]),
  level(11, "边缘邮路", 1, 3, 4, "越过边缘是近路。比较左移和右移的预览，不必绕远路。", [R(2, -1), C(0, -1), R(1, 1), C(3, 1), R(0, -1), C(1, 1), R(2, 1)]),
  level(12, "长方盘合奏", 1, 3, 4, "每次只移动一条线。把大问题拆成短短的行列组合。", [C(2, -1), R(0, 1), C(0, 1), R(2, -1), C(3, -1), R(1, 1), C(1, 1), R(0, -1)]),
  level(13, "四阶转角", 2, 4, 4, "四阶盘多了一条归位带。先沿着转角找出连在一起的错位。", [R(0, 1), C(0, 1), R(3, -1), C(3, -1)]),
  level(14, "中央织结", 2, 4, 4, "中心两行两列的交错会打结。还原一条线前，先看它的交叉点。", [R(1, 1), C(2, 1), R(2, -1), C(1, -1), R(1, -1), C(2, -1)]),
  level(15, "对角接棒", 2, 4, 4, "数字穿过对角的两处转角，记住每次整行移动后的新位置。", [C(0, 1), R(3, 1), C(0, -1), R(3, -1), C(3, -1), R(0, -1), C(3, 1)]),
  level(16, "双步长廊", 2, 4, 4, "连续两次移同一行可以跨过半个盘，但中间插入列移就不一样了。", [R(2, 1), R(2, 1), C(1, -1), R(0, -1), C(3, 1), R(1, 1), C(0, -1), R(3, -1)]),
  level(17, "回环花结", 2, 4, 4, "相反方向不能随意抵消：先后次序不同，交叉格带走的数字也不同。", [R(0, 1), C(1, 1), R(0, -1), C(2, -1), R(2, 1), C(1, -1), R(3, -1), C(0, 1), R(1, 1)]),
  level(18, "整盘归航", 2, 4, 4, "综合行、列、回环和换位。没有步数上限，可以撤销，也可以请提示搭桥。", [C(3, 1), R(2, -1), C(0, -1), R(0, 1), C(2, 1), R(3, 1), C(1, -1), R(1, -1), C(3, -1), R(0, -1)]),
];
export const LOOP_LEVEL_COUNT = loopoverLevels.length;
