// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import {
  edit,
  hint,
  initial,
  inspect,
  irrigationLevels,
  modeNames,
  plotName,
  tankNames,
} from "./irrigationPlanLogic";
import "./irrigationPlan.css";

export default function IrrigationPlan(props: GameProps) {
  return <Round key={`${props.level}:${props.resetToken}`} {...props} />;
}
function Round({ level, paused, hintToken, undoToken, onComplete }: GameProps) {
  const board = irrigationLevels[level] ?? irrigationLevels[0];
  const [history, setHistory] = useState<readonly (readonly number[])[]>(() => [
    initial(board),
  ]);
  const selection = history[history.length - 1],
    view = inspect(board, selection),
    locked = paused || view.won;
  const [message, say] = useState("选一个阀门，比较每块地还差多少水。");
  const [advice, setAdvice] = useState<ReturnType<typeof hint>>(null);
  const usedHint = useRef(hintToken),
    usedUndo = useRef(undoToken),
    reported = useRef(false);
  useEffect(() => {
    if (usedHint.current === hintToken) return;
    usedHint.current = hintToken;
    if (locked) return;
    const next = hint(board, selection);
    setAdvice(next);
    say(
      next
        ? `建议把阀 ${next.valve + 1} 调到「${modeNames[next.mode]}」。尚未改变方案。`
        : "暂时没有找到可用的提示。",
    );
  }, [board, hintToken, locked, selection]);
  useEffect(() => {
    if (usedUndo.current === undoToken) return;
    usedUndo.current = undoToken;
    if (locked) return;
    setAdvice(null);
    if (history.length === 1) {
      say("还没有可以撤销的调整。");
      return;
    }
    setHistory(history.slice(0, -1));
    say("已撤销上一处调整，水量和水箱用量一起恢复。");
  }, [history, locked, undoToken]);
  useEffect(() => {
    if (view.won && !paused && !reported.current) {
      reported.current = true;
      onComplete();
    }
  }, [onComplete, paused, view.won]);

  function setMode(valve: number, mode: number) {
    if (locked) return;
    const next = edit(board, selection, valve, mode);
    if (next === selection) return;
    setHistory([...history, next]);
    setAdvice(null);
    const result = inspect(board, next);
    say(
      !result.underCaps
        ? result.exact
          ? "田块水量都刚好，但有水箱超额。"
          : "有水箱超额，仍可修改方案。"
        : result.doses.some((n, i) => n > board.needs[i])
          ? "有田块浇多了，可缩小喷洒范围或关闭阀门。"
          : `阀 ${valve + 1} 已调为${modeNames[mode]}。`,
    );
  }
  return (
    <div
      className="puzzle-layout irrigation-game"
      data-irrigation-id={board.id}
      data-irrigation-won={view.won}
      data-irrigation-plan={selection.join("")}
      data-irrigation-exact={view.exact}
      data-irrigation-cap={view.underCaps}
      onKeyDown={(e) => {
        if (
          locked ||
          e.repeat ||
          e.ctrlKey ||
          e.altKey ||
          e.metaKey ||
          !/^[1-9]$/.test(e.key)
        )
          return;
        const i = Number(e.key) - 1,
          valve = board.valves[i];
        if (!valve) return;
        e.preventDefault();
        setMode(i, (selection[i] + 1) % valve.modes.length);
      }}
    >
      <section
        className="irrigation-panel"
        tabIndex={0}
        aria-label="灌溉方案，按数字键轮换对应阀门"
      >
        <header>
          <span>灌溉规划 · 第 {level + 1} 关</span>
          <strong>
            {view.doses.filter((n, i) => n === board.needs[i]).length}/
            {board.needs.length} 块达标
          </strong>
        </header>
        <div className="irrigation-tanks" aria-label="独立水箱预算">
          {board.caps.map((cap, i) => (
            <div
              key={i}
              data-irrigation-tank={i}
              data-over={view.spent[i] > cap}
            >
              <b>水箱 {tankNames[i]}</b>
              <span>
                {view.spent[i]} / {cap} 单位
              </span>
              <small>
                {view.spent[i] > cap
                  ? `超出 ${view.spent[i] - cap}`
                  : `余量 ${cap - view.spent[i]}`}
              </small>
            </div>
          ))}
        </div>
        <div
          className="irrigation-plots"
          aria-label="田块水量"
          style={{ "--plots": board.width } as CSSProperties}
        >
          {view.doses.map((n, i) => {
            const goal = board.needs[i],
              status = n === goal ? "刚好" : n > goal ? "过量" : "缺水";
            return (
              <div
                key={i}
                data-irrigation-plot={i}
                data-dose={n}
                data-fill={n === goal ? "exact" : n > goal ? "over" : "low"}
              >
                <strong>{plotName(i)}</strong>
                <span>
                  {n} / {goal}
                </span>
                <small>{status}</small>
              </div>
            );
          })}
        </div>
        <div className="irrigation-valves" aria-label="阀门设置">
          {board.valves.map((valve, i) => (
            <div className="irrigation-valve" key={i}>
              <b>
                阀 {i + 1}
                <small>水箱 {tankNames[valve.tank]}</small>
              </b>
              <div
                className="irrigation-modes"
                role="group"
                aria-label={`阀 ${i + 1} 的喷洒模式`}
              >
                {valve.modes.map((m, j) => (
                  <button
                    key={j}
                    type="button"
                    disabled={locked}
                    aria-pressed={j === selection[i]}
                    data-irrigation-valve={i}
                    data-mode={j}
                    data-hinted={advice?.valve === i && advice.mode === j}
                    aria-label={`阀 ${i + 1} ${modeNames[j]}，${m.plots.length ? m.plots.map(plotName).join("、") + " 田块" : "不供水"}，耗水 ${m.cost}`}
                    onClick={() => setMode(i, j)}
                  >
                    <strong>
                      {modeNames[j]}
                      {j === selection[i] && <span aria-hidden="true"> ✓</span>}
                    </strong>
                    <small>
                      {j === 0
                        ? "不供水"
                        : `${m.plots.map(plotName).join("")} · ${m.cost} 单位`}
                    </small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="irrigation-status" role="status">
          {paused
            ? "已暂停。"
            : view.won
              ? "每块地的水量都刚好，水箱也没有超额！"
              : message}
        </p>
      </section>
      <aside className="game-notes">
        <span className="mini-label">水量 · 重叠 · 预算</span>
        <h3>每块田，刚刚好。</h3>
        <ol>
          <li>选喷洒模式，给按钮列出的每块田加 1 单位。覆盖重叠时水量相加。</li>
          <li>田块左边的数字是当前水量，右边是目标。少了不行，多了也不行。</li>
          <li>
            按钮的耗水量从该阀配属的水箱扣除。每个水箱分别受限，不能借用另一个水箱的余量。
          </li>
        </ol>
        <p>
          可随时修改方案，查看用量变化。触屏直接选模式；键盘聚焦在棋盘内后，按阀门的数字键轮换模式。
        </p>
      </aside>
    </div>
  );
}
