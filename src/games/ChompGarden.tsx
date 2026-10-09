// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {GameProps} from '../lib/types';
import {chompGardenLevels,chompBest,chompBite,chompPoison,chompWinning,type ChompMove} from './chompGardenLogic';
import './chompGarden.css';
type Position={shape:number[];result:'playing'|'won'|'lost';turns:number;last:ChompMove|null};
export default function ChompGarden(props:GameProps){return <ChompRound key={`${props.level}:${props.resetToken}`} {...props}/>;}
function ChompRound({level,paused,hintToken,undoToken,onComplete,onStatus}:GameProps){
 const lesson=chompGardenLevels[level]??chompGardenLevels[0];
 const [history,setHistory]=useState<Position[]>([{shape:lesson.shape,result:'playing',turns:0,last:null}]);const p=history[history.length-1];
 const [hint,setHint]=useState<ChompMove|null>(null),[hover,setHover]=useState<ChompMove|null>(null),[message,setMessage]=useState(lesson.tip);
 const state=useRef({history,p,paused});state.current={history,p,paused};const tokens=useRef({hintToken,undoToken}),done=useRef(false),buttons=useRef<(HTMLButtonElement|null)[]>([]);
 const callbacks=useRef({onComplete,onStatus});callbacks.current={onComplete,onStatus};
 const report=(text:string)=>{setMessage(text);callbacks.current.onStatus(text);};
 useEffect(()=>{callbacks.current.onStatus(lesson.tip);},[]);
 useEffect(()=>{if(p.result==='won'&&!done.current&&!paused){done.current=true;callbacks.current.onComplete();}},[p.result,paused]);
 useEffect(()=>{if(tokens.current.hintToken===hintToken)return;tokens.current.hintToken=hintToken;if(paused||p.result!=='playing')return;const move=chompBest(p.shape);setHint(move);report(move?`${chompWinning(p.shape)?'精确分析找到制胜一口':'这一形状没有必胜一口，可撤销重新考虑'}：第 ${move.row+1} 行，第 ${move.col+1} 列。提示没有替你落子。`:'只剩苦杏仁。这一手无法避免失败，可以撤销。');},[hintToken]);
 useEffect(()=>{if(tokens.current.undoToken===undoToken)return;tokens.current.undoToken=undoToken;if(paused||done.current)return;if(history.length>1){setHistory(history.slice(0,-1));setHint(null);setHover(null);report('已撤销你的一口和电脑的回合。');}},[undoToken]);
 function bite(move:ChompMove){const now=state.current;if(now.paused||now.p.result!=='playing'||move.col>=now.p.shape[move.row])return;let next:Position={shape:chompBite(now.p.shape,move),result:'playing',turns:now.p.turns+1,last:null};let text='';if(chompPoison(now.p.shape,move)){next.result='lost';text='你拿到了苦杏仁。这盘输了，可以撤销一回合再想想。';}else{const ai=chompBest(next.shape);if(!ai){next.result='won';text='电脑只剩苦杏仁可拿，你赢了这一盘！';}else{next.shape=chompBite(next.shape,ai);next.last=ai;text=`电脑拿走第 ${ai.row+1} 行、第 ${ai.col+1} 列右上方的饼干。轮到你了。`;}}const h=[...now.history,next];state.current={history:h,p:next,paused};setHistory(h);setHint(null);setHover(null);report(text);}
 const width=Math.max(...lesson.shape),locked=paused||p.result!=='playing',preview=hover??hint;
 return <div className="chomp-garden" data-chomp-shape={p.shape.join(',')} data-chomp-result={p.result} data-chomp-turns={p.turns}>
  <section className="chomp-main"><header><div><span className="chomp-eyebrow">CHOMP · 下午茶博弈</span><h3>{lesson.title}</h3></div><b>{level+1} / {chompGardenLevels.length}</b></header><p>你与电脑轮流拿饼干。点一块，会拿走它和它右上方的所有饼干。<strong>拿到左下角苦杏仁的人输。</strong></p>
  <div className="chomp-score"><span>你先拿 · 电脑精确回击</span><b>{paused?'已暂停':p.result==='won'?'茶会胜利':p.result==='lost'?'苦杏仁出现了':`第 ${p.turns+1} 轮`}</b></div>
  <div className="chomp-tray" style={{'--chomp-cols':width} as CSSProperties} aria-label="饼干棋盘">{lesson.shape.flatMap((n,row)=>Array.from({length:width},(_,col)=>{const exists=col<p.shape[row],poison=row===lesson.shape.length-1&&col===0;return <button key={`${row}:${col}`} ref={el=>{buttons.current[row*width+col]=el;}} type="button" data-row={row} data-col={col} className={`chomp-cookie ${exists?'':'eaten'} ${poison?'poison':''} ${preview&&exists&&row<=preview.row&&col>=preview.col?'bite-preview':''} ${hint?.row===row&&hint.col===col?'hinted':''}`} disabled={locked||!exists} aria-label={`${row+1}行${col+1}列，${exists?poison?'苦杏仁，拿取会输':'饼干':'已拿走'}`} onClick={()=>bite({row,col})} onMouseEnter={()=>!locked&&exists&&setHover({row,col})} onMouseLeave={()=>setHover(null)} onFocus={()=>!locked&&exists&&setHover({row,col})} onBlur={()=>setHover(null)} onKeyDown={e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const delta=({ArrowUp:-width,ArrowDown:width,ArrowLeft:-1,ArrowRight:1} as Record<string,number>)[e.key];if(!delta)return;e.preventDefault();let next=row*width+col+delta;while(next>=0&&next<width*lesson.shape.length){if(buttons.current[next]&&!buttons.current[next]!.disabled){buttons.current[next]?.focus();break;}next+=delta;}}}><span aria-hidden="true">{exists?poison?'✦':'∴':''}</span>{exists&&<small>{row+1},{col+1}</small>}</button>;}))}</div>
  <p className="chomp-message" role="status">{message}</p>{p.result==='won'&&<div className="chomp-victory">☕ 这盘茶点，由你收尾</div>}</section>
  <aside className="chomp-notes"><span className="chomp-eyebrow">想一口，再拿一口</span><h3>少拿，有时更聪明</h3><ol><li>选中的饼干，以及它右上方矩形中的饼干，一起消失。</li><li>左下角带星星的是苦杏仁。它始终留到有人不得不拿。</li><li>电脑会完整分析这张小棋盘，有必胜走法时绝不放过。</li></ol><p>{lesson.tip}</p><details><summary>操作与提示</summary><p>点击或用 Tab、方向键选择饼干，Enter / 空格拿取。虚线区域预览这一口。提示针对当前剩余形状，只标记建议。撤销回退完整一轮；胜利后棋盘锁定。暂停时所有饼干停止响应。</p></details></aside>
 </div>;
}
