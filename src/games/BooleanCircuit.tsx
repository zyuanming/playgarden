// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  booleanCircuitLevels,
  circuitHint,
  circuitInputs,
  circuitNextMove,
  circuitOpLabels,
  circuitOps,
  circuitSourceLabel,
  circuitSources,
  circuitTruthTable,
  circuitWon,
  createCircuitState,
  evaluateCircuit,
  moveCircuit,
  undoCircuit,
  type CircuitMove,
  type CircuitSource,
} from "./booleanCircuitLogic";
import "./booleanCircuit.css";

export default function BooleanCircuit(props: GameProps) {
  return <CircuitLevel key={`${props.level}:${props.resetToken}`} {...props} />;
}
function CircuitLevel({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = booleanCircuitLevels[level] ?? booleanCircuitLevels[0];
  const [state, setState] = useState(() => createCircuitState(config));
  const [row, setRow] = useState(0);
  const [hint, setHint] = useState<CircuitMove | null>(null);
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false);
  const won = circuitWon(config, state.gates),
    locked = paused || won;
  const truth = circuitTruthTable(config, state.gates),
    values = evaluateCircuit(config, state.gates, row);
  const inputs = circuitInputs(config, row),
    matched = truth.filter((bit, i) => bit === config.target[i]).length;
  useEffect(() => {
    onStatus(
      "给每扇门选择类型和接线，让完整真值表的每一行都匹配。最后一扇门是输出。",
    );
  }, []);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (paused || won) return;
    setHint(circuitNextMove(config, state.gates));
    onStatus(circuitHint(config, state.gates));
  }, [hintToken, paused, won, config, state, onStatus]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (paused) return;
    const next = undoCircuit(state);
    setState(next);
    setHint(null);
    onStatus(
      next === state ? "还没有接线可以撤销。" : "已撤销一次门类型或接线调整。",
    );
  }, [undoToken, paused, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus("每一种输入都验证通过，电路设计成功！");
      onComplete();
    }
  }, [won, paused, onComplete, onStatus]);
  function choose(move: CircuitMove) {
    if (locked) return;
    const next = moveCircuit(config, state, move);
    if (next === state) return;
    setState(next);
    setHint(null);
    const matches = circuitTruthTable(config, next.gates).filter(
      (bit, i) => bit === config.target[i],
    ).length;
    onStatus(
      `电路已更新：${matches} / ${config.target.length} 种输入匹配。问号表示还没接完整。`,
    );
  }
  return (
    <div
      className="puzzle-layout boolean-circuit"
      data-circuit-game
      data-circuit-won={won}
    >
      <section className="bc-workbench" aria-label="布尔电路工作台">
        <div className="bc-heading">
          <span className="mini-label">逻辑电路 · {config.title}</span>
          <strong>
            {matched} / {config.target.length} 行匹配
          </strong>
        </div>
        <p className="bc-instruction">
          {paused
            ? "已暂停，电路暂时锁定。"
            : won
              ? "所有组合通过测试！"
              : `把 ${state.gates.length} 扇门全部接好。接线只能来自输入或编号更小的门；最后一扇门控制灯。`}
        </p>
        <div className="bc-signal-rack" aria-label="测试输入开关">
          {config.inputs.map((name, i) => (
            <button
              key={name}
              className={`bc-switch ${inputs[name] ? "on" : ""}`}
              data-circuit-input={name}
              aria-label={`测试输入 ${name}，当前 ${inputs[name]}`}
              aria-pressed={inputs[name] === 1}
              disabled={locked}
              onClick={() =>
                setRow(row ^ (1 << (config.inputs.length - 1 - i)))
              }
            >
              <span className="bc-bulb" aria-hidden="true" />
              {name}
              <strong>{inputs[name]}</strong>
            </button>
          ))}
          <div
            className={`bc-output ${values.at(-1) === 1 ? "on" : ""}`}
            data-circuit-output={values.at(-1) ?? "?"}
          >
            <span className="bc-bulb" aria-hidden="true" />
            <span>最终输出</span>
            <strong>{values.at(-1) ?? "?"}</strong>
          </div>
        </div>
        <div className="bc-gates">
          {state.gates.map((gate, i) => (
            <article
              key={i}
              className={`bc-gate ${hint?.gate === i ? "bc-hinted" : ""}`}
              data-circuit-gate={i}
              data-value={values[i] ?? "?"}
            >
              <div className="bc-gate-heading">
                <h4>
                  门 {i + 1}{" "}
                  {i === state.gates.length - 1 && <small>最终输出</small>}
                </h4>
                <span
                  className={`bc-value ${values[i] === 1 ? "on" : ""}`}
                  aria-label={`门 ${i + 1} 当前输出 ${values[i] ?? "未连接"}`}
                >
                  {values[i] ?? "?"}
                </span>
              </div>
              <fieldset className="bc-ops">
                <legend>门 {i + 1} 的类型</legend>
                {circuitOps.map((op) => (
                  <button
                    key={op}
                    data-circuit-op={op}
                    data-gate-index={i}
                    aria-label={`门 ${i + 1} 设为${circuitOpLabels[op]}`}
                    aria-pressed={gate.op === op}
                    disabled={locked}
                    className={`${gate.op === op ? "selected" : ""} ${hint?.gate === i && hint.field === "op" && hint.value === op ? "bc-hint-control" : ""}`}
                    onClick={() => choose({ gate: i, field: "op", value: op })}
                  >
                    {circuitOpLabels[op]}
                  </button>
                ))}
              </fieldset>
              <div className="bc-connections">
                <div className="bc-ports">
                  {(["a", "b"] as const).map((field) => (
                    <label
                      key={field}
                      className={
                        field === "b" && gate.op === "NOT" ? "bc-unused" : ""
                      }
                    >
                      <span>
                        {field === "a" ? "左端" : "右端"}
                        {field === "b" && gate.op === "NOT"
                          ? " · 非门不使用"
                          : ""}
                      </span>
                      <select
                        aria-label={`门 ${i + 1} ${field === "a" ? "左" : "右"}端接线`}
                        data-circuit-field={field}
                        data-gate-index={i}
                        className={
                          hint?.gate === i && hint.field === field
                            ? "bc-hint-control"
                            : ""
                        }
                        value={gate[field] ?? ""}
                        disabled={
                          locked || (field === "b" && gate.op === "NOT")
                        }
                        onChange={(event) =>
                          choose({
                            gate: i,
                            field,
                            value: event.target.value as CircuitSource,
                          })
                        }
                      >
                        <option value="" disabled>
                          选择信号…
                        </option>
                        {circuitSources(config, i).map((source) => (
                          <option key={source} value={source}>
                            {circuitSourceLabel(source)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <svg
                  className="bc-wire"
                  viewBox="0 0 56 100"
                  aria-hidden="true"
                >
                  <path d="M0 24 H15 V50 H46" />
                  <path
                    d="M0 78 H15 V50"
                    opacity={gate.op === "NOT" ? 0.15 : 1}
                  />
                  <path d="m39 44 7 6-7 6" />
                </svg>
                <div className="bc-symbol">
                  <strong>
                    {gate.op === "AND"
                      ? "&"
                      : gate.op === "OR"
                        ? "≥1"
                        : gate.op === "NOT"
                          ? "¬"
                          : "?"}
                  </strong>
                  <small>{gate.op ?? "待选"}</small>
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="bc-footnote">
          0 = 关闭，1 = 打开。输入开关只改变预览；通关会检查完整真值表。Tab
          选择控件，方向键选接线，Enter / 空格按按钮。
        </p>
      </section>
      <aside className="game-notes bc-notes">
        <span className="mini-label">组合 · 接线 · 验证</span>
        <h3>让每一种输入都正确。</h3>
        <p>{config.lesson}</p>
        <div className="bc-table-wrap">
          <table aria-label="完整真值表">
            <thead>
              <tr>
                {config.inputs.map((name) => (
                  <th key={name}>{name}</th>
                ))}
                <th>目标</th>
                <th>电路</th>
                <th>验证</th>
              </tr>
            </thead>
            <tbody>
              {config.target.map((target, i) => (
                <tr
                  key={i}
                  data-circuit-row={i}
                  data-output={truth[i] ?? "?"}
                  data-target={target}
                  className={`${i === row ? "bc-active-row" : ""} ${truth[i] === target ? "bc-match" : ""}`}
                >
                  {config.inputs.map((name) => (
                    <td key={name}>{circuitInputs(config, i)[name]}</td>
                  ))}
                  <td>
                    <b>{target}</b>
                  </td>
                  <td>{truth[i] ?? "?"}</td>
                  <td
                    aria-label={
                      truth[i] === null
                        ? "未接完整"
                        : truth[i] === target
                          ? "匹配"
                          : "不匹配"
                    }
                  >
                    {truth[i] === null
                      ? "待接"
                      : truth[i] === target
                        ? "✓"
                        : "×"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="bc-legend">
          <div>
            <dt>与 AND</dt>
            <dd>两个输入都是 1 才输出 1</dd>
          </div>
          <div>
            <dt>或 OR</dt>
            <dd>至少一个输入为 1 就输出 1</dd>
          </div>
          <div>
            <dt>非 NOT</dt>
            <dd>只用左端，把 0 和 1 对调</dd>
          </div>
        </dl>
        {hint && (
          <p className="bc-hint-text" role="status">
            {circuitHint(config, state.gates)}
          </p>
        )}
      </aside>
    </div>
  );
}
