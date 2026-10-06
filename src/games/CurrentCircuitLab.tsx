// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { labFormat } from "./ballisticsCircuitExact";
import { currentCircuitLevels } from "./currentCircuitLevels";
import {
  createCurrentState,
  currentChoices,
  currentHint,
  currentMoveFor,
  currentPartNames,
  currentParts,
  currentQuantityNames,
  currentTopologyNames,
  currentUnit,
  currentValueLabel,
  describeCurrentResult,
  evaluateCurrent,
  isCurrentSolved,
  moveCurrent,
  undoCurrent,
  type CurrentLevel,
  type CurrentMove,
  type CurrentReadings,
  type CurrentSettings,
} from "./currentCircuitLogic";
import "./ballisticsCircuitLabs.css";

function CircuitDrawing({
  c,
  settings: s,
  readings,
}: {
  c: CurrentLevel;
  settings: CurrentSettings;
  readings: CurrentReadings | null;
}) {
  if (!s.topology)
    return (
      <div className="bcl-unwired" data-testid="current-unwired">
        <span aria-hidden="true">＋ ─ ◯ ─ −</span>
        <strong>先选择串联或并联</strong>
        <p>接线后，这里会显示真实的电流回路。</p>
      </div>
    );
  const parallel = s.topology === "parallel",
    series = s.topology === "series";
  const resistor = (
    x: number,
    y: number,
    label: string,
    value: number | null,
  ) => (
    <g>
      <rect
        x={x - 28}
        y={y - 10}
        width="56"
        height="20"
        rx="2"
        fill="#f7f4e8"
        stroke="#7c7460"
        strokeWidth="2"
      />
      <text x={x} y={y - 21} textAnchor="middle" className="bcl-circuit-label">
        {label} = {value ?? "?"} Ω
      </text>
    </g>
  );
  const lamp = (x: number, y: number, label: "A" | "B", resistance: number) => (
    <g>
      <circle
        cx={x}
        cy={y}
        r="22"
        fill={readings ? "#f7e3a4" : "#eef0e5"}
        stroke="#6d805c"
        strokeWidth="2"
      />
      <path
        d={`M${x - 13} ${y - 13} l26 26 M${x + 13} ${y - 13} l-26 26`}
        stroke="#9d8c54"
        strokeWidth="2"
      />
      <text x={x} y={y - 32} textAnchor="middle" className="bcl-circuit-label">
        灯 {label} · {resistance} Ω
      </text>
      <text
        x={x}
        y={y + 43}
        textAnchor="middle"
        className="bcl-circuit-reading"
      >
        {readings
          ? `${labFormat(label === "A" ? readings.ia : readings.ib)} A`
          : "待测量"}
      </text>
    </g>
  );
  return (
    <svg
      viewBox="0 0 600 310"
      role="img"
      aria-label={`${currentTopologyNames[s.topology]}电路。电源先经过公共电阻 R0，${parallel ? "分为 R1 与灯 A 串联、R2 与灯 B 串联的两条并联支路，再汇合返回电源" : series ? "再依次经过 R1、灯 A、灯 B、R2，返回电源" : "再经过 R1 与灯 A，返回电源"}。`}
      data-current-topology={s.topology}
    >
      <g fill="none" stroke="#62847b" strokeWidth="3" strokeLinejoin="round">
        <path d="M50 120 V65 H550" />
        {parallel ? (
          <>
            <path d="M225 65 V210 H550 V65 M550 210 V268 H50 V180" />
            <circle cx="225" cy="65" r="3" fill="#62847b" />
            <circle cx="550" cy="210" r="3" fill="#62847b" />
          </>
        ) : series ? (
          <path d="M550 65 V210 H50 V180" />
        ) : (
          <path d="M550 65 V268 H50 V180" />
        )}
      </g>
      <circle
        cx="50"
        cy="150"
        r="30"
        fill="#e5eddf"
        stroke="#62847b"
        strokeWidth="2"
      />
      <text x="50" y="145" textAnchor="middle" className="bcl-source-sign">
        ＋
      </text>
      <text x="50" y="165" textAnchor="middle" className="bcl-source-sign">
        −
      </text>
      <text x="50" y="202" textAnchor="middle" className="bcl-circuit-label">
        {s.voltage ?? "?"} V
      </text>
      {resistor(135, 65, "R₀", s.common)}
      {resistor(310, 65, "R₁", s.ballastA)}
      {lamp(435, 65, "A", c.lampA)}
      {s.topology !== "single" && (
        <>
          {resistor(310, 210, "R₂", s.ballastB)}
          {lamp(435, 210, "B", c.lampB)}
        </>
      )}
      <text x="135" y="100" textAnchor="middle" className="bcl-circuit-reading">
        {readings ? `总 ${labFormat(readings.sourceI)} A →` : "总电流 →"}
      </text>
      {parallel && (
        <>
          <text x="250" y="130" textAnchor="middle" className="bcl-node-label">
            分流
          </text>
          <text x="552" y="153" textAnchor="middle" className="bcl-node-label">
            汇合
          </text>
        </>
      )}
      {series && (
        <text x="320" y="157" textAnchor="middle" className="bcl-node-label">
          只有一条电流路径 · 两灯电流相等
        </text>
      )}
      {s.topology === "single" && (
        <text x="340" y="180" textAnchor="middle" className="bcl-node-label">
          灯 B 未接入 · 回路经过灯 A
        </text>
      )}
      <text x="305" y="295" textAnchor="middle" className="bcl-circuit-label">
        灯路端电压：{readings ? `${labFormat(readings.busV)} V` : "待测量"}
        （公共电阻之后的整个灯路）
      </text>
    </svg>
  );
}
export default function CurrentCircuitLab(props: GameProps) {
  return (
    <CurrentExperiment key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function CurrentExperiment({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const c = currentCircuitLevels[level] ?? currentCircuitLevels[0];
  const [state, setState] = useState(() => createCurrentState(c)),
    [hintOpen, setHintOpen] = useState(false);
  const seenHint = useRef(hintToken),
    seenUndo = useRef(undoToken),
    completed = useRef(false);
  const result = evaluateCurrent(c, state.settings),
    won = isCurrentSolved(c, state),
    locked = paused || won,
    measured = state.tested ? result.readings : null;
  const previousTrial = [...state.history]
    .reverse()
    .find((snapshot) => snapshot.tested);
  const previousResult = previousTrial
    ? evaluateCurrent(c, previousTrial.settings)
    : null;
  const hint = useMemo(
    () => (hintOpen ? currentHint(c, state) : ""),
    [c, state, hintOpen],
  );
  useEffect(() => {
    onStatus(
      "选择实际接线与电阻，先预测每盏灯的电流，再通电测量。所有目标必须同时匹配。",
    );
  }, []);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (paused || won) return;
    setHintOpen(true);
    onStatus(currentHint(c, state));
  }, [hintToken, paused, won, c, state, onStatus]);
  useEffect(() => {
    if (seenUndo.current === undoToken) return;
    seenUndo.current = undoToken;
    if (paused) return;
    const next = undoCurrent(state);
    setState(next);
    onStatus(
      next === state
        ? "还没有步骤可以撤销。"
        : "已撤销一次接线、参数或测量。提示会继续跟随当前电路。",
    );
  }, [undoToken, paused, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !completed.current) {
      completed.current = true;
      onStatus("全部电压与电流目标已精确验证！");
      onComplete();
    }
  }, [won, paused, onStatus, onComplete]);
  function act(move: CurrentMove) {
    if (locked) return;
    const next = moveCurrent(c, state, move);
    if (next === state) return;
    setState(next);
    onStatus(
      move.part === "measure"
        ? describeCurrentResult(c, evaluateCurrent(c, next.settings))
        : "电路已更新，旧读数已清空。通电测量新电路。",
    );
  }
  return (
    <div
      className="puzzle-layout bcl-game current-circuit-lab"
      data-current-game
      data-current-won={won}
    >
      <section className="bcl-workbench" aria-label="电流实验室工作台">
        <div className="bcl-heading">
          <div>
            <span className="mini-label">CURRENT / 电流实验室</span>
            <h3>{c.title}</h3>
          </div>
          <span className="bcl-badge">
            {currentCircuitLevels.indexOf(c) + 1} / 12
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
          <CircuitDrawing c={c} settings={state.settings} readings={measured} />
          <p className="bcl-scene-caption">
            理想直流电路 · 灯用固定电阻模型 · 0 Ω 表示导线 ·
            调整参数后需重新测量
          </p>
        </div>
        <p className="bcl-model-values">
          灯 A 固定电阻 {c.lampA} Ω · 灯 B 固定电阻 {c.lampB}{" "}
          Ω（仅双灯接线时接入）。
        </p>
        <div className="bcl-goals" aria-label="电流电压目标">
          {c.goals.map((goal, i) => (
            <div
              key={goal.quantity}
              className={state.tested && result.matched[i] ? "is-matched" : ""}
              data-current-goal={goal.quantity}
              data-matched={
                state.tested && result.matched[i] ? "true" : "false"
              }
            >
              <span>{currentQuantityNames[goal.quantity]}</span>
              <strong>
                目标 {labFormat(goal.target)} {currentUnit(goal.quantity)}
              </strong>
              <small data-current-reading={goal.quantity}>
                {measured
                  ? `实测 ${labFormat(measured[goal.quantity])} ${currentUnit(goal.quantity)} · ${result.matched[i] ? "✓ 达标" : "待调整"}`
                  : "等待通电测量"}
              </small>
            </div>
          ))}
        </div>
        {previousTrial && previousResult && (
          <aside className="bcl-previous" data-testid="current-previous-trial">
            <strong>上一轮测量记录</strong>
            <p>
              {currentParts
                .map(
                  (part) =>
                    `${currentPartNames[part]} ${currentValueLabel(part, previousTrial.settings[part]!)}`,
                )
                .join(" · ")}
            </p>
            <p>{describeCurrentResult(c, previousResult)}</p>
          </aside>
        )}
        <div className="bcl-options">
          {currentParts
            .filter(
              (p) => p !== "ballastB" || c.options.topology[0] !== "single",
            )
            .map((part) => (
              <fieldset key={part}>
                <legend>
                  {currentPartNames[part]}
                  {currentChoices(c, part).length === 1
                    ? " · 固定参数"
                    : " · 请选择"}
                </legend>
                {currentChoices(c, part).length === 1 ? (
                  <p className="bcl-fixed" data-current-fixed={part}>
                    {currentValueLabel(part, currentChoices(c, part)[0])}
                  </p>
                ) : (
                  <div className="bcl-option-row">
                    {currentChoices(c, part).map((value) => (
                      <button
                        key={value}
                        data-current-part={part}
                        data-value={value}
                        aria-label={`${currentPartNames[part]} ${currentValueLabel(part, value)}`}
                        aria-pressed={state.settings[part] === value}
                        className={
                          state.settings[part] === value ? "is-selected" : ""
                        }
                        disabled={locked}
                        onClick={() => act(currentMoveFor(part, value))}
                      >
                        {currentValueLabel(part, value)}
                      </button>
                    ))}
                  </div>
                )}
              </fieldset>
            ))}
        </div>
        <button
          className="bcl-action"
          data-testid="current-measure"
          disabled={
            locked ||
            state.tested ||
            result.kind === "incomplete" ||
            result.kind === "invalid"
          }
          onClick={() => act({ part: "measure" })}
        >
          通电测量 <span aria-hidden="true">→</span>
        </button>
        <p className={`bcl-result ${won ? "bcl-success" : ""}`} role="status">
          {paused
            ? "已暂停，接线与测量操作已锁定。"
            : state.tested
              ? describeCurrentResult(c, result)
              : "读懂回路，选择元件，再测量。没有时间限制。"}
        </p>
        {hintOpen && (
          <p className="bcl-hint" data-testid="current-hint" role="status">
            <strong>当前电路提示</strong>
            {hint}
          </p>
        )}
      </section>
      <aside className="game-notes bcl-notes">
        <span className="mini-label">真实分流 · 欧姆定律 · 精确验证</span>
        <h3>沿着电流路径思考。</h3>
        <p>{c.idea}</p>
        <div className="note">
          <strong>I = V ÷ R · V = I × R</strong>
          <p>串联：R总 = R₀ + R₁ + 灯 A + R₂ + 灯 B，所有元件电流相同。</p>
          <p>
            并联：A 路电阻 = R₁ + 灯 A；B 路电阻 = R₂ + 灯
            B。两路电压相同，总电流 = A 路电流 + B 路电流。
          </p>
          <p>
            公共电阻压降 = 总电流 × R₀。灯路端电压 = 电源电压 − 公共电阻压降。
          </p>
        </div>
        {c === currentCircuitLevels[0] && (
          <div className="bcl-worked" data-testid="current-worked">
            <strong>先算一个例子（不是本关参数）</strong>
            <p>
              8 V 的理想电源接 4 Ω 的灯：I = 8 ÷ 4 = 2 A。再串联一个 4 Ω
              电阻，总电阻变为 8 Ω，电流变为 1 A，灯分到 4 V。
            </p>
            <p>
              固定电阻时，电压增大，电流就按比例增大。现在给本关的灯选择电压。
            </p>
          </div>
        )}
        <details className="bcl-details">
          <summary>查看全部读数与电压账本</summary>
          {measured ? (
            <dl className="bcl-ledger">
              {(["ia", "ib", "va", "vb", "sourceI", "busV"] as const).map(
                (quantity) => (
                  <div key={quantity}>
                    <dt>{currentQuantityNames[quantity]}</dt>
                    <dd>
                      {labFormat(measured[quantity])} {currentUnit(quantity)}
                    </dd>
                  </div>
                ),
              )}
              <div>
                <dt>等效总电阻</dt>
                <dd>{labFormat(measured.equivalentR)} Ω</dd>
              </div>
              <div>
                <dt>公共电阻压降</dt>
                <dd>{labFormat(measured.commonV)} V</dd>
              </div>
              <div>
                <dt>R₁ / R₂ 压降</dt>
                <dd>
                  {labFormat(measured.ballastAV)} /{" "}
                  {labFormat(measured.ballastBV)} V
                </dd>
              </div>
              <div>
                <dt>电源功率</dt>
                <dd>{labFormat(measured.sourcePower)} W</dd>
              </div>
            </dl>
          ) : (
            <p>
              设置完成后点击“通电测量”，这里会显示精确读数。改动接线或参数会清空旧读数。
            </p>
          )}
        </details>
        <details className="bcl-details">
          <summary>理想模型与使用范围</summary>
          <p>
            这是数学模拟，不是实际接线指南。电源最多 12
            V，但实际电路仍可能发热或损坏；不要按游戏读数搭建电路。
          </p>
          <p>
            灯视作恒定正电阻，省略发热后阻值变化、LED
            非线性和电源内阻；导线无电阻。图中的灯色只标识已通电，不用于比较不同灯的真实亮度。
          </p>
          <p>
            只支持图示的单灯、串联、带公共电阻的双支路并联结构，不支持任意接线或桥式网络。计算与达标比较都使用精确分数。
          </p>
        </details>
        <p className="bcl-help">
          Tab 选择控件，Enter /
          空格操作。撤销可恢复接线、参数或测量；重置清空本关。暂停锁定实验，无自动动画，支持减少动态效果。
        </p>
      </aside>
    </div>
  );
}
