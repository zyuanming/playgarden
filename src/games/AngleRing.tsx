// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  type AngleLevel,
  type Choice,
  type Layout,
  angleLevels,
  emptyLayout,
  isUsed,
  marks,
  place,
  progress,
  suggest,
  won,
} from "./angleRingLogic";
import "./angleRing.css";

const center = 128;
function point(angle: number, radius: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [
    center + radius * Math.cos(radians),
    center + radius * Math.sin(radians),
  ].join(" ");
}
function band(start: number, span: number) {
  const end = start + span,
    large = Number(span > 180);
  return `M ${point(start, 89)} A 89 89 0 ${large} 1 ${point(end, 89)}
    L ${point(end, 60)} A 60 60 0 ${large} 0 ${point(start, 60)} Z`;
}
type Snapshot = { layout: Layout; frame: number };
export default function AngleRing(props: GameProps) {
  return <Round key={`${props.level}:${props.resetToken}`} {...props} />;
}
function Round({ level, paused, hintToken, undoToken, onComplete }: GameProps) {
  const puzzle = angleLevels[level] ?? angleLevels[0];
  const [history, setHistory] = useState<Snapshot[]>(() => [
    { layout: emptyLayout(puzzle), frame: 0 },
  ]);
  const [active, setActive] = useState(0);
  const [message, say] = useState("从 0° 出发，找一块起端符号相同的扇片。");
  const [advice, setAdvice] = useState<Choice | null>(null);
  const { layout } = history[history.length - 1];
  const current = puzzle.frames[active],
    { angle, seam } = progress(current, puzzle.pieces, layout[active]);
  const finished = won(puzzle, layout),
    locked = finished || paused;
  const seenHint = useRef(hintToken),
    seenUndo = useRef(undoToken),
    reported = useRef(false);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (locked) return;
    const result = suggest(puzzle, layout, active);
    if (result.kind === "step") {
      setActive(result.choice.frame);
      setAdvice(result.choice);
      say(
        `建议：拼环 ${result.choice.frame + 1}，放入扇片 ${result.choice.piece + 1}。`,
      );
    } else {
      setAdvice(null);
      say(
        result.kind === "dead"
          ? "这条路拼不完，撤销一步再试。"
          : "暂未找到可靠的下一步，可换一种拼法。",
      );
    }
  }, [active, hintToken, layout, locked, puzzle]);
  useEffect(() => {
    if (seenUndo.current === undoToken) return;
    seenUndo.current = undoToken;
    if (locked) return;
    setAdvice(null);
    if (history.length === 1) {
      say("还没有可以撤销的扇片。");
      return;
    }
    setActive(history[history.length - 1].frame);
    setHistory(history.slice(0, -1));
    say("已取回上一块扇片，接缝和角度一起恢复。");
  }, [history, locked, undoToken]);
  useEffect(() => {
    if (finished && !paused && !reported.current) {
      reported.current = true;
      onComplete();
    }
  }, [finished, paused, onComplete]);

  function choose(frame: number) {
    if (locked || active === frame) return;
    setActive(frame);
    setAdvice(null);
    say(`已选中拼环 ${frame + 1}。`);
  }
  function add(piece: number) {
    if (locked) return;
    const result = place(puzzle, layout, { frame: active, piece });
    setAdvice(null);
    if ("reason" in result) {
      say(result.reason);
      return;
    }
    setHistory([...history, { layout: result.layout, frame: active }]);
    const end = angle + puzzle.pieces[piece].span;
    say(
      end === current.span
        ? puzzle.frames.length > 1
          ? `拼环 ${active + 1} 已拼满，可切换到其他拼环。`
          : "拼环已拼满。"
        : current.pin?.at === end
          ? "接缝刚好落在定位钉上。"
          : `已放入扇片 ${piece + 1}。`,
    );
  }

  return (
    <div
      className="puzzle-layout angular-game"
      data-angle-won={finished}
      onKeyDown={(e) => {
        if (locked || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        const piece = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : -1;
        if (piece >= 0 && piece < puzzle.pieces.length) {
          e.preventDefault();
          add(piece);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          choose(
            (active + (e.key === "ArrowLeft" ? -1 : 1) + puzzle.frames.length) %
              puzzle.frames.length,
          );
        }
      }}
    >
      <section
        className="angular-panel"
        aria-label="拼环棋盘，用数字键放扇片，左右方向键切换拼环"
        tabIndex={0}
      >
        <header className="angular-heading">
          <span className="mini-label">角度拼环 · 第 {level + 1} 关</span>
          <strong>
            {history.length - 1}/{puzzle.pieces.length} 片
          </strong>
        </header>
        {puzzle.frames.length > 1 && (
          <div className="angular-frames" role="group" aria-label="选择拼环">
            {puzzle.frames.map((frame, i) => {
              const status = progress(frame, puzzle.pieces, layout[i]);
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={active === i}
                  disabled={locked}
                  data-angle-frame={i + 1}
                  onClick={() => choose(i)}
                >
                  <span>拼环 {i + 1}</span>
                  <b>
                    {status.angle}°/{frame.span}°
                  </b>
                  <small>
                    {status.angle === frame.span
                      ? "已完成"
                      : `${marks[frame.from]} → ${marks[frame.to]}`}
                  </small>
                </button>
              );
            })}
          </div>
        )}
        <div className="angular-board">
          <Dial
            key={active}
            puzzle={puzzle}
            frameIndex={active}
            path={layout[active]}
          />
          <dl className="angular-readout">
            <div>
              <dt>目标</dt>
              <dd>{current.span}°</dd>
            </div>
            <div>
              <dt>剩余</dt>
              <dd>{current.span - angle}°</dd>
            </div>
            <div>
              <dt>下片起端</dt>
              <dd>{angle === current.span ? "完成" : marks[seam]}</dd>
            </div>
            <div>
              <dt>终点接缝</dt>
              <dd>{marks[current.to]}</dd>
            </div>
            {current.pin && (
              <div>
                <dt>定位钉</dt>
                <dd>
                  {current.pin.at}° {marks[current.pin.mark]}
                  {angle >= current.pin.at && (
                    <span aria-label="已对齐"> ✓</span>
                  )}
                </dd>
              </div>
            )}
          </dl>
        </div>
        <div className="angular-pieces" role="group" aria-label="可用扇片">
          {puzzle.pieces.map((piece, i) => {
            const used = isUsed(layout, i);
            return (
              <button
                key={i}
                type="button"
                data-angle-piece={i + 1}
                data-hinted={advice?.piece === i && advice.frame === active}
                aria-label={`扇片 ${i + 1}，${piece.span} 度，${marks[piece.from]} 到 ${marks[piece.to]}${used ? "，已用" : ""}`}
                aria-disabled={used || locked}
                onClick={() => {
                  if (!used) add(i);
                }}
              >
                <small>
                  #{i + 1}
                  {used ? " ✓" : ""}
                </small>
                <b>{piece.span}°</b>
                <span>
                  {marks[piece.from]} → {marks[piece.to]}
                </span>
              </button>
            );
          })}
        </div>
        <p className="angular-status" role="status">
          {paused ? "已暂停。" : finished ? "所有拼环都拼好了！" : message}
        </p>
      </section>
      <aside className="game-notes">
        <span className="mini-label">角度 · 接缝 · 拼合</span>
        <h3>用扇片把圆弧拼起来。</h3>
        <ol>
          <li>
            从 0° 顺时针拼，扇片不能翻面。前一块的末端要与后一块的起端符号相同。
          </li>
          <li>正好拼到目标角度，并对上终点符号。</li>
          <li>
            有定位钉时，必须在指定角度留出相同符号的接缝，不能让一块扇片盖过去。
          </li>
          <li>有多个拼环时，所有拼环共用一套扇片。</li>
        </ol>
        <p>
          触屏直接点扇片。键盘聚焦棋盘后按数字键放入对应扇片，方向键切换拼环。
        </p>
      </aside>
    </div>
  );
}

