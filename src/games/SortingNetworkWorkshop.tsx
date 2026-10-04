// SPDX-License-Identifier: MIT
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  createSortingState,
  moveSorting,
  sortingBinaryInput,
  sortingHint,
  sortingMoveProblem,
  sortingNetworkLevels,
  sortingPairKey,
  sortingPairLabel,
  sortingPairs,
  traceSorting,
  undoSorting,
  verifySorting,
  type SortingMove,
} from "./sortingNetworkLogic";
import "./sortingNetworkWorkshop.css";

export default function SortingNetworkWorkshop(props: GameProps) {
  return <NetworkLevel key={`${props.level}:${props.resetToken}`} {...props} />;
}
function NetworkLevel({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = sortingNetworkLevels[level] ?? sortingNetworkLevels[0];
  const [state, setState] = useState(() => createSortingState(config));
  const [row, setRow] = useState(2 ** (config.lanes - 1));
  const [hint, setHint] = useState<ReturnType<typeof sortingHint> | null>(null);
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false);
  const report = useMemo(
    () => verifySorting(config, state.gates),
    [config, state.gates],
  );
  const won = report.valid && report.passed === report.total,
    locked = paused || won;
  const pairs = useMemo(() => sortingPairs(config), [config]);
  const input = sortingBinaryInput(config.lanes, row);
  const trace = traceSorting(config, state.gates, input)!;
  const output = trace.at(-1)!,
    previewSorted = output.every(
      (value, i) => i === 0 || output[i - 1] <= value,
    );
  const gateCount = state.gates.flat().filter(Boolean).length;
  const svgWidth = 92 + config.slots.length * 92,
    svgHeight = 86 + config.lanes * 48;
  useEffect(() => {
    onStatus(
      "配置各阶段的比较交换门。小值向上、大值向下，全部 0/1 输入通过才算完成。",
    );
  }, []);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (paused || won) return;
    const next = sortingHint(config, state.gates);
    setHint(next);
    onStatus(next.text);
  }, [hintToken, paused, won, config, state.gates, onStatus]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (paused) return;
    const next = undoSorting(state);
    setState(next);
    setHint(null);
    onStatus(
      next === state ? "还没有门位调整可以撤销。" : "已撤销一次门位调整。",
    );
  }, [undoToken, paused, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus(
        `全部 ${report.total} 组输入通过！用了 ${gateCount} 扇门，网络排序成功。`,
      );
      onComplete();
    }
  }, [won, paused, report.total, gateCount, onComplete, onStatus]);
  function choose(move: SortingMove) {
    if (locked) return;
    const problem = sortingMoveProblem(config, state.gates, move);
    if (problem) {
      onStatus(problem);
      return;
    }
    const next = moveSorting(config, state, move);
    setState(next);
    setHint(null);
    const result = verifySorting(config, next.gates);
    onStatus(
      `网络已更新：${result.passed} / ${result.total} 组输入通过。${result.counterexample ? "可查看失败样例，寻找还没有排好的线。" : "全部输入正确。"}`,
    );
  }
  return (
    <div
      className="puzzle-layout sorting-network"
      data-sorting-game
      data-sorting-won={won}
      data-sorting-gates={JSON.stringify(state.gates)}
      data-sorting-passed={report.passed}
      data-sorting-row={row}
    >
      <section className="sn-workbench" aria-label="排序网络工作台">
        <div className="sn-heading">
          <span className="mini-label">排序网络 · {config.title}</span>
          <strong>
            {report.passed} / {report.total} 组通过
          </strong>
        </div>
        <p className="sn-instruction">
          {paused
            ? "已暂停，门位和预览暂时锁定。"
            : won
              ? "所有输入都能正确排序！"
              : `${config.lanes} 条线，${config.slots.length} 个阶段。小值走上方，大值走下方；同一阶段不能共用一条线。`}
        </p>
        <div className="sn-test-panel">
          <div className="sn-test-heading">
            <strong>预览输入</strong>
            <span>点击位值切换 0 / 1</span>
          </div>
          <div className="sn-switches" aria-label="预览输入开关">
            {input.map((bit, lane) => (
              <button
                key={lane}
                data-sorting-input={lane}
                aria-label={`预览线 ${lane + 1}，当前 ${bit}`}
                aria-pressed={bit === 1}
                disabled={locked}
                className={bit ? "on" : ""}
                onClick={() => setRow(row ^ (1 << (config.lanes - lane - 1)))}
              >
                <small>线 {lane + 1}</small>
                <b>{bit}</b>
              </button>
            ))}
            <button
              className="sn-counterexample"
              data-sorting-counterexample
              disabled={locked || !report.counterexample}
              onClick={() => {
                if (report.counterexample)
                  setRow(parseInt(report.counterexample.input.join(""), 2));
              }}
            >
              查看失败样例
            </button>
          </div>
        </div>
        <div
          className="sn-network-scroll"
          tabIndex={0}
          aria-label="排序网络示意图，可横向滚动"
        >
          <svg
            className="sn-network-svg"
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ width: svgWidth, minWidth: svgWidth }}
            role="img"
            aria-label={`输入 ${input.join("")} 从左到右经过 ${config.slots.length} 个阶段，输出 ${output.join("")}`}
          >
            {config.slots.map((_, stage) => (
              <g key={stage}>
                <rect
                  className="sn-stage-bg"
                  x={49 + stage * 92}
                  y={28}
                  width={86}
                  height={svgHeight - 56}
                  rx={8}
                />
                <text
                  className="sn-stage-name"
                  x={92 + stage * 92}
                  y={18}
                  textAnchor="middle"
                >
                  阶段 {stage + 1}
                </text>
              </g>
            ))}
            {input.map((_, lane) => (
              <g key={lane}>
                <line
                  className="sn-wire"
                  x1={36}
                  x2={svgWidth - 20}
                  y1={54 + lane * 48}
                  y2={54 + lane * 48}
                />
                <text className="sn-lane-name" x={7} y={58 + lane * 48}>
                  {lane + 1}
                </text>
              </g>
            ))}
            {state.gates.map((stage, s) =>
              stage.map(
                (pair, slot) =>
                  pair && (
                    <g
                      key={`${s}:${slot}`}
                      className={`sn-gate ${config.fixed[s][slot] ? "fixed" : ""} ${hint?.move?.stage === s && hint.move.slot === slot ? "hinted" : ""}`}
                      data-sorting-wire={`${s}:${slot}`}
                    >
                      <line
                        x1={68 + s * 92 + slot * 19}
                        x2={68 + s * 92 + slot * 19}
                        y1={54 + pair[0] * 48}
                        y2={54 + pair[1] * 48}
                      />
                      <circle
                        cx={68 + s * 92 + slot * 19}
                        cy={54 + pair[0] * 48}
                        r={5}
                      />
                      <circle
                        cx={68 + s * 92 + slot * 19}
                        cy={54 + pair[1] * 48}
                        r={5}
                      />
                      <text
                        x={68 + s * 92 + slot * 19}
                        y={45 + pair[0] * 48}
                        textAnchor="middle"
                      >
                        小
                      </text>
                      <text
                        x={68 + s * 92 + slot * 19}
                        y={70 + pair[1] * 48}
                        textAnchor="middle"
                      >
                        大
                      </text>
                    </g>
                  ),
              ),
            )}
            {trace.map((values, boundary) =>
              values.map((bit, lane) => (
                <g
                  key={`${boundary}:${lane}`}
                  className={`sn-signal ${bit ? "on" : ""}`}
                >
                  <rect
                    x={28 + boundary * 92}
                    y={43 + lane * 48}
                    width={20}
                    height={22}
                    rx={5}
                  />
                  <text
                    x={38 + boundary * 92}
                    y={59 + lane * 48}
                    textAnchor="middle"
                  >
                    {bit}
                  </text>
                </g>
              )),
            )}
            <text className="sn-stage-name" x={28} y={svgHeight - 10}>
              输入
            </text>
            <text
              className="sn-stage-name"
              x={svgWidth - 65}
              y={svgHeight - 10}
            >
              输出
            </text>
          </svg>
        </div>
        <p
          className={`sn-preview-result ${previewSorted ? "success" : ""}`}
          data-sorting-output={output.join("")}
        >
          当前预览：{input.join(" ")} → <b>{output.join(" ")}</b> ·{" "}
          {previewSorted ? "这一组已排序" : "这一组尚未排序"}
        </p>
        <div className="sn-stages" aria-label="各阶段门位配置">
          {state.gates.map((stage, s) => (
            <fieldset key={s} className="sn-stage">
              <legend>阶段 {s + 1}</legend>
              {stage.map((pair, slot) => (
                <label
                  key={slot}
                  className={
                    hint?.move?.stage === s && hint.move.slot === slot
                      ? "sn-hinted"
                      : ""
                  }
                >
                  <span>
                    门位 {slot + 1}
                    {config.fixed[s][slot] ? " · 固定" : ""}
                  </span>
                  <select
                    data-sorting-stage={s}
                    data-sorting-slot={slot}
                    aria-label={`阶段 ${s + 1} 门位 ${slot + 1}${config.fixed[s][slot] ? "，固定" : ""}`}
                    value={sortingPairKey(pair)}
                    disabled={locked || config.fixed[s][slot] !== null}
                    onChange={(event) => {
                      const selected = pairs.find(
                        (pair) => sortingPairKey(pair) === event.target.value,
                      );
                      choose({ stage: s, slot, pair: selected ?? null });
                    }}
                  >
                    <option value="">直通（不装门）</option>
                    {pairs.map((candidate) => {
                      const key = sortingPairKey(candidate);
                      return (
                        <option
                          key={key}
                          value={key}
                          disabled={
                            key !== sortingPairKey(pair) &&
                            sortingMoveProblem(config, state.gates, {
                              stage: s,
                              slot,
                              pair: candidate,
                            }) !== null
                          }
                        >
                          {sortingPairLabel(candidate)}
                        </option>
                      );
                    })}
                  </select>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <p className="sn-keyboard">
          点击或轻触门位选择接线。Tab 移动焦点，方向键选择门位连接，Enter
          确认；输入按钮支持 Enter / 空格。选“直通”可以移除门。
        </p>
      </section>
      <aside className="game-notes sn-notes">
        <span className="mini-label">比较交换 · 并行 · 全输入验证</span>
        <h3>一张网络，排序所有输入。</h3>
        <p>{config.lesson}</p>
        <div className="sn-rule">
          <strong>一扇门做什么？</strong>
          <p>
            比较相连的两个值：小值送往编号较小的上方线，大值送往下方线。0 在 1
            前面；相等时不变。
          </p>
          <p>每个阶段同时执行，之后才进入下一阶段。线只向右走，没有环路。</p>
        </div>
        <div className="sn-verification" role="status">
          <span>完整验证</span>
          <strong>
            {report.passed} / {report.total}
          </strong>
          <small>逐一检查全部 0/1 输入，绝不抽样</small>
          <div className="sn-meter" aria-hidden="true">
            <span
              style={{ width: `${(100 * report.passed) / report.total}%` }}
            />
          </div>
        </div>
        {report.counterexample && (
          <p className="sn-failure">
            失败样例：<b>{report.counterexample.input.join(" ")}</b> →{" "}
            <b>{report.counterexample.output.join(" ")}</b>。输出中仍有 1 排在 0
            前面。
          </p>
        )}
        <p className="sn-theorem">
          零一原理：固定的比较交换网络只要能排好所有 0/1
          输入，就能排好任意可比较的数值，包括重复值。某一组预览通过还不够。
        </p>
        <p className="sn-budget">
          已装 <b>{gateCount} 扇门</b> / 最多{" "}
          {config.slots.reduce((a, b) => a + b, 0)} 扇。
          {config.adjacentOnly
            ? "此关只允许相邻线连接。"
            : "可连接任意两条未冲突的线。"}
          任何正确网络都能通关。
        </p>
        {hint && (
          <p className="sn-hint" role="status">
            {hint.text}
          </p>
        )}
      </aside>
    </div>
  );
}
