// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useRef,useState} from 'react';
import type {GameProps} from '../lib/types';
import {createFalling,startFalling,actFalling,cells,ghost,fallInterval,type FallingState,type Action} from '../vendor/falling/core';
import {loadFalling,saveFalling} from './fallingStorage';
import './fallingGarden.css';
const colors=['','#7b9c91','#738fb0','#dca76c','#d6bb6b','#9fb876','#ac91bc','#cd8c86'];
const controls:[Action,string,string][]=[['left','←','左移'],['rotate','↻','旋转'],['right','→','右移'],['down','↓','下移'],['drop','⇣','落到底']];
const actions:Record<string,Action>={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',ArrowDown:'down',' ':'drop',a:'left',d:'right',w:'rotate',s:'down'};
export default function FallingGarden({paused,freshStart=false,hintToken,onStatus}:GameProps){
 const [loaded]=useState(loadFalling);const [state,setState]=useState<FallingState>(()=>!freshStart&&loaded.state?loaded.state:createFalling(Math.floor(Math.random()*0x100000000)));
 const [best,setBest]=useState(Math.max(loaded.best,state.score)),[available,setAvailable]=useState(loaded.available),[localPause,setLocalPause]=useState(state.phase==='playing'),[hidden,setHidden]=useState(document.hidden);
 const live=useRef(state),board=useRef<HTMLDivElement>(null),status=useRef(onStatus);status.current=onStatus;
 const blocked=paused||localPause||hidden;
 function commit(s:FallingState){live.current=s;setState(s);}
 function action(a:Action){if(!blocked)commit(actFalling(live.current,a));}
 function begin(){if(paused||hidden)return;commit(startFalling(live.current));setLocalPause(false);board.current?.focus({preventScroll:true});}
 function restart(){commit(createFalling(Math.floor(Math.random()*0x100000000)));setLocalPause(false);board.current?.focus({preventScroll:true});}
 useEffect(()=>{const r=saveFalling(state,best);if(r.best!==best)setBest(r.best);setAvailable(r.available);},[state,best]);
 useEffect(()=>{const visibility=()=>{setHidden(document.hidden);if(document.hidden)setLocalPause(true);};const blur=()=>setLocalPause(true);document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',blur);return()=>{document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',blur);};},[]);
 useEffect(()=>{if(blocked||state.phase!=='playing')return;let frame=0,last:number|undefined,elapsed=0;const tick=(now:number)=>{if(last!==undefined){elapsed+=Math.max(0,Math.min(now-last,200));if(elapsed>=fallInterval(live.current.lines)){elapsed=0;commit(actFalling(live.current,'down'));}}last=now;frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[blocked,state.phase]);
 useEffect(()=>{if(hintToken)status.current('先观察空洞和下一块；虚线轮廓是落点。方向键移动/旋转，空格直接落到底。墙边转不动时先横移一格。');},[hintToken]);
 useEffect(()=>{if(state.phase==='lost')status.current(`花坛装满了，本局 ${state.score} 分、消除 ${state.lines} 行。可以再来一局。`);},[state.phase,state.score,state.lines]);
 const active=state.phase!=='lost'?cells(state.piece):[],landing=state.phase==='playing'?cells(ghost(state)):[];
 const tile=(x:number,y:number,c:number,key:string,extra='')=><span key={key} className={`falling-tile ${extra}`} style={{left:`${x*10}%`,top:`${y*5}%`,background:colors[c]}}/>;
 return <section className="falling-garden" data-falling-phase={state.phase} data-falling-score={state.score} data-falling-lines={state.lines} data-falling-placed={state.placed} data-falling-paused={blocked} data-falling-piece={JSON.stringify(state.piece)} data-falling-board={state.board.join(',')} data-falling-next={state.next} data-falling-best={best}>
  <div className="falling-intro"><span>FALLING GARDEN</span><h2>让每一行，整齐开花</h2><p>移动和旋转落块，填满一整行就能消除。</p></div>
  <div ref={board} className="falling-board" tabIndex={0} role="group" aria-label="落块花园棋盘，左右移动，上键旋转，下键下移，空格落到底" onKeyDown={e=>{if(e.target!==e.currentTarget||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='Escape'&&state.phase==='playing'){e.preventDefault();setLocalPause(true);return;}if(blocked||state.phase!=='playing')return;const a=actions[e.key];if(a){e.preventDefault();if(e.repeat&&(a==='drop'||a==='rotate'))return;action(a);}}}>
   <div className="falling-grid"/>
   {state.board.map((v,i)=>v?tile(i%10,Math.floor(i/10),v,`b${i}`):null)}
   {landing.map(([x,y],i)=>tile(x,y,state.piece.kind+1,`g${i}`,'falling-ghost'))}
   {active.map(([x,y],i)=>tile(x,y,state.piece.kind+1,`p${i}`,'falling-active'))}
   {(state.phase!=='playing'||blocked)&&<div className="falling-overlay"><strong>{state.phase==='lost'?'花坛装满了':state.phase==='ready'?'一块一块，慢慢来':'歇一会儿'}</strong><span>{state.phase==='lost'?`本局 ${state.score} 分 · ${state.lines} 行`:'填满横行，留出更多空间'}</span><button disabled={paused||hidden} onClick={state.phase==='lost'?restart:begin}>{state.phase==='lost'?'再来一局':state.phase==='ready'?'开始':'继续'}</button></div>}
  </div>
  <aside className="falling-sidebar"><div className="falling-stats"><div><small>本局分数</small><b>{state.score}</b></div><div><small>消除行数</small><b>{state.lines}</b></div><div><small>本机最高</small><b>{best}</b></div></div>
   <div className="falling-next"><small>下一块</small><svg viewBox="0 0 100 70" aria-label="下一落块预览">{cells({kind:state.next,rotation:0,x:0,y:0}).map(([x,y],i)=><rect key={i} x={x*20+10} y={y*20+4} width={18} height={18} rx={4} fill={colors[state.next+1]}/>)}</svg></div>
   <div className="falling-controls">{controls.map(([a,s,n])=><button key={a} className={`falling-${a}`} aria-label={n} disabled={blocked||state.phase!=='playing'} onClick={()=>action(a)}><span>{s}</span><small>{n}</small></button>)}</div>
   <button className="falling-pause" disabled={paused||hidden||state.phase!=='playing'} onClick={()=>blocked?begin():setLocalPause(true)}>{blocked?'继续落块':'暂停一下'}</button>
   <p className="falling-help">↑ 旋转 · ← → 移动<br/>↓ 下移 · 空格落到底</p>
  </aside>
  {!available&&<p className="falling-storage-warning">本次无法保存进度；仍可继续玩。</p>}
 </section>;
}
