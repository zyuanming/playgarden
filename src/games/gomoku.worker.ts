import { replayMoves } from "./gomokuLogic.ts";
import { chooseMove, type Difficulty } from "./gomokuAi.ts";
export type GomokuRequest = {
  requestId: number;
  moves: number[];
  difficulty: Difficulty;
};
export type GomokuReply = {
  requestId: number;
  moves: number[];
  move: number | null;
  error?: true;
};
self.onmessage = (event: MessageEvent<GomokuRequest>) => {
  const { requestId, moves, difficulty } = event.data;
  const position = replayMoves(moves);
  if (!position || (difficulty !== "gentle" && difficulty !== "steady")) {
    self.postMessage({
      requestId,
      moves,
      move: null,
      error: true,
    } satisfies GomokuReply);
    return;
  }
  try {
    const result = chooseMove(position, difficulty, {
      timeMs: difficulty === "gentle" ? 120 : 500,
      nodeBudget: difficulty === "gentle" ? 2500 : 14000,
    });
    self.postMessage({
      requestId,
      moves,
      move: result.move,
    } satisfies GomokuReply);
  } catch {
    self.postMessage({
      requestId,
      moves,
      move: null,
      error: true,
    } satisfies GomokuReply);
  }
};
