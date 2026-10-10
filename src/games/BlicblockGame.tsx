// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useRef,useState,type CSSProperties,type KeyboardEvent,type PointerEvent} from 'react';
import type {GameProps} from '../lib/types';
import {createBlicblockRuntime,type BlicRuntime,type BlicSnapshot,type BlicColor} from '../vendor/blicblockRuntime';
import './blicblock.css';

const COLORS:Record<BlicColor,{name:string;symbol:string}>={magenta:{name:'紫红',symbol:'●'},orange:{name:'橙',symbol:'◆'},yellow:{name:'黄',symbol:'▲'},green:{name:'绿',symbol:'✚'},blue:{name:'蓝',symbol:'■'},white:{name:'白',symbol:'○'}};
const EMPTY:BlicSnapshot={blocks:[],upcoming:[],score:0,level:1,tickLength:1200,gameover:false,paused:false,busy:false,best:0,storageOK:true,mode:0,timers:0,disposed:false,clears:0};
const shapes=[['I',[0,1,2,3]],['O',[0,1,4,5]],['T',[1,4,5,6]],['L',[0,4,8,9]],['J',[1,5,8,9]],['S',[1,2,4,5]],['Z',[0,1,5,6]]] as const;
export default function BlicblockGame(props:GameProps){return <BlicblockRound key={props.resetToken} {...props}/>;}
function BlicblockRound({paused,hintToken,onStatus}:GameProps){
 const [view,setView]=useState(EMPTY),[mode,setMode]=useState(0),[generation,setGeneration]=useState(0),[away,setAway]=useState(false);
 const engine=useRef<BlicRuntime|null>(null),root=useRef<HTMLElement>(null),pointer=useRef<{x:number;y:number;id:number}|null>(null),status=useRef(onStatus),hint=useRef(hintToken),flags=useRef({paused,away});
 status.current=onStatus;flags.current={paused,away};const blocked=paused||away;
 useEffect(()=>{
  const runtime=createBlicblockRuntime(setView,mode);engine.current=runtime;runtime.pause(flags.current.paused||flags.current.away);setView(runtime.snapshot());
  const read=()=>runtime.snapshot();Object.defineProperty(window,'__blicblockRead',{configurable:true,value:read});
  return()=>{runtime.dispose();if(engine.current===runtime)engine.current=null;delete (window as unknown as Record<string,unknown>).__blicblockRead;};
 },[mode,generation]);
 useEffect(()=>{engine.current?.pause(blocked);pointer.current=null;},[blocked]);
 useEffect(()=>{const blur=()=>setAway(true),visibility=()=>{if(document.hidden)blur();};window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);return()=>{window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);};},[]);
 useEffect(()=>{status.current(view.gameover?`中间出入口已满，本局 ${view.score} 分。可重新开始。`:mode?`原作连锁练习 ${mode}：移动橙色方块，补出同色四格，再观察上方落块。练习不计最高分。`:`把单个落块拼成同色四格形状。每次消除 1,000 分，每 4,000 分加快。当前 ${view.score} 分。`);},[view.gameover,view.score,mode]);
 useEffect(()=>{if(hint.current===hintToken)return;hint.current=hintToken;status.current('看右上角接下来的两块。同色四块拼成 I、O、T、L、J、S、Z 都会消除；上层落下后还能连续消除。保持中间列畅通。');},[hintToken]);
 function input(direction:'left'|'right'|'down'){if(blocked)return;engine.current?.input(direction);root.current?.focus({preventScroll:true});}
 function restart(){if(paused)return;setAway(false);setGeneration(n=>n+1);root.current?.focus({preventScroll:true});}
 function keyboard(event:KeyboardEvent){if(event.altKey||event.ctrlKey||event.metaKey||event.target instanceof HTMLSelectElement)return;const direction:Record<string,'left'|'right'|'down'>={ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',ArrowDown:'down',s:'down',S:'down'};if(event.key===' '||event.key==='p'||event.key==='P'){event.preventDefault();if(!event.repeat&&!paused)setAway(x=>!x);return;}const action=direction[event.key];if(action){event.preventDefault();input(action);}}
 function touchStart(event:PointerEvent<HTMLDivElement>){if(blocked||view.gameover)return;pointer.current={x:event.clientX,y:event.clientY,id:event.pointerId};event.currentTarget.setPointerCapture(event.pointerId);root.current?.focus({preventScroll:true});}
 function touchEnd(event:PointerEvent<HTMLDivElement>){const start=pointer.current;pointer.current=null;if(!start||start.id!==event.pointerId)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.max(Math.abs(dx),Math.abs(dy))<22)return;if(Math.abs(dx)>Math.abs(dy))input(dx>0?'right':'left');else if(dy>0)input('down');}
 const active=view.blocks.find(b=>b.active);
 return <section className="bb-game" ref={root} tabIndex={0} onKeyDown={keyboard} data-bb-ready={engine.current?'true':'false'} data-bb-score={view.score} data-bb-phase={view.gameover?'gameover':blocked?'paused':'playing'}>
  <header className="bb-heading"><div><span>BLICBLOCK · 六色拼落</span><h3>一格一格，拼出连锁。</h3></div><b>无尽挑战</b></header>
  <p className="bb-intro">左右移动单个落块。同色四格拼成图形就会消失，上方方块落下，接着连锁。</p>
  <div className="bb-stats"><span>得分<strong>{view.score.toLocaleString()}</strong></span><span>速度<strong>{view.level}</strong></span><span>最高分<strong>{view.best.toLocaleString()}</strong></span></div>
  <div className="bb-topline"><label>游戏方式 <select aria-label="游戏方式" value={mode} disabled={paused} onChange={e=>{setAway(false);setMode(Number(e.target.value));}}><option value={0}>六色无尽</option>{[1,2,3,4].map(n=><option key={n} value={n}>原作连锁练习 {n}</option>)}</select></label><div className="bb-queue" aria-label="接下来两个落块"><span>接下来</span>{view.upcoming.map((b,i)=><span key={i} className={`bb-block bb-${b.color}`} title={COLORS[b.color].name}><i>{COLORS[b.color].symbol}</i></span>)}</div></div>
  <div className="bb-stage">
   <div className="bb-board" role="group" aria-label="五列七行六色拼落棋盘" onPointerDown={touchStart} onPointerUp={touchEnd} onPointerCancel={()=>{pointer.current=null;}} onLostPointerCapture={()=>{pointer.current=null;}}>
    <div className="bb-grid" aria-hidden="true">{Array.from({length:35},(_,i)=><span key={i}/>)}</div>
    <div className="bb-entry" aria-hidden="true">↓</div>
    {view.blocks.map(b=><div key={b.id} className={`bb-block bb-${b.color}${b.active?' bb-active':''}${b.highlight?' bb-glow':''}`} data-bb-block={b.id} data-bb-row={b.x} data-bb-col={b.y} data-bb-color={b.color} data-bb-active={b.active?'true':'false'} style={{'--bb-row':b.x,'--bb-col':b.y} as CSSProperties} aria-label={`${COLORS[b.color].name}色，第${b.x+1}行第${b.y+1}列${b.active?'，正在下落':''}`}><i>{COLORS[b.color].symbol}</i></div>)}
    {view.gameover&&<div className="bb-cover"><span>这一局结束</span><h4>{view.score.toLocaleString()} 分</h4><p>中间列已满，再留一条落块通道。</p><button disabled={paused} onClick={restart}>再玩一局</button></div>}
    {away&&!paused&&<div className="bb-cover"><h4>落块已暂停</h4><p>时间、移动和连锁都停在这一刻。</p><button onClick={()=>{setAway(false);root.current?.focus({preventScroll:true});}}>继续落块</button></div>}
   </div>
   <div className="bb-legend" aria-label="颜色和图案">{Object.entries(COLORS).map(([color,item])=><span key={color}><i className={`bb-dot bb-${color}`}>{item.symbol}</i>{item.name}</span>)}</div>
  </div>
  <div className="bb-controls"><button type="button" aria-label="落块向左" disabled={blocked||view.gameover||!active} onClick={()=>input('left')}>←<span>向左</span></button><button type="button" aria-label="快速落下" disabled={blocked||view.gameover||!active} onClick={()=>input('down')}>↓<span>落下</span></button><button type="button" aria-label="落块向右" disabled={blocked||view.gameover||!active} onClick={()=>input('right')}>→<span>向右</span></button></div>
  <div className="bb-actions"><button disabled={paused||view.gameover} onClick={()=>setAway(x=>!x)}>{away?'继续落块':'暂停落块'}</button><button disabled={paused} onClick={restart}>重新开局</button></div>
  <p className="bb-note">← → 移动，↓ 快落，空格暂停。触屏可用按钮，也可在棋盘上左右或向下滑。</p>
  {mode>0&&<p className="bb-practice" role="status">这是原作的连锁练习布局，分数不进入最高分；它不计作关卡。</p>}
  {!view.storageOK&&<p role="alert">浏览器暂时无法保存最高分，本局仍可继续。</p>}
  <details><summary>七种图形、完整规则与来源</summary><div className="bb-shapes">{shapes.map(([name,cells])=><div key={name}><div>{Array.from({length:12},(_,i)=><i key={i} className={(cells as readonly number[]).includes(i)?'filled':''}/>)}</div><b>{name}</b></div>)}</div><p>上面七种四格图形可以旋转，L/J、S/Z 两种镜像都可消除。每次消除恰好四块、获得 1,000 分；上方方块按重力落下，可能继续消除。速度从每格1.2秒开始，每累计4,000分减少9%的间隔。</p><p>棋盘固定五列七行，紫红、橙、黄、绿、蓝、白六种颜色等概率出现。每次从中间列落下一块，可看见接下来的两块。中间列七格占满时结束，不需要等整张棋盘填满。</p><p>完整保留原作的四种连锁练习，它们只演示重力连锁，不是有限关卡。暂停会冻结全部计时；切出窗口自动暂停，回来后点继续。离开后停止所有计时，再进来从新局开始。只有六色无尽的结束分数保存为本浏览器最高分。</p><p>改编自 Sarah Vessels 的 BlicblockJS，固定版本05bafeed。直接复用 MIT 原作的方块模型、七种图形判定、重力连锁、分数速度和游戏控制器。中文界面与离线适配为GPL-3.0-only。方块颜色和条纹来自原作CSS；未使用《模拟人生》截图、字体、旗帜、地图、音效或在线排行榜。<a href="./blicblock-LICENSE.txt" target="_blank" rel="noreferrer">完整原作许可证</a>。</p></details>
 </section>;
}
