import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import {
  DOTS_AI_DELAY,
  DOTS_SEARCH_DEPTH,
  DOTS_SEARCH_NODES,
  createDotsState,
  dotsLevels,
  dotsScores,
  dotsWinner,
  playDotsTurn,
  replyDotsTurn,
  searchDots,
  undoDotsTurn,
} from "./dotsAndBoxesLogic";
import "./connectionStrategy.css";

export default function DotsAndBoxes(props: GameProps) {
  return <DotsRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function DotsRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = dotsLevels[level] ?? dotsLevels[0];
  const [state, setState] = useState(() => createDotsState(config));
  const [hint, setHint] = useState<number | null>(null);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken }),
    notified = useRef(false);
  const clock = useRef({ key: "", remaining: DOTS_AI_DELAY });
  const pending = state.turn === 2 ? state.board.edges.join("") : "";
  const winner = dotsWinner(state.board),
    active = !paused && state.turn === 1,
    scores = dotsScores(state.board);
  useEffect(() => {
    if (!pending) {
      clock.current = { key: "", remaining: DOTS_AI_DELAY };
      return;
    }
    if (clock.current.key !== pending)
      clock.current = { key: pending, remaining: DOTS_AI_DELAY };
    if (paused) return;
    const started = performance.now();
    const timer = setTimeout(() => {
      clock.current.remaining = 0;
      setState((current) =>
        current.turn === 2 && current.board.edges.join("") === pending
          ? replyDotsTurn(current)
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
    if (winner !== null) {
      callbacks.current.onStatus(
        `终局 ${scores[0]} 比 ${scores[1]}。${winner === 1 ? "你圈出的花田更多，挑战成功！" : winner === 0 ? "这次平局，不计通关。可以撤销再试。" : "白花圈地更多，撤销一轮，再想想留边的顺序。"}`,
      );
      if (winner === 1 && !notified.current) {
        notified.current = true;
        callbacks.current.onComplete();
      }
    } else
      callbacks.current.onStatus(
        state.turn === 2
          ? state.lastMove?.extraTurn
            ? "白花围成花田，获得额外回合。"
            : "白花正在选边。暂停会冻结剩余等待时间。"
          : state.lastMove?.extraTurn
            ? "你围成了花田，继续画一条边！"
            : "点击两个相邻圆点之间的虚线，围成方格就得一分并再走一次。",
      );
  }, [state, winner, paused, scores[0], scores[1]]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (!active) return;
    const advice = searchDots(state.board);
    setHint(advice.move);
    if (advice.move === null) return;
    callbacks.current.onStatus(
      advice.exact
        ? advice.outcome === "win"
          ? `第 ${advice.move + 1} 条边：完整搜索确认可以保住胜势。`
          : `第 ${advice.move + 1} 条边是当前最佳选择；${advice.outcome === "tie" ? "面对最佳回应最多能争取平局" : "面对最佳回应已无法必胜"}。可以撤销再试。`
        : `试试第 ${advice.move + 1} 条边。这是有限搜索建议，尚未证明能赢。上限 ${DOTS_SEARCH_NODES.toLocaleString("zh-CN")} 节点 / ${DOTS_SEARCH_DEPTH} 步，本次 ${advice.nodes} 节点。`,
    );
  }, [hintToken, active, state]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    setHint(null);
    setState((current) => undoDotsTurn(current));
  }, [undoToken, paused]);
  const { rows, columns } = state.board,
    horizontal = (rows + 1) * columns;
  function edgeButton(
    index: number,
    row: number,
    column: number,
    vertical: boolean,
  ) {
    const owner = state.board.edges[index];
    return (
      <button
        key={`e${index}`}
        type="button"
        data-dots-edge={index}
        data-owner={owner}
        className={`cxg-dots-edge ${vertical ? "is-vertical" : "is-horizontal"} ${owner === 1 ? "is-player" : owner === 2 ? "is-opponent" : "is-empty"} ${hint === index && !paused ? "is-hinted" : ""} ${state.lastMove?.edge === index ? "is-last" : ""}`}
        style={{ gridRow: row + 1, gridColumn: column + 1 }}
        aria-label={`第 ${index + 1} 条${vertical ? "竖" : "横"}边，${owner === 1 ? "绿叶已画" : owner === 2 ? "白花已画" : "空边，可画线"}${hint === index && !paused ? "，建议画线" : ""}`}
        disabled={!active || owner !== 0}
        onClick={(event) => {
          if (event.detail > 1) return;
          setHint(null);
          setState((current) =>
            current === state ? playDotsTurn(current, index, paused) : current,
          );
        }}
      >
        <span aria-hidden="true">
          {!owner ? index + 1 : owner === 1 ? "✦" : "○"}
        </span>
      </button>
    );
  }
  return (
    <div className="cxg-layout cxg-dots">
      <section className="cxg-playfield" aria-label="点线花田挑战">
        <header className="cxg-heading">
          <div>
            <span className="cxg-eyebrow">DOTS & BOXES · FIELD STUDIES</span>
            <h3>{config.title}</h3>
          </div>
          <span className="cxg-badge">
            {String(level + 1).padStart(2, "0")} / 12
          </span>
        </header>
        <div className="cxg-scorebar">
          <span>
            <b>
              {scores[0]} : {scores[1]}
            </b>
            你 · 对手
          </span>
          <span>
            <b>{state.board.boxes.filter((p) => !p).length}</b>待围花田
          </span>
          <strong role="status" aria-live="polite">
            {paused
              ? "已暂停"
              : winner === 1
                ? "花田丰收！"
                : winner === 0
                  ? "这次平分秋色"
                  : winner === 2
                    ? "白花圈地更多"
                    : state.turn === 2
                      ? "对手在选边…"
                      : state.lastMove?.extraTurn
                        ? "再画一条边"
                        : "轮到你画线"}
          </strong>
        </div>
        <div className="cxg-legend">
          <span>✦ 绿叶 · 你的花田</span>
          <span>○ 白花 · 对手花田</span>
        </div>
        <div
          className="cxg-dots-board"
          style={
            { "--dots-columns": columns, "--dots-rows": rows } as CSSProperties
          }
          data-testid="dots-board"
          data-edges={state.board.edges.join(",")}
          data-boxes={state.board.boxes.join(",")}
          data-turn={state.turn}
          data-winner={winner ?? "playing"}
          role="group"
          aria-label={`${rows} 行 ${columns} 列花田，虚线可以点击画线`}
        >
          {Array.from({ length: (rows + 1) * (columns + 1) }, (_, i) => (
            <i
              key={`d${i}`}
              className="cxg-dot"
              aria-hidden="true"
              style={{
                gridRow: Math.floor(i / (columns + 1)) * 2 + 1,
                gridColumn: (i % (columns + 1)) * 2 + 1,
              }}
            />
          ))}
          {state.board.edges.map((_, index) =>
            index < horizontal
              ? edgeButton(
                  index,
                  Math.floor(index / columns) * 2,
                  (index % columns) * 2 + 1,
                  false,
                )
              : edgeButton(
                  index,
                  Math.floor((index - horizontal) / (columns + 1)) * 2 + 1,
                  ((index - horizontal) % (columns + 1)) * 2,
                  true,
                ),
          )}
          {state.board.boxes.map((owner, index) => (
            <div
              key={`b${index}`}
              data-dots-box={index}
              data-owner={owner}
              className={`cxg-dots-box ${owner === 1 ? "is-player" : owner === 2 ? "is-opponent" : ""} ${state.lastMove?.captured.includes(index) ? "is-new" : ""}`}
              style={{
                gridRow: Math.floor(index / columns) * 2 + 2,
                gridColumn: (index % columns) * 2 + 2,
              }}
              aria-label={`第 ${index + 1} 格，${owner === 1 ? "你的花田" : owner === 2 ? "白花的花田" : "尚未围成"}`}
            >
              <span aria-hidden="true">
                {owner === 1 ? "✦" : owner === 2 ? "○" : "·"}
              </span>
            </div>
          ))}
        </div>
        <p className="cxg-caption" aria-live="polite">
          {state.lastMove
            ? `${state.lastMove.player === 1 ? "你" : "白花"}画了第 ${state.lastMove.edge + 1} 条边。${state.lastMove.captured.length ? `围成 ${state.lastMove.captured.length} 格。` : "没有围成新格。"}${state.lastMove.extraTurn ? "获得额外回合。" : ""}`
            : "画下方格的最后一条边，这片花田就属于你。"}
        </p>
      </section>
      <aside className="cxg-notes">
        <span className="cxg-eyebrow">原创残局 · 本地确定性对手</span>
        <h3>
          一条小小的线，
          <br />
          一片新花田。
        </h3>
        <div className="cxg-objective">
          <span>本关目标</span>
          <p>
            你执绿叶先走。把所有边画完后，拥有的方格比白花更多就通关，平局不计通关。
          </p>
        </div>
        <ol>
          <li>
            <b>点一下，连起相邻圆点</b>
            <span>每次选择一条空边。每条边只能画一次，不需要拖拽。</span>
          </li>
          <li>
            <b>围成一格，得分并再走</b>
            <span>
              画下第四条边的人拥有整个方格，之前的边属于谁都可以。一条边还可能同时围成两格。
            </span>
          </li>
          <li>
            <b>留意连锁与让步</b>
            <span>
              填上第三条边可能送给对手一个方格；有时让出少量方格，能换来更长的收获链。
            </span>
          </li>
        </ol>
        <div className="cxg-tip">
          <b>观察笔记</b>
          <p>{config.idea}</p>
        </div>
        <p className="cxg-keyboard">
          Tab 选择边，Enter /
          空格画线。撤销退回本轮第一次画线前，连同双方所有额外回合。提示和对手最多搜索{" "}
          {DOTS_SEARCH_NODES.toLocaleString("zh-CN")} 节点、{DOTS_SEARCH_DEPTH}{" "}
          步；未算到底时会明确说明。
        </p>
      </aside>
    </div>
  );
}
