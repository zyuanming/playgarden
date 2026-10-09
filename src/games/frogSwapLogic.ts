// SPDX-License-Identifier: GPL-3.0-only
export type FrogPiece = "E" | "W" | ".";
function lesson(
  title: string,
  lesson: string,
  east: number,
  west: number,
  gaps = 1,
) {
  return {
    title,
    lesson,
    start: ("E".repeat(east) + ".".repeat(gaps) + "W".repeat(west)).split(
      "",
    ) as FrogPiece[],
    goal: ("W".repeat(west) + ".".repeat(gaps) + "E".repeat(east)).split(
      "",
    ) as FrogPiece[],
  };
}
export const frogSwapLevels = [
  lesson(
    "初次相让",
    "绿蛙往大号石头走，金蛙往小号石头走。先给对方让出一步。",
    1,
    1,
  ),
  lesson("两位与一位", "同色青蛙不能互相跳过，让两队交替前进。", 2, 1),
  lesson("成双过岸", "越过一只异色青蛙，就能跳到它后面的空石头。", 2, 2),
  lesson("长队相遇", "两队人数不同。先看谁能露出合适的跳跃位置。", 3, 2),
  lesson(
    "两块空石",
    "有两块空石头，选择更多；目标中间也要留两块空石。",
    3,
    3,
    2,
  ),
  lesson("窄桥六蛙", "回到一块空石头。不要让两只同色青蛙堵在空位旁。", 3, 3),
  lesson("七蛙接力", "连续跳跃能让双方交错通过，向前一步则用来换节奏。", 4, 3),
  lesson("四对换岸", "每一步都向自己的目标前进，无法后退，但可以撤销。", 4, 4),
  lesson("九蛙会师", "让九位伙伴全部换到对岸，中间留下空石头。", 5, 4),
];
export function frogDestinations(board: FrogPiece[], from: number): number[] {
  const piece = board[from];
  if (!piece || piece === ".") return [];
  const direction = piece === "E" ? 1 : -1;
  const result: number[] = [];
  if (board[from + direction] === ".") result.push(from + direction);
  if (
    board[from + direction] === (piece === "E" ? "W" : "E") &&
    board[from + 2 * direction] === "."
  )
    result.push(from + 2 * direction);
  return result;
}
export function hopFrog(
  board: FrogPiece[],
  from: number,
  to: number,
): FrogPiece[] | null {
  if (!frogDestinations(board, from).includes(to)) return null;
  return board.map((piece, i) =>
    i === from ? "." : i === to ? board[from] : piece,
  );
}
export function frogsWon(board: FrogPiece[], goal: FrogPiece[]) {
  return board.length === goal.length && board.every((p, i) => p === goal[i]);
}
export function solveFrogs(
  board: FrogPiece[],
  goal: FrogPiece[],
): [number, number][] | null {
  const seen = new Set<string>();
  function visit(current: FrogPiece[]): [number, number][] | null {
    if (frogsWon(current, goal)) return [];
    const key = current.join("");
    if (seen.has(key)) return null;
    seen.add(key);
    for (let from = 0; from < current.length; from++)
      for (const to of frogDestinations(current, from)) {
        const next = hopFrog(current, from, to)!;
        const tail = visit(next);
        if (tail) return [[from, to], ...tail];
      }
    return null;
  }
  return visit(board);
}
