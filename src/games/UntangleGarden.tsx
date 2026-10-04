import { useEffect, useId, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  createUntangleState,
  gardenKeyboardSpot,
  gardenPoint,
  isUntangleSolved,
  moveGardenNode,
  undoUntangle,
  untangleConflicts,
  untangleHint,
  untangleLevels,
  type UntangleHint,
} from "./untangleLogic";
import "./graphPathGames.css";
import "./graphOptimizationGames.css";

export default function UntangleGarden(props: GameProps) {
  return (
    <UntangleRound key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function UntangleRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = untangleLevels[level] ?? untangleLevels[0];
  const [state, setState] = useState(() => createUntangleState(config));
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<UntangleHint | null>(null);
  const seenHint = useRef(hintToken),
    seenUndo = useRef(undoToken),
    complete = useRef(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]),
    description = useId();
  const conflicts = untangleConflicts(config, state.positions),
    won = isUntangleSolved(config, state);
  const badEdges = new Set([
    ...conflicts.crossings.flat(),
    ...conflicts.throughNodes.map(([edge]) => edge),
  ]);
  const hintMove = hint?.kind === "move" ? hint : null;
  const coordinates = (spot: number) => {
    const point = gardenPoint(config.size, spot);
    return {
      x: 10 + (80 * point.x) / (config.size - 1),
      y: 10 + (80 * point.y) / (config.size - 1),
    };
  };
  const spotName = (spot: number) =>
    `第 ${Math.floor(spot / config.size) + 1} 行第 ${(spot % config.size) + 1} 列`;
  const hintText = hintMove
    ? `先点花朵 ${config.labels[hintMove.node]}，再点${spotName(hintMove.spot)}的空地。${hintMove.temporary ? "这是临时腾位置的一步，交叉可能暂时增加。" : "这是通向一份已验证布局的一步，交叉可能暂时增加。"}`
    : "";

  useEffect(() => {
    onStatus("先点一朵花，再点空地。让所有小路不交叉，也不穿过其他花朵。");
  }, []);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (paused || won) return;
    const next = untangleHint(config, state);
    setHint(next);
    if (next.kind === "move")
      onStatus(
        `先点花朵 ${config.labels[next.node]}，再点${spotName(next.spot)}。${next.temporary ? "先借空地腾出位置；交叉暂时增加也没关系。" : "这是通向一份已验证布局的一步；任何无交叉布局都能过关。"}`,
      );
    else onStatus("当前没有可用的移动提示，可以撤销或重置后再试。");
  }, [hintToken, paused, won, config, state, onStatus]);
  useEffect(() => {
    if (seenUndo.current === undoToken) return;
    seenUndo.current = undoToken;
    if (paused || won) return;
    const next = undoUntangle(state);
    setState(next);
    setHint(null);
    setSelected(null);
    onStatus(
      next === state
        ? "还没有移动花朵，没有需要撤销的步骤。"
        : "已经撤销上一次移动，可以换一块空地。",
    );
  }, [undoToken, paused, won, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !complete.current) {
      complete.current = true;
      onStatus(
        `花园整理好了！${config.edges.length} 条小路不交叉，也没有穿过其他花朵。`,
      );
      onComplete();
    }
  }, [won, paused, config.edges.length, onComplete, onStatus]);

  function choose(spot: number) {
    if (paused || won) return;
    const node = state.positions.indexOf(spot);
    if (node >= 0) {
      setSelected(selected === node ? null : node);
      if (selected === node || hintMove?.node !== node) setHint(null);
      onStatus(
        selected === node
          ? "已取消选择。"
          : `选中了花朵 ${config.labels[node]}。再点一块空地移动它。`,
      );
      return;
    }
    if (selected === null) {
      onStatus("先点一朵花，再点这块空地。");
      return;
    }
    const next = moveGardenNode(config, state, selected, spot);
    setState(next);
    setSelected(null);
    setHint(null);
    const result = untangleConflicts(config, next.positions);
    if (result.total)
      onStatus(
        `移动完成。还有 ${result.crossings.length} 处小路交叉，${result.throughNodes.length} 处小路穿过花朵。可以继续移动或撤销。`,
      );
  }
  return (
    <div
      className="puzzle-layout graph-game go-game"
      data-graph-game="untangle"
    >
      <section className="gp-play-area" aria-label="解绳花园游戏">
        <div className="gp-heading">
          <div>
            <span className="mini-label">解绳花园 · 第 {level + 1} 关</span>
            <h3>{config.title}</h3>
          </div>
          <span className="gp-counter">
            <strong>{conflicts.total}</strong>
            <small>待整理处</small>
          </span>
        </div>
        <div
          className={`gp-graph go-garden-board ${won ? "gp-won" : ""}`}
          role="group"
          aria-label="花园移动棋盘"
          aria-describedby={description}
          data-untangle-solved={won}
        >
          <svg className="gp-lines" viewBox="0 0 100 100" aria-hidden="true">
            {config.edges.map(([a, b], index) => {
              const first = coordinates(state.positions[a]),
                last = coordinates(state.positions[b]);
              return (
                <line
                  key={index}
                  x1={first.x}
                  y1={first.y}
                  x2={last.x}
                  y2={last.y}
                  className={
                    badEdges.has(index) ? "gp-conflict-edge" : "gp-walked-edge"
                  }
                  data-garden-edge={index}
                  data-conflict={badEdges.has(index)}
                />
              );
            })}
          </svg>
          {Array.from({ length: config.size * config.size }, (_, spot) => {
            const node = state.positions.indexOf(spot),
              point = coordinates(spot),
              flower = node >= 0;
            const hinted =
              hintMove?.spot === spot || (flower && hintMove?.node === node);
            return (
              <button
                key={spot}
                type="button"
                ref={(element) => {
                  buttons.current[spot] = element;
                }}
                className={`go-spot ${flower ? "go-flower" : "go-empty"} ${flower && selected === node ? "go-selected" : ""} ${hinted ? "go-hinted" : ""}`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                data-garden-spot={spot}
                data-garden-node={flower ? node : undefined}
                data-hint-destination={hintMove?.spot === spot}
                disabled={paused || won}
                aria-pressed={flower && selected === node}
                aria-label={`${
                  flower
                    ? `花朵 ${config.labels[node]}，连接 ${config.edges
                        .filter(([a, b]) => a === node || b === node)
                        .map(([a, b]) => config.labels[a === node ? b : a])
                        .join("、")}`
                    : "空地"
                }，${spotName(spot)}${flower && selected === node ? "，已选中" : ""}${hinted ? "，提示位置" : ""}`}
                onClick={() => choose(spot)}
                onKeyDown={(event) => {
                  if (paused || won) return;
                  if (
                    event.key === "Escape" &&
                    (selected !== null || hint !== null)
                  ) {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelected(null);
                    setHint(null);
                    return;
                  }
                  if (
                    !event.key.startsWith("Arrow") &&
                    event.key !== "Home" &&
                    event.key !== "End"
                  )
                    return;
                  event.preventDefault();
                  if (paused || won) return;
                  buttons.current[
                    gardenKeyboardSpot(config.size, spot, event.key)
                  ]?.focus();
                }}
              >
                {flower ? (
                  <>
                    <span aria-hidden="true">✿</span>
                    <b>{config.labels[node]}</b>
                  </>
                ) : (
                  <span aria-hidden="true">·</span>
                )}
                {hinted && (
                  <i className="go-hint-mark" aria-hidden="true">
                    ★
                  </i>
                )}
              </button>
            );
          })}
        </div>
        <div
          className={`gp-map-feedback ${conflicts.total ? "gp-has-conflicts" : ""}`}
          aria-live="polite"
          data-garden-feedback
        >
          {won
            ? "所有小路都舒展开了，花园完成！"
            : `交叉 ${conflicts.crossings.length} 处 · 穿过花朵 ${conflicts.throughNodes.length} 处 · 已移动 ${state.history.length} 次`}
        </div>
        {conflicts.total > 0 && (
          <details className="go-conflict-details">
            <summary>查看哪些小路需要整理</summary>
            <ul>
              {conflicts.crossings.map(([a, b]) => (
                <li key={`cross-${a}-${b}`}>
                  小路 {config.edges[a].map((n) => config.labels[n]).join("–")}{" "}
                  与 {config.edges[b].map((n) => config.labels[n]).join("–")}{" "}
                  相交。
                </li>
              ))}
              {conflicts.throughNodes.map(([edge, node]) => (
                <li key={`through-${edge}-${node}`}>
                  小路{" "}
                  {config.edges[edge].map((n) => config.labels[n]).join("–")}{" "}
                  穿过花朵 {config.labels[node]}。
                </li>
              ))}
            </ul>
          </details>
        )}
        {hintText && (
          <p className="go-hint-text" role="status">
            {hintText}
          </p>
        )}
        <div className="gp-legend">
          <span>
            <i className="gp-legend-used" />
            已整理小路
          </span>
          <span>
            <i className="go-conflict-legend" />
            红色虚线需要整理
          </span>
        </div>
      </section>
      <aside className="game-notes gp-guide">
        <span className="mini-label">空间 · 连线 · 规划</span>
        <h3>
          给每一条小路，
          <br />
          留出自己的空间。
        </h3>
        <p id={description}>
          先点一朵花，再点空地移动。不需要拖动。目标是让小路彼此不交叉，也不穿过第三朵花；多条小路在同一朵花相遇是允许的。
        </p>
        <div className="note">
          <strong>这一关的小发现</strong>
          <p>{config.idea}</p>
        </div>
        <p className="gp-insight">
          花朵只能停在圆点上。没有步数限制，也不必照着唯一答案摆放。提示给出一条能完成的整理路线，不保证每一步都减少交叉。
        </p>
        <p className="muted">
          Tab 或方向键选格子，Enter / 空格选择花朵或放下；Esc
          取消选择。走错了可以撤销，暂停时棋盘会锁住。
        </p>
      </aside>
    </div>
  );
}
