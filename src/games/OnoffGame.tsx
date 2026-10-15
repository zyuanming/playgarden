// SPDX-License-Identifier: GPL-3.0-only
import {useEffect, useRef, useState} from 'react';
import type {GameProps} from '../lib/types';
import './onoffGame.css';
const REVISION='onoff-cb1e2e4-playgarden-1';
const INTRO='在明暗两层之间切换，跳过深坑和尖刺，抵达每关的星星。';
type Summary={level:number;total:number;ready:boolean;paused:boolean;disposed:boolean;won:boolean;deaths:number;on:boolean;phase:string};
function valid(value:unknown):value is Summary {
  if(!value||typeof value!=='object')return false;
  const s=value as Summary;
  return Number.isInteger(s.level)&&s.level>=0&&s.level<25&&s.total===25&&
    [s.ready,s.paused,s.disposed,s.won,s.on].every(x=>typeof x==='boolean')&&
    Number.isSafeInteger(s.deaths)&&s.deaths>=0&&['playing','dying','complete'].includes(s.phase);
}
export default function OnoffGame({level,paused,muted=true,hintToken,undoToken,onComplete,onStatus}:GameProps){
  const selected=Math.max(0,Math.min(24,Math.trunc(level)));
  const frame=useRef<HTMLIFrameElement>(null);
  const [instance]=useState(()=>crypto.randomUUID()),[attempt,setAttempt]=useState(0);
  const session=`${instance}-${attempt}`;
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[state,setState]=useState<Summary|null>(null);
  const flags=useRef({paused,muted});flags.current={paused,muted};
  const callbacks=useRef({onComplete,onStatus});callbacks.current={onComplete,onStatus};
  const tokens=useRef({hintToken,undoToken});
  const url=new URL('./games/onoff/index.html',document.baseURI);
  url.searchParams.set('session',session);url.searchParams.set('level',String(selected));
  const send=(type:string,extra:Record<string,unknown>={})=>frame.current?.contentWindow?.postMessage({source:'playgarden-host',session,type,...extra},'*');
  useEffect(()=>{
    const target=frame.current?.contentWindow;
    let authenticated=false,credited=false,alive=true;
    const post=(type:string,extra:Record<string,unknown>={})=>target?.postMessage({source:'playgarden-host',session,type,...extra},'*');
    const connect=()=>post('connect',flags.current);
    setReady(false);setError('');setState(null);
    const timer=window.setTimeout(()=>{if(alive)setError('游戏资源未能启动，请检查连接后重试。');},10000);
    const receive=(event:MessageEvent)=>{
      const data=event.data;
      if(!alive||event.source!==target||event.origin!=='null'||!data||data.source!=='playgarden-onoff'||data.session!==session||data.revision!==REVISION)return;
      if(data.type==='loaded')connect();
      else if(data.type==='ready'){authenticated=true;clearTimeout(timer);setReady(true);setError('');post('pause',{paused:flags.current.paused});post('mute',{muted:flags.current.muted});}
      else if(data.type==='snapshot'&&valid(data.state)&&data.state.level===selected)setState(data.state);
      else if(data.type==='error'&&typeof data.message==='string'){clearTimeout(timer);setError(data.message.slice(0,180));setReady(false);}
      else if(authenticated&&data.type==='complete'&&data.level===selected&&!credited){
        credited=true;callbacks.current.onComplete();callbacks.current.onStatus(`ONOFF 原作第 ${selected+1} 关已抵达星星。${selected===24?'这是最后一关；平台只标记实际完成的关卡。':'可用宿主的下一关继续。'}`);
      }
    };
    const cancel=()=>{if(!document.hasFocus())post('cancel');};
    window.addEventListener('message',receive);window.addEventListener('blur',cancel);
    connect();callbacks.current.onStatus(INTRO);
    return()=>{alive=false;authenticated=false;clearTimeout(timer);post('dispose');window.removeEventListener('message',receive);window.removeEventListener('blur',cancel);};
  },[session,selected]);
  useEffect(()=>{if(ready)send('pause',{paused});},[ready,paused,session]);
  useEffect(()=>{if(ready)send('mute',{muted});},[ready,muted,session]);
  useEffect(()=>{if(tokens.current.hintToken===hintToken)return;tokens.current.hintToken=hintToken;
    callbacks.current.onStatus('亮色与暗色的平台、尖刺只在对应层生效。切层会让脚下平台消失；先起跳，再选择安全的时机切层。按住跳跃会在落地后再次起跳。');},[hintToken]);
  useEffect(()=>{if(tokens.current.undoToken===undoToken)return;tokens.current.undoToken=undoToken;
    callbacks.current.onStatus('原作没有单步撤销。碰到尖刺或掉出画面会自动回到本关起点，也可按 R 或重试本关。');},[undoToken]);
  return <section className="onoff-host" data-onoff-ready={ready}>
    <header><div><span>ONOFF · MARINO & DUNBAR</span><h3>让另一层，成为落脚点。</h3></div><b>25 个原版关卡</b></header>
    <p>{INTRO}</p>
    <p className="onoff-summary">第 {selected+1} / 25 关 · {state?.on===false?'暗层':'明层'}实体 · 本次重试 {state?.deaths??0} 次{state?.won?' · 已抵达星星':''}</p>
    <div className="onoff-frame-wrap"><iframe key={session} ref={frame} src={url.href} title="ONOFF 原版游戏" sandbox="allow-scripts" allow="autoplay; gamepad" referrerPolicy="no-referrer" tabIndex={paused?-1:0} aria-hidden={paused}
      style={{pointerEvents:paused?'none':'auto'}} onLoad={()=>send('connect',flags.current)}/>
      {!ready&&!error&&<div className="onoff-loading">正在准备明暗世界…</div>}
    </div>
    <div className="onoff-actions"><button type="button" disabled={!ready||paused} onClick={()=>send('command',{action:'reset'})}>重试本关</button><span>← / → 或 A / D 移动 · ↑ / W 跳跃 · 空格切层</span></div>
    <p>触屏：按住画面下方方向键移动，配合“跳跃”和“切层”；可同时按住多个按钮。操作画面获得焦点后也支持键盘。按 R 重试。</p>
    {error&&<div className="onoff-error"><p role="alert">{error}</p><button type="button" onClick={()=>{setReady(false);setError('');setAttempt(n=>n+1);}}>重试载入 ONOFF</button></div>}
    <details><summary>原版规则、关卡与来源</summary>
      <p>保留全部 25 个关卡、碰撞与切层规则、角色和矢量画面、数字字形、两段背景音乐、通关音乐与合成音效。原作第 12、14、17 关含随机布局；重新载入本作时会重新生成，暂停不会改变布局。</p>
      <p>关卡可以自由选择。只有角色实际触碰星星才记为本关通关；选择最后一关不会记为完成前面的关卡。平台保存所选关卡与真实通关标记；不保存中途位置和本次重试次数。</p>
      <p>暂停会冻结物理、过场、动画和声音，恢复后不追赶后台时间。先开启宿主声音，再点击游戏或按游戏键，可听到原版音乐。键盘、触屏与标准手柄共用同一套原版动作。</p>
      <p>ONOFF 原作 © 2018 Daniel Marino 与 Brad Dunbar，固定版本 cb1e2e4，MIT。TinyMusic © 2014 Kevin Ennis，MIT。美术、字形和曲谱为作者自制，不加载外部图片、字体或音频。新增宿主与适配为 GPL-3.0-only。原关卡编辑器保留在源码包中，本站提供完整原版闯关模式。</p>
      <p><a href="./games/onoff/LICENSE-MIT.txt" target="_blank" rel="noreferrer">原作许可</a> · <a href="./games/onoff/TinyMusic-MIT.txt" target="_blank" rel="noreferrer">TinyMusic 许可</a> · <a href="./games/onoff/PLAYGARDEN-COPYING.txt" target="_blank" rel="noreferrer">适配许可</a> · <a href="./games/onoff/source.tar.gz" download>本作源码与构建说明</a></p>
    </details>
  </section>;
}
