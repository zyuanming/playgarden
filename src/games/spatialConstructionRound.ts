import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
export type SpatialHint = { message: string; cell?: number; face?: number };
/** Per-round synchronous input guard, history, consumed shell tokens and one-shot completion. */
export function useSpatialRound(
  props: GameProps,
  initial: number[],
  won: (board: number[]) => boolean,
  hint: (board: number[]) => SpatialHint,
  introduction: string,
  celebration: string,
) {
  const [state, setState] = useState(() => ({
    board: initial,
    history: [] as number[][],
  }));
  const current = useRef(state),
    notified = useRef(false);
  const tokens = useRef({ hint: props.hintToken, undo: props.undoToken });
  const config = useRef({ props, won, hint });
  config.current = { props, won, hint };
  const [feedback, setFeedback] = useState(introduction);
  const [hinted, setHinted] = useState<SpatialHint | null>(null);
  const solved = won(state.board);
  useEffect(() => {
    if (!props.paused) config.current.props.onStatus(feedback);
  }, [feedback, props.paused]);
  useEffect(() => {
    if (solved && !props.paused && !notified.current) {
      notified.current = true;
      setFeedback(celebration);
      config.current.props.onComplete();
    }
  }, [solved, props.paused, celebration]);
  useEffect(() => {
    if (tokens.current.undo === props.undoToken) return;
    tokens.current.undo = props.undoToken;
    if (props.paused || config.current.won(current.current.board)) return;
    const before = current.current,
      board = before.history.at(-1);
    setHinted(null);
    if (!board) {
      setFeedback("还没有操作可以撤销。");
      return;
    }
    const next = { board, history: before.history.slice(0, -1) };
    current.current = next;
    setState(next);
    setFeedback("已恢复上一步的构造。");
  }, [props.undoToken, props.paused]);
  useEffect(() => {
    if (tokens.current.hint === props.hintToken) return;
    tokens.current.hint = props.hintToken;
    if (props.paused || config.current.won(current.current.board)) return;
    const result = config.current.hint(current.current.board);
    setHinted(result);
    setFeedback(result.message);
  }, [props.hintToken, props.paused]);
  function change(edit: (board: number[]) => number[] | null, message: string) {
    if (
      config.current.props.paused ||
      config.current.won(current.current.board)
    )
      return;
    const previous = current.current,
      board = edit(previous.board);
    if (!board || board.every((p, i) => p === previous.board[i])) return;
    const next = { board, history: [...previous.history, previous.board] };
    current.current = next;
    setState(next);
    setHinted(null);
    setFeedback(message);
  }
  return {
    board: state.board,
    solved,
    frozen: props.paused || solved,
    feedback,
    hinted,
    change,
    setFeedback,
  };
}
