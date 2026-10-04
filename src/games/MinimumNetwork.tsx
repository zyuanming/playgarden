import { useEffect, useId, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  analyzeNetwork,
  createNetworkState,
  isMinimumNetworkSolved,
  minimumNetworkHint,
  minimumNetworkLevels,
  networkKeyboardEdge,
  networkMinimumCost,
  networkLabelPositions,
  toggleNetworkEdge,
  undoNetwork,
  type NetworkHint,
} from "./minimumNetworkLogic";
import "./graphPathGames.css";
import "./graphOptimizationGames.css";

export default function MinimumNetwork(props: GameProps) {
  return <NetworkRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function NetworkRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = minimumNetworkLevels[level] ?? minimumNetworkLevels[0];
  const labelPositions = networkLabelPositions(config);
  const [state, setState] = useState(createNetworkState);
  const [hint, setHint] = useState<NetworkHint | null>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]),
    description = useId();
  const seenHint = useRef(hintToken),
    seenUndo = useRef(undoToken),
    complete = useRef(false);
  const analysis = analyzeNetwork(config, state.selected),
    won = isMinimumNetworkSolved(config, state);
  const optimum = networkMinimumCost(config);
  const edgeName = (index: number) => {
    const { a, b } = config.edges[index];
    return `${config.stations[a].label}–${config.stations[b].label}`;
  };
  const hintEdge =
    hint?.kind === "add" || hint?.kind === "remove" ? hint : null;
  const hintText = hintEdge
    ? `${hintEdge.kind === "add" ? "连接" : "取消"} ${edgeName(hintEdge.edge)}（造价 ${config.edges[hintEdge.edge].cost}）。${hintEdge.kind === "remove" ? "一份尽量保留当前线路的最优方案不需要这条路。" : "这样可以继续完成一份已验证的最省方案。"}`
    : "";
  useEffect(() => {
    onStatus(
      "点选线路，把所有站连成一张网，并达到最低总造价。再点已选线路可以取消。",
    );
  }, []);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (paused || won) return;
    const next = minimumNetworkHint(config, state);
    setHint(next);
    if (next.kind === "add" || next.kind === "remove")
      onStatus(
        `${next.kind === "add" ? "试着连接" : "先取消"} ${edgeName(next.edge)}，造价 ${config.edges[next.edge].cost}。提示会尽量保留当前已选线路，所有最优方案都能过关。`,
      );
    else onStatus("当前没有可用提示，可以撤销或重置后再试。");
  }, [hintToken, paused, won, config, state, onStatus]);
  useEffect(() => {
    if (seenUndo.current === undoToken) return;
    seenUndo.current = undoToken;
    if (paused || won) return;
    const next = undoNetwork(state);
    setState(next);
    setHint(null);
    onStatus(
      next === state ? "还没有可以撤销的线路选择。" : "已撤销上一次线路选择。",
    );
  }, [undoToken, paused, won, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !complete.current) {
      complete.current = true;
      onStatus(
        `全部 ${config.stations.length} 座站已连通，总造价 ${analysis.cost}，达到最低造价！`,
      );
      onComplete();
    }
  }, [
    won,
    paused,
    config.stations.length,
    analysis.cost,
    onComplete,
    onStatus,
  ]);
  function toggle(index: number) {
    if (paused || won) return;
    const next = toggleNetworkEdge(config, state, index);
    setState(next);
    setHint(null);
    const result = analyzeNetwork(config, next.selected);
    if (isMinimumNetworkSolved(config, next)) return;
    onStatus(
      `${next.selected.includes(index) ? "已连接" : "已取消"} ${edgeName(index)}。目前分成 ${result.components} 片，总造价 ${result.cost}。${result.cycle ? "出现了回路，可以去掉多余线路。" : result.connected ? "已经连通，还可以试着降低总造价。" : "继续连接不同片区的小站。"}`,
    );
  }
  return (
    <div
      className="puzzle-layout graph-game go-game"
      data-graph-game="minimum-network"
    >
      <section className="gp-play-area" aria-label="最省网络游戏">
        <div className="gp-heading">
          <div>
            <span className="mini-label">最省网络 · 第 {level + 1} 关</span>
            <h3>{config.title}</h3>
          </div>
          <span className="gp-counter">
            <strong>{analysis.cost}</strong>
            <small>总造价 · 目标 {optimum}</small>
          </span>
        </div>
        <div
          className={`gp-graph go-network-board ${won ? "gp-won" : ""}`}
          data-network-solved={won}
        >
          <svg
            viewBox="0 0 100 100"
            role="img"
            aria-label={`线路图：${config.stations.length} 座站，${config.edges.length} 条候选线路。请用下方线路按钮选择。`}
            className="go-network-svg"
          >
            {config.edges.map(({ a, b, cost }, index) => {
              const first = config.stations[a],
                last = config.stations[b],
                selected = state.selected.includes(index);
              return (
                <g
                  key={index}
                  data-network-line={index}
                  data-selected={selected}
                >
                  <line
                    x1={first.x}
                    y1={first.y}
                    x2={last.x}
                    y2={last.y}
                    className={
                      selected
                        ? "go-network-selected-line"
                        : "go-network-unused-line"
                    }
                  />
                  <text
                    x={labelPositions[index].x}
                    y={labelPositions[index].y}
                    className={`go-cost-label ${selected ? "go-cost-selected" : ""}`}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {cost}
                  </text>
                </g>
              );
            })}
            {config.stations.map((station, index) => (
              <g key={station.label} data-network-station={index}>
                <circle
                  cx={station.x}
                  cy={station.y}
                  r="5.4"
                  className="go-station"
                />
                <text
                  x={station.x}
                  y={station.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="go-station-label"
                >
                  {station.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div
          className={`gp-map-feedback ${analysis.cycle ? "gp-has-conflicts" : ""}`}
          aria-live="polite"
          data-network-feedback
        >
          {won
            ? "每座站都能互相到达，造价也是最低的！"
            : `连通片数 ${analysis.components} · 已选 ${state.selected.length} 条线路${analysis.cycle ? " · 有多余回路" : ""}`}
        </div>
        {hintText && (
          <p className="go-hint-text" role="status">
            {hintText}
          </p>
        )}
        <div
          className="go-network-choices"
          role="group"
          aria-label="选择建造线路"
          aria-describedby={description}
        >
          {config.edges.map((edge, index) => {
            const selected = state.selected.includes(index),
              hinted = hintEdge?.edge === index;
            return (
              <button
                key={index}
                type="button"
                ref={(element) => {
                  buttons.current[index] = element;
                }}
                data-network-edge={index}
                data-hint-action={hinted ? hintEdge.kind : undefined}
                className={`go-edge-choice ${selected ? "go-edge-selected" : ""} ${hinted ? "go-hinted" : ""}`}
                disabled={paused || won}
                aria-pressed={selected}
                aria-label={`线路 ${edgeName(index)}，造价 ${edge.cost}，${selected ? "已连接，再点取消" : "未连接"}${hinted ? "，提示线路" : ""}`}
                onClick={() => toggle(index)}
                onKeyDown={(event) => {
                  if (event.ctrlKey || event.metaKey || event.altKey) return;
                  if (
                    !event.key.startsWith("Arrow") &&
                    event.key !== "Home" &&
                    event.key !== "End"
                  )
                    return;
                  event.preventDefault();
                  if (!paused && !won)
                    buttons.current[
                      networkKeyboardEdge(config.edges.length, index, event.key)
                    ]?.focus();
                }}
              >
                <span className="go-edge-check" aria-hidden="true">
                  {selected ? "✓" : "+"}
                </span>
                <span>
                  <b>{edgeName(index)}</b>
                  <small>造价 {edge.cost}</small>
                </span>
                {hinted && <span aria-hidden="true">★</span>}
              </button>
            );
          })}
        </div>
      </section>
      <aside className="game-notes gp-guide">
        <span className="mini-label">连通 · 权衡 · 最优方案</span>
        <h3>
          把小站连起来，
          <br />
          把每一份预算用好。
        </h3>
        <p id={description}>
          点下方线路按钮建造，再点一次取消。所有小站都要互相到达，总造价要达到目标。可以经过其他站换乘，不需要把每对站直接连接。
        </p>
        <div className="note">
          <strong>这一关的小发现</strong>
          <p>{config.idea}</p>
        </div>
        <p className="gp-insight">
          线路交叉不表示中途设站。不同的线路组合可能同样省钱，任何最低造价的连通树都会通过。绿色实线和
          ✓ 表示已建造。
        </p>
        <p className="muted">
          Tab 或方向键选线路，Enter /
          空格切换。提示会标出一个可执行步骤，不会替你建造。没有时间限制，可以随时撤销。
        </p>
      </aside>
    </div>
  );
}
