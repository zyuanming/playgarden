// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import './gridlandOriginal.css';
type Snapshot={started:boolean;day?:number;level?:number;health?:number;maxHealth?:number;night?:boolean;finished?:boolean;storageAvailable:boolean;counts?:{DRAGONS?:number}};
export default function GridlandOriginal({paused,hintToken,onStatus}:GameProps){
  const frame=useRef<HTMLIFrameElement>(null),callback=useRef(onStatus),flags=useRef({paused}),hint=useRef(hintToken);
  callback.current=onStatus;flags.current={paused};
  const session=useMemo(()=>crypto.randomUUID(),[]),[ready,setReady]=useState(false),[error,setError]=useState(''),[snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const src=useMemo(()=>{const u=new URL('./gridland-original/index.html',document.baseURI);u.searchParams.set('session',session);return u.href;},[session]);
  useEffect(()=>{
    const target=frame.current?.contentWindow;let announced=false,retry=0;
    const send=(type:string,data:Record<string,unknown>={})=>target?.postMessage({source:'playgarden-host',session,type,...data},location.origin);
    const receive=(e:MessageEvent)=>{if(e.origin!==location.origin||e.source!==target||e.data?.source!=='playgarden-gridland'||e.data.session!==session)return;const d=e.data;
      if(d.type==='ready'){if(announced)return;if(d.revision!=='gridland-06af02c-playgarden-1'||d.campaign!==true||d.finiteLevels!==0){setError('游戏资源版本不匹配，请重新进入。');return;}announced=true;clearInterval(retry);setReady(true);send('pause',{paused:flags.current.paused});}
      else if(d.type==='snapshot'&&d.state&&typeof d.state.started==='boolean')setSnapshot(d.state);
      else if(d.type==='error')setError(String(d.message));
      else if(d.type==='status'&&typeof d.message==='string')callback.current(d.message);
      else if(d.type==='complete'&&Number.isFinite(d.dragons)&&d.dragons>0)callback.current(`屠龙成功！已击败 ${d.dragons} 条巨龙。可继续村落，或在原作结局选择新游戏＋。`);
    };
    window.addEventListener('message',receive);retry=window.setInterval(()=>send('hello'),800);send('hello');
    callback.current('交换相邻方块组成三连。白天收集、建造，夜晚靠匹配装备抵挡怪物，最终召唤并击败巨龙。');
    return()=>{clearInterval(retry);window.removeEventListener('message',receive);(target as (Window&{__gridlandDispose?:()=>void})|null)?.__gridlandDispose?.();};
  },[session]);
  useEffect(()=>{if(ready)frame.current?.contentWindow?.postMessage({source:'playgarden-host',session,type:'pause',paused},location.origin);},[paused,ready,session]);
  useEffect(()=>{if(hint.current===hintToken)return;hint.current=hintToken;callback.current('白天匹配麦穗回血，木材、石块和其他材料用于建造；可点建筑指定优先级。夜晚木材补盾、石块补剑，其余匹配会引来怪物。稳住血量后再增加敌人。');},[hintToken]);
  return <section className="gridland-game" data-gridland-ready={ready} data-gridland-finished={!!snapshot?.finished}>
    <header><div><span>GRIDLAND · 原作完整战役</span><h3>格境求生</h3></div><b>{snapshot?.started?`第 ${snapshot.day} 天 · ${snapshot.night?'夜晚':'白天'}`:'匹配 · 建造 · 生存'}</b></header>
    <p>相邻交换组成三连，发展村落、积攒装备，最终迎战巨龙。支持连续点选两格，或从一格滑向相邻格。</p>
    {snapshot?.started&&<p className="gridland-stats">等级 {snapshot.level} · 生命 {snapshot.health} / {snapshot.maxHealth}{snapshot.finished?` · 已屠龙 ${snapshot.counts?.DRAGONS??0} 次`:''}</p>}
    {snapshot&&!snapshot.storageAvailable&&<p role="alert">浏览器暂不能保存；可在原作存档界面导出，本次离开前请保存副本。</p>}
    <div className="gridland-frame"><iframe ref={frame} src={src} title="格境求生 Gridland 完整战役" tabIndex={paused?-1:0} aria-hidden={paused}/>{!ready&&!error&&<p role="status">正在加载本地村落…</p>}</div>
    {error&&<p role="alert">{error}</p>}
    <details><summary>操作、存档与原作说明</summary><p>白天的三连带来材料，工人自动搬运和建造。夜晚敌人实时行动：木材补盾、石块补剑，其他资源会召来不同怪物。积攒碎片可解锁魔法；巫妖可能掉落召龙道具。原作标准与休闲两种难度均保留。</p><p>原作在黎明等关键时刻自动保存村落进度；不会恢复夜战中每个怪物和方块的位置。“重来”返回三槽存档选择；删除已有存档需要游戏内确认，其他游戏不受影响。原作导入、导出、新游戏＋均保留。</p><p>这是一段可屠龙通关的完整战役，没有人为编号关卡。原作 Michael Townsend / doublespeak games，固定版本 06af02c，代码与原美术 MPL-2.0；本适配静音游玩。<a href="./gridland-original/LICENSES.txt" target="_blank" rel="noreferrer">原作与依赖许可证</a>。</p></details>
  </section>;
}
