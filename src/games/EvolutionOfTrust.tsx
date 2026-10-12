// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import './evolutionOfTrust.css';

type Snapshot = { chapter:string; slide:number; totalSlides:number; visited:number; complete:boolean; paused:boolean; muted:boolean; transitioning:boolean };
export default function EvolutionOfTrust(props:GameProps) {
  return <TrustRound key={props.resetToken} {...props}/>;
}
function TrustRound({paused,muted,hintToken,onStatus,onComplete}:GameProps) {
  const frame=useRef<HTMLIFrameElement>(null), epoch=useRef(0), hints=useRef(hintToken);
  const latest=useRef({paused,muted,onStatus,onComplete});latest.current={paused,muted,onStatus,onComplete};
  const session=useMemo(()=>crypto.randomUUID(),[]);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const completed=useRef(false);
  const src=useMemo(()=>{const url=new URL('./evolution-of-trust/index.html',document.baseURI);url.searchParams.set('session',session);return url.href;},[session]);
  const send=(type:string,extra:Record<string,unknown>={})=>frame.current?.contentWindow?.postMessage({source:'playgarden-host',session,type,...extra},location.origin);
  useLayoutEffect(()=>{
    const version=++epoch.current,target=frame.current?.contentWindow;let alive=true,announced=false;
    const init=()=>target?.postMessage({source:'playgarden-host',session,type:'init',paused:latest.current.paused,muted:latest.current.muted??true},location.origin);
    let loadingMilliseconds=0;
    const repeat=window.setInterval(()=>{
      if(!latest.current.paused)loadingMilliseconds+=750;
      if(loadingMilliseconds>=30000&&!announced)setError('资源载入超时，请点击顶部“重来”重试。');
      target?.postMessage({source:'playgarden-host',session,type:'hello'},location.origin);
    },750);
    const receive=(event:MessageEvent)=>{
      const d=event.data;
      if(!alive||event.source!==target||event.origin!==location.origin||d?.source!=='playgarden-trust'||d.session!==session)return;
      if(d.type==='hello')init();
      else if(d.type==='ready'){
        if(d.revision!=='trust-6ec45d7-playgarden-1'||d.finiteLevels!==0){setError('游戏资源版本不一致，请重新进入。');return;}
        if(announced)return;announced=true;clearInterval(repeat);setReady(true);setError('');
        target?.postMessage({source:'playgarden-host',session,type:'pause',paused:latest.current.paused},location.origin);
      }else if(d.type==='snapshot'&&d.state&&typeof d.state.chapter==='string'&&d.state.chapter.length<40&&Number.isInteger(d.state.slide)&&d.state.slide>=-1&&d.state.slide<200&&Number.isInteger(d.state.totalSlides)&&d.state.totalSlides>0&&d.state.totalSlides<200&&Number.isInteger(d.state.visited)&&d.state.visited>=0&&d.state.visited<=d.state.totalSlides){
        setSnapshot({chapter:d.state.chapter,slide:d.state.slide,totalSlides:d.state.totalSlides,visited:d.state.visited,complete:d.state.complete===true,paused:d.state.paused===true,muted:d.state.muted===true,transitioning:d.state.transitioning===true});
      }else if(d.type==='complete'&&!completed.current){completed.current=true;latest.current.onComplete();latest.current.onStatus('完整互动旅程已走完！可以用章节圆点重看，或进入沙盒继续实验。');}
      else if(d.type==='status'&&typeof d.message==='string')latest.current.onStatus(d.message.slice(0,400));
      else if(d.type==='error'&&typeof d.message==='string')setError(d.message.slice(0,300));
    };
    window.addEventListener('message',receive);init();
    latest.current.onStatus('合作还是背叛？用真实选择观察对手，再试试改变重复次数、收益和失误概率。手机下方有大字说明与触控操作。');
    return()=>{
      alive=false;clearInterval(repeat);window.removeEventListener('message',receive);
      // StrictMode replays effects on the same iframe. Only a real removal
      // disposes that document; a replay establishes its new listener first.
      queueMicrotask(()=>{if(epoch.current!==version)return;(target as (Window&{__trustDispose?:()=>void})|null)?.__trustDispose?.();});
    };
  },[session]);
  useEffect(()=>{send('pause',{paused});},[paused,ready,session]);
  useEffect(()=>{if(ready&&typeof muted==='boolean')send('mute',{muted});},[muted,ready,session]);
  useEffect(()=>{if(hints.current===hintToken)return;hints.current=hintToken;send('hint');},[hintToken]);
  return <section className="trust-game" data-trust-ready={ready} data-trust-complete={snapshot?.complete??false} data-trust-chapter={snapshot?.chapter??'loading'} data-trust-visited={snapshot?.visited??0}>
    <header><div><span>THE EVOLUTION OF TRUST</span><h3>信任的进化</h3></div><b>合作 · 博弈 · 演化</b></header>
    <p>为什么信任会出现，又为什么会消失？保留原作完整互动旅程、八种策略和自由沙盒，用自己的选择寻找答案。</p>
    <div className="trust-frame"><iframe ref={frame} src={src} title="信任的进化完整互动旅程" tabIndex={paused?-1:0} aria-hidden={paused}/>{!ready&&!error&&<p className="trust-loading" role="status">正在准备原作图像、音乐与互动模型…</p>}</div>
    {error&&<p className="trust-error" role="alert">{error}</p>}
    <details><summary>玩法、原作与许可</summary>
      <p>先决定合作或背叛，经历 25 次重复博弈，观察不同策略的循环赛和代际演化。沙盒可以改变 25 名玩家的策略比例、四种收益、重复回合、淘汰人数和失误概率。原作规则、随机性、动画速度和结局均保留。</p>
      <p>底部圆点可自由重看章节。重来会从开场重新开始，原作没有逐回合存档；本站只记录完整旅程完成情况。这是一部有结局的互动作品，没有人为编号关卡。声音会跟随大厅设置，也可在游戏内切换。</p>
      <p>原作 Nicky Case，中文翻译吴桐、唐鳳，均明确采用 CC0。保留许可明确的原画和九段音轨；七段音效与和平示意插图为本站独立制作，字体采用系统字体。依赖保留各自 MIT、Apache-2.0、ISC、BSD 与 CC0 声明；本站宿主及新增适配 GPL-3.0-only。</p>
      <p><a href="./evolution-of-trust/NOTICE.txt" target="_blank" rel="noreferrer">完整许可与来源</a> · <a href="./evolution-of-trust/source.zip" download>对应源码与修改说明</a> · <a href="https://github.com/ncase/trust/tree/6ec45d73befdb922bd40654dd1c1c903a953562f" target="_blank" rel="noreferrer">固定版本原作</a></p>
    </details>
  </section>;
}
