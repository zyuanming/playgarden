// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, Sparkles, Star, X } from "lucide-react";
import type { GameProps } from "../lib/types";
import { createStarBattleState, markStarBattle, starBattleConflicts, starBattleHint, starBattleLevels, starBattleWon, undoStarBattle, type StarMark } from "./starBattleLogic";
import "./starBattle.css";

export default function StarBattle(props: GameProps) {
  return <StarBattleRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function StarBattleRound({ level, paused, hintToken, undoToken, onComplete, onStatus }: GameProps) {
  const config = starBattleLevels[level] ?? starBattleLevels[0];
  const [state, setState] = useState(() => createStarBattleState(config));
  const current = useRef(state);
  const [mode, setMode] = useState<StarMark>(1);
  const [hinted, setHinted] = useState<number | null>(null);
  const [message, setMessage] = useState("点击放下星星，再点同一颗可取下。每行、每列、每个字母区域都恰好一颗，星星之间不能相邻。");
  const callbacks = useRef({ onComplete, onStatus }); callbacks.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken }), notified = useRef(false);
  const won = starBattleWon(config, state.marks), conflicts = starBattleConflicts(config, state.marks);
  const stars = state.marks.flatMap((mark, index) => mark === 1 ? [index] : []);
  useEffect(() => { if (!paused) callbacks.current.onStatus(message); }, [message, paused]);
  useEffect(() => {
    if (won && !notified.current && !paused) { notified.current = true; setMessage("星图完成！每行、每列、每个区域都恰好一颗星星，彼此也留出了距离。"); callbacks.current.onComplete(); }
  }, [won, paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || starBattleWon(config, current.current.marks)) return;
    const hint = starBattleHint(config, current.current); setHinted(hint.cell); setMessage(hint.message);
  }, [hintToken, paused, config]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused || starBattleWon(config, current.current.marks)) return;
    const next = undoStarBattle(config, current.current);
    setMessage(next === current.current ? "还没有可以撤销的标记。" : "已撤回上一个标记，星星和叉号都已恢复。");
    current.current = next; setState(next); setHinted(null);
  }, [undoToken, paused, config]);
  function place(cell: number) {
    if (paused || starBattleWon(config, current.current.marks)) return;
    const next = markStarBattle(config, current.current, cell, mode);
    current.current = next; setState(next); setHinted(null);
    const errors = starBattleConflicts(config, next.marks);
    setMessage(errors.length ? "带红色边框的星星发生了冲突：检查同行、同列、同区域，以及四周八格。再点星星可以取下。" : next.marks[cell] === 2 ? "已记下一个叉号。叉号只是你的排除笔记，也可以再次点击清除。" : "没有直接冲突。继续检查还没有星星的行、列和区域。");
  }
  const n = config.size;
  return <div className="sb-game" data-star-battle-game data-star-battle-won={won} data-star-battle-stars={stars.length}>
    <section className="sb-field" aria-label="星星布阵棋盘">
      <header className="sb-heading"><div><span>CONSTELLATION STUDIO · {level + 1}/{starBattleLevels.length}</span><h2>{config.title}</h2></div><Sparkles size={29} aria-hidden="true" /></header>
      <div className="sb-stats"><span><strong>{stars.length} / {n}</strong> 颗星星</span><span>{n} 个区域</span><span>{conflicts.length ? `${conflicts.length} 颗冲突` : "星距检查 ✓"}</span></div>
      <div className="sb-tools" role="group" aria-label="标记方式"><button type="button" aria-pressed={mode === 1} disabled={paused || won} onClick={() => { setMode(1); setHinted(null); }}><Star size={17} aria-hidden="true" />放星星</button><button type="button" aria-pressed={mode === 2} disabled={paused || won} onClick={() => { setMode(2); setHinted(null); }}><X size={17} aria-hidden="true" />做排除</button></div>
      <div className="sb-board-frame">
        <div className="sb-column-counts" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>{Array.from({ length: n }, (_, col) => <span key={col} className={stars.filter((cell) => cell % n === col).length === 1 ? "sb-count-done" : ""}>{col + 1}<small>{stars.filter((cell) => cell % n === col).length}/1</small></span>)}</div>
        <div className="sb-board" role="group" aria-label={`${n} 乘 ${n} 星图区，按钮可用 Tab、Enter 或空格操作`} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {state.marks.map((mark, cell) => {
            const row = Math.floor(cell / n), col = cell % n, region = config.regions[cell], letter = String.fromCharCode(65 + region);
            const style = { "--sb-region": ["#e6eee3", "#f1e2df", "#e5e9f4", "#f7edcb", "#e0efef", "#f1e1ee", "#ede7d9", "#dfeaf3"][region], borderTopWidth: row === 0 || config.regions[cell - n] !== region ? 3 : 1, borderBottomWidth: row === n - 1 || config.regions[cell + n] !== region ? 3 : 1, borderLeftWidth: col === 0 || config.regions[cell - 1] !== region ? 3 : 1, borderRightWidth: col === n - 1 || config.regions[cell + 1] !== region ? 3 : 1 } as CSSProperties;
            return <button key={cell} type="button" style={style} className={`sb-cell ${mark === 1 ? "sb-starred" : ""} ${conflicts.includes(cell) ? "sb-conflict" : ""} ${hinted === cell ? "sb-hinted" : ""}`} data-sb-cell={cell} data-sb-mark={mark} data-sb-region={region} disabled={paused || won} aria-pressed={mark === 1} aria-label={`第 ${row + 1} 行第 ${col + 1} 列，${letter} 区，${mark === 1 ? "星星" : mark === 2 ? "排除标记" : "空格"}${conflicts.includes(cell) ? "，存在冲突" : ""}`} onClick={() => place(cell)}><small aria-hidden="true">{letter}</small><span aria-hidden="true">{mark === 1 ? "★" : mark === 2 ? "×" : ""}</span></button>;
          })}
        </div>
      </div>
      <div className="sb-regions" aria-label="区域星星数量">{Array.from({ length: n }, (_, region) => { const count = stars.filter((cell) => config.regions[cell] === region).length; return <span key={region} className={count === 1 ? "sb-region-done" : count > 1 ? "sb-region-error" : ""}><b>{String.fromCharCode(65 + region)}</b> {count}/1 {count === 1 && <Check size={12} aria-hidden="true" />}</span>; })}</div>
      <p className={`sb-feedback ${won ? "sb-success" : ""}`} role="status">{paused ? "星图已暂停，所有标记都留在原处。" : message}</p>
    </section>
    <aside className="sb-notes"><span className="sb-eyebrow">一颗星，三个约束</span><h3>为每片夜空，<br />留一颗星星。</h3><p>{config.lesson}</p><ol><li>每一行、每一列都恰好放一颗星星。</li><li>每个粗线围起、同字母的区域也恰好放一颗。</li><li>两颗星星不能上下、左右相邻，也不能斜着相邻。</li></ol><div className="sb-distance" aria-hidden="true">{Array.from({length:9},(_,i)=><span key={i}>{i===4?'★':'×'}</span>)}</div><p className="sb-small">星星四周的八格都要留空。无需填满所有叉号；任何满足全部规则的安排都算完成。提示会根据当前标记重新寻找可行安排。</p></aside>
  </div>;
}
