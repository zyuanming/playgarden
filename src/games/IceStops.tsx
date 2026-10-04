// SPDX-License-Identifier: MIT
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import { iceStopsLevels } from "./iceStopsLevels";
import {
  ICE_DIRECTIONS,
  ICE_LABELS,
  createIceState,
  iceHint,
  iceStep,
  iceWon,
  moveIce,
  undoIce,
  type IceDirection,
  type IceMove,
} from "./iceStopsLogic";
import "./iceStops.css";
export default function IceStops(props: GameProps) {
  return <IceRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function IceRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = iceStopsLevels[level] ?? iceStopsLevels[0];
  const [state, setState] = useState(() => createIceState(config));
  const [selected, setSelected] = useState(0);
  const [hint, setHint] = useState<IceMove | null>(null);
  const [feedback, setFeedback] = useState(
    "选中 A、B 或 C，再选择方向。冰盘会滑到墙或另一枚冰盘前。目标格不会让它停下。",
  );
  const tokens = useRef({ hintToken, undoToken }),
    notified = useRef(false),
    viewport = useRef<HTMLDivElement>(null),
    pucks = useRef<(HTMLButtonElement | null)[]>([]);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const won = iceWon(config, state.positions),
    locked = paused || won,
    width = config.rows[0].length;
  useLayoutEffect(() => {
    // Moving the same focused DOM button does not trigger native focus scrolling.
    // Reveal only inside the board; never scroll the document or move focus.
    const outer = viewport.current,
      puck = pucks.current[selected];
    if (!outer || !puck) return;
    const bounds = outer.getBoundingClientRect(),
      item = puck.getBoundingClientRect();
    if (item.left < bounds.left + 6)
      outer.scrollLeft -= bounds.left + 6 - item.left;
    else if (item.right > bounds.right - 6)
      outer.scrollLeft += item.right - bounds.right + 6;
  }, [selected, state.positions]);
  useEffect(() => {
    if (!paused) callbacks.current.onStatus(feedback);
  }, [feedback, paused]);
  useEffect(() => {
    if (!paused && won && !notified.current) {
      notified.current = true;
      setFeedback(`三枚冰盘全部归位！共 ${state.history.length} 次滑动。`);
      callbacks.current.onComplete();
    }
  }, [won, paused, state.history.length]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked) return;
    const next = iceHint(config, state.positions);
    setFeedback(next.text);
    setHint(next.move);
    if (next.move) setSelected(next.move.puck);
  }, [hintToken, locked, config, state.positions]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    setState((current) => undoIce(config, current));
    setHint(null);
    setFeedback(
      state.history.length
        ? "已撤销上一次完整滑动。"
        : "还没有可以撤销的滑动。",
    );
  }, [undoToken, locked, config, state.history.length]);
  function move(direction: IceDirection) {
    if (locked) return;
    const action = { puck: selected, direction },
      next = iceStep(config, state.positions, action);
    setHint(null);
    if (!next) {
      setFeedback("这个方向紧贴挡点，不能移动。试试另一枚冰盘或其他方向。");
      return;
    }
    setState((current) => moveIce(config, current, action));
    setFeedback(
      `${"ABC"[selected]} 向${ICE_LABELS[direction]}滑到了第 ${Math.floor(next[selected] / width) + 1} 行第 ${(next[selected] % width) + 1} 列。`,
    );
  }
  return (
    <div
      className="puzzle-layout ice-game"
      data-game="ice-stops"
      data-ice-won={won}
    >
      <section className="ice-playfield" aria-label="冰盘停靠棋盘">
        <header className="ice-heading">
          <div>
            <span className="mini-label">ICE STOPS · {level + 1} / 12</span>
            <h3>{config.title}</h3>
          </div>
          <span className="ice-emblem" aria-hidden="true">
            ❄
          </span>
        </header>
        <div className="ice-stats">
          <span>
            <b data-ice-moves>{state.history.length}</b> 次滑动
          </span>
          <span>
            {
              state.positions.filter((cell, i) => cell === config.goals[i])
                .length
            }{" "}
            / 3 归位
          </span>
        </div>
        <div
          className="ice-goal-legend"
          aria-label="三个冰盘的固定目标"
          data-ice-goal-legend
        >
          {config.goals.map((cell, puck) => (
            <span
              key={puck}
              className={`ice-color-${puck}`}
              data-ice-goal={puck}
            >
              <b>{"ABC"[puck]} 目标</b>第 {Math.floor(cell / width) + 1} 行 · 第{" "}
              {(cell % width) + 1} 列
            </span>
          ))}
        </div>
        <p className="ice-scroll-help" id="ice-scroll-help">
          窄屏可左右滑动冰面；所选冰盘移动后会保持在可见区域。
        </p>
        <div className="ice-scroll" ref={viewport} data-ice-viewport>
          <div
            className="ice-board"
            style={{ "--ice-columns": width } as CSSProperties}
            role="group"
            aria-describedby="ice-scroll-help"
            tabIndex={0}
            aria-label={`${config.rows.length} 行 ${width} 列冰面。数字 1、2、3 选冰盘，方向键滑动。`}
            onKeyDown={(event) => {
              if (event.ctrlKey || event.metaKey || event.altKey) return;
              const direction = (
                {
                  ArrowUp: "N",
                  ArrowRight: "E",
                  ArrowDown: "S",
                  ArrowLeft: "W",
                } as Record<string, IceDirection>
              )[event.key];
              if (direction || /^[123]$/.test(event.key)) {
                event.preventDefault();
                if (locked) return;
                if (direction) move(direction);
                else {
                  setSelected(Number(event.key) - 1);
                  setHint(null);
                }
              }
            }}
          >
            {config.rows.flatMap((row, y) =>
              [...row].map((cell, x) => {
                const index = y * width + x,
                  goal = config.goals.indexOf(index);
                return (
                  <div
                    key={index}
                    role="img"
                    className={`ice-cell ${cell === "#" ? "ice-rock" : ""} ${goal >= 0 ? `ice-goal ice-color-${goal}` : ""}`}
                    style={{ gridRow: y + 1, gridColumn: x + 1 }}
                    aria-label={`第 ${y + 1} 行第 ${x + 1} 列，${cell === "#" ? "冰石墙" : goal >= 0 ? `${"ABC"[goal]} 目标` : "冰面"}`}
                  >
                    <span>
                      {cell === "#" ? "▰" : goal >= 0 ? `${"ABC"[goal]}⌖` : "·"}
                    </span>
                  </div>
                );
              }),
            )}
            {state.positions.map((cell, puck) => (
              <button
                type="button"
                key={puck}
                ref={(button) => {
                  pucks.current[puck] = button;
                }}
                data-ice-puck={puck}
                data-position={cell}
                disabled={locked}
                aria-pressed={selected === puck}
                aria-label={`冰盘 ${"ABC"[puck]}，第 ${Math.floor(cell / width) + 1} 行第 ${(cell % width) + 1} 列${config.goals.includes(cell) ? `，位于 ${"ABC"[config.goals.indexOf(cell)]} 目标${cell === config.goals[puck] ? "（自己的目标）" : "（另一枚冰盘的目标）"}` : ""}`}
                className={`ice-puck ice-color-${puck} ${selected === puck ? "ice-selected" : ""} ${hint?.puck === puck ? "ice-hinted" : ""}`}
                style={{
                  gridRow: Math.floor(cell / width) + 1,
                  gridColumn: (cell % width) + 1,
                }}
                onFocus={() => {
                  if (!locked) setSelected(puck);
                }}
                onClick={() => {
                  if (!locked) {
                    setSelected(puck);
                    setHint(null);
                  }
                }}
              >
                <b>{"ABC"[puck]}</b>
                <small>{cell === config.goals[puck] ? "到位" : "冰盘"}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="ice-controls" aria-label="滑动方向">
          <b>移动 {"ABC"[selected]}</b>
          {ICE_DIRECTIONS.map((direction) => (
            <button
              type="button"
              key={direction}
              data-ice-direction={direction}
              disabled={locked}
              className={
                hint?.puck === selected && hint.direction === direction
                  ? "ice-hint-button"
                  : ""
              }
              onClick={() => move(direction)}
            >
              {ICE_LABELS[direction]}
            </button>
          ))}
        </div>
        <p className="ice-feedback" role="status" data-ice-status>
          {paused ? "已暂停。冰面和目标保留，继续后再滑动。" : feedback}
        </p>
      </section>
      <aside className="ice-guide">
        <span className="mini-label">把同伴变成挡点</span>
        <h3>滑到底，才停下</h3>
        <p>{config.lesson}</p>
        <ol>
          <li>三枚冰盘分别回到 A、B、C 目标。</li>
          <li>每次沿直线滑到墙边，或另一枚冰盘前。</li>
          <li>经过目标不停下；到位后仍可再次滑动。</li>
        </ol>
        <div className="ice-keyboard">
          键盘：1 / 2 / 3 选盘，↑ → ↓ ← 滑动。也可以 Tab 选中冰盘，再用方向键。
        </div>
        <p>提示会从你现在的局面重新找路。每次滑到底算一步。</p>
      </aside>
    </div>
  );
}
