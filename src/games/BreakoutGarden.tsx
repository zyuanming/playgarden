// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  COURT,
  breakoutLevels,
  createBreakout,
  movePaddle,
  launchBreakout,
  stepBreakout,
  breakoutHint,
  type BreakoutState,
} from "./breakoutLogic";
import "./breakoutGarden.css";
export default function BreakoutGarden({
  level,
  paused,
  resetToken,
  hintToken,
  onStatus,
  onComplete,
}: GameProps) {
  const [state, setState] = useState(() => createBreakout(level));
  const live = useRef(state);
  const canvas = useRef<HTMLCanvasElement>(null);
  const keys = useRef({ left: false, right: false });
  const [hidden, setHidden] = useState(document.hidden);
  const [localPause, setLocalPause] = useState(false);
  const completed = useRef(false);
  const callbacks = useRef({ onStatus, onComplete });
  callbacks.current = { onStatus, onComplete };
  const frozen = paused || hidden || localPause;
  function commit(next: BreakoutState) {
    live.current = next;
    setState(next);
  }
  useEffect(() => {
    commit(createBreakout(level));
    completed.current = false;
    keys.current = { left: false, right: false };
    setLocalPause(false);
    callbacks.current.onStatus(breakoutHint(createBreakout(level)));
  }, [level, resetToken]);
  useEffect(() => {
    if (hintToken) callbacks.current.onStatus(breakoutHint(live.current));
  }, [hintToken]);
  useEffect(() => {
    const visibility = () => {
      setHidden(document.hidden);
      if (document.hidden) setLocalPause(true);
      keys.current = { left: false, right: false };
    };
    const blur = () => {
      keys.current = { left: false, right: false };
      setLocalPause(true);
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
    };
  }, []);
  useEffect(() => {
    if (frozen) {
      keys.current = { left: false, right: false };
      return;
    }
    let frame = 0,
      last: number | undefined;
    const tick = (now: number) => {
      if (last !== undefined) {
        const dt = Math.min((now - last) / 1000, 0.05);
        let next = live.current;
        const direction =
          Number(keys.current.right) - Number(keys.current.left);
        if (direction)
          next = movePaddle(next, next.paddle + direction * 400 * dt);
        next = stepBreakout(next, dt);
        if (next !== live.current) commit(next);
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [frozen, level, resetToken]);
  useEffect(() => {
    if (state.phase === "won" && !completed.current) {
      completed.current = true;
      callbacks.current.onStatus("全部砖块已清空，反弹挑战完成！");
      callbacks.current.onComplete();
    } else if (state.phase === "lost")
      callbacks.current.onStatus("三次机会用完了，点重来再挑战。");
  }, [state.phase]);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const scale = 2;
    c.width = COURT.width * scale;
    c.height = COURT.height * scale;
    ctx.scale(scale, scale);
    const gradient = ctx.createLinearGradient(0, 0, 0, 500);
    gradient.addColorStop(0, "#edf8f6");
    gradient.addColorStop(1, "#fff7e6");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 500);
    ctx.fillStyle = "#badbd1";
    for (let x = 16; x < 400; x += 24)
      for (let y = 18; y < 455; y += 24) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    for (const b of state.bricks) {
      if (!b.hp) continue;
      ctx.fillStyle =
        b.hp === 2
          ? "#386aa7"
          : ["#238271", "#db8056", "#8970a7"][Math.floor(b.id / 7) % 3];
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 5);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (b.hp > 1) ctx.fillText(String(b.hp), b.x + b.w / 2, b.y + b.h / 2);
    }
    ctx.fillStyle = "#203e40";
    ctx.beginPath();
    ctx.roundRect(
      state.paddle - COURT.paddleWidth / 2,
      COURT.paddleY,
      COURT.paddleWidth,
      COURT.paddleHeight,
      6,
    );
    ctx.fill();
    ctx.fillStyle = "#d3eee4";
    ctx.fillRect(state.paddle - 1, COURT.paddleY + 2, 2, 8);
    ctx.fillStyle = "#e46c3c";
    ctx.beginPath();
    ctx.arc(state.x, state.y, COURT.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "#c39873";
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(10, 492);
    ctx.lineTo(390, 492);
    ctx.stroke();
  }, [state]);
  function start() {
    if (!frozen) {
      const next = launchBreakout(live.current);
      if (next !== live.current)
        callbacks.current.onStatus(breakoutLevels[next.level].lesson);
      commit(next);
    }
  }
  const remaining = state.bricks.filter((b) => b.hp > 0).length;
  return (
    <section
      className="breakout-garden"
      data-breakout-phase={state.phase}
      data-breakout-x={state.x}
      data-breakout-y={state.y}
      data-breakout-vx={state.vx}
      data-breakout-vy={state.vy}
      data-breakout-paddle={state.paddle}
      data-breakout-lives={state.lives}
      data-breakout-score={state.score}
      data-breakout-won={state.phase === "won"}
    >
      <div className="breakout-heading">
        <span>BOUNCE GARDEN</span>
        <h2>{breakoutLevels[state.level].name}</h2>
        <p>{breakoutLevels[state.level].lesson}</p>
      </div>
      <div className="breakout-stats">
        <span>
          机会 <b>{state.lives}</b>
        </span>
        <span>
          剩余砖块 <b>{remaining}</b>
        </span>
        <span>
          得分 <b>{state.score}</b>
        </span>
      </div>
      <div
        className="breakout-stage"
        tabIndex={0}
        role="group"
        aria-label="反弹砖园游戏区，左右方向键移动，空格发球"
        onKeyDown={(e) => {
          if (e.ctrlKey || e.metaKey || e.altKey || frozen) return;
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            keys.current[e.key === "ArrowLeft" ? "left" : "right"] = true;
          }
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === "ArrowLeft") keys.current.left = false;
          if (e.key === "ArrowRight") keys.current.right = false;
        }}
        onBlur={() => {
          keys.current = { left: false, right: false };
        }}
        onPointerDown={(e) => {
          if (frozen) return;
          e.currentTarget.focus({ preventScroll: true });
          e.currentTarget.setPointerCapture(e.pointerId);
          const rect = e.currentTarget.getBoundingClientRect();
          commit(
            movePaddle(
              live.current,
              ((e.clientX - rect.left) / rect.width) * 400,
            ),
          );
        }}
        onPointerMove={(e) => {
          if (
            frozen ||
            keys.current.left ||
            keys.current.right ||
            (!e.buttons && e.pointerType !== "mouse")
          )
            return;
          const rect = e.currentTarget.getBoundingClientRect();
          commit(
            movePaddle(
              live.current,
              ((e.clientX - rect.left) / rect.width) * 400,
            ),
          );
        }}
        onPointerCancel={() => {
          keys.current = { left: false, right: false };
        }}
      >
        <canvas
          ref={canvas}
          aria-label={`反弹球场，剩余${remaining}块砖，${state.lives}次机会`}
        />
        {(frozen || state.phase !== "playing") && (
          <div className="breakout-overlay">
            <strong>
              {frozen
                ? "已暂停"
                : state.phase === "won"
                  ? "花园点亮了！"
                  : state.phase === "lost"
                    ? "再试一次？"
                    : "准备接球"}
            </strong>
            <span>
              {frozen
                ? "恢复后继续当前球局"
                : state.phase === "won"
                  ? "所有砖块已经清空"
                  : state.phase === "lost"
                    ? "点上方重来，再练习一次"
                    : "拖动挡板，点发球开始"}
            </span>
          </div>
        )}
      </div>
      <div className="breakout-controls">
        <button
          aria-label="挡板向左"
          disabled={frozen || state.phase === "won" || state.phase === "lost"}
          onPointerDown={() => {
            keys.current.left = true;
          }}
          onPointerUp={() => {
            keys.current.left = false;
          }}
          onPointerLeave={() => {
            keys.current.left = false;
          }}
          onPointerCancel={() => {
            keys.current.left = false;
          }}
          onClick={() => {
            if (!frozen)
              commit(movePaddle(live.current, live.current.paddle - 24));
          }}
        >
          ← 左移
        </button>
        <button onClick={start} disabled={frozen || state.phase !== "ready"}>
          发球
        </button>
        <button
          aria-label="挡板向右"
          disabled={frozen || state.phase === "won" || state.phase === "lost"}
          onPointerDown={() => {
            keys.current.right = true;
          }}
          onPointerUp={() => {
            keys.current.right = false;
          }}
          onPointerLeave={() => {
            keys.current.right = false;
          }}
          onPointerCancel={() => {
            keys.current.right = false;
          }}
          onClick={() => {
            if (!frozen)
              commit(movePaddle(live.current, live.current.paddle + 24));
          }}
        >
          右移 →
        </button>
        <button
          disabled={
            paused || hidden || state.phase === "won" || state.phase === "lost"
          }
          onClick={() => setLocalPause((p) => !p)}
        >
          {localPause ? "继续接球" : "暂停接球"}
        </button>
      </div>
      <p className="breakout-help">
        拖动或移动鼠标控制挡板，也可用左右方向键。球落到下方虚线外会减少一次机会。双击砖上的数字代表剩余击中次数。
      </p>
      <div className="breakout-brick-data" aria-hidden="true">
        {state.bricks
          .filter((b) => b.hp)
          .map((b) => (
            <span
              key={b.id}
              data-brick={b.id}
              data-x={b.x}
              data-y={b.y}
              data-hp={b.hp}
            />
          ))}
      </div>
    </section>
  );
}
