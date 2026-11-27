// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import { cartHint, inspectPulse, magneticSave, moveCart, restoreCart, type Move } from "./magneticMazeLogic";
import { magneticBoards } from "./magneticMazeLevels";
import "./magneticMaze.css";

const intro = "先选磁铁看落点，再确认滑行。";
const success = "小车停在出口，成功通过！";
const blockedText = {
  axis: "小车和磁铁不在同一行或同一列。",
  screen: "小车与目标磁铁之间有墙或另一块磁铁。",
  stalled: "小车背后的滑轨已堵住，或没有空格可滑。",
};

export default function MagneticMaze(props: GameProps) {
  return <Round key={props.level + ":" + props.resetToken} {...props} />;
}

function Round({ level, paused, freshStart, hintToken, undoToken, onComplete, onStatus }: GameProps) {
  const b = magneticBoards[level] ?? magneticBoards[0];
  const key = magneticSave + ".round." + level;
  const [history, setHistory] = useState(() => {
    try { return restoreCart(b, freshStart ? null : localStorage.getItem(key)); }
    catch { return restoreCart(b); }
  });
  const [selection, setSelection] = useState<number | null>(null);
  const [hint, setHint] = useState<Move | null>(null);
  const [message, setMessage] = useState(intro);
  const [saved, setSaved] = useState(true);
  const step = history[history.length - 1];
  const p = step.position, won = p.cell === b.exit, locked = paused || won;
  const pad = b.tiles[p.cell] === "o";
  const anchor = selection === null ? null : b.magnets[selection];
  const preview = selection === null ? null : inspectPulse(b, p, selection);
  const slide = preview?.kind === "slide" ? preview : null;
  const live = useRef({ onComplete, onStatus });
  live.current = { onComplete, onStatus };
  const used = useRef({ hintToken, undoToken, complete: false });

  function report(text: string) {
    setMessage(text);
    live.current.onStatus(text);
  }
  useEffect(() => { live.current.onStatus(intro); }, []);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ id: b.id, moves: history.slice(1).map(s => s.move) }));
      setSaved(true);
    } catch { setSaved(false); }
  }, [key, b.id, history]);
  useEffect(() => { if (paused) { setSelection(null); setHint(null); } }, [paused]);
  useEffect(() => {
    if (!won || paused || used.current.complete) return;
    used.current.complete = true;
    live.current.onStatus(success);
    live.current.onComplete();
  }, [won, paused]);
  useEffect(() => {
    if (used.current.hintToken === hintToken) return;
    used.current.hintToken = hintToken;
    if (locked) return;
    const next = cartHint(b, p);
    setSelection(null);
    setHint(next?.move ?? null);
    report(next
      ? (next.move === "flip" ? "建议在翻转台切换小车磁极" : "建议选择磁铁 " + b.magnets[next.move].label) + "，最短还需 " + next.distance + " 步。"
      : "从当前位置已无通关路线。试试撤销。");
  }, [b, p, locked, hintToken]);
  useEffect(() => {
    if (used.current.undoToken === undoToken) return;
    used.current.undoToken = undoToken;
    if (locked) return;
    setSelection(null);
    setHint(null);
    if (history.length > 1) {
      setHistory(history.slice(0, -1));
      report("已撤销一步，小车的位置和磁极已恢复。");
    } else report("还没有可以撤销的动作。");
  }, [history, locked, undoToken]);

  function select(index: number) {
    if (locked || !b.magnets[index]) return;
    setHint(null);
    setSelection(index);
  }
  function cancel() {
    if (locked) return;
    setSelection(null);
    report("已取消预览，小车没有移动。");
  }
  function apply(move: Move) {
    if (locked) return;
    const next = moveCart(b, p, move);
    if (!next) {
      if (move === "flip") report("小车必须停在翻转台，才能翻转磁极。");
      return;
    }
    setSelection(null);
    setHint(null);
    setHistory([...history, { position: next, move }]);
    if (next.cell === b.exit) return;
    report(move === "flip" ? "小车现在是 " + next.pole + " 极。"
      : slide?.cells.includes(b.exit) ? "经过了出口，但小车必须停在出口才算过关。"
      : b.tiles[next.cell] === "o" ? "小车停在翻转台。你可以保留磁极，也可以翻转。"
      : "小车已停下。选择另一块磁铁，看看能滑到哪里。");
  }

  return <div className="puzzle-layout magnetic-maze" data-board={b.id} data-cart={p.cell}
    data-pole={p.pole} data-moves={history.length - 1} data-won={won} data-preview={preview?.kind ?? "none"}>
    <section className="mm-panel" tabIndex={0} aria-label="磁场迷宫操作区" onKeyDown={e => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.repeat || locked) return;
      const k = e.key.toUpperCase();
      const i = b.magnets.findIndex(m => m.label === k);
      if (i >= 0) { e.preventDefault(); select(i); }
      else if (k === "X") { e.preventDefault(); apply("flip"); }
      else if (e.key === "Backspace" && preview) { e.preventDefault(); cancel(); }
      else if (e.key === "Enter" && e.target === e.currentTarget && selection !== null && slide) {
        e.preventDefault(); apply(selection);
      }
    }}>
      <header className="mm-head">
        <div><small>滑轨实验 · 第 {level + 1} 关</small><h3>{b.title}</h3></div>
        <div className="mm-meter"><strong>小车 {p.pole} 极</strong><span>{history.length - 1} 步</span></div>
      </header>
      <div className="mm-board" style={{ "--mm-cols": b.width } as CSSProperties} aria-label="滑轨地图">
        {[...b.tiles].map((tile, cell) => {
          const i = b.magnets.findIndex(m => m.cell === cell);
          if (i >= 0) {
            const m = b.magnets[i];
            return <button type="button" key={cell} className="mm-tile mm-magnet" data-magnet={m.label}
              data-pole={m.pole} data-hint={hint === i} disabled={locked} aria-pressed={selection === i}
              aria-label={"磁铁 " + m.label + "，" + m.pole + " 极"} onClick={() => select(i)}>
              <b>{m.label}</b><span>{m.pole}</span>
            </button>;
          }
          const on = cell === p.cell, landing = slide?.end === cell, path = slide?.cells.includes(cell);
          const label = [tile === "#" ? "墙" : tile === "E" ? "出口" : tile === "o" ? "翻转台" : "滑轨",
            on && "小车 " + p.pole + " 极", landing && "预计落点"].filter(Boolean).join("，");
          return <div key={cell} className="mm-tile" data-cell={cell} data-tile={tile}
            data-path={!!path} data-landing={landing} data-cart={on} aria-label={label}>
            {on ? <b className="mm-cart">{p.pole}</b> : path && <span className="mm-arrow" aria-hidden="true">{slide?.arrow}</span>}
            {tile === "o" && <small>翻转</small>}{tile === "E" && <small>出口</small>}
            {landing && tile !== "E" && tile !== "o" && <small>落点</small>}
          </div>;
        })}
      </div>
      <div className="mm-readout" role="status" data-effect={slide ? (slide.matching ? "repel" : "attract") : undefined}>
        {paused ? "已暂停。" : won ? success : slide && anchor
          ? <><strong>{p.pole} / {anchor.pole} · {slide.matching ? "同极推开" : "异极吸引"} {slide.arrow}</strong>
            <span>落点：第 {Math.floor(slide.end / b.width) + 1} 行第 {slide.end % b.width + 1} 列{slide.end === b.exit ? "（出口）" : slide.cells.includes(b.exit) ? "（滑过出口，不算通关）" : ""}</span></>
          : preview && preview.kind !== "slide" ? blockedText[preview.kind] : message}
      </div>
      <div className="mm-actions">
        <button type="button" data-confirm disabled={locked || !slide} onClick={() => selection !== null && apply(selection)}>确认滑行</button>
        <button type="button" disabled={locked || !preview} onClick={cancel}>取消预览</button>
        <button type="button" data-flip data-hint={hint === "flip"} disabled={locked || !pad} onClick={() => apply("flip")}>翻转磁极</button>
      </div>
      {!saved && <p>浏览器未能保存这局，刷新可能丢失进度。</p>}
    </section>
    <aside className="game-notes">
      <span className="mini-label">极性 · 路线规划</span>
      <h3>同一块磁铁，能推也能拉。</h3>
      <div className="mm-lessons"><span><b>N / N</b> 同极推开</span><span><b>S / N</b> 异极吸引</span></div>
      <ol>
        <li>选同一行或列且没有遮挡的磁铁。先看箭头和落点，不会自动移动。</li>
        <li>小车沿直线滑到墙、磁铁或边界前。经过出口不算通关，必须停在出口。</li>
        <li>停在翻转台才能主动换极。提示不会执行动作；撤销会同时恢复位置和磁极。</li>
      </ol>
      <p>键盘：聚焦操作区，按磁铁字母预览、Enter 确认、退格取消、X 翻转。</p>
      <p>这是借用磁极概念的游戏规则，不模拟真实磁力。</p>
    </aside>
  </div>;
}
