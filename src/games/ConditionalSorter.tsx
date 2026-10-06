// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { conditionalSorterLevels } from "./conditionalSorterLevels";
import {
  createSortState,
  materialLabels,
  moveSort,
  parcelLabel,
  shapeLabels,
  sortBinLabel,
  sortConditionLabel,
  sortDomain,
  sortHint,
  sortWon,
  traceSort,
  undoSort,
  verifySort,
  type SortMove,
  type SortParcel,
} from "./conditionalSorterLogic";
import "./conditionalSorter.css";

function Parcel({ parcel }: { parcel: SortParcel }) {
  return (
    <svg
      className={`cs-parcel cs-${parcel.material}`}
      viewBox="0 0 100 94"
      role="img"
      aria-label={parcelLabel(parcel)}
    >
      {parcel.shape === "circle" ? (
        <circle cx="50" cy="44" r="35" />
      ) : parcel.shape === "square" ? (
        <rect x="16" y="10" width="68" height="68" rx="8" />
      ) : (
        <path d="M50 6 91 78 H9 Z" />
      )}
      <text x="50" y="53" textAnchor="middle">
        {parcel.number}
      </text>
      <text className="cs-material" x="50" y="92" textAnchor="middle">
        {materialLabels[parcel.material]}
      </text>
    </svg>
  );
}
export default function ConditionalSorter(props: GameProps) {
  return <SorterLevel key={`${props.level}:${props.resetToken}`} {...props} />;
}
function SorterLevel({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = conditionalSorterLevels[level] ?? conditionalSorterLevels[0];
  const [state, setState] = useState(() => createSortState(config));
  const [selected, setSelected] = useState(0);
  const [hint, setHint] = useState<ReturnType<typeof sortHint> | null>(null);
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false);
  const domain = sortDomain(config),
    report = verifySort(config, state.program),
    won = sortWon(config, state.program),
    locked = paused || won;
  const parcel = domain[selected],
    trace = traceSort(state.program, parcel);
  useEffect(() => {
    onStatus(
      "从上往下检查条件，第一条命中就装箱；全部包裹都正确才通关。先看任务说明与完整测试表。",
    );
  }, []);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (paused || won) return;
    const next = sortHint(config, state.program);
    setHint(next);
    onStatus(next.text);
  }, [hintToken, paused, won, config, state, onStatus]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (paused) return;
    const next = undoSort(state);
    setState(next);
    setHint(null);
    onStatus(
      next === state
        ? "还没有规则编辑可以撤销。"
        : "已撤销一次规则编辑，整条规则的顺序和设置一起恢复。",
    );
  }, [undoToken, paused, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus(`全部 ${domain.length} 种包裹正确分拣！`);
      onComplete();
    }
  }, [won, paused, domain.length, onComplete, onStatus]);
  function act(move: SortMove) {
    if (locked) return;
    const next = moveSort(config, state, move);
    if (next === state) return;
    setState(next);
    setHint(null);
    const result = verifySort(config, next.program);
    onStatus(
      `已更新程序：${result.passed} / ${result.total} 种正确。可以点完整测试表里的包裹查看它的执行路线。`,
    );
  }
  const hinted = (row: number, type: "condition" | "bin") =>
    hint?.move?.type === type && hint.move.row === row;
  return (
    <div
      className="puzzle-layout conditional-sorter"
      data-sorter-game
      data-sorter-won={won}
      data-sorter-program={JSON.stringify(state.program)}
    >
      <section className="cs-workbench" aria-label="条件分拣程序">
        <div className="cs-heading">
          <span className="mini-label">条件分拣 · {config.title}</span>
          <strong>
            {report.passed} / {report.total} 种正确
          </strong>
        </div>
        <p className="cs-instruction">
          {paused
            ? "已暂停，程序暂时锁定。"
            : won
              ? "完整范围通过！程序可以处理每一种包裹。"
              : "按顺序编写 IF / ELSE IF。第一条命中后立即停止；都不命中才走最后的 ELSE。"}
        </p>
        <div className="cs-preview" aria-label="选中包裹的执行过程">
          <Parcel parcel={parcel} />
          <div>
            <strong>{parcelLabel(parcel)}</strong>
            <p>
              要求：{sortBinLabel(config.targets[selected])} · 当前：
              <b>{sortBinLabel(trace.bin)}</b>
            </p>
            <ol>
              {trace.checked.map((row) => (
                <li key={row}>
                  规则 {row + 1}：
                  {sortConditionLabel(state.program.rules[row].condition)} →{" "}
                  {row === trace.row ? "命中，停止检查" : "不满足，继续"}
                </li>
              ))}
              {trace.row === null && (
                <li>没有条件命中 → 否则 {sortBinLabel(trace.bin)}</li>
              )}
            </ol>
          </div>
        </div>
        <div className="cs-program">
          {state.program.rules.map((rule, row) => (
            <article
              className={`cs-rule ${trace.row === row ? "cs-hit" : ""}`}
              key={row}
              data-sorter-rule={row}
            >
              <div className="cs-rule-heading">
                <strong>
                  {row + 1} · {row === 0 ? "如果 IF" : "否则如果 ELSE IF"}
                </strong>
                <div className="cs-order">
                  <button
                    data-sorter-up={row}
                    aria-label={`规则 ${row + 1} 上移`}
                    disabled={locked || row === 0}
                    onClick={() => act({ type: "swap", row, other: row - 1 })}
                  >
                    ↑
                  </button>
                  <button
                    data-sorter-down={row}
                    aria-label={`规则 ${row + 1} 下移`}
                    disabled={locked || row === config.slots - 1}
                    onClick={() => act({ type: "swap", row, other: row + 1 })}
                  >
                    ↓
                  </button>
                </div>
              </div>
              <div className="cs-rule-fields">
                <label>
                  检查条件
                  <select
                    className={hinted(row, "condition") ? "cs-hinted" : ""}
                    data-sorter-condition={row}
                    aria-label={`规则 ${row + 1} 条件`}
                    value={rule.condition ?? ""}
                    disabled={locked}
                    onChange={(event) =>
                      act({
                        type: "condition",
                        row,
                        value: event.target.value || null,
                      })
                    }
                  >
                    <option value="">跳过这条</option>
                    {config.conditions.map((id) => (
                      <option key={id} value={id}>
                        {sortConditionLabel(id)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  命中后送往
                  <select
                    className={hinted(row, "bin") ? "cs-hinted" : ""}
                    data-sorter-bin={row}
                    aria-label={`规则 ${row + 1} 目的箱`}
                    value={rule.bin}
                    disabled={locked || rule.condition === null}
                    onChange={(event) =>
                      act({
                        type: "bin",
                        row,
                        value: Number(event.target.value),
                      })
                    }
                  >
                    {Array.from({ length: config.bins }, (_, bin) => (
                      <option value={bin} key={bin}>
                        {sortBinLabel(bin)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </article>
          ))}
          <div className={`cs-otherwise ${trace.row === null ? "cs-hit" : ""}`}>
            <label>
              <strong>最后的否则 ELSE</strong>
              <span>所有条件都不满足时</span>
              <select
                className={hint?.move?.type === "otherwise" ? "cs-hinted" : ""}
                data-sorter-otherwise
                aria-label="否则目的箱"
                value={state.program.otherwise ?? ""}
                disabled={locked}
                onChange={(event) =>
                  act({ type: "otherwise", value: Number(event.target.value) })
                }
              >
                <option value="" disabled>
                  选择默认箱…
                </option>
                {Array.from({ length: config.bins }, (_, bin) => (
                  <option value={bin} key={bin}>
                    {sortBinLabel(bin)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {report.firstFailure !== null && (
          <button
            className="cs-counterexample"
            data-sorter-counterexample
            disabled={locked}
            onClick={() => setSelected(report.firstFailure!)}
          >
            查看第一个反例：{parcelLabel(domain[report.firstFailure])}
          </button>
        )}
        {hint && (
          <p className="cs-hint" role="status">
            {hint.text}
          </p>
        )}
        <p className="cs-keyboard">
          Tab 选择控件，方向键改变选项，Enter / 空格按按钮。↑ ↓
          按钮交换相邻规则；撤销恢复一次编辑。可以留空规则，但必须选择“否则”箱。
        </p>
      </section>
      <aside className="game-notes cs-notes">
        <span className="mini-label">优先级 · 条件 · 完整验证</span>
        <h3>一套规则，处理所有包裹。</h3>
        <p>{config.lesson}</p>
        <details className="cs-explanation" open={level === 0}>
          <summary>第一次玩：看一个完整例子</summary>
          <p>
            假设规则 1 是“玻璃 → C”，规则 2 是“圆形 → A”，否则去
            B。圆形玻璃先命中规则 1，所以去 C，不会继续去
            A。方形木件两条都不满足，所以去
            B。这是执行方式示例，当前关的要求以任务单为准。
          </p>
          <p>
            “且”表示两项都满足。更具体的例外通常需要放前面。表格列出了本关全部范围，没有隐藏测试。
          </p>
        </details>
        <div className="cs-heading cs-tests-heading">
          <h4>完整测试表</h4>
          <span>
            {config.shapes.length} 形状 × {config.materials.length} 材质 ×{" "}
            {config.numbers.length} 号码
          </span>
        </div>
        <p className="cs-domain">
          {config.shapes.map((s) => shapeLabels[s]).join("、")}；
          {config.materials.map((m) => materialLabels[m]).join("、")}；号码{" "}
          {config.numbers.join("、")}。共 {domain.length} 种，表格可滚动。
        </p>
        <div className="cs-table-wrap">
          <table aria-label={`完整的 ${domain.length} 种包裹测试`}>
            <thead>
              <tr>
                <th>点选包裹</th>
                <th>目标</th>
                <th>当前</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              {domain.map((p, i) => {
                const actual = traceSort(state.program, p).bin,
                  match = actual === config.targets[i];
                return (
                  <tr
                    key={i}
                    className={selected === i ? "cs-selected" : ""}
                    data-sorter-test={i}
                    data-target={config.targets[i]}
                    data-actual={actual ?? "?"}
                  >
                    <td>
                      <button
                        data-sorter-parcel={i}
                        aria-pressed={selected === i}
                        aria-label={`查看 ${parcelLabel(p)}`}
                        disabled={paused}
                        onClick={() => setSelected(i)}
                      >
                        {shapeLabels[p.shape]} · {materialLabels[p.material]} ·{" "}
                        {p.number}
                      </button>
                    </td>
                    <td>{sortBinLabel(config.targets[i])}</td>
                    <td>{sortBinLabel(actual)}</td>
                    <td>
                      {match ? "✓ 对" : actual === null ? "待选" : "× 错"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  );
}
