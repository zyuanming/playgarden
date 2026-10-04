// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  createMachineLockState,
  machineLockHint,
  machineLocksWon,
  machineOutputLabel,
  moveMachineLock,
  stateMachineLocksLevels,
  undoMachineLock,
} from "./stateMachineLocksLogic";
import "./stateMachineLocks.css";
export default function StateMachineLocks(props: GameProps) {
  return <MachineLevel key={`${props.level}:${props.resetToken}`} {...props} />;
}
function MachineLevel({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = stateMachineLocksLevels[level] ?? stateMachineLocksLevels[0];
  const [state, setState] = useState(() => createMachineLockState(config));
  const [hint, setHint] = useState<ReturnType<typeof machineLockHint> | null>(
    null,
  );
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false);
  const board = state.board,
    won = machineLocksWon(config, board),
    trapped = config.forbidden.includes(board.state),
    locked = paused || won || trapped;
  const remaining = board.remaining.reduce((a, b) => a + b, 0);
  useEffect(() => {
    onStatus(
      "输入会立即执行。查看当前状态那一行：状态决定下一站和门锁输出；到达目标状态且每扇门都匹配才通关。",
    );
  }, []);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (paused || won) return;
    const next = machineLockHint(config, board);
    setHint(next);
    onStatus(next.text);
  }, [hintToken, paused, won, config, board, onStatus]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (paused) return;
    const next = undoMachineLock(state);
    setState(next);
    setHint(null);
    onStatus(
      next === state
        ? "还没有输入可以撤销。"
        : "已撤销一次输入，状态、门锁和剩余次数全部恢复。",
    );
  }, [undoToken, paused, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus(
        `状态与全部门锁吻合！用了 ${state.history.length} 步，最短 ${config.par} 步。`,
      );
      onComplete();
    }
  }, [won, paused, state.history.length, config.par, onStatus, onComplete]);
  function act(input: number) {
    if (locked) return;
    const next = moveMachineLock(config, state, input);
    if (next === state) return;
    const transition = config.transitions[board.state][input];
    setState(next);
    setHint(null);
    onStatus(
      `${config.inputs[input].label}：${config.states[board.state]} → ${config.states[next.board.state]}，${machineOutputLabel(config, transition.output)}。${config.forbidden.includes(next.board.state) ? "进入禁止态；请撤销或重置。" : ""}`,
    );
  }
  return (
    <div
      className="puzzle-layout state-machine-locks"
      data-machine-lock-game
      data-machine-lock-state={board.state}
      data-machine-lock-doors={board.doors.map(Number).join("")}
      data-machine-lock-remaining={board.remaining.join(",")}
      data-machine-lock-won={won}
      tabIndex={0}
      aria-label="状态机门锁工作台，数字一至三发送输入"
      onKeyDown={(event) => {
        if (
          locked ||
          event.repeat ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        )
          return;
        if (/^[1-3]$/.test(event.key)) {
          event.preventDefault();
          act(Number(event.key) - 1);
        }
      }}
    >
      <section className="ml-workbench" aria-label="门锁控制器">
        <div className="ml-heading">
          <span className="mini-label">状态机门锁 · {config.title}</span>
          <strong>
            {state.history.length} 步 · 余 {remaining} 次
          </strong>
        </div>
        <p className="ml-instruction">
          {paused
            ? "已暂停，输入暂时锁定。"
            : won
              ? "状态和所有门锁都与目标一致！"
              : trapped
                ? "已进入禁止态。撤销或重置后可以继续。"
                : "每次输入立即消耗一次。必须同时满足目标状态和全部门锁；不必用光输入。"}
        </p>
        <div className="ml-state-display">
          <div>
            <small>当前状态</small>
            <strong>{config.states[board.state]}</strong>
          </div>
          <span aria-hidden="true">→</span>
          <div>
            <small>目标状态</small>
            <strong>{config.states[config.target]}</strong>
          </div>
          <b className="ml-state-match">
            {board.state === config.target ? "✓ 状态吻合" : "待归位"}
          </b>
        </div>
        <div
          className="ml-doors"
          style={{
            gridTemplateColumns: `repeat(${config.doors.length}, minmax(0, 1fr))`,
          }}
          aria-label="当前门锁与目标"
        >
          {config.doors.map((door, i) => (
            <article
              key={door}
              className={`ml-door ${board.doors[i] ? "ml-open" : ""}`}
              data-machine-lock-door={i}
              data-open={board.doors[i]}
            >
              <svg viewBox="0 0 80 80" aria-hidden="true">
                <path
                  className="ml-shackle"
                  d={
                    board.doors[i]
                      ? "M31 37 V22 C31 4 61 4 61 22"
                      : "M23 37 V22 C23 3 57 3 57 22 V37"
                  }
                />
                <rect x="16" y="33" width="48" height="39" rx="9" />
                <circle cx="40" cy="49" r="4" />
                <path d="M40 51 V58" />
              </svg>
              <strong>
                {door} · {board.doors[i] ? "打开" : "关闭"}
              </strong>
              <span>
                目标：{config.targetDoors[i] ? "打开" : "关闭"}{" "}
                {board.doors[i] === config.targetDoors[i] ? "✓" : "×"}
              </span>
            </article>
          ))}
        </div>
        <div className="ml-inputs" aria-label="有限输入库存">
          {config.inputs.map((input, i) => {
            const transition = config.transitions[board.state][i],
              dangerous = config.forbidden.includes(transition.to);
            return (
              <button
                key={input.label}
                data-machine-lock-input={i}
                data-remaining={board.remaining[i]}
                disabled={locked || board.remaining[i] === 0}
                className={`${hint?.input === i ? "ml-hinted" : ""} ${dangerous ? "ml-danger-input" : ""}`}
                aria-label={`${i + 1}：${input.label}，剩余 ${board.remaining[i]} 次，前往 ${config.states[transition.to]}，${machineOutputLabel(config, transition.output)}`}
                onClick={() => act(i)}
              >
                <span className="ml-input-top">
                  <kbd>{i + 1}</kbd>
                  <span>余 {board.remaining[i]} 次</span>
                </span>
                <strong>
                  {input.symbol} {input.label}
                </strong>
                <span>
                  → {config.states[transition.to]}
                  {dangerous ? " ⚠" : ""}
                </span>
                <small>{machineOutputLabel(config, transition.output)}</small>
              </button>
            );
          })}
        </div>
        {(trapped || (remaining === 0 && !won)) && (
          <p className="ml-alert" role="status">
            {trapped ? "禁止态会停止机器。" : "输入已用完，目标尚未达成。"}
            撤销会归还输入并恢复门锁。
          </p>
        )}
        {hint && (
          <p className="ml-hint" role="status">
            {hint.text}
          </p>
        )}
        <div className="ml-history" aria-label="输入与门锁历史">
          <h4>执行轨迹</h4>
          <ol>
            <li>
              <b>出发：{config.states[config.start]}</b>
              <span>
                {config.doors
                  .map(
                    (door, i) =>
                      `${door}${config.initialDoors[i] ? "开" : "关"}`,
                  )
                  .join(" · ")}
              </span>
            </li>
            {state.history.map((step, index) => {
              const t = config.transitions[step.board.state][step.input];
              const after =
                index + 1 === state.history.length
                  ? board
                  : state.history[index + 1].board;
              return (
                <li key={index} data-machine-lock-history={index}>
                  <b>
                    {index + 1}. {config.inputs[step.input].label}：
                    {config.states[step.board.state]} → {config.states[t.to]}
                  </b>
                  <span>
                    {machineOutputLabel(config, t.output)}；
                    {config.doors
                      .map(
                        (door, i) => `${door}${after.doors[i] ? "开" : "关"}`,
                      )
                      .join(" · ")}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="ml-keyboard">
          点击输入，或聚焦工作台后按 1–3。Tab、Enter / 空格也可操作。翻转 =
          开变关、关变开；“锁不变”不会重置其他门。
        </p>
      </section>
      <aside className="game-notes ml-notes">
        <span className="mini-label">记忆状态 · 有限资源 · 输出</span>
        <h3>先读当前行，再发送输入。</h3>
        <p>{config.lesson}</p>
        <details className="ml-explanation" open={level === 0}>
          <summary>第一次玩：完整演示</summary>
          <p>
            第一关从“待机、月门关闭”开始。待机收到 A → 待验，锁不变；待验收到 B
            → 待机，月门翻转为打开。因此 A、B
            后，状态和门锁都满足第一关目标。若一开始发 B，就会进入禁止态。
          </p>
          <p>
            之后每关的状态表都不同。输入的名称并不保证固定功能；例如 C
            也可能关门，必须读表。暂停会冻结输入，撤销恢复整步。
          </p>
        </details>
        <h4 className="ml-table-title">完整状态转移表</h4>
        <p className="ml-table-help">
          每格：下一状态 / 门锁输出。标有“当前”的行决定现在的操作；⚠
          表示禁止态。
        </p>
        <div className="ml-table-wrap">
          <table aria-label="全部状态与输入的转移规则">
            <thead>
              <tr>
                <th>当前状态</th>
                {config.inputs.map((input) => (
                  <th key={input.label}>{input.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {config.states.map((name, s) => (
                <tr
                  key={name}
                  className={s === board.state ? "ml-current-row" : ""}
                  data-machine-lock-rule-state={s}
                >
                  <th>
                    {name}
                    {s === board.state && <small>当前</small>}
                    {s === config.target && <small>目标</small>}
                    {config.forbidden.includes(s) && <small>⚠ 停机</small>}
                  </th>
                  {config.transitions[s].map((t, i) => (
                    <td
                      key={i}
                      className={
                        config.forbidden.includes(t.to)
                          ? "ml-forbidden-cell"
                          : ""
                      }
                    >
                      <strong>
                        {config.states[t.to]}
                        {config.forbidden.includes(t.to) ? " ⚠" : ""}
                      </strong>
                      <span>{machineOutputLabel(config, t.output)}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ml-footnote">
          禁止态无法继续输入。状态表包含每个状态和每一种输入，没有隐藏转移。门锁与库存也是机器记忆的一部分。
        </p>
      </aside>
    </div>
  );
}
