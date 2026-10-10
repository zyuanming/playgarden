// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useRef,useState,type PointerEvent} from 'react';
import type {GameProps} from '../lib/types';
import {BEATRIX_LEVELS,createBeatrixEngine,type BeatrixSnapshot,type BeatrixInstrument} from '../vendor/beatrixCore';
import {createBeatrixAudio} from '../vendor/beatrixAudio';
import './beatrix.css';

const SAVE_KEY='playgarden.beatrix.arrangements.v1';
type Position={id:string;x:number;y:number};
const names:Record<BeatrixInstrument,string>={BD:'底鼓',SD:'军鼓',HH:'闭镲',HO:'开镲',BLO:'低邦戈',BME:'中邦戈',BHI:'高邦戈',TAM:'铃鼓',RIM:'边击',CLA:'响棒',COW:'牛铃',ME:'金属鼓',GUI:'刮瓜'};
const colors:Record<BeatrixInstrument,string>={BD:'#3c7374',SD:'#b36348',HH:'#5976a4',HO:'#90629c',BLO:'#a57637',BME:'#936e32',BHI:'#99833c',TAM:'#997b31',RIM:'#7a6095',CLA:'#687637',COW:'#8d604e',ME:'#727690',GUI:'#a45c68'};
const arrows={up:'↑',right:'→',down:'↓',left:'←'};
const arrangement=(s:BeatrixSnapshot):Position[]=>s.drums.filter(d=>!d.fixed).map(({id,x,y})=>({id,x,y}));
function storedPositions(id:string):unknown {try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')[id];}catch{return null;}}
function writePositions(id:string,positions:Position[]){try{let data:Record<string,unknown>={};try{const p=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');if(p&&typeof p==='object'&&!Array.isArray(p))data=p;}catch{}data[id]=positions;localStorage.setItem(SAVE_KEY,JSON.stringify(data));return true;}catch{return false;}}
function isPositions(value:unknown):value is Position[]{return Array.isArray(value)&&value.length<100&&value.every(p=>p&&typeof p.id==='string'&&Number.isInteger(p.x)&&Number.isInteger(p.y));}

export default function BeatrixGame(props:GameProps){return <BeatrixRound key={`${props.level}:${props.resetToken}`} {...props}/>;}
function BeatrixRound({level,paused,muted=false,freshStart,hintToken,undoToken,onStatus,onComplete}:GameProps){
 const puzzle=BEATRIX_LEVELS[level]??BEATRIX_LEVELS[0];
 const [engine]=useState(()=>{const e=createBeatrixEngine(puzzle);if(!freshStart){const p=storedPositions(puzzle.id);if(isPositions(p))e.setArrangement(p);}return e;});
 const [view,setView]=useState(()=>engine.snapshot()),[running,setRunning]=useState(false),[zoomed,setZoomed]=useState(false),[scoreOverflow,setScoreOverflow]=useState(false),[preview,setPreview]=useState<number|null>(null),[selected,setSelected]=useState(()=>engine.snapshot().drums.find(d=>!d.fixed)?.id??''),[row,setRow]=useState('1'),[col,setCol]=useState('1'),[message,setMessage]=useState('选择一个鼓，移到节拍经过的格子。按“开始演奏”，让每一拍与目标谱完全一致。'),[saved,setSaved]=useState(true);
 const state=useRef(view),callbacks=useRef({onStatus,onComplete}),history=useRef<Position[][]>([]),audio=useRef<ReturnType<typeof createBeatrixAudio>|null>(null),hint=useRef(hintToken),undo=useRef(undoToken),notified=useRef(false),drag=useRef<{pointer:number;id:string}|null>(null),svg=useRef<SVGSVGElement>(null),scoreRef=useRef<HTMLDivElement>(null),accumulator=useRef(0),previewElapsed=useRef(0),mounted=useRef(true),audioEpoch=useRef(0),opening=useRef(false),flags=useRef({paused,muted,running,preview});
 callbacks.current={onStatus,onComplete};flags.current={paused,muted,running,preview};state.current=view;
 const locked=paused||preview!==null||view.won;
 function publish(){const next=engine.snapshot();state.current=next;setView(next);return next;}
 function report(text:string){setMessage(text);}
 function sound(){if(!audio.current)audio.current=createBeatrixAudio();audio.current.setEnabled(!muted);return audio.current;}
 function persist(){setSaved(writePositions(puzzle.id,arrangement(engine.snapshot())));}
 function select(id:string){const d=state.current.drums.find(d=>d.id===id);if(!d)return;if(d.fixed){report('带外框的鼓是固定节拍源，不能移动；箭头表示节拍发出的方向。');return;}setSelected(id);setRow(String(d.y+1));setCol(String(d.x+1));}
 function move(id:string,x:number,y:number){if(locked)return;const before=arrangement(engine.snapshot());if(!engine.moveDrum(id,x,y)){report('请选择棋盘内的空格；固定节拍源和其他鼓的位置不能占用。');return;}history.current.push(before);if(history.current.length>100)history.current.shift();publish();setRow(String(y+1));setCol(String(x+1));persist();report(`已移到第 ${y+1} 行、第 ${x+1} 列。${running?'节拍继续前进，等一个完整周期来检验。':'开始演奏，听听这一段。'}`);}
 function apply(){const y=Number(row)-1,x=Number(col)-1;if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=32||y<0||y>=32){report('行和列都填写1到32之间的整数。');return;}move(selected,x,y);}
 function nudge(dx:number,dy:number){const d=state.current.drums.find(d=>d.id===selected);if(d)move(selected,d.x+dx,d.y+dy);}
 function undoMove(){if(locked)return;const p=history.current.pop();if(!p){report('还没有可以撤销的摆放。');return;}if(engine.setArrangement(p)){accumulator.current=0;publish();persist();report('已撤销上次摆放，节拍从第一拍重新演奏。');}}
 async function toggle(){if(paused||preview!==null||view.won||opening.current)return;if(!running){opening.current=true;const ticket=++audioEpoch.current;const audible=await sound().unlock();opening.current=false;if(!mounted.current||ticket!==audioEpoch.current||flags.current.paused)return;setRunning(true);report('节拍开始了。可以边听边调整，绿色表示这一拍完全匹配。'+(audible?'':'浏览器暂时无法播放声音，可继续看节拍谱操作。'));}else{setRunning(false);audio.current?.silence();report('演奏已停止，保留当前位置和节拍进度。');}}
 async function startPreview(){if(paused||preview!==null||opening.current)return;opening.current=true;const ticket=++audioEpoch.current,a=sound();const audible=await a.unlock();opening.current=false;if(!mounted.current||ticket!==audioEpoch.current||flags.current.paused)return;a.silence();previewElapsed.current=0;setPreview(0);a.play(puzzle.target[0]);report('正在试听目标谱，棋盘和摆放暂时冻结。试听结束后接着原来的位置演奏。'+(audible?'':'浏览器暂时无法播放声音，将显示每一拍。'));}
 function resetPlayback(){if(paused||preview!==null)return;engine.resetPlayback();accumulator.current=0;notified.current=false;publish();audio.current?.silence();report('摆放保持不变，所有节拍已回到第一拍。');}
 function point(event:PointerEvent<SVGSVGElement>){const b=event.currentTarget.getBoundingClientRect();return{x:Math.floor((event.clientX-b.left)*32/b.width),y:Math.floor((event.clientY-b.top)*32/b.height)};}
 function pointerDown(event:PointerEvent<SVGSVGElement>){if(locked||zoomed&&event.pointerType==='touch')return;const p=point(event),d=state.current.drums.find(d=>d.x===p.x&&d.y===p.y);if(d){select(d.id);if(!d.fixed){drag.current={pointer:event.pointerId,id:d.id};event.currentTarget.setPointerCapture(event.pointerId);}}else if(selected)move(selected,p.x,p.y);event.preventDefault();}
 function pointerMove(event:PointerEvent<SVGSVGElement>){if(!drag.current||drag.current.pointer!==event.pointerId||locked)return;const p=point(event),d=state.current.drums.find(d=>d.id===drag.current!.id);if(d&&(d.x!==p.x||d.y!==p.y))move(d.id,p.x,p.y);}
 useEffect(()=>{select(selected);if(freshStart)persist();},[]);
 useEffect(()=>{callbacks.current.onStatus(message);},[message]);
 useEffect(()=>{const element=scoreRef.current;if(!element)return;const measure=()=>setScoreOverflow(element.scrollWidth>element.clientWidth+1);measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();},[puzzle.id]);
 useEffect(()=>{audio.current?.setEnabled(!muted);},[muted]);
 useEffect(()=>{if(paused){audioEpoch.current++;opening.current=false;drag.current=null;audio.current?.silence();}},[paused]);
 useEffect(()=>{if(hint.current===hintToken)return;hint.current=hintToken;report('固定鼓在第1拍发出节拍。每走一格过一小拍；方向鼓会把遇到的第一束节拍转向。目标谱同一列的所有音色都要同时响，不能多也不能少。');},[hintToken]);
 useEffect(()=>{if(undo.current===undoToken)return;undo.current=undoToken;undoMove();},[undoToken]);
 useEffect(()=>{
  mounted.current=true;
  const read=()=>({...engine.snapshot(),running:flags.current.running,paused:flags.current.paused,preview:flags.current.preview,audio:audio.current?.snapshot()??{state:'not-created',voices:0,strikes:0,enabled:!flags.current.muted}});
  Object.defineProperty(window,'__beatrixRead',{configurable:true,value:read});
  const blur=()=>{audioEpoch.current++;opening.current=false;setRunning(false);setPreview(null);drag.current=null;audio.current?.silence();report('已暂停演奏。回来后按“开始演奏”继续。');};
  const hide=()=>{if(document.hidden)blur();};window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hide);
  return()=>{mounted.current=false;audioEpoch.current++;window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hide);audio.current?.dispose();delete(window as unknown as Record<string,unknown>).__beatrixRead;};
 },[engine]);
 useEffect(()=>{
  if(paused||(!running&&preview===null)||view.won&&preview===null)return;
  let cancelled=false,raf=0,last=performance.now();const ms=60000/puzzle.bpm/4;
  const tick=(now:number)=>{if(cancelled)return;const dt=Math.min(200,Math.max(0,now-last));last=now;
   if(preview!==null){previewElapsed.current+=dt;if(previewElapsed.current>=ms){previewElapsed.current-=ms;const next=preview+1;if(next>=puzzle.target.length){setPreview(null);report('目标谱试听结束。每一列就是同一小拍里必须响起的鼓。');}else{setPreview(next);audio.current?.play(puzzle.target[next]);}}}
   else{accumulator.current+=dt;while(accumulator.current>=ms){accumulator.current-=ms;const next=engine.advanceBeat();state.current=next;audio.current?.play(next.events);setView(next);if(next.won){setRunning(false);if(!notified.current){notified.current=true;report(level===11?'加演关完成！这一段完整节拍已准确奏响。':'整段节拍完全一致！可以前往下一关。');callbacks.current.onComplete();}break;}}}
   raf=requestAnimationFrame(tick);
  };raf=requestAnimationFrame(tick);return()=>{cancelled=true;cancelAnimationFrame(raf);};
 },[engine,paused,running,preview,puzzle.bpm,view.won]);
 const selectedDrum=view.drums.find(d=>d.id===selected),movable=view.drums.filter(d=>!d.fixed),column=preview??view.lastBeatIndex;
 return <section className="bt-game" data-bt-level={level} data-bt-won={String(view.won)} data-bt-ticks={view.ticks} data-bt-running={String(running)}>
  <header className="bt-heading"><div><span>BEATRIX · {puzzle.chapter}</span><h3>把鼓点，摆成一条小径。</h3></div><b>{String(level+1).padStart(2,'0')}<small>/12</small></b></header>
  <p className="bt-intro">移动鼓面，让节拍经过它。对照下面的谱，让每一拍里的音色都刚好相同。</p>
  <div className="bt-toolbar"><button onClick={toggle} disabled={paused||preview!==null||view.won}>{running?'停止演奏':'开始演奏'}</button><button onClick={startPreview} disabled={paused||preview!==null}>试听目标</button><button onClick={resetPlayback} disabled={paused||preview!==null}>从第一拍重播</button><span>{puzzle.bpm} BPM · {puzzle.target.length}小拍</span></div>
  <div ref={scoreRef} className="bt-score" aria-label="目标节拍谱"><h4>目标谱 <small>{preview!==null?'正在试听':view.won?'完整匹配 ✓':'每一列同时响起'}</small></h4><div className="bt-columns" style={{gridTemplateColumns:`repeat(${view.target.length},minmax(25px,1fr))`}}>{view.target.map((instruments,i)=><div key={i} className={`bt-column ${column===i?'bt-now':''} ${view.checks[i]===true?'bt-match':view.checks[i]===false?'bt-miss':''}`} data-bt-column={i}><small>{i+1}</small><div>{instruments.length?instruments.map((instrument,j)=><span key={j} title={names[instrument]} style={{background:colors[instrument]}}>{instrument}</span>):<em>·</em>}</div><b aria-label={view.checks[i]===true?'匹配':view.checks[i]===false?'未匹配':'待演奏'}>{view.checks[i]===true?'✓':view.checks[i]===false?'×':'·'}</b></div>)}</div></div>{scoreOverflow&&<p className="bt-score-cue">↔ 左右滑动查看全部 {view.target.length} 拍</p>}
  <div className="bt-layout"><div className="bt-board-wrap"><div className="bt-board-label"><span>32 × 32 节拍棋盘</span><span>选中：{selectedDrum?`${names[selectedDrum.instrument]} · ${selectedDrum.y+1}行 ${selectedDrum.x+1}列`:'请选鼓'}</span><button className="bt-zoom" onClick={()=>setZoomed(z=>!z)}>{zoomed?'查看全盘':'放大棋盘'}</button></div><div className={`bt-map-scroll ${zoomed?'bt-zoomed':''}`}><svg ref={svg} className="bt-board" viewBox="0 0 640 640" role="img" aria-label="节拍路线棋盘，使用下方鼓列表和行列按钮也能完整摆放" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}>
   <defs><pattern id={`bt-grid-${level}`} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#d8e5de" strokeWidth="1"/></pattern></defs><rect width="640" height="640" fill="#f8fbf7"/><rect width="640" height="640" fill={`url(#bt-grid-${level})`}/>
   {view.beats.map(b=><circle key={b.id} cx={b.x*20+10} cy={b.y*20+10} r="5" fill="#dba83c" stroke="#79531c" strokeWidth="1.5"/>)}
   {view.drums.map(d=><g key={d.id} data-bt-drum={d.id} data-bt-x={d.x} data-bt-y={d.y} transform={`translate(${d.x*20},${d.y*20})`}><title>{names[d.instrument]}，{d.y+1}行{d.x+1}列{d.fixed?'，固定节拍源':''}</title><rect x="1" y="1" width="18" height="18" rx="4" fill={colors[d.instrument]} stroke={d.id===selected?'#e4a122':d.fixed?'#233b3e':'#fff'} strokeWidth={d.id===selected?3:d.fixed?2.5:1}/><text x="10" y="13" textAnchor="middle" fill="white" fontSize="8" fontWeight="700">{d.instrument}</text>{d.direction&&<text x="10" y="-2" textAnchor="middle" fill="#354f53" fontSize="14" fontWeight="bold">{arrows[d.direction]}</text>}{d.fixed&&d.emitterDirections.map((dir,i)=><text key={i} x={dir==='right'?24:dir==='left'?-4:10} y={dir==='down'?29:dir==='up'?-4:14} textAnchor="middle" fill="#354f53" fontSize="14" fontWeight="bold">{arrows[dir]}</text>)}{d.hit&&<rect x="-2" y="-2" width="24" height="24" rx="7" stroke="#e5ad42" fill="none" strokeWidth="2"/>}</g>)}
  </svg></div><p className="bt-legend">粗边框是固定节拍源，金色小点是移动节拍；鼓旁的箭头会改变节拍方向。棋盘可点选或拖动；触屏放大后滑动查看，使用下方行列继续摆放。</p></div>
  <aside className="bt-arrange"><h4>选择要移动的鼓</h4><div className="bt-inventory">{movable.map((d,i)=><button key={d.id} data-bt-select={d.id} aria-pressed={selected===d.id} disabled={locked} onClick={()=>select(d.id)}><span style={{background:colors[d.instrument]}}>{d.instrument}</span><b>{names[d.instrument]} {i+1}</b><small>{d.y+1}行 {d.x+1}列 {d.direction?arrows[d.direction]:''}</small></button>)}</div><div className="bt-position"><label>行<input aria-label="摆放行" type="number" min="1" max="32" value={row} disabled={locked} onChange={e=>setRow(e.target.value)}/></label><label>列<input aria-label="摆放列" type="number" min="1" max="32" value={col} disabled={locked} onChange={e=>setCol(e.target.value)}/></label><button disabled={locked||!selected} onClick={apply}>移到这里</button></div><div className="bt-pad">{[{x:0,y:-1,label:'鼓向上',icon:'↑'},{x:-1,y:0,label:'鼓向左',icon:'←'},{x:0,y:1,label:'鼓向下',icon:'↓'},{x:1,y:0,label:'鼓向右',icon:'→'}].map(d=><button key={d.label} aria-label={d.label} disabled={locked||!selected} onClick={()=>nudge(d.x,d.y)}>{d.icon}</button>)}</div><p>行、列从1数到32。可边演奏边摆放，错拍后会继续下一周期；方向不会随移动而改变。</p></aside></div>
  <p className={`bt-message ${view.won?'bt-success':''}`} role="status">{paused?'已暂停，节拍、输入和声音都停在这里。':message}</p>{!saved&&<p role="alert">浏览器暂时无法保存摆放，当前关仍可继续。</p>}
  <details><summary>玩法、声音与原作说明</summary><p>完整保留Beatrix的12道谜题（基础2关、双声部5关、折返4关、加演1关），不把标题和过场画面计作关卡。固定鼓按原周期发出一束或多束节拍；现有节拍先走一格，新节拍再从源头出现。当鼓与节拍相遇，它会响一次；方向鼓只改变遇到的第一束节拍。</p><p>目标谱同一列是同时发出的全部音色，包括重复音色和静拍。比较从第一列开始，必须连续完成一个精确周期。一次失败不会清空路上的节拍，折返节拍也可能在后续周期加入。试听目标时，棋盘与编辑冻结，结束后恢复；从第一拍重播会保留摆放并重新发出节拍。撤销会恢复上一摆放并重新演奏。</p><p>地图、节拍目标和规则来自Cong的Beatrix（MIT，固定059b74a）。原样本音效、图片与旧Phaser未使用。本站的音色由WebAudio现场合成，遵循顶部声音开关，中文界面与矢量图为GPL-3.0-only。摆放仅保存在当前浏览器，重新进入需再按开始演奏；离开会停止声音和动画。<a href="./beatrix-LICENSE.txt" target="_blank" rel="noreferrer">完整许可证</a>。</p></details>
 </section>;
}
