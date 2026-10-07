// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { GameProps } from "../lib/types";
import {
  createSnake,
  startSnake,
  turnSnake,
  stepSnake,
  snakeInterval,
  SIZE,
  type SnakeState,
  type Direction,
} from "../vendor/snake/core";
import { loadSnake, saveSnake } from "./snakeStorage";
import "./snakeGarden.css";
const arrows = ["↑", "→", "↓", "←"];
const names = ["向上", "向右", "向下", "向左"];
const keyDirection: Record<string, Direction> = {
  ArrowUp: 0,
  ArrowRight: 1,
  ArrowDown: 2,
  ArrowLeft: 3,
  w: 0,
  d: 1,
  s: 2,
  a: 3,
};
export default function SnakeGarden({
  paused,
  freshStart = false,
  hintToken,
  onStatus,
}: GameProps) {
  const [loaded] = useState(loadSnake);
  const [state, setState] = useState<SnakeState>(() =>
    !freshStart && loaded.state
      ? loaded.state
      : createSnake(Math.floor(Math.random() * 0x100000000)),
  );
  const [best, setBest] = useState(() => Math.max(loaded.best, state.score));
  const [available, setAvailable] = useState(loaded.available);
  const [localPause, setLocalPause] = useState(state.phase === "playing");
  const [hidden, setHidden] = useState(document.hidden);
  const board = useRef<HTMLDivElement>(null);
  const live = useRef(state),
    pointer = useRef<{ id: number; x: number; y: number } | null>(null),
    status = useRef(onStatus);
  status.current = onStatus;
  const blocked = paused || localPause || hidden;
  function commit(next: SnakeState) {
    live.current = next;
    setState(next);
  }
  useEffect(() => {
    const result = saveSnake(state, best);
    if (result.best !== best) setBest(result.best);
    setAvailable(result.available);
  }, [state, best]);
  useEffect(() => {
    const hide = () => {
      setHidden(document.hidden);
      if (document.hidden) {
        setLocalPause(true);
        commit({ ...live.current, queue: [] });
        pointer.current = null;
      }
    };
    const blur = () => {
      setLocalPause(true);
      commit({ ...live.current, queue: [] });
      pointer.current = null;
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", blur);
    };
  }, []);
  useEffect(() => {
    if (blocked) {
      if (live.current.queue.length) commit({ ...live.current, queue: [] });
      pointer.current = null;
    }
  }, [blocked]);
  useEffect(() => {
    if (blocked || state.phase !== "playing") return;
    let frame = 0,
      last: number | undefined,
      elapsed = 0;
    const tick = (now: number) => {
      if (last !== undefined) {
        elapsed += Math.min(now - last, 250);
        let next = live.current;
        let steps = 0;
        while (
          next.phase === "playing" &&
          elapsed >= snakeInterval(next.score) &&
          steps++ < 2
        ) {
          elapsed -= snakeInterval(next.score);
          next = stepSnake(next);
        }
        if (next !== live.current) commit(next);
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [blocked, state.phase]);
  useEffect(() => {
    status.current(
      state.phase === "dead"
        ? state.reason === "wall"
          ? "撞到边界了，试试提前转弯。"
          : "碰到自己的身体了，给尾巴留条路。"
        : state.phase === "won"
          ? "整片花园都走满了！"
          : state.phase === "ready"
            ? "吃到果实会长一格，不能直接掉头。按开始，再用方向键或滑动转向。"
            : "提前规划转弯，果实越多，身体越长。",
    );
  }, [state.phase, hintToken]);
  function turn(d: Direction) {
    if (!blocked) commit(turnSnake(live.current, d));
  }
  function begin() {
    if (paused || hidden) return;
    if (live.current.phase === "ready") commit(startSnake(live.current));
    setLocalPause(false);
    board.current?.focus({ preventScroll: true });
  }
  function restart() {
    if (paused || hidden) return;
    setLocalPause(false);
    commit(createSnake(Math.floor(Math.random() * 0x100000000)));
    board.current?.focus({ preventScroll: true });
  }
  function pointerEnd(e: PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    pointer.current = null;
    if (!p || p.id !== e.pointerId || blocked) return;
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0);
  }
  const ended = state.phase === "dead" || state.phase === "won";
  const overlay = blocked || state.phase !== "playing";
  return (
    <section
      className="snake-garden"
      data-snake-phase={state.phase}
      data-snake-head={state.body[0]}
      data-snake-direction={state.direction}
      data-snake-food={state.food ?? ""}
      data-snake-score={state.score}
      data-snake-best={best}
      data-snake-length={state.body.length}
      data-snake-paused={blocked}
    >
      <header className="snake-intro">
        <span>GARDEN TRAIL</span>
        <h2>留一条路给自己</h2>
        <p>吃果实，慢慢长大。每一次转弯，都给下一步留点空间。</p>
      </header>
      <div className="snake-stats">
        <div>
          <small>本局果实</small>
          <b>{state.score}</b>
        </div>
        <div>
          <small>本机最高</small>
          <b>{best}</b>
        </div>
        <div>
          <small>身体长度</small>
          <b>{state.body.length}</b>
        </div>
      </div>
      <div
        ref={board}
        className="snake-board"
        role="group"
        aria-label="贪吃蛇游戏区，方向键或滑动转向"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
          const d = keyDirection[e.key];
          if (d !== undefined) {
            e.preventDefault();
            turn(d);
          } else if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            if (state.phase === "ready" || localPause) begin();
            else if (!ended && !paused && !hidden) setLocalPause(true);
          }
        }}
        onPointerDown={(e) => {
          if (blocked || ended || state.phase === "ready") return;
          pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          e.currentTarget.focus({ preventScroll: true });
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={pointerEnd}
        onPointerCancel={() => {
          pointer.current = null;
        }}
      >
        <div className="snake-grid" aria-hidden="true" />
        {state.food !== null && (
          <div
            className="snake-fruit"
            style={{
              left: `${((state.food % SIZE) / SIZE) * 100}%`,
              top: `${(Math.floor(state.food / SIZE) / SIZE) * 100}%`,
            }}
            aria-label="果实"
          >
            <span />
          </div>
        )}
        {state.body.map((cell, i) => (
          <div
            key={i}
            className={`snake-segment ${i === 0 ? "snake-head" : ""} ${ended ? "snake-ended" : ""}`}
            style={{
              left: `${((cell % SIZE) / SIZE) * 100}%`,
              top: `${(Math.floor(cell / SIZE) / SIZE) * 100}%`,
              zIndex: state.body.length - i,
            }}
            data-snake-cell={cell}
            aria-hidden="true"
          >
            {i === 0 && (
              <span className={`snake-eyes dir-${state.direction}`}>
                <i />
                <i />
              </span>
            )}
          </div>
        ))}
        {overlay && (
          <div className="snake-overlay">
            <strong>
              {blocked
                ? "稍作停留"
                : state.phase === "dead"
                  ? "转弯晚了一点"
                  : state.phase === "won"
                    ? "花园走满了！"
                    : "第一颗果实，在前面"}
            </strong>
            <span>
              {blocked
                ? "准备好，再继续"
                : ended
                  ? `这次收获 ${state.score} 颗果实`
                  : "边走边长大，别碰到边界和自己"}
            </span>
            {!paused && !hidden && (
              <button onClick={ended ? restart : begin}>
                {ended ? "再来一局" : localPause ? "继续" : "开始"}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="snake-actions">
        <div className="snake-directions" aria-label="方向控制">
          {([0, 3, 2, 1] as Direction[]).map((d) => (
            <button
              key={d}
              className={`snake-dir-${d}`}
              aria-label={names[d]}
              disabled={blocked || state.phase !== "playing"}
              onClick={() => turn(d)}
            >
              {arrows[d]}
            </button>
          ))}
        </div>
        <button
          className="snake-pause"
          onClick={() => (localPause ? begin() : setLocalPause(true))}
          disabled={paused || hidden || state.phase !== "playing"}
        >
          {localPause ? "继续前进" : "暂停一下"}
        </button>
        <span className="snake-queue" aria-live="off">
          {state.queue.length
            ? `接下来 ${state.queue.map((d) => arrows[d]).join(" ")}`
            : "方向键 / 滑动 / 按钮"}
        </span>
      </div>
      {!available && (
        <p className="snake-storage-warning" role="status">
          浏览器暂时无法保存，仍可继续玩；本次记录可能无法保留。
        </p>
      )}
    </section>
  );
}
