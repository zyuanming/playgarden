// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useRef,useState,type PointerEvent,type KeyboardEvent} from 'react';
import type {GameProps} from '../lib/types';
import {mountZop,type ZopEngine,type ZopSnapshot} from '../vendor/zopRuntime';
import './zop.css';
const BEST_KEY='playgarden.zop.best.v1';
function readBest(){try{const n=Number(localStorage.getItem(BEST_KEY));return {value:Number.isSafeInteger(n)&&n>=0?n:0,stored:true};}catch{return {value:0,stored:false};}}
export default function ZopGame(props:GameProps){return <ZopRound key={props.resetToken} {...props}/>;}
function ZopRound({paused,hintToken,onStatus}:GameProps){
 const initial=useRef(readBest()),bestRef=useRef(initial.current.value),canvas=useRef<HTMLCanvasElement>(null),root=useRef<HTMLElement>(null),engine=useRef<ZopEngine|null>(null),clock=useRef(performance.now()),flags=useRef({paused,away:false}),status=useRef(onStatus),hint=useRef(hintToken),cursor=useRef({r:0,c:0}),held=useRef<number|null>(null);
 const [view,setView]=useState<ZopSnapshot|null>(null),[best,setBest]=useState(bestRef.current),[stored,setStored]=useState(initial.current.stored),[away,setAway]=useState(false);
 status.current=onStatus;flags.current.paused=paused;const blocked=paused||away;
 function publish(){if(engine.current)setView(engine.current.snapshot());}
 function cancel(){held.current=null;engine.current?.cancel();publish();}
 function start(){if(blocked)return;clock.current=performance.now();cancel();cursor.current={r:0,c:0};engine.current?.start();publish();root.current?.focus({preventScroll:true});}
 function point(e:PointerEvent<HTMLCanvasElement>){const r=e.currentTarget.getBoundingClientRect();return {x:(e.clientX-r.left)*420/r.width,y:(e.clientY-r.top)*540/r.height};}
 function down(e:PointerEvent<HTMLCanvasElement>){if(blocked||view?.phase!=='playing'||held.current!==null)return;e.preventDefault();root.current?.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);held.current=e.pointerId;const p=point(e);engine.current?.down(p.x,p.y);publish();}
 function up(e:PointerEvent<HTMLCanvasElement>){if(held.current!==e.pointerId)return;e.preventDefault();held.current=null;if(!blocked)engine.current?.up();else engine.current?.cancel();publish();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}
 function keyboard(e:KeyboardEvent<HTMLElement>){if(e.target instanceof HTMLElement&&e.target.closest('button,summary,a'))return;if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Enter','Escape'].includes(e.key))return;e.preventDefault();if(blocked||view?.phase!=='playing')return;
  if(e.key==='Escape'){cancel();return;}if(e.key.startsWith('Arrow')){cursor.current={r:Math.max(0,Math.min(5,cursor.current.r+(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0))),c:Math.max(0,Math.min(5,cursor.current.c+(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)))};const s=engine.current!.snapshot(),d=s.dots.find(x=>x.r===cursor.current.r&&x.c===cursor.current.c);if(d&&s.selecting)engine.current!.move(d.x,d.y);}else if(!e.repeat){const s=engine.current!.snapshot(),d=s.dots.find(x=>x.r===cursor.current.r&&x.c===cursor.current.c);if(s.selecting)engine.current!.up();else if(d)engine.current!.down(d.x,d.y);}publish();
 }
 useEffect(()=>{
  if(!canvas.current)return;let stopped=false,raf=0,ui=0;const e=mountZop(canvas.current,()=>bestRef.current,score=>{if(score>bestRef.current){bestRef.current=score;setBest(score);try{localStorage.setItem(BEST_KEY,String(score));}catch{setStored(false);}}});engine.current=e;setView(e.snapshot());clock.current=performance.now();
  function frame(now:number){if(stopped)return;const dt=now-clock.current;clock.current=now;if(!flags.current.paused&&!flags.current.away){const previous=e.snapshot().phase;e.frame(dt);if(now-ui>80||e.snapshot().phase!==previous){setView(e.snapshot());ui=now;}}raf=requestAnimationFrame(frame);}raf=requestAnimationFrame(frame);
  const blur=()=>{flags.current.away=true;clock.current=performance.now();held.current=null;e.cancel();setAway(true);setView(e.snapshot());},visibility=()=>{if(document.hidden)blur();};window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  const read=()=>({...e.snapshot(),paused:flags.current.paused||flags.current.away,best:bestRef.current,rafActive:!stopped,held:held.current});Object.defineProperty(window,'__zopRead',{configurable:true,value:read});
  return()=>{stopped=true;cancelAnimationFrame(raf);held.current=null;e.dispose();engine.current=null;window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);delete(window as unknown as Record<string,unknown>).__zopRead;};
 },[]);
 useEffect(()=>{clock.current=performance.now();if(paused)cancel();},[paused]);
 useEffect(()=>{if(view?.phase==='waiting')status.current('按下开始，在60秒内连接相邻同色点。画出闭环可以清除全盘同色点。');else if(view?.phase==='gameover')status.current(`时间到，本局得到${view.score}分。可以再挑战一次，最高分保存在当前浏览器。`);else if(view?.phase==='playing')status.current(view.squareColor?'闭环已经连成！松手清除全盘同色点。':'按住同色点，沿上下左右相邻点画线，松手得分。');},[view?.phase,view?.squareColor]);
 useEffect(()=>{if(hint.current===hintToken)return;hint.current=hintToken;status.current('至少连接两个同色点。沿上一格退回可以缩短链条；绕一圈连回早先的点，会清除全盘同色。斜着连接和跨色连接无效。');},[hintToken]);
 return <section ref={root} className="zop-game" tabIndex={0} onKeyDown={keyboard} onBlur={e=>{if(!(e.relatedTarget instanceof Node)||!e.currentTarget.contains(e.relatedTarget))cancel();}} data-zop-phase={view?.phase??'waiting'}>
  <header className="zop-title"><div><span>ZOP · 连起来，再绕一圈</span><h3>小小色点，连成大大的环。</h3></div><b>60秒完整挑战</b></header>
  <p className="zop-intro">沿上下左右连接同色点，松手收分。画出闭环，全盘同色点一起消除。</p>
  <div className="zop-stats"><span>剩余秒数<strong>{view?.time??60}</strong></span><span>本局得分<strong>{view?.score??0}</strong></span><span>最高纪录<strong>{best}</strong></span></div>
  <div className="zop-board"><canvas ref={canvas} width={420} height={540} aria-label="连点成环，6行6列的五色色点棋盘" onPointerDown={down} onPointerMove={e=>{if(held.current===e.pointerId&&!blocked){const p=point(e);engine.current?.move(p.x,p.y);publish();}}} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={()=>{if(held.current!==null)cancel();}}/>
   {(!view||view.phase==='waiting'||view.phase==='gameover')&&<div className="zop-cover"><span>{view?.phase==='gameover'?'这一分钟，收获满满':'先找到一对同色邻居'}</span><h4>{view?.phase==='gameover'?`本局 ${view.score} 分`:'把颜色连成一条线'}</h4><p>{view?.phase==='gameover'?`共消除${view.metrics.clears}次，其中闭环${view.metrics.loops}次。`:'至少连两个点，试着围成一个小方环。'}</p><button onClick={start} disabled={blocked}>{view?.phase==='gameover'?'再挑战一分钟':'开始60秒挑战'}</button></div>}
   {away&&!paused&&<div className="zop-cover"><h4>色点已暂停</h4><p>回来继续这一分钟。</p><button onClick={()=>{clock.current=performance.now();flags.current.away=false;setAway(false);root.current?.focus({preventScroll:true});}}>继续连点</button></div>}
  </div>
  <p className="zop-selection" role="status">{view?.squareColor?'已连成闭环：松手清除全盘同色点。':view?.selecting?`正在连接${view.selected.length}个点，沿上一格退回可撤一格。`:'触屏或鼠标按住并拖动，松手提交；触点中断或暂停会取消未提交的线。'}</p>
  <p className="zop-keyboard">键盘：方向键移动格位，空格或回车开始连线、再次按下提交，Esc取消。当前第{cursor.current.r+1}行、第{cursor.current.c+1}列。</p>
  {!stored&&<p role="alert">当前浏览器无法保存最高分，仍可继续这一局。</p>}
  <details><summary>完整规则与开源说明</summary><p>棋盘固定6×6，共五种颜色。只能连上下左右相邻且同色的点，至少两个才能收分。回到刚经过的上一点可退一步；连回更早的点就形成闭环。松手后，每个实际消除的点得1分，新的色点从上方补入并下落。闭环补入的点不会使用刚刚清除的颜色。</p><p>每局60秒，暂停与离开页面不会消耗游戏时间。这是完整原作计时挑战，没有编号关卡。最高分只在本局结束后保存，退出未完成的对局会结束当前进度。</p><p>原作 Zop ©2015 Zolmeister，固定版本fafaa475，MIT许可证。保留原Canvas连线、闭环、消除、重力与补色核心；本站新增中文外壳、触屏坐标适配、暂停卸载和独立存储，采用GPL-3.0-only。未使用原网站登录、分享服务、依赖包或字体文件。<a href="./zop-LICENSE.txt" target="_blank" rel="noreferrer">查看完整来源与许可证</a>。</p></details>
 </section>;
}
