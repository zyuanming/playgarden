// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import type {GameProps} from '../lib/types';
import {createPondEngine} from '../vendor/pondCore';
import './pond.css';
const BEST_KEY='playgarden.pond.best-size.v1';
type Engine=ReturnType<typeof createPondEngine>;
type View=ReturnType<Engine['snapshot']>;
function storedBest(){try{const x=Number(localStorage.getItem(BEST_KEY));return Number.isFinite(x)&&x>=20?x:20;}catch{return 20;}}
export default function PondGame(props:GameProps){return <PondRound key={props.resetToken} {...props}/>;}
function PondRound({paused,hintToken,onStatus}:GameProps){
 const canvas=useRef<HTMLCanvasElement>(null),root=useRef<HTMLElement>(null),engine=useRef<Engine|null>(null),keys=useRef(new Set<string>()),pointer=useRef<{x:number;y:number}|null>(null),last=useRef<View|null>(null),bestRef=useRef(storedBest()),status=useRef(onStatus),flags=useRef({paused,away:false}),hint=useRef(hintToken),clock=useRef(performance.now());
 const [view,setView]=useState<View|null>(null),[best,setBest]=useState(bestRef.current),[away,setAway]=useState(false),[stored,setStored]=useState(true);
 status.current=onStatus;flags.current={paused,away};const blocked=paused||away;
 function clearInput(){keys.current.clear();pointer.current=null;}
 function publish(s:View){last.current=s;setView(s);if(s.player&&s.player.size>bestRef.current){bestRef.current=s.player.size;setBest(s.player.size);try{localStorage.setItem(BEST_KEY,String(s.player.size));}catch{setStored(false);}}}
 function start(){if(blocked||!engine.current)return;clock.current=performance.now();clearInput();engine.current.start();engine.current.render();publish(engine.current.snapshot());root.current?.focus({preventScroll:true});}
 function point(e:PointerEvent<HTMLCanvasElement>){const r=e.currentTarget.getBoundingClientRect();pointer.current={x:(e.clientX-r.left)/r.width*780-390,y:(e.clientY-r.top)/r.height*540-270};keys.current.clear();}
 function down(e:PointerEvent<HTMLCanvasElement>){if(blocked||view?.phase!=='playing')return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);point(e);root.current?.focus({preventScroll:true});}
 function release(){pointer.current=null;}
 function keyboard(e:KeyboardEvent,down:boolean){const physical=e.code||e.key.toLowerCase();if(!down){keys.current.delete(physical);return;}if(e.altKey||e.ctrlKey||e.metaKey)return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)){e.preventDefault();if(!blocked){keys.current.add(physical);pointer.current=null;}}}
 useEffect(()=>{
  if(!canvas.current)return;const e=createPondEngine(canvas.current,780,540);engine.current=e;e.render();publish(e.snapshot());clock.current=performance.now();let raf=0,ui=clock.current,cancelled=false,phase=e.snapshot().phase;
  function tick(now:number){if(cancelled)return;const dt=now-clock.current;clock.current=now;if(!flags.current.paused&&!flags.current.away){e.step(dt,pointer.current?{direction:pointer.current}:{keys:[...keys.current].reverse()});e.render();const s=e.snapshot();last.current=s;if(now-ui>80||s.phase!==phase){publish(s);ui=now;phase=s.phase;}}raf=requestAnimationFrame(tick);}
  raf=requestAnimationFrame(tick);
  const blur=()=>{flags.current.away=true;clock.current=performance.now();clearInput();setAway(true);},visibility=()=>{if(document.hidden)blur();};window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  Object.defineProperty(window,'__pondRead',{configurable:true,value:()=>({...(last.current??e.snapshot()),paused:flags.current.paused||flags.current.away,held:{direction:pointer.current?{...pointer.current}:null,keys:[...keys.current]},best:bestRef.current})});
  return()=>{cancelled=true;cancelAnimationFrame(raf);clearInput();e.dispose();engine.current=null;window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);delete(window as unknown as Record<string,unknown>).__pondRead;};
 },[]);
 useEffect(()=>{clock.current=performance.now();if(blocked)clearInput();},[blocked]);
 useEffect(()=>{if(!view)return;const text=view.phase==='waiting'?'按住池塘的一侧，让鱼儿向那里游。吃小鱼，避开更大的鱼。':view.phase==='dying'?'遇到更大的鱼了。等待颜色散开后，可以重新游一次。':view.phase==='gameover'?'这次游历结束，可以重新入水。最高体型保存在当前浏览器。':'鱼会缓缓转弯。吃下小鱼的颜色，等彩色微粒游入身体，才会慢慢长大。';status.current(text);},[view?.phase]);
 useEffect(()=>{if(hint.current===hintToken)return;hint.current=hintToken;status.current('瞄准比你小的鱼，留意周围更大的轮廓。松手会减速；长按改变方向。集满四份额外颜色会向顶部色条送出一份进度。');},[hintToken]);
 const active=view?.phase==='playing'||view?.phase==='dying';
 return <section ref={root} className="pond-game" tabIndex={0} onKeyDown={e=>keyboard(e,true)} onKeyUp={e=>keyboard(e,false)} onBlur={e=>{if(!(e.relatedTarget instanceof Node)||!e.currentTarget.contains(e.relatedTarget))clearInput();}} data-pond-phase={view?.phase??'waiting'}>
  <header className="pond-title"><div><span>THE POND · 随水而游</span><h3>在彩色的水流里，慢慢长大。</h3></div><b>完整无尽模式</b></header>
  <p className="pond-intro">吃下比你小的鱼，避开更大的轮廓。长按池塘的一侧转向，松手慢慢停下。</p>
  <div className="pond-stats"><span>当前体型<strong>{(view?.player?.size??20).toFixed(1)}</strong></span><span>最高体型<strong>{best.toFixed(1)}</strong></span><span>吃到的小鱼<strong>{view?.metrics.playerKills??0}</strong></span><span>彩色圆环<strong>{view?.metrics.orbs??0}</strong></span></div>
  <div className="pond-board"><canvas ref={canvas} width={780} height={540} aria-label="彩游池塘：你在中央，较小的彩色鱼可吸收，较大的鱼会吞掉你" onPointerDown={down} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId)&&!blocked)point(e);}} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}/>
   {(!view||view.phase==='waiting'||view.phase==='gameover')&&<div className="pond-cover"><span>{view?.phase==='gameover'?'水波归于平静':'一条小鱼的游历'}</span><h4>{view?.phase==='gameover'?`这次吃到 ${view.metrics.playerKills} 条小鱼`:'从这里，游向远处'}</h4><p>原作连续池塘 · 彩色微粒 · 大鱼与小鱼</p><button disabled={blocked} onClick={start}>{view?.phase==='gameover'?'再游一次':'开始游动'}</button></div>}
   {away&&!paused&&<div className="pond-cover"><h4>池塘已暂停</h4><p>返回后继续游动，时间不会偷偷流走。</p><button onClick={()=>{clock.current=performance.now();clearInput();flags.current.away=false;setAway(false);root.current?.focus({preventScroll:true});}}>继续游动</button></div>}
   {view?.phase==='dying'&&<div className="pond-banner" role="status">颜色正在散开，稍后可以再游一次…</div>}
  </div>
  <div className="pond-control-note"><strong>{active?'你始终在画面中央。':'按“开始游动”进入池塘。'}</strong><span>触屏或鼠标：按住想游去的方向并拖动。键盘：方向键或 WASD，松开减速。</span></div>
  <p className="pond-progress">顶部色条每收集10份颜色，汇成一枚圆环；10枚圆环化为一阵彩色水花，然后继续游历。</p>
  {!stored&&<p role="alert">当前浏览器无法保存最高体型，本局仍可继续。</p>}
  <details><summary>完整玩法与开源说明</summary><p>鱼身由六个圆形区域参与碰撞。相碰时，大鱼吸收小鱼，体型相同依照原作队列顺序判断。你和周围的鱼都会长大；其他鱼也会相互捕食。颜色微粒真正游入身体后才增加体型，新增颜色需要时间展开。</p><p>集齐四份额外颜色，会把它们送往顶部色条。色条、圆环与水花只是不断循环的成长进度，没有有限关卡或通关结局。重来会从新局开始；最高体型是本站单独记录的本地统计，不上传成绩。</p><p>基于 Zolmeister 2013《The Pond》完整原作机制与程序化绘图，固定版本68fa8b54，GPL-3.0-or-later。中文宿主、触屏与暂停适配采用GPL-3.0-only。统一780×540逻辑场地和原桌面粒子密度，修复原键盘变量错误、模拟循环引用与重叠进度丢失。原音乐、字体与装饰图片未使用。<a href="./pond-LICENSE.txt" target="_blank" rel="noreferrer">来源与完整许可证</a>。</p></details>
 </section>;
}
