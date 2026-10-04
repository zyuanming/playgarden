import { useRef, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import {
  getSlitherlinkHint,
  isSlitherlinkSolved,
  slitherlinkConflicts,
  slitherlinkCounts,
  slitherlinkEdges,
  slitherlinkLevels,
} from "./slitherlinkLogic";
import {
  NetworkToolbar,
  networkDirectionalIndex,
  useNetworkRound,
} from "./NetworkDeductionRound";
import "./networkDeduction.css";
export default function SlitherlinkGarden(props: GameProps) {
  return (
    <SlitherlinkRound key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function SlitherlinkRound(props: GameProps) {
  const config = slitherlinkLevels[props.level] ?? slitherlinkLevels[0],
    edges = slitherlinkEdges(config);
  const round = useNetworkRound(props, {
    count: edges.length,
    maximum: 1,
    introduction: "点击两点间的边画线，让所有线组成唯一闭环，并满足格内数字。",
    celebration: "数字全部吻合，花园被一个完整的环拥抱！",
    solved: (values) => isSlitherlinkSolved(config, values),
    conflicts: (values) => slitherlinkConflicts(config, values),
    getHint: (values) => getSlitherlinkHint(config, values),
  });
  const buttons = useRef<(HTMLButtonElement | null)[]>([]),
    counts = slitherlinkCounts(config, round.state.values);
  const positions = edges.map((edge) => ({
    x:
      ((edge.col + (edge.orientation === "h" ? 1 : 0.5)) / (config.cols + 1)) *
      100,
    y:
      ((edge.row + (edge.orientation === "v" ? 1 : 0.5)) / (config.rows + 1)) *
      100,
  }));
  return (
    <div
      className="puzzle-layout network-game slitherlink-game"
      onKeyDown={round.keyboard}
    >
      <section className="board nd-panel">
        <div className="nd-heading">
          <div>
            <span className="mini-label">数回 · {props.level + 1} / 12</span>
            <h3>{config.title}</h3>
          </div>
          <span className="nd-badge">
            {
              config.clues.filter((clue, i) => clue >= 0 && counts[i] === clue)
                .length
            }{" "}
            / {config.clues.filter((clue) => clue >= 0).length}
            <small>数字线索满足</small>
          </span>
        </div>
        <div
          className={`nd-board nd-slither-board ${round.won ? "nd-won" : ""}`}
          role="group"
          aria-label="数回棋盘"
          data-slitherlink-board
          style={
            {
              "--nd-cols": config.cols + 1,
              "--nd-rows": config.rows + 1,
            } as CSSProperties
          }
        >
          {config.clues.map((clue, index) => (
            <span
              key={`cell-${index}`}
              className={`nd-clue ${clue >= 0 && counts[index] === clue ? "nd-clue-satisfied" : ""} ${clue >= 0 && counts[index] > clue ? "nd-clue-bad" : ""}`}
              style={{
                left: `${(((index % config.cols) + 1) / (config.cols + 1)) * 100}%`,
                top: `${((Math.floor(index / config.cols) + 1) / (config.rows + 1)) * 100}%`,
              }}
              data-slitherlink-cell={index}
              aria-label={`第 ${Math.floor(index / config.cols) + 1} 行第 ${(index % config.cols) + 1} 列，${clue < 0 ? "无线索" : `需要 ${clue} 条边，目前 ${counts[index]} 条`}`}
            >
              {clue < 0 ? "" : clue}
            </span>
          ))}
          {Array.from(
            { length: (config.rows + 1) * (config.cols + 1) },
            (_, index) => (
              <span
                key={`dot-${index}`}
                className="nd-dot"
                aria-hidden="true"
                style={{
                  left: `${(((index % (config.cols + 1)) + 0.5) / (config.cols + 1)) * 100}%`,
                  top: `${((Math.floor(index / (config.cols + 1)) + 0.5) / (config.rows + 1)) * 100}%`,
                }}
              />
            ),
          )}
          {edges.map((edge, index) => {
            const value = round.state.values[index],
              hinted =
                round.hint &&
                round.hint.kind !== "unavailable" &&
                round.hint.index === index,
              bad = round.conflicts.includes(index);
            return (
              <button
                key={index}
                type="button"
                ref={(element) => {
                  buttons.current[index] = element;
                }}
                className={`nd-loop-edge nd-edge-${edge.orientation} ${value === 1 ? "nd-line-on" : value === 0 ? "nd-line-cross" : "nd-line-unknown"} ${round.selected === index ? "nd-selected" : ""} ${hinted ? "nd-hinted" : ""} ${bad ? "nd-bad" : ""}`}
                style={{
                  left: `${positions[index].x}%`,
                  top: `${positions[index].y}%`,
                }}
                data-slitherlink-edge={index}
                data-value={value}
                data-conflict={bad}
                aria-label={`${edge.orientation === "h" ? "横" : "竖"}边，第 ${edge.row + 1} 行第 ${edge.col + 1} 列，${value < 0 ? "未定" : value === 0 ? "不画线" : "已画线"}${bad ? "，需要检查" : ""}`}
                aria-pressed={value === 1}
                disabled={round.paused || round.won}
                onFocus={() => round.setSelected(index)}
                onClick={() => round.cycle(index)}
                onKeyDown={(event) => {
                  if (event.ctrlKey || event.metaKey || event.altKey) return;
                  if (
                    round.paused ||
                    round.won ||
                    !event.key.startsWith("Arrow")
                  )
                    return;
                  event.preventDefault();
                  const next = networkDirectionalIndex(
                    positions,
                    index,
                    event.key,
                  );
                  round.setSelected(next);
                  buttons.current[next]?.focus();
                }}
              >
                <span aria-hidden="true">{value === 0 ? "×" : ""}</span>
                {bad && (
                  <b className="nd-error-mark" aria-hidden="true">
                    !
                  </b>
                )}
              </button>
            );
          })}
        </div>
        <div className="nd-legend">
          <span>─ 已画线</span>
          <span>┄ 未定</span>
          <span>× 不画线</span>
          <span>{round.won ? "唯一闭环 ✓" : "圆点不能分岔"}</span>
        </div>
        <NetworkToolbar round={round} maximum={1} />
      </section>
      <aside className="game-notes nd-guide">
        <span className="mini-label">边界 · 次数 · 闭环</span>
        <h3>一根线，绕成花环。</h3>
        <p>
          数字表示这个格子四周恰好有几条线。空白格没有数字要求。所有画出的线必须组成一个不分岔、不自交的闭环，不能有小圈或断头。
        </p>
        <div className="note">
          <strong>圆点只连 0 或 2 条线</strong>
          <p>经过一个圆点就必须从另一条边离开；不能连接 1、3 或 4 条线。</p>
        </div>
        <p>{config.idea}</p>
        <p>
          点一条边会循环：空白 → 画线 → × →
          空白。叉是推理笔记；完成时不必把每条剩余边都标叉。黄色标记表示当前边。
        </p>
        <p className="muted">
          Tab 或方向键选边，Enter / 空格循环；1 画线，X / 0 标叉，Delete /
          Backspace 清空。提示结合当前棋盘，只给一个可核实的步骤。
        </p>
        <p className="nd-pause">
          {props.paused
            ? "已暂停，棋盘暂不可操作。"
            : "满足的数字会变绿；! 表示局部规则冲突。"}
        </p>
      </aside>
    </div>
  );
}
