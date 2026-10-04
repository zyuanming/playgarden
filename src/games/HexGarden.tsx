import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import {
  HEX_AI_DELAY,
  HEX_SEARCH_DEPTH,
  HEX_SEARCH_NODES,
  createHexState,
  hexLevels,
  hexWinner,
  hexWinningPath,
  playHexTurn,
  replyHexTurn,
  searchHex,
  undoHexTurn,
} from "./hexLogic";
import "./connectionStrategy.css";

export default function HexGarden(props: GameProps) {
  return <HexRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function HexRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = hexLevels[level] ?? hexLevels[0];
  const [state, setState] = useState(() => createHexState(config));
  const [hint, setHint] = useState<number | null>(null);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken }),
    notified = useRef(false);
  const clock = useRef({ key: "", remaining: HEX_AI_DELAY });
  const pending = state.turn === 2 ? state.board.join("") : "";
  const winner = hexWinner(state.board, state.size),
    active = !paused && state.turn === 1;
  const path = winner ? hexWinningPath(state.board, state.size, winner) : [];
  useEffect(() => {
    if (!pending) {
      clock.current = { key: "", remaining: HEX_AI_DELAY };
      return;
    }
    if (clock.current.key !== pending)
      clock.current = { key: pending, remaining: HEX_AI_DELAY };
    if (paused) return;
    const started = performance.now();
    const timer = setTimeout(() => {
      clock.current.remaining = 0;
      setState((current) =>
        current.turn === 2 && current.board.join("") === pending
          ? replyHexTurn(current)
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
    if (winner === 1) {
      callbacks.current.onStatus(
        `绿叶连通上下两岸，挑战成功！你落了 ${state.moves} 子。`,
      );
      if (!notified.current) {
        notified.current = true;
        callbacks.current.onComplete();
      }
    } else if (winner === 2)
      callbacks.current.onStatus(
        "白花先连通左右两岸。撤销一回合，再找一条路。",
      );
    else
      callbacks.current.onStatus(
        state.turn === 2
          ? "白花在选择连接点。暂停会冻结剩余等待时间。"
          : "你执绿叶，点击一个空六边格，连接标有绿叶的上下两岸。",
      );
  }, [state, winner, paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (!active) return;
    const advice = searchHex(state.board, state.size);
    setHint(advice.move);
    if (advice.move === null) return;
    const cell = `第 ${Math.floor(advice.move / state.size) + 1} 行第 ${(advice.move % state.size) + 1} 格`;
    callbacks.current.onStatus(
      advice.exact
        ? advice.outcome === "win"
          ? `${cell}：完整搜索确认可以保住胜势。`
          : `${cell}是当前最佳选择，但面对最佳回应已无法必胜。可以撤销再试。`
        : `${cell}：有限搜索建议，尚未证明能赢。上限 ${HEX_SEARCH_NODES.toLocaleString("zh-CN")} 节点 / ${HEX_SEARCH_DEPTH} 步，本次 ${advice.nodes} 节点。`,
    );
  }, [hintToken, active, state]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    setHint(null);
    setState((current) => undoHexTurn(current));
  }, [undoToken, paused]);
  return (
    <div className="cxg-layout cxg-hex">
      <section className="cxg-playfield" aria-label="六角花径挑战">
        <header className="cxg-heading">
          <div>
            <span className="cxg-eyebrow">HEX · CONNECTION STUDIES</span>
            <h3>{config.title}</h3>
          </div>
          <span className="cxg-badge">
            {String(level + 1).padStart(2, "0")} / 12
          </span>
        </header>
        <div className="cxg-scorebar">
          <span>
            <b>
              {state.size} × {state.size}
            </b>
            六边棋盘
          </span>
          <span>
            <b>{state.moves}</b>你的落子
          </span>
          <strong role="status" aria-live="polite">
            {paused
              ? "已暂停"
              : winner === 1
                ? "两岸相连！"
                : winner === 2
                  ? "白花先连通"
                  : state.turn === 2
                    ? "对手在思考…"
                    : "轮到你落子"}
          </strong>
        </div>
        <div className="cxg-legend">
          <span>✦ 你 · 上下连通</span>
          <span>○ 对手 · 左右连通</span>
        </div>
        <div
          className="cxg-hex-stage"
          style={{ "--hex-size": state.size } as CSSProperties}
        >
          <div className="cxg-shore is-top">✦ 上岸</div>
          <div
            className="cxg-hex-board"
            data-testid="hex-board"
            data-board={state.board.join(",")}
            data-turn={state.turn}
            data-winner={winner ?? "playing"}
            role="group"
            aria-label={`${state.size} 行 ${state.size} 列六边格，上下绿岸属于你，左右白岸属于对手`}
          >
            {Array.from({ length: state.size }, (_, row) => (
              <div
                key={row}
                className="cxg-hex-row"
                style={{ "--hex-row": row } as CSSProperties}
              >
                {Array.from({ length: state.size }, (_, column) => {
                  const index = row * state.size + column,
                    piece = state.board[index];
                  return (
                    <button
                      key={index}
                      type="button"
                      data-hex-cell={index}
                      data-piece={piece}
                      className={`cxg-hex-cell ${piece === 1 ? "is-player" : piece === 2 ? "is-opponent" : "is-empty"} ${hint === index && !paused ? "is-hinted" : ""} ${path.includes(index) ? "is-winning" : ""} ${state.lastMove === index ? "is-last" : ""}`}
                      aria-label={`第 ${row + 1} 行第 ${column + 1} 格，${piece === 1 ? "绿叶" : piece === 2 ? "白花" : "空位，可落子"}${hint === index && !paused ? "，建议落点" : ""}`}
                      disabled={!active || piece !== 0}
                      onClick={(event) => {
                        if (event.detail > 1) return;
                        setHint(null);
                        setState((current) =>
                          current === state
                            ? playHexTurn(current, index, paused)
                            : current,
                        );
                      }}
                    >
                      <span aria-hidden="true">
                        {piece === 1
                          ? "✦"
                          : piece === 2
                            ? "○"
                            : `${row + 1}·${column + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="cxg-shore is-bottom">✦ 下岸</div>
        </div>
        <p className="cxg-caption">
          ○ 左右是白花的目标岸 · 只有共享一条边的格子才相连。
        </p>
      </section>
      <aside className="cxg-notes">
        <span className="cxg-eyebrow">原创残局 · 本地确定性对手</span>
        <h3>
          绕过白花，
          <br />
          连接两片绿岸。
        </h3>
        <div className="cxg-objective">
          <span>本关目标</span>
          <p>
            你执绿叶先走。用相邻六边格连通棋盘上岸与下岸，抢在白花连接左右岸之前完成。
          </p>
        </div>
        <ol>
          <li>
            <b>六个方向，接成一条路</b>
            <span>
              每步在任意空格放一枚棋子，落下后不会移动，也不会被吃掉。
            </span>
          </li>
          <li>
            <b>攻守同时考虑</b>
            <span>
              对手也会寻找通路。挡住它的连接点，也可能让你的花径更连贯。
            </span>
          </li>
          <li>
            <b>连接完成才算胜利</b>
            <span>这里没有步数脚本，任何合法路线都能获胜。Hex 没有平局。</span>
          </li>
        </ol>
        <div className="cxg-tip">
          <b>观察笔记</b>
          <p>{config.idea}</p>
        </div>
        <p className="cxg-keyboard">
          Tab 选空格，Enter /
          空格落子。撤销收回你的一子及对手回应。暂停冻结等待；重来恢复本关。提示和对手最多搜索{" "}
          {HEX_SEARCH_NODES.toLocaleString("zh-CN")} 节点、{HEX_SEARCH_DEPTH}{" "}
          步；未搜索到底时只提供建议。
        </p>
      </aside>
    </div>
  );
}
