// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import './aDarkRoomOriginal.css';
type Snapshot = { module: string; title: string; finished: boolean; ending: { count: number; total: number } | null; storageAvailable: boolean };
export default function ADarkRoomOriginal({paused, freshStart, hintToken, onStatus}:GameProps){
  const frame=useRef<HTMLIFrameElement>(null),callbacks=useRef({onStatus}),flags=useRef({paused}),hint=useRef(hintToken),done=useRef(false);
  callbacks.current={onStatus};flags.current={paused};
  const session=useMemo(()=>crypto.randomUUID(),[]);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[height,setHeight]=useState(720),[snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const src=useMemo(()=>{const u=new URL('./adr-original/index.html',document.baseURI);u.searchParams.set('session',session);if(freshStart)u.searchParams.set('restart','1');return u.href;},[session,freshStart]);
  useEffect(()=>{
    const target=frame.current?.contentWindow;
    const send=(type:string,extra:Record<string,unknown>={})=>target?.postMessage({source:'playgarden-host',session,type,...extra},location.origin);
    callbacks.current.onStatus('从生火开始，逐渐建立村落、探索荒野，修好飞船并离开。这是一段有结局的完整战役，随时可以暂停。');
    const receive=(e:MessageEvent)=>{
      if(e.origin!==location.origin||e.source!==target||e.data?.source!=='playgarden-adr'||e.data.session!==session)return;
      const d=e.data;
      if(d.type==='ready'){
        if(d.revision!=='adr-d6d1c1b-playgarden-1'||d.campaign!==true||d.finiteLevels!==0){setError('战役资源版本不匹配，请重试。');return;}
        setReady(true);send('pause',{paused:flags.current.paused});
      }else if(d.type==='height'&&Number.isFinite(d.height))setHeight(Math.min(1000,Math.max(560,d.height)));
      else if(d.type==='snapshot'){setSnapshot(d.state);if(!d.state.finished)done.current=false;}
      else if(d.type==='status'&&typeof d.message==='string')callbacks.current.onStatus(d.message);
      else if(d.type==='error')setError('游戏暂时遇到问题：'+String(d.message));
      else if(d.type==='complete'&&!done.current){done.current=true;callbacks.current.onStatus(`已穿过大气层，完成这段旅程。本次得分 ${d.score}，累计 ${d.total}；下一周目的继承资源已保存。`);}
    };
    window.addEventListener('message',receive);
    return()=>{(target as (Window&{__adrDispose?:()=>void})|null)?.__adrDispose?.();send('dispose');window.removeEventListener('message',receive);};
  },[session]);
  useEffect(()=>{if(ready)frame.current?.contentWindow?.postMessage({source:'playgarden-host',session,type:'pause',paused},location.origin);},[ready,paused,session]);
  useEffect(()=>{if(hint.current===hintToken)return;hint.current=hintToken;callbacks.current.onStatus('先维持火势，给陌生人时间恢复；村落建立后安排岗位。出发前带足熏肉和水，探索带回的资源可用于改装飞船。');},[hintToken]);
  return <section className="adr-game" data-adr-ready={ready} data-adr-module={snapshot?.module??'loading'} data-adr-finished={snapshot?.finished??false}>
    <header className="adr-heading"><div><span>A DARK ROOM · 2020 完整战役</span><h3>从一簇火光，到星海之外</h3></div><b>完整战役 · 可通关</b></header>
    <p>点火、建造、分配村民，再带着补给踏入荒野。进度会自动保存；“重来”会先让你确认。探索与飞行都有方向键和触屏按钮。</p>
    {snapshot?.finished&&<p className="adr-victory" role="status">这段旅程完成了！可以查看原作结局，或开始继承资源的新旅程。</p>}
    {snapshot?.ending&&<p className="adr-record">已完成 {snapshot.ending.count} 次旅程 · 累计得分 {snapshot.ending.total}</p>}
    {snapshot&&!snapshot.storageAvailable&&<p role="alert">浏览器未允许保存。当前进度仅在本次页面内保留，可用游戏里的“保存”导出备份。</p>}
    <div className="adr-frame-wrap" style={{height}}><iframe ref={frame} src={src} title="A Dark Room 小黑屋完整战役" tabIndex={paused?-1:0} aria-hidden={paused}/>{!ready&&!error&&<p className="adr-cover" role="status">正在准备本地战役…</p>}</div>
    {error&&<p role="alert">{error}</p>}
    <details className="adr-help"><summary>游玩、保存与版本说明</summary>
      <p>完整保留房间、村落、61×61世界、全部事件与九种武器，以及造船、升空和真正结局。世界地图可在框内滚动；飞行按住方向移动，松开停止。暂停和离开窗口会冻结时间，返回大厅会保存并卸载游戏。</p>
      <p>游戏内“保存”可导出或导入此2020版的本地存档；只接受原v1.3数据格式。导入不合法内容会保留已有进度。“重新开始”仅重开本游戏并保留原作的下一周目继承，其他游戏存档不受影响。</p>
      <p>固定原作2020年8月16日版本 d6d1c1b，本版本原本无音频。保留当时的完整玩法，不包含后来的新增内容。它是一段长战役，没有人为编号关卡，也不计为纯无尽游戏。</p>
      <p>Michael Townsend、doublespeak games 与贡献者，MPL-2.0；本站保留对应完整源码及修改说明，另含本地 jQuery 3.7.1 与 Color 2.1.2（MIT）。<a href="./adr-original/LICENSES.txt" target="_blank" rel="noreferrer">原作与依赖许可</a>。</p>
    </details>
  </section>;
}
