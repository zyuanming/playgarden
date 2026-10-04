import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import {
  createNonogramState,
  cycleNonogramCell,
  getNonogramHint,
  nonogramLevels,
  nonogramLineComplete,
  nonogramLineOptions,
  nonogramSolved,
  setNonogramCell,
  undoNonogram,
} from "./nonogramLogic";
import type { NonogramCell, NonogramHint } from "./nonogramLogic";
import "./gridDeduction.css";

export default function NonogramGarden(props: GameProps) {
  return (
    <NonogramRound key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function NonogramRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = nonogramLevels[level] ?? nonogramLevels[0];
  const [state, setState] = useState(() => createNonogramState(config));
  const [hint, setHint] = useState<NonogramHint | null>(null);
  const [cursor, setCursor] = useState(0);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const callbacks = useRef({ onStatus, onComplete });
  callbacks.current = { onStatus, onComplete };
  const tokens = useRef({ hintToken, undoToken });
  const notified = useRef(false);
  const won = nonogramSolved(config, state.board);
  const painted = state.board.filter((value) => value === 1).length;
  const total = config.solution.filter(Boolean).length;

  useEffect(() => {
    callbacks.current.onStatus(
      "边上的数字表示连续涂色的长度。数字之间至少隔一格。点格子可在涂色、叉号与空白之间循环。",
    );
  }, []);
  useEffect(() => {
    if (!won || paused || notified.current) return;
    notified.current = true;
    callbacks.current.onStatus(
      `图案出现了：${config.title}！所有行列线索都满足了。`,
    );
    callbacks.current.onComplete();
  }, [won, paused, config.title]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || won) return;
    const next = getNonogramHint(config, state.board);
    setHint(next);
    callbacks.current.onStatus(
      next
        ? `第 ${Math.floor(next.index / config.size) + 1} 行第 ${(next.index % config.size) + 1} 列：${next.reason}`
        : "继续观察行列交叉的位置；完成涂色即可，不必给每一格都打叉。",
    );
  }, [hintToken, paused, won, config, state.board]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    setState((current) => undoNonogram(current));
    setHint(null);
    callbacks.current.onStatus(
      state.history.length
        ? "已撤销上一笔，其他标记都保留了。"
        : "画纸还是空白，还没有可以撤销的一笔。",
    );
  }, [undoToken, paused, state.history.length]);

  function paint(index: number, value?: NonogramCell) {
    if (paused || won) return;
    const next =
      value === undefined
        ? cycleNonogramCell(state, index)
        : setNonogramCell(state, index, value);
    if (next === state) return;
    setState(next);
    setHint(null);
    callbacks.current.onStatus(
      `第 ${Math.floor(index / config.size) + 1} 行第 ${(index % config.size) + 1} 列已${next.board[index] === 1 ? "涂色" : next.board[index] === 0 ? "标为空格" : "清空"}。数字之间至少留一个空格。`,
    );
  }
  function clue(axis: "row" | "column", index: number) {
    const line = Array.from(
      { length: config.size },
      (_, i) =>
        state.board[
          axis === "row" ? index * config.size + i : i * config.size + index
        ],
    );
    const runs =
      axis === "row" ? config.rowClues[index] : config.columnClues[index];
    const contradiction = !nonogramLineOptions(config.size, runs, line).length;
    const complete = nonogramLineComplete(runs, line);
    return (
      <div
        key={`${axis}-${index}`}
        className={`gd-clue gd-clue-${axis} ${contradiction ? "is-conflict" : complete ? "is-satisfied" : ""}`}
        style={{
          gridRow: axis === "row" ? index + 2 : 1,
          gridColumn: axis === "row" ? 1 : index + 2,
        }}
        aria-label={`第 ${index + 1} ${axis === "row" ? "行" : "列"}线索：${runs.join("、") || "0"}${contradiction ? "，标记有冲突" : complete ? "，涂色已满足" : ""}`}
      >
        {(runs.length ? runs : [0]).map((run, i) => (
          <span key={i}>{run}</span>
        ))}
      </div>
    );
  }
  return (
    <div className="gd-layout" data-grid-game="nonogram">
      <section className="gd-play-area" aria-label="数织花园游戏">
        <div className="gd-heading">
          <div>
            <span className="gd-eyebrow">
              PICTURE LOGIC · {config.size} × {config.size}
            </span>
            <h3>{config.title}</h3>
          </div>
          <span className="gd-level">
            {String(level + 1).padStart(2, "0")} / 12
          </span>
        </div>
        <div className="gd-stats" aria-live="polite">
          <span>
            <strong>{painted}</strong> / {total} 格涂色
          </span>
          <span>
            <strong>{state.history.length}</strong> 笔
          </span>
          <span>{paused ? "已暂停" : won ? "图案完成 ✓" : "慢慢推理"}</span>
        </div>
        <div className={`gd-nonogram-wrap ${paused ? "is-paused" : ""}`}>
          <div
            className={`gd-nonogram ${won ? "is-won" : ""}`}
            style={{ "--gd-size": config.size } as CSSProperties}
            role="group"
            aria-label="数织棋盘，方向键选格，空格循环标记"
            onKeyDown={(event) => {
              if (
                paused ||
                won ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey
              )
                return;
              const key = event.key.toLowerCase();
              const delta: Record<string, [number, number]> = {
                ArrowUp: [-1, 0],
                ArrowDown: [1, 0],
                ArrowLeft: [0, -1],
                ArrowRight: [0, 1],
              };
              if (delta[event.key]) {
                event.preventDefault();
                const [dr, dc] = delta[event.key];
                const row = Math.max(
                  0,
                  Math.min(
                    config.size - 1,
                    Math.floor(cursor / config.size) + dr,
                  ),
                );
                const col = Math.max(
                  0,
                  Math.min(config.size - 1, (cursor % config.size) + dc),
                );
                cells.current[row * config.size + col]?.focus();
              } else if (["f", "x", "backspace", "delete"].includes(key)) {
                event.preventDefault();
                paint(cursor, key === "f" ? 1 : key === "x" ? 0 : -1);
              }
            }}
          >
            <div className="gd-clue-corner" aria-hidden="true">
              <span>↓</span>
              <span>→</span>
            </div>
            {Array.from({ length: config.size }, (_, i) => clue("column", i))}
            {Array.from({ length: config.size }, (_, i) => clue("row", i))}
            {state.board.map((value, index) => (
              <button
                key={index}
                type="button"
                ref={(element) => {
                  cells.current[index] = element;
                }}
                style={{
                  gridRow: Math.floor(index / config.size) + 2,
                  gridColumn: (index % config.size) + 2,
                }}
                className={`gd-pixel ${value === 1 ? "is-painted" : value === 0 ? "is-crossed" : ""} ${hint?.index === index && !paused ? "is-hinted" : ""}`}
                data-nonogram-cell={index}
                data-state={
                  value === 1 ? "filled" : value === 0 ? "marked" : "blank"
                }
                aria-label={`第 ${Math.floor(index / config.size) + 1} 行第 ${(index % config.size) + 1} 列，${value === 1 ? "已涂色" : value === 0 ? "已标空格" : "未确定"}${hint?.index === index && !paused ? "，提示位置" : ""}`}
                tabIndex={cursor === index ? 0 : -1}
                disabled={paused || won}
                onFocus={() => setCursor(index)}
                onClick={() => paint(index)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  paint(index, value === 0 ? -1 : 0);
                }}
              >
                <span aria-hidden="true">
                  {value === 0 ? "×" : value === 1 ? "" : "·"}
                </span>
              </button>
            ))}
          </div>
          {paused && (
            <div className="gd-pause-cover">
              暂停中<span>准备好后再继续</span>
            </div>
          )}
        </div>
        <div className="gd-board-caption">
          <span>点一下涂色 → 再点打叉 → 再点清空</span>
          <span>数字 0 表示全空</span>
        </div>
        {hint && !paused && !won && (
          <div className="gd-hint-card" role="status">
            <strong>
              {hint.kind === "repair" ? "先修正一笔" : "有依据的一步"}
            </strong>
            <p>
              第 {Math.floor(hint.index / config.size) + 1} 行第{" "}
              {(hint.index % config.size) + 1} 列：{hint.reason}
            </p>
            <button type="button" onClick={() => paint(hint.index, hint.value)}>
              应用这一步
            </button>
          </div>
        )}
      </section>
      <aside className="gd-notes">
        <span className="gd-eyebrow">行列 · 排除 · 小图画</span>
        <h3>
          数字里，
          <br />
          藏着一幅画。
        </h3>
        <p>
          左边看横行，上边看竖列。数字是连续涂色的格数；两个数字之间，至少隔一个空格。
        </p>
        <div
          className="gd-rule-demo"
          aria-label="线索 2、1 的示例：涂两格，空一格，再涂一格，最后空一格"
        >
          <strong>2　1</strong>
          <div>
            <i />
            <i />
            <i className="empty">×</i>
            <i />
            <i className="empty">×</i>
          </div>
        </div>
        <div className="gd-note">
          <strong>先从确定的格子开始。</strong>
          <p>
            一行写着 5，而一共只有 5
            格，就可以全部涂色。交叉观察行与列，每关都能靠逻辑解开。
          </p>
        </div>
        <div className="gd-legend">
          <span>
            <i className="painted" />
            涂色
          </span>
          <span>
            <i>×</i>确定空白
          </span>
          <span>
            <i>·</i>未确定
          </span>
        </div>
        <p className="gd-keyboard">
          键盘：方向键选格，Enter / 空格循环；F 涂色，X 打叉，Delete
          清空。也可以右键打叉。所有涂色正确就成功，无需补齐叉号。
        </p>
      </aside>
    </div>
  );
}
