import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import {
  createShikakuState,
  getShikakuHint,
  isShikakuSolved,
  placeShikakuRectangle,
  removeShikakuRectangle,
  shikakuCells,
  shikakuLevels,
  shikakuRectangleFromCorners,
  undoShikaku,
  type ShikakuHint,
  type ShikakuRect,
} from "./shikakuLogic";
import "./regionCamping.css";
const colors = [
  "#cce2b2",
  "#f5dcb0",
  "#d8d4ed",
  "#b7dfe0",
  "#edcfc1",
  "#e3e9ab",
];
const introduction =
  "把整片花园划分成矩形。每块恰好包含一个数字，格数等于这个数字。依次点两个对角，无需拖动；点已画区域可移除。";
export default function ShikakuGarden(props: GameProps) {
  return <ShikakuRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function ShikakuRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = shikakuLevels[level] ?? shikakuLevels[0],
    n = config.size;
  const [state, setState] = useState(createShikakuState),
    [anchor, setAnchor] = useState<number | null>(null),
    [cursor, setCursor] = useState(0),
    [hint, setHint] = useState<ShikakuHint | null>(null),
    [message, setMessage] = useState(introduction);
  const cells = useRef<(HTMLButtonElement | null)[]>([]),
    callbacks = useRef({ onComplete, onStatus }),
    tokens = useRef({ hintToken, undoToken }),
    completed = useRef(false);
  callbacks.current = { onComplete, onStatus };
  const won = isShikakuSolved(config, state.rectangles),
    owners = Array.from({ length: n * n }, (_, i) =>
      state.rectangles.findIndex((r) => shikakuCells(n, r).includes(i)),
    ),
    covered = owners.filter((i) => i >= 0).length;
  function report(text: string) {
    setMessage(text);
    callbacks.current.onStatus(text);
  }
  useEffect(() => {
    callbacks.current.onStatus(introduction);
  }, []);
  useEffect(() => {
    if (!won || paused || completed.current) return;
    completed.current = true;
    report("每块面积刚刚好，整片花园都规划完成了！");
    callbacks.current.onComplete();
  }, [won, paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || won) return;
    const next = getShikakuHint(config, state.rectangles);
    setHint(next);
    setAnchor(null);
    report(next?.reason ?? "花园已经完成。");
  }, [hintToken, paused, won, config, state.rectangles]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused || won) return;
    setState((s) => undoShikaku(s));
    setHint(null);
    setAnchor(null);
    report(
      state.history.length
        ? "已撤销上一步的区域操作。"
        : "还没有可撤销的区域。",
    );
  }, [undoToken, paused, won, state.history.length]);
  function place(rect: ShikakuRect) {
    if (paused || won) return;
    const next = placeShikakuRectangle(state, config, rect);
    setAnchor(null);
    setHint(null);
    if (next === state) {
      report(
        "这块区域需要恰好包含一个数字、面积与数字相等，而且不能重叠。换两个角再试试。",
      );
      return;
    }
    setState(next);
    report("这块矩形的面积正确。继续让所有区域铺满花园。");
  }
  function remove(index: number) {
    if (paused || won) return;
    const next = removeShikakuRectangle(state, index);
    if (next === state) return;
    setState(next);
    setAnchor(null);
    setHint(null);
    report("已移除这块矩形，可以重新规划，也可以撤销。");
  }
  function choose(index: number) {
    if (paused || won) return;
    setCursor(index);
    if (anchor !== null) {
      const rect = shikakuRectangleFromCorners(n, anchor, index);
      if (rect) place(rect);
      return;
    }
    if (owners[index] >= 0) {
      remove(owners[index]);
      return;
    }
    setAnchor(index);
    setHint(null);
    report(
      `已选第 ${Math.floor(index / n) + 1} 行第 ${(index % n) + 1} 列作为第一个角；再点另一个对角。`,
    );
  }
  function cancel() {
    if (paused || won) return;
    setAnchor(null);
    setHint(null);
    report("已取消选角，区域保持不变。");
  }
  const preview =
    anchor === null
      ? []
      : shikakuCells(n, shikakuRectangleFromCorners(n, anchor, cursor)!);
  const hinted =
    hint?.kind === "deduction"
      ? shikakuCells(n, hint.rectangle)
      : hint?.kind === "repair"
        ? shikakuCells(n, state.rectangles[hint.index])
        : [];
  return (
    <div className="rc-layout" data-region-game="shikaku" data-complete={won}>
      <section className="rc-play" aria-label="矩形花园游戏">
        <header className="rc-heading">
          <div>
            <span className="rc-eyebrow">
              RECTANGLE GARDEN · {n} × {n}
            </span>
            <h3>{config.title}</h3>
          </div>
          <span className="rc-level">
            {String(shikakuLevels.indexOf(config) + 1).padStart(3, "0")} / {shikakuLevels.length}
          </span>
        </header>
        <p className="rc-campaign" data-shikaku-chapter={config.chapter ?? 0}>
          <strong>{config.chapter ? `练习 ${config.chapter} / 4` : "经典入门 · 12 关"}</strong>
          {" · "}{config.objective ?? "先观察面积与边界，再让矩形完整铺满花园。"}
        </p>
        <div className="rc-stats">
          <span>
            <strong>{covered}</strong> / {n * n} 格
          </span>
          <span data-region-count={state.rectangles.length}>
            {state.rectangles.length} / {config.clues.length} 块区域
          </span>
          <span>
            {paused
              ? "已暂停"
              : won
                ? "规划完成 ✓"
                : anchor === null
                  ? "选第一个角"
                  : "选另一个对角"}
          </span>
        </div>
        <div className="rc-board-wrap">
          <div
            className={`rc-shikaku-board ${won ? "is-won" : ""}`}
            style={{ "--rc-size": n } as CSSProperties}
            role="group"
            aria-label="矩形花园棋盘，方向键移动，回车或空格选择角"
            data-anchor={anchor ?? ""}
            onKeyDown={(e) => {
              if (paused || won || e.ctrlKey || e.altKey || e.metaKey) return;
              const delta: Record<string, [number, number]> = {
                ArrowUp: [-1, 0],
                ArrowDown: [1, 0],
                ArrowLeft: [0, -1],
                ArrowRight: [0, 1],
              };
              if (delta[e.key]) {
                e.preventDefault();
                const [dy, dx] = delta[e.key],
                  y = Math.max(0, Math.min(n - 1, Math.floor(cursor / n) + dy)),
                  x = Math.max(0, Math.min(n - 1, (cursor % n) + dx));
                setCursor(y * n + x);
                cells.current[y * n + x]?.focus();
              } else if (["Backspace", "Delete"].includes(e.key)) {
                e.preventDefault();
                if (owners[cursor] >= 0) remove(owners[cursor]);
                else cancel();
              } else if (e.key === "Escape" && anchor !== null) {
                e.preventDefault();
                e.stopPropagation();
                cancel();
              }
            }}
          >
            {owners.map((owner, index) => {
              const y = Math.floor(index / n),
                x = index % n,
                rect = state.rectangles[owner],
                clue = config.clues.find((c) => c.index === index),
                regionNumber = rect
                  ? config.clues.findIndex((c) =>
                      shikakuCells(n, rect).includes(c.index),
                    ) + 1
                  : 0;
              const style = rect
                ? {
                    background: colors[(regionNumber - 1) % colors.length],
                    borderTopWidth: y === rect[0] ? 3 : 1,
                    borderBottomWidth: y === rect[2] ? 3 : 1,
                    borderLeftWidth: x === rect[1] ? 3 : 1,
                    borderRightWidth: x === rect[3] ? 3 : 1,
                  }
                : {};
              return (
                <button
                  key={index}
                  ref={(el) => {
                    cells.current[index] = el;
                  }}
                  type="button"
                  data-shikaku-cell={index}
                  data-region={owner}
                  className={`rc-square ${rect ? "is-region" : ""} ${anchor === index ? "is-anchor" : ""} ${preview.includes(index) ? "is-preview" : ""} ${hinted.includes(index) ? "is-hinted" : ""}`}
                  style={style}
                  disabled={paused || won}
                  tabIndex={cursor === index ? 0 : -1}
                  onFocus={() => setCursor(index)}
                  onClick={() => choose(index)}
                  aria-label={`第 ${y + 1} 行第 ${x + 1} 列${clue ? `，面积 ${clue.area}` : "，空格"}${owner >= 0 ? `，区域 ${regionNumber}，点击移除` : anchor === index ? "，已选第一个角" : ""}`}
                  aria-pressed={anchor === index}
                >
                  {clue ? (
                    <strong>{clue.area}</strong>
                  ) : (
                    <span className="rc-grid-dot" aria-hidden="true" />
                  )}
                  {anchor === index && (
                    <i className="rc-corner-mark" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
          {paused && (
            <div className="rc-pause">
              <strong>花园休息中</strong>
              <span>继续后，接着规划你的区域</span>
            </div>
          )}
        </div>
        <div className="rc-board-caption">
          <span>两次点击画矩形 · 点击区域移除</span>
          <button
            type="button"
            onClick={cancel}
            disabled={paused || won || anchor === null}
          >
            取消选角
          </button>
        </div>
        <p className="rc-status" role="status">
          {message}
        </p>
        {hint && (
          <div className="rc-hint" data-region-hint={hint.kind}>
            <strong>
              {hint.kind === "deduction"
                ? "一块可以确定的区域"
                : hint.kind === "repair"
                  ? "先检查已有区域"
                  : "继续观察"}
            </strong>
            <p>{hint.reason}</p>
            {hint.kind !== "unavailable" && (
              <button
                type="button"
                disabled={paused || won}
                onClick={() =>
                  hint.kind === "deduction"
                    ? place(hint.rectangle)
                    : remove(hint.index)
                }
              >
                {hint.kind === "deduction" ? "采用这个矩形" : "撤回这块矩形"}
              </button>
            )}
          </div>
        )}
      </section>
      <aside className="rc-notes">
        <span className="rc-eyebrow">分区 · 面积 · 全局推理</span>
        <h3>
          给每一朵花，
          <br />
          刚刚好的空间。
        </h3>
        <p>
          数字是花床需要的面积。用不重叠的长方形或正方形铺满花园，每块必须恰好包含一个数字。
        </p>
        <div className="rc-rule-card">
          <div className="rc-area-demo" aria-label="面积六可以是两行三列">
            <b>6</b>
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <p>
            <strong>面积 6 = 2 × 3</strong>
            <br />
            也可能是 1 × 6；要结合边界和其他数字，才能确定朝向。
          </p>
        </div>
        <ol>
          <li>点一个角，再点对角，画出一块矩形。</li>
          <li>面积正确只是第一步，也要给其他区域留出位置。</li>
          <li>完整覆盖所有格子就能通关。颜色只帮助分区，不是线索。</li>
        </ol>
        <p className="rc-keyboard">
          键盘：方向键移动，Enter / 空格选角；Delete 移除所在区域。选角时 Esc
          取消。每次区域操作可撤销，最多保留最近 300 步。
        </p>
      </aside>
    </div>
  );
}
