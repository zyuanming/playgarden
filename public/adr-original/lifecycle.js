// SPDX-License-Identifier: GPL-3.0-only
// Pausable per-iframe time. Resource, combat, animation and flight timers share it.
(() => {
  'use strict';
  const real={set:window.setTimeout.bind(window),clear:window.clearTimeout.bind(window),raf:window.requestAnimationFrame.bind(window),caf:window.cancelAnimationFrame.bind(window),Date:window.Date};
  const tasks=new Map(),reasons=new Set();let next=1,dead=false,frozenAt=0,pausedTotal=0;
  const rawNow=()=>real.Date.now(),now=()=> (reasons.size?frozenAt:rawNow())-pausedTotal;
  function GameDate(...args){if(new.target)return Reflect.construct(real.Date,args.length?args:[now()]);return new real.Date(now()).toString();}
  GameDate.prototype=real.Date.prototype;Object.setPrototypeOf(GameDate,real.Date);GameDate.now=now;window.Date=GameDate;
  function arm(t){if(dead||reasons.size)return;t.native=real.set(()=>{
    if(!tasks.has(t.id)||dead||reasons.size)return;
    if(t.repeat){t.due=now()+t.delay;arm(t);}else tasks.delete(t.id);
    if(t.frame)t.fn(now());else t.fn(...t.args);
  },Math.max(0,t.due-now()));}
  function add(fn,delay,args,repeat,frame=false){if(typeof fn!=='function')throw Error('String timers are disabled');if(dead)return 0;const id=next++,d=Math.max(repeat?1:0,Math.min(2147483647,Number(delay)||0)),t={id,fn,args,delay:d,due:now()+d,repeat,frame,native:0};tasks.set(id,t);arm(t);return id;}
  function cancel(id){const t=tasks.get(id);if(t){real.clear(t.native);tasks.delete(id);}}
  window.setTimeout=(fn,delay,...args)=>add(fn,delay,args,false);
  window.setInterval=(fn,delay,...args)=>add(fn,delay,args,true);
  window.clearTimeout=window.clearInterval=cancel;
  window.requestAnimationFrame=fn=>add(fn,16,[],false,true);
  window.cancelAnimationFrame=cancel;
  function clearInput(){if(window.Space){Space.up=Space.down=Space.left=Space.right=false;Space.lastMove=now();}if(window.Engine)Engine.pressed=false;window.ADRBridge?.clearDirections();}
  function pause(reason,enabled){
    if(dead)return;const was=reasons.size>0;
    if(enabled&&!reasons.has(reason)){if(!was)frozenAt=rawNow();reasons.add(reason);}else if(!enabled)reasons.delete(reason);
    const is=reasons.size>0;
    if(was===is)return;
    if(is){for(const t of tasks.values())real.clear(t.native);clearInput();}
    else{pausedTotal+=rawNow()-frozenAt;for(const t of tasks.values())arm(t);}
    document.documentElement.classList.toggle('adr-paused',is);
    document.getElementById('adr-pause')?.toggleAttribute('hidden',!is);
  }
  function save(){try{if(window.Engine&&!Engine.GAME_OVER)Engine.saveGame();}catch{}}
  function dispose(saveBeforeExit=true){if(dead)return;if(saveBeforeExit)save();clearInput();dead=true;for(const t of tasks.values())real.clear(t.native);tasks.clear();window.ADRBridge?.dispose();}
  window.ADRClock={pause,dispose,clearInput,now,real,stats:()=>({paused:!!reasons.size,disposed:dead,timers:tasks.size,reasons:[...reasons],now:now()})};
  window.__adrDispose=dispose;
  document.addEventListener('visibilitychange',()=>pause('hidden',document.hidden));
  window.addEventListener('blur',()=>{clearInput();pause('blur',true);});
  window.addEventListener('pagehide',e=>{if(e.persisted){save();pause('bfcache',true);}else dispose();});
  window.addEventListener('pageshow',e=>{if(e.persisted){pause('bfcache',false);pause('hidden',document.hidden);}});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!e.repeat){e.preventDefault();e.stopImmediatePropagation();pause('keyboard',!reasons.has('keyboard'));return;}
    if(reasons.size||e.target?.closest('textarea,input,select,[contenteditable]'))e.stopImmediatePropagation();
  },true);
  document.addEventListener('keyup',e=>{if(reasons.size||e.target?.closest('textarea,input,select,[contenteditable]')){clearInput();e.stopImmediatePropagation();}},true);
  for(const type of ['pointerdown','click','keydown'])document.addEventListener(type,e=>{if(reasons.size&&!e.target?.closest('#adr-pause')){e.preventDefault();e.stopImmediatePropagation();}},true);
})();
