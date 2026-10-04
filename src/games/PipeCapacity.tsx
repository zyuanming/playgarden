// SPDX-License-Identifier: MIT
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { pipeCapacityLevels } from "./pipeCapacityLevels";
import {
  assignPipe,
  createPipeState,
  pipeBalance,
  pipeCost,
  pipeHint,
  pipeWon,
  pipeRoute,
  publicPipe,
  undoPipe,
  type PipeHint,
} from "./pipeCapacityLogic";
import { routeBadges } from "./flowRailGeometry";
import "./pipeCapacity.css";
export default function PipeCapacity(props: GameProps) {
  return <PipeRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function PipeRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = pipeCapacityLevels[level] ?? pipeCapacityLevels[0],
    puzzle = useMemo(() => publicPipe(config), [config]);
  const routes = useMemo(
    () => puzzle.edges.map((_, i) => pipeRoute(puzzle, i)),
    [puzzle],
  );
  const badges = useMemo(
    () => routeBadges(puzzle.nodes, routes),
    [puzzle, routes],
  );
  const [state, setState] = useState(() => createPipeState(puzzle)),
    [selected, setSelected] = useState(0),
    [hint, setHint] = useState<PipeHint | null>(null);
  const root = useRef<HTMLDivElement>(null),
    heading = useRef<HTMLParagraphElement>(null),
    list = useRef<HTMLDivElement>(null),
    rows = useRef<(HTMLButtonElement | null)[]>([]),
    returnFocus = useRef(false);
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false);
  const won = pipeWon(puzzle, state.flows),
    locked = paused || won,
    edge = puzzle.edges[selected],
    cost = pipeCost(puzzle, state.flows);
  function reveal(index: number, focus = false) {
    const el = rows.current[index],
      box = list.current;
    if (!el || !box) return;
    if (focus) el.focus({ preventScroll: true });
    const r = el.getBoundingClientRect(),
      b = box.getBoundingClientRect();
    if (r.top < b.top) box.scrollTop -= b.top - r.top + 6;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom + 6;
  }
  function select(index: number) {
    if (locked) return;
    setSelected(index);
    reveal(index, true);
  }
  function assign(value: number | null) {
    if (locked) return;
    setState((s) => assignPipe(puzzle, s, selected, value));
    setHint(null);
  }
  useEffect(() => {
    onStatus(
      "先选择管道，再填写整数流量；问号还未决定，0 是明确关闭。所有节点供需和管道容量都已公开。",
    );
  }, []);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (locked) return;
    const next = pipeHint(puzzle, state);
    setHint(next);
    onStatus(next.text);
  }, [hintToken, locked, puzzle, state, onStatus]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (paused || won) return;
    returnFocus.current = Boolean(
      root.current
        ?.querySelector("[data-pipe-hint]")
        ?.contains(document.activeElement),
    );
    setState(undoPipe(state));
    setHint(null);
    onStatus(
      state.history.length ? "已撤销一次流量填写。" : "还没有可以撤销的填写。",
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
      reveal(selected, true);
    }
  }, [hint, selected, state]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus(`所有管道、节点供需与预算都满足！总泵费 ${cost}。`);
      onComplete();
    }
  }, [won, paused, cost, onStatus, onComplete]);
  const width = Math.max(...puzzle.nodes.map((n) => n.x)) + 155,
    height = Math.max(...puzzle.nodes.map((n) => n.y)) + 165;
  return (
    <div
      ref={root}
      className="puzzle-layout pipe-capacity"
      data-pipe-game
      data-pipe-won={won}
      onKeyDown={(event) => {
        if (event.ctrlKey || event.metaKey || event.altKey || locked) return;
        const target = event.target as HTMLElement;
        if (!target.closest("[data-pipe-edge], [data-pipe-value]")) return;
        if (/^[0-5]$/.test(event.key)) {
          const v = Number(event.key);
          if (v <= edge.capacity) {
            event.preventDefault();
            assign(v);
          }
        } else if (
          event.key === "Delete" ||
          event.key === "Backspace" ||
          event.key === "?"
        ) {
          event.preventDefault();
          assign(null);
        } else if (
          target.hasAttribute("data-pipe-edge") &&
          ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
        ) {
          event.preventDefault();
          select(
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? puzzle.edges.length - 1
                : (selected +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    puzzle.edges.length) %
                  puzzle.edges.length,
          );
        }
      }}
    >
      <section className="pc-workbench" aria-label="整数管道配流工作台">
        <div className="pc-heading">
          <span className="mini-label">管道配流 · {config.title}</span>
          <strong>
            {state.flows.filter((v) => v !== null).length}/{puzzle.edges.length}{" "}
            已填
          </strong>
        </div>
        <p ref={heading} tabIndex={-1} className="pc-instruction">
          {paused
            ? "已暂停。"
            : won
              ? "供水完成！每个目标都达成。"
              : "① 点管道　② 选流量　③ 对照各站净供需。没有倒计时。"}
        </p>
        <p className="pc-scroll-cue">
          ↔ ↕
          图内可滚动，文字保持原尺寸。交叉不代表连接，只在标出的站点连接；边上编号对应管道清单。
        </p>
        <div
          className="pc-map-wrap"
          tabIndex={0}
          aria-label="可滚动管道图；完整文字信息在管道清单中"
        >
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
            className="pc-map"
          >
            <defs>
              <marker
                id={`pc-arrow-${level}`}
                markerWidth="10"
                markerUnits="userSpaceOnUse"
                markerHeight="10"
                refX="9"
                refY="4"
                orient="auto"
              >
                <path d="M0 0L9 4L0 8" fill="#325869" />
              </marker>
            </defs>
            {routes.map((route, i) => {
              const label = badges[i];
              return (
                <g key={i}>
                  <path
                    data-pipe-route={i}
                    d={route
                      .map((p, j) => `${j ? "L" : "M"}${p.x} ${p.y}`)
                      .join(" ")}
                    fill="none"
                    stroke={selected === i ? "#9d510f" : "#456f7e"}
                    strokeWidth={selected === i ? 4 : 2}
                    markerEnd={`url(#pc-arrow-${level})`}
                  />
                  {label && (
                    <g data-pipe-route-label={i}>
                      <line
                        x1={label.anchor.x}
                        y1={label.anchor.y}
                        x2={label.x}
                        y2={label.y}
                        stroke="#456f7e"
                        strokeWidth="1"
                      />
                      <rect
                        x={label.x - 11}
                        y={label.y - 10}
                        width="22"
                        height="20"
                        rx="5"
                        fill="#fff"
                        stroke="#456f7e"
                      />
                      <text
                        className="pc-edge-id"
                        x={label.x}
                        y={label.y + 4}
                        textAnchor="middle"
                      >
                        {i + 1}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
            {puzzle.nodes.map((n, i) => (
              <g key={i}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r="23"
                  fill={
                    n.balance > 0
                      ? "#d5f0e4"
                      : n.balance < 0
                        ? "#ffedbd"
                        : "#fff"
                  }
                  stroke="#294d59"
                  strokeWidth="2"
                />
                <text x={n.x} y={n.y + 6} textAnchor="middle">
                  {n.label}
                </text>
                <text
                  className="pc-map-role"
                  x={n.x}
                  y={n.y + 40}
                  textAnchor="middle"
                >
                  {n.balance > 0
                    ? `供 ${n.balance}`
                    : n.balance < 0
                      ? `需 ${-n.balance}`
                      : "中转"}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <p className="pc-scroll-cue">
          ↓ 管道清单可上下滚动。箭头表示唯一供水方向；图中的全部信息也列在下方。
        </p>
        <div ref={list} className="pc-pipes" aria-label="全部有向管道与容量">
          {puzzle.edges.map((e, i) => (
            <button
              key={i}
              ref={(el) => {
                rows.current[i] = el;
              }}
              data-pipe-edge={i}
              data-pipe-flow={state.flows[i] ?? "?"}
              aria-pressed={selected === i}
              disabled={locked}
              onClick={(event) => {
                if (event.ctrlKey || event.metaKey || event.altKey) return;
                select(i);
              }}
            >
              <strong>
                {i + 1}. {puzzle.nodes[e.from].label} →{" "}
                {puzzle.nodes[e.to].label}
              </strong>
              <span>
                容量 {e.capacity} · 单价 {e.cost}
              </span>
              <b>
                {state.flows[i] ?? "?"} <small>/ {e.capacity}</small>
              </b>
            </button>
          ))}
        </div>
        <fieldset disabled={locked} className="pc-values">
          <legend>
            填写 {puzzle.nodes[edge.from].label} → {puzzle.nodes[edge.to].label}{" "}
            的流量
          </legend>
          {[
            null,
            ...Array.from({ length: edge.capacity + 1 }, (_, i) => i),
          ].map((value) => (
            <button
              key={value ?? "unknown"}
              data-pipe-value={value ?? "unknown"}
              aria-label={value === null ? "改回未决定" : `流量 ${value}`}
              aria-pressed={state.flows[selected] === value}
              onClick={(event) => {
                if (event.ctrlKey || event.metaKey || event.altKey) return;
                assign(value);
              }}
            >
              {value ?? "?"}
              <small>
                {value === null ? "未决定" : value === 0 ? "关闭" : "单位"}
              </small>
            </button>
          ))}
        </fieldset>
        <div className="pc-budget">
          已填管道的泵费 <strong>{cost}</strong>
          {puzzle.budget !== undefined
            ? ` / 预算 ${puzzle.budget}`
            : " · 本关不限制费用"}
          。每条费用 = 流量 × 单价。
        </div>
        {hint && (
          <div className="pc-hint" role="status" data-pipe-hint>
            <p>{hint.text}</p>
            {hint.edge !== undefined && (
              <button
                data-pipe-use-hint
                disabled={locked}
                onClick={(event) => {
                  if (
                    event.ctrlKey ||
                    event.metaKey ||
                    event.altKey ||
                    locked ||
                    hint.edge === undefined ||
                    hint.value === undefined
                  )
                    return;
                  returnFocus.current = true;
                  setState((s) =>
                    assignPipe(puzzle, s, hint.edge!, hint.value!),
                  );
                  setSelected(hint.edge);
                  setHint(null);
                }}
              >
                只填写这条建议
              </button>
            )}
            <button
              disabled={paused}
              data-pipe-dismiss-hint
              onClick={(event) => {
                if (event.ctrlKey || event.metaKey || event.altKey) return;
                returnFocus.current = true;
                setHint(null);
              }}
            >
              收起提示
            </button>
          </div>
        )}
        <p className="pc-help">
          Tab、Enter / 空格可操作所有按钮。在管道或流量按钮上按数字填写，Delete
          清为问号；管道清单内 ↑ ↓ 选择。撤销还原一次填写。
        </p>
      </section>
      <aside className="game-notes pc-notes">
        <span className="mini-label">容量 · 守恒 · 泵费</span>
        <h3>让每一单位都有去处。</h3>
        <p>{config.lesson}</p>
        <h4>每站的公开目标</h4>
        <div className="pc-nodes">
          {puzzle.nodes.map((n, i) => {
            const unfinished = puzzle.edges.some(
                (e, j) =>
                  (e.from === i || e.to === i) && state.flows[j] === null,
              ),
              net = pipeBalance(puzzle, state.flows, i);
            return (
              <div key={i} data-pipe-node={i}>
                <strong>
                  {n.label} ·{" "}
                  {n.balance > 0
                    ? `净供给 ${n.balance}`
                    : n.balance < 0
                      ? `净需求 ${-n.balance}`
                      : "中转站，净值 0"}
                </strong>
                <span>目标：流出 − 流入 = {n.balance}</span>
                <span>
                  已填净值 {net}{" "}
                  {unfinished
                    ? "（仍有问号）"
                    : net === n.balance
                      ? "✓ 守恒"
                      : "尚未吻合"}
                </span>
              </div>
            );
          })}
        </div>
        <h4>第一次玩</h4>
        <ol>
          <li>每条管道填写 0 到容量之间的整数；0 与问号不同。</li>
          <li>
            供给站的流出比流入多指定数量，需求站相反；中转站流入等于流出。
          </li>
          <li>
            全部管道都要明确填写，包括不用的 0。满足每站需求与预算就通关。
          </li>
        </ol>
        {level === 0 && (
          <p className="pc-example">
            本关示范：A → B 填 3，B → C 填 1，B → D 填 2。B 收到 3，恰好分出 1 +
            2。
          </p>
        )}
        <p>
          提示从当前填写精确计算可行补全，保留全部已填数值。若无解，会说明冲突；你可以撤销，或把某条管道改回问号再求提示。
        </p>
        <p className="pc-help">
          原创抽象整数流益智题；示意图不表示现实供水工程。
        </p>
      </aside>
    </div>
  );
}
