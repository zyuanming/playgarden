import { useEffect, useId, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { strokeKeyboardNode } from "./oneStrokeLogic";
import {
  createMapColorsState,
  isMapColorsSolved,
  mapAdjacency,
  mapColorConflicts,
  mapColorPalette,
  mapColorsHint,
  mapColorsLevels,
  paintMapNode,
  undoMapColors,
  type MapColorsHint,
} from "./mapColorsLogic";
import "./graphPathGames.css";

export default function MapColors(props: GameProps) {
  return (
    <MapColorsLevel key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function MapColorsLevel({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = mapColorsLevels[level] ?? mapColorsLevels[0];
  const [state, setState] = useState(() => createMapColorsState(config));
  const [selected, setSelected] = useState(0);
  const [hint, setHint] = useState<MapColorsHint | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const seenHint = useRef(hintToken),
    seenUndo = useRef(undoToken),
    completed = useRef(false);
  const description = useId();
  const won = isMapColorsSolved(config, state.colors),
    conflicts = mapColorConflicts(config, state.colors),
    adjacency = mapAdjacency(config);
  const conflictNodes = new Set(conflicts.flatMap(([a, b]) => [a, b]));
  const filled = state.colors.filter((color) => color >= 0).length;
  useEffect(() => {
    onStatus("先选颜色，再点花房。有连线的两间花房，颜色和符号都要不同。");
  }, []);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (paused || won) return;
    const result = mapColorsHint(config, state);
    setHint(result);
    if (result.kind === "undo")
      onStatus(
        `${conflicts.length ? `相邻花房 ${conflicts.map(([a, b]) => `${config.nodes[a].label} 和 ${config.nodes[b].label}`).join("、")} 使用了相同颜色。` : "目前虽然没有相同颜色的邻居，但剩余花房已经无法全部配好。"}请撤销 ${result.undoSteps} 次，再试另一种配色；也可以直接修改花房。`,
      );
    else if (result.node !== null && result.color !== null)
      onStatus(
        `给花房 ${config.nodes[result.node].label} 试试 ${mapColorPalette[result.color].name} ${mapColorPalette[result.color].symbol}。它适合你当前的配色，剩下的花房也还有安排空间。`,
      );
    else onStatus("暂时没有找到提示，可以撤销一步或重新安排相邻花房。");
  }, [hintToken, paused, won, state, config, onStatus]);
  useEffect(() => {
    if (seenUndo.current === undoToken) return;
    seenUndo.current = undoToken;
    if (paused || won) return;
    const next = undoMapColors(state);
    setState(next);
    setHint(null);
    onStatus(
      next === state
        ? "还没有可以撤销的配色。"
        : "已还原上一次涂色，包括被覆盖或擦掉的颜色。",
    );
  }, [undoToken, paused, won, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !completed.current) {
      completed.current = true;
      onStatus(
        `配色完成！${config.nodes.length} 间花房，每一对邻居都不一样。你的配色就是一个正确答案。`,
      );
      onComplete();
    }
  }, [won, paused, config.nodes.length, onStatus, onComplete]);
  function selectColor(color: number) {
    if (paused || won) return;
    setSelected(color);
    setHint(null);
    onStatus(
      color < 0
        ? "已选择橡皮，再点花房擦除颜色。"
        : `已选择 ${mapColorPalette[color].name} ${mapColorPalette[color].symbol}，再点要涂色的花房。`,
    );
  }
  function paint(node: number, color = selected) {
    if (paused || won) return;
    const next = paintMapNode(config, state, node, color);
    if (next === state) return;
    setState(next);
    setHint(null);
    if (isMapColorsSolved(config, next.colors)) return;
    const badNeighbors = mapColorConflicts(config, next.colors)
      .filter((edge) => edge.includes(node))
      .map(([a, b]) => config.nodes[a === node ? b : a].label);
    onStatus(
      color < 0
        ? `已擦除花房 ${config.nodes[node].label}，可以重新涂色。`
        : badNeighbors.length
          ? `花房 ${config.nodes[node].label} 和相邻的 ${badNeighbors.join("、")} 使用了相同颜色。给其中一间换个颜色吧。`
          : `花房 ${config.nodes[node].label} 已涂上 ${mapColorPalette[color].name} ${mapColorPalette[color].symbol}。`,
    );
  }
  return (
    <div
      className="puzzle-layout graph-game"
      data-graph-game="map-colors"
      onKeyDown={(event) => {
        const color = Number(event.key) - 1;
        if (
          /^[1-4]$/.test(event.key) &&
          color < config.colorCount &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          event.preventDefault();
          selectColor(color);
        }
      }}
    >
      <section className="gp-play-area" aria-label="缤纷地图游戏">
        <div className="gp-heading">
          <div>
            <span className="mini-label">
              {config.colorCount} 色挑战 · 第 {level + 1} 关
            </span>
            <h3>{config.title}</h3>
          </div>
          <span className="gp-counter">
            <strong>{filled}</strong> / {config.nodes.length}
            <small>已涂花房</small>
          </span>
        </div>
        <div className="gp-palette" role="group" aria-label="选择画笔颜色">
          {mapColorPalette.slice(0, config.colorCount).map((color, index) => (
            <button
              key={color.name}
              type="button"
              data-color={index}
              aria-label={`${index + 1} 号画笔，${color.name} ${color.symbol}`}
              aria-pressed={selected === index}
              className={selected === index ? "gp-selected-color" : ""}
              style={{ background: color.background, color: color.foreground }}
              disabled={paused || won}
              onClick={() => selectColor(index)}
            >
              <b aria-hidden="true">{color.symbol}</b>
              <span>{color.name}</span>
              <small aria-hidden="true">
                {selected === index ? "✓" : index + 1}
              </small>
            </button>
          ))}
          <button
            type="button"
            className={`gp-eraser ${selected === -1 ? "gp-selected-color" : ""}`}
            data-color="erase"
            aria-pressed={selected === -1}
            disabled={paused || won}
            onClick={() => selectColor(-1)}
          >
            ◇<span>橡皮</span>
            {selected === -1 && <small aria-hidden="true">✓</small>}
          </button>
        </div>
        <div
          className={`gp-graph gp-map-board ${won ? "gp-won" : ""}`}
          role="group"
          aria-label="缤纷地图棋盘"
          aria-describedby={description}
        >
          <svg className="gp-lines" viewBox="0 0 100 100" aria-hidden="true">
            {config.edges.map(([a, b]) => {
              const conflict =
                state.colors[a] >= 0 && state.colors[a] === state.colors[b];
              return (
                <g key={`${a}:${b}`}>
                  <line
                    className={
                      conflict ? "gp-conflict-edge" : "gp-neighbor-edge"
                    }
                    x1={config.nodes[a].x}
                    y1={config.nodes[a].y}
                    x2={config.nodes[b].x}
                    y2={config.nodes[b].y}
                  />
                  {conflict && (
                    <g>
                      <circle
                        cx={(config.nodes[a].x + config.nodes[b].x) / 2}
                        cy={(config.nodes[a].y + config.nodes[b].y) / 2}
                        r="2.4"
                        fill="#9b4334"
                      />
                      <text
                        x={(config.nodes[a].x + config.nodes[b].x) / 2}
                        y={(config.nodes[a].y + config.nodes[b].y) / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="gp-step-number"
                      >
                        !
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
          {config.nodes.map((node, index) => {
            const color = state.colors[index],
              paintColor = color < 0 ? null : mapColorPalette[color],
              hinted = hint?.kind === "paint" && hint.node === index;
            return (
              <button
                key={node.label}
                type="button"
                ref={(element) => {
                  refs.current[index] = element;
                }}
                data-node={index}
                data-painted={color}
                data-conflict={conflictNodes.has(index) ? "true" : "false"}
                className={`gp-node gp-map-node ${conflictNodes.has(index) ? "gp-conflict-node" : ""} ${hinted ? "gp-hinted" : ""}`}
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  background: paintColor?.background,
                  color: paintColor?.foreground,
                }}
                disabled={paused || won}
                aria-label={`花房 ${node.label}，${paintColor ? `${paintColor.name} ${paintColor.symbol}` : "未涂色"}，邻居 ${adjacency[index].map((n) => config.nodes[n].label).join("、")}${conflictNodes.has(index) ? "，颜色冲突" : ""}${hinted ? "，提示花房" : ""}`}
                onClick={() => paint(index)}
                onKeyDown={(event) => {
                  if (event.key === "Delete" || event.key === "Backspace") {
                    event.preventDefault();
                    paint(index, -1);
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
                  refs.current[
                    strokeKeyboardNode(config.nodes, index, event.key)
                  ]?.focus();
                }}
              >
                <small>{node.label}</small>
                <b aria-hidden="true">{paintColor?.symbol ?? "·"}</b>
                {hinted && (
                  <i className="gp-hint-star" aria-hidden="true">
                    ★
                  </i>
                )}
              </button>
            );
          })}
        </div>
        <div
          className={`gp-map-feedback ${conflicts.length ? "gp-has-conflicts" : ""}`}
          aria-label="配色检查"
        >
          {conflicts.length
            ? `! ${conflicts.map(([a, b]) => `${config.nodes[a].label}–${config.nodes[b].label}`).join("、")}：相邻同色`
            : won
              ? "✓ 所有邻居都不一样"
              : `○ ${config.nodes.length - filled} 间待涂 · 目前没有同色邻居`}
        </div>
      </section>
      <aside className="game-notes gp-guide">
        <span className="mini-label">配色 · 邻接 · 逻辑</span>
        <h3>
          邻居有点不同，
          <br />
          花园刚刚好。
        </h3>
        <p id={description}>
          先选一种画笔，再点花房。连线表示相邻：有连线的两间必须用不同的颜色。所有花房都涂好，而且每对邻居不同，就成功了。
        </p>
        <div className="note">
          <strong>这一关的小发现</strong>
          <p>{config.idea}</p>
        </div>
        <p className="gp-insight">
          每种颜色都有自己的符号：
          {mapColorPalette
            .slice(0, config.colorCount)
            .map((c) => c.symbol)
            .join(" ")}
          。不靠颜色也能辨认；你可以重复涂色，也可以用橡皮重想一想。
        </p>
        <p className="muted">
          Tab 或方向键选花房，Enter / 空格涂色。数字 1–{config.colorCount}{" "}
          换画笔，Delete 擦除当前花房。提示参考你现在的配色，不限制唯一答案。
        </p>
      </aside>
    </div>
  );
}
