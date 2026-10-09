// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  riverPongLevels,
  initialPong,
  servePong,
  pongStep,
  clampPaddle,
} from "./riverPongLogic";
import "./riverPong.css";
export default function RiverPong(p: GameProps) {
  return <PongRound key={`${p.level}:${p.resetToken}`} {...p} />;
}
function PongRound({
  level,
  paused,
  hintToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = riverPongLevels[level] ?? riverPongLevels[0],
    [state, setState] = useState(initialPong),
    [message, setMessage] = useState(config.lesson);
  const live = useRef(state);
  live.current = state;
  const pause = useRef(paused);
  pause.current = paused;
  const board = useRef<HTMLDivElement>(null),
    callbacks = useRef({ onComplete, onStatus }),
    done = useRef(false),
    seenHint = useRef(hintToken);
  callbacks.current = { onComplete, onStatus };
  const ended = state.phase === "won" || state.phase === "lost";
  function report(t: string) {
    setMessage(t);
    callbacks.current.onStatus(t);
  }
  function commit(next: typeof state) {
    live.current = next;
    setState(next);
  }
  useEffect(() => {
    callbacks.current.onStatus(config.lesson);
  }, []);
  useEffect(() => {
    if (paused || state.phase !== "play") return;
    let id = 0,
      last = 0;
    const frame = (now: number) => {
      if (pause.current || live.current.phase !== "play") return;
      if (last) commit(pongStep(config, live.current, (now - last) / 1000));
      last = now;
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [paused, state.phase, config]);
  useEffect(() => {
    if (state.phase === "won" && !paused && !done.current) {
      done.current = true;
      report(`你先拿到 ${config.target} 分，河畔小局获胜！`);
      callbacks.current.onComplete();
    } else if (state.phase === "lost")
      report("这局由对面先到终点分数。重来可以再练，没有次数限制。");
    else if (state.phase === "between")
      report(
        state.last === "player"
          ? "你得一分！摆好球拍，准备下一次发球。"
          : "对面得一分。先看落点，准备下一球。",
      );
  }, [state.phase, paused]);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (paused || ended) return;
    report(
      "先接稳，再变线。触屏在下方场地横向点按或拖动；拍面中间会直弹，两侧会斜弹。虚线中点只是装饰，球会一直飞过。",
    );
  }, [hintToken]);
  function move(x: number) {
    if (
      pause.current ||
      live.current.phase === "won" ||
      live.current.phase === "lost" ||
      !Number.isFinite(x)
    )
      return;
    commit({ ...live.current, paddle: clampPaddle(x, config.playerWidth) });
  }
  function pointer(x: number) {
    const box = board.current?.getBoundingClientRect();
    if (box) move(((x - box.left) / box.width) * 360);
  }
  function serve() {
    if (paused || ended) return;
    commit(servePong(config, live.current));
  }
  return (
    <div
      className="rp-game"
      data-river-pong-game
      data-pong-phase={state.phase}
      data-pong-ball={JSON.stringify({
        x: state.x,
        y: state.y,
        vx: state.vx,
        vy: state.vy,
      })}
      data-pong-paddle={state.paddle}
      data-pong-score={`${state.playerScore}:${state.aiScore}`}
    >
      <section className="rp-court">
        <header>
          <div>
            <span>RIVERSIDE RALLY</span>
            <h3>{config.title}</h3>
          </div>
          <b>
            {state.playerScore}
            <small> : </small>
            {state.aiScore}
          </b>
        </header>
        <div className="rp-meter">
          <span>先得 {config.target} 分</span>
          <span>你在下方 · 对面在上方</span>
        </div>
        <div
          ref={board}
          className="rp-board"
          tabIndex={0}
          role="group"
          aria-label="乒乓场地，左右键移动，空格发球"
          onPointerDown={(e) => {
            if (e.isPrimary) {
              e.currentTarget.setPointerCapture(e.pointerId);
              pointer(e.clientX);
            }
          }}
          onPointerMove={(e) => {
            if (e.pointerType === "mouse" || e.buttons) pointer(e.clientX);
          }}
          onKeyDown={(e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              move(live.current.paddle + (e.key === "ArrowLeft" ? -18 : 18));
            } else if (e.key === " " && !e.repeat) {
              e.preventDefault();
              serve();
            }
          }}
        >
          <svg
            viewBox="0 0 360 460"
            role="img"
            aria-label={`你 ${state.playerScore} 分，对面 ${state.aiScore} 分`}
          >
            <defs>
              <linearGradient id="pong-water" x2="0" y2="1">
                <stop stopColor="#cde4de" />
                <stop offset="1" stopColor="#edf1d4" />
              </linearGradient>
            </defs>
            <rect width="360" height="460" rx="22" fill="url(#pong-water)" />
            <rect
              x="8"
              y="8"
              width="344"
              height="444"
              rx="17"
              fill="none"
              stroke="#8daf9c"
              strokeWidth="2"
            />
            <path
              d="M14 230h332"
              stroke="#fafbf0"
              strokeWidth="3"
              strokeDasharray="8 10"
            />
            <circle
              cx="180"
              cy="230"
              r="40"
              fill="none"
              stroke="#fafbf099"
              strokeWidth="2"
            />
            <g fill="#ffffff44">
              <path
                d="M20 115Q90 90 150 115T340 115"
                fill="none"
                stroke="#fff6"
                strokeWidth="3"
              />
              <path
                d="M20 342Q90 320 150 342T340 342"
                fill="none"
                stroke="#fff6"
                strokeWidth="3"
              />
            </g>
            <rect
              x={state.ai - config.aiWidth / 2}
              y="27"
              width={config.aiWidth}
              height="14"
              rx="7"
              fill="#9a8cae"
              stroke="#766389"
              strokeWidth="2"
            />
            <rect
              x={state.paddle - config.playerWidth / 2}
              y="419"
              width={config.playerWidth}
              height="14"
              rx="7"
              fill="#5f8b73"
              stroke="#3e6b58"
              strokeWidth="2"
            />
            <circle
              cx={state.x}
              cy={state.y}
              r="6"
              fill="#fff7d1"
              stroke="#b69451"
              strokeWidth="2"
            />
            <text
              x="180"
              y="451"
              textAnchor="middle"
              fontSize="10"
              fill="#547e66"
            >
              在场地上横向点按或拖动
            </text>
            {paused && (
              <g>
                <rect
                  x="84"
                  y="199"
                  width="192"
                  height="61"
                  rx="18"
                  fill="#fffceded"
                />
                <text
                  x="180"
                  y="238"
                  textAnchor="middle"
                  fontSize="23"
                  fill="#6c8062"
                >
                  已暂停
                </text>
              </g>
            )}
          </svg>
        </div>
        <button
          type="button"
          className="rp-serve"
          disabled={paused || ended || state.phase === "play"}
          onClick={serve}
        >
          {state.phase === "ready"
            ? "开始发球"
            : state.phase === "between"
              ? "下一球"
              : state.phase === "won"
                ? "本局获胜"
                : state.phase === "lost"
                  ? "本局结束"
                  : "球在场上"}
        </button>
        <p className="rp-message" role="status">
          {message}
        </p>
      </section>
      <aside className="rp-notes">
        <span>移动 · 预判 · 变线</span>
        <h3>
          这一拍，
          <br />
          打向新的方向。
        </h3>
        <p>{config.lesson}</p>
        <ol>
          <li>控制下方绿色球拍，挡住飞来的小球。</li>
          <li>球碰到球拍边缘会斜着反弹，碰到边墙也会反弹。</li>
          <li>穿过对方底线得一分。先到目标分数获胜。</li>
        </ol>
        <p>
          对面使用速度有限的本地追球程序。它不会读取你的按键或偷偷传送，也不会故意漏掉指定的球。
        </p>
        <details>
          <summary>触屏、键盘与暂停</summary>
          <p>
            在场地上横向点按或拖动，就能移动球拍。鼠标移入场地会跟随横向位置。Tab
            聚焦场地后，用左右方向键移动，空格发球。暂停会冻结全部运动；继续时不会补走时间。实时球局不能撤销，重来会清空比分。
          </p>
        </details>
        <p>没有倒计时。每一分之后等待你再次发球。</p>
      </aside>
    </div>
  );
}
