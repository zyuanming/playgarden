// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { railwayTimetableLevels } from "./railwayTimetableLevels";
import {
  advanceRail,
  createRailState,
  editRail,
  publicRail,
  railHint,
  railPreview,
  railSwitches,
  railWon,
  railRoute,
  undoRail,
  type RailAction,
  type RailHint,
} from "./railwayTimetableLogic";
import { routeBadges } from "./flowRailGeometry";
import "./railwayTimetable.css";
export default function RailwayTimetable(props: GameProps) {
  return <RailRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function RailRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = railwayTimetableLevels[level] ?? railwayTimetableLevels[0],
    puzzle = useMemo(() => publicRail(config), [config]),
    switches = useMemo(() => railSwitches(puzzle), [puzzle]);
  const routes = useMemo(
    () =>
      puzzle.nodes.flatMap((n, from) =>
        n.next.map((to, choice) => ({
          from,
          to,
          choice,
          path: railRoute(puzzle, from, to),
        })),
      ),
    [puzzle],
  );
  const badges = useMemo(
    () =>
      routeBadges(
        puzzle.nodes,
        routes.map((r) => r.path),
      ),
    [puzzle, routes],
  );
  const [state, setState] = useState(() => createRailState(puzzle)),
    [selected, setSelected] = useState(0),
    [hint, setHint] = useState<RailHint | null>(null);
  const root = useRef<HTMLDivElement>(null),
    heading = useRef<HTMLParagraphElement>(null),
    viewport = useRef<HTMLDivElement>(null),
    nodes = useRef<(SVGGElement | null)[]>([]),
    commit = useRef<HTMLButtonElement>(null),
    history = useRef<HTMLOListElement>(null);
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false),
    returnFocus = useRef(false);
  const won = railWon(puzzle, state.board),
    locked = paused || won,
    preview = railPreview(puzzle, state.board, state.controls),
    ended =
      puzzle.deadline !== undefined && state.board.tick >= puzzle.deadline;
  function reveal() {
    const box = viewport.current,
      el = nodes.current[state.board.positions[selected]];
    if (!box || !el) return;
    const b = box.getBoundingClientRect(),
      r = el.getBoundingClientRect();
    if (r.left < b.left) box.scrollLeft -= b.left - r.left + 12;
    else if (r.right > b.right) box.scrollLeft += r.right - b.right + 12;
    if (r.top < b.top) box.scrollTop -= b.top - r.top + 12;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom + 12;
  }
  function choose(action: RailAction) {
    if (locked || ended) return;
    setState((s) => editRail(puzzle, s, action));
    setHint(null);
  }
  function tick() {
    if (locked) return;
    if (!preview.valid) {
      onStatus(preview.reason);
      return;
    }
    setState((s) => advanceRail(puzzle, s));
    setHint(null);
    onStatus(
      `第 ${state.board.tick + 1} 步完成。α 在 ${puzzle.nodes[preview.next.positions[0]].label}，β 在 ${puzzle.nodes[preview.next.positions[1]].label}。`,
    );
  }
  useEffect(() => {
    onStatus(
      "先调道岔与等待信号，再推进一步。两列车同时移动，终点停驻且继续占位；这是简化抽象模型，没有倒计时。",
    );
  }, []);
  useEffect(() => {
    reveal();
  }, [selected, state.board.positions]);
  useEffect(() => {
    if (history.current)
      history.current.scrollTop = history.current.scrollHeight;
  }, [state.history.length]);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (locked) return;
    const next = railHint(puzzle, state);
    setHint(next);
    onStatus(next.text);
  }, [hintToken, locked, puzzle, state, onStatus]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (paused || won) return;
    returnFocus.current = Boolean(
      root.current
        ?.querySelector("[data-rail-hint]")
        ?.contains(document.activeElement),
    );
    setState(undoRail(state));
    setHint(null);
    onStatus(
      state.history.length
        ? "撤销一个完整回合，位置、步数、道岔与等待信号全部恢复。"
        : "还没有已执行的回合。",
    );
  }, [undoToken, paused, won, state, onStatus]);
  useEffect(() => {
    if (paused) setHint(null);
    if (locked && root.current?.contains(document.activeElement))
      heading.current?.focus({ preventScroll: true });
  }, [paused, locked]);
  useEffect(() => {
    if (returnFocus.current) {
      returnFocus.current = false;
      commit.current?.focus({ preventScroll: true });
    }
  }, [hint]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus(`两列车都已安全到达各自终点！用了 ${state.board.tick} 步。`);
      onComplete();
    }
  }, [won, paused, state.board.tick, onStatus, onComplete]);
  const width = Math.max(...puzzle.nodes.map((n) => n.x)) + 155,
    height = Math.max(...puzzle.nodes.map((n) => n.y)) + 165;
  const modified = (e: {
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
  }) => e.ctrlKey || e.metaKey || e.altKey;
  return (
    <div
      ref={root}
      className="puzzle-layout railway-timetable"
      data-rail-game
      data-rail-tick={state.board.tick}
      data-rail-won={won}
      onKeyDown={(event) => {
        if (modified(event) || locked) return;
        const target = event.target as HTMLElement;
        if (
          target.hasAttribute("data-rail-train") &&
          (event.key === "ArrowLeft" || event.key === "ArrowRight")
        ) {
          event.preventDefault();
          setSelected(1 - selected);
          const button = root.current?.querySelector<HTMLButtonElement>(
            `[data-rail-train="${1 - selected}"]`,
          );
          button?.focus({ preventScroll: true });
        } else if (
          event.key.toLowerCase() === "n" &&
          !["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)
        ) {
          event.preventDefault();
          tick();
        }
      }}
    >
      <section className="rt-workbench" aria-label="双列车回合调度工作台">
        <div className="rt-heading">
          <span className="mini-label">列车时刻 · {config.title}</span>
          <strong>
            第 {state.board.tick} 步
            {puzzle.deadline !== undefined
              ? ` / 限 ${puzzle.deadline} 步`
              : " · 不限步数"}
          </strong>
        </div>
        <p ref={heading} tabIndex={-1} className="rt-instruction">
          {paused
            ? "已暂停。"
            : won
              ? "α 与 β 都已到站！"
              : ended
                ? "步数已用完，请撤销或重来。"
                : "① 调道岔 / 等待　② 检查预览　③ 推进一步。"}
        </p>
        <div className="rt-trains">
          {state.board.positions.map((p, i) => (
            <button
              key={i}
              data-rail-train={i}
              data-rail-position={p}
              aria-pressed={selected === i}
              disabled={paused}
              onClick={(event) => {
                if (modified(event)) return;
                setSelected(i);
              }}
            >
              <strong>
                {i === 0 ? "α 橙车" : "β 蓝车"}
                {p === puzzle.goals[i] ? " · 已停驻" : ""}
              </strong>
              <span>
                现在 {puzzle.nodes[p].label} → 终点{" "}
                {puzzle.nodes[puzzle.goals[i]].label}
              </span>
              <small>
                {selected === i ? "正在跟随此车" : "点击在图上跟随"}
              </small>
            </button>
          ))}
        </div>
        <p className="rt-scroll-cue">
          ↔ ↕
          线路图可横向、纵向滚动。选择列车后，每步只在图内跟随；全部站点、出口与终点也列在下方。交叉不代表连接，只在标出的站点连接；模型不计算无站点交叉处的碰撞。
        </p>
        <div
          className="rt-map-viewport"
          ref={viewport}
          tabIndex={0}
          aria-label="可滚动线路图；完整文字线路表在下方"
        >
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
            className="rt-map"
          >
            <defs>
              <marker
                id={`rt-arrow-${level}`}
                markerWidth="10"
                markerUnits="userSpaceOnUse"
                markerHeight="10"
                refX="9"
                refY="4"
                orient="auto"
              >
                <path d="M0 0L9 4L0 8" fill="#455d73" />
              </marker>
            </defs>
            {routes.map(({ from, to, choice, path }, index) => {
              const sw = switches.indexOf(from),
                active = sw < 0 || state.controls.switches[sw] === choice;
              const label = badges[index];
              return (
                <g key={`${from}:${to}`}>
                  <path
                    data-rail-route={index}
                    d={path
                      .map((p, j) => `${j ? "L" : "M"}${p.x} ${p.y}`)
                      .join(" ")}
                    fill="none"
                    stroke={active ? "#455d73" : "#6b7f91"}
                    strokeWidth={active ? 3 : 2}
                    strokeDasharray={active ? undefined : "5 5"}
                    markerEnd={`url(#rt-arrow-${level})`}
                  />
                  {label && (
                    <g data-rail-route-label={index}>
                      <line
                        x1={label.anchor.x}
                        y1={label.anchor.y}
                        x2={label.x}
                        y2={label.y}
                        stroke="#455d73"
                        strokeWidth="1"
                      />
                      <rect
                        x={label.x - 11}
                        y={label.y - 10}
                        width="22"
                        height="20"
                        rx="5"
                        fill="#fff"
                        stroke="#455d73"
                      />
                      <text
                        className="rt-edge-id"
                        x={label.x}
                        y={label.y + 4}
                        textAnchor="middle"
                      >
                        {index + 1}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
            {puzzle.nodes.map((n, i) => {
              const train = state.board.positions.indexOf(i),
                goals = puzzle.goals.flatMap((g, t) =>
                  g === i ? [t === 0 ? "α 终点" : "β 终点"] : [],
                );
              return (
                <g
                  key={i}
                  ref={(el) => {
                    nodes.current[i] = el;
                  }}
                  data-rail-map-node={i}
                >
                  <rect
                    x={n.x - 29}
                    y={n.y - 27}
                    width="58"
                    height="54"
                    rx="13"
                    fill={
                      train === 0 ? "#ffe4bf" : train === 1 ? "#d9eafb" : "#fff"
                    }
                    stroke={train === selected ? "#994408" : "#455d73"}
                    strokeWidth={train === selected ? 4 : 2}
                  />
                  <text x={n.x} y={n.y - 6} textAnchor="middle">
                    {n.label}
                  </text>
                  <text
                    className="rt-train-symbol"
                    x={n.x}
                    y={n.y + 16}
                    textAnchor="middle"
                  >
                    {train === 0
                      ? "α"
                      : train === 1
                        ? "β"
                        : switches.includes(i)
                          ? "道岔"
                          : "·"}
                  </text>
                  <text
                    className="rt-goal-symbol"
                    x={n.x}
                    y={n.y + 48}
                    textAnchor="middle"
                  >
                    {goals.join(" / ")}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <fieldset disabled={locked || ended} className="rt-controls">
          <legend>1 · 出发前设置道岔（整张图共用）</legend>
          {switches.length === 0 ? (
            <p>本关没有道岔，只需安排等待信号。</p>
          ) : (
            switches.map((node, s) => (
              <div className="rt-switch" key={node}>
                <strong>{puzzle.nodes[node].label} 道岔</strong>
                {puzzle.nodes[node].next.map((dest, choice) => (
                  <button
                    key={dest}
                    data-rail-switch={`${s}:${choice}`}
                    aria-pressed={state.controls.switches[s] === choice}
                    onClick={(event) => {
                      if (modified(event)) return;
                      const values = state.controls.switches.slice();
                      values[s] = choice;
                      choose({ ...state.controls, switches: values });
                    }}
                  >
                    {puzzle.nodes[node].label} → {puzzle.nodes[dest].label}
                  </button>
                ))}
              </div>
            ))
          )}
        </fieldset>
        <fieldset disabled={locked || ended} className="rt-controls">
          <legend>2 · 等待信号（设置会延续到下一步）</legend>
          <div className="rt-signals">
            {puzzle.holdAllowed.map((allowed, i) => (
              <button
                key={i}
                data-rail-hold={i}
                disabled={!allowed || locked || ended}
                aria-pressed={state.controls.holds[i]}
                onClick={(event) => {
                  if (modified(event)) return;
                  const holds: [boolean, boolean] = [...state.controls.holds];
                  holds[i] = !holds[i];
                  choose({ ...state.controls, holds });
                }}
              >
                <strong>
                  {i === 0 ? "α" : "β"}{" "}
                  {allowed
                    ? state.controls.holds[i]
                      ? "等待"
                      : "放行"
                    : "不可等待"}
                </strong>
                <small>{allowed ? "点击切换" : "本关没有此信号"}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <div
          className={`rt-preview ${preview.valid ? "" : "rt-conflict"}`}
          role="status"
          data-rail-preview
        >
          <strong>
            {preview.valid
              ? "✓ 下一步可以执行"
              : won
                ? "✓ 两车已到站"
                : "请先调整"}
          </strong>
          <p>{won ? "两列车停在各自终点，继续占用站点。" : preview.reason}</p>
        </div>
        <button
          ref={commit}
          className="rt-commit"
          data-rail-commit
          disabled={locked}
          aria-disabled={locked || !preview.valid}
          onClick={(event) => {
            if (modified(event)) return;
            tick();
          }}
        >
          推进一个回合 · N
        </button>
        {hint && (
          <div className="rt-hint" role="status" data-rail-hint>
            <p>{hint.text}</p>
            {hint.action && (
              <button
                data-rail-use-hint
                disabled={locked || ended}
                onClick={(event) => {
                  if (modified(event) || !hint.action || locked || ended)
                    return;
                  returnFocus.current = true;
                  choose(hint.action);
                }}
              >
                选好建议设置，不自动推进
              </button>
            )}
            <button
              data-rail-dismiss-hint
              disabled={paused}
              onClick={(event) => {
                if (modified(event)) return;
                returnFocus.current = true;
                setHint(null);
              }}
            >
              收起提示
            </button>
          </div>
        )}
        <h4>
          回合记录 <small>↓ 可滚动；撤销还原整回合</small>
        </h4>
        <ol className="rt-history" ref={history} data-rail-history>
          {state.history.length === 0 ? (
            <li>还没有执行回合。设置道岔本身不耗步数。</li>
          ) : (
            state.history.map((before, i) => {
              const after =
                i + 1 < state.history.length
                  ? state.history[i + 1].board
                  : state.board;
              return (
                <li key={i}>
                  第 {before.board.tick + 1} 步：α{" "}
                  {puzzle.nodes[before.board.positions[0]].label} →{" "}
                  {puzzle.nodes[after.positions[0]].label}；β{" "}
                  {puzzle.nodes[before.board.positions[1]].label} →{" "}
                  {puzzle.nodes[after.positions[1]].label}
                </li>
              );
            })
          )}
        </ol>
        <p className="rt-help">
          Tab、Enter / 空格操作按钮。按 N 推进一步；列车按钮上按 ← →
          切换跟随。冲突不会执行，也不会消耗回合。
        </p>
      </section>
      <aside className="game-notes rt-notes">
        <span className="mini-label">道岔 · 会车 · 顺序</span>
        <h3>给下一辆车留一站。</h3>
        <p>{config.lesson}</p>
        <p className="rt-disclaimer">
          简化的抽象铁路益智模型，不是真实铁路调度指导。没有速度、制动距离或实时信号；没有计时压力。
        </p>
        <h4>第一次玩：一步怎样结算</h4>
        <ol>
          <li>先设所有道岔和两个等待信号，设置一直保留，随时可改。</li>
          <li>点击推进，两车同时沿箭头走一站。等待的车、无出口的车不动。</li>
          <li>
            同时进入同一站、迎面对换相邻站都禁止。可以跟进另一车刚离开的站。
          </li>
          <li>到自己的终点后自动停驻，仍占用该站。到对方终点不会自动停。</li>
          <li>
            两车都在各自终点且未超期限即获胜。有期限也只有步数限制，不计真实时间。
          </li>
        </ol>
        {level === 0 && (
          <p className="rt-example">
            本关示范：先让 β 等待，α 进入 C；再放行 β，C 道岔朝 D，α 到站而 β
            进入 C；最后把 C 道岔改朝 E。
          </p>
        )}
        <h4>完整文字线路表</h4>
        <div className="rt-track-table">
          {puzzle.nodes.map((n, i) => (
            <div key={i} data-rail-track={i}>
              <strong>
                {n.label}
                {switches.includes(i) ? " · 道岔" : ""}
              </strong>
              <span>
                出口：
                {n.next.length
                  ? n.next
                      .map(
                        (j) =>
                          `${puzzle.nodes[j].label}（边 ${routes.findIndex((r) => r.from === i && r.to === j) + 1}）`,
                      )
                      .join(" 或 ")
                  : "无（保持原位）"}
              </span>
              <span>
                {puzzle.goals
                  .map((g, t) =>
                    g === i ? `${t === 0 ? "α" : "β"} 终点；` : "",
                  )
                  .join("") || "非终点"}{" "}
                {state.board.positions
                  .map((p, t) =>
                    p === i ? `${t === 0 ? "α" : "β"} 当前在此` : "",
                  )
                  .join(" ")}
              </span>
            </div>
          ))}
        </div>
        <p>
          提示从两车当前位置精确寻找最短余下行程，包含已停驻车辆的占位和剩余步数。不会强迫复现某个固定答案。
        </p>
      </aside>
    </div>
  );
}
