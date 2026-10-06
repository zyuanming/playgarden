// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  buoyancyHint,
  buoyancyLevels,
  buoyancyNextMove,
  createBuoyancyState,
  describeBuoyancyResult,
  evaluateBuoyancy,
  isBuoyancySolved,
  moveBuoyancy,
  undoBuoyancy,
  type BuoyancyMove,
} from "./buoyancyLogic";
import { formatPhysicsRatio, physicsRatioValue } from "./motionPhysicsRational";
import "./motionPhysicsGames.css";

export default function BuoyancyDock(props: GameProps) {
  return (
    <DockExperiment key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function DockExperiment({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = buoyancyLevels[level] ?? buoyancyLevels[0];
  const [state, setState] = useState(() => createBuoyancyState(config));
  const [hint, setHint] = useState<BuoyancyMove | null>(null);
  const seenHint = useRef(hintToken),
    seenUndo = useRef(undoToken),
    completed = useRef(false);
  const result = evaluateBuoyancy(config, state),
    won = isBuoyancySolved(config, state);
  const previousTrial = [...state.history]
    .reverse()
    .find((snapshot) => snapshot.tested);
  const previousResult = previousTrial
    ? evaluateBuoyancy(config, previousTrial)
    : null;
  const selectedHulls = config.hulls.filter((_, i) => state.hulls[i]);
  const selectedCargo = config.cargo.filter((_, i) => state.cargo[i]);
  const draft = result.draftMm ? physicsRatioValue(result.draftMm) : 0;
  const diagramDraft = state.tested
    ? Math.min(draft, config.hullHeightMm * 1.1)
    : 0;
  const hullTop = state.tested
    ? 165 - 88 + (diagramDraft / config.hullHeightMm) * 88
    : 70;
  const targetY =
    hullTop +
    88 -
    (physicsRatioValue(config.targetDraftMm) / config.hullHeightMm) * 88;
  const hullWidths = selectedHulls.map(
    (h) => (h.areaDm2 / Math.max(result.areaDm2, 1)) * 322,
  );
  useEffect(() => {
    onStatus("组装浮箱并装齐必运货物，使下水后的吃水精确达到目标。");
  }, []);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (paused || won) return;
    setHint(buoyancyNextMove(config, state));
    onStatus(buoyancyHint(config, state));
  }, [hintToken, paused, won, state, config, onStatus]);
  useEffect(() => {
    if (seenUndo.current === undoToken) return;
    seenUndo.current = undoToken;
    if (paused) return;
    const previous = undoBuoyancy(state);
    setState(previous);
    setHint(null);
    onStatus(
      previous === state
        ? "还没有装配步骤可以撤销。"
        : "已撤销一步，恢复之前的装配或下水记录。",
    );
  }, [undoToken, paused, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !completed.current) {
      completed.current = true;
      onStatus(describeBuoyancyResult(result));
      onComplete();
    }
  }, [won, paused, result, onStatus, onComplete]);
  function act(move: BuoyancyMove) {
    if (paused || won) return;
    const next = moveBuoyancy(config, state, move);
    if (next === state) return;
    setState(next);
    setHint(null);
    onStatus(
      move.kind === "launch"
        ? describeBuoyancyResult(evaluateBuoyancy(config, next))
        : "配载已更新，浮台回到干船坞。可以继续调整后下水验证。",
    );
  }
  return (
    <div className="puzzle-layout mp-game buoyancy-dock">
      <section className="mp-workbench" aria-label="浮力配载码头">
        <div className="mp-heading">
          <div>
            <span className="mini-label">DISPLACEMENT / 浮力实验</span>
            <h3>{config.title}</h3>
          </div>
          <span className="mp-badge">{level + 1} / 12</span>
        </div>
        <div className="mp-scene mp-dock-scene">
          <svg
            viewBox="0 0 580 285"
            role="img"
            aria-label={`浮台侧视示意图。${state.tested ? describeBuoyancyResult(result) : "正在干船坞装配，尚未下水。"}`}
          >
            <circle cx="502" cy="43" r="20" fill="#eac977" opacity=".65" />
            <rect x="0" y="165" width="580" height="120" fill="#c7e1df" />
            <path d="M0 165 H580" stroke="#699e9b" strokeWidth="3" />
            <path
              d="M20 212 Q50 203 80 212 T140 212 M390 244 Q420 235 450 244 T510 244 M60 263 Q90 254 120 263 T180 263"
              fill="none"
              stroke="#9cc4c0"
              strokeWidth="3"
            />
            {!selectedHulls.length ? (
              <>
                <path
                  d="M123 101 H457"
                  stroke="#acb9a1"
                  strokeDasharray="7 7"
                  strokeWidth="2"
                />
                <text x="290" y="88" textAnchor="middle" fill="#5d7566">
                  选一个浮箱，开始造船
                </text>
              </>
            ) : (
              <g>
                {selectedHulls.map((h, i) => {
                  const x =
                    129 + hullWidths.slice(0, i).reduce((sum, w) => sum + w, 0);
                  return (
                    <g key={h.id}>
                      <rect
                        x={x}
                        y={hullTop}
                        width={hullWidths[i] - 4}
                        height="88"
                        rx="6"
                        fill={i % 2 ? "#c79864" : "#d6ad7d"}
                        stroke="#92704c"
                        strokeWidth="2"
                      />
                      <text
                        x={x + (hullWidths[i] - 4) / 2}
                        y={hullTop + 47}
                        textAnchor="middle"
                        fill="#583f29"
                        fontSize="19"
                      >
                        {h.id}
                      </text>
                    </g>
                  );
                })}
                <rect
                  x="119"
                  y={hullTop - 8}
                  width="342"
                  height="10"
                  rx="3"
                  fill="#6b7d68"
                />
                {selectedCargo.map((c, i) => (
                  <g key={c.id}>
                    <rect
                      x={140 + i * 49}
                      y={hullTop - 42}
                      width="42"
                      height="34"
                      rx="3"
                      fill={c.required ? "#789376" : "#8f9ca1"}
                    />
                    <text
                      x={161 + i * 49}
                      y={hullTop - 20}
                      textAnchor="middle"
                      fill="#fff"
                      fontSize="11"
                    >
                      {c.massG / 1000}kg
                    </text>
                  </g>
                ))}
                <path
                  d={`M117 ${targetY} H460`}
                  stroke="#a44f3e"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                />
                <text x="469" y={targetY + 4} fill="#904636" fontSize="12">
                  目标线
                </text>
                {!state.tested ? (
                  <>
                    <path
                      d="M177 159 V194 M408 159 V194"
                      stroke="#899780"
                      strokeWidth="8"
                    />
                    <text x="290" y="238" textAnchor="middle" fill="#4d7670">
                      干船坞 · 点击下水验证
                    </text>
                  </>
                ) : null}
              </g>
            )}
            <text x="17" y="153" fill="#3e7c77" fontSize="12">
              液面
            </text>
          </svg>
          <span className="mp-scene-note">
            侧视示意 · 不模拟倾斜或波浪 · 目标线是船体上的吃水标记
          </span>
        </div>
        <div className="mp-readouts">
          <div>
            <small>目标吃水</small>
            <strong data-testid="buoyancy-target">
              {formatPhysicsRatio(config.targetDraftMm)} mm
            </strong>
          </div>
          <div>
            <small>静水观测</small>
            <strong data-testid="buoyancy-draft">
              {state.tested && result.draftMm
                ? result.kind === "sunk"
                  ? "无法漂浮"
                  : `${formatPhysicsRatio(result.draftMm)} mm`
                : "等待下水"}
            </strong>
          </div>
        </div>
        {previousResult && (
          <aside
            className="mp-last-observation"
            data-testid="buoyancy-last-observation"
          >
            <strong>上次已完成试航</strong>
            <p>
              总质量 {previousResult.massG / 1000} kg · 水线面积{" "}
              {previousResult.areaDm2} dm²
            </p>
            <p>{describeBuoyancyResult(previousResult)}</p>
          </aside>
        )}
        <div className="mp-ledger">
          <span>
            总质量 <b data-testid="buoyancy-mass">{result.massG / 1000} kg</b>
          </span>
          <span>
            水线面积 <b>{result.areaDm2} dm²</b>
          </span>
          <span>
            浮箱{" "}
            <b>
              {selectedHulls.length}/{config.maxHulls}
            </b>
          </span>
          <span>
            必运货物{" "}
            <b>
              {config.cargo.filter((c) => c.required).length -
                result.missingCargo}
              /{config.cargo.filter((c) => c.required).length}
            </b>
          </span>
        </div>
        <fieldset className="mp-rack">
          <legend>① 组装浮箱 · 全部高 {config.hullHeightMm} mm</legend>
          <div className="mp-card-grid">
            {config.hulls.map((h, index) => (
              <button
                key={h.id}
                data-dock-kind="hull"
                data-index={index}
                aria-pressed={state.hulls[index]}
                aria-label={`浮箱 ${h.id}，面积 ${h.areaDm2} 平方分米，自重 ${h.massG / 1000} 千克，${state.hulls[index] ? "已装上，点击卸下" : "点击装上"}`}
                className={`${state.hulls[index] ? "is-selected" : ""} ${hint?.kind === "hull" && hint.index === index ? "mp-hinted" : ""}`}
                disabled={
                  paused ||
                  won ||
                  (!state.hulls[index] &&
                    selectedHulls.length >= config.maxHulls)
                }
                onClick={() => act({ kind: "hull", index })}
              >
                <span className="mp-hull-icon">{h.id}</span>
                <strong>{h.areaDm2} dm²</strong>
                <small>自重 {h.massG / 1000} kg</small>
                <span className="mp-placement">
                  {state.hulls[index] ? "已装上 ✓" : "装上 +"}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="mp-rack">
          <legend>② 装载货物 · “必运”都要上船</legend>
          <div className="mp-card-grid">
            {config.cargo.map((c, index) => (
              <button
                key={c.id}
                data-dock-kind="cargo"
                data-index={index}
                aria-pressed={state.cargo[index]}
                aria-label={`${c.id}，${c.massG / 1000} 千克，${c.required ? "必运" : "可选压舱"}，${state.cargo[index] ? "已装上，点击卸下" : "点击装上"}`}
                className={`${state.cargo[index] ? "is-selected" : ""} ${hint?.kind === "cargo" && hint.index === index ? "mp-hinted" : ""}`}
                disabled={paused || won}
                onClick={() => act({ kind: "cargo", index })}
              >
                <span
                  className={`mp-cargo-icon ${c.required ? "required" : ""}`}
                >
                  {c.massG / 1000}
                  <small>kg</small>
                </span>
                <strong>{c.id}</strong>
                <small>{c.required ? "必运货物" : "可选压舱"}</small>
                <span className="mp-placement">
                  {state.cargo[index] ? "已装上 ✓" : "装上 +"}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <button
          className={`mp-action ${hint?.kind === "launch" ? "mp-hinted" : ""}`}
          data-testid="buoyancy-launch"
          disabled={paused || won || state.tested || !selectedHulls.length}
          onClick={() => act({ kind: "launch" })}
        >
          下水验证 <span>≈</span>
        </button>
        <p className={`mp-result ${won ? "mp-success" : ""}`} role="status">
          {paused
            ? "码头已暂停，装配和下水操作已锁定。"
            : state.tested
              ? describeBuoyancyResult(result)
              : "在干船坞里自由配载；准备好后下水，不计失败次数。"}
        </p>
        {state.tested ? (
          <p className="mp-detail">
            所需排水量 {formatPhysicsRatio(result.displacedL)} L
            {result.averageDensityKgM3
              ? ` · 按浮箱总容积折算的平均密度 ${formatPhysicsRatio(result.averageDensityKgM3)} kg/m³`
              : ""}
            。
            {result.kind === "sunk"
              ? "实际浮箱容积不足，不能达到这个排水量。"
              : ""}
          </p>
        ) : null}
      </section>
      <aside className="game-notes">
        <span className="mini-label">质量 · 体积 · 密度</span>
        <h3>让水托住整艘船。</h3>
        <p>{config.idea}</p>
        <div className="note">
          <strong>浮力 = 排开液体的重量</strong>
          <p>
            本关液体密度为 {config.densityKgM3} kg/m³。1 L = 1 dm³；1 kg = 1000
            g。平衡时：排水量(L) = 总质量(g) ÷ 液体密度(kg/m³)。
          </p>
          <p>
            吃水(mm) = 总质量(g) × 100 ÷ [液体密度(kg/m³) ×
            总水线面积(dm²)]。所有浮箱自重、必运货物和压舱块都计入总质量。
          </p>
        </div>
        <details className="mp-assumptions">
          <summary>静水模型与完成条件</summary>
          <p>
            密封长方体浮箱刚性连接，等高、竖直、共用水平水线。这里只算静水竖直平衡，不计算倾覆稳定性、波浪、漏水或航行阻力，不可用于真实船舶设计。
          </p>
          <p>
            装齐必运货物，不超过船位上限，精确达到目标吃水，并保留正干舷（吃水严格小于{" "}
            {config.hullHeightMm} mm）才算完成。所有判定用精确整数和分数。
          </p>
        </details>
        <p className="muted">
          Tab 移动焦点，Enter
          或空格装卸；触屏直接点按。装配改变会回到干船坞。撤销可恢复装卸或下水记录。无自动动画，无时间限制。
        </p>
      </aside>
    </div>
  );
}
