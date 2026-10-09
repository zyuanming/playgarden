// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { GameProps } from "../lib/types";
import { parityChapters, parityLevels, type ParityDirection } from "./parityLevels";
import { parityAdjacent, parityDestination, parityWon, stepParity } from "../vendor/parityCore";
import { freshParityRound, loadParityRound, saveParityRound, undoParityRound, type ParityRound } from "./parityStorage";
import "./parityGame.css";

const directions: readonly { direction: ParityDirection; label: string; symbol: string }[] = [
  { direction: "u", label: "向上一步", symbol: "↑" },
  { direction: "l", label: "向左一步", symbol: "←" },
  { direction: "d", label: "向下一步", symbol: "↓" },
  { direction: "r", label: "向右一步", symbol: "→" },
];
const keyDirections: Record<string, ParityDirection> = {
  ArrowUp: "u", ArrowDown: "d", ArrowLeft: "l", ArrowRight: "r", w: "u", s: "d", a: "l", d: "r",
};
const cellName = (index: number) => `第 ${Math.floor(index / 3) + 1} 行第 ${index % 3 + 1} 列`;
export default function ParityGame(props: GameProps) {
  return <ParityRoundView key={`${props.level}:${props.resetToken}`} {...props} />;
}

function ParityRoundView({ level, paused, freshStart, hintToken, undoToken, onComplete, onStatus }: GameProps) {
  const puzzle = parityLevels[level] ?? parityLevels[0], blackWhite = puzzle.mode === "b&w";
  const intro = blackWhite
    ? "沿相邻格连续走：白格 +1，黑格 −1。让九个数字完全相同。"
    : "从青色边框出发，每走到相邻格，该格数字 +1。让九个数字完全相同。";
  const [round, setRound] = useState(() => freshStart ? freshParityRound(puzzle) : loadParityRound(level, puzzle));
  const [message, setMessage] = useState(intro), [saved, setSaved] = useState(true);
  const roundRef = useRef(round), boardRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onComplete, onStatus }); callbacks.current = { onComplete, onStatus };
  const notified = useRef(false), tokens = useRef({ hintToken, undoToken });
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const won = parityWon(round.values), locked = paused || won;
  const smallest = Math.min(...round.values), largest = Math.max(...round.values);
  const matching = Math.max(...round.values.map(value => round.values.filter(other => other === value).length));
  function report(text: string) { setMessage(text); callbacks.current.onStatus(text); }
  function update(next: ParityRound) { roundRef.current = next; setRound(next); }
  function arrive(destination: number) {
    const current = roundRef.current;
    if (paused || parityWon(current.values)) return;
    const next = stepParity(puzzle, current, destination);
    if (next === current) { report("只能从青框走到上下左右的相邻格；不能跳格、斜走或原地加数。"); return; }
    update({ ...next, history: [...current.history, destination] });
    report(`${cellName(destination)}：${current.values[destination]} ${puzzle.colors[destination] === "b" ? "−" : "+"} 1 = ${next.values[destination]}。继续寻找让九格同数的路线。`);
  }
  function move(direction: ParityDirection) {
    if (paused || parityWon(roundRef.current.values)) return;
    const destination = parityDestination(roundRef.current.cursor, direction);
    if (destination === null) { report("到边缘了。不能穿过边界，请选择另一个相邻方向。"); return; }
    arrive(destination);
  }
  function onKeyDown(event: KeyboardEvent) {
    const direction = keyDirections[event.key];
    if (!direction) return;
    event.preventDefault();
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    move(direction);
  }
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    suppressClick.current = false;
    if (locked || !event.isPrimary || event.button !== 0) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    if (Math.max(Math.abs(event.clientX - start.x), Math.abs(event.clientY - start.y)) >= 24) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }
  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current; gesture.current = null;
    if (!start || start.id !== event.pointerId || locked) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    suppressClick.current = true; event.preventDefault();
    move(Math.abs(dx) >= Math.abs(dy) ? dx > 0 ? "r" : "l" : dy > 0 ? "d" : "u");
  }
  useEffect(() => { callbacks.current.onStatus(intro); }, [intro]);
  useEffect(() => { setSaved(saveParityRound(level, puzzle, round)); }, [level, puzzle, round]);
  useEffect(() => { if (paused) { gesture.current = null; suppressClick.current = false; } }, [paused]);
  useEffect(() => {
    if (!won || paused || notified.current) return;
    notified.current = true;
    report(puzzle.number === 100
      ? `最后一关完成！九格都成了 ${round.values[0]}，用了 ${round.history.length} 步。可在关卡菜单回看已完成的关卡。`
      : `九格同数！全部都是 ${round.values[0]}，用了 ${round.history.length} 步。准备好再前往下一关。`);
    callbacks.current.onComplete();
  }, [won, paused, puzzle.number, round.values, round.history.length]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    gesture.current = null;
    const next = undoParityRound(puzzle, roundRef.current);
    report(next === roundRef.current ? "还没有可撤销的移动。起点不会自动加数。" : "已撤销上一步：数字和青框都回到刚才的位置。");
    update(next);
  }, [undoToken, locked, puzzle]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked) return;
    const current = roundRef.current;
    const whites = current.values.filter((_, index) => puzzle.colors[index] === "w");
    const blacks = current.values.filter((_, index) => puzzle.colors[index] === "b");
    const low = Math.max(...whites), high = blacks.length ? Math.min(...blacks) : Infinity;
    if (low > high) {
      report(`提示：白格只能增加，黑格只能减少。现在白格已有 ${low}，黑格已有 ${high}，已无法相遇；请撤销探索中的移动，或重来再规划。提示没有改变棋盘。`);
      return;
    }
    const target = blacks.length ? `最终同数只能在 ${low} 到 ${high} 之间` : `最终同数至少是 ${low}`;
    const candidates = directions.flatMap(({ direction }) => {
      const cell = parityDestination(current.cursor, direction);
      return cell === null ? [] : [cell];
    });
    const arrival = candidates[0];
    report(`提示：${target}，还要考虑连续路线。${cellName(arrival)}现在是 ${current.values[arrival]}，走过去会${puzzle.colors[arrival] === "b" ? "减少" : "增加"}到 ${current.values[arrival] + (puzzle.colors[arrival] === "b" ? -1 : 1)}。先想想哪些格还需要经过；这里只解释规则，没有替你移动。`);
  }, [hintToken, locked, puzzle]);

  return <div className="parity-layout" data-parity-id={puzzle.id} data-parity-values={round.values.join(",")}
    data-parity-cursor={round.cursor} data-parity-moves={round.history.length} data-parity-won={won} data-parity-mode={puzzle.mode}
    onKeyDown={onKeyDown} onKeyDownCapture={event => {
      if ((event.repeat || event.ctrlKey || event.metaKey || event.altKey) && ["Enter", " "].includes(event.key)) event.preventDefault();
    }}>
    <section className="parity-play" aria-label="步步同数棋盘">
      <header className="parity-heading"><div><span className="parity-eyebrow">{parityChapters[blackWhite ? 1 : 0]}</span><h2>每一步，都有回响。</h2></div><span className="parity-level">{String(puzzle.number).padStart(2, "0")}<small> / 100</small></span></header>
      <p className="parity-intro">{intro}</p>
      <div className="parity-stats"><span>已走 <strong>{round.history.length}</strong> 步</span><span>最多同数 <strong>{matching} / 9</strong></span><span>{paused ? "已暂停" : won ? "九格同数 ✓" : "不限时 · 不限步"}</span></div>
      <div ref={boardRef} className={`parity-board ${blackWhite ? "is-black-white" : "is-vanilla"} ${won ? "is-won" : ""}`}
        role="group" aria-label="3 行 3 列数字棋盘，青色边框是当前位置，可用方向键移动" tabIndex={0}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={() => { gesture.current = null; }} onLostPointerCapture={event => {
          // Touch starts with implicit capture on the child cell. Moving capture
          // to the board emits a bubbled loss from that cell; the board still
          // owns this gesture and must receive its final swipe direction.
          if (event.target === event.currentTarget && !event.currentTarget.hasPointerCapture(event.pointerId)) gesture.current = null;
        }}
        onPointerLeave={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) gesture.current = null; }}
        onClickCapture={event => { if (suppressClick.current && event.detail > 0) { suppressClick.current = false; event.preventDefault(); event.stopPropagation(); } }}>
        {round.values.map((value, index) => {
          const selected = round.cursor === index, adjacent = parityAdjacent(round.cursor, index), black = puzzle.colors[index] === "b";
          return <button key={index} type="button" className={`parity-cell ${black ? "is-black" : "is-white"} ${selected ? "is-selected" : ""} ${adjacent ? "is-adjacent" : ""}`}
            data-parity-cell={index} data-parity-color={puzzle.colors[index]} data-parity-value={value}
            aria-label={`${cellName(index)}，数字 ${value}，${black ? "黑格，走入减一" : "白格，走入加一"}${selected ? "，当前位置" : adjacent ? "，可走入" : "，非相邻"}`}
            aria-current={selected ? "location" : undefined} aria-disabled={locked || !adjacent} disabled={locked}
            onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.altKey) arrive(index); }}>
            <span className="parity-cell-sign" aria-hidden="true">{black ? "−1" : "+1"}</span>
            <strong>{value}</strong><span className="parity-cell-caption" aria-hidden="true">{selected ? "你在这里" : adjacent && !locked ? "可走入" : "\u00a0"}</span>
          </button>;
        })}
      </div>
      <div className="parity-directions" role="group" aria-label="移动方向">
        {directions.map(({ direction, label, symbol }) => <button type="button" key={direction} data-parity-direction={direction}
          aria-label={label} disabled={locked || parityDestination(round.cursor, direction) === null}
          onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.altKey) move(direction); }}><span aria-hidden="true">{symbol}</span></button>)}
      </div>
      <p className="parity-controls">点相邻格 · 在棋盘滑动 · 聚焦棋盘后用方向键</p>
      <p className="parity-save">{saved ? "本局路线已保存在此浏览器，离开后可继续。" : "当前路线暂时无法保存；可以继续玩和撤销，请保持页面打开。"}</p>
    </section>
    <aside className="parity-notes"><span className="parity-eyebrow">PARITY · 一条连续的路线</span><h3>走到一起，<br />变成同一个数。</h3>
      <div className="parity-legend"><span><i className="white" aria-hidden="true" />白格 <strong>+1</strong></span>{blackWhite && <span><i className="black" aria-hidden="true" />黑格 <strong>−1</strong></span>}</div>
      <ol><li>青框是你现在站的位置，起点不加数。</li><li>每步只能走到上下左右的相邻格。</li><li>{blackWhite ? "只改变刚抵达的格：白加一，黑减一。" : "只给刚抵达的格加一，其他数字不变。"}</li><li>九个数字完全相同时，才算完成。</li></ol>
      <div className={`parity-thought ${won ? "is-complete" : ""}`}><span>{won ? "这一刻，九格同数" : "观察数字之间的距离"}</span><strong>{won ? round.values[0] : `${smallest} → ${largest}`}</strong><p>{won ? "每一步都算数。可以继续下一关，也可以先休息。" : blackWhite ? "颜色不翻转。先比较白格的高值与黑格的低值，再想经过它们的次数。" : "每格都只会增加。先找最高的数字，再想其他格需要经过几次。"}</p></div>
      <details><summary>操作与小提示</summary><p>方向键或 W A S D 每按一次走一格。长按不会连走。Tab 可以聚焦棋盘、数字格和方向按钮，Enter 或空格激活按钮。Escape 暂停或继续。</p><p>滑动只控制方向，与手指落在哪一格无关。点格子则必须与青框相邻，不能斜走或跨格。</p><p>未完成时可撤销；重来恢复本关原始数字和起点。提示会解释当前局面的数字关系，不会替你移动或直接完成。</p></details>
      <p className="parity-message" role="note">{message}</p>
    </aside>
  </div>;
}
