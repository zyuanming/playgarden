import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  connectLevels,
  connectLegalMoves,
  connectWinner,
  connectWinningCells,
  createConnectState,
  playConnectTurn,
  replyConnectTurn,
  undoConnectTurn,
  connectChallengeHint,
} from "./connectLogic";
import "./tacticalBoardGames.css";

export default function FourInARow(props: GameProps) {
  return <ConnectRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function ConnectRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = connectLevels[level] ?? connectLevels[0];
  const [state, setState] = useState(() => createConnectState(config));
  const [hint, setHint] = useState<number | null>(null);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken });
  const notified = useRef(false);
  const clock = useRef({ key: "", remaining: 550 });
  const pending = state.turn === 2 ? state.board.join("") : "";
  const winner = connectWinner(state.board);
  const winningCells = connectWinningCells(state.board);
  const legal = connectLegalMoves(state.board);
  const won = winner === 1;
  const finished = state.turn === 0;
  const turnText = paused
    ? "已暂停"
    : won
      ? "四子成线！"
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
          ? replyConnectTurn(current)
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
    if (won) {
      callbacks.current.onStatus(`四子连线成功！你用了 ${state.moves} 步。`);
      if (!notified.current) {
        notified.current = true;
        callbacks.current.onComplete();
      }
    } else if (finished) {
      callbacks.current.onStatus(
        winner === 2
          ? "对手先连成了四子。撤销一回合，换个计划再试试。"
          : winner === 0
            ? "棋盘已满，这次平局。可以撤销或重来。"
            : "步数用完了，还没连成四子。撤销一回合，试试另一条路线。",
      );
    } else if (state.turn === 2)
      callbacks.current.onStatus("对手正在思考。暂停会冻结它的回合。");
    else
      callbacks.current.onStatus(
        `${config.goal} 还可以落 ${config.maxTurns - state.moves} 步。`,
      );
  }, [state, paused, won, finished, winner, config]);

  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || finished || state.turn !== 1) return;
    const solution = connectChallengeHint(
      config,
      state.board,
      config.maxTurns - state.moves,
    );
    setHint(solution?.[0] ?? null);
    callbacks.current.onStatus(
      solution?.length
        ? `试试第 ${solution[0] + 1} 列，带圆环的落子按钮。${config.hint}`
        : "暂时没找到剩余步数内的完整路线。可以先撤销一回合，再试试其他落点。",
    );
  }, [hintToken, paused, finished, state, config]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    setHint(null);
    setState((current) => undoConnectTurn(current));
  }, [undoToken, paused]);

  return (
    <div className="tbg-layout tbg-connect">
      <section className="tbg-playfield" aria-label="四子花径挑战">
        <header className="tbg-heading">
          <div>
            <span className="tbg-eyebrow">FOUR IN A ROW</span>
            <h3>{config.title}</h3>
          </div>
          <span className="tbg-badge">
            {String(level + 1).padStart(2, "0")} / 12
          </span>
        </header>
        <div className="tbg-scorebar">
          <span>
            <b>
              {config.maxTurns - state.moves}
              <small> / {config.maxTurns}</small>
            </b>
            剩余步数
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
        </div>
        <div className="tbg-drop-controls" aria-label="选择落子列">
          {Array.from({ length: 7 }, (_, column) => (
            <button
              type="button"
              key={column}
              aria-label={`第 ${column + 1} 列落子${!legal.includes(column) ? "，已满" : ""}${hint === column ? "，建议落点" : ""}`}
              className={`tbg-drop ${hint === column && !paused ? "is-hinted" : ""}`}
              disabled={
                paused ||
                finished ||
                state.turn !== 1 ||
                !legal.includes(column)
              }
              onClick={() => {
                setHint(null);
                setState((current) =>
                  playConnectTurn(current, config, column, paused),
                );
              }}
            >
              <span aria-hidden="true">↓</span>
              <small>{column + 1}</small>
            </button>
          ))}
        </div>
        <div
          className="tbg-connect-board"
          role="img"
          aria-label={`六行七列棋盘，绿色为你，白色为对手。${state.board
            .map((p, i) =>
              p
                ? `第${Math.floor(i / 7) + 1}行第${(i % 7) + 1}列${p === 1 ? "绿" : "白"}`
                : "",
            )
            .filter(Boolean)
            .join("；")}`}
        >
          {state.board.map((piece, index) => (
            <span
              key={index}
              data-cell={index}
              data-piece={piece}
              className={`tbg-hole ${piece === 1 ? "tbg-player" : piece === 2 ? "tbg-opponent" : ""} ${winningCells.includes(index) ? "is-winning" : ""} ${state.lastMove === index ? "is-last" : ""}`}
              aria-hidden="true"
            >
              {piece === 1 ? "✦" : piece === 2 ? "●" : ""}
            </span>
          ))}
        </div>
        <p className="tbg-caption">点击上方箭头，棋子会落到该列最低的空位。</p>
      </section>
      <aside className="tbg-notes">
        <span className="tbg-eyebrow">{config.theme} · 本地对弈</span>
        <h3>
          连起四颗，
          <br />
          让想法生长。
        </h3>
        <div className="tbg-objective">
          <span>本关目标</span>
          <p>{config.goal}</p>
        </div>
        <ol className="tbg-instructions">
          <li>
            <b>你执绿叶，先走一步</b>
            <span>从已摆好的局面开始。横向、竖向、两种斜向都算连线。</span>
          </li>
          <li>
            <b>想一想对手的回应</b>
            <span>
              白花会寻找连线，也会挡住你。留意能同时产生两个威胁的落点。
            </span>
          </li>
          <li>
            <b>试错也是计划的一部分</b>
            <span>
              撤销会退回你的上一步，并一起收回对手的回应。提示会标出一个可通关的落点。
            </span>
          </li>
        </ol>
        <div className="tbg-tip">
          <b>花园观察笔记</b>
          <p>{config.hint}</p>
        </div>
        <p className="tbg-keyboard">
          键盘：Tab 选择列，Enter / 空格落子。无需拖动，没有计时压力。
        </p>
      </aside>
    </div>
  );
}
