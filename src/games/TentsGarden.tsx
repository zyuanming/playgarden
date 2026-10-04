import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import {
  createTentsState,
  cycleTentsCell,
  getTentsHint,
  isTentsSolved,
  setTentsCell,
  tentsConflicts,
  tentsLevels,
  undoTents,
  type TentsCell,
  type TentsHint,
} from "./tentsLogic";
import "./regionCamping.css";
function TreeIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 7 11 24h7L8 35h32L30 24h7Z" fill="currentColor" />
      <path
        d="M24 33v9"
        stroke="#785e3d"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function TentIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="m24 8 20 31H4Z"
        fill="#e3b86d"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="m24 8 3 31h-14Z" fill="#6b6540" />
      <path
        d="m24 8 3 31h17"
        fill="#efca81"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
const introduction =
  "每棵树与上下左右相邻的一顶帐篷一一配对。帐篷不能相互接触，包括对角。边上的数字是这一行或列的帐篷总数。";
export default function TentsGarden(props: GameProps) {
  return <TentsRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function TentsRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = tentsLevels[level] ?? tentsLevels[0],
    n = config.size;
  const [state, setState] = useState(() => createTentsState(config)),
    [cursor, setCursor] = useState(
      () =>
        Array.from({ length: n * n }, (_, i) => i).find(
          (i) => !config.trees.includes(i),
        ) ?? 0,
    ),
    [hint, setHint] = useState<TentsHint | null>(null),
    [message, setMessage] = useState(introduction);
  const cells = useRef<(HTMLButtonElement | null)[]>([]),
    callbacks = useRef({ onComplete, onStatus }),
    tokens = useRef({ hintToken, undoToken }),
    completed = useRef(false);
  callbacks.current = { onComplete, onStatus };
  const won = isTentsSolved(config, state.board),
    conflicts = tentsConflicts(config, state.board),
    count = state.board.filter((v) => v === 1).length;
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
    report("每棵树都有一顶帐篷，行列数量和间距全部正确。营地搭好了！");
    callbacks.current.onComplete();
  }, [won, paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || won) return;
    const next = getTentsHint(config, state.board);
    setHint(next);
    if (next && next.kind !== "unavailable") {
      setCursor(next.index);
      cells.current[next.index]?.focus();
      report(
        `第 ${Math.floor(next.index / n) + 1} 行第 ${(next.index % n) + 1} 列：${next.reason}`,
      );
    } else report(next?.reason ?? "营地已经完成。");
  }, [hintToken, paused, won, config, state.board, n]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    setState((s) => undoTents(s));
    setHint(null);
    report(
      state.history.length ? "已撤销上一笔标记。" : "还没有可以撤销的标记。",
    );
  }, [undoToken, paused, state.history.length]);
  function edit(index: number, value?: TentsCell) {
    if (paused || won) return;
    if (config.trees.includes(index)) {
      report("树的位置固定；在树的上下左右寻找空位。");
      return;
    }
    const next =
      value === undefined
        ? cycleTentsCell(state, config, index)
        : setTentsCell(state, config, index, value);
    if (next === state) return;
    setState(next);
    setHint(null);
    setCursor(index);
    report(
      tentsConflicts(config, next.board).length
        ? "带 ! 的帐篷违反了相邻、数量或配对规则，可以修改或撤销。"
        : `这一格已${next.board[index] === 1 ? "搭起帐篷" : next.board[index] === 0 ? "标为草地" : "恢复空白"}。继续观察相邻的树与行列数量。`,
    );
  }
  function lineClue(axis: "row" | "column", index: number) {
    const target =
        axis === "row" ? config.rowCounts[index] : config.columnCounts[index],
      amount = state.board.filter(
        (v, i) =>
          v === 1 &&
          (axis === "row" ? Math.floor(i / n) === index : i % n === index),
      ).length;
    return (
      <div
        key={`${axis}-${index}`}
        data-tents-clue={`${axis}-${index}`}
        data-count={amount}
        className={`rc-count rc-count-${axis} ${amount > target ? "is-conflict" : amount === target ? "is-satisfied" : ""}`}
        style={{
          gridRow: axis === "row" ? index + 2 : 1,
          gridColumn: axis === "row" ? 1 : index + 2,
        }}
        aria-label={`第 ${index + 1} ${axis === "row" ? "行" : "列"}需要 ${target} 顶帐篷，已有 ${amount} 顶`}
      >
        {target}
        <small aria-hidden="true">
          {amount > target ? "!" : amount === target ? "✓" : ""}
        </small>
      </div>
    );
  }
  return (
    <div className="rc-layout" data-region-game="tents" data-complete={won}>
      <section className="rc-play" aria-label="林间帐篷游戏">
        <header className="rc-heading">
          <div>
            <span className="rc-eyebrow">
              FOREST CAMPSITE · {n} × {n}
            </span>
            <h3>{config.title}</h3>
          </div>
          <span className="rc-level">
            {String(tentsLevels.indexOf(config) + 1).padStart(2, "0")} / 12
          </span>
        </header>
        <div className="rc-stats">
          <span>
            <strong>{count}</strong> / {config.trees.length} 顶帐篷
          </span>
          <span>{state.history.length} 笔标记</span>
          <span>{paused ? "已暂停" : won ? "营地完成 ✓" : "帐篷保持距离"}</span>
        </div>
        <div className="rc-board-wrap">
          <div
            className={`rc-tents-board ${won ? "is-won" : ""}`}
            style={{ "--rc-size": n } as CSSProperties}
            role="group"
            aria-label="林间帐篷棋盘，方向键移动，空格循环标记"
            onKeyDown={(e) => {
              if (paused || won || e.ctrlKey || e.metaKey || e.altKey) return;
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
              } else {
                const key = e.key.toLowerCase(),
                  value: TentsCell | null = ["t", "1"].includes(key)
                    ? 1
                    : ["g", "x", "0"].includes(key)
                      ? 0
                      : ["delete", "backspace"].includes(key)
                        ? -1
                        : null;
                if (value !== null) {
                  e.preventDefault();
                  edit(cursor, value);
                }
              }
            }}
          >
            <span className="rc-count-corner" aria-hidden="true">
              ♧
            </span>
            {Array.from({ length: n }, (_, i) => lineClue("column", i))}
            {Array.from({ length: n }, (_, i) => lineClue("row", i))}
            {state.board.map((value, index) => {
              const tree = config.trees.includes(index),
                bad = conflicts.includes(index);
              return (
                <button
                  type="button"
                  key={index}
                  ref={(el) => {
                    cells.current[index] = el;
                  }}
                  data-tents-cell={index}
                  data-value={value}
                  data-tree={tree}
                  data-tents-cursor={cursor === index}
                  aria-current={cursor === index ? "true" : undefined}
                  disabled={paused || won}
                  aria-disabled={tree || paused || won}
                  className={`rc-square ${cursor === index ? "is-cursor" : ""} ${tree ? "is-tree" : value === 1 ? "is-tent" : value === 0 ? "is-grass" : ""} ${bad ? "is-conflict" : ""} ${hint && hint.kind !== "unavailable" && hint.index === index ? "is-hinted" : ""}`}
                  style={{
                    gridRow: Math.floor(index / n) + 2,
                    gridColumn: (index % n) + 2,
                  }}
                  tabIndex={cursor === index ? 0 : -1}
                  onFocus={() => setCursor(index)}
                  onClick={() => {
                    setCursor(index);
                    edit(index);
                  }}
                  aria-label={`第 ${Math.floor(index / n) + 1} 行第 ${(index % n) + 1} 列，${tree ? "固定的树" : value === 1 ? "帐篷" : value === 0 ? "草地" : "未标记"}${bad ? "，规则冲突" : ""}`}
                >
                  {tree ? (
                    <TreeIcon />
                  ) : value === 1 ? (
                    <TentIcon />
                  ) : value === 0 ? (
                    <span className="rc-grass-mark" aria-hidden="true">
                      ×
                    </span>
                  ) : (
                    <span className="rc-grid-dot" aria-hidden="true" />
                  )}
                  {bad && (
                    <b className="rc-conflict-mark" aria-hidden="true">
                      !
                    </b>
                  )}
                </button>
              );
            })}
          </div>
          {paused && (
            <div className="rc-pause">
              <strong>营地休息中</strong>
              <span>继续后再来安排帐篷</span>
            </div>
          )}
        </div>
        <p
          className="rc-current-cell"
          id="tents-current-cell"
          data-testid="tents-current-cell"
        >
          当前格：第 {Math.floor(cursor / n) + 1} 行第 {(cursor % n) + 1} 列
          {config.trees.includes(cursor) ? "（固定的树）" : "（深色描边）"}
          。下方按钮只修改此格。
        </p>
        <div
          className="rc-tools"
          role="group"
          aria-label="给所选格子标记"
          aria-describedby="tents-current-cell"
        >
          <button
            type="button"
            disabled={paused || won || config.trees.includes(cursor)}
            onClick={() => edit(cursor, 1)}
          >
            搭帐篷 T
          </button>
          <button
            type="button"
            disabled={paused || won || config.trees.includes(cursor)}
            onClick={() => edit(cursor, 0)}
          >
            草地 X
          </button>
          <button
            type="button"
            disabled={paused || won || config.trees.includes(cursor)}
            onClick={() => edit(cursor, -1)}
          >
            清空
          </button>
        </div>
        <p className="rc-status" role="status">
          {message}
        </p>
        {hint && (
          <div className="rc-hint" data-region-hint={hint.kind}>
            <strong>
              {hint.kind === "deduction"
                ? "一个可以确定的位置"
                : hint.kind === "repair"
                  ? "先检查已有标记"
                  : "继续观察"}
            </strong>
            <p>{hint.reason}</p>
            {hint.kind !== "unavailable" && (
              <button
                type="button"
                disabled={paused || won}
                onClick={() => edit(hint.index, hint.value)}
              >
                {hint.kind === "deduction" ? "采用这一步" : "清除这个标记"}
              </button>
            )}
          </div>
        )}
      </section>
      <aside className="rc-notes">
        <span className="rc-eyebrow">配对 · 数量 · 邻接关系</span>
        <h3>
          树影之间，
          <br />
          留一点空间。
        </h3>
        <p>
          每一棵树需要一顶帐篷作伴。根据行列数量，在空地上安排一个安静、不拥挤的小营地。
        </p>
        <div className="rc-rule-card rc-camping-demo">
          <div aria-hidden="true">
            <TreeIcon />
            <span>↔</span>
            <TentIcon />
          </div>
          <p>
            <strong>上下左右，一一配对。</strong>
            <br />
            帐篷可以挨着多棵树，但最终每棵树和每顶帐篷必须各配对一次。不需要手动画连线。
          </p>
        </div>
        <ol>
          <li>行列数字表示这一行、这一列的帐篷总数。</li>
          <li>任意两顶帐篷都不能挨着，对角接触也不行。</li>
          <li>
            点击空格循环：帐篷 → 草地 × →
            空白。草地是笔记，放齐正确的帐篷即可通关。
          </li>
        </ol>
        <p className="rc-keyboard">
          方向键移动；Enter / 空格循环；T / 1 放帐篷，X / G / 0 标草地，Delete
          清空。可撤销最近 300 步。
        </p>
      </aside>
    </div>
  );
}
