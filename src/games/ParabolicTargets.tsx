// SPDX-License-Identifier: MIT
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { labFormat, labValue } from "./ballisticsCircuitExact";
import { parabolicTargetsLevels } from "./parabolicTargetsLevels";
import {
  createParabolicState,
  describeParabolicResult,
  evaluateParabolic,
  isParabolicSolved,
  moveParabolic,
  parabolicHint,
  parabolicPartNames,
  parabolicParts,
  undoParabolic,
  type ParabolicMove,
} from "./parabolicTargetsLogic";
import "./ballisticsCircuitLabs.css";

export default function ParabolicTargets(props: GameProps) {
  return (
    <ParabolicExperiment
      key={`${props.level}:${props.resetToken}`}
      {...props}
    />
  );
}
function ParabolicExperiment({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const c = parabolicTargetsLevels[level] ?? parabolicTargetsLevels[0];
  const [state, setState] = useState(() => createParabolicState(c)),
    [hintOpen, setHintOpen] = useState(false);
  const seenHint = useRef(hintToken),
    seenUndo = useRef(undoToken),
    completed = useRef(false);
  const result = evaluateParabolic(c, state.settings),
    won = isParabolicSolved(c, state),
    locked = paused || won;
  const previousTrial = [...state.history]
    .reverse()
    .find((snapshot) => snapshot.tested);
  const previousResult = previousTrial
    ? evaluateParabolic(c, previousTrial.settings)
    : null;
  const hint = useMemo(
    () => (hintOpen ? parabolicHint(c, state) : ""),
    [c, state, hintOpen],
  );
  const height = result.height ? labValue(result.height) : null,
    maxY = Math.max(
      c.startHeight + 3,
      labValue(c.targetHigh) + 3,
      ...c.obstacles.map((o) => labValue(o.top) + 1),
      state.settings.vy ? c.startHeight + state.settings.vy ** 2 / 4 + 2 : 0,
    );
  const x = (value: number) => 40 + (value / (c.targetX + 2)) * 520,
    y = (value: number) => 270 - (value / maxY) * 230;
  const target =
    labFormat(c.targetLow) === labFormat(c.targetHigh)
      ? `${labFormat(c.targetLow)} m`
      : `${labFormat(c.targetLow)}–${labFormat(c.targetHigh)} m`;
  const ready = result.kind !== "incomplete" && result.kind !== "invalid";
  const curve = ready
    ? `M${x(0)} ${y(c.startHeight)} Q${x(c.targetX / 2)} ${y(c.startHeight + ((state.settings.vy! / state.settings.vx!) * c.targetX) / 2)} ${x(c.targetX)} ${y(height!)}`
    : "";
  useEffect(() => {
    onStatus(
      "选择水平与竖直初速度，预测弧线，再发射验证。整段轨迹都不能碰到障碍。",
    );
  }, []);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (paused || won) return;
    setHintOpen(true);
    onStatus(parabolicHint(c, state));
  }, [hintToken, paused, won, c, state, onStatus]);
  useEffect(() => {
    if (seenUndo.current === undoToken) return;
    seenUndo.current = undoToken;
    if (paused) return;
    const next = undoParabolic(state);
    setState(next);
    onStatus(
      next === state
        ? "还没有步骤可以撤销。"
        : "已撤销一步设置或发射。提示会继续跟随当前设置。",
    );
  }, [undoToken, paused, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !completed.current) {
      completed.current = true;
      onStatus("连续避障、高度与方向全部验证通过！");
      onComplete();
    }
  }, [won, paused, onComplete, onStatus]);
  function act(move: ParabolicMove) {
    if (locked) return;
    const next = moveParabolic(c, state, move);
    if (next === state) return;
    setState(next);
    onStatus(
      move.part === "launch"
        ? describeParabolicResult(c, evaluateParabolic(c, next.settings))
        : "设置已更新，虚线显示数学预测。发射后会检查整段轨迹。",
    );
  }
  return (
    <div
      className="puzzle-layout bcl-game parabolic-targets"
      data-parabolic-game
      data-parabolic-won={won}
    >
      <section className="bcl-workbench" aria-label="抛物线靶场实验台">
        <div className="bcl-heading">
          <div>
            <span className="mini-label">TRAJECTORY / 抛物线靶场</span>
            <h3>{c.title}</h3>
          </div>
          <span className="bcl-badge">
            {parabolicTargetsLevels.indexOf(c) + 1} / 12
          </span>
        </div>
        <p className="bcl-scroll-cue">
          左右滑动查看完整实验图；图内文字保持原尺寸。也可聚焦图示后用方向键滚动。
        </p>
        <div
          className="bcl-scene"
          tabIndex={0}
          aria-label="实验图，可左右滚动查看"
        >
          <svg
            viewBox="0 0 600 310"
            role="img"
            aria-label={`起点高度 ${c.startHeight} 米。靶线在 ${c.targetX} 米，目标高度 ${target}。${c.obstacles.length ? c.obstacles.map((o) => `${o.name}：横向 ${labFormat(o.left)} 到 ${labFormat(o.right)} 米，高度 ${labFormat(o.bottom)} 到 ${labFormat(o.top)} 米`).join("；") : "没有障碍"}。${state.tested ? describeParabolicResult(c, result) : "等待发射验证"}`}
          >
            <defs>
              <clipPath id={`pt-clip-${level}`}>
                <rect x="35" y="20" width="545" height="251" />
              </clipPath>
            </defs>
            <rect x="0" y="271" width="600" height="39" fill="#e5eada" />
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i} className="bcl-grid">
                <path d={`M40 ${y((maxY * i) / 4)} H575`} />
                <text x="31" y={y((maxY * i) / 4) + 4} textAnchor="end">
                  {((maxY * i) / 4).toFixed(1)}
                </text>
              </g>
            ))}
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i} className="bcl-grid">
                <path d={`M${x((c.targetX * i) / 4)} 30 V270`} />
                <text x={x((c.targetX * i) / 4)} y="291" textAnchor="middle">
                  {(c.targetX * i) / 4}
                </text>
              </g>
            ))}
            <path
              d="M40 29 V270 H578"
              stroke="#768675"
              strokeWidth="1.5"
              fill="none"
            />
            <text x="15" y="17" className="bcl-axis">
              高 m
            </text>
            <text x="561" y="306" className="bcl-axis">
              远 m
            </text>
            {c.obstacles.map((o, i) => (
              <g key={o.name} data-parabolic-obstacle={i}>
                <rect
                  x={x(labValue(o.left))}
                  y={y(labValue(o.top))}
                  width={Math.max(
                    1,
                    x(labValue(o.right)) - x(labValue(o.left)),
                  )}
                  height={y(labValue(o.bottom)) - y(labValue(o.top))}
                  fill={
                    state.tested && result.blocked.includes(i)
                      ? "#b76743"
                      : "#a99c80"
                  }
                  stroke="#796e59"
                  strokeWidth="1"
                />
                <text
                  x={(x(labValue(o.left)) + x(labValue(o.right))) / 2}
                  y={Math.max(14, y(labValue(o.top)) - 7)}
                  textAnchor="middle"
                  className="bcl-obstacle-label"
                >
                  {o.name}
                </text>
              </g>
            ))}
            <path
              d={`M${x(c.targetX)} 30 V270`}
              stroke="#7d9a70"
              strokeWidth="1"
              strokeDasharray="3 5"
            />
            <path
              d={`M${x(c.targetX)} ${y(labValue(c.targetHigh))} V${y(labValue(c.targetLow))}`}
              stroke="#4e8a55"
              strokeWidth="10"
            />
            {[c.targetLow, c.targetHigh].map((q, i) => (
              <path
                key={i}
                d={`M${x(c.targetX) - 8} ${y(labValue(q))} H${x(c.targetX) + 8}`}
                stroke="#3f7845"
                strokeWidth="3"
              />
            ))}
            <text
              x={x(c.targetX) + 13}
              y={y(labValue(c.targetHigh)) - 11}
              className="bcl-target-label"
            >
              靶窗
            </text>
            {curve && (
              <path
                data-testid="parabolic-curve"
                d={curve}
                clipPath={`url(#pt-clip-${level})`}
                fill="none"
                stroke={won ? "#397d55" : state.tested ? "#b66b47" : "#4b7c88"}
                strokeWidth="3"
                strokeDasharray={won ? undefined : "6 5"}
              />
            )}
            <path
              d={`M${x(0)} 270 V${y(c.startHeight)}`}
              stroke="#758b73"
              strokeWidth="9"
            />
            <circle
              cx={x(0)}
              cy={y(c.startHeight)}
              r="7"
              fill="#436c6e"
              stroke="#f8fbf5"
              strokeWidth="3"
            />
            {won && (
              <circle
                cx={x(c.targetX)}
                cy={y(height!)}
                r="6"
                fill="#3c7950"
                stroke="white"
                strokeWidth="2"
              />
            )}
          </svg>
          <p className="bcl-scene-caption">
            横纵比例不同 · 障碍边界不可碰 ·
            虚线是未受阻的数学预测，碰撞后的部分仅为延长线
          </p>
        </div>
        <div className="bcl-readouts">
          <div>
            <small>靶窗 · 距离 {c.targetX} m</small>
            <strong>{target}</strong>
            <span>
              {c.direction === "either"
                ? "上升或下降均可"
                : c.direction === "rising"
                  ? "必须上升时穿靶 ↑"
                  : "必须下降时穿靶 ↓"}
            </span>
          </div>
          <div>
            <small>
              靶线计算高度
              {result.blocked.length || result.kind === "ground"
                ? "（若未受阻）"
                : ""}
            </small>
            <strong data-testid="parabolic-height">
              {state.tested && result.height
                ? `${labFormat(result.height)} m`
                : "等待发射"}
            </strong>
            <span data-testid="parabolic-flight-time">
              起点高度 {c.startHeight} m
              {state.tested && result.time
                ? ` · 靶线理论时间 ${labFormat(result.time)} s`
                : ""}
            </span>
          </div>
        </div>
        {previousTrial && previousResult && (
          <aside
            className="bcl-previous"
            data-testid="parabolic-previous-trial"
          >
            <strong>上一轮发射记录</strong>
            <p>
              水平速度 {previousTrial.settings.vx} m/s · 竖直速度{" "}
              {previousTrial.settings.vy} m/s
            </p>
            <p>{describeParabolicResult(c, previousResult)}</p>
          </aside>
        )}
        <div className="bcl-options">
          {parabolicParts.map((part) => (
            <fieldset key={part}>
              <legend>
                {parabolicPartNames[part]}
                {c[part].length === 1 ? " · 固定参数" : " · 请选择"}
              </legend>
              {c[part].length === 1 ? (
                <p className="bcl-fixed" data-parabolic-fixed={part}>
                  {c[part][0]} m/s
                </p>
              ) : (
                <div className="bcl-option-row">
                  {c[part].map((value) => (
                    <button
                      key={value}
                      data-parabolic-part={part}
                      data-value={value}
                      aria-label={`${parabolicPartNames[part]} ${value} 米每秒`}
                      aria-pressed={state.settings[part] === value}
                      className={
                        state.settings[part] === value ? "is-selected" : ""
                      }
                      disabled={locked}
                      onClick={() => act({ part, value })}
                    >
                      {value} m/s
                    </button>
                  ))}
                </div>
              )}
            </fieldset>
          ))}
        </div>
        <button
          className="bcl-action"
          data-testid="parabolic-launch"
          disabled={locked || !ready || state.tested}
          onClick={() => act({ part: "launch" })}
        >
          发射验证 <span aria-hidden="true">↗</span>
        </button>
        <p className={`bcl-result ${won ? "bcl-success" : ""}`} role="status">
          {paused
            ? "已暂停。参数与发射操作已锁定。"
            : state.tested
              ? describeParabolicResult(c, result)
              : "预测 → 发射 → 观察。无需手速，也不计失败次数。"}
        </p>
        {hintOpen && (
          <p className="bcl-hint" data-testid="parabolic-hint" role="status">
            <strong>当前设置提示</strong>
            {hint}
          </p>
        )}
      </section>
      <aside className="game-notes bcl-notes">
        <span className="mini-label">时间 · 弧线 · 连续避障</span>
        <h3>设计一条真正可走的弧线。</h3>
        <p>{c.idea}</p>
        <div className="note">
          <strong>
            t = x ÷ vₓ
            <br />y = h + vᵧ × t − t²
          </strong>
          <p>
            这里采用小星球模型：重力加速度 g = 2 m/s²，竖直向上为正。h
            是起点高度；vₓ、vᵧ 是你选择的初速度。
          </p>
          <p>靶线竖直速度 = vᵧ − 2t。大于 0 向上，小于 0 向下。</p>
        </div>
        {c === parabolicTargetsLevels[0] && (
          <div className="bcl-worked" data-testid="parabolic-worked">
            <strong>先看一个例子（不是本关参数）</strong>
            <p>
              从 2 m 高处，以水平 2 m/s、竖直 3 m/s 发射。飞到 x = 4 m 时，t = 4
              ÷ 2 = 2 s，y = 2 + 3 × 2 − 2² = 4 m。
            </p>
            <p>
              若只把竖直初速度提高到 4 m/s，同一位置就高 2
              m。现在用这个关系解本关。
            </p>
          </div>
        )}
        <details className="bcl-details">
          <summary>连续碰撞与模型范围</summary>
          <p>
            球是无尺寸质点，不计空气阻力。轨迹在第一次接触障碍或地面时结束。虚线只是无碰撞条件下的预测，不表示能穿过物体。
          </p>
          <p>
            每块矩形的完整横向区间都检查两端和抛物线最高点，使用精确分数比较。没有靠稀疏采样判碰撞，极细障碍也不能穿透。
          </p>
          <p>
            靶窗包含上下边界；障碍与地面边界禁止接触。精确单线目标必须完全吻合。
          </p>
        </details>
        {c.obstacles.length > 0 && (
          <details className="bcl-details">
            <summary>查看障碍的精确坐标</summary>
            <ul>
              {c.obstacles.map((o) => (
                <li key={o.name}>
                  {o.name}：x = {labFormat(o.left)}–{labFormat(o.right)} m；y ={" "}
                  {labFormat(o.bottom)}–{labFormat(o.top)} m。
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="bcl-help">
          Tab 选控件，Enter /
          空格选择。暂停会锁住实验；撤销恢复一步设置或发射；重置清空本关。没有自动运动，支持减少动态效果。
        </p>
      </aside>
    </div>
  );
}
