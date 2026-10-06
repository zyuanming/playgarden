// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { concurrentKitchenLevels } from "./concurrentKitchenLevels";
import {
  createKitchenState,
  editKitchen,
  inspectKitchen,
  kitchenHint,
  kitchenStationLabels,
  kitchenStations,
  undoKitchen,
  type KitchenPlacement,
  type KitchenStation,
} from "./concurrentKitchenLogic";
import "./concurrentKitchen.css";

const taskColors = [
  "#f3c7a8",
  "#c7dcf3",
  "#e4d1f2",
  "#cde5b7",
  "#f4dda0",
  "#bce2de",
  "#e8c5d8",
  "#d2d7ed",
];
function StationDrawing({ station }: { station: KitchenStation }) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false">
      {station === "prep" ? (
        <>
          <path d="M7 28h50v7H7zM13 35v8M51 35v8" />
          <path d="m22 21 7-10 8 10zM38 18h12v8H38z" />
          <circle cx="17" cy="21" r="5" />
        </>
      ) : station === "oven" ? (
        <>
          <rect x="10" y="6" width="44" height="37" rx="5" />
          <path d="M10 16h44" />
          <circle cx="18" cy="11" r="1" />
          <circle cx="25" cy="11" r="1" />
          <rect x="17" y="22" width="30" height="15" rx="3" />
          <path d="M23 28h18M23 32h18" />
        </>
      ) : (
        <>
          <ellipse cx="32" cy="28" rx="25" ry="12" />
          <ellipse cx="32" cy="28" rx="17" ry="7" />
          <path d="m24 26 4-9 5 9 6-10 4 11" />
        </>
      )}
    </svg>
  );
}
export default function ConcurrentKitchen(props: GameProps) {
  return <KitchenLevel key={`${props.level}:${props.resetToken}`} {...props} />;
}
function KitchenLevel({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = concurrentKitchenLevels[level] ?? concurrentKitchenLevels[0];
  const [state, setState] = useState(createKitchenState);
  const [selected, setSelected] = useState(config.tasks[0].id);
  const [hint, setHint] = useState<ReturnType<typeof kitchenHint> | null>(null);
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false);
  const report = inspectKitchen(config, state.schedule),
    won = report.complete,
    locked = paused || won;
  const chosen = config.tasks.find((task) => task.id === selected)!;
  const start = state.schedule[selected];
  const stations = kitchenStations.filter((station) =>
    config.tasks.some((task) => task.station === station),
  );
  const issueTasks = new Set(report.issues.flatMap((issue) => issue.tasks));
  useEffect(() => {
    onStatus(
      "安排时间表，不用抢时间。选一个工序，再选开始刻度；同一台不能重叠，前置工序必须先结束。",
    );
  }, []);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (locked) return;
    const result = kitchenHint(config, state.schedule);
    setHint(result);
    if (result.move) setSelected(result.move.task);
    onStatus(result.text);
  }, [hintToken, locked, config, state.schedule, onStatus]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (locked) return;
    const previous = undoKitchen(config, state);
    setState(previous);
    setHint(null);
    onStatus(
      previous === state
        ? "还没有时间表编辑可以撤销。"
        : "已撤销一次编辑。重新查看空档和前置关系。",
    );
  }, [undoToken, locked, config, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus(
        `全部 ${config.tasks.length} 个工序在刻度 ${report.makespan} 前完成，没有争用或先后冲突！`,
      );
      onComplete();
    }
  }, [won, paused, config.tasks.length, report.makespan, onStatus, onComplete]);
  function act(move: KitchenPlacement) {
    if (locked) return;
    const next = editKitchen(config, state, move);
    if (next === state) return;
    setState(next);
    setHint(null);
    const nextReport = inspectKitchen(config, next.schedule);
    onStatus(
      nextReport.issues[0]?.text ??
        (move.start === null
          ? `已把 ${move.task} 移出时间轴。其他工序保留，可继续调整。`
          : `${move.task} 从刻度 ${move.start} 开始。已安排 ${nextReport.assigned} / ${config.tasks.length} 个工序。`),
    );
  }
  return (
    <div
      className="puzzle-layout concurrent-kitchen"
      data-kitchen-game
      data-kitchen-schedule={JSON.stringify(state.schedule)}
      data-kitchen-won={won}
      data-kitchen-selected={selected}
      data-kitchen-conflicts={report.issues.length}
    >
      <section className="ck-workbench" aria-label="并发厨房时间表">
        <div className="ck-heading">
          <div>
            <span className="mini-label">并发厨房 · {config.title}</span>
            <h3>让工作台一起合作</h3>
          </div>
          <div className="ck-deadline">
            <small>截止刻度</small>
            <strong>{config.deadline}</strong>
          </div>
        </div>
        <p className="ck-intro">
          {paused
            ? "已暂停。可以查看时间表，继续后才能修改。"
            : won
              ? "时间表完成！仍可选工序查看；想再排一种方案，请用重来。"
              : `把 ${config.tasks.length} 个工序放进 0→${config.deadline} 的时间表。没有倒计时，慢慢想。`}
        </p>
        <div className="ck-station-strip" aria-label="工作台容量">
          {stations.map((station) => (
            <div key={station}>
              <StationDrawing station={station} />
              <span>
                {kitchenStationLabels[station]}
                <small>同时 1 个工序</small>
              </span>
            </div>
          ))}
        </div>
        <div className="ck-timeline-heading">
          <h4>时间轴</h4>
          <span>
            已安排 {report.assigned}/{config.tasks.length} ·
            一个格子是一个抽象单位
          </span>
        </div>
        <p className="ck-scroll-cue">
          左右滑动查看完整时间表；也可聚焦时间轴后用方向键滚动。
        </p>
        <div
          className="ck-timeline-scroll"
          tabIndex={0}
          aria-label="时间轴，可横向滚动查看全部刻度"
        >
          <table className="ck-timeline" data-kitchen-timeline>
            <caption>
              左边刻度开始，右边刻度结束。不同台可以重叠，同一台不行。
            </caption>
            <thead>
              <tr>
                <th scope="col">工作台</th>
                {Array.from({ length: config.deadline }, (_, slot) => (
                  <th key={slot} scope="col">
                    {slot}
                    <span>→{slot + 1}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stations.map((station) => (
                <tr key={station}>
                  <th scope="row">{kitchenStationLabels[station]}</th>
                  {Array.from({ length: config.deadline }, (_, slot) => {
                    const occupants = config.tasks.filter(
                      (task) =>
                        task.station === station &&
                        state.schedule[task.id] !== undefined &&
                        state.schedule[task.id] <= slot &&
                        slot < state.schedule[task.id] + task.duration,
                    );
                    return (
                      <td
                        key={slot}
                        data-kitchen-cell={`${station}:${slot}`}
                        className={
                          occupants.length > 1 ? "ck-cell-conflict" : ""
                        }
                        aria-label={`${kitchenStationLabels[station]}，${slot} 到 ${slot + 1}，${occupants.length ? occupants.map((task) => task.id).join("、") : "空闲"}${occupants.length > 1 ? "，争用冲突" : ""}`}
                      >
                        {occupants.length ? (
                          occupants.map((task) => (
                            <span
                              key={task.id}
                              className={`ck-time-task ${task.id === selected ? "ck-time-selected" : ""}`}
                              style={{
                                background:
                                  taskColors[config.tasks.indexOf(task)],
                              }}
                            >
                              {task.id}
                              {occupants.length > 1 && <small>!</small>}
                            </span>
                          ))
                        ) : (
                          <span className="ck-empty" aria-hidden="true">
                            ·
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.issues.length > 0 && (
          <section
            className="ck-conflicts"
            aria-label="待调整的冲突"
            data-kitchen-issues
          >
            <strong>{report.issues.length} 处需要调整</strong>
            <ul>
              {report.issues.map((issue, i) => (
                <li key={i}>{issue.text}</li>
              ))}
            </ul>
            <p>
              可以改开始刻度、移出工序，或用撤销。编辑不会自动移动其他工序。
            </p>
          </section>
        )}
        <div className="ck-task-heading">
          <h4>1 · 选工序</h4>
          <span>选中后有边框与“已选”标记</span>
        </div>
        <div className="ck-task-list" aria-label="工序及前置关系">
          {config.tasks.map((task, index) => {
            const time = state.schedule[task.id],
              needsParent = task.after.some(
                (id) => state.schedule[id] === undefined,
              );
            return (
              <button
                key={task.id}
                data-kitchen-task={task.id}
                aria-pressed={selected === task.id}
                className={`ck-task ${selected === task.id ? "ck-selected" : ""} ${issueTasks.has(task.id) ? "ck-task-conflict" : ""}`}
                aria-label={`${task.id} ${task.name}，${kitchenStationLabels[task.station]}，用 ${task.duration} 格，前置 ${task.after.join("、") || "无"}，${time === undefined ? "未安排" : `${time} 到 ${time + task.duration}`}`}
                onClick={() => setSelected(task.id)}
              >
                <span className="ck-task-top">
                  <b
                    className="ck-badge"
                    style={{ background: taskColors[index] }}
                  >
                    {task.id}
                  </b>
                  <strong>{task.name}</strong>
                  <span className="ck-selected-word">
                    {selected === task.id ? "✓ 已选" : "选择"}
                  </span>
                </span>
                <span className="ck-task-spec">
                  {kitchenStationLabels[task.station]} · {task.duration} 格
                </span>
                <span className="ck-predecessor">
                  前置：
                  {task.after.length
                    ? `${task.after.join(" + ")} 全部结束`
                    : "无，可以直接开始"}
                </span>
                <span className="ck-task-status">
                  {time === undefined
                    ? "未安排"
                    : `${time}→${time + task.duration} · ${issueTasks.has(task.id) ? "需调整 !" : won ? "已验证 ✓" : needsParent ? "前置待安排" : "已安排"}`}
                </span>
              </button>
            );
          })}
        </div>
        <section
          className="ck-editor"
          aria-label={`安排 ${selected}`}
          data-kitchen-editor
        >
          <div className="ck-editor-heading">
            <h4>2 · 给 {selected} 选开始刻度</h4>
            <span>
              {chosen.duration} 格 · {kitchenStationLabels[chosen.station]}
            </span>
          </div>
          <p>
            {chosen.after.length
              ? `必须等 ${chosen.after.join("、")} 全部结束。`
              : "没有前置工序。"}{" "}
            当前：
            {start === undefined
              ? "未安排"
              : `${start}→${start + chosen.duration}`}
            。
          </p>
          <div
            className="ck-start-options"
            aria-label={`${selected} 的开始刻度`}
          >
            {Array.from(
              { length: config.deadline - chosen.duration + 1 },
              (_, time) => (
                <button
                  key={time}
                  data-kitchen-start={time}
                  aria-label={`${selected} 从 ${time} 开始，到 ${time + chosen.duration} 结束`}
                  aria-pressed={start === time}
                  aria-disabled={locked}
                  className={`${start === time ? "ck-start-selected" : ""} ${hint?.move?.task === selected && hint.move.start === time ? "ck-hinted" : ""}`}
                  onClick={() => act({ task: selected, start: time })}
                >
                  <strong>{time}</strong>
                  <small>→{time + chosen.duration}</small>
                </button>
              ),
            )}
          </div>
          <button
            className={`ck-remove ${hint?.move?.task === selected && hint.move.start === null ? "ck-hinted" : ""}`}
            data-kitchen-remove
            aria-disabled={locked || start === undefined}
            onClick={() => act({ task: selected, start: null })}
          >
            移出时间轴：{selected}
          </button>
          <p className="ck-keyboard">
            Tab 选按钮，Enter /
            空格确认。编辑时，开始刻度按钮保留焦点；暂停或通关后只读。无需拖动。
          </p>
        </section>
      </section>
      <aside className="game-notes ck-notes">
        <span className="mini-label">并发 · 依赖 · 资源调度</span>
        <h3>有空台，才能并行。</h3>
        <p>{config.lesson}</p>
        <div className="ck-rule">
          <strong>① 工序不能切开</strong>
          <p>连续占满所需格数；不能做到一半换位置。</p>
        </div>
        <div className="ck-rule">
          <strong>② 接力要等结束</strong>
          <p>例如 A 在 0→2，依赖 A 的工序最早从 2 开始。</p>
        </div>
        <div className="ck-rule">
          <strong>③ 每台只能做一件</strong>
          <p>不同台可同时工作；同一台的区间不能重叠。空档是允许的。</p>
        </div>
        <p className="ck-objective">
          全部工序在刻度 {config.deadline}{" "}
          前或恰好完成就通关。任何满足规则的时间表都算，不要求照抄一种答案。
        </p>
        {hint && (
          <p className="ck-hint" data-kitchen-hint={hint.status} role="status">
            {hint.text}
          </p>
        )}
        <p className="ck-fiction">
          这是抽象调度游戏，格数不是实际烹饪时间，不提供烹饪操作或食品安全指导。
        </p>
      </aside>
    </div>
  );
}
