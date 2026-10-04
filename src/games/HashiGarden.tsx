import { useRef, useState, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import {
  getHashiHint,
  hashiConflicts,
  hashiDegrees,
  hashiEdges,
  hashiLevels,
  isHashiSolved,
} from "./hashiLogic";
import {
  NetworkToolbar,
  networkDirectionalIndex,
  useNetworkRound,
} from "./NetworkDeductionRound";
import "./networkDeduction.css";
const islandName = (index: number) => String.fromCharCode(65 + index);
export default function HashiGarden(props: GameProps) {
  return <HashiRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function HashiRound(props: GameProps) {
  const config = hashiLevels[props.level] ?? hashiLevels[0],
    edges = hashiEdges(config);
  const round = useNetworkRound(props, {
    count: edges.length,
    maximum: 2,
    introduction:
      "依次点击两座对齐的相邻岛来搭桥。数字要满足，全部岛也要相连。",
    celebration: "每座岛桥数正确，群岛连成一体！",
    solved: (values) => isHashiSolved(config, values),
    conflicts: (values) => hashiConflicts(config, values),
    getHint: (values) => getHashiHint(config, values),
  });
  const [anchor, setAnchor] = useState<number | null>(null);
  const islands = useRef<(HTMLButtonElement | null)[]>([]);
  const positions = config.islands.map((island) => ({
    x: ((island.x + 1) / (config.width + 1)) * 100,
    y: ((island.y + 1) / (config.height + 1)) * 100,
  }));
  const degrees = hashiDegrees(config, round.state.values),
    selected = edges[round.selected];
  function choose(index: number) {
    if (round.paused || round.won) return;
    if (anchor === null) {
      setAnchor(index);
      round.report(
        `已选岛 ${islandName(index)}，再选一座同排或同列、之间没有岛的邻岛。`,
      );
      return;
    }
    if (anchor === index) {
      setAnchor(null);
      return;
    }
    const edge = edges.findIndex(
      (edge) =>
        (edge.a === anchor && edge.b === index) ||
        (edge.b === anchor && edge.a === index),
    );
    if (edge < 0) {
      setAnchor(index);
      round.report(
        "这两座岛不能直连。已改选这座岛，请寻找同排或同列最近的邻岛。",
      );
      return;
    }
    round.setSelected(edge);
    round.cycle(edge);
    setAnchor(null);
  }
  return (
    <div
      className="puzzle-layout network-game hashi-game"
      onKeyDown={round.keyboard}
    >
      <section className="board nd-panel">
        <div className="nd-heading">
          <div>
            <span className="mini-label">桥岛 · {props.level + 1} / 12</span>
            <h3>{config.title}</h3>
          </div>
          <span className="nd-badge">
            {
              degrees.filter(
                (degree, i) => degree === config.islands[i].bridges,
              ).length
            }{" "}
            / {config.islands.length}
            <small>岛屿桥数满足</small>
          </span>
        </div>
        <div
          className={`nd-board nd-hashi-board ${round.won ? "nd-won" : ""}`}
          role="group"
          aria-label="桥岛棋盘"
          data-hashi-board
        >
          <svg viewBox="0 0 100 100" className="nd-svg" aria-hidden="true">
            {edges.map(({ a, b }, index) => {
              const start = positions[a],
                end = positions[b],
                value = round.state.values[index],
                vertical = start.x === end.x,
                bad = round.conflicts.includes(index),
                hinted =
                  round.hint &&
                  round.hint.kind !== "unavailable" &&
                  round.hint.index === index;
              return (
                <g
                  key={index}
                  data-hashi-edge={index}
                  data-value={value}
                  data-conflict={bad}
                >
                  {(round.selected === index || hinted) && (
                    <line
                      className="nd-route-selected"
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                    />
                  )}
                  {value > 0 ? (
                    Array.from({ length: value }, (_, i) => {
                      const offset = value === 2 ? (i ? 0.8 : -0.8) : 0;
                      return (
                        <line
                          key={i}
                          className={`nd-bridge ${bad ? "nd-bad-line" : ""}`}
                          x1={start.x + (vertical ? offset : 0)}
                          y1={start.y + (vertical ? 0 : offset)}
                          x2={end.x + (vertical ? offset : 0)}
                          y2={end.y + (vertical ? 0 : offset)}
                        />
                      );
                    })
                  ) : (
                    <line
                      className="nd-route-empty"
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                    />
                  )}
                  {bad && (
                    <text
                      className="nd-cross"
                      x={(start.x + end.x) / 2 + 2}
                      y={(start.y + end.y) / 2 - 2}
                    >
                      !
                    </text>
                  )}
                  {value === 0 && (
                    <text
                      className="nd-cross"
                      x={(start.x + end.x) / 2}
                      y={(start.y + end.y) / 2 + 1.4}
                    >
                      ×
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          {config.islands.map((island, index) => (
            <button
              key={index}
              type="button"
              ref={(element) => {
                islands.current[index] = element;
              }}
              className={`nd-island ${degrees[index] === island.bridges ? "nd-satisfied" : ""} ${degrees[index] > island.bridges ? "nd-bad" : ""} ${anchor === index ? "nd-anchor" : ""}`}
              style={
                {
                  left: `${positions[index].x}%`,
                  top: `${positions[index].y}%`,
                } as CSSProperties
              }
              data-hashi-island={index}
              data-current={degrees[index]}
              aria-label={`岛 ${islandName(index)}，第 ${island.y + 1} 行第 ${island.x + 1} 列，需要 ${island.bridges} 座桥，目前 ${degrees[index]} 座${anchor === index ? "，已选中" : ""}`}
              aria-pressed={anchor === index}
              disabled={round.paused || round.won}
              onClick={() => choose(index)}
              onKeyDown={(event) => {
                if (round.paused || round.won || !event.key.startsWith("Arrow"))
                  return;
                event.preventDefault();
                islands.current[
                  networkDirectionalIndex(positions, index, event.key)
                ]?.focus();
              }}
            >
              <span className="nd-island-name">{islandName(index)}</span>
              <strong>{island.bridges}</strong>
            </button>
          ))}
        </div>
        <label className="nd-route-picker">
          当前航线{" "}
          <select
            aria-label="选择桥岛航线"
            data-hashi-route
            value={round.selected}
            disabled={round.paused || round.won}
            onChange={(event) => {
              round.setSelected(Number(event.target.value));
              setAnchor(null);
            }}
          >
            {edges.map(({ a, b }, index) => (
              <option key={index} value={index}>
                {islandName(a)} ↔ {islandName(b)}
              </option>
            ))}
          </select>
          <span>
            {round.won
              ? "全部相连 ✓"
              : `${islandName(selected.a)} ↔ ${islandName(selected.b)}：${round.state.values[round.selected] < 0 ? "未定" : round.state.values[round.selected] === 0 ? "不连" : `${round.state.values[round.selected]} 座桥`}`}
          </span>
        </label>
        <NetworkToolbar round={round} maximum={2} />
      </section>
      <aside className="game-notes nd-guide">
        <span className="mini-label">计数 · 排除 · 连通</span>
        <h3>把群岛连成家。</h3>
        <p>
          岛上的数字是连接它的桥总数。桥只能横着或竖着搭到最近的岛，每对岛最多两座桥，不能交叉，也不能穿过岛。
        </p>
        <div className="note">
          <strong>所有岛必须连在一起</strong>
          <p>数字都够了还不一定完成：不能留下互不相通的小岛群。</p>
        </div>
        <p>{config.idea}</p>
        <p>
          依次点两座岛：空白 → 单桥 → 双桥 → × →
          空白。也可从航线列表选边，再点下方按钮。黄色航线是当前操作对象。
        </p>
        <p className="muted">
          Tab 或方向键选择岛，Enter / 空格选岛。1 单桥，2 双桥，X / 0
          不连，Delete / Backspace
          清空。提示只说明一步，需点击采用；暂时留白也可以完成。
        </p>
        <p className="nd-pause">
          {props.paused
            ? "已暂停，棋盘暂不可操作。"
            : "桥数满足的岛会变绿；红色提示超额或交叉。"}
        </p>
      </aside>
    </div>
  );
}
