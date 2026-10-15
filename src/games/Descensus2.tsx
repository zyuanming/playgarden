// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import './descensus2.css';
type Records = { completed:number; bestTime:number|null; lastLives:number };
type Snapshot = { phase:string; paused:boolean; height:number; lives:number; completed:number; bestTime:number|null };
const KEY='playgarden.descensus2.v1.records';
let memory:Records|null=null, pendingSaves:Promise<void>=Promise.resolve();
function clean(value:unknown):Records { const v=value&&typeof value==='object'?value as Partial<Records>:{};return {completed:Number.isSafeInteger(v.completed)&&v.completed!>=0?v.completed!:0,bestTime:typeof v.bestTime==='number'&&Number.isFinite(v.bestTime)&&v.bestTime>0?v.bestTime:null,lastLives:Number.isInteger(v.lastLives)&&v.lastLives!>=0?v.lastLives!:0}; }
function read(){if(memory===null){try{memory=clean(JSON.parse(localStorage.getItem(KEY)||'null'));}catch{memory=clean(null);}}return {...memory};}
function persist(value:unknown){const next=clean(value),old=read();if(next.completed<old.completed)return;memory=next;try{localStorage.setItem(KEY,JSON.stringify(next));}catch{/* Retain earned results for this page session. */}}
export default function Descensus2(props:GameProps){return <Round key={props.resetToken} {...props}/>;}
function Round({paused,onStatus,hintToken}:GameProps){
 const frame=useRef<HTMLIFrameElement>(null),latest=useRef({paused,onStatus}),epochRef=useRef(0),hint=useRef(hintToken);latest.current={paused,onStatus};
 const session=useMemo(()=>crypto.randomUUID(),[]),[ready,setReady]=useState(false),[error,setError]=useState(''),[height,setHeight]=useState(700),[snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const src=useMemo(()=>{const u=new URL('./descensus-2/index.html',document.baseURI);u.searchParams.set('session',session);return u.href;},[session]);
 function send(type:string,extra:Record<string,unknown>={}){frame.current?.contentWindow?.postMessage({source:'playgarden-host',session,type,...extra},'*');}
 function initialize(){const target=frame.current?.contentWindow;void pendingSaves.then(()=>{if(target&&frame.current?.contentWindow===target)send('init',{state:read(),paused:latest.current.paused});});}
 useLayoutEffect(()=>{
  const epoch=++epochRef.current,target=frame.current?.contentWindow,drainToken=crypto.randomUUID();let alive=true,booted=false,finishDrain:(()=>void)|undefined;
  const resize=()=>setHeight(Math.max(520,Math.min(840,window.innerHeight-130)));resize();window.addEventListener('resize',resize);
  const timeout=window.setTimeout(()=>{if(alive&&!booted)setError('游戏尚未加载，请点击上方“重来”重试。');},15000);
  latest.current.onStatus('从1000米高空出发，画木条引导小球降落。这是可完成的连续旅程，没有编号关卡。');
  const receive=(event:MessageEvent)=>{
   const d=event.data;
   if(!alive&&event.source===window&&event.origin===location.origin&&d?.source==='descensus-drain'&&d.token===drainToken){window.removeEventListener('message',receive);finishDrain?.();return;}
   if(event.source!==target||event.origin!=='null'||d?.source!=='playgarden-descensus2'||d.session!==session)return;
   if(d.type==='save'){persist(d.state);return;}if(!alive)return;
   if(d.type==='hello')initialize();
   else if(d.type==='ready'){if(d.revision!=='descensus2-750003f-playgarden-1'||d.campaign!==true||d.levelCount!==0){setError('游戏资源版本不一致，请重来。');return;}booted=true;clearTimeout(timeout);setReady(true);setError('');send('pause',{paused:latest.current.paused});}
   else if(d.type==='snapshot'){const s=d.state;if(s&&typeof s.phase==='string'&&Number.isFinite(s.height)&&Number.isInteger(s.lives))setSnapshot(s);}
   else if(d.type==='status'&&typeof d.message==='string')latest.current.onStatus(d.message.slice(0,300));
   else if(d.type==='error')setError('游戏加载遇到问题：'+String(d.message).slice(0,200));
  };
  window.addEventListener('message',receive);
  return()=>{alive=false;clearTimeout(timeout);window.removeEventListener('resize',resize);const drained=new Promise<void>(resolve=>{finishDrain=resolve;});pendingSaves=Promise.all([pendingSaves,drained]).then(()=>undefined);queueMicrotask(()=>{if(epochRef.current!==epoch){window.removeEventListener('message',receive);finishDrain?.();return;}target?.postMessage({source:'playgarden-host',session,type:'dispose'},'*');window.postMessage({source:'descensus-drain',token:drainToken},location.origin);});};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[session]);
 useEffect(()=>{if(ready)send('pause',{paused});},[ready,paused,session]);
 useEffect(()=>{if(hint.current!==hintToken){hint.current=hintToken;send('hint');}},[hintToken,session]);
 return <section className="descensus-game" data-descensus-ready={ready} data-descensus-phase={snapshot?.phase??'loading'}>
  <header><div><span>DESCENSUS 2 · 完整原作改编</span><h3>在云间画一道安全的落点</h3></div><b>1000 米连续旅程</b></header>
  <p>拖动画木条，让小球弹向锯片之间的空隙。沿途有转动机关、蛇形木架与六段风区，地面等着你的降落证书。</p>
  <div className={`descensus-frame${paused?' is-paused':''}`} style={{height}}><iframe ref={frame} src={src} title="Descensus 2 千米降落完整旅程" sandbox="allow-scripts" onLoad={initialize} tabIndex={paused?-1:0} aria-hidden={paused}/>{!ready&&!error&&<p className="descensus-cover" role="status">正在准备云间旅程…</p>}{error&&<p className="descensus-cover" role="alert">{error}</p>}</div>
  {paused&&<p role="status">已暂停，点击上方“继续游戏”恢复。</p>}
  <details><summary>操作、记录与开源说明</summary>
   <p>从1000米、5条生命开始。鼠标或单指按住画线，松开或碰到物体后木条固定；再次拖动画下一根。每下降100米，30秒计时重新开始。计时点不会存档，也不会把小球传送到检查点。</p>
   <p>碰到锯片或计时耗尽会扣一条生命，渐隐后在当前位置继续，并有约3秒无敌。拾取“+1”可补充生命；最后一条耗尽后自动开始新一轮。到达真实地面才显示用时和剩余生命的原作证书。</p>
   <p>所有10种原作地形与六段风区均保留。“原作菜单”可查看帮助与作者、确认重开；暂停、切换标签或离开游戏都会停止当前运行。上方“重来”重新加载并从1000米起步，保留已完成次数与最快用时。本游戏不保存未完成旅程。</p>
   <p>Tom W Hall 原作 MIT，固定2018年版本。保留原 TypeScript、p2 与 Pixi 物理和渲染实现及16张原图；3张木纹与字体分别替换为本站原创纹理和系统字体。保留浏览器原有无声模式。本站隔离宿主、中文界面与修复为 GPL-3.0-only；依赖许可单独完整保留。</p>
   <p><a href="./descensus-2/NOTICE.txt" target="_blank" rel="noreferrer">完整署名与许可证</a> · <a href="./descensus-2/source.zip" download>对应源码及修改说明</a> · <a href="https://github.com/TomWHall/Descensus2/tree/750003f12815a756ebd18634e88620c1050a1ec5" target="_blank" rel="noreferrer">固定版本原作</a></p>
  </details>
 </section>;
}
