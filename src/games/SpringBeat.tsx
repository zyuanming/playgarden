// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  findMove,
  initialFrame,
  impulse,
  moveNames,
  moves,
  project,
  wins,
  type Frame,
  type Gate,
  type Move,
  type SpringBoard,
} from "./springBeatLogic";
import { springBeatLevels } from "./springBeatLevels";
import "./springBeat.css";

const intro = "先选推法，预览下一拍的位置和速度。";
const victory = "在目标拍同时对准了位置和速度！";
const signs = { L: "←", W: "·", R: "→" };
const direction = (v: number) => (v < 0 ? "←" : v > 0 ? "→" : "■");
const signed = (v: number) =>
  v > 0 ? "+" + v : v < 0 ? "−" + Math.abs(v) : "0";
const windowText = ([, lo, hi]: Gate) =>
  lo === hi ? signed(lo) : signed(lo) + " 至 " + signed(hi);
const railPosition = (x: number, extent: number) => 240 + (x * 187) / extent;
function coilPath(to: number) {
  const start = 25,
    end = Math.max(start + 7, to - 14),
    width = end - start;
  const kinks = Array.from(
    { length: 16 },
    (_, i) => start + (width * (i + 1)) / 17 + " " + (i % 2 === 0 ? 47 : 55),
  );
  return "M" + start + " 51L" + kinks.join(" ") + " " + end + " 51";
}
const stamp = (s: Frame) => [s.x, s.v, s.left, s.right].join(",");
type History = { frame: Frame; move?: Move };
type Motion = { x: number; afterKick: number };

export default function SpringBeat(props: GameProps) {
  return <Round key={props.level + ":" + props.resetToken} {...props} />;
}

