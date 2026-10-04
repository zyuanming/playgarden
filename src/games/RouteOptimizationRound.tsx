import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  analyzeRoute,
  createRouteState,
  isRouteSolved,
  routeHint,
  routeKeyboardRoad,
  routeMinimumCost,
  undoRoute,
  walkRouteRoad,
  ROUTE_MAX_STEPS,
  type RouteHint,
  type RouteLevel,
} from "./routeOptimizationLogic";
import "./routeOptimization.css";

export default function RouteOptimizationRound({
  config,
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps & { config: RouteLevel }) {
  const tour = config.mode === "town-tour",
    name = tour ? "巡回探访" : "邮差路线";
  const [state, setState] = useState(() => createRouteState(config));
  const [hint, setHint] = useState<RouteHint | null>(null);
  const [exampleOpen, setExampleOpen] = useState(level === 0);
  const analysis = useMemo(
    () => analyzeRoute(config, state.path),
    [config, state],
  );
  const minimum = useMemo(() => routeMinimumCost(config), [config]);
  const won = analysis.complete && analysis.cost === minimum;
  const seenHint = useRef(hintToken),
    seenUndo = useRef(undoToken),
    reported = useRef(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const pendingFocus = useRef<number | null>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const description = useId(),
    mapDescription = useId();
  const label = (town: number) => config.towns[town].label;
  const roadName = (index: number) =>
    `${label(config.roads[index].a)}–${label(config.roads[index].b)}`;
  const choices = config.roads.map((road, index) => {
    const to =
      road.a === analysis.current
        ? road.b
        : road.b === analysis.current
          ? road.a
          : -1;
    const reason =
      to < 0
        ? "不与当前位置相连"
        : tour && to === config.depot && analysis.visited < config.towns.length
          ? "拜访全部城镇后才能回家"
          : tour && to !== config.depot && analysis.townMask & (1 << to)
            ? "这座镇已拜访，不能重访"
            : tour && analysis.complete
              ? "这圈已结束，请撤销调整"
              : state.path.length > ROUTE_MAX_STEPS
                ? "已达路线长度上限，请撤销或重置"
                : "";
    return { index, to, reason };
  });
  const available = choices.filter((c) => !c.reason).map((c) => c.index);
  useEffect(() => {
    const previous = pendingFocus.current;
    if (previous === null) return;
    pendingFocus.current = null;
    if (paused || won) return;
    const next = available.includes(previous) ? previous : available[0];
    if (next !== undefined) buttons.current[next]?.focus();
    else feedback.current?.focus();
  }, [state.path, paused, won]);
  const hintText =
    hint?.kind === "move"
      ? `下一步可走 ${roadName(hint.road)}，路费 ${config.roads[hint.road].cost}。从当前位置算起，包含这一段的最省剩余路费是 ${hint.remainingCost}，仍能达到总目标 ${minimum}。`
      : hint?.kind === "undo"
        ? `${hint.excess === null ? "当前顺序已无法完成一次完整巡回。" : `即使之后都走最省路线，这条前缀也会比总目标多 ${hint.excess}。`}请先撤销 ${hint.steps} 步，再换一条路线。`
        : hint?.kind === "unavailable"
          ? "暂时没有可用提示，请撤销或重置后再试。"
          : "";
  useEffect(() => {
    onStatus(
      tour
        ? "从 A 出发，每座镇只拜访一次，最后回到 A。每一段路费都计入总价。"
        : "从 A 邮局出发，每条道路至少走一次，再回 A。道路可以重复，每次都计费。",
    );
  }, [config]);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (paused || won) return;
    const next = routeHint(config, state);
    setHint(next);
    if (next.kind === "move")
      onStatus(
        `提示：从 ${label(analysis.current)} 走 ${roadName(next.road)}，路费 ${config.roads[next.road].cost}。从当前路线仍能达到最低总价 ${minimum}。`,
      );
    else if (next.kind === "undo")
      onStatus(
        `当前路线无法达到最低总价。请先撤销 ${next.steps} 步，再尝试另一条路。`,
      );
    else if (next.kind === "unavailable")
      onStatus("暂时没有可用提示，请撤销或重置。");
  }, [hintToken, paused, won, state, config, onStatus]);
  useEffect(() => {
    if (seenUndo.current === undoToken) return;
    seenUndo.current = undoToken;
    if (paused || won) return;
    const next = undoRoute(state);
    setState(next);
    setHint(null);
    onStatus(
      next === state
        ? "还没有可以撤销的脚步。"
        : `已撤销一步，回到 ${label(next.path.at(-1)!)}。刚才那一段的路费也已退回。`,
    );
  }, [undoToken, paused, won, state, config, onStatus]);
  useEffect(() => {
    if (won && !paused && !reported.current) {
      reported.current = true;
      onStatus(
        tour
          ? `拜访了全部 ${config.towns.length} 座镇并回家，总路费 ${analysis.cost}，达到全局最低！`
          : `送遍了全部 ${config.roads.length} 条道路并返回邮局，总路费 ${analysis.cost}，其中必要重走路费 ${analysis.repeatedCost}，达到全局最低！`,
      );
      onComplete();
    }
  }, [
    won,
    paused,
    analysis.cost,
    analysis.repeatedCost,
    config,
    onComplete,
    onStatus,
  ]);
  function walk(index: number) {
    if (paused || won) return;
    const result = walkRouteRoad(config, state, index);
    if (result.state === state) return;
    if (document.activeElement === buttons.current[index])
      pendingFocus.current = index;
    setState(result.state);
    setHint(null);
    if (isRouteSolved(config, result.state)) return;
    const next = analyzeRoute(config, result.state.path);
    onStatus(
      `走过 ${roadName(index)}，到达 ${label(next.current)}；总路费 ${next.cost}。${next.complete ? `这次已完成任务，但比最低总价多 ${next.cost - minimum}。可以撤销调整。` : next.cost > minimum ? "已经超过最低目标，请撤销调整。" : tour ? `已拜访 ${next.visited} / ${config.towns.length} 座镇。` : `已覆盖 ${next.covered} / ${config.roads.length} 条道路，重走路费 ${next.repeatedCost}。`}`,
    );
  }
  return (
    <div
      className={`puzzle-layout route-optimization route-${tour ? "tour" : "postman"}`}
      data-route-game={config.mode}
      data-route-solved={won}
    >
      <section className="ro-play-area" aria-label={`${name}游戏`}>
        <header className="ro-heading">
          <div>
            <span className="mini-label">
              {name} · 第 {level + 1} 关 · {config.difficulty}
            </span>
            <h3>{config.title}</h3>
          </div>
          <div className="ro-budget">
            <strong data-route-cost>{analysis.cost}</strong>
            <span>总路费 · 目标 {minimum}</span>
          </div>
        </header>
        {tour ? (
          <div
            className="ro-passport"
            aria-label="城镇拜访记录"
            data-route-visited={analysis.visited}
          >
            {config.towns.map((town, i) => (
              <span
                key={town.label}
                className={analysis.townMask & (1 << i) ? "ro-stamped" : ""}
              >
                <b>{town.label}</b>
                <small>
                  {i === config.depot
                    ? analysis.complete
                      ? "已回家"
                      : "家 / 起点"
                    : state.path.includes(i)
                      ? `✓ 第 ${state.path.indexOf(i)} 站`
                      : "未拜访"}
                </small>
              </span>
            ))}
          </div>
        ) : (
          <div className="ro-delivery" data-route-covered={analysis.covered}>
            <span>
              <b>
                {analysis.covered} / {config.roads.length}
              </b>{" "}
              道路已投递
            </span>
            <span>
              <b data-route-repeated-cost>{analysis.repeatedCost}</b> 重走路费
            </span>
            <progress
              value={analysis.covered}
              max={config.roads.length}
              aria-label="道路投递覆盖进度"
            />
          </div>
        )}
        <div className="ro-map" data-route-map>
          <svg
            viewBox="0 0 400 340"
            role="img"
            aria-label={`${name}地图，当前位置 ${label(analysis.current)}`}
            aria-describedby={mapDescription}
          >
            <title>{name}道路示意图</title>
            <desc id={mapDescription}>
              圆点是城镇，A 是{tour ? "家" : "邮局"}
              。实线是已走道路，虚线是未走道路；重走道路有双线。交叉处不是路口。每条道路的端点、路费和走过次数完整列在下方按钮中。
            </desc>
            {config.roads.map((road, index) => {
              const a = config.towns[road.a],
                b = config.towns[road.b],
                count = analysis.counts[index];
              return (
                <g
                  key={index}
                  data-route-line={index}
                  data-route-traversals={count}
                >
                  {count > 1 && (
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      className="ro-repeat-outline"
                    />
                  )}
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={count ? "ro-walked-road" : "ro-unwalked-road"}
                  />
                </g>
              );
            })}
            {config.towns.map((town, index) => (
              <g
                key={town.label}
                data-route-town={index}
                data-route-current={analysis.current === index}
              >
                {analysis.current === index && (
                  <circle
                    cx={town.x}
                    cy={town.y}
                    r="25"
                    className="ro-location-ring"
                  />
                )}
                <circle
                  cx={town.x}
                  cy={town.y}
                  r="19"
                  className={`ro-town ${analysis.townMask & (1 << index) ? "ro-visited-town" : ""}`}
                />
                <text
                  x={town.x}
                  y={town.y + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="ro-town-label"
                >
                  {town.label}
                </text>
                {index === config.depot && (
                  <path
                    d={`M ${town.x - 10} ${town.y - 23} L ${town.x} ${town.y - 31} L ${town.x + 10} ${town.y - 23}`}
                    className="ro-home-mark"
                  />
                )}
                {analysis.current === index && (
                  <path
                    d={`M ${town.x - 5} ${town.y + 30} L ${town.x + 5} ${town.y + 30} L ${town.x} ${town.y + 23} Z`}
                    className="ro-here-mark"
                  />
                )}
              </g>
            ))}
          </svg>
          <p className="ro-map-legend">
            ◎ 当前在 {label(analysis.current)} · 实线 = 走过 · 虚线 = 未走
            {!tour && " · 双线 = 重走"}
          </p>
        </div>
        <p className="ro-map-caption">
          路费以按钮数字为准，与线段画得长短无关。交叉处不能换路。
        </p>
        <div
          className={`ro-feedback ${analysis.cost > minimum || (analysis.complete && !won) ? "ro-over-budget" : ""}`}
          role="status"
          data-route-feedback
          ref={feedback}
          tabIndex={-1}
        >
          {paused
            ? "已暂停，路线和路费保持不变。"
            : won
              ? tour
                ? "全部拜访并回家，这圈路费最低！"
                : "投递完成并回邮局，必要重走也安排得最省！"
              : analysis.complete
                ? `任务路线完整，但比最低总价多 ${analysis.cost - minimum}。请撤销调整。`
                : analysis.cost > minimum
                  ? `已超过目标 ${analysis.cost - minimum}，请撤销调整。`
                  : tour
                    ? `当前位置 ${label(analysis.current)} · 到访 ${analysis.visited} / ${config.towns.length} 座镇${analysis.visited === config.towns.length ? " · 现在回家" : ""}`
                    : `当前位置 ${label(analysis.current)} · 还剩 ${config.roads.length - analysis.covered} 条未投递${analysis.covered === config.roads.length ? " · 现在返回邮局" : ""}`}
        </div>
        {hintText && (
          <p className="ro-hint" data-route-hint={hint?.kind} role="status">
            {hintText}
          </p>
        )}
        <div className="ro-path" data-route-path aria-label="已走路线">
          <strong>脚步记录</strong>
          <span>{state.path.map(label).join(" → ")}</span>
        </div>
        <div className="ro-road-heading">
          <h4>选择下一段道路</h4>
          <span>只能从当前位置出发</span>
        </div>
        <div
          className="ro-road-choices"
          role="group"
          aria-label="可行走的道路"
          aria-describedby={description}
        >
          {choices.map(({ index, to, reason }) => {
            const road = config.roads[index],
              count = analysis.counts[index],
              hinted = hint?.kind === "move" && hint.road === index;
            return (
              <button
                type="button"
                key={index}
                ref={(node) => {
                  buttons.current[index] = node;
                }}
                data-route-road={index}
                data-route-road-key={`${Math.min(road.a, road.b)}:${Math.max(road.a, road.b)}`}
                data-route-hinted={hinted}
                data-route-walk-count={count}
                disabled={paused || won || !!reason}
                className={`ro-road-choice ${count ? "ro-road-covered" : ""} ${hinted ? "ro-hinted" : ""}`}
                aria-label={`道路 ${roadName(index)}，路费 ${road.cost}，已走 ${count} 次。${reason || `从 ${label(analysis.current)} 到 ${label(to)}`}${hinted ? "。提示道路" : ""}`}
                onClick={() => walk(index)}
                onKeyDown={(event) => {
                  if (event.ctrlKey || event.metaKey || event.altKey) return;
                  if (
                    ![
                      "ArrowLeft",
                      "ArrowRight",
                      "ArrowUp",
                      "ArrowDown",
                      "Home",
                      "End",
                    ].includes(event.key)
                  )
                    return;
                  event.preventDefault();
                  if (!paused && !won)
                    buttons.current[
                      routeKeyboardRoad(available, index, event.key)
                    ]?.focus();
                }}
              >
                <span className="ro-road-main">
                  <b>{roadName(index)}</b>
                  <strong>
                    {road.cost}
                    <small> 路费</small>
                  </strong>
                </span>
                <span className="ro-road-state">
                  {hinted ? "★ 提示 · " : ""}
                  {count
                    ? `${count > 1 ? "↺" : "✓"} 已走 ${count} 次`
                    : "○ 尚未走过"}
                </span>
                <span className="ro-road-action">
                  {reason || `走到 ${label(to)}`}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <aside className="game-notes ro-guide">
        <span className="mini-label">
          {tour ? "拜访顺序 · 全程路费" : "道路覆盖 · 必要重走"}
        </span>
        <h3>
          {tour ? (
            <>
              每座镇拜访一次，
              <br />
              规划一圈最省旅程。
            </>
          ) : (
            <>
              每条街都要送到，
              <br />
              重走也要精打细算。
            </>
          )}
        </h3>
        <p id={description}>
          {tour
            ? "从 A 家里出发。选择和当前位置相连的道路，拜访所有城镇，每座镇只能到一次，最后回 A。总路费达到目标才算过关。"
            : "从 A 邮局出发。每条无向道路至少走一次，最后回 A。城镇和道路都可以重复经过，但每走一次都要加上这条路的路费。总路费达到目标才算过关。"}
        </p>
        <details
          className="ro-worked-example"
          open={exampleOpen}
          onToggle={(event) => setExampleOpen(event.currentTarget.open)}
        >
          <summary>第一次玩？看一个小例子</summary>
          {tour ? (
            <p>
              例如三座镇 X、Y、Z：X–Y 费 4，Y–Z 费 2，Z–X 费 3。走 X → Y → Z
              只花 6，却还没回家；完整一圈 X → Y → Z → X 总价是 4 + 2 + 3 =
              9。拜访次序和最后的回家路都要算。
            </p>
          ) : (
            <p>
              例如只有一条支线 X–Y 费 3、Y–Z 费 2，邮局在 X。投递到 Z
              后还要回邮局：X → Y → Z → Y → X，总价 3 + 2 + 2 + 3 =
              10。两条路都重走了，但这是必要的 5 份返程路费。
            </p>
          )}
        </details>
        <div className="note">
          <strong>这一关的小发现</strong>
          <p>{config.idea}</p>
        </div>
        <p className="ro-insight">
          {tour
            ? "同样省钱的不同拜访顺序都会通过。已盖章的城镇不能再访，A 只在最后返回。"
            : "✓ 表示投递过，↺ 和次数表示重走。重复行走是这款游戏的一部分；只要总路费最低，任何顺序都能通过。"}
        </p>
        <p className="muted">
          Tab 或方向键选可走道路，Enter /
          空格迈一步。提示检查你已经走过的路线；若无法再达到最低目标，会告诉你需要撤销几步。撤销退回一步并退还该段路费；重置回到起点。暂停时不移动，也不消耗路线。
        </p>
      </aside>
    </div>
  );
}
