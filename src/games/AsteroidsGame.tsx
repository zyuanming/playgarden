// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import type {GameProps} from '../lib/types';
import {createAsteroidsEngine,ASTEROIDS_WIDTH as W,ASTEROIDS_HEIGHT as H,SHIP_POINTS,EXHAUST_POINTS,UFO_POINTS,UFO_TOP_POINTS,UFO_BOTTOM_POINTS,type AsteroidsInput,type AsteroidsSnapshot} from '../vendor/asteroidsCore';
import './asteroids.css';

const BEST_KEY='playgarden.asteroids.best.v1';
const emptyInput=()=>({left:false,right:false,thrust:false,fire:false});
function loadBest(){try{const n=Number(localStorage.getItem(BEST_KEY));return Number.isSafeInteger(n)&&n>=0?n:0;}catch{return 0;}}
function poly(ctx:CanvasRenderingContext2D,points:readonly number[],x:number,y:number,rotation=0,scale=1,closed=true){ctx.save();ctx.translate(x,y);ctx.rotate(rotation*Math.PI/180);ctx.scale(scale,scale);ctx.beginPath();ctx.moveTo(points[0],points[1]);for(let i=2;i<points.length;i+=2)ctx.lineTo(points[i],points[i+1]);if(closed)ctx.closePath();ctx.stroke();ctx.restore();}
function draw(ctx:CanvasRenderingContext2D,s:AsteroidsSnapshot){
 ctx.fillStyle='#0c182c';ctx.fillRect(0,0,W,H);ctx.fillStyle='#263b52';
 for(let i=0;i<55;i++){const x=(i*149+31)%W,y=(i*97+19)%H;ctx.fillRect(x,y,1.5,1.5);}
 ctx.lineWidth=2;ctx.lineJoin='round';ctx.strokeStyle='#bfcecc';
 for(const a of s.asteroids){for(const dx of [-W,0,W])for(const dy of [-H,0,H])poly(ctx,a.points,a.x+dx,a.y+dy,a.rotation,a.scale);}
 if(s.alien.visible){ctx.strokeStyle='#fca6bc';for(const dy of [-H,0,H]){poly(ctx,UFO_POINTS,s.alien.x,s.alien.y+dy);poly(ctx,UFO_TOP_POINTS,s.alien.x,s.alien.y+dy,0,1,false);poly(ctx,UFO_BOTTOM_POINTS,s.alien.x,s.alien.y+dy,0,1,false);}}
 ctx.strokeStyle='#bceefd';ctx.lineWidth=2.5;
 for(const b of s.bullets){ctx.beginPath();ctx.moveTo(b.x-2,b.y-2);ctx.lineTo(b.x+2,b.y+2);ctx.moveTo(b.x+2,b.y-2);ctx.lineTo(b.x-2,b.y+2);ctx.stroke();}
 ctx.strokeStyle='#f6a2ba';for(const b of s.alienBullets){ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-b.vx,b.y-b.vy);ctx.stroke();}
 ctx.strokeStyle='#f1c38c';ctx.lineWidth=1.5;
 for(const e of s.explosions){for(const line of e.lines){ctx.beginPath();ctx.moveTo(e.x+line[0]*e.scale,e.y+line[1]*e.scale);ctx.lineTo(e.x+line[2]*e.scale,e.y+line[3]*e.scale);ctx.stroke();}}
 if(s.ship.visible){for(const dx of [-W,0,W])for(const dy of [-H,0,H]){
  ctx.strokeStyle='#72dcdb55';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(s.ship.x+dx,s.ship.y+dy,17,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='#e8ffff';ctx.lineWidth=2.6;poly(ctx,SHIP_POINTS,s.ship.x+dx,s.ship.y+dy,s.ship.rotation);
  if(s.ship.thrusting){ctx.strokeStyle='#ffce78';poly(ctx,EXHAUST_POINTS,s.ship.x+dx,s.ship.y+dy,s.ship.rotation,1,false);}
 }}
}

