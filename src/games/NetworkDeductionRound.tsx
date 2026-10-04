import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { GameProps } from "../lib/types";
import {
  createNetworkState,
  cycleNetworkEdge,
  editNetworkEdge,
  undoNetworkEdge,
  type NetworkHint,
} from "./networkDeductionCore";
export type NetworkPosition = { x: number; y: number };
export function networkDirectionalIndex(
  positions: NetworkPosition[],
  index: number,
  key: string,
): number {
  const directions: Record<string, NetworkPosition> = {
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
  };
  const direction = directions[key],
    origin = positions[index];
  if (!direction || !origin) return index;
  let best = index,
    score = Infinity;
  positions.forEach((position, i) => {
    const dx = position.x - origin.x,
      dy = position.y - origin.y,
      forward = dx * direction.x + dy * direction.y;
    if (forward <= 0) return;
    const side = Math.abs(dx * direction.y - dy * direction.x),
      next = forward + side * 3;
    if (next < score) {
      score = next;
      best = i;
    }
  });
  return best;
}
export function useNetworkRound(
  props: GameProps,
  rules: {
    count: number;
    maximum: 1 | 2;
    introduction: string;
    celebration: string;
    solved: (values: readonly number[]) => boolean;
    conflicts: (values: readonly number[]) => number[];
    getHint: (values: readonly number[]) => NetworkHint | null;
  },
) {
  const [state, setState] = useState(() => createNetworkState(rules.count));
  const [selected, setSelected] = useState(0);
  const [hint, setHint] = useState<NetworkHint | null>(null);
  const [message, setMessage] = useState(rules.introduction);
  const callback = useRef({
    onStatus: props.onStatus,
    onComplete: props.onComplete,
  });
  callback.current = { onStatus: props.onStatus, onComplete: props.onComplete };
  const tokens = useRef({ hint: props.hintToken, undo: props.undoToken }),
    completed = useRef(false);
  const won = rules.solved(state.values),
    conflicts = rules.conflicts(state.values);
  const report = (text: string) => {
    setMessage(text);
    callback.current.onStatus(text);
  };
  useEffect(() => {
    callback.current.onStatus(rules.introduction);
  }, []);
  useEffect(() => {
    if (!won || props.paused || completed.current) return;
    completed.current = true;
    report(rules.celebration);
    callback.current.onComplete();
  }, [won, props.paused, rules.celebration]);
  useEffect(() => {
    if (tokens.current.hint === props.hintToken) return;
    tokens.current.hint = props.hintToken;
    if (props.paused || won) return;
    const next = rules.getHint(state.values);
    setHint(next);
    if (next && next.kind !== "unavailable") {
      setSelected(next.index);
      report(
        `${next.reason} ${next.value < 0 ? "建议清空" : next.value === 0 ? "建议标叉" : `建议画 ${next.value} 条线`}，可点“采用这一步”。`,
      );
    } else report(next?.reason ?? "已经满足全部规则。");
  }, [props.hintToken, props.paused, won, rules, state.values]);
  useEffect(() => {
    if (tokens.current.undo === props.undoToken) return;
    tokens.current.undo = props.undoToken;
    if (props.paused) return;
    setState((current) => undoNetworkEdge(current));
    setHint(null);
    report(
      state.history.length
        ? "已撤销上一步，其他标记保留。"
        : "还没有可以撤销的操作。",
    );
  }, [props.undoToken, props.paused, state.history.length]);
  function edit(index: number, value: number) {
    if (props.paused || won) return;
    const next = editNetworkEdge(state, index, value, rules.maximum);
    if (next === state) return;
    setState(next);
    setSelected(index);
    setHint(null);
    report(
      rules.conflicts(next.values).length
        ? "带 ! 的边需要检查；可以修改或撤销。"
        : "已记录。未知的边可暂时留白；叉表示确定不画线。",
    );
  }
  function cycle(index: number) {
    if (props.paused || won) return;
    const next = cycleNetworkEdge(state, index, rules.maximum);
    edit(index, next.values[index]);
  }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (
      (event.target as HTMLElement).tagName === "SELECT" ||
      props.paused ||
      won ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    )
      return;
    const value =
      event.key === "1"
        ? 1
        : event.key === "2" && rules.maximum === 2
          ? 2
          : ["0", "x", "X"].includes(event.key)
            ? 0
            : ["Delete", "Backspace"].includes(event.key)
              ? -1
              : null;
    if (value !== null) {
      event.preventDefault();
      edit(selected, value);
    }
  }
  return {
    state,
    selected,
    setSelected,
    hint,
    message,
    won,
    conflicts,
    edit,
    cycle,
    keyboard,
    report,
    paused: props.paused,
  };
}
export type NetworkRound = ReturnType<typeof useNetworkRound>;
export function NetworkToolbar({
  round,
  maximum,
}: {
  round: NetworkRound;
  maximum: 1 | 2;
}) {
  return (
    <>
      <div className="nd-tools" role="group" aria-label="设置所选边">
        <button
          type="button"
          disabled={round.paused || round.won}
          data-network-action="1"
          onClick={() => round.edit(round.selected, 1)}
        >
          一条线
        </button>
        {maximum === 2 && (
          <button
            type="button"
            disabled={round.paused || round.won}
            data-network-action="2"
            onClick={() => round.edit(round.selected, 2)}
          >
            双桥
          </button>
        )}
        <button
          type="button"
          disabled={round.paused || round.won}
          data-network-action="0"
          onClick={() => round.edit(round.selected, 0)}
        >
          × 不连
        </button>
        <button
          type="button"
          disabled={round.paused || round.won}
          data-network-action="-1"
          onClick={() => round.edit(round.selected, -1)}
        >
          清空
        </button>
      </div>
      {round.hint && round.hint.kind !== "unavailable" && (
        <button
          type="button"
          className="nd-apply"
          data-network-apply-hint
          disabled={round.paused || round.won}
          onClick={() => {
            if (round.hint && round.hint.kind !== "unavailable")
              round.edit(round.hint.index, round.hint.value);
          }}
        >
          采用这一步
        </button>
      )}
      <p className="nd-message" role="status" aria-live="polite">
        {round.message}
      </p>
    </>
  );
}
