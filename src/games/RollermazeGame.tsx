// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useRef,useState,type PointerEvent} from 'react';
import type {GameProps} from '../lib/types';
import './rollermazeGame.css';
const REVISION='rollermaze-2a08f83-playgarden-1',STORAGE='playgarden.rollermaze.native.v1';
const INTRO='滚动穿过空中棋盘，在 13 秒内抵达树林。踩按钮打开近处通道，安全点重置倒计时。';
type Summary={level:number;title:string;state:number;paused:boolean;remaining:number|null;cleared:number[];saved:boolean;moves:number;ending:boolean;ready:boolean};
type RecordData={version:1;cleared:number[]};
const validClears=(value:unknown):value is number[]=>Array.isArray(value)&&value.length<=25&&value.every(n=>Number.isInteger(n)&&n>=0&&n<25)&&new Set(value).size===value.length;
const parse=(value:unknown):RecordData|null=>{const data=value as RecordData|null;return data?.version===1&&validClears(data.cleared)?{version:1,cleared:[...data.cleared].sort((a,b)=>a-b)}:null;};
let active:{session:string;cleared:number[];saved:boolean}|null=null;
function launch(){if(active)return {cleared:[...active.cleared],saved:active.saved};try{const raw=localStorage.getItem(STORAGE);if(raw===null)return {cleared:[],saved:true};if(raw.length>2000)throw Error();const data=parse(JSON.parse(raw));if(!data)throw Error();return {cleared:data.cleared,saved:true};}catch{return {cleared:[],saved:false};}}
const controls=[{code:'ArrowUp',label:'向上滚动',text:'↑'},{code:'ArrowLeft',label:'向左滚动',text:'←'},{code:'ArrowDown',label:'向下滚动',text:'↓'},{code:'ArrowRight',label:'向右滚动',text:'→'}];
export default function RollermazeGame({level,paused,muted=false,hintToken,undoToken,onComplete,onLevelChange,onStatus}:GameProps){
 const selected=Math.max(0,Math.min(24,Math.trunc(level))),frame=useRef<HTMLIFrameElement>(null);
 const [instance]=useState(()=>crypto.randomUUID()),[attempt,setAttempt]=useState(0),session=`${instance}-${attempt}`;
 const [initial]=useState(launch),cleared=useRef(initial.cleared),saved=useRef(initial.saved);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[state,setState]=useState<Summary|null>(null);
 const flags=useRef({paused,muted});flags.current={paused,muted};
 const callbacks=useRef({onComplete,onLevelChange,onStatus});callbacks.current={onComplete,onLevelChange,onStatus};
 const held=useRef(new Map<number,string>()),pending=useRef(false),credited=useRef(false),tokens=useRef({hintToken,undoToken});
 const base=new URL('./games/rollermaze/index.html',document.baseURI);base.searchParams.set('session',session);base.searchParams.set('level',String(selected));
 const send=(type:string,extra:Record<string,unknown>={})=>frame.current?.contentWindow?.postMessage({source:'playgarden-host',session,type,...extra},'*');
 useEffect(()=>{
  const target=frame.current?.contentWindow;let authenticated=false,lastSave=0;
  const owner={session,cleared:[...cleared.current],saved:saved.current};active=owner;
  const post=(type:string,extra:Record<string,unknown>={})=>target?.postMessage({source:'playgarden-host',session,type,...extra},'*');
  const connect=()=>post('connect',{...flags.current,cleared:cleared.current,saved:saved.current});
  setReady(false);setError('');pending.current=false;credited.current=false;
  const timer=window.setTimeout(()=>setError('游戏资源未能启动，请检查连接后重试。'),10000);
  const receive=(event:MessageEvent)=>{
   const data=event.data;if(event.source!==target||event.origin!=='null'||!data||data.source!=='playgarden-rollermaze'||data.session!==session||data.revision!==REVISION)return;
   if(data.type==='loaded')connect();
   else if(data.type==='ready'){authenticated=true;clearTimeout(timer);setReady(true);setError('');post('mute',{muted:flags.current.muted});post('pause',{paused:flags.current.paused});}
   else if(data.type==='error'&&typeof data.message==='string'){clearTimeout(timer);setReady(false);setError(data.message.slice(0,180));}
   else if(authenticated&&data.type==='snapshot'){
    const s=data.state as Summary;if(s&&s.level===selected&&typeof s.title==='string'&&[1,2,3,4].includes(s.state)&&typeof s.paused==='boolean'&&validClears(s.cleared)&&typeof s.saved==='boolean'&&typeof s.ending==='boolean'&&typeof s.ready==='boolean'&&(s.remaining===null||typeof s.remaining==='number'&&Number.isFinite(s.remaining)))setState(s);
   }else if(authenticated&&data.type==='save'&&Number.isInteger(data.saveId)&&data.saveId>lastSave&&validClears(data.cleared)){
    lastSave=data.saveId;cleared.current=[...data.cleared];owner.cleared=[...data.cleared];
    try{localStorage.setItem(STORAGE,JSON.stringify({version:1,cleared:cleared.current}));saved.current=true;}catch{saved.current=false;}
    owner.saved=saved.current;post('save-ack',{saveId:lastSave,saved:saved.current});
   }else if(authenticated&&data.type==='complete'&&data.level===selected&&!credited.current&&!pending.current&&Number.isInteger(data.moves)&&data.moves>0){
    credited.current=true;callbacks.current.onComplete();callbacks.current.onStatus(`原作第 ${selected+1} 关已抵达树林。${selected===24?'最后一关已完成。':'稍后进入下一关，也可点击上方“下一关”。'}`);
   }else if(authenticated&&data.type==='level'&&credited.current&&!pending.current&&data.level===selected+1&&data.level<25){pending.current=true;held.current.clear();post('cancel');callbacks.current.onLevelChange?.(data.level);}
  };
  const cancel=()=>{if(!document.hasFocus()){held.current.clear();post('cancel');}};
  window.addEventListener('message',receive);window.addEventListener('blur',cancel);connect();callbacks.current.onStatus(INTRO);
  return()=>{authenticated=false;clearTimeout(timer);held.current.clear();post('dispose');window.removeEventListener('message',receive);window.removeEventListener('blur',cancel);queueMicrotask(()=>{if(active===owner)active=null;});};
 },[session,selected]);
 useEffect(()=>{if(ready){if(paused)held.current.clear();send('pause',{paused});}},[ready,paused,session]);
 useEffect(()=>{if(ready)send('mute',{muted});},[ready,muted,session]);
 useEffect(()=>{if(tokens.current.hintToken===hintToken)return;tokens.current.hintToken=hintToken;callbacks.current.onStatus('出发前先看路线：紫色按钮打开距离最近的灰色通道；安全点补回 13 秒。灰色哨兵碰到后会把你送回起点，并开始追逐。提示不会改变位置或时间。');},[hintToken]);
 useEffect(()=>{if(tokens.current.undoToken===undoToken)return;tokens.current.undoToken=undoToken;callbacks.current.onStatus('实时滚动没有撤销；用上方“重来”重新开始本关。');},[undoToken]);
 const down=(event:PointerEvent<HTMLButtonElement>,code:string)=>{if(!ready||paused||pending.current||!event.isPrimary||event.button!==0)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);held.current.set(event.pointerId,code);send('key',{code,down:true});};
 const up=(event:PointerEvent<HTMLButtonElement>)=>{const code=held.current.get(event.pointerId);held.current.delete(event.pointerId);if(code)send('key',{code,down:false});if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);};
 return <section className="rollermaze-host" data-rollermaze-ready={ready} data-rollermaze-state={state?.state??'loading'}>
  <header><div><span>ROLLERMAZE · PICOSONIC</span><h3>十三秒，滚进下一片树林。</h3></div><b>25 张原版地图</b></header>
  <p>{INTRO}</p>
  <div className="rollermaze-stage"><span>第 {selected+1} / 25 关 · {state?.title??'准备中'}</span><strong>{state?.remaining===null?'就绪后出发':state?.remaining!==undefined?`${Math.ceil(state.remaining)} 秒`:'—'}</strong><span>已通过 {state?.cleared.length??cleared.current.length} / 25</span></div>
  <div className="rollermaze-frame-wrap"><iframe ref={frame} key={session} src={base.href} title="Rollermaze 原版游戏" sandbox="allow-scripts" allow="autoplay" referrerPolicy="no-referrer" tabIndex={paused?-1:0} aria-hidden={paused} style={{pointerEvents:paused||pending.current?'none':'auto'}} onLoad={()=>send('connect',{...flags.current,cleared:cleared.current,saved:saved.current})}/>{!ready&&!error&&<div className="rollermaze-cover">正在准备空中迷宫…</div>}</div>
  <div className="rollermaze-controls" role="group" aria-label="Rollermaze 触控方向">{controls.map(key=><button key={key.code} type="button" data-rollermaze-key={key.code} aria-label={key.label} disabled={!ready||paused||pending.current} onPointerDown={event=>down(event,key.code)} onPointerUp={up} onPointerCancel={event=>{up(event);send('cancel');}} onLostPointerCapture={up} onClick={event=>{if(event.detail===0&&ready&&!paused)send('tap',{code:key.code});}}>{key.text}</button>)}</div>
  <p className="rollermaze-instructions">按住方向键 / WASD 或下方方向按钮滚动。也可在画面上按住，朝上下左右拖动。松手停止接收下一步；R 重试本关。</p>
  {state?.state===2&&<p className="rollermaze-result" role="status">时间到了！稍后从起点重试，也可点击上方“重来”。</p>}
  {state?.ending&&<p className="rollermaze-result" role="status">{state.cleared.length===25?'25 张原版地图已全部完成！':`最后一关已完成；目前实际通过 ${state.cleared.length} / 25。可返回继续其他地图。`}</p>}
  {error&&<div className="rollermaze-error"><p role="alert">{error}</p><button onClick={()=>{setReady(false);setError('');setState(null);setAttempt(n=>n+1);}}>重试载入 Rollermaze</button></div>}
  {state&&!state.saved&&<p role="alert">浏览器未能保存本作记录。本次切关和重来仍保留已经完成的关卡；退出或刷新后只能恢复成功保存的记录。</p>}
  <details><summary>规则、保存与原作来源</summary>
   <p>你是一枚滚动的截半立方体。每次出发有 13 秒，抵达树林过关；安全点重置倒计时，紫色按钮升起最近的灰色通道。碰到灰色哨兵会回到起点，并把它唤醒；再次撞上已唤醒的哨兵只剩 1 秒。</p>
   <p>保留原版 25 张地图、移动尺度、计时、追逐速度、程序化 3D 模型和关卡动画。关卡可自由选择，只记录正常到达树林的通关。只保存已通过关卡；重来、切关或重新进入都会从本关起点开始。暂停会冻结逻辑时间、画面与声音。</p>
   <p>Jasper Renow-Clarke（picosonic）2024 年原作，固定版本 2a08f83，MIT 授权。MicroW 渲染器公共领域；关卡设计与测试感谢 Ethan 和 Amelie。没有打包第三方宣传图、原字形或 Schubert MIDI 编排；HUD 使用系统字体，短音效为本站原创。新增适配 GPL-3.0-only。</p>
   <p><a href="./games/rollermaze/LICENSE-MIT.txt" target="_blank" rel="noreferrer">完整原作许可</a> · <a href="./games/rollermaze/MicroW-PUBLIC-DOMAIN.md" target="_blank" rel="noreferrer">渲染器来源</a> · <a href="./games/rollermaze/PLAYGARDEN-COPYING.txt" target="_blank" rel="noreferrer">适配许可</a> · <a href="./games/rollermaze/source.tar.gz" download>本作模块源码与构建说明</a></p>
  </details>
 </section>;
}
