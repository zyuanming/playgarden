// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import { activeVisitors, advanceTap, bloomTapLevels, loadTap, newTapRound, pickVisitor, saveTap, tapEnd, tapMisses, type TapRound } from './bloomTapLogic';
import './bloomTapGarden.css';
function Flower({ bug = false }: { bug?: boolean }) {
  return <svg viewBox="0 0 100 100" aria-hidden="true" className="bt-visitor">
    {bug ? <><path d="M22 35L12 25M78 35L88 25M20 55H7M80 55H93M25 77L13 88M75 77L87 88" stroke="#254538" strokeWidth="5" strokeLinecap="round" /><ellipse cx="50" cy="56" rx="30" ry="34" fill="#d65a50" stroke="#254538" strokeWidth="3" /><circle cx="50" cy="23" r="15" fill="#254538" /><path d="M50 27V89" stroke="#254538" strokeWidth="3" />{[[34,45],[66,45],[33,66],[67,66]].map(([cx,cy])=><circle key={`${cx}`} cx={cx} cy={cy} r="5" fill="#254538" />)}<circle cx="44" cy="19" r="3" fill="white"/><circle cx="56" cy="19" r="3" fill="white"/></> : <><path d="M50 66V94M50 84Q26 90 28 74Q45 72 50 84" fill="#6f9b64" stroke="#477c4d" strokeWidth="4" />{[0,60,120,180,240,300].map(a=><ellipse key={a} cx="50" cy="25" rx="12" ry="21" fill="#f7bd6b" stroke="#bf7d3d" strokeWidth="1.5" transform={`rotate(${a} 50 45)`}/>)}<circle cx="50" cy="45" r="16" fill="#fff0b2" stroke="#bf7d3d" strokeWidth="2"/><circle cx="45" cy="43" r="2" fill="#6c542b"/><circle cx="55" cy="43" r="2" fill="#6c542b"/><path d="M45 50Q50 54 55 50" fill="none" stroke="#6c542b" strokeWidth="2"/></>}
  </svg>;
}
export default function BloomTapGarden(props: GameProps) { return <BloomTapRound key={`${props.level}:${props.resetToken}`} {...props} />; }
function BloomTapRound({ level, paused, freshStart, hintToken, undoToken, onComplete, onStatus }: GameProps) {
  const p = bloomTapLevels[level] ?? bloomTapLevels[0];
  const [state, setState] = useState(() => freshStart ? newTapRound() : loadTap(p, level));
  const [held, setHeld] = useState(state.phase === 'playing'), [pace, setPace] = useState(.75), [saved, setSaved] = useState(true);
  const live = useRef(state), blocked = useRef(paused || held), paceRef = useRef(pace), heldRef = useRef(held);
  const callbacks = useRef({ onComplete, onStatus }); callbacks.current = { onComplete, onStatus }; blocked.current = paused || held; paceRef.current = pace;
  const tokens = useRef({ hintToken, undoToken }), board = useRef<HTMLDivElement>(null), notified = useRef(false);
  const active = activeVisitors(p, state), mistakes = tapMisses(p, state), locked = paused || held || state.phase !== 'playing';
  const persist = () => setSaved(saveTap(p, level, live.current));
  function commit(next: TapRound) { live.current = next; setState(next); }
  function hold() { if (live.current.phase !== 'playing') return; heldRef.current = true; blocked.current = true; setHeld(true); persist(); }
  function start() { if (paused || document.hidden) return; notified.current = false; heldRef.current = false; setHeld(false); blocked.current = false; commit({ ...newTapRound(), phase: 'playing' }); board.current?.focus({ preventScroll: true }); callbacks.current.onStatus(p.lesson); }
  function resume() { if (paused || document.hidden) return; heldRef.current = false; setHeld(false); blocked.current = false; board.current?.focus({ preventScroll: true }); }
  function pick(hole: number) {
    if (blocked.current || document.hidden || live.current.phase !== 'playing') return;
    const index = activeVisitors(p, live.current).find(i => p.visitors[i].hole === hole);
    if (index === undefined) return;
    const next = pickVisitor(p, live.current, index); commit(next); persist();
    callbacks.current.onStatus(p.visitors[index].kind === 'flower' ? `收好第 ${next.caught.length} 朵花。留意下一位来客。` : '这位是瓢虫朋友。下次先看花瓣，让红衣朋友自己离开。');
  }
  useEffect(() => { callbacks.current.onStatus(p.lesson); return () => { saveTap(p, level, live.current); }; }, [p, level]);
  useEffect(() => { if (paused) persist(); }, [paused]);
  useEffect(() => {
    const hide = () => { if (document.hidden) hold(); };
    document.addEventListener('visibilitychange', hide); window.addEventListener('blur', hold);
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('blur', hold); };
  }, []);
  useEffect(() => {
    let frame = 0, last: number | undefined, lastPaint = 0, lastSave = 0, alive = true;
    const tick = (now: number) => {
      if (!alive) return;
      if (blocked.current || document.hidden || live.current.phase !== 'playing') last = undefined;
      else {
        const dt = last === undefined ? 0 : (now-last)/1000; last=now;
        if (dt > .25) { hold(); last=undefined; }
        else if (dt > 0) {
          const before=live.current, next=advanceTap(p,before,dt*paceRef.current); live.current=next;
          if (next.phase!==before.phase || now-lastPaint>=30) { setState(next);lastPaint=now; }
          if (now-lastSave>=1000 || next.phase!==before.phase) { setSaved(saveTap(p,level,next));lastSave=now; }
        }
      }
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick); return ()=>{alive=false;cancelAnimationFrame(frame);};
  }, [p,level]);
  useEffect(() => {
    if(state.phase==='won'&&!paused&&!notified.current){notified.current=true;callbacks.current.onStatus(`花信收齐了！收好 ${state.caught.length} 朵，完成本关。`);callbacks.current.onComplete();}
    if(state.phase==='lost')callbacks.current.onStatus('这轮还有一点遗憾。按“再试这轮”，或先换成悠闲速度。');
  },[state.phase,paused]);
  useEffect(()=>{
    if(tokens.current.hintToken!==hintToken)callbacks.current.onStatus(`${p.lesson} 花瓣是收花标记，红色带黑点的是瓢虫。暂停时可以先观察。`);
    if(tokens.current.undoToken!==undoToken)callbacks.current.onStatus('实时快拍不能撤销时间，可以重新开始这一轮。');
    tokens.current={hintToken,undoToken};
  },[hintToken,undoToken,p]);
  return <section className="bloom-tap" data-bloom-tap data-phase={state.phase} data-time={state.time.toFixed(3)} data-caught={state.caught.length} data-mistakes={mistakes} data-held={held} onKeyDownCapture={e=>{if(e.repeat && (e.key==='Enter'||e.key===' '))e.preventDefault();}}>
    <div className="bt-play"><header className="bt-heading"><div><span>LET THE GARDEN SAY HELLO</span><h3>{p.title}</h3></div><b>{level+1}<small> / {bloomTapLevels.length}</small></b></header><p className="bt-lesson">{p.lesson}</p>
      <div className="bt-stats"><span>花信 <b>{state.caught.length} / {p.goal}</b></span><span>失误 <b>{mistakes} / {p.mistakes}</b></span><span>{paused||held?'已暂停':state.phase==='ready'?'准备好再开始':state.phase==='playing'?'轻点，不连点':state.phase==='won'?'花信收齐 ✓':'可以再试'}</span></div>
      <div className="bt-progress" role="progressbar" aria-label="本轮进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.time/tapEnd(p)*100)}><span style={{width:`${state.time/tapEnd(p)*100}%`}}/></div>
      <div className="bt-grid" ref={board} tabIndex={0} role="group" aria-label="九格花田，数字键1到9对应从左到右、从上到下" onKeyDown={e=>{if(/^[1-9]$/.test(e.key)&&!e.repeat&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();pick(Number(e.key)-1);}}}>
        {Array.from({length:9},(_,hole)=>{
          const index=active.find(i=>p.visitors[i].hole===hole), v=index===undefined?null:p.visitors[index];
          return <button type="button" key={hole} className={`bt-hole ${v?.kind??''}`} disabled={locked} data-tap-hole={hole} data-visitor={index??''} data-kind={v?.kind??'empty'} aria-label={`第${hole+1}格，${v?v.kind==='flower'?'花朵，轻点收好':'瓢虫，请不要点':'暂无来客'}`} onClick={e=>{if(!e.ctrlKey&&!e.altKey&&!e.metaKey)pick(hole);}}><span className="bt-number">{hole+1}</span>{v?<><Flower bug={v.kind==='ladybird'}/><span className="bt-tag">{v.kind==='flower'?'收花':'让它歇歇'}</span><span className="bt-lifetime" style={{width:`${Math.max(0,1-(state.time-v.at)/v.duration)*100}%`}}/></>:<span className="bt-empty" aria-hidden="true">·</span>}</button>;
        })}
      </div>
      <div className="bt-start-row">{state.phase==='ready'?<button type="button" className="bt-start" disabled={paused} onClick={start}>开始收花</button>:state.phase==='lost'?<button type="button" className="bt-start" disabled={paused} onClick={start}>再试这轮</button>:state.phase==='playing'?<button type="button" className="bt-start" disabled={paused} onClick={held?resume:hold}>{held?'继续收花':'先停一停'}</button>:<div className="bt-finished">每封花信，都好好收到了。</div>}</div>
      <div className="bt-pace" role="group" aria-label="收花速度"><span>速度</span>{[[.75,'悠闲'],[1,'标准']].map(([v,label])=><button type="button" key={v} aria-pressed={pace===v} disabled={state.phase==='playing'&&!held&&!paused} onClick={()=>setPace(Number(v))}>{label}</button>)}</div>
      <p className="bt-save">{saved?'中途离开会保存到本机，回来后先暂停等你。完成或失败后回来会重新开这一轮。':'此浏览器暂时无法保存，请保持页面打开。'}</p>
    </div>
    <aside className="bt-notes"><span>一片会打招呼的花田</span><h3>看清来客，<br/>再轻轻一点。</h3><div className="bt-key"><Flower/><p><strong>花朵是花信</strong><br/>在它离开前点一次。重复点空洞不会加分，也不扣分。</p></div><div className="bt-key"><Flower bug/><p><strong>瓢虫是朋友</strong><br/>让它自己歇一会。误点瓢虫或错过花朵各算一次失误。</p></div><p>本轮结束时收够目标花朵、失误不超额就成功。可以随时暂停观察，悠闲速度不会减少完成记录。</p><details><summary>键盘与续玩</summary><p>Tab 进入九格花田；数字键1–9对应从左到右、从上到下。也可用Tab和Enter逐格操作。长按数字不会重复收花。切到后台或窗口失焦会安全暂停，回来后按继续。</p><p>重来清空本轮记录。本机存档只属于此浏览器；实时游戏不支持撤销。</p></details></aside>
  </section>;
}