function Round({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const board = springBeatLevels[level] ?? springBeatLevels[0];
  const [history, setHistory] = useState<History[]>(() => [
    { frame: initialFrame(board) },
  ]);
  const [selected, setSelected] = useState<Move | null>(null);
  const [motion, setMotion] = useState<Motion | null>(null);
  const [message, setMessage] = useState(intro);
  const live = useRef({ onComplete, onStatus });
  live.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken });
  const { frame: state } = history[history.length - 1];
  const ended = state.beat === board.beats;
  const won = wins(board, state);
  const locked = paused || ended;
  const draft = selected ? project(board, state, selected) : null;
  const nextGate = board.gates.find((g) => g[0] === state.beat + 1);
  const ready = state.x === board.goal[0] && state.v === board.goal[1];

  function report(s: string) {
    setMessage(s);
    live.current.onStatus(s);
  }
  useEffect(() => {
    live.current.onStatus(intro);
  }, []);
  useEffect(() => {
    if (paused) setMotion(null);
  }, [paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || won) return;
    const next = findMove(board, state);
    report(
      next
        ? "可以先「" + moveNames[next] + "」，仍有路线到达目标。"
        : "从当前状态已无法在目标拍达标。试试撤销。",
    );
  }, [hintToken, paused, won, board, state]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused || won) return;
    setSelected(null);
    setMotion(null);
    if (!state.beat) {
      report("没有可撤销的拍，已清空预览。");
      return;
    }
    setHistory(history.slice(0, -1));
    report("已退回上一拍，位置、速度和推力都已恢复。");
  }, [undoToken, paused, won, state, history]);

  function select(move: Move) {
    if (locked) return;
    setSelected(move);
    setMessage("已选择「" + moveNames[move] + "」，尚未前进。");
  }
  function apply() {
    if (locked || !selected || !draft || draft.error) return;
    const next = draft.frame;
    setMotion({ x: state.x, afterKick: state.v + impulse[selected] });
    setHistory([...history, { frame: next, move: selected }]);
    setSelected(null);
    if (wins(board, next)) {
      report(victory);
      live.current.onComplete();
    } else if (next.beat === board.beats) {
      report(
        next.x === board.goal[0]
          ? "位置对了，速度不对。撤销后再试。"
          : "目标拍到了，位置不对。撤销后再试。",
      );
    } else if (next.x === board.goal[0] && next.v === board.goal[1]) {
      report("位置和速度已对上，但还没到目标拍。");
    } else report("已前进到第 " + next.beat + " 拍。");
  }
  const gateError = draft?.error === "gate" && draft.gate;
  return (
    <div
      className="puzzle-layout sb-game"
      data-sb-id={board.id}
      data-sb-beat={state.beat}
      data-sb-state={stamp(state)}
      data-sb-projection={draft ? stamp(draft.frame) : ""}
      data-sb-error={draft?.error ?? ""}
      data-sb-history={history
        .slice(1)
        .map((entry) => entry.move)
        .join("")}
      data-sb-won={won}
    >
      <section className="sb-studio" aria-label="弹簧操作台">
        <header className="sb-title">
          <div>
            <small>振动实验 · 第 {level + 1} 关</small>
            <h3>{board.title}</h3>
          </div>
          <b>
            第 {state.beat} / {board.beats} 拍
          </b>
        </header>
        <div className="sb-readings">
          <div className="sb-now">
            <small>当前</small>
            <span>
              位置 <b>{signed(state.x)}</b>
            </span>
            <span>
              速度{" "}
              <b>
                {direction(state.v)} {signed(state.v)}
              </b>
            </span>
          </div>
          <div className="sb-target">
            <small>第 {board.beats} 拍目标</small>
            <span>
              位置 <b>{signed(board.goal[0])}</b>
            </span>
            <span>
              速度{" "}
              <b>
                {direction(board.goal[1])} {signed(board.goal[1])}
              </b>
            </span>
          </div>
        </div>
        <Rail
          board={board}
          state={state}
          ghost={draft?.frame.x}
          gate={nextGate}
          blocked={Boolean(draft?.error)}
          motion={paused ? null : motion}
        />
        <div className="sb-rail-key">
          <span>■ 小车</span>
          <span>◇ 预览落点</span>
          <span>▭ 当拍门区</span>
          <span>速度 0 = 停住</span>
        </div>
        <ol className="sb-beats" aria-label="各拍的门区和目标">
          {Array.from({ length: board.beats }, (_, i) => {
            const beat = i + 1,
              gate = board.gates.find((g) => g[0] === beat),
              previous = history[beat]?.move;
            return (
              <li
                key={beat}
                data-next={beat === state.beat + 1}
                data-past={Boolean(previous)}
                data-gate={Boolean(gate)}
              >
                <b>{beat}</b>
                <span>
                  {previous
                    ? signs[previous]
                    : gate
                      ? "门"
                      : beat === board.beats
                        ? "终"
                        : "·"}
                </span>
                {gate && <small>{windowText(gate)}</small>}
              </li>
            );
          })}
        </ol>
        <div className="sb-controls" role="group" aria-label="选推力或等待">
          {moves.map((move) => (
            <button
              key={move}
              type="button"
              data-sb-action={move}
              aria-pressed={selected === move}
              disabled={locked}
              onClick={() => select(move)}
            >
              <span aria-hidden="true">{signs[move]}</span>
              {moveNames[move]}
              <small>
                {move === "W"
                  ? "不推 · 不耗"
                  : "剩 " + (move === "L" ? state.left : state.right) + " 次"}
              </small>
            </button>
          ))}
        </div>
        <div className="sb-preview" data-error={Boolean(draft?.error)}>
          {draft ? (
            <>
              <b>
                下一拍 · 位置 {signed(draft.frame.x)} · 速度{" "}
                {direction(draft.frame.v)} {signed(draft.frame.v)}
              </b>
              <span>
                {draft.error === "stock"
                  ? "该方向推力已用完，不能前进。"
                  : gateError
                    ? "未通过第 " +
                      gateError[0] +
                      " 拍：落点需在 " +
                      windowText(gateError) +
                      "。"
                    : draft.gate
                      ? "落点在门区内，可以前进。"
                      : "只预览；确认后才前进并消耗推力。"}
              </span>
            </>
          ) : (
            <>
              <b>{ended ? "该轮已结束" : "先选下一拍的动作"}</b>
              <span>
                {nextGate
                  ? "第 " +
                    nextGate[0] +
                    " 拍有门，落点需在 " +
                    windowText(nextGate) +
                    "。"
                  : !ended && ready
                    ? "当前已对准目标，仍要等到指定拍。"
                    : "同时留意位置和速度的方向。"}
              </span>
            </>
          )}
        </div>
        <button
          className="sb-apply"
          type="button"
          disabled={locked || !draft || Boolean(draft.error)}
          onClick={apply}
        >
          推进一拍
        </button>
        <p className="sb-status" role="status">
          {paused ? "已暂停。" : won ? victory : message}
        </p>
      </section>
      <aside className="game-notes">
        <span className="mini-label">振动 · 速度 · 时间窗口</span>
        <h3>经过中心，不等于停在中心。</h3>
        <ol>
          <li>
            推力先改变速度，然后小车走过四分之一周期。「等一拍」是不推，小车仍会运动。
          </li>
          <li>
            门区只在指定拍检查落点，不是途中会撞上的墙。不合格的预览不会花掉推力。
          </li>
          <li>
            只在最后一拍检查目标，位置和带方向的速度都要对上。用 Tab
            与空格也能操作。
          </li>
        </ol>
        <p>这是无摩擦理想弹簧。速度使用适合这条轨道的归一化单位。</p>
      </aside>
    </div>
  );
}

