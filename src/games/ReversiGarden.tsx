import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  reversiLevels,
  reversiFlips,
  reversiLegalMoves,
  reversiScore,
  reversiWinner,
  createReversiState,
  playReversiTurn,
  replyReversiTurn,
  undoReversiTurn,
  chooseReversiMove,
} from "./reversiLogic";
import "./tacticalBoardGames.css";

export default function ReversiGarden(props: GameProps) {
  return <ReversiRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function ReversiRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = reversiLevels[level] ?? reversiLevels[0];
  const [state, setState] = useState(() => createReversiState(config));
  const [hint, setHint] = useState<number | null>(null);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken });
  const notified = useRef(false);
  const clock = useRef({ key: "", remaining: 550 });
  const pending = state.turn === 2 ? state.board.join("") : "";
  const score = reversiScore(state.board);
  const winner = reversiWinner(state.board, config.size);
  const legal = reversiLegalMoves(state.board, config.size, 1);
  const finished = state.turn === 0;
  const won = finished && winner === 1 && score.player >= config.target;
  const position = (index: number) =>
    `第 ${Math.floor(index / config.size) + 1} 行第 ${(index % config.size) + 1} 列`;
  const turnText = paused
    ? "已暂停"
    : won
      ? "花园守住了！"
      : finished
        ? "再试一次"
        : state.turn === 2
          ? "对手在思考…"
          : "轮到你落子";

  useEffect(() => {
    if (!pending) {
      clock.current = { key: "", remaining: 550 };
      return;
    }
    if (clock.current.key !== pending)
      clock.current = { key: pending, remaining: 550 };
    if (paused) return;
    const started = performance.now();
    const timer = setTimeout(() => {
      clock.current.remaining = 0;
      setState((current) =>
        current.turn === 2 && current.board.join("") === pending
          ? replyReversiTurn(current, config)
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
  }, [pending, paused, config]);

  useEffect(() => {
    if (paused) return;
    if (finished) {
      callbacks.current.onStatus(
        won
          ? `终局 ${score.player} 比 ${score.opponent}，达到 ${config.target} 子目标！`
          : `终局 ${score.player} 比 ${score.opponent}，${winner === 0 ? "这次平局" : "还没达到本关目标"}。撤销一回合，再试一种顺序。`,
      );
      if (won && !notified.current) {
        notified.current = true;
        callbacks.current.onComplete();
      }
    } else if (state.turn === 2)
      callbacks.current.onStatus(
        state.skipped === 1
          ? "你没有合法落点，自动跳过。对手再走一手。"
          : "对手正在思考，稍后会翻转夹住的棋子。",
      );
    else
      callbacks.current.onStatus(
        state.skipped === 2
          ? "对手没有合法落点，自动跳过。你可以再走一手。"
          : `${config.goal} 小圆点表示合法落点。`,
      );
  }, [
    state,
    paused,
    finished,
    won,
    score.player,
    score.opponent,
    winner,
    config,
  ]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || finished || state.turn !== 1) return;
    const move = chooseReversiMove(state.board, config.size, 1);
    setHint(move);
    if (move !== null)
      callbacks.current.onStatus(
        `试试${position(move)}，圆环标出的格子。${config.hint}`,
      );
  }, [hintToken, paused, finished, state, config]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    setHint(null);
    setState((current) => undoReversiTurn(current));
  }, [undoToken, paused]);

  return (
    <div className="tbg-layout tbg-reversi">
      <section className="tbg-playfield" aria-label="翻转花园挑战">
        <header className="tbg-heading">
          <div>
            <span className="tbg-eyebrow">REVERSI GARDEN</span>
            <h3>{config.title}</h3>
          </div>
          <span className="tbg-badge">
            {String(level + 1).padStart(2, "0")} / 12
          </span>
        </header>
        <div className="tbg-scorebar">
          <span>
            <b>
              {score.player}
              <small> / {config.target}</small>
            </b>
            你的绿叶
          </span>
          <span>
            <b>{score.opponent}</b>对手白花
          </span>
          <span className="tbg-turn" role="status" aria-live="polite">
            {turnText}
          </span>
        </div>
        <div className="tbg-legend">
          <span>
            <i className="tbg-swatch tbg-player" />你 · 绿叶
          </span>
          <span>
            <i className="tbg-swatch tbg-opponent" />
            对手 · 白花
          </span>
          <span>
            {config.size} × {config.size}
          </span>
        </div>
        <div
          className="tbg-reversi-board"
          style={{
            gridTemplateColumns: `repeat(${config.size}, minmax(0, 1fr))`,
          }}
          aria-label="翻转棋盘"
        >
          {state.board.map((piece, index) => {
            const available =
              !paused && state.turn === 1 && legal.includes(index);
            const flips = available
              ? reversiFlips(state.board, config.size, index, 1).length
              : 0;
            return (
              <button
                type="button"
                key={index}
                data-cell={index}
                data-piece={piece}
                className={`tbg-square ${available ? "is-legal" : ""} ${state.lastMove === index ? "is-last" : ""} ${state.flipped.includes(index) ? "is-flipped" : ""} ${hint === index && !paused ? "is-hinted" : ""}`}
                disabled={!available || finished}
                aria-label={`${position(index)}，${piece === 1 ? "你的绿叶" : piece === 2 ? "对手白花" : available ? `可落子，翻转 ${flips} 颗` : "空格，不可落子"}${hint === index && !paused ? "，建议落点" : ""}`}
                onClick={() => {
                  setHint(null);
                  setState((current) =>
                    playReversiTurn(current, config, index, paused),
                  );
                }}
              >
                {piece ? (
                  <span
                    className={`tbg-disc ${piece === 1 ? "tbg-player" : "tbg-opponent"}`}
                    aria-hidden="true"
                  >
                    {piece === 1 ? "✦" : "●"}
                  </span>
                ) : available ? (
                  <span className="tbg-legal-dot" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="tbg-caption">
          {state.skipped
            ? `${state.skipped === 1 ? "你" : "对手"}无合法落点，自动跳过这一手。`
            : "用新棋子和已有棋子夹住白花，就能把它们翻成绿叶。"}
        </p>
        <div className="tbg-progress" aria-hidden="true">
          <span
            style={{ width: `${(score.player / config.size ** 2) * 100}%` }}
          />
          <i
            style={{ width: `${(score.opponent / config.size ** 2) * 100}%` }}
          />
        </div>
      </section>
      <aside className="tbg-notes">
        <span className="tbg-eyebrow">{config.theme} · 本地对弈</span>
        <h3>
          换一个角度，
          <br />
          翻开新局面。
        </h3>
        <div className="tbg-objective">
          <span>本关目标</span>
          <p>{config.goal}</p>
        </div>
        <ol className="tbg-instructions">
          <li>
            <b>只在小圆点上落子</b>
            <span>
              横、竖、斜方向都可以夹子；一次落子会翻转所有夹住的白花。
            </span>
          </li>
          <li>
            <b>把最后的分数放在心里</b>
            <span>
              暂时翻得多，不一定最后留下得多。对手会认真争取最佳终局。
            </span>
          </li>
          <li>
            <b>没处落子就跳过</b>
            <span>
              双方都没有合法落点时结束，即使还有空格。撤销会收回你上一步和随后所有对手回应。
            </span>
          </li>
        </ol>
        <div className="tbg-tip">
          <b>花园观察笔记</b>
          <p>{config.hint}</p>
        </div>
        <p className="tbg-keyboard">
          键盘：Tab 选择合法格，Enter / 空格落子。提示显示当前最佳终局路线。
        </p>
      </aside>
    </div>
  );
}
