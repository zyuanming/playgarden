// SPDX-License-Identifier: MIT
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import { fleetLevels } from "./fleetLevels";
import {
  FLEET_FRAGMENT_LABELS,
  checkFleet,
  createFleetState,
  editFleet,
  fillFleetSea,
  fleetFragment,
  fleetHint,
  fleetWon,
  undoFleet,
  type FleetFragment,
  type FleetMark,
} from "./fleetLogic";
import "./fleetLogic.css";
const marks: readonly FleetMark[] = ["ship", "sea", "unknown"];
const markLabels = { ship: "船格", sea: "海水", unknown: "未定" };
const glyph = (shape: FleetFragment) =>
  shape === "sea"
    ? "≈"
    : shape === "single"
      ? "●"
      : shape === "N"
        ? "▲"
        : shape === "E"
          ? "▶"
          : shape === "S"
            ? "▼"
            : shape === "W"
              ? "◀"
              : shape === "middle-h"
                ? "━"
                : shape === "middle-v"
                  ? "┃"
                  : "■";
export default function FleetLogic(props: GameProps) {
  return <FleetRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function FleetRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = fleetLevels[level] ?? fleetLevels[0],
    n = config.size;
  const [state, setState] = useState(() => createFleetState(config));
  const [brush, setBrush] = useState<FleetMark>("ship"),
    [focus, setFocus] = useState(0),
    [hintCell, setHintCell] = useState<number | null>(null);
  const [feedback, setFeedback] = useState(
    "根据行列数字和船形线索，把每格标成船或海水。不同船连斜角也不能相碰。",
  );
  const tokens = useRef({ hintToken, undoToken }),
    notified = useRef(false),
    buttons = useRef<(HTMLButtonElement | null)[]>([]),
    viewport = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const won = fleetWon(config, state.marks),
    locked = paused || won,
    occupied = state.marks.map((m) => m === "ship");
  const rowCounts = config.rowTotals.map(
    (_, r) =>
      state.marks.slice(r * n, (r + 1) * n).filter((m) => m === "ship").length,
  );
  const colCounts = config.colTotals.map(
    (_, c) => state.marks.filter((m, i) => i % n === c && m === "ship").length,
  );
  function revealCell(index: number) {
    const outer = viewport.current,
      cell = buttons.current[index];
    if (!outer || !cell) return;
    const bounds = outer.getBoundingClientRect(),
      item = cell.getBoundingClientRect();
    if (item.left < bounds.left + 6)
      outer.scrollLeft -= bounds.left + 6 - item.left;
    else if (item.right > bounds.right - 6)
      outer.scrollLeft += item.right - bounds.right + 6;
  }
  useLayoutEffect(() => {
    revealCell(focus);
  }, [focus]);
  useEffect(() => {
    if (!paused) callbacks.current.onStatus(feedback);
  }, [feedback, paused]);
  useEffect(() => {
    if (!paused && won && !notified.current) {
      notified.current = true;
      setFeedback("海图完成！船的长度、行列计数和周围留白全部正确。");
      callbacks.current.onComplete();
    }
  }, [won, paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked) return;
    const hint = fleetHint(config, state.marks);
    setFeedback(hint.text);
    setHintCell(hint.cell);
    if (hint.mark) setBrush(hint.mark);
    if (hint.cell !== null) setFocus(hint.cell);
  }, [hintToken, locked, config, state.marks]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    setState((current) => undoFleet(config, current));
    setHintCell(null);
    setFeedback(
      state.history.length ? "已撤销上一次标记。" : "还没有可撤销的标记。",
    );
  }, [undoToken, locked, config, state.history.length]);
  function paint(cell: number, mark = brush) {
    if (locked) return;
    if (config.clues.some((c) => c.cell === cell)) {
      setFeedback("这是固定线索，不能改写。它会帮助你推断周围的格子。");
      return;
    }
    setState((current) => editFleet(config, current, cell, mark));
    setHintCell(null);
    setFeedback(
      `第 ${Math.floor(cell / n) + 1} 行第 ${(cell % n) + 1} 列已标为${markLabels[mark]}。`,
    );
  }
  return (
    <div
      className="puzzle-layout fleet-game"
      data-game="fleet-logic"
      data-fleet-won={won}
    >
      <section className="fleet-playfield" aria-label="船队逻辑海图">
        <header className="fleet-heading">
          <div>
            <span className="mini-label">FLEET LOGIC · {level + 1} / 12</span>
            <h3>{config.title}</h3>
          </div>
          <span className="fleet-compass" aria-hidden="true">
            ✦
          </span>
        </header>
        <div
          className="fleet-inventory"
          aria-label={`船队清单：${[...new Set(config.fleet)].map((length) => `${length} 格船 ${config.fleet.filter((v) => v === length).length} 艘`).join("，")}`}
        >
          {[...new Set(config.fleet)].map((length) => (
            <span key={length}>
              <i className="fleet-mini-ship" aria-hidden="true">
                {Array.from({ length }, (_, i) => (
                  <b key={i} />
                ))}
              </i>
              <strong>
                × {config.fleet.filter((v) => v === length).length}
              </strong>
              <small>{length} 格船</small>
            </span>
          ))}
        </div>
        <div className="fleet-brushes" role="group" aria-label="选择标记工具">
          {marks.map((mark) => (
            <button
              type="button"
              key={mark}
              data-fleet-brush={mark}
              disabled={locked}
              aria-pressed={brush === mark}
              onClick={() => setBrush(mark)}
            >
              <span aria-hidden="true">
                {mark === "ship" ? "■" : mark === "sea" ? "≈" : "?"}
              </span>
              {markLabels[mark]}
            </button>
          ))}
        </div>
        <p className="fleet-scroll-help" id="fleet-scroll-help">
          窄屏可左右滑动海图；方向键换格会显示所选位置。
        </p>
        <div className="fleet-scroll" ref={viewport} data-fleet-viewport>
          <div
            className="fleet-grid"
            style={{ "--fleet-size": n } as CSSProperties}
            role="group"
            aria-describedby="fleet-scroll-help"
            aria-label={`${n} 行 ${n} 列海图。边缘数字为已标船格数与所需总数。方向键移动焦点，S 标船，W 标海水，U 清空。`}
          >
            <span className="fleet-axis" aria-hidden="true">
              列 →<br />行 ↓
            </span>
            {config.colTotals.map((total, c) => (
              <span
                key={`c${c}`}
                data-fleet-column={c}
                className={`fleet-total ${colCounts[c] === total ? "fleet-count-met" : colCounts[c] > total ? "fleet-count-over" : ""}`}
                aria-label={`第 ${c + 1} 列，已有 ${colCounts[c]} 船格，需要 ${total}`}
                style={{ gridRow: 1, gridColumn: c + 2 }}
              >
                <b>{total}</b>
                <small>
                  {colCounts[c]} / {total}
                </small>
              </span>
            ))}
            {config.rowTotals.map((total, r) => (
              <span
                key={`r${r}`}
                data-fleet-row={r}
                className={`fleet-total ${rowCounts[r] === total ? "fleet-count-met" : rowCounts[r] > total ? "fleet-count-over" : ""}`}
                aria-label={`第 ${r + 1} 行，已有 ${rowCounts[r]} 船格，需要 ${total}`}
                style={{ gridRow: r + 2, gridColumn: 1 }}
              >
                <b>{total}</b>
                <small>
                  {rowCounts[r]} / {total}
                </small>
              </span>
            ))}
            {state.marks.map((mark, cell) => {
              const clue = config.clues.find((c) => c.cell === cell),
                shape =
                  clue?.fragment ??
                  (mark === "ship" ? fleetFragment(n, occupied, cell) : "sea");
              return (
                <button
                  type="button"
                  key={cell}
                  ref={(button) => {
                    buttons.current[cell] = button;
                  }}
                  data-fleet-cell={cell}
                  data-mark={mark}
                  data-clue={clue?.fragment ?? ""}
                  disabled={locked}
                  aria-disabled={locked || Boolean(clue)}
                  tabIndex={focus === cell ? 0 : -1}
                  aria-label={`第 ${Math.floor(cell / n) + 1} 行第 ${(cell % n) + 1} 列，${clue ? `固定线索：${FLEET_FRAGMENT_LABELS[clue.fragment]}` : markLabels[mark]}${hintCell === cell ? "，提示位置" : ""}`}
                  style={{
                    gridRow: Math.floor(cell / n) + 2,
                    gridColumn: (cell % n) + 2,
                  }}
                  className={`fleet-cell fleet-${mark} ${clue ? "fleet-fixed" : ""} ${hintCell === cell ? "fleet-hinted" : ""}`}
                  onFocus={() => {
                    setFocus(cell);
                    revealCell(cell);
                  }}
                  onClick={() => paint(cell)}
                  onKeyDown={(event) => {
                    if (event.ctrlKey || event.metaKey || event.altKey) return;
                    const direction = (
                      {
                        ArrowUp: -n,
                        ArrowDown: n,
                        ArrowLeft: -1,
                        ArrowRight: 1,
                      } as Record<string, number>
                    )[event.key];
                    if (direction !== undefined) {
                      event.preventDefault();
                      if (locked) return;
                      const next = cell + direction;
                      if (
                        next < 0 ||
                        next >= n * n ||
                        (Math.abs(direction) === 1 &&
                          Math.floor(next / n) !== Math.floor(cell / n))
                      )
                        return;
                      setFocus(next);
                      buttons.current[next]?.focus();
                    }
                    const nextMark = (
                      { s: "ship", w: "sea", u: "unknown" } as Record<
                        string,
                        FleetMark
                      >
                    )[event.key.toLowerCase()];
                    if (nextMark) {
                      event.preventDefault();
                      paint(cell, nextMark);
                    }
                  }}
                >
                  <span
                    aria-hidden="true"
                    className={
                      mark === "ship" ? `fleet-shape fleet-shape-${shape}` : ""
                    }
                  >
                    {mark === "unknown" ? "·" : glyph(shape)}
                  </span>
                  {clue ? <small aria-hidden="true">线索</small> : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="fleet-actions">
          <button
            type="button"
            data-fleet-fill-sea
            disabled={locked || !state.marks.includes("unknown")}
            onClick={() => {
              if (locked) return;
              setState((current) => fillFleetSea(config, current));
              setHintCell(null);
              setFeedback("其余未定格已标海水；这一步可整体撤销。");
            }}
          >
            其余标海水
          </button>
          <button
            type="button"
            data-fleet-check
            disabled={locked}
            onClick={() =>
              setFeedback(
                state.marks.includes("unknown")
                  ? "还有未定格。请继续判断，或在船都放好后把其余格标海水。"
                  : checkFleet(config, occupied).message,
              )
            }
          >
            核对海图
          </button>
        </div>
        <p role="status" className="fleet-feedback" data-fleet-status>
          {paused ? "已暂停。线索仍可阅读，继续后再标记。" : feedback}
        </p>
      </section>
      <aside className="fleet-guide">
        <span className="mini-label">每条船都有线索</span>
        <h3>绘出整支船队</h3>
        <p>{config.lesson}</p>
        <ol>
          <li>边缘的大数字是该行或列的船格总数，小数字显示当前进度。</li>
          <li>每艘船必须笔直连续，长度和数量要符合上方清单。</li>
          <li>不同船不能边相接，也不能斜角相碰。</li>
          <li>
            带「线索」的格子固定不变。▲ ▼ ◀ ▶ 指向船的外端；━ 和 ┃ 是中段，●
            是单格船。
          </li>
        </ol>
        <div className="fleet-keyboard">
          键盘：方向键换格，S 标船，W 标海水，U 设为未定；Enter
          或空格使用当前工具。
        </div>
        <p>
          提示基于当前标记求解，不会自动填写。所有格都标为船或海水且满足规则后完成。
        </p>
      </aside>
    </div>
  );
}
