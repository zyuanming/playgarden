// SPDX-License-Identifier: GPL-3.0-only
// Original finite pipe networks and rule implementation. No third-party source.
export type PipeTurnsLevel = { title: string; lesson: string; size: number; source: number; outlets: number[]; solution: number[]; initial: number[] };
export const pipeDirections = [{ bit: 1, dr: -1, dc: 0, opposite: 4, label: "上" }, { bit: 2, dr: 0, dc: 1, opposite: 8, label: "右" }, { bit: 4, dr: 1, dc: 0, opposite: 1, label: "下" }, { bit: 8, dr: 0, dc: -1, opposite: 2, label: "左" }];
export const rotatePipe = (mask: number) => ((mask << 1) & 15) | (mask >> 3);
export function pipeNeighbor(size: number, cell: number, direction: number): number {
  const d = pipeDirections[direction], r = Math.floor(cell / size) + d.dr, c = cell % size + d.dc;
  return r >= 0 && c >= 0 && r < size && c < size ? r * size + c : -1;
}
function network(title: string, lesson: string, size: number, paths: number[][], seed: number): PipeTurnsLevel {
  const solution = Array<number>(size * size).fill(0), source = paths[0][0];
  for (const path of paths) for (let k = 1; k < path.length; k++) {
    const a = path[k - 1], b = path[k], d = pipeDirections.findIndex((_, i) => pipeNeighbor(size, a, i) === b);
    if (d < 0) throw new Error("Pipe level has nonadjacent edges");
    solution[a] |= pipeDirections[d].bit; solution[b] |= pipeDirections[d].opposite;
  }
  const outlets = solution.flatMap((m, i) => m && !(m & (m - 1)) && i !== source ? [i] : []);
  const initial = solution.map((mask, i) => {
    if (i === source) return mask;
    let rotated = mask;
    for (let n = 0; n < (i * 7 + seed) % 4; n++) rotated = rotatePipe(rotated);
    return rotated;
  });
  return { title, lesson, size, source, outlets, solution, initial };
}
export const pipeTurnsLevels: PipeTurnsLevel[] = [
  network("第一道弯", "水源朝向固定。先让相邻两块的管口面对面，再照顾花朵出口。", 3, [[0, 1, 2, 5, 8]], 1),
  network("绕过石头", "灰色地面没有水管。水不能越过空地，所有转角都必须紧紧接合。", 3, [[0, 3, 6, 7, 4, 5, 2]], 2),
  network("分成两路", "三通有三个管口。两朵花都要收到水，不能为了其中一朵留下一处漏水。", 3, [[0, 1, 4, 7, 8], [4, 3, 6]], 3),
  network("中央十字", "十字管四面相通，转它并不会改变连接。把四周的支路都接好。", 4, [[0, 1, 5, 9, 13], [5, 4, 8], [5, 6, 7, 11, 15]], 1),
  network("长廊回转", "长管廊需要在尽头折返。注意平行的两条管道并不会隔空连接。", 4, [[0, 4, 8, 12, 13, 14, 10, 6, 2, 3, 7, 11, 15]], 2),
  network("双层枝叶", "主干的两个三通各有一条支路。先找到主干，再逐一处理支路的尽头。", 4, [[0, 1, 2, 6, 10, 14, 15], [6, 5, 4, 8, 12], [10, 11, 7, 3]], 3),
  network("环形蓄水", "水路可以成环。闭环仍必须与水源连通，所有管口都不能漏。", 4, [[0, 1, 5, 6, 10, 9, 5], [10, 14, 15], [6, 7, 3]], 1),
  network("花园四支", "四朵花需要同一水源供水。出口本身也能旋转，单口应朝向来水的方向。", 5, [[0, 1, 2, 7, 12, 17, 22, 23, 24], [7, 6, 5, 10, 15, 20], [12, 13, 14, 9, 4], [17, 18, 19]], 2),
  network("双环温室", "两座环道共用连接点。水流颜色只表示已连到水源，还要检查红色漏口。", 5, [[0, 1, 6, 7, 12, 11, 6], [12, 13, 18, 17, 12], [7, 8, 9, 4], [18, 23, 24]], 3),
  network("总园灌溉", "把外侧长管廊、内部环路和三个出口合成一个不漏水的网络。没有时间或步数限制。", 5, [[0, 5, 10, 15, 20, 21, 22, 17, 12, 7, 8, 9, 14, 19, 24], [7, 6, 11, 12], [6, 1, 2, 3, 4], [17, 18, 13]], 1),
];
export function inspectPipes(level: PipeTurnsLevel, board: readonly number[]) {
  const leaks: number[][] = board.map(() => []), wet = new Set<number>();
  if (board.length !== level.solution.length) return { leaks, wet, won: false, leakCount: 0 };
  board.forEach((mask, cell) => pipeDirections.forEach((d, direction) => {
    if (!(mask & d.bit)) return;
    const next = pipeNeighbor(level.size, cell, direction);
    if (next < 0 || !(board[next] & d.opposite)) leaks[cell].push(direction);
  }));
  const queue = [level.source]; wet.add(level.source);
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    pipeDirections.forEach((d, direction) => {
      const next = pipeNeighbor(level.size, cell, direction);
      if ((board[cell] & d.bit) && next >= 0 && (board[next] & d.opposite) && !wet.has(next)) { wet.add(next); queue.push(next); }
    });
  }
  const leakCount = leaks.reduce((n, ds) => n + ds.length, 0);
  return { leaks, wet, leakCount, won: leakCount === 0 && board.every((mask, i) => !mask || wet.has(i)) && level.outlets.every(i => wet.has(i)) };
}
/** A constructive next step toward one valid network, computed from current rotations.
 * Completion itself never compares against this witness: alternative networks win. */
export function pipeTurnsHint(level: PipeTurnsLevel, board: readonly number[]) {
  if (inspectPipes(level, board).won) return { cell: -1, turns: 0, text: "全部水管已连通，没有漏口。" };
  const cell = board.findIndex((mask, i) => i !== level.source && mask !== level.solution[i]);
  if (cell < 0) return { cell: -1, turns: 0, text: "检查水源附近的连接。" };
  let mask = board[cell], turns = 0;
  while (mask !== level.solution[cell] && turns < 4) { mask = rotatePipe(mask); turns++; }
  return { cell, turns, text: `一条可行接法：把第 ${Math.floor(cell / level.size) + 1} 行、第 ${cell % level.size + 1} 列顺时针转 ${turns} 次。提示按当前朝向计算，不会自动旋转。` };
}
