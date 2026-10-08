// SPDX-License-Identifier: GPL-3.0-only
import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import { loopoverChapters, loopoverLevels } from "./loopoverLevels";
import { createLoopState, getLoopHint, LOOP_HISTORY_LIMIT, loopMoveKey, loopMoveLabel, loopSolved, playLoopMove, shiftLoopLine, undoLoopMove, type LoopMove } from "./loopoverLogic";
import { loadLoopRound, saveLoopRound } from "./loopoverStorage";
import "./loopoverGarden.css";

const intro = "先点行或列边上的箭头，比较移动前后，再点“确认环移”。越过边缘的数字会从另一边回来。";
export default function LoopoverGarden(props: GameProps) {
  return <LoopoverRound key={`${props.level}:${props.resetToken}`} {...props} />;
}

function LoopoverRound({ level, paused, freshStart, hintToken, undoToken, onComplete, onStatus }: GameProps) {
  const puzzle = loopoverLevels[level] ?? loopoverLevels[0];
  const [state, setState] = useState(() => freshStart ? createLoopState(puzzle) : loadLoopRound(level, puzzle));
  const [selected, setSelected] = useState<LoopMove | null>(null);
  const [message, setMessage] = useState(intro), [saved, setSaved] = useState(true);
  const stateRef = useRef(state), selectedRef = useRef<LoopMove | null>(null);
  const notified = useRef(false), tokens = useRef({ hintToken, undoToken });
  const arrowRefs = useRef(new Map<string, HTMLButtonElement>());
  const callbacks = useRef({ onComplete, onStatus }); callbacks.current = { onComplete, onStatus };
  const won = loopSolved(state.board), locked = paused || won;
  const limit = state.history.length >= LOOP_HISTORY_LIMIT;
  const matching = state.board.filter((tile, index) => tile === index).length;
  const preview = selected ? shiftLoopLine(state.board, puzzle.rows, puzzle.cols, selected) : null;
  const selectedKey = selected ? loopMoveKey(selected) : "";

  function report(text: string) { setMessage(text); callbacks.current.onStatus(text); }
  function clearSelection() { selectedRef.current = null; setSelected(null); }
  function update(next: typeof state) { stateRef.current = next; setState(next); }
  function select(move: LoopMove) {
    if (locked || limit) return;
    selectedRef.current = move; setSelected(move);
    report(`${loopMoveLabel(move)}一格。这里只是预览，按“确认环移”才会移动。`);
  }
  function commit() {
    const move = selectedRef.current;
    if (locked || !move) return;
    clearSelection(); // Consume synchronously: a double click cannot apply the same preview twice.
    const next = playLoopMove(puzzle, stateRef.current, move);
    if (next === stateRef.current) return;
    update(next); report(`已${loopMoveLabel(move)}一格。整条线一起走，其他格子保持原位。`);
    arrowRefs.current.get(loopMoveKey(move))?.focus({ preventScroll: true });
  }
  useEffect(() => { callbacks.current.onStatus(puzzle.lesson); }, [puzzle]);
  useEffect(() => { setSaved(saveLoopRound(level, puzzle, state)); }, [level, puzzle, state]);
  useEffect(() => { if (paused) clearSelection(); }, [paused]);
  useEffect(() => {
    if (!won || paused || notified.current) return;
    notified.current = true;
    report(`整盘归位！用了 ${state.history.length} 次环移，${puzzle.rows * puzzle.cols} 个数字都回到了自己的家。`);
    callbacks.current.onComplete();
  }, [won, paused, state.history.length, puzzle.rows, puzzle.cols]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    clearSelection();
    const next = undoLoopMove(puzzle, stateRef.current);
    report(next === stateRef.current ? "还没有可撤销的环移。箭头预览不会计步。" : "已撤销上一步，整行或整列都回到刚才的位置。");
    update(next);
  }, [undoToken, locked, puzzle]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked || limit) return;
    const hint = getLoopHint(puzzle, stateRef.current);
    if (!hint) return;
    selectedRef.current = hint.move; setSelected(hint.move);
    arrowRefs.current.get(loopMoveKey(hint.move))?.focus({ preventScroll: true });
    report(`提示：${loopMoveLabel(hint.move)}一格。沿已知可行路线还需 ${hint.remaining} 步；可能先退回探索中的一步，不保证最少。确认后才会移动。`);
  }, [hintToken, locked, limit, puzzle]);

  function arrow(move: LoopMove) {
    const key = loopMoveKey(move), active = selectedKey === key;
    return <button type="button" className={`loopover-arrow ${active ? "is-selected" : ""}`} key={key}
      ref={node => { if (node) arrowRefs.current.set(key, node); else arrowRefs.current.delete(key); }}
      data-loopover-move={key} aria-label={`${loopMoveLabel(move)}，预览`} aria-pressed={active}
      disabled={locked || limit} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.altKey) select(move); }}>
      <span aria-hidden="true">{move.axis === "row" ? move.delta === 1 ? "→" : "←" : move.delta === 1 ? "↓" : "↑"}</span>
    </button>;
  }
  const line = (board: readonly number[]) => !selected ? [] : selected.axis === "row"
    ? board.slice(selected.index * puzzle.cols, (selected.index + 1) * puzzle.cols)
    : Array.from({ length: puzzle.rows }, (_, row) => board[row * puzzle.cols + selected.index]);
  const tileClass = (tile: number) => `loopover-tile tone-${Math.floor(tile / puzzle.cols)}`;
  const numbers = (board: readonly number[]) => board.map(tile => tile + 1).join("、");
  return <div className="loopover-layout" data-loopover-id={puzzle.id} data-loopover-board={state.board.join(",")}
    data-loopover-moves={state.history.length} data-loopover-won={won} data-loopover-selected={selectedKey}
    onKeyDownCapture={event => { if ((event.repeat || event.ctrlKey || event.metaKey || event.altKey) && ["Enter", " "].includes(event.key)) event.preventDefault(); }}>
    <section className="loopover-play" aria-label="环移拼盘游戏">
      <header className="loopover-heading"><div><span className="loopover-eyebrow">{loopoverChapters[puzzle.chapter]}</span><h3>{puzzle.title}</h3></div><span className="loopover-counter">{String(level + 1).padStart(2, "0")} / {loopoverLevels.length}</span></header>
      <p className="loopover-lesson">{puzzle.lesson}</p>
      <div className="loopover-stats"><span>环移 <strong>{state.history.length}</strong> 次</span><span>归位 <strong>{matching} / {state.board.length}</strong></span><span>{paused ? "已暂停" : won ? "归位了 ✓" : "不计时 · 不限步"}</span></div>
      <p className="loopover-board-caption">行箭头横着移，列箭头竖着移</p>
      <div className="loopover-board" role="group" aria-label={`${puzzle.rows} 行 ${puzzle.cols} 列拼盘，箭头先预览，再确认环移`}
        style={{ "--loop-cols": puzzle.cols } as CSSProperties}>
        <span className="loopover-corner" aria-hidden="true">↻</span>
        {Array.from({ length: puzzle.cols }, (_, index) => arrow({ axis: "column", index, delta: -1 }))}
        <span aria-hidden="true" />
        {Array.from({ length: puzzle.rows }, (_, row) => <Fragment key={row}>
          {arrow({ axis: "row", index: row, delta: -1 })}
          {Array.from({ length: puzzle.cols }, (_, col) => {
            const index = row * puzzle.cols + col, tile = state.board[index];
            const affected = selected?.axis === "row" ? selected.index === row : selected?.axis === "column" && selected.index === col;
            return <div key={index} className={`${tileClass(tile)} ${affected ? "is-affected" : ""} ${tile === index ? "is-home" : ""}`}
              data-loopover-cell={index} data-loopover-value={tile} data-loopover-affected={Boolean(affected)}
              aria-label={`第 ${row + 1} 行第 ${col + 1} 列，数字 ${tile + 1}${tile === index ? "，已归位" : `，目标是 ${index + 1}`}`}>
              <strong>{tile + 1}</strong><span aria-hidden="true">{tile === index ? "·" : `→ ${index + 1}`}</span>
            </div>;
          })}
          {arrow({ axis: "row", index: row, delta: 1 })}
        </Fragment>)}
        <span aria-hidden="true" />
        {Array.from({ length: puzzle.cols }, (_, index) => arrow({ axis: "column", index, delta: 1 }))}
        <span className="loopover-corner" aria-hidden="true">↻</span>
      </div>
      <div className="loopover-preview" data-loopover-preview={selectedKey} aria-label="本次环移前后预览">
        <strong>{selected ? `${loopMoveLabel(selected)}一格` : won ? "整盘都已归位" : "① 点一个箭头，先看变化"}</strong>
        {selected && preview ? <>
          <small>{selected.axis === "row" ? "从左到右阅读这一行" : "从上到下阅读这一列"} · 边缘数字循环回到另一端</small>
          <div className="loopover-preview-line"><span>移动前</span><div data-loopover-before aria-label={`移动前：${numbers(line(state.board))}`}>{line(state.board).map(tile => <b key={tile} className={tileClass(tile)}>{tile + 1}</b>)}</div></div>
          <div className="loopover-preview-line"><span>移动后</span><div data-loopover-after aria-label={`移动后：${numbers(line(preview))}`}>{line(preview).map(tile => <b key={tile} className={tileClass(tile)}>{tile + 1}</b>)}</div></div>
        </> : <p>{won ? "从左到右、从上到下，数字排好了。" : "选中的整行或整列会亮起。预览不会计步，也不会改变棋盘。"}</p>}
      </div>
      <div className="loopover-actions"><button type="button" className="primary" data-loopover-confirm disabled={locked || limit || !selected}
        onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.altKey) commit(); }}>② 确认环移</button>
        <button type="button" disabled={locked || !selected} onClick={event => { if (event.ctrlKey || event.metaKey || event.altKey) return; clearSelection(); report("已取消预览，拼盘没有变化。"); }}>取消预览</button></div>
      <p className="loopover-message" role="note">{message}</p>
      {limit && !won && <p className="loopover-warning">本局操作记录已满。请撤销一步或点“重来”，再继续探索。</p>}
      <p className="loopover-save">{saved ? "此浏览器已保存这一局和撤销记录，离开后可继续。" : "浏览器暂时无法保存；仍可玩和撤销，请保持页面打开。"}</p>
    </section>
    <aside className="loopover-notes"><span className="loopover-eyebrow">一整条线，一起回家</span><h3>绕过边缘，<br />重新相遇。</h3><p>让所有数字按顺序排好。这里每格都有数字，每次移动一整行或一整列。</p>
      <div className="loopover-target"><strong>目标拼盘</strong><div role="img" aria-label={`目标按行顺序：1 到 ${state.board.length}`} style={{ gridTemplateColumns: `repeat(${puzzle.cols}, 1fr)` }}>
        {state.board.map((_, tile) => <span className={tileClass(tile)} key={tile}>{tile + 1}</span>)}
      </div><small>从左到右 · 从上到下</small></div>
      <ol><li>点边上的箭头，选中整条线。</li><li>对照移动前后，注意边缘的回环。</li><li>确认环移。每个数字归位就成功。</li></ol>
      <p>数字下的小字是所在格的目标数字。颜色只帮助寻找同一归位行，不能代替数字顺序。</p>
      <details><summary>提示和键盘</summary><p>Tab 选择箭头，Enter 或空格预览；再 Tab 到“确认环移”完成一步。长按和带 Ctrl / Alt / ⌘ 的按键不会重复提交。Escape 暂停或继续。</p><p>提示沿当前走法和关卡构造得到一条可行路线，去掉已经绕过的闭环，再给出下一步。它可能先退回你刚试的一步，不保证最短，也不会自动移动。</p><p>暂停会取消未确认的预览。未通关前可撤销；重来会恢复本关最初的拼盘。</p></details>
    </aside>
  </div>;
}
