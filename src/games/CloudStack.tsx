// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  cloudStackLevels,
  stackMotion,
  stackOverlap,
  type StackFloor,
} from "./cloudStackLogic";
import "./cloudStack.css";
type TowerState = {
  floors: StackFloor[];
  x: number;
  direction: number;
  phase: "ready" | "moving" | "lost" | "won";
};
export default function CloudStack(p: GameProps) {
  return <TowerRound key={`${p.level}:${p.resetToken}`} {...p} />;
}
function TowerRound({
  level,
  paused,
  hintToken,
  onComplete,
  onStatus,
}: GameProps) {
  const lesson = cloudStackLevels[level] ?? cloudStackLevels[0];
  const [state, setState] = useState<TowerState>(() => ({
    floors: [{ x: (360 - lesson.width) / 2, width: lesson.width }],
    x: 0,
    direction: 1,
    phase: "ready",
  }));
  const live = useRef(state);
  live.current = state;
  const pauseState = useRef(paused);
  pauseState.current = paused;
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const done = useRef(false),
    seenHint = useRef(hintToken);
  const [message, setMessage] = useState(lesson.lesson);
  function report(text: string) {
    setMessage(text);
    callbacks.current.onStatus(text);
  }
  function commit(next: TowerState) {
    live.current = next;
    setState(next);
  }
  const top = state.floors.at(-1)!,
    height = state.floors.length - 1;
  useEffect(() => {
    callbacks.current.onStatus(lesson.lesson);
  }, []);
  useEffect(() => {
    if (paused || state.phase !== "moving") return;
    let id = 0,
      last = 0;
    const frame = (now: number) => {
      const current = live.current;
      if (current.phase !== "moving" || pauseState.current) return;
      if (last) {
        const top = current.floors.at(-1)!,
          motion = stackMotion(
            current.x,
            current.direction,
            top.width,
            lesson.speed + (current.floors.length - 1) * 3,
            (now - last) / 1000,
          );
        commit({ ...current, ...motion });
      }
      last = now;
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [paused, state.phase, lesson]);
  useEffect(() => {
    if (state.phase === "won" && !paused && !done.current) {
      done.current = true;
      report(`云端小楼完成了，${lesson.target} 层都真实站稳！`);
      callbacks.current.onComplete();
    }
  }, [state.phase, paused]);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (paused || state.phase === "won") return;
    const base = live.current.floors.at(-1)!;
    report(
      state.phase === "lost"
        ? "这一层没有站稳，用“重来”重新搭建。"
        : `下方支撑从 ${Math.round(base.x)} 到 ${Math.round(base.x + base.width)}。让移动砖块的中心接近 ${Math.round(base.x + base.width / 2)} 再放下；提示不会暂停移动。`,
    );
  }, [hintToken]);
  function action() {
    const s = live.current;
    if (paused || s.phase === "lost" || s.phase === "won") return;
    if (s.phase === "ready") {
      commit({ ...s, phase: "moving" });
      report("砖块开始移动。对齐时按“放下砖块”，或在画布聚焦时按空格。");
      return;
    }
    const base = s.floors.at(-1)!,
      floor = stackOverlap(base, { x: s.x, width: base.width });
    if (!floor) {
      commit({ ...s, phase: "lost" });
      report("没有留下足够的支撑，这次停在这里。点“重来”就能重新搭建。");
      return;
    }
    const floors = [...s.floors, floor],
      won = floors.length - 1 >= lesson.target,
      direction = floors.length % 2 === 0 ? -1 : 1;
    commit({
      floors,
      x: direction > 0 ? 0 : 360 - floor.width,
      direction,
      phase: won ? "won" : "moving",
    });
    report(
      `第 ${floors.length - 1} 层站稳了，剩余宽度 ${Math.round(floor.width)}。继续看好两条边。`,
    );
  }
  return (
    <div
      className="clstack-game"
      data-cloud-stack-game
      data-stack-phase={state.phase}
      data-stack-height={height}
      data-stack-x={state.x}
      data-stack-top={JSON.stringify(top)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (
          e.ctrlKey ||
          e.metaKey ||
          e.altKey ||
          e.repeat ||
          (e.target as HTMLElement).tagName === "BUTTON"
        )
          return;
        if (e.key === " ") {
          e.preventDefault();
          action();
        }
      }}
    >
      <section className="clstack-stage">
        <header>
          <div>
            <span>ONE FLOOR AT A TIME</span>
            <h3>{lesson.title}</h3>
          </div>
          <b>
            {height}
            <small> / {lesson.target}</small>
          </b>
        </header>
        <p>{lesson.lesson}</p>
        <div className="clstack-counters">
          <span>楼顶宽度 {Math.round(top.width)}</span>
          <span>
            {paused
              ? "已暂停"
              : state.phase === "ready"
                ? "准备开始"
                : state.phase === "won"
                  ? "屋顶完成"
                  : state.phase === "lost"
                    ? "再试一次"
                    : "等待好落点"}
          </span>
        </div>
        <svg
          className="clstack-sky"
          viewBox="0 0 360 420"
          role="img"
          aria-label={`已经搭好 ${height} 层，目标 ${lesson.target} 层`}
        >
          <defs>
            <linearGradient id="stack-sky" x2="0" y2="1">
              <stop stopColor="#d8edf0" />
              <stop offset="1" stopColor="#f4ead9" />
            </linearGradient>
          </defs>
          <rect width="360" height="420" rx="20" fill="url(#stack-sky)" />
          <g fill="#ffffffaa">
            <ellipse cx="75" cy="73" rx="59" ry="19" />
            <ellipse cx="287" cy="130" rx="51" ry="16" />
            <ellipse cx="135" cy="195" rx="57" ry="14" />
          </g>
          <path d="M0 400Q90 374 182 398T360 385V420H0" fill="#abc7af" />
          <rect x="45" y="382" width="270" height="13" rx="6" fill="#788f80" />
          {state.floors.map((floor, i) => (
            <g key={i}>
              <rect
                x={floor.x}
                y={362 - i * 20}
                width={floor.width}
                height="19"
                rx="3"
                fill={["#6b9a91", "#dfa975", "#9c98b5", "#8bac75"][i % 4]}
                stroke="#4e706057"
              />
              <path
                d={`M${floor.x + 3} ${365 - i * 20}h${Math.max(0, floor.width - 6)}`}
                stroke="#ffffff77"
                strokeWidth="2"
              />
            </g>
          ))}
          {(state.phase === "moving" || state.phase === "ready") && (
            <g>
              <line
                x1={top.x}
                x2={top.x}
                y1="18"
                y2={362 - height * 20}
                stroke="#76957d"
                strokeDasharray="4 6"
              />
              <line
                x1={top.x + top.width}
                x2={top.x + top.width}
                y1="18"
                y2={362 - height * 20}
                stroke="#76957d"
                strokeDasharray="4 6"
              />
              <rect
                x={state.x}
                y={342 - height * 20}
                width={top.width}
                height="19"
                rx="3"
                fill="#edc96a"
                stroke="#b6933b"
                strokeWidth="2"
              />
              <path
                d={`M${state.x + top.width / 2 - 8} ${351 - height * 20}h16m${state.x + top.width / 2} ${346 - height * 20}v10`}
                stroke="#977535"
                strokeWidth="2"
              />
            </g>
          )}
          {state.phase === "won" && (
            <g>
              <path
                d={`M${top.x + top.width / 2} ${363 - height * 20}v-42h26l-7 8 7 8h-26`}
                fill="#e4a467"
                stroke="#967b4c"
                strokeWidth="2"
              />
              <text
                x="180"
                y="60"
                textAnchor="middle"
                fill="#4f7762"
                fontSize="23"
              >
                云端小楼，落成！
              </text>
            </g>
          )}
        </svg>
        <button
          type="button"
          className="clstack-drop"
          disabled={paused || state.phase === "lost" || state.phase === "won"}
          onClick={action}
        >
          {state.phase === "ready" ? "开始垒塔" : "放下砖块"}
        </button>
        <p className="clstack-message" role="status">
          {message}
        </p>
      </section>
      <aside className="clstack-notes">
        <span>时机 · 重叠 · 累积</span>
        <h3>
          先站稳，
          <br />
          再往上。
        </h3>
        <ol>
          <li>开始后，金色砖块会左右来回移动。</li>
          <li>点“放下砖块”确定落点。只有与楼顶重叠的部分会留下。</li>
          <li>至少保留八个宽度单位，并搭到目标层数，才算完成。</li>
        </ol>
        <p>
          虚线标出下方支撑的两条边。砖块变窄时，往往更需要耐心。没有完美对齐奖励或暗中吸附，落点完全由你决定。
        </p>
        <details>
          <summary>键盘、暂停与重试</summary>
          <p>
            Tab
            聚焦画布后按空格开始或放下；也可直接点击大按钮。暂停冻结移动，继续时不会突然补走时间。实时落点不能撤销，失败可以不限次数重来。提示只说明当前支撑位置。
          </p>
        </details>
      </aside>
    </div>
  );
}
