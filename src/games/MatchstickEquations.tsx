// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { decodeMatchEquation, matchSegmentNames, matchSlotName, matchstickEquationsLevels, matchstickHint, moveMatch, type MatchSlot } from "./matchstickEquationsLogic";
import "./matchstickEquations.css";
const digitLines = [[20,12,60,12],[65,18,65,52],[65,64,65,98],[20,105,60,105],[15,64,15,98],[15,18,15,52],[20,58,60,58]];
const operatorLines = [[20,58,60,58],[40,37,40,79]];
function MatchGlyph({ mask, operator = false, marked = -1 }: {mask:number;operator?:boolean;marked?:number}) {
  return <svg viewBox="0 0 80 118" aria-hidden="true">{(operator ? operatorLines : digitLines).map(([x1,y1,x2,y2], i) => <g key={i} className={`${mask & (1<<i) ? "mseq-lit" : "mseq-vacant"} ${marked === i ? "mseq-mark" : ""}`}><line x1={x1} y1={y1} x2={x2} y2={y2}/>{Boolean(mask & (1<<i)) && <circle cx={x2} cy={y2} r="3.5"/>}</g>)}</svg>;
}
const tokenName = (token: number, length: number) => token === 0 ? "左数" : token === 1 ? "符号" : token === 2 ? "右数" : length === 4 ? "结果" : token === 3 ? "十位" : "个位";
export default function MatchstickEquations(props: GameProps) { return <MatchRound key={`${props.level}:${props.resetToken}`} {...props}/>; }
function MatchRound({ level, paused, hintToken, undoToken, onStatus, onComplete }: GameProps) {
  const config = matchstickEquationsLevels[level] ?? matchstickEquationsLevels[0];
  const [board, setBoard] = useState(() => [...config.initial]), [history, setHistory] = useState<number[][]>([]), [selected, setSelected] = useState(0), [picked, setPicked] = useState<MatchSlot | null>(null), [hint, setHint] = useState<ReturnType<typeof matchstickHint> | null>(null);
  const seenHint = useRef(hintToken), seenUndo = useRef(undoToken), done = useRef(false);
  const equation = decodeMatchEquation(board), won = equation.trueEquation && history.length <= config.budget, locked = paused || won, spent = history.length >= config.budget;
  useEffect(() => { onStatus(`最多移动 ${config.budget} 根火柴。先选一个位置，再点亮段拿起，换位置点虚线段放下；等式成立就通关。`); }, []);
  useEffect(() => {
    if (seenHint.current === hintToken) return; seenHint.current = hintToken; if (locked) return;
    const next = matchstickHint(board, config.budget - history.length); setHint(next); setPicked(null); if(next.move) setSelected(next.move.from.token); onStatus(next.text);
  }, [hintToken, locked, board, config.budget, history.length, onStatus]);
  useEffect(() => {
    if (seenUndo.current === undoToken) return; seenUndo.current = undoToken; if (locked) return;
    setPicked(null); setHint(null);
    if (history.length) { setBoard(history[history.length-1]); setHistory(history.slice(0,-1)); onStatus("已撤销一次完整移动，火柴与次数都恢复。"); } else onStatus("还没有完整移动可以撤销。");
  }, [undoToken, locked, history, onStatus]);
  useEffect(() => { if (won && !paused && !done.current) { done.current = true; onStatus(`等式成立：${equation.text}。移动了 ${history.length} 根火柴！`); onComplete(); } }, [won, paused, equation.text, history.length, onStatus, onComplete]);
  function segmentClick(segment: number) {
    if (locked || spent) return; const slot = {token:selected,segment};
    if (board[selected] & (1<<segment)) {
      setPicked(picked?.token === selected && picked.segment === segment ? null : slot); return;
    }
    if (!picked) { onStatus("先点一条亮着的段拿起火柴，再放到虚线段上。"); return; }
    const next = moveMatch(board,{from:picked,to:slot}); if (!next) return;
    setBoard(next); setHistory([...history,board]); setPicked(null); setHint(null);
    const check=decodeMatchEquation(next); onStatus(check.trueEquation ? "等式已经成立！" : history.length+1>=config.budget ? "移动次数已用完，等式还不成立。可以撤销或重来。" : check.valid ? "这次移动已完成，等式还不成立。还有一次机会。" : "这次移动已完成；问号是临时的不完整图形，继续移动拼出数字。");
  }
  const hintSegment = hint?.move?.from.token === selected ? hint.move.from.segment : -1;
  return <div className="puzzle-layout mseq-game" data-matchstick-won={won} data-matchstick-board={board.join(",")} data-matchstick-moves={history.length}>
    <section className="mseq-workbench" aria-label="火柴等式工作台"><header className="mseq-heading"><span className="mini-label">火柴等式 · {config.title}</span><strong>{history.length} / {config.budget} 根</strong></header>
      <div className="mseq-equation" aria-label={`当前等式 ${equation.text}`}>
        {board.map((mask,i) => <div className="mseq-token-wrap" key={i}>{i===3 && <span className="mseq-equals" aria-label="固定等号">=</span>}<button className={`mseq-token ${selected===i ? "mseq-selected" : ""} ${picked?.token===i ? "mseq-picked-token" : ""}`} data-match-token={i} disabled={locked || spent} onClick={() => setSelected(i)} aria-pressed={selected===i} aria-label={`选择${tokenName(i,board.length)}位置`}><MatchGlyph mask={mask} operator={i===1} marked={picked?.token===i ? picked.segment : -1}/><span>{tokenName(i,board.length)}</span></button></div>)}
      </div>
      <div className="mseq-readout"><strong>{equation.text}</strong><span>{won ? "✓ 成立" : equation.valid ? "等待修正" : "含临时图形"}</span></div>
      <section className="mseq-editor" aria-label="选择火柴段"><div className="mseq-editor-title"><h4>{tokenName(selected,board.length)} · 点亮段拿起，点空段放下</h4><span>{picked ? `已拿起：${matchSlotName(picked)}` : "未拿起火柴"}</span></div>
        <div className="mseq-segments">{Array.from({length:selected===1?2:7},(_,segment) => { const lit=Boolean(board[selected] & (1<<segment)), isPicked=picked?.token===selected && picked.segment===segment; return <button key={`${selected}:${segment}`} data-match-segment={segment} data-lit={lit} className={`${lit?"mseq-segment-lit":""} ${isPicked?"mseq-held":""} ${hintSegment===segment?"mseq-hinted":""}`} disabled={locked || spent} onClick={()=>segmentClick(segment)} aria-label={`${tokenName(selected,board.length)}${selected===1?(segment===0?"横段":"竖段"):matchSegmentNames[segment]}，${isPicked?"已拿起，再点取消":lit?"有火柴，点此拿起":"空位，点此放下"}`} aria-pressed={isPicked}><MatchGlyph mask={board[selected]} operator={selected===1} marked={segment}/><span>{selected===1?(segment===0?"横段":"竖段"):matchSegmentNames[segment]}</span><small>{isPicked?"已拿起":lit?"拿起":"放下"}</small></button>; })}</div>
        <button className="mseq-cancel" disabled={locked || !picked} onClick={()=>setPicked(null)}>取消拿起</button>
      </section>
      <p className="mseq-feedback" role="status">{paused?"已暂停，火柴暂时锁定。":won?`拼对了！${equation.text}`:hint?.text??(spent?"次数已经用完，等式尚未成立。撤销或重来后继续。":picked?`现在选择目的位置，再点一个空段。${matchSlotName(picked)}仍在原处，放下时才真正移动。`:"每次把一根亮着的火柴，放到一个空段。可跨数字、跨符号，也可在同一个数字内移动。")}</p>
    </section>
    <aside className="game-notes mseq-notes"><span className="mini-label">数码管 · 守恒 · 移动推理</span><h3>答案藏在一根火柴里。</h3><p>{config.lesson}</p><ol><li>选等式上的位置卡片。</li><li>在下方选一条亮段，拿起火柴。</li><li>选目的位置，再点一条虚线段。完成一次移动。</li></ol><p>只有七段数码数字 0–9、加号或减号可以作为最终结果。移动时可以转向，等号固定；两位数不能以 0 开头。中途允许出现“?”，但最后必须是完整且正确的等式。</p><div className="mseq-rules">不添一根，不丢一根。<br/>拿起尚未改变棋盘；放下才消耗次数。<br/>合法的其他答案也会通关。</div><details><summary>七段数字长什么样？</summary><div className="mseq-reference">{[63,6,91,79,102,109,125,7,127,111].map((mask,i)=><div key={i}><MatchGlyph mask={mask}/><span>{i}</span></div>)}</div></details><p className="mseq-access">触屏轻点；键盘用 Tab、Enter / 空格。撤销恢复整次移动。提示从当前图形计算下一步。</p></aside>
  </div>;
}
