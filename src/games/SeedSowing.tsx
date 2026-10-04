import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  SOWING_AI_DELAY,
  createSowingState,
  playSowingTurn,
  replySowingTurn,
  searchSowing,
  sowingLevels,
  sowingTotal,
  sowingWinner,
  undoSowingTurn,
} from "./sowingLogic";
import "./classicStrategy.css";

export default function SeedSowing(props: GameProps) {
  return <SowingRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function SowingRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = sowingLevels[level] ?? sowingLevels[0];
  const [state, setState] = useState(() => createSowingState(config));
  const [hint, setHint] = useState<number | null>(null);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken });
  const notified = useRef(false);
  const clock = useRef({ key: "", remaining: SOWING_AI_DELAY });
  const pending =
    state.turn === 2 ? `${state.moves}:${state.board.join(",")}` : "";
  const winner = sowingWinner(state.board);
  const finished = state.turn === 0;
  const won = finished && winner === 1;
  const active = !paused && state.turn === 1;
  const last = state.lastMove;
  const turnText = paused
    ? "已暂停"
    : won
      ? "你的粮仓更丰盛！"
      : finished
        ? winner === 0
          ? "这次平分秋色"
          : "再试一种播种顺序"
        : state.turn === 2
          ? "对手在播种…"
          : last?.extraTurn
            ? "额外回合，再播一把"
            : "轮到你播种";

  useEffect(() => {
    if (!pending) {
      clock.current = { key: "", remaining: SOWING_AI_DELAY };
      return;
    }
    if (clock.current.key !== pending)
      clock.current = { key: pending, remaining: SOWING_AI_DELAY };
    if (paused) return;
    const started = performance.now();
    const timer = setTimeout(() => {
      clock.current.remaining = 0;
      setState((current) =>
        current.turn === 2 &&
        `${current.moves}:${current.board.join(",")}` === pending
          ? replySowingTurn(current)
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
    if (finished) {
      callbacks.current.onStatus(
        `终局 ${state.board[4]} 比 ${state.board[9]}。${won ? "你的粮仓种子更多，挑战成功！" : winner === 0 ? "这次平局。撤销一回合，试试另一条路线。" : "对手收获更多。可以撤销一回合，再试一种顺序。"}`,
      );
      if (won && !notified.current) {
        notified.current = true;
        callbacks.current.onComplete();
      }
    } else if (state.turn === 2)
      callbacks.current.onStatus(
        last?.extraTurn
          ? "对手最后一颗落进粮仓，获得额外回合。"
          : "对手正在选择播种的孔；暂停会冻结剩余等待时间。",
      );
    else
      callbacks.current.onStatus(
        last?.extraTurn
          ? "最后一颗进入你的粮仓，获得额外回合！再选一个有种子的孔。"
          : "选择下排有种子的孔，取出全部种子，沿箭头每孔播一颗。",
      );
  }, [state, paused, finished, won, winner, last]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (!active) return;
    const advice = searchSowing(state.board, 1);
    setHint(advice.move);
    callbacks.current.onStatus(
      advice.move === null
        ? "这一局已结束。"
        : advice.exact && advice.outcome === "win"
          ? `试试你的第 ${advice.move + 1} 孔。完整搜索确认，这一步能保住胜势。`
          : advice.exact
            ? `当前局面${advice.outcome === "tie" ? "最多能争取平局" : "面对最佳回应已无法必胜"}。第 ${advice.move + 1} 孔是最佳选择，也可以撤销再试。`
            : `试试你的第 ${advice.move + 1} 孔。这是有限搜索的建议，尚未证明能赢。`,
    );
  }, [hintToken, active, state]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    setHint(null);
    setState((current) => undoSowingTurn(current));
  }, [undoToken, paused]);

  const pit = (index: number, player: boolean) => (
    <button
      key={index}
      type="button"
      data-sowing-pit={index}
      data-count={state.board[index]}
      className={`csg-sowing-pit ${player ? "is-player" : "is-opponent"} ${hint === index && !paused ? "is-hinted" : ""} ${last?.last === index ? "is-last" : ""}`}
      aria-label={`${player ? "你的" : "对手的"}第 ${player ? index + 1 : 9 - index} 孔，${state.board[index]} 颗${player && state.board[index] ? "，播种" : ""}`}
      disabled={!player || !active || !state.board[index]}
      onClick={(event) => {
        if (event.detail > 1) return;
        setHint(null);
        setState((current) =>
          current === state ? playSowingTurn(current, index, paused) : current,
        );
      }}
    >
      <small>
        {player ? "叶" : "花"} {player ? index + 1 : 9 - index}
      </small>
      <span className="csg-seeds" aria-hidden="true">
        {Array.from({ length: Math.min(7, state.board[index]) }, (_, i) => (
          <i key={i} />
        ))}
      </span>
      <b>{state.board[index]}</b>
    </button>
  );
  return (
    <div className="csg-layout csg-sowing">
      <section className="csg-playfield" aria-label="播种花园挑战">
        <header className="csg-heading">
          <div>
            <span className="csg-eyebrow">SEED SOWING</span>
            <h3>{config.title}</h3>
          </div>
          <span className="csg-badge">
            {String(level + 1).padStart(2, "0")} / 12
          </span>
        </header>
        <div className="csg-scorebar">
          <span>
            <b>
              {state.board[4]}
              <small> : {state.board[9]}</small>
            </b>
            你 · 对手
          </span>
          <span>
            <b>{state.moves}</b>你的播种
          </span>
          <strong role="status" aria-live="polite">
            {turnText}
          </strong>
        </div>
        <div className="csg-sowing-direction">
          <span>✿ 对手的四孔</span>
          <b aria-hidden="true">← ← ←</b>
        </div>
        <div
          className="csg-sowing-board"
          data-testid="sowing-board"
          data-board={state.board.join(",")}
          data-turn={state.turn}
          data-winner={winner === null ? "playing" : winner}
          aria-label="四孔卡拉棋盘，上排对手，下排是你"
        >
          <div
            className="csg-store csg-opponent-store"
            data-testid="sowing-opponent-store"
            data-count={state.board[9]}
          >
            <span aria-hidden="true">✿</span>
            <small>
              对手
              <br />
              粮仓
            </small>
            <b>{state.board[9]}</b>
          </div>
          {[8, 7, 6, 5].map((index) => pit(index, false))}
          <div
            className="csg-store csg-player-store"
            data-testid="sowing-player-store"
            data-count={state.board[4]}
          >
            <span aria-hidden="true">✦</span>
            <small>
              你的
              <br />
              粮仓
            </small>
            <b>{state.board[4]}</b>
          </div>
          {[0, 1, 2, 3].map((index) => pit(index, true))}
        </div>
        <div className="csg-sowing-direction is-player">
          <span>✦ 你的四孔 · 点击播种</span>
          <b aria-hidden="true">→ → →</b>
        </div>
        <div className="csg-harvest">
          <span>
            种子总数 <b>{sowingTotal(state.board)}</b>
          </span>
          <span>每颗都保留，最后全数入仓</span>
        </div>
        <p className="csg-caption" aria-live="polite">
          {last
            ? `${last.player === 1 ? "你" : "对手"}播了 ${last.path.length} 颗。${last.captured ? `捕获 ${last.captured} 颗。` : ""}${last.extraTurn ? "最后一颗入仓，再走一次。" : ""}${finished ? `一侧已空，收仓结束。` : ""}`
            : "从下排选一孔，沿环形路线播种，跳过对手粮仓。"}
        </p>
        <div className="csg-sowing-key">
          <span>
            <i>1</i>取出一孔全部种子
          </span>
          <span>
            <i>2</i>沿箭头每孔一颗
          </span>
          <span>
            <i>3</i>比较最终粮仓
          </span>
        </div>
      </section>
      <aside className="csg-notes">
        <span className="csg-eyebrow">FOUR-PIT KALAH · 原创残局</span>
        <h3>
          把一把种子，
          <br />
          播成更远的计划。
        </h3>
        <div className="csg-objective">
          <span>本关目标</span>
          <p>
            四孔 Kalah
            变体。你先走；结束时，你的粮仓种子必须比对手多。平局不算通关。
          </p>
        </div>
        <ol>
          <li>
            <b>沿环形路线播种</b>
            <span>
              选己方一孔并取出全部种子。每孔放一颗，经过自己的粮仓也放，跳过对手粮仓。
            </span>
          </li>
          <li>
            <b>入仓再走，空孔捕获</b>
            <span>
              最后一颗落在自己的粮仓，可再走；落在己方原本为空的孔，且正对面的孔有种子，就把两孔种子都收进自己的粮仓。
            </span>
          </li>
          <li>
            <b>一侧空，立即收仓</b>
            <span>
              任一侧四孔全空，双方把各自剩余种子收入粮仓并比较数量。结束时不再获得额外回合。
            </span>
          </li>
        </ol>
        <div className="csg-tip">
          <b>花园观察笔记</b>
          <p>{config.idea}</p>
        </div>
        <p className="csg-keyboard">
          撤销会退回本轮第一次播种前，连同双方的额外回合。对手为有界搜索的本地
          AI。键盘 Tab 选择下排孔，Enter / 空格播种。
        </p>
      </aside>
    </div>
  );
}
