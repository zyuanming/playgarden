// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  createInclineState,
  describeInclineResult,
  evaluateIncline,
  inclineHint,
  inclineLevels,
  inclineNextMove,
  inclinePartNames,
  inclineParts,
  isInclineSolved,
  moveIncline,
  undoIncline,
  type InclineMove,
} from "./inclineLogic";
import { formatPhysicsRatio, physicsRatioValue } from "./motionPhysicsRational";
import "./motionPhysicsGames.css";

export default function InclineLab(props: GameProps) {
  return (
    <InclineExperiment key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function InclineExperiment({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = inclineLevels[level] ?? inclineLevels[0];
  const [state, setState] = useState(() => createInclineState(config));
  const [hint, setHint] = useState<InclineMove | null>(null);
  const seenHint = useRef(hintToken),
    seenUndo = useRef(undoToken),
    completed = useRef(false);
  const result = evaluateIncline(config, state.settings),
    won = isInclineSolved(config, state);
  const min = physicsRatioValue(config.targetMinCm),
    max = physicsRatioValue(config.targetMaxCm);
  const stop = result.stopCm ? physicsRatioValue(result.stopCm) : 0;
  const distanceScale = Math.max(max * 1.4, state.tested ? stop * 1.08 : 0, 60);
  const trackX = (cm: number) => 192 + Math.min(cm / distanceScale, 1) * 346;
  const heightY =
    214 -
    ((state.settings.height ?? config.height[0]) / Math.max(...config.height)) *
      130;
  const target =
    min === max
      ? `${formatPhysicsRatio(config.targetMinCm)} cm`
      : `${formatPhysicsRatio(config.targetMinCm)}–${formatPhysicsRatio(config.targetMaxCm)} cm`;
  useEffect(() => {
    onStatus(
      "选择高度与两种摩擦，再释放滑车。绿色区域是坡底之后的目标停车区。",
    );
  }, []);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (paused || won) return;
    setHint(inclineNextMove(config, state));
    onStatus(inclineHint(config, state));
  }, [hintToken, paused, won, state, config, onStatus]);
  useEffect(() => {
    if (seenUndo.current === undoToken) return;
    seenUndo.current = undoToken;
    if (paused) return;
    const previous = undoIncline(state);
    setState(previous);
    setHint(null);
    onStatus(
      previous === state
        ? "还没有实验步骤可以撤销。"
        : "已撤销一步，包括参数或释放记录。",
    );
  }, [undoToken, paused, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !completed.current) {
      completed.current = true;
      onStatus(describeInclineResult(result));
      onComplete();
    }
  }, [won, paused, result, onStatus, onComplete]);
  function act(move: InclineMove) {
    if (paused || won) return;
    const next = moveIncline(config, state, move);
    if (next === state) return;
    setState(next);
    setHint(null);
    onStatus(
      move.part === "release"
        ? describeInclineResult(evaluateIncline(config, next.settings))
        : "参数已更新。先预测滑车会停在哪里，再释放验证。",
    );
  }
  return (
    <div className="puzzle-layout mp-game incline-lab">
      <section className="mp-workbench" aria-label="斜坡停车实验台">
        <div className="mp-heading">
          <div>
            <span className="mini-label">ENERGY / 斜坡实验</span>
            <h3>{config.title}</h3>
          </div>
          <span className="mp-badge">{level + 1} / 12</span>
        </div>
        <div className="mp-scene mp-incline-scene">
          <svg
            viewBox="0 0 580 285"
            role="img"
            aria-label={`斜坡与停车区示意图。目标 ${target}。${state.tested ? describeInclineResult(result) : "滑车尚未释放。"}`}
          >
            <circle cx="493" cy="54" r="22" fill="#f0cc76" opacity=".65" />
            <path
              d="M15 235 Q100 191 189 219 T370 222 T575 210 V285 H15Z"
              fill="#e5ecd7"
            />
            <path d={`M50 ${heightY} L192 220 H50Z`} fill="#c6b999" />
            <path
              d={`M50 ${heightY} L192 220 H550`}
              fill="none"
              stroke="#617365"
              strokeWidth="7"
              strokeLinejoin="round"
            />
            <path
              d={`M36 ${heightY} V220 M31 ${heightY} H41 M31 220 H41`}
              stroke="#667765"
              strokeWidth="1.5"
            />
            <text x="30" y={heightY - 15} fill="#435c4d">
              h = {state.settings.height ?? "?"} cm
            </text>
            <rect
              x={trackX(min) - (min === max ? 3 : 0)}
              y="192"
              width={Math.max(6, trackX(max) - trackX(min))}
              height="39"
              rx="3"
              fill="#88b563"
              opacity=".8"
            />
            <path
              d={`M${trackX((min + max) / 2)} 169 V191`}
              stroke="#537b3d"
              strokeWidth="2"
            />
            <text
              x={trackX((min + max) / 2)}
              y="161"
              textAnchor="middle"
              fill="#385b32"
            >
              目标区
            </text>
            {state.tested && result.stopCm ? (
              <g transform={`translate(${trackX(stop)},203)`}>
                <rect
                  x="-12"
                  y="-15"
                  width="24"
                  height="27"
                  rx="5"
                  fill={won ? "#568745" : "#c57d4e"}
                />
                <text x="0" y="-22" textAnchor="middle" fill="#3d5345">
                  停车
                </text>
              </g>
            ) : (
              <g
                transform={`translate(66,${heightY + 1}) rotate(${(Math.atan2(220 - heightY, 142) * 180) / Math.PI})`}
              >
                <rect
                  x="-12"
                  y="-20"
                  width="24"
                  height="19"
                  rx="3"
                  fill="#c57d4e"
                />
              </g>
            )}
            <text
              x="100"
              y="248"
              textAnchor="middle"
              fill="#637161"
              fontSize="12"
            >
              坡道水平长 {config.rampRunCm} cm
            </text>
            <text
              x="191"
              y="268"
              textAnchor="middle"
              fill="#526453"
              fontSize="12"
            >
              坡底 0
            </text>
            <text x="540" y="268" textAnchor="end" fill="#526453" fontSize="12">
              刹车地面 →
            </text>
          </svg>
          <span className="mp-scene-note">示意图 · 不等比例 · 无需抢时间</span>
        </div>
        <div className="mp-readouts">
          <div>
            <small>目标停车位置</small>
            <strong data-testid="incline-target">{target}</strong>
          </div>
          <div>
            <small>本次观测</small>
            <strong data-testid="incline-distance">
              {state.tested
                ? result.stopCm
                  ? `${formatPhysicsRatio(result.stopCm)} cm`
                  : "未启动"
                : "等待释放"}
            </strong>
          </div>
        </div>
        <div className="mp-options">
          {inclineParts.map((part) => (
            <fieldset key={part}>
              <legend>
                {inclinePartNames[part]}
                {config[part].length === 1 ? " · 固定" : ""}
              </legend>
              <div className="mp-option-row">
                {config[part].map((value) => (
                  <button
                    key={value}
                    data-incline-part={part}
                    data-value={value}
                    aria-pressed={state.settings[part] === value}
                    aria-label={`${inclinePartNames[part]} ${part === "height" ? `${value} 厘米` : `摩擦系数 ${(value / 100).toFixed(2)}`}`}
                    className={`${state.settings[part] === value ? "is-selected" : ""} ${hint?.part === part && "value" in hint && hint.value === value ? "mp-hinted" : ""}`}
                    disabled={paused || won || config[part].length === 1}
                    onClick={() => act({ part, value })}
                  >
                    {part === "height"
                      ? `${value} cm`
                      : `μ ${(value / 100).toFixed(2)}`}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <button
          className={`mp-action ${hint?.part === "release" ? "mp-hinted" : ""}`}
          data-testid="incline-release"
          disabled={
            paused || won || state.tested || result.kind === "incomplete"
          }
          onClick={() => act({ part: "release" })}
        >
          释放滑车 <span>→</span>
        </button>
        <p className={`mp-result ${won ? "mp-success" : ""}`} role="status">
          {paused
            ? "实验已暂停，参数和释放操作已锁定。"
            : state.tested
              ? describeInclineResult(result)
              : "先选择参数，再释放验证。可反复调整，不计失败次数。"}
        </p>
      </section>
      <aside className="game-notes">
        <span className="mini-label">观察 · 预测 · 验证</span>
        <h3>把能量刚好用完。</h3>
        <p>{config.idea}</p>
        <div className="note">
          <strong>停车距离 = (h − μ坡 × L) ÷ μ地</strong>
          <p>
            h 是坡顶高度，L 是坡道的水平长度，单位均为 cm。μ
            是无单位的摩擦系数。坡面摩擦损耗按 μ坡 × L 计算。
          </p>
          <p>
            势能 mgh 先克服坡面摩擦，剩余动能在水平地面上耗尽。质量 m
            和重力加速度 g 在方程两侧抵消。
          </p>
        </div>
        <details className="mp-assumptions">
          <summary>这个简化模型省略了什么？</summary>
          <p>
            这是从静止释放的理想滑块模型，方块外形不代表带转动惯量的车轮。静摩擦系数等于动摩擦系数，坡面与地面之间平滑连接，不计空气阻力、碰撞或转动能。
          </p>
          <p>
            当 h ≤ μ坡 × L
            时不能启动。所有通过判定都使用精确整数与分数；目标区包含两端点，精确目标则必须完全相等。
          </p>
        </details>
        <p className="muted">
          原生按钮支持 Tab、Enter
          与空格，也可触屏点按。撤销会恢复上一步参数或释放记录。画面没有自动动画，暂停与减少动态效果均安全。
        </p>
      </aside>
    </div>
  );
}