function Dial({
  puzzle,
  frameIndex,
  path,
}: {
  puzzle: AngleLevel;
  frameIndex: number;
  path: readonly number[];
}) {
  const frame = puzzle.frames[frameIndex];
  let end = 0;
  const { angle } = progress(frame, puzzle.pieces, path);
  return (
    <svg
      className="angular-dial"
      viewBox="0 0 256 256"
      role="img"
      aria-label={`拼环 ${frameIndex + 1}，已拼 ${angle}°，目标 ${frame.span}°`}
      data-angle-current={angle}
    >
      <circle
        cx="128"
        cy="128"
        r="74.5"
        fill="none"
        stroke="#281d35"
        strokeWidth="29"
      />
      {frame.span === 360 ? (
        <circle
          cx="128"
          cy="128"
          r="74.5"
          fill="none"
          stroke="#4c3860"
          strokeWidth="29"
        />
      ) : (
        <path d={band(0, frame.span)} fill="#4c3860" />
      )}
      {Array.from({ length: 24 }, (_, i) => (
        <path
          key={i}
          d={`M ${point(i * 15, 95)} L ${point(i * 15, i % 6 === 0 ? 103 : 99)}`}
          stroke={i % 6 === 0 ? "#cbb8d5" : "#867293"}
          strokeWidth="1.5"
        />
      ))}
      {path.map((id) => {
        const start = end,
          span = puzzle.pieces[id].span;
        end += span;
        const [x, y] = point(start + span / 2, 74.5).split(" ");
        return (
          <g key={id}>
            <path
              d={band(start, span)}
              fill={
                ["#ffbf81", "#61dcc6", "#c9a4ff", "#f6e580", "#ffa2b7"][id % 5]
              }
              stroke="#21152d"
              strokeWidth="2"
            />
            <text x={x} y={y} className="angular-wedge-id">
              #{id + 1}
            </text>
          </g>
        );
      })}
      <path
        d={`M ${point(0, 54)} L ${point(0, 105)}`}
        stroke="#e3d6eb"
        strokeWidth="2"
      />
      <text x="128" y="11" className="angular-tick-label">
        0°
      </text>
      <path
        d={`M ${point(frame.span, 53)} L ${point(frame.span, 91)}`}
        stroke="#ffbf81"
        strokeWidth="2"
        strokeDasharray="3 3"
      />
      {frame.pin && (
        <>
          <path
            d={`M ${point(frame.pin.at, 53)} L ${point(frame.pin.at, 107)}`}
            stroke="#f6e580"
            strokeWidth="2"
            strokeDasharray="3 3"
          />
          <path
            d={`M ${point(frame.pin.at, 104)} L ${point(frame.pin.at + 3, 111)} L ${point(frame.pin.at, 118)} L ${point(frame.pin.at - 3, 111)} Z`}
            fill="#f6e580"
          />
        </>
      )}
      <text x="128" y="120" className="angular-dial-value">
        {angle}°
      </text>
      <text x="128" y="148" className="angular-dial-label">
        已拼角度
      </text>
    </svg>
  );
}
