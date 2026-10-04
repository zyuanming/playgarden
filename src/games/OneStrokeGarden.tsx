import { useEffect, useId, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  chooseStrokeNode,
  createOneStrokeState,
  isOneStrokeSolved,
  oneStrokeHint,
  oneStrokeLevels,
  strokeDegrees,
  strokeEdgeKey,
  strokeKeyboardNode,
  undoOneStroke,
  usedStrokeEdges,
  type OneStrokeHint,
} from "./oneStrokeLogic";
import "./graphPathGames.css";

export default function OneStrokeGarden(props: GameProps) {
  return (
    <OneStrokeLevel key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function OneStrokeLevel({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = oneStrokeLevels[level] ?? oneStrokeLevels[0];
  const [state, setState] = useState(createOneStrokeState);
  const [hint, setHint] = useState<OneStrokeHint | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const seenHint = useRef(hintToken),
    seenUndo = useRef(undoToken),
    completed = useRef(false);
  const description = useId();
  const won = isOneStrokeSolved(config, state),
    current = state.path.at(-1);
  const used = usedStrokeEdges(state),
    degrees = strokeDegrees(config);
  const oddLabels = config.nodes
    .filter((_, i) => degrees[i] % 2)
    .map((n) => n.label);
  const moves = Math.max(0, state.path.length - 1);
  const nextNodes =
    current === undefined
      ? []
      : config.edges.flatMap(([a, b]) =>
          a === current && !used.has(strokeEdgeKey(a, b))
            ? [b]
            : b === current && !used.has(strokeEdgeKey(a, b))
              ? [a]
              : [],
        );

  useEffect(() => {
    onStatus(
      "先选一个路口，再沿虚线逐点走。每条路只走一次，路口可以再次经过。",
    );
  }, []);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (paused || won) return;
    const result = oneStrokeHint(config, state);
    setHint(result);
    if (result.kind === "undo")
      onStatus(
        `这条路线已经把一些路留在了身后。请撤销 ${result.undoSteps} 次，再试另一条路；可以重新经过路口，但不能重走路段。`,
      );
    else if (result.node !== null)
      onStatus(
        result.kind === "start"
          ? `试着从 ${config.nodes[result.node].label} 出发。${oddLabels.length ? "它连着奇数条路，是这次路线的一端。" : "这一关每个路口都连着偶数条路，可以绕一圈回来。"}`
          : `从当前路口走到 ${config.nodes[result.node].label}。这条路还没走过，而且剩下的路仍能全部连起来。`,
      );
    else onStatus("暂时没有可用提示，可以撤销一步再观察。");
  }, [hintToken, paused, won, state, config, onStatus]);
  useEffect(() => {
    if (seenUndo.current === undoToken) return;
    seenUndo.current = undoToken;
    if (paused || won) return;
    const next = undoOneStroke(state);
    setState(next);
    setHint(null);
    onStatus(
      next === state
        ? "还没有可以撤销的路线。"
        : next.path.length
          ? `已退回 ${config.nodes[next.path.at(-1)!].label}，刚才的路段可以重新选择。`
          : "已取消起点，可以换一个路口出发。",
    );
  }, [undoToken, paused, won, state, config, onStatus]);
  useEffect(() => {
    if (won && !paused && !completed.current) {
      completed.current = true;
      onStatus(`走完了！${config.edges.length} 条路段，每一条都刚好经过一次。`);
      onComplete();
    }
  }, [won, paused, config.edges.length, onComplete, onStatus]);

  function choose(node: number) {
    if (paused || won) return;
    const result = chooseStrokeNode(config, state, node);
    setHint(null);
    if (result.state === state) {
      onStatus(
        result.outcome === "used-edge"
          ? "这条路已经走过了。路口可以再经过，但同一条路段不能重复；可以先撤销。"
          : "这两个路口之间没有直接的小路。请沿着虚线走到相连的路口。",
      );
      return;
    }
    setState(result.state);
    if (isOneStrokeSolved(config, result.state)) return;
    onStatus(
      result.outcome === "start"
        ? `从 ${config.nodes[node].label} 出发。接着点一个有虚线相连的路口。`
        : `来到 ${config.nodes[node].label}，已走 ${result.state.path.length - 1} / ${config.edges.length} 条路。${oneStrokeHint(config, result.state).kind === "undo" ? "现在剩下的路无法一笔走完，可以撤销或看提示。" : "继续沿未走过的虚线前进。"}`,
    );
  }
  return (
    <div className="puzzle-layout graph-game" data-graph-game="one-stroke">
      <section className="gp-play-area" aria-label="一笔花园游戏">
        <div className="gp-heading">
          <div>
            <span className="mini-label">一笔连线 · 第 {level + 1} 关</span>
            <h3>{config.title}</h3>
          </div>
          <span className="gp-counter">
            <strong>{moves}</strong> / {config.edges.length}
            <small>已走路段</small>
          </span>
        </div>
        <div
          className={`gp-graph gp-trail-board ${won ? "gp-won" : ""}`}
          role="group"
          aria-label="一笔连线棋盘"
          aria-describedby={description}
        >
          <svg className="gp-lines" viewBox="0 0 100 100" aria-hidden="true">
            {config.edges.map(([a, b], index) => {
              const key = strokeEdgeKey(a, b),
                done = used.has(key);
              const order =
                state.path
                  .slice(1)
                  .findIndex(
                    (node, i) => strokeEdgeKey(state.path[i], node) === key,
                  ) + 1;
              return (
                <g
                  key={key}
                  data-edge={key}
                  data-used={done ? "true" : "false"}
                >
                  <line
                    className={done ? "gp-walked-edge" : "gp-unused-edge"}
                    x1={config.nodes[a].x}
                    y1={config.nodes[a].y}
                    x2={config.nodes[b].x}
                    y2={config.nodes[b].y}
                  />
                  {done && (
                    <g>
                      <circle
                        cx={(config.nodes[a].x + config.nodes[b].x) / 2}
                        cy={(config.nodes[a].y + config.nodes[b].y) / 2}
                        r="2.4"
                        fill="#184e3c"
                      />
                      <text
                        x={(config.nodes[a].x + config.nodes[b].x) / 2}
                        y={(config.nodes[a].y + config.nodes[b].y) / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="gp-step-number"
                      >
                        {order || index + 1}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
          {config.nodes.map((node, index) => {
            const active = current === index,
              visited = state.path.includes(index),
              hinted = hint?.node === index && hint.kind !== "undo";
            return (
              <button
                key={node.label}
                ref={(element) => {
                  refs.current[index] = element;
                }}
                type="button"
                data-node={index}
                data-current={active ? "true" : "false"}
                data-visited={visited ? "true" : "false"}
                className={`gp-node gp-trail-node ${active ? "gp-current" : ""} ${visited ? "gp-visited" : ""} ${nextNodes.includes(index) ? "gp-reachable" : ""} ${hinted ? "gp-hinted" : ""}`}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                disabled={paused || won}
                aria-label={`路口 ${node.label}，连接 ${degrees[index]} 条路，相邻 ${config.edges.flatMap(([a, b]) => (a === index ? [config.nodes[b].label] : b === index ? [config.nodes[a].label] : [])).join("、")}${active ? "，当前位置" : visited ? "，已到访，可再次经过" : ""}${hinted ? "，提示路口" : ""}`}
                aria-pressed={active}
                onClick={() => choose(index)}
                onKeyDown={(event) => {
                  if (
                    !event.key.startsWith("Arrow") &&
                    event.key !== "Home" &&
                    event.key !== "End"
                  )
                    return;
                  event.preventDefault();
                  if (paused || won) return;
                  refs.current[
                    strokeKeyboardNode(config.nodes, index, event.key)
                  ]?.focus();
                }}
              >
                <span>{node.label}</span>
                {active && <small aria-hidden="true">此处</small>}
                {hinted && (
                  <i className="gp-hint-star" aria-hidden="true">
                    ★
                  </i>
                )}
              </button>
            );
          })}
        </div>
        <div className="gp-legend">
          <span>
            <i className="gp-legend-unused" />
            未走过
          </span>
          <span>
            <i className="gp-legend-used" />
            已走过 · 数字是顺序
          </span>
        </div>
        <div className="gp-route">
          <span className="mini-label">我的路线</span>
          <p aria-label="已走路线">
            {state.path.length
              ? state.path.map((n) => config.nodes[n].label).join(" → ")
              : "选择任意路口，试着出发。"}
          </p>
        </div>
      </section>
      <aside className="game-notes gp-guide">
        <span className="mini-label">观察 · 路线 · 图形思考</span>
        <h3>
          小路只走一次，
          <br />
          发现一笔的秘密。
        </h3>
        <p id={description}>
          先点起点，再点相邻路口。走过的小路会变成实线，留下顺序数字。每条路都要刚好走一次；同一个路口可以反复经过。
        </p>
        <div className="note">
          <strong>这一关的小发现</strong>
          <p>{config.idea}</p>
        </div>
        <p className="gp-insight">
          {oddLabels.length
            ? `奇数路口：${oddLabels.join("、")}。完整路线要从其中一个出发，在另一个结束。`
            : "所有路口都连着偶数条路。完整路线会回到自己的起点。"}
        </p>
        <p className="muted">
          不需要拖动。Tab 或方向键选路口，Enter /
          空格迈一步。提示不会自动走；走错了就撤销，没有时间限制。
        </p>
      </aside>
    </div>
  );
}
