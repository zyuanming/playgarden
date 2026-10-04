import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { GameProps } from "../lib/types";
import {
  createArithmeticState,
  inputArithmetic,
  undoArithmetic,
  type ArithmeticHint,
} from "./arithmeticConstraintCore";
import "./arithmeticConstraints.css";
export type ArithmeticRules = {
  width: number;
  length: number;
  active: number[];
  digits: number;
  introduction: string;
  celebration: string;
  solved: (values: readonly number[]) => boolean;
  conflicts: (values: readonly number[]) => number[];
  hint: (values: readonly number[]) => ArithmeticHint;
};
export function useArithmeticRound(props: GameProps, rules: ArithmeticRules) {
  const [state, setState] = useState(() => createArithmeticState(rules.length));
  const [selected, setSelected] = useState(rules.active[0]);
  const [hint, setHint] = useState<ArithmeticHint | null>(null);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const callbacks = useRef({
    onStatus: props.onStatus,
    onComplete: props.onComplete,
  });
  callbacks.current = {
    onStatus: props.onStatus,
    onComplete: props.onComplete,
  };
  const seen = useRef({ hint: props.hintToken, undo: props.undoToken });
  const notified = useRef(false),
    won = rules.solved(state.values),
    conflicts = rules.conflicts(state.values);
  useEffect(() => {
    callbacks.current.onStatus(rules.introduction);
  }, []);
  useEffect(() => {
    if (props.paused || !won || notified.current) return;
    notified.current = true;
    callbacks.current.onStatus(rules.celebration);
    callbacks.current.onComplete();
  }, [props.paused, won, rules.celebration]);
  useEffect(() => {
    if (seen.current.hint === props.hintToken) return;
    seen.current.hint = props.hintToken;
    if (props.paused || won) return;
    const next = rules.hint(state.values);
    setHint(next);
    if (next.kind !== "unavailable") {
      setSelected(next.index);
      cells.current[next.index]?.focus();
    }
    callbacks.current.onStatus(
      next.kind === "unavailable"
        ? next.reason
        : `第 ${Math.floor(next.index / rules.width) + 1} 行第 ${(next.index % rules.width) + 1} 列：${next.reason}${next.kind === "deduction" ? ` ${next.value}。` : ""}`,
    );
  }, [props.hintToken, props.paused, rules, state.values, won]);
  useEffect(() => {
    if (seen.current.undo === props.undoToken) return;
    seen.current.undo = props.undoToken;
    if (props.paused) return;
    setState((current) => undoArithmetic(current));
    setHint(null);
    callbacks.current.onStatus(
      state.history.length ? "已撤销上一次填写。" : "还没有可以撤销的填写。",
    );
  }, [props.undoToken, props.paused, state.history.length]);
  function input(value: number) {
    const next = inputArithmetic(
      state,
      selected,
      value,
      rules.active,
      rules.digits,
      props.paused || won,
    );
    if (next === state) return;
    setState(next);
    setHint(null);
    callbacks.current.onStatus(
      rules.conflicts(next.values).length
        ? "带 ! 的格子所在数字段或运算笼需要检查。可修改、清空或撤销。"
        : value
          ? "已填入数字。继续交叉检查线索。"
          : "已清空所选格。",
    );
  }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey || props.paused || won)
      return;
    if (/^[1-9]$/.test(event.key) && Number(event.key) <= rules.digits) {
      event.preventDefault();
      input(Number(event.key));
    } else if (["0", "Delete", "Backspace"].includes(event.key)) {
      event.preventDefault();
      input(0);
    }
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta: Record<string, number> = {
      ArrowUp: -rules.width,
      ArrowDown: rules.width,
      ArrowLeft: -1,
      ArrowRight: 1,
    };
    if (!(event.key in delta) || props.paused || won) return;
    event.preventDefault();
    event.stopPropagation();
    let next = index;
    while (true) {
      const old = next;
      next += delta[event.key];
      if (
        next < 0 ||
        next >= rules.length ||
        (["ArrowLeft", "ArrowRight"].includes(event.key) &&
          Math.floor(old / rules.width) !== Math.floor(next / rules.width))
      )
        return;
      if (rules.active.includes(next)) {
        setSelected(next);
        cells.current[next]?.focus();
        return;
      }
    }
  }
  return {
    state,
    selected,
    setSelected,
    hint,
    cells,
    won,
    conflicts,
    paused: props.paused,
    input,
    keyboard,
    navigate,
  };
}
export type ArithmeticRound = ReturnType<typeof useArithmeticRound>;
export function ArithmeticCell({
  round,
  index,
  width,
  game,
  label,
  children,
  style,
}: {
  round: ArithmeticRound;
  index: number;
  width: number;
  game: "kakuro" | "arithmetic-cage";
  label?: string;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  const value = round.state.values[index],
    conflict = round.conflicts.includes(index),
    hinted = round.hint?.kind !== "unavailable" && round.hint?.index === index;
  return (
    <button
      type="button"
      ref={(element) => {
        round.cells.current[index] = element;
      }}
      className={`ac-cell ${round.selected === index ? "ac-selected" : ""} ${hinted ? "ac-hinted" : ""} ${conflict ? "ac-conflict" : ""}`}
      style={style}
      data-arithmetic-game={game}
      data-arithmetic-cell={index}
      data-value={value}
      aria-label={`第 ${Math.floor(index / width) + 1} 行第 ${(index % width) + 1} 列，${value || "空白"}${label ? `，${label}` : ""}${conflict ? "，线索冲突" : ""}`}
      aria-pressed={round.selected === index}
      aria-invalid={conflict || undefined}
      tabIndex={round.selected === index ? 0 : -1}
      disabled={round.paused || round.won}
      onFocus={() => round.setSelected(index)}
      onClick={() => round.setSelected(index)}
      onKeyDown={(event) => round.navigate(event, index)}
    >
      {children}
      <span className="ac-value">{value || "·"}</span>
      {conflict && (
        <span className="ac-error" aria-hidden="true">
          !
        </span>
      )}
    </button>
  );
}
export function ArithmeticPad({
  round,
  digits,
}: {
  round: ArithmeticRound;
  digits: number;
}) {
  return (
    <>
      <div
        className="ac-pad"
        role="group"
        aria-label="填入数字"
        style={
          { "--ac-pad-columns": digits > 5 ? 5 : digits + 1 } as CSSProperties
        }
      >
        {Array.from({ length: digits }, (_, i) => i + 1).map((v) => (
          <button
            key={v}
            type="button"
            disabled={round.paused || round.won}
            aria-label={`填入 ${v}`}
            onClick={() => round.input(v)}
          >
            {v}
          </button>
        ))}
        <button
          className="ac-clear"
          type="button"
          disabled={round.paused || round.won}
          aria-label="清空所选格"
          onClick={() => round.input(0)}
        >
          清空
        </button>
      </div>
      {round.hint && (
        <p className="ac-hint" role="status">
          {round.hint.reason}
          {round.hint.kind === "deduction" ? ` ${round.hint.value}。` : ""}
        </p>
      )}
    </>
  );
}
