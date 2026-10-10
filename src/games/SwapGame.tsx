// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import type {GameProps} from '../lib/types';
import {createSwapRuntime} from '../vendor/swapRuntime';
import {swapMaps} from '../vendor/swapMaps';
import {loadSwap,saveSwap,type SwapDirection,type SwapRuntime,type SwapSnapshot} from '../vendor/swapState';
import {swapTips,swapActorNames,swapActorMarks} from './swapText';
import './swap.css';
const directions:{id:SwapDirection;label:string;mark:string}[]=[{id:'up',label:'向上移动',mark:'↑'},{id:'left',label:'向左移动',mark:'←'},{id:'down',label:'向下移动',mark:'↓'},{id:'right',label:'向右移动',mark:'→'}];
const keys:Record<string,SwapDirection>={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',a:'left',s:'down',d:'right',k:'up',h:'left',j:'down',l:'right'};
export default function SwapGame(props:GameProps){return <SwapRound key={`${props.level}:${props.resetToken}`} {...props}/>;}
function SwapRound({level,paused,freshStart,hintToken,onComplete,onStatus}:GameProps){
 const index=Math.min(23,Math.max(0,level)),map=swapMaps[index];
 const canvas=useRef<HTMLCanvasElement>(null),ending=useRef<HTMLCanvasElement>(null),surface=useRef<HTMLDivElement>(null),engine=useRef<SwapRuntime|null>(null),callbacks=useRef({onComplete,onStatus}),notified=useRef(false),hint=useRef(hintToken),heldKeys=useRef(new Set<string>()),pointers=useRef(new Map<number,SwapDirection>()),lastSave=useRef(0);
 const [view,setView]=useState<SwapSnapshot|null>(null),[inactive,setInactive]=useState(false),[saved,setSaved]=useState(true),[message,setMessage]=useState('先观察每位伙伴的行动方式，再开始这一关。');
 const flags=useRef({paused,inactive});flags.current={paused,inactive};callbacks.current={onComplete,onStatus};
 const locked=paused||inactive||!view?.started||view.result!=='playing';
 function persist(){if(engine.current)setSaved(saveSwap(engine.current,index));}
 function publish(){const next=engine.current?.snapshot();if(next)setView(next);return next;}
 function cancel(){heldKeys.current.clear();pointers.current.clear();engine.current?.cancel();publish();}
 function syncInput(){const e=engine.current;if(!e)return;for(const d of directions)e.hold(d.id,[...heldKeys.current].some(k=>keys[k]===d.id)||[...pointers.current.values()].includes(d.id));}
 function start(){const runtime=engine.current;if(paused||!runtime||runtime.snapshot().result!=='playing')return;setInactive(false);flags.current.inactive=false;runtime.start();publish();setMessage(`正在控制${swapActorNames[runtime.snapshot().actors[0].type]}。${swapTips[index]}`);surface.current?.focus();}
 function swap(){if(locked)return;cancel();engine.current?.swap();const s=publish();if(s)setMessage(`已换到${swapActorNames[s.actors[0].type]}。离开的伙伴恢复自己的行动方式。`);persist();}
 function retry(){if(paused)return;cancel();engine.current?.retry();setInactive(false);notified.current=false;publish();persist();setMessage('角色、开关和门都已回到原作起点。按“开始行动”再试一次。');}
 function keyDown(e:KeyboardEvent){if(e.altKey||e.ctrlKey||e.metaKey)return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(keys[k]){e.preventDefault();if(locked)return;heldKeys.current.add(k);syncInput();}else if(k===' '){e.preventDefault();}else if(k==='r'&&!e.repeat){e.preventDefault();retry();}}
 function keyUp(e:KeyboardEvent){const k=e.key.length===1?e.key.toLowerCase():e.key;if(keys[k]){e.preventDefault();heldKeys.current.delete(k);syncInput();}else if(k===' '){e.preventDefault();if(!view?.started||inactive)start();else swap();}}
 function down(e:PointerEvent<HTMLButtonElement>,direction:SwapDirection){if(locked)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,direction);syncInput();}
 function up(e:PointerEvent<HTMLButtonElement>){if(pointers.current.delete(e.pointerId)){syncInput();publish();}}
 useEffect(()=>{
  if(!canvas.current)return;const e=createSwapRuntime(canvas.current,index);engine.current=e;const restored=!freshStart&&loadSwap(e,index);setView(e.snapshot());
  if(restored)setMessage(e.snapshot().result==='won'?'已恢复本关真正到达绿色目标的记录。':e.snapshot().result==='lost'?'上次有伙伴碰到了红色。重新尝试就能回到起点。':'已恢复角色与开关位置。按“开始行动”接着走。');
  else setMessage('先观察每位伙伴的行动方式，再开始这一关。');
  setSaved(saveSwap(e,index));
  const read=()=>({...e.snapshot(),paused:flags.current.paused||flags.current.inactive});Object.defineProperty(window,'__swapRead',{configurable:true,value:read});
  const pagehide=()=>{e.cancel();saveSwap(e,index);};window.addEventListener('pagehide',pagehide);
  return()=>{window.removeEventListener('pagehide',pagehide);saveSwap(e,index);e.dispose();engine.current=null;heldKeys.current.clear();pointers.current.clear();delete(window as unknown as Record<string,unknown>).__swapRead;};
 },[index,freshStart]);
 useEffect(()=>{callbacks.current.onStatus(message);},[message]);
 useEffect(()=>{if(paused){cancel();persist();}},[paused]);
 useEffect(()=>{const blur=()=>{flags.current.inactive=true;setInactive(true);cancel();persist();setMessage('离开窗口时已暂停。按“继续行动”后再移动。');},hide=()=>{if(document.hidden)blur();};window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hide);return()=>{window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hide);};},[]);
 useEffect(()=>{
  const e=engine.current;if(!e||paused||inactive||!view?.started||view.result!=='playing')return;
  const timer=window.setInterval(()=>{if(flags.current.paused||flags.current.inactive)return;e.step();const next=e.snapshot();setView(next);if(performance.now()-lastSave.current>600||next.result!=='playing'){lastSave.current=performance.now();setSaved(saveSwap(e,index));}if(next.result==='won'){e.cancel();setMessage(index===23?'第24关完成！两位伙伴走完最后一程，原作结尾已展开。':'有伙伴真正抵达绿色目标！可以前往下一关。');}else if(next.result==='lost'){e.cancel();setMessage('有伙伴碰到了红色，整队都要重来。观察未受控角色的路线，再试一次。');}},1000/30);
  return()=>window.clearInterval(timer);
 },[paused,inactive,view?.started,view?.result,index]);
 useEffect(()=>{if(view?.result==='won'&&!paused&&!notified.current){notified.current=true;callbacks.current.onComplete();}},[view?.result,paused]);
 useEffect(()=>{if(hint.current===hintToken)return;hint.current=hintToken;if(!paused)setMessage(swapTips[index]);},[hintToken,paused,index]);
 useEffect(()=>{if(index!==23||view?.result!=='won'||!ending.current)return;const e=createSwapRuntime(ending.current,24);return()=>e.dispose();},[index,view?.result]);
 const active=view?.actors[0],g=view?.gridSize??640/Math.max(map.sizeX,map.sizeY);
 return <section className="sw-game" data-sw-level={index} data-sw-result={view?.result??'loading'} data-sw-ticks={view?.ticks??0} data-sw-started={String(view?.started??false)}>
  <header className="sw-heading"><div><span>SWAP · 控制权接力</span><h3>换个伙伴，走出另一条路。</h3></div><b>{String(index+1).padStart(2,'0')}<small>/24</small></b></header>
  <p className="sw-intro">一位由你控制，其余各走各的。任意伙伴抵达绿色就过关；任意伙伴碰到红色就失败。</p>
  <div className="sw-stats"><span>本关失误 <b>{view?.deaths??0}</b></span><span>控制中 <b>{active?`${active.id+1}号 · ${swapActorNames[active.type]}`:'准备中'}</b></span><span>{paused||inactive?'已暂停':view?.result==='won'?'抵达目标 ✓':view?.result==='lost'?'需要重试':view?.started?'实时行动':'观察地图'}</span></div>
  <div ref={surface} tabIndex={0} onKeyDown={keyDown} onKeyUp={keyUp} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))cancel();}} className="sw-stage" role="group" aria-label="Swap 原作地图，方向键移动，空格切换伙伴" style={{aspectRatio:`${map.sizeX}/${map.sizeY}`}}>
   <canvas ref={canvas} width="640" height="640" aria-label={`原作第${index+1}关，${map.sizeX}列${map.sizeY}行。使用下方按钮操作。`}/>
   {view&&<svg className="sw-annotation" viewBox={`0 0 ${g*map.sizeX} ${g*map.sizeY}`} aria-hidden="true">
    {map.tiles.flatMap((row,y)=>row.map((tile,x)=>tile>=10?<text key={`${x},${y}`} x={(x+.5)*g} y={(y+.58)*g} fill="#675229" textAnchor="middle" fontSize={g*.28} fontWeight="700">{tile%10+1}</text>:null))}
    {view.actors.map((a,i)=><g key={a.id}><text x={a.x} y={a.y+g*.11} textAnchor="middle" fill={i===0?'#123553':'#34546b'} fontSize={g*.3} fontWeight="700">{swapActorMarks[a.type]}</text>{i===0&&<circle cx={a.x} cy={a.y} r={g/2-3} fill="none" stroke="#234e6e" strokeWidth="2"/>}</g>)}
   </svg>}
   {((!view?.started&&view?.result!=='won')||inactive&&view?.result==='playing'||view?.result==='lost')&&<div className="sw-overlay"><div><strong>{view?.result==='lost'?'伙伴碰到了红色':inactive?'回来后，接着行动':'先看看伙伴们在哪里'}</strong><p>{view?.result==='lost'?'每个人的安全都很重要。':inactive?'位置和速度停在原处，按下按钮才会继续。':'自动伙伴也会触发开关、目标和危险。'}</p>{view?.result==='lost'?<button disabled={paused} onClick={retry}>重新尝试</button>:<button disabled={paused||!view} onClick={start}>{inactive?'继续行动':'开始行动'}</button>}</div></div>}
  </div>
  <div className="sw-controls"><div className="sw-dpad" aria-label="按住方向移动">{directions.map(d=><button key={d.id} data-sw-direction={d.id} aria-label={d.label} disabled={locked} onPointerDown={e=>down(e,d.id)} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat&&!locked){e.preventDefault();heldKeys.current.add(`button-${d.id}`);engine.current?.hold(d.id,true);}}} onKeyUp={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();heldKeys.current.delete(`button-${d.id}`);engine.current?.hold(d.id,false);}}} onBlur={()=>{heldKeys.current.delete(`button-${d.id}`);engine.current?.hold(d.id,false);}}>{d.mark}</button>)}</div><div className="sw-actions"><button className="sw-swap" disabled={locked||(view?.actors.length??0)<2} onClick={swap}>⇄ 切换伙伴</button><button disabled={paused||!view} onClick={retry}>重置本关</button><small>按住移动 · 松手减速 · 空格换人</small></div></div>
  <div className="sw-legend"><span><i className="sw-green"/>目标</span><span><i className="sw-red"/>危险</span><span><i className="sw-yellow"/>开关</span><span><i className="sw-orange"/>同号门</span><span><i className="sw-blue"/>只挡控制者</span></div>
  <div className="sw-party" aria-label="伙伴行动方式">{view?.actors.map((a,i)=><div key={a.id} className={i===0?'sw-active':''}><b>{a.id+1}号 {swapActorMarks[a.type]}</b><span>{swapActorNames[a.type]}</span><small>{i===0?'你在控制':`第${Math.floor(a.y/g)+1}行 · 第${Math.floor(a.x/g)+1}列`}</small></div>)}</div>
  <p className={`sw-message ${view?.result==='won'?'sw-success':''}`} role="status">{paused?'已暂停，所有角色、开关与输入都停在这里。':message}</p>
  {view?.result==='won'&&index===23&&<article className="sw-ending"><h4>SWAP · 谢谢同行</h4><canvas ref={ending} width="640" height="640" aria-label="原作第25条记录：由灰色方块拼成 SWAP 的结尾画面"/><p>Swap, by Noah Moroze and Michael Yang. Thanks for playing!</p><p>24个原作谜题的最后一关已完成。这个没有目标格的感谢画面保留为结尾，不另算关卡。</p></article>}
  {!saved&&<p role="alert">浏览器暂时无法保存进度，这一局仍可继续。</p>}
  <details><summary>完整规则与原作说明</summary><p>静止伙伴不会自行移动；向右与向上伙伴一直朝一个方向走，碰墙停住；反弹伙伴遇墙折返；跟随伙伴复制控制者的速度；左转伙伴遇墙就向左转。切换伙伴按固定队列循环，离开的伙伴保留自己的行动方式。控制者的惯性会带到下一位身上。</p><p>任何伙伴碰到绿色都获胜，任何伙伴碰到红色都会让本次尝试失败。黄色压力开关对应同号橙门，站在开关上才开门；门内还有伙伴时会保持打开。蓝色格只阻挡当前受控角色，自动角色能穿过。原作的开关扫描顺序、碰撞尺寸与30帧运动节奏完整保留。</p><p>支持方向键、WASD、HJKL，以及屏幕上的长按方向按钮。空格换人，R重置。点棋盘可重新聚焦键盘。暂停、切到后台、窗口失焦都会取消持续输入；离开关卡会清理运行循环。本地续玩是本站新增功能，恢复后要手动开始。</p><p>完整保留24个原作谜题和第25条感谢场景；未启用原作中注释掉的实验地图。地图、规则、提示和画布图形来自Noah Moroze与Michael Yang的Swap，固定版本a3cfb7d2，CC-BY-SA-4.0。本站于2026年10月10日增加中文界面、触屏操作、暂停与经过结构校验的存档，新增适配代码为GPL-3.0-only。原录音、字体、图标包及旧网页脚本未使用，本版本没有音轨。<a href="./swap-LICENSE.txt" target="_blank" rel="noreferrer">原作完整许可证</a> · <a href="https://github.com/nmoroze/swap/tree/a3cfb7d2d59d37dd3778d5de685a206cca4f1206" target="_blank" rel="noreferrer">固定原作源码</a>。</p></details>
 </section>;
}