function Rail({
  board,
  state,
  gate,
  ghost,
  blocked,
  motion,
}: {
  board: SpringBoard;
  state: Frame;
  gate?: Gate;
  ghost?: number;
  blocked: boolean;
  motion: Motion | null;
}) {
  const cart = useRef<SVGGElement | null>(null);
  const coil = useRef<SVGPathElement | null>(null);
  const extent = Math.max(
    3,
    Math.ceil(Math.hypot(...board.start) + board.stock[0] + board.stock[1]),
  );
  const at = (x: number) => railPosition(x, extent);
  useLayoutEffect(() => {
    const node = cart.current;
    if (!node) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let pending = 0;
    const place = (x: number) => {
      const location = railPosition(x, extent);
      node.setAttribute("transform", "translate(" + location + " 51)");
      coil.current?.setAttribute("d", coilPath(location));
    };
    const settle = () => {
      cancelAnimationFrame(pending);
      place(state.x);
      node.setAttribute(
        "data-sb-motion",
        media.matches ? "reduced" : "settled",
      );
    };
    media.addEventListener("change", settle);
    if (!motion || media.matches || (motion.x === 0 && motion.afterKick === 0))
      settle();
    else {
      node.setAttribute("data-sb-motion", "moving");
      place(motion.x);
      const start = performance.now();
      const tick = (now: number) => {
        const fraction = Math.max(0, (now - start) / 420);
        if (fraction >= 1) {
          settle();
          return;
        }
        const s = (fraction * Math.PI) / 2;
        place(motion.x * Math.cos(s) + motion.afterKick * Math.sin(s));
        pending = requestAnimationFrame(tick);
      };
      pending = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(pending);
      media.removeEventListener("change", settle);
    };
  }, [state.x, motion, extent]);
  const distance = Math.sign(state.v) * (18 + Math.abs(state.v) * 4);
  const step = extent > 4 ? 2 : 1;
  const ticks = Array.from(
    { length: 1 + 2 * Math.floor(extent / step) },
    (_, i) => (i - Math.floor(extent / step)) * step,
  );
  return (
    <svg
      className="sb-rail"
      viewBox="0 0 480 100"
      role="img"
      aria-label={
        "弹簧轨道，位置 " + signed(state.x) + "，速度 " + signed(state.v)
      }
    >
      <rect
        x="1"
        y="1"
        width="478"
        height="98"
        rx="13"
        fill="#fafcfb"
        stroke="#c4d9d6"
      />
      <path
        d="M25 62H455"
        stroke="#779b9b"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {ticks.map((tick) => (
        <g key={tick} fill="#3d6464" fontSize="15" textAnchor="middle">
          <path
            d={"M" + at(tick) + " 64v8"}
            stroke={tick === 0 ? "#215c60" : "#a1b6b5"}
            strokeWidth={tick === 0 ? 3 : 2}
          />
          <text x={at(tick)} y="91">
            {signed(tick)}
          </text>
        </g>
      ))}
      {gate && (
        <rect
          x={at(gate[1]) - 10}
          y="37"
          width={at(gate[2]) - at(gate[1]) + 20}
          height="29"
          rx="6"
          fill="#d6eee7"
          stroke="#308475"
          strokeWidth="2"
        />
      )}
      <path
        ref={coil}
        d={coilPath(at(state.x))}
        fill="none"
        stroke="#557c7b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="25" cy="51" r="4" fill="#557c7b" />
      {ghost !== undefined && (
        <path
          data-sb-ghost={ghost}
          transform={"translate(" + at(ghost) + " 26)"}
          d="M0-8 8 0 0 8-8 0Z"
          fill={blocked ? "#ffece2" : "#fff7cf"}
          stroke={blocked ? "#a23d2b" : "#966a17"}
          strokeWidth="3"
          strokeDasharray="3 2"
        />
      )}
      <g ref={cart} transform={"translate(" + at(state.x) + " 51)"}>
        <rect x="-14" y="-8" width="28" height="15" rx="3" fill="#24566f" />
        <circle cx="-8" cy="9" r="4" fill="#183c4d" />
        <circle cx="8" cy="9" r="4" fill="#183c4d" />
        {state.v === 0 ? (
          <rect x="-3" y="-18" width="6" height="6" rx="1" fill="#3e7e79" />
        ) : (
          <path
            d={
              "M0 -15H" +
              distance +
              "m" +
              -Math.sign(distance) * 6 +
              " -4 " +
              Math.sign(distance) * 6 +
              " 4 " +
              -Math.sign(distance) * 6 +
              " 4"
            }
            fill="none"
            stroke="#235a73"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </g>
    </svg>
  );
}
