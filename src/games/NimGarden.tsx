import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  NIM_AI_DELAY,
  createNimState,
  nimHint,
  nimLevels,
  nimRemaining,
  nimXor,
  playNimTurn,
  replyNimTurn,
  undoNimTurn,
  type NimMove,
} from "./nimLogic";
import "./classicStrategy.css";

export default function NimGarden(props: GameProps) {
  return <NimRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function NimRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = nimLevels[level] ?? nimLevels[0];
  const [state, setState] = useState(() => createNimState(config));
  const [selected, setSelected] = useState<number | null>(null);
  const [amount, setAmount] = useState(1);
  const [hint, setHint] = useState<NimMove | null>(null);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken });
  const notified = useRef(false);
  const clock = useRef({ key: "", remaining: NIM_AI_DELAY });
  const pending =
    state.turn === 2 ? `${state.moves}:${state.piles.join(",")}` : "";
  const active = !paused && state.turn === 1;
  const finished = state.turn === 0;
  const remaining = nimRemaining(state.piles);
  const turnText = paused
    ? "已暂停"
    : state.winner === 1
      ? "最后一颗属于你！"
      : state.winner === 2
        ? "对手拿到最后一颗"
        : state.turn === 2
          ? "对手在思考…"
          : "选一堆，再决定拿几颗";

  useEffect(() => {
    if (!pending) {
      clock.current = { key: "", remaining: NIM_AI_DELAY };
      return;
    }
    if (clock.current.key !== pending)
      clock.current = { key: pending, remaining: NIM_AI_DELAY };
    if (paused) return;
    const started = performance.now();
    const timer = setTimeout(() => {
      clock.current.remaining = 0;
      setState((current) =>
        current.turn === 2 &&
        `${current.moves}:${current.piles.join(",")}` === pending
          ? replyNimTurn(current)
          : current,
      );
    }, clock.current.remaining);
    return () => {
      clearTimeout(timer);
      clock.current.remaining = Math.max(
        0,
        clock.current.remaining - (performance.now() - started),
      );
    };
  }, [pending, paused]);
  useEffect(() => {
    if (paused) return;
    if (state.winner === 1) {
      callbacks.current.onStatus(
        `你拿走了最后一颗，${state.moves} 次取子完成本关！`,
      );
      if (!notified.current) {
        notified.current = true;
        callbacks.current.onComplete();
      }
    } else if (state.winner === 2)
      callbacks.current.onStatus(
        "对手拿走了最后一颗。撤销一整个回合，重新寻找平衡点。",
      );
    else if (state.turn === 2)
      callbacks.current.onStatus(
        "对手按最优策略思考中；暂停会保留剩余等待时间。",
      );
    else
      callbacks.current.onStatus(
        `还有 ${remaining} 颗。只从一堆拿走任意正整数颗，拿走最后一颗就获胜。`,
      );
  }, [state, paused, remaining]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (!active) return;
    const advice = nimHint(state.piles);
    setHint(advice.move);
    if (advice.move) {
      setSelected(advice.move.pile);
      setAmount(advice.move.remove);
    }
    callbacks.current.onStatus(
      advice.outcome === "win" && advice.move
        ? `从第 ${advice.move.pile + 1} 堆拿 ${advice.move.remove} 颗，让异或和变成 0。继续每次恢复这个平衡，就能赢。`
        : "当前异或和为 0：面对最优对手，已没有必胜走法。可撤销上一回合；标记的合法走法不保证获胜。",
    );
  }, [hintToken, active, state]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    setHint(null);
    setSelected(null);
    setAmount(1);
    setState((current) => undoNimTurn(current));
  }, [undoToken, paused]);

  const last = state.lastMove;
  return (
    <div className="csg-layout csg-nim">
      <section className="csg-playfield" aria-label="尼姆花园挑战">
        <header className="csg-heading">
          <div>
            <span className="csg-eyebrow">NIM GARDEN</span>
            <h3>{config.title}</h3>
          </div>
          <span className="csg-badge">
            {String(level + 1).padStart(2, "0")} / 12
          </span>
        </header>
        <div className="csg-scorebar">
          <span>
            <b>{remaining}</b>剩余石子
          </span>
          <span>
            <b>{state.moves}</b>你的取子
          </span>
          <strong role="status" aria-live="polite">
            {turnText}
          </strong>
        </div>
        <div
          className="csg-nim-board"
          data-testid="nim-board"
          data-turn={state.turn}
          data-piles={state.piles.join(",")}
          data-winner={state.winner}
          aria-label="选择一堆石子"
        >
          {state.piles.map((count, pile) => (
            <button
              key={pile}
              type="button"
              data-nim-pile={pile}
              data-count={count}
              className={`csg-nim-pile ${selected === pile ? "is-selected" : ""} ${hint?.pile === pile && !paused ? "is-hinted" : ""} ${last?.pile === pile ? "is-last" : ""}`}
              aria-label={`第 ${pile + 1} 堆，${count} 颗${count ? "，选择这堆" : "，已空"}`}
              aria-pressed={selected === pile}
              disabled={!active || !count}
              onClick={() => {
                setSelected(pile);
                setAmount(1);
                setHint(null);
              }}
            >
              <span className="csg-pile-label">
                <small>花畦 {String(pile + 1).padStart(2, "0")}</small>
                <b>
                  {count}
                  <em> 颗</em>
                </b>
              </span>
              <span className="csg-stones" aria-hidden="true">
                {Array.from({ length: count }, (_, i) => (
                  <i
                    key={i}
                    className={
                      selected === pile && i >= count - amount
                        ? "will-remove"
                        : ""
                    }
                  >
                    ✦
                  </i>
                ))}
                {!count && <span className="csg-empty">· 已取空 ·</span>}
              </span>
              <span className="csg-pile-check" aria-hidden="true">
                {selected === pile ? "✓" : count ? "+" : "—"}
              </span>
            </button>
          ))}
        </div>
        <div className="csg-nim-picker">
          <div className="csg-picker-label">
            <b>
              {selected === null ? "先选择一堆" : `从第 ${selected + 1} 堆拿走`}
            </b>
            <span>每次只动一堆</span>
          </div>
          <div className="csg-amounts" aria-label="选择取走数量">
            {selected !== null &&
              Array.from(
                { length: state.piles[selected] },
                (_, i) => i + 1,
              ).map((n) => (
                <button
                  type="button"
                  key={n}
                  data-nim-remove={n}
                  aria-label={`拿走 ${n} 颗`}
                  aria-pressed={amount === n}
                  className={amount === n ? "is-selected" : ""}
                  disabled={!active}
                  onClick={() => {
                    setAmount(n);
                    setHint(null);
                  }}
                >
                  {n}
                </button>
              ))}
          </div>
          <button
            type="button"
            data-testid="nim-confirm"
            className="csg-confirm"
            disabled={
              !active || selected === null || amount > state.piles[selected]
            }
            onClick={() => {
              if (!active || selected === null) return;
              const move = { pile: selected, remove: amount };
              setState((current) =>
                current === state
                  ? playNimTurn(current, move, paused)
                  : current,
              );
              setSelected(null);
              setAmount(1);
              setHint(null);
            }}
          >
            {selected === null ? "选好花畦后取子" : `确认拿走 ${amount} 颗`}
            <span aria-hidden="true"> ↗</span>
          </button>
        </div>
        <p className="csg-caption">
          {last
            ? `${last.player === 1 ? "你" : "对手"}从第 ${last.pile + 1} 堆拿走 ${last.remove} 颗。${finished ? "本局结束。" : ""}`
            : "圆石上的星形与数字，让每一颗都数得清。"}
        </p>
      </section>
      <aside className="csg-notes">
        <span className="csg-eyebrow">NORMAL PLAY · 本地最优对手</span>
        <h3>
          拿走最后一颗，
          <br />
          留下刚好的平衡。
        </h3>
        <div className="csg-objective">
          <span>本关目标</span>
          <p>
            从这个残局出发，拿走最后一颗石子。共 {config.piles.length}{" "}
            堆，你先走。
          </p>
        </div>
        <ol>
          <li>
            <b>每次只选一堆</b>
            <span>可以拿 1 颗、多颗，或拿空整堆。不能一次跨两堆。</span>
          </li>
          <li>
            <b>常规尼姆：最后一颗获胜</b>
            <span>
              不是“拿最后一颗就输”的玩法。对手会使用精确的异或最优策略。
            </span>
          </li>
          <li>
            <b>撤销会收回一整个回合</b>
            <span>
              一起收回你和对手的取子。提示按当前局面计算，走错后会诚实说明是否还能必胜。
            </span>
          </li>
        </ol>
        <details className="csg-math">
          <summary>观察二进制平衡</summary>
          <p>
            把各堆写成二进制。每一列的 1 为偶数时，异或和是
            0。把这样的局面留给对手。
          </p>
          <div className="csg-binary">
            {state.piles.map((n, i) => (
              <span key={i}>
                第 {i + 1} 堆 <b>{n.toString(2).padStart(5, "0")}</b>
              </span>
            ))}
            <span className="csg-xor">
              异或和 <b>{nimXor(state.piles).toString(2).padStart(5, "0")}</b>
            </span>
          </div>
        </details>
        <div className="csg-tip">
          <b>花园观察笔记</b>
          <p>{config.idea}</p>
        </div>
        <p className="csg-keyboard">
          键盘：Tab 选堆和数量，Enter / 空格确认。触屏直接点选，无需拖动。
        </p>
      </aside>
    </div>
  );
}
