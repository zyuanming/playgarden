// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useRef,useState,type CSSProperties,type KeyboardEvent} from 'react';
import type {GameProps} from '../lib/types';
import {hexahedralLevels} from './hexahedralLevels';
import {freshHexahedral,loadHexahedral,saveHexahedral,stepHexahedral,adjacentHexahedral,type HexahedralRound} from '../vendor/hexahedralCore';
import './hexahedral.css';
export default function HexahedralGame(props:GameProps){return <HexahedralRoundView key={`${props.level}:${props.resetToken}`} {...props}/>;}
function HexahedralRoundView({level,paused,freshStart,hintToken,onComplete,onStatus}:GameProps){
 const puzzle=hexahedralLevels[level]||hexahedralLevels[0],n=puzzle.rows.length;
 const [round,setRound]=useState(()=>freshStart?freshHexahedral(puzzle):loadHexahedral(puzzle)),[message,setMessage]=useState(()=>round.result==='won'?`第${level+1}关完成！这一关的所有方块都已压下。`:round.result==='lost'?'步数用完了，还有升起的方块。点“重新尝试”回到原起点。':round.history.length?`已恢复本关进度：走了 ${round.history.length} 步，还可走 ${puzzle.maxMoves-round.history.length} 步。`:'从白色棋子出发，每次走到相邻方块，落脚方块就会升降翻转。'),[saved,setSaved]=useState(true);
 const state=useRef(round),callbacks=useRef({onComplete,onStatus}),notified=useRef(false),hint=useRef(hintToken);callbacks.current={onComplete,onStatus};
 const locked=paused||round.result!=='playing',remaining=[...round.tiles].filter(c=>c==='0').length;
 function report(text:string){setMessage(text);}
 function arrive(to:number){if(paused||state.current.result!=='playing')return;const next=stepHexahedral(puzzle,state.current,to);if(next===state.current){report('只能走到上下左右相邻的完整方块，不能斜走、跳格或走入缺口。');return;}state.current=next;setRound(next);if(next.result==='lost')report('步数用完了，还有升起的方块。点“重新尝试”回到原起点。');else if(next.result==='won')report(level===29?'第30关完成！这一关的所有方块都已压下。':'所有方块都已压下！可以前往下一关。');else report(`走了 ${next.history.length} 步，还可走 ${puzzle.maxMoves-next.history.length} 步。再次走进同一方块会把它重新升起。`);}
 function move(dr:number,dc:number){const row=Math.floor(state.current.cursor/n)+dr,col=state.current.cursor%n+dc;if(row<0||row>=n||col<0||col>=n){if(!locked)report('这里是边缘，请换一个方向。');return;}arrive(row*n+col);}
 function key(event:KeyboardEvent){const directions:Record<string,[number,number]>={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};const d=directions[event.key];if(!d)return;event.preventDefault();if(!event.repeat&&!event.altKey&&!event.ctrlKey&&!event.metaKey)move(...d);}
 function restart(){if(paused)return;const next=freshHexahedral(puzzle);state.current=next;setRound(next);notified.current=false;report('已回到原作起点，步数与所有方块一并恢复。');}
 // Synchronize this puzzle's fresh/restored feedback when a new level mounts.
 useEffect(()=>{callbacks.current.onStatus(message);},[message]);
 useEffect(()=>{setSaved(saveHexahedral(puzzle,round));},[puzzle,round]);
 useEffect(()=>{if(round.result==='won'&&!paused&&!notified.current){notified.current=true;callbacks.current.onComplete();}},[round.result,paused]);
 useEffect(()=>{if(hint.current===hintToken)return;hint.current=hintToken;if(paused)return;report(`还剩 ${remaining} 个升起方块、${puzzle.maxMoves-round.history.length} 步。每个升起方块还需被踩奇数次，每个压下方块需被踩偶数次；先规划回头的位置。`);},[hintToken,paused,remaining,puzzle.maxMoves,round.history.length]);
 return <section className="hd-game" data-hd-level={level} data-hd-cursor={round.cursor} data-hd-moves={round.history.length} data-hd-tiles={round.tiles} data-hd-result={round.result}>
  <header className="hd-heading"><div><span>HEXA HEDRAL · {puzzle.chapter}</span><h3>把每一步，踩得刚刚好。</h3></div><b>{String(level+1).padStart(2,'0')}<small>/ 30</small></b></header>
  <p>沿着方块连续走，让所有粉色凸起变成蓝色平面。回头再踩，蓝色又会升起。</p>
  <div className="hd-stats"><span>步数 <b>{round.history.length} / {puzzle.maxMoves}</b></span><span>还需压下 <b>{remaining}</b></span><span>{paused?'已暂停':round.result==='won'?'全部压下 ✓':round.result==='lost'?'步数已用完':'原作步数限制'}</span></div>
  <div className="hd-stage"><div className="hd-board" style={{'--hd-size':n}as CSSProperties} onKeyDown={key} tabIndex={0} role="group" aria-label={`${n}乘${n}方块棋盘，方向键移动`}>
   {[...round.tiles].map((tile,i)=>{const current=i===round.cursor,near=adjacentHexahedral(puzzle,round.cursor,i)&&tile!=='x';return <button key={i} type="button" data-hd-cell={i} className={`hd-cell ${tile==='x'?'hd-gap':tile==='0'?'hd-raised':'hd-pressed'} ${current?'hd-current':''} ${near?'hd-near':''}`} disabled={locked||tile==='x'} aria-label={`第${Math.floor(i/n)+1}行第${i%n+1}列，${tile==='x'?'缺口':tile==='0'?'升起':'压下'}${current?'，当前位置':near?'，可走入':''}`} aria-current={current?'location':undefined} onClick={()=>arrive(i)}><span className="hd-top">{current?<span className="hd-player" aria-hidden="true">◇</span>:tile==='x'?<span aria-hidden="true">×</span>:<span aria-hidden="true">{tile==='0'?'↑':'−'}</span>}</span></button>;})}
  </div></div>
  <div className="hd-legend"><span>粉色 ↑ 升起</span><span>蓝色 − 压下</span><span>白色 ◇ 当前位置</span></div>
  <div className="hd-dpad" aria-label="移动方向">{[{dr:-1,dc:0,label:'向上',symbol:'↑'},{dr:0,dc:-1,label:'向左',symbol:'←'},{dr:1,dc:0,label:'向下',symbol:'↓'},{dr:0,dc:1,label:'向右',symbol:'→'}].map(d=><button key={d.label} disabled={locked} aria-label={d.label} onClick={()=>move(d.dr,d.dc)}>{d.symbol}</button>)}</div>
  <p className={`hd-message ${round.result==='won'?'hd-success':''}`} role="status">{message}</p>
  {round.result==='lost'&&<button className="hd-retry" disabled={paused} onClick={restart}>重新尝试</button>}
  {!saved&&<p role="alert">本次浏览器无法保存进度，离开前请留意。</p>}
  <details><summary>玩法、原关卡与来源</summary><p>30个原作关卡分为初阶、进阶、高阶，每组10关。地图、起点、缺口和步数上限都保持原样。起点不会自动翻转；个别关卡从缺口上出发，离开后不能再进入该缺口。</p><p>每次只能水平或竖直移动一格。落脚处立即在升起和压下之间翻转。所有方块压下即获胜，最后一步刚好达成也算成功；步数耗尽仍有凸起则失败。没有计时压力。</p><p>点相邻方块、点方向按钮，或聚焦棋盘后按方向键。暂停期间不能移动。本站保留原关卡与规则，改为可看清落点的俯视方块，并用明确的下一关按钮替代自动跳转。</p><p>改编自 Matthew Miner 的 Hexahedral（MIT，固定 a2641001）。原第三方音效未使用。<a href="./hexahedral-LICENSE.txt" target="_blank" rel="noreferrer">完整许可证</a>。</p></details>
 </section>;
}
