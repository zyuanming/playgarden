// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  hint,
  move,
  moveNames,
  start,
  tidalLevels,
  won,
  type Move,
  type State,
} from "./tidalPostLogic";
import "./tidalPost.css";

const keys: Partial<Record<string, Move>> = {
  ArrowUp: "U",
  ArrowDown: "D",
  ArrowLeft: "L",
  ArrowRight: "R",
  w: "W",
  W: "W",
};
const buttons: [Move, string][] = [
  ["U", "↑"],
  ["L", "←"],
  ["W", "◷"],
  ["R", "→"],
  ["D", "↓"],
];
const labels: Record<string, string> = {
  "#": "礁石",
  ".": "小路",
  S: "起点",
  E: "邮站",
  w: "停靠台",
  a: "A 邮戳",
  b: "B 邮戳",
  "0": "潮门 0",
  "1": "潮门 1",
  "2": "潮门 2",
};
const firstAdvice = "看清下一拍潮位，再走进对应数字的潮门。";
const chapterName = (index: number) =>
  index < 12 ? "潮汐邮路" : index < 28 ? "辨认潮门" :
  index < 44 ? "停靠等潮" : index < 62 ? "双戳邮路" :
  index < 80 ? "带戳换潮" : "夜潮终程";

export default function TidalPost(props: GameProps) {
  return <Round key={`${props.level}:${props.resetToken}`} {...props} />;
}
function Round({
  level,
  paused,
  hintToken,
  undoToken,
  onStatus,
  onComplete,
}: GameProps) {
  const { rows, id } = tidalLevels[level] ?? tidalLevels[0];
  const [history, setHistory] = useState<State[]>(() => [start(rows)]);
  const state = history[history.length - 1],
    finished = won(rows, state),
    locked = paused || finished;
  const [advice, setAdvice] = useState<Move | null>(null);
  const [message, say] = useState(firstAdvice);
  const usedHint = useRef(hintToken),
    usedUndo = useRef(undoToken),
    reported = useRef(false);
  useEffect(() => { onStatus(firstAdvice); }, [onStatus, rows]);
  useEffect(() => {
    if (usedHint.current === hintToken) return;
    usedHint.current = hintToken;
    if (locked) return;
    const next = hint(rows, state);
    setAdvice(next);
    say(
      next
        ? `建议下一步：${moveNames[next]}。`
        : "当前没有可达邮站的路线。撤销一步或重来再试。",
    );
  }, [hintToken, locked, rows, state]);
  useEffect(() => {
    if (usedUndo.current === undoToken) return;
    usedUndo.current = undoToken;
    if (locked) return;
    setAdvice(null);
    if (history.length > 1) {
      setHistory(history.slice(0, -1));
      say("已撤销：位置、潮位和邮戳一起恢复。");
    } else say("还没有可以撤销的动作。");
  }, [undoToken, locked, history]);
  useEffect(() => {
    if (finished && !paused && !reported.current) {
      reported.current = true;
      onStatus("邮件已送达港口！");
      onComplete();
    }
  }, [finished, paused, onStatus, onComplete]);
  function act(action: Move) {
    if (locked) return;
    setAdvice(null);
    const result = move(rows, state, action);
    if ("reason" in result) {
      say(result.reason);
      return;
    }
    setHistory([...history, result.state]);
    if (result.state.stamps !== state.stamps)
      say(
        result.state.stamps === 3
          ? "已集齐 A、B 邮戳，可以送达邮站。"
          : "拿到了 A 邮戳，现在可以进入 B。",
      );
    else if (
      rows[result.state.y][result.state.x] === "E" &&
      !won(rows, result.state)
    )
      say("邮戳还没集齐，尚未送达。");
    else
      say(action === "W" ? "等了一拍，位置不变。" : "前进一格，潮位推进一拍。");
  }
  return (
    <div
      className="puzzle-layout tide-game"
      data-tide-won={finished}
      data-tide-id={id}
      data-tide-steps={history.length - 1}
      onKeyDown={(e) => {
        const a = keys[e.key];
        if (!a || locked || e.ctrlKey || e.altKey || e.metaKey || e.repeat)
          return;
        e.preventDefault();
        act(a);
      }}
    >
      <section className="tide-panel">
        <header>
          <span className="mini-label">{chapterName(level)} · 第 {level + 1} 关</span>
          <strong>{history.length - 1} 步</strong>
        </header>
        <div className="tide-meter">
          <span>
            当前潮位 <b data-tide-phase>{state.tide}</b>
          </span>
          <span>
            下一拍 <b>{(state.tide + 1) % 3}</b>
          </span>
          {rows.some((row) => row.includes("a")) && (
            <span>
              邮戳{" "}
              {state.stamps === 0 ? "无" : state.stamps === 1 ? "A" : "A · B"}
            </span>
          )}
        </div>
        <div
          className="tide-board"
          role="group"
          aria-label="潮汐棋盘，使用方向键移动，W 等一拍"
          tabIndex={0}
          style={{ gridTemplateColumns: `repeat(${rows[0].length}, 1fr)` }}
          data-tide-position={`${state.x},${state.y}`}
        >
          {rows.flatMap((row, y) =>
            [...row].map((t, x) => {
              const here = x === state.x && y === state.y,
                gate = /[0-2]/.test(t),
                collected =
                  (t === "a" && state.stamps & 1) ||
                  (t === "b" && state.stamps & 2);
              const glyph =
                t === "w"
                  ? "◷"
                  : t === "E"
                    ? "✉"
                    : t === "a" || t === "b"
                      ? t.toUpperCase()
                      : gate
                        ? t
                        : t === "S"
                          ? "⌂"
                          : "";
              return (
                <span
                  key={`${x}:${y}`}
                  className={`tide-cell ${t === "#" ? "rock" : gate ? "gate" : t === "w" ? "dock" : t === "E" ? "port" : ""}`}
                  aria-label={`${y + 1} 行 ${x + 1} 列，${labels[t]}${here ? "，邮差在这里" : ""}${collected ? "，已收集" : ""}`}
                >
                  <small aria-hidden="true">
                    {glyph}
                    {collected ? "✓" : ""}
                  </small>
                  {here && (
                    <b aria-hidden="true" className="tide-courier">
                      ◆
                    </b>
                  )}
                </span>
              );
            }),
          )}
        </div>
        <div className="tide-controls" aria-label="邮差操作">
          {buttons.map(([a, glyph]) => (
            <button
              type="button"
              key={a}
              disabled={locked}
              data-tide-action={a}
              data-hinted={advice === a}
              onClick={() => act(a)}
              aria-label={moveNames[a]}
            >
              {glyph}
              <small>{moveNames[a]}</small>
            </button>
          ))}
        </div>
        <p className="tide-status" role="status">
          {paused ? "已暂停。" : finished ? "邮件已送达港口！" : message}
        </p>
      </section>
      <aside className="game-notes">
        <span className="mini-label">潮位 · 顺序 · 路线</span>
        <h3>每一步，潮水涨一拍。</h3>
        <p>
          把信送到 ✉ 邮站。每次走一格，潮位在 0、1、2 之间循环。数字潮门只看
          <strong>到达时</strong>的潮位。
        </p>
        <ul>
          <li>◷ 是停靠台，站在上面才能等一拍。</li>
          <li>若关卡有邮戳，先去 A，再去 B，最后送信。未取 A 时不能进入 B。</li>
          <li>走不通不会改变潮位。遇到岔路可以撤销，或用提示查看下一步。</li>
        </ul>
        <p>触屏点下方按钮；键盘聚焦棋盘后用方向键移动，按 W 等一拍。</p>
      </aside>
    </div>
  );
}
