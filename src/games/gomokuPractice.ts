import {
  immediateWins,
  opponent,
  playMove,
  replayMoves,
  type Position,
  type Stone,
} from "./gomokuLogic.ts";
export type GomokuPuzzle = {
  id: string;
  title: string;
  chapter: number;
  objective: "win" | "defend" | "fork" | "two";
  moves: number[];
  goal: string;
  hint: string;
  solution: number;
  solutions: number[];
  continuation: number[];
};
export type PracticeResult =
  "ready" | "responding" | "finish" | "success" | "retry";
export function meetsGoal(
  position: Position,
  stone: Stone,
  objective: GomokuPuzzle["objective"],
): boolean {
  if (objective === "win") return position.winner === stone;
  if (position.winner || position.draw) return false;
  if (immediateWins(position.board, opponent(stone)).length) return false;
  return (
    objective === "defend" || immediateWins(position.board, stone).length >= 2
  );
}
export function practiceResult(
  puzzle: GomokuPuzzle,
  position: Position,
): PracticeResult {
  const extra = position.moves.length - puzzle.moves.length;
  if (extra <= 0) return "ready";
  const player: Stone = puzzle.moves.length % 2 === 0 ? 1 : 2;
  const first = replayMoves(position.moves.slice(0, puzzle.moves.length + 1));
  if (!first || !meetsGoal(first, player, puzzle.objective)) return "retry";
  if (puzzle.objective !== "two") return "success";
  if (extra === 1) return "responding";
  if (extra === 2) return "finish";
  return position.winner === player ? "success" : "retry";
}
export function practiceDefense(
  puzzle: GomokuPuzzle,
  position: Position,
): number | null {
  const player: Stone = puzzle.moves.length % 2 === 0 ? 1 : 2;
  return immediateWins(position.board, player)[0] ?? null;
}
export function validPracticeRound(
  puzzle: GomokuPuzzle,
  position: Position,
): boolean {
  const extra = position.moves.length - puzzle.moves.length;
  if (
    extra < 0 ||
    extra > (puzzle.objective === "two" ? 3 : 1) ||
    puzzle.moves.some((m, i) => position.moves[i] !== m)
  )
    return false;
  if (extra <= 1) return true;
  const first = replayMoves(position.moves.slice(0, puzzle.moves.length + 1));
  return (
    !!first &&
    practiceResult(puzzle, first) === "responding" &&
    practiceDefense(puzzle, first) === position.moves[puzzle.moves.length + 1]
  );
}
/** Bounded, transparent fallback if module Workers are unavailable. */
export function simpleMove(position: Position): number | null {
  if (position.winner || position.draw) return null;
  const own = immediateWins(position.board, position.turn);
  if (own.length) return own[0];
  const threats = immediateWins(position.board, opponent(position.turn));
  if (threats.length) return threats[0];
  const available = position.board
    .map((v, i) => (v === 0 ? i : -1))
    .filter((i) => i >= 0);
  let best: number | null = null,
    score = -Infinity;
  for (const index of available) {
    const r = Math.floor(index / 15),
      c = index % 15;
    let next = 14 - Math.abs(r - 7) - Math.abs(c - 7);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr,
          cc = c + dc;
        if (
          rr >= 0 &&
          rr < 15 &&
          cc >= 0 &&
          cc < 15 &&
          position.board[rr * 15 + cc]
        )
          next += 18;
      }
    if (next > score) {
      best = index;
      score = next;
    }
  }
  return best;
}
export function nextPracticePosition(
  puzzle: GomokuPuzzle,
  position: Position,
): Position {
  const move = practiceDefense(puzzle, position);
  return move === null ? position : playMove(position, move);
}
