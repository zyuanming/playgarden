// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { crosswordCells,crosswordGardenLevels,crosswordHint,crosswordInspection } from "./crosswordGardenLogic";
import "./crosswordGarden.css";
export default function CrosswordGarden(props:GameProps){return <Round key={`${props.level}:${props.resetToken}`} {...props}/>;}
function Round({level,paused,hintToken,undoToken,onStatus,onComplete}:GameProps){
 const config=crosswordGardenLevels[level]??crosswordGardenLevels[0];
 const [placed,setPlaced]=useState<(string|null)[]>(()=>config.entries.map(()=>null)),[selected,setSelected]=useState(0),[history,setHistory]=useState<(string|null)[][]>([]),[hint,setHint]=useState<ReturnType<typeof crosswordHint>>(null),[message,setMessage]=useState("选一条线索，再从词篮里挑单词。");
 const seenHint=useRef(hintToken),seenUndo=useRef(undoToken),done=useRef(false);
 const check=crosswordInspection(config,placed),locked=paused||check.won;
 const rows=Math.max(...Object.values(check.cells).map(c=>c.row))+1,cols=Math.max(...Object.values(check.cells).map(c=>c.col))+1;
 const selectedCells=new Set(crosswordCells(config.entries[selected]).map(p=>`${p.row},${p.col}`));
 useEffect(()=>{onStatus("读中文线索，将词篮中的英文单词填入交叉词格。每个词只用一次，共享格里的字母必须相同。");},[]);
 useEffect(()=>{if(seenHint.current===hintToken)return;seenHint.current=hintToken;if(locked)return;const h=crosswordHint(config,placed);setHint(h);if(h){setSelected(h.index);setMessage(h.text);onStatus(h.text);}},[hintToken,locked,config,placed,onStatus]);
 useEffect(()=>{if(seenUndo.current===undoToken)return;seenUndo.current=undoToken;if(locked)return;if(history.length){setPlaced(history.at(-1)!);setHistory(history.slice(0,-1));setHint(null);setMessage("已撤销上一次填词或取下。");}else onStatus("还没有填词可以撤销。");},[undoToken,locked,history,onStatus]);
 useEffect(()=>{if(check.won&&!paused&&!done.current){done.current=true;onStatus("所有线索与交叉字母都匹配了！");onComplete();}},[check.won,paused,onStatus,onComplete]);
 function place(word:string|null){if(locked||placed[selected]===word||word&&(placed.includes(word)||word.length!==config.entries[selected].word.length))return;setHistory([...history,placed]);setPlaced(placed.map((old,i)=>i===selected?word:old));setHint(null);setMessage(word?`已填入 ${word}。查看交叉格，并对照第 ${selected+1} 条线索。`:"已取下单词，可以重新选择。");}
 return <div className="puzzle-layout cw-game" data-cw-won={check.won} data-cw-state={JSON.stringify(placed)} data-cw-moves={history.length}>
  <section className="cw-workbench" aria-label="交叉词园棋盘"><header><span className="mini-label">交叉词园 · {config.title}</span><strong>{placed.filter(Boolean).length}/{placed.length} 已填</strong></header>
   <div className="cw-board" style={{gridTemplateColumns:`repeat(${cols},1fr)`}} aria-label="共享字母棋盘">{Array.from({length:rows*cols},(_,i)=>{const key=`${Math.floor(i/cols)},${i%cols}`,cell=check.cells[key];if(!cell)return <div key={key} className="cw-space"/>;const conflict=new Set(cell.letters).size>1,starts=cell.entries.filter(n=>config.entries[n].row===cell.row&&config.entries[n].col===cell.col);return <div key={key} className={`cw-cell ${selectedCells.has(key)?"cw-selected":""} ${conflict?"cw-conflict":""}`} aria-label={`第 ${cell.row+1} 行第 ${cell.col+1} 列，${conflict?"字母冲突 ":""}${cell.letters.join("、")||"空格"}`}><small>{starts.map(n=>n+1).join("/")}</small><b>{conflict?"!":cell.letters[0]??""}</b></div>;})}</div>
   <div className="cw-summary"><span>交叉冲突 {check.conflicts}</span><span>{history.length} 次调整</span></div>
   <div className="cw-clues" aria-label="选择线索">{config.entries.map((e,i)=><button key={i} data-cw-entry={i} className={`${selected===i?"cw-active":""} ${hint?.index===i?"cw-hinted":""}`} aria-pressed={selected===i} disabled={locked} onClick={()=>{setSelected(i);setHint(null);}}><b>{i+1} {e.direction==="across"?"→":"↓"}</b><span>{e.clue}<small>{e.word.length} 格 · {placed[i]??"未填"}</small></span></button>)}</div>
   <div className="cw-bank" aria-label="英文词篮">{[...config.entries].map(e=>e.word).sort().map(word=><button key={word} data-cw-word={word} disabled={locked||placed.includes(word)||word.length!==config.entries[selected].word.length} onClick={()=>place(word)}>{word}</button>)}<button data-cw-remove disabled={locked||!placed[selected]} onClick={()=>place(null)}>取下当前词</button></div>
   <p role="status" className="cw-feedback">{paused?"已暂停，词格已锁定。":check.won?"每个词都找到了位置，交叉处也完全吻合。":message}</p>
  </section><aside className="game-notes"><span className="mini-label">词义 · 交叉约束</span><h3>一个字母，连接两条线索。</h3><p>{config.lesson}</p><ol><li>点选带编号的中文线索，棋盘会标亮对应的一行或一列。</li><li>选词篮中的英文单词。词的长度必须与格数吻合，长度不同的词暂时不可选。</li><li>红色叹号表示交叉字母不同。取下错误的词，再用线索和交叉字母检查。</li></ol><p>每个词只用一次。所有中文词义正确且共享字母一致才会通关。不会自动判定单个词的词义，留给你来推理。</p><p>触屏轻点；键盘 Tab 选按钮，Enter 或空格确认。提示只解释当前的一条线索，撤销可恢复填词。</p></aside>
 </div>;
}
