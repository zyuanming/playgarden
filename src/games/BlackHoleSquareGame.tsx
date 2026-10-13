// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useRef,useState} from 'react';
import type {GameProps} from '../lib/types';
import {REVISION,STORAGE,LEVELS,emptyData,copyData,parseData,parseSummary,type NativeData,type Summary} from '../../third_party/black-hole-square/bridge-src/contract';
import './blackHoleSquareGame.css';
type Launch={native:NativeData;saved:boolean;start:number};
type Owner={session:string;selected:number;native:NativeData;saved:boolean};
// Only the presently mounted game owns this short-lived copy. It carries actual
// native records across the keyed GameShell's level/reset remounts. Lobby exit
// clears it; it is never a source of platform completion badges.
let active:Owner|null=null;
function initialLaunch(selected:number,freshStart:boolean):Launch {
  if(active)return {native:copyData(active.native),saved:active.saved,start:selected+2};
  let native=emptyData(),saved=true;
  try {
    const raw=localStorage.getItem(STORAGE);
    if(raw!==null){
      if(raw.length>150000)throw new Error('Oversized native save');
      const parsed=parseData(JSON.parse(raw));if(!parsed)throw new Error('Invalid native save');native=parsed;
    }
  }catch{saved=false;}
  return {native,saved,start:!freshStart&&selected===0&&native.current===0?0:selected+2};
}
const INTRO='在原作 18 个谜题中，用有限的点击，把所有可移动方块送进黑洞。';
export default function BlackHoleSquareGame({level,paused,muted=false,freshStart=false,hintToken,undoToken,onComplete,onLevelChange,onStatus}:GameProps){
  const selected=Math.max(0,Math.min(17,Math.trunc(level)));
  const frame=useRef<HTMLIFrameElement>(null),[instance]=useState(()=>crypto.randomUUID());
  const [attempt,setAttempt]=useState(0),session=`${instance}-${attempt}`;
  const [launch,setLaunch]=useState<Launch>(()=>initialLaunch(selected,freshStart));
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[state,setState]=useState<Summary|null>(null);
  const native=useRef(copyData(launch.native)),saved=useRef(launch.saved),summary=useRef<Summary|null>(null);
  const callbacks=useRef({onComplete,onLevelChange,onStatus});callbacks.current={onComplete,onLevelChange,onStatus};
  const flags=useRef({paused,muted});flags.current={paused,muted};
  const pending=useRef(false),credited=useRef(false),tokens=useRef({hintToken,undoToken});
  const url=new URL('./games/black-hole-square/index.html',document.baseURI);
  url.searchParams.set('session',session);url.searchParams.set('level',String(selected));url.searchParams.set('start',String(launch.start));
  // The frame has an opaque origin. '*' is necessary for its destination;
  // every receiver validates this exact WindowProxy, nonce, source and version.
  const send=(type:string,extra:Record<string,unknown>={})=>frame.current?.contentWindow?.postMessage({source:'playgarden-host',session,type,...extra},'*');
  useEffect(()=>{
    const target=frame.current?.contentWindow;
    let authenticated=false,lastSave=0;
    const owner:Owner={session,selected,native:copyData(native.current),saved:saved.current};active=owner;
    const post=(type:string,extra:Record<string,unknown>={})=>target?.postMessage({source:'playgarden-host',session,type,...extra},'*');
    const connect=()=>post('connect',{...flags.current,native:native.current,saved:saved.current});
    setReady(false);setError('');pending.current=false;credited.current=false;
    const timer=window.setTimeout(()=>setError('游戏资源未能启动，请检查连接后重试。'),10000);
    const receive=(event:MessageEvent)=>{
      const data=event.data;
      if(event.source!==target||event.origin!=='null'||!data||data.source!=='playgarden-black-hole-square'||
          data.session!==session||data.revision!==REVISION)return;
      if(data.type==='loaded')connect();
      else if(data.type==='ready'){
        authenticated=true;clearTimeout(timer);setReady(true);setError('');post('mute',{muted:flags.current.muted});post('pause',{paused:flags.current.paused});
      }else if(data.type==='error'&&typeof data.message==='string'){
        clearTimeout(timer);setReady(false);setError(data.message.slice(0,180));
      }else if(data.type==='snapshot'){
        const value=parseSummary(data.state);if(value){summary.current=value;setState(value);}
      }else if(data.type==='save'&&Number.isInteger(data.saveId)&&data.saveId>lastSave){
        const value=parseData(data.native);if(!value)return;
        lastSave=data.saveId;native.current=value;owner.native=copyData(value);
        try{localStorage.setItem(STORAGE,JSON.stringify(value));saved.current=true;}catch{saved.current=false;}
        owner.saved=saved.current;post('save-ack',{saveId:lastSave,saved:saved.current});
      }else if(authenticated&&data.type==='complete'&&!pending.current&&!credited.current&&data.level===selected&&
          data.puzzle===LEVELS[selected][0]&&Number.isInteger(data.moves)&&data.moves>=1&&data.moves<=LEVELS[selected][1]){
        credited.current=true;callbacks.current.onComplete();
        callbacks.current.onStatus(`原作第 ${selected+1} 关 ${LEVELS[selected][0]} 已清空。跳关和观看结尾不会计为通关。`);
      }else if(authenticated&&data.type==='level'&&!pending.current&&Number.isInteger(data.level)&&data.level>=0&&data.level<18&&data.level!==selected){
        const value=parseData(data.native);
        if(!value||value.current!==data.level+2||typeof data.saved!=='boolean')return;
        if(!callbacks.current.onLevelChange){setError('宿主未能同步关卡选择，请重试。');return;}
        native.current=value;owner.native=copyData(value);owner.saved=saved.current;
        pending.current=true;post('cancel');callbacks.current.onLevelChange(data.level);
      }
    };
    // Focusing the owned iframe blurs the host window while the document still
    // has focus. Only leaving the document should cancel that first gesture.
    const cancel=()=>{if(!document.hasFocus())post('cancel');};
    window.addEventListener('message',receive);window.addEventListener('blur',cancel);
    connect();callbacks.current.onStatus(INTRO);
    return()=>{
      authenticated=false;clearTimeout(timer);post('dispose');
      window.removeEventListener('message',receive);window.removeEventListener('blur',cancel);
      // The sandbox's unload handler owns RAF/audio/input disposal as well.
      // Retain only through a synchronous keyed replacement, never lobby exit.
      queueMicrotask(()=>{if(active===owner)active=null;});
    };
  },[session,selected,launch]);
  useEffect(()=>{if(ready)send('pause',{paused});},[ready,paused,session]);
  useEffect(()=>{if(ready)send('mute',{muted});},[ready,muted,session]);
  useEffect(()=>{
    if(tokens.current.hintToken===hintToken)return;tokens.current.hintToken=hintToken;
    callbacks.current.onStatus('箭头推动自己和前方相连方块；X 点击后消失；灰色中子星点击后变成固定黑洞。先安排黑洞，再处理没有箭头的方块。提示不会移动棋盘。');
  },[hintToken]);
  useEffect(()=>{
    if(tokens.current.undoToken===undoToken)return;tokens.current.undoToken=undoToken;
    callbacks.current.onStatus('原作没有单步撤销。可用“重置谜题”重新尝试当前原始棋盘。');
  },[undoToken]);
  const command=(action:string)=>{if(ready&&!paused&&!pending.current)send('command',{action});};
  const solved=state?.solved.length??native.current.solved.length;
  return <section className="black-hole-square-host" data-black-hole-square-ready={ready} data-black-hole-square-puzzle={state?.puzzle??'loading'}>
    <header><div><span>BLACK HOLE SQUARE · QUINTEN CLAUSE</span><h3>让黑洞收走最后一块。</h3></div><b>18 个原版谜题</b></header>
    <p>{INTRO}</p>
    <p className="black-hole-square-stage">当前选择：{selected+1} / 18 · {LEVELS[selected][0]} · 原始限额 {LEVELS[selected][1]} 步 · 已清空 {solved} / 18</p>
    <div className="black-hole-square-frame-wrap">
      <iframe key={session} ref={frame} src={url.href} title="Black Hole Square 原版游戏" sandbox="allow-scripts" allow="autoplay" referrerPolicy="no-referrer"
        tabIndex={paused?-1:0} aria-hidden={paused} style={{pointerEvents:paused||pending.current?'none':'auto'}}
        onLoad={()=>send('connect',{...flags.current,native:native.current,saved:saved.current})}/>
      {!ready&&!error&&<div className="black-hole-square-cover">正在准备原版游戏…</div>}
    </div>
    <div className="black-hole-square-controls" role="group" aria-label="Black Hole Square 导航">
      <button type="button" disabled={!ready||paused||pending.current} onClick={()=>command('previous')}>上一页</button>
      <button type="button" disabled={!ready||paused||pending.current} onClick={()=>command('reset')}>重置谜题</button>
      <button type="button" disabled={!ready||paused||pending.current} onClick={()=>command('next')}>下一页 / 跳过</button>
    </div>
    <p className="black-hole-square-instructions">点击方块激活；左右滑动可跳过、返回或重置。棋盘获得焦点后，方向键选择格子，回车或空格激活；R 重置，PageUp / PageDown 翻页。首次用“下一页”浏览原版标题和说明。</p>
    {state?.ending&&<p className="black-hole-square-ending" role="status">{solved===18?'18 个原版谜题已全部实际清空。谢谢游玩！':`已来到原版结尾；实际清空 ${solved} / 18。可以返回继续未解谜题。`}</p>}
    {error&&<div className="black-hole-square-error"><p role="alert">{error}</p><button type="button" onClick={()=>{
      setLaunch({native:copyData(native.current),saved:saved.current,start:summary.current?.current??launch.start});
      setReady(false);setError('');setState(null);summary.current=null;setAttempt(value=>value+1);
    }}>重试载入 Black Hole Square</button></div>}
    {state&&!state.saved&&<p role="alert">浏览器未能保存本作记录；本次切关和重置仍保留已取得的通关。退出本作或刷新后，只能恢复成功保存的记录。</p>}
    <details><summary>规则、保存与原作来源</summary>
      <p>箭头推动相连方块，黑洞吞掉最前一块；X 点击后消失，中子星点击后成为固定黑洞。普通方块只能被推动。每关必须在原始步数内移除所有可移动方块；失败会反馈并重置。原作没有单步撤销。</p>
      <p>保留全部 18 张 6×6 原地图、原步数、几何画面、星空、音效与结尾。关卡可自由跳过，也可以点击棋盘下方进度点。平台只记录实际清空，看到结尾不等于解完 18 关。</p>
      <p>保存当前选择、已清空关卡和成功解法的点击序列；成功解法每关最多保留 64 种。重新进入或切关从原始棋盘开始，不保存未完成的中途局面。平台关卡选择与通关徽章单独保存。</p>
      <p>暂停冻结画面、逻辑时间和声音，恢复后不追赶后台时间。启用声音后点击棋盘，可听到原作本地合成音效。</p>
      <p>Quinten Clause 原作固定版本 8d48aae（2024）；原引擎、地图、矢量画面与合成音符保留 MIT 授权。标题使用 Gugi 的轮廓，字体来源按 SIL OFL 1.1 注明；没有下载或打包字体文件。新增宿主与适配为 GPL-3.0-only。</p>
      <p><a href="./games/black-hole-square/LICENSE-MIT.txt" target="_blank" rel="noreferrer">原作许可</a> · <a href="./games/black-hole-square/Gugi-OFL.txt" target="_blank" rel="noreferrer">标题字体许可来源</a> · <a href="./games/black-hole-square/PLAYGARDEN-COPYING.txt" target="_blank" rel="noreferrer">适配许可</a> · <a href="./games/black-hole-square/source.tar.gz" download>本作模块源码与构建说明</a></p>
    </details>
  </section>;
}