export default function AsteroidsGame(props:GameProps){return <AsteroidsRound key={props.resetToken} {...props}/>;}
function AsteroidsRound({paused,hintToken,onStatus}:GameProps){
 const [engine]=useState(()=>createAsteroidsEngine()),[view,setView]=useState(()=>engine.snapshot()),[best,setBest]=useState(loadBest),[stored,setStored]=useState(true),[away,setAway]=useState(false);
 const root=useRef<HTMLElement>(null),canvas=useRef<HTMLCanvasElement>(null),keys=useRef(new Map<string,keyof AsteroidsInput>()),pointers=useRef(new Map<number,keyof AsteroidsInput>()),input=useRef(emptyInput()),last=useRef(view),bestRef=useRef(best),status=useRef(onStatus),flags=useRef({paused,away}),hint=useRef(hintToken),frameCount=useRef(0);
 status.current=onStatus;flags.current={paused,away};bestRef.current=best;
 const blocked=paused||away;
 const resetHeld=()=>{keys.current.clear();pointers.current.clear();input.current=emptyInput();};
 function syncInput(){const next=emptyInput();for(const key of keys.current.values())next[key]=true;for(const key of pointers.current.values())next[key]=true;input.current=next;}
 function persistScore(score:number){if(score>bestRef.current){bestRef.current=score;setBest(score);try{localStorage.setItem(BEST_KEY,String(score));setStored(true);}catch{setStored(false);}}}
 function publish(s:AsteroidsSnapshot){last.current=s;persistScore(s.score);setView(s);}
 function begin(){if(blocked)return;resetHeld();engine.start();publish(engine.snapshot());root.current?.focus({preventScroll:true});}
 function press(event:PointerEvent<HTMLButtonElement>,action:keyof AsteroidsInput){if(blocked||view.phase==='waiting'||view.phase==='gameover')return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);pointers.current.set(event.pointerId,action);syncInput();root.current?.focus({preventScroll:true});}
 function release(event:PointerEvent<HTMLButtonElement>){pointers.current.delete(event.pointerId);syncInput();}
 function keyboard(event:KeyboardEvent,down:boolean){
  const action:Record<string,keyof AsteroidsInput>={ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',ArrowUp:'thrust',w:'thrust',W:'thrust',' ':'fire'};
  const physical=event.code||event.key;
  if(!down){keys.current.delete(physical);syncInput();if(action[event.key])event.preventDefault();return;}
  if(event.altKey||event.ctrlKey||event.metaKey)return;
  if(event.key==='p'||event.key==='P'){event.preventDefault();if(down&&!event.repeat&&!paused){resetHeld();setAway(x=>!x);}return;}
  const k=action[event.key];if(!k)return;event.preventDefault();
  if(blocked)return;
  if(event.key===' '&&(view.phase==='waiting'||view.phase==='gameover')){if(!event.repeat)begin();return;}
  keys.current.set(physical,k);syncInput();
 }
 useEffect(()=>{
  const blur=()=>{resetHeld();setAway(true);},visibility=()=>{if(document.hidden)blur();};
  window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  const read=()=>({...last.current,input:{...input.current},paused:flags.current.paused||flags.current.away,frames:frameCount.current,best:bestRef.current});
  Object.defineProperty(window,'__asteroidsRead',{configurable:true,value:read});
  return()=>{resetHeld();window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);delete (window as unknown as Record<string,unknown>).__asteroidsRead;};
 },[]);
 useEffect(()=>{
  resetHeld();const ctx=canvas.current?.getContext('2d');if(!ctx)return;
  draw(ctx,last.current);if(blocked)return;
  let cancelled=false,raf=0,previous=performance.now(),uiAt=previous,lastPhase=view.phase;
  const tick=(now:number)=>{if(cancelled)return;const dt=now-previous;previous=now;engine.step(dt,input.current);frameCount.current++;const s=engine.snapshot();last.current=s;persistScore(s.score);draw(ctx,s);if(now-uiAt>=80||s.phase!==lastPhase){publish(s);uiAt=now;lastPhase=s.phase;}raf=requestAnimationFrame(tick);};
  raf=requestAnimationFrame(tick);return()=>{cancelled=true;cancelAnimationFrame(raf);};
 },[engine,blocked]);
 useEffect(()=>{
  const messages={waiting:'旋转、推进、开火。飞出画面会从另一边回来，松开推进后仍有惯性。',playing:`第 ${view.wave} 波，剩余 ${view.lives} 艘飞船。打碎陨石后，碎片仍需继续清理。`,respawning:`飞船损失，剩余 ${view.lives} 艘。等待中央安全后重新出发。`,'between-waves':'这一波陨石已清空，即将迎来下一波。',gameover:`本局结束，得分 ${view.score}。最高分保存在当前浏览器，可以再出发。`};status.current(messages[view.phase]);
 },[view.phase,view.wave,view.lives,view.phase==='gameover'?view.score:null]);
 useEffect(()=>{if(hint.current===hintToken)return;hint.current=hintToken;status.current('先短按推进，再松开滑行并旋转射击。大陨石会分成三块，小块更值分；飞碟会向随机方向开火。');},[hintToken]);
 const active=view.phase!=='waiting'&&view.phase!=='gameover';
 return <section ref={root} className="ast-game" tabIndex={0} onKeyDown={e=>keyboard(e,true)} onKeyUp={e=>keyboard(e,false)} onBlur={e=>{if(!(e.relatedTarget instanceof Node)||!e.currentTarget.contains(e.relatedTarget))resetHeld();}} data-ast-phase={view.phase} data-ast-score={view.score} data-ast-lives={view.lives} data-ast-wave={view.wave}>
  <header className="ast-title"><div><span>ASTEROIDS · 惯性与环绕</span><h3>在碎石间，留一条航线。</h3></div><b>无尽飞行</b></header>
  <p className="ast-intro">飞船会继续滑行。转向、短促推进，再开火清理不断分裂的陨石。</p>
  <div className="ast-stats"><span>得分<strong>{view.score}</strong></span><span>最高分<strong>{best}</strong></span><span>飞船<strong>{view.phase==='waiting'?3:view.lives}</strong></span><span>波次<strong>{view.wave||1}</strong></span></div>
  <div className="ast-board"><canvas ref={canvas} width={W} height={H} aria-label="小行星航场：白色飞船、灰色陨石与粉色飞碟" onPointerDown={()=>root.current?.focus({preventScroll:true})}/>
   {(view.phase==='waiting'||view.phase==='gameover')&&<div className="ast-cover"><span>{view.phase==='gameover'?'飞行结束':'准备出发'}</span><h4>{view.phase==='gameover'?`本局 ${view.score} 分`:'清空一波，再迎接下一波'}</h4><p>{view.phase==='gameover'?`最高分 ${best} · 三艘飞船，重新启航`:'原版三艘飞船 · 环绕空间 · 陨石分裂'}</p><button disabled={blocked} onClick={begin}>{view.phase==='gameover'?'再飞一次':'开始飞行'}</button></div>}
   {away&&!paused&&<div className="ast-cover"><h4>飞行已暂停</h4><p>切出窗口时，时间和按键都已停下。</p><button onClick={()=>{resetHeld();setAway(false);root.current?.focus({preventScroll:true});}}>继续飞行</button></div>}
   {active&&(view.phase==='respawning'||view.phase==='between-waves')&&<div className="ast-banner" role="status">{view.phase==='respawning'?'等待安全位置，准备再出发…':'这一波已清空，下一波即将到来…'}</div>}
  </div>
  <div className="ast-controls" aria-label="飞行控制">{([{key:'left',label:'左转',icon:'↶'},{key:'thrust',label:'推进',icon:'↑'},{key:'right',label:'右转',icon:'↷'},{key:'fire',label:'开火',icon:'✦'}] as const).map(c=><button type="button" key={c.key} aria-label={c.label} disabled={blocked||!active} onPointerDown={e=>press(e,c.key)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><i aria-hidden="true">{c.icon}</i><span>{c.label}</span></button>)}</div>
  <p className="ast-control-note">长按按钮可连续操作，也可同时按推进与开火。键盘：← → 转向，↑ 推进，空格开火，P 暂停。</p>
  {!stored&&<p role="alert">浏览器暂时无法保存最高分，本局仍可继续。</p>}
  <details><summary>完整玩法与开源说明</summary><p>从两颗大陨石开始，每清空一波，多一颗大陨石，最多每波十二颗。大、中陨石各分成三块，命中大、中、小陨石分别得20、60、180分，击毁飞碟得200分。飞碟也会击碎陨石，只有你的子弹计分。</p><p>只有三艘飞船，不会额外奖励生命。飞船、陨石和子弹会越过边缘环绕。没有刹车和超空间跳跃，开火方向随船头转动，子弹继承飞船速度。飞碟首次约30至60秒后出现。结束后可再飞一次，不设置虚构关卡数。</p><p>上方暂停会冻结模拟；离开游戏会停止绘制并释放输入。重来或再次进入从新局开始，最高分单独保存在本浏览器。点战场可重新聚焦键盘。触屏不要求拖动飞船，四个按钮可多指同时操作。</p><p>基于 Doug McInnes 的 HTML5-Asteroids（固定930301cb，MIT）完整原版规则适配，保留780×540逻辑场地、惯性、分裂、飞碟、生命与波次。中文界面、响应式控制和自绘卡片为GPL-3.0-only。原第三方音效、矢量字体、字体渲染片段、旧jQuery和设备脚本不进入运行。<a href="./asteroids-LICENSE.txt" target="_blank" rel="noreferrer">完整许可证</a>。</p></details>
 </section>;
}
