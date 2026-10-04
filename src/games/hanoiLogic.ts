export type Pegs = [number[], number[], number[]];
export type HanoiMove = { from: number; to: number };
export type HanoiLevel = {
  title: string;
  disks: number;
  start: Pegs;
  goal: number;
  solution: HanoiMove[];
};
export function moveDisk(pegs: Pegs, from: number, to: number): Pegs | null {
  if (
    from < 0 ||
    from > 2 ||
    to < 0 ||
    to > 2 ||
    from === to ||
    !pegs[from].length
  )
    return null;
  const disk = pegs[from].at(-1)!;
  if (pegs[to].length && pegs[to].at(-1)! < disk) return null;
  const next = pegs.map((p) => [...p]) as Pegs;
  next[from].pop();
  next[to].push(disk);
  return next;
}
export const hanoiWon = (pegs: Pegs, disks: number, goal: number) =>
  pegs[goal].length === disks;
const key = (p: Pegs) => p.map((a) => a.join(",")).join("|");
export function solveHanoi(start: Pegs, goal: number): HanoiMove[] {
  const disks = start.flat().length;
  if (hanoiWon(start, disks, goal)) return [];
  const queue: { pegs: Pegs; path: HanoiMove[] }[] = [
    { pegs: start, path: [] },
  ];
  const seen = new Set([key(start)]);
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    for (let from = 0; from < 3; from++)
      for (let to = 0; to < 3; to++) {
        const next = moveDisk(item.pegs, from, to);
        if (!next || seen.has(key(next))) continue;
        const path = [...item.path, { from, to }];
        if (hanoiWon(next, disks, goal)) return path;
        seen.add(key(next));
        queue.push({ pegs: next, path });
      }
  }
  return [];
}
const seeds: {
  disks: number;
  positions: number[];
  goal: number;
  title: string;
}[] = [
  { disks: 2, positions: [0, 0], goal: 2, title: "第一座小塔" },
  { disks: 3, positions: [0, 0, 0], goal: 2, title: "三个圆盘" },
  { disks: 3, positions: [1, 0, 0], goal: 2, title: "接着搭下去" },
  { disks: 3, positions: [2, 1, 0], goal: 1, title: "换一个终点" },
  { disks: 4, positions: [0, 0, 0, 0], goal: 2, title: "四层挑战" },
  { disks: 4, positions: [2, 1, 0, 0], goal: 2, title: "半路出发" },
  { disks: 4, positions: [1, 2, 1, 0], goal: 1, title: "向中间集合" },
  { disks: 5, positions: [0, 0, 0, 0, 0], goal: 2, title: "五层递归" },
  { disks: 5, positions: [2, 2, 1, 0, 0], goal: 1, title: "借助空位" },
  { disks: 5, positions: [1, 2, 0, 1, 0], goal: 2, title: "整理散落圆盘" },
  { disks: 6, positions: [2, 1, 0, 0, 0, 0], goal: 2, title: "六层远行" },
  { disks: 6, positions: [1, 2, 1, 0, 1, 0], goal: 2, title: "塔的设计师" },
];
export const hanoiLevels: HanoiLevel[] = seeds.map((s) => {
  const start: Pegs = [[], [], []];
  for (let disk = s.disks; disk >= 1; disk--)
    start[s.positions[disk - 1]].push(disk);
  return { ...s, start, solution: solveHanoi(start, s.goal) };
});
