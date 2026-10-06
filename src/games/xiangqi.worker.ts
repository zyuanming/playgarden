// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 YuanMing; Playgarden original contributions.
import { replayMoves } from "./xiangqiLogic.ts";
import { chooseMove } from "./xiangqiAi.ts";
export type XiangqiRequest = {
  requestId: number;
  initial: string;
  moves: string[];
};
export type XiangqiReply = XiangqiRequest & {
  move: string | null;
  error?: true;
};
self.onmessage = (event: MessageEvent<XiangqiRequest>) => {
  const { requestId, initial, moves } = event.data;
  try {
    const position = replayMoves(initial, moves);
    if (!position) throw new Error("Invalid match");
    self.postMessage({
      requestId,
      initial,
      moves,
      move: chooseMove(position).move,
    } satisfies XiangqiReply);
  } catch {
    self.postMessage({
      requestId,
      initial,
      moves,
      move: null,
      error: true,
    } satisfies XiangqiReply);
  }
};
