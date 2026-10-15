// SPDX-License-Identifier: GPL-3.0-only
// Per-document pause/dispose. Original game timers retain their delays and native RAF cadence.
(() => {
  'use strict';
  const real={set:window.setTimeout.bind(window),clear:window.clearTimeout.bind(window),raf:window.requestAnimationFrame.bind(window),caf:window.cancelAnimationFrame.bind(window),Date:window.Date};
  const tasks=new Map(),reasons=new Set(),visuals=new Set();let serial=1,dead=false,frozenAt=0,total=0;
  const raw=()=>real.Date.now(),now=()=> (reasons.size?frozenAt:raw())-total;
  function GameDate(...args){if(new.target)return Reflect.construct(real.Date,args.length?args:[now()]);return new real.Date(now()).toString();}
  GameDate.prototype=real.Date.prototype;Object.setPrototypeOf(GameDate,real.Date);GameDate.now=now;window.Date=GameDate;
  function arm(t){
    if(dead||reasons.size)return;
    if(t.frame)t.native=real.raf(stamp=>{if(!tasks.has(t.id)||dead||reasons.size)return;tasks.delete(t.id);t.fn(stamp-total);});
    else t.native=real.set(()=>{if(!tasks.has(t.id)||dead||reasons.size)return;if(t.repeat){t.due=now()+t.delay;arm(t);}else tasks.delete(t.id);t.fn(...t.args);},Math.max(0,t.due-now()));
  }
  function add(fn,delay,args,repeat,frame=false){if(typeof fn!=='function')throw Error('String timers disabled');if(dead)return 0;const id=serial++,d=Math.max(repeat?1:0,Math.min(2147483647,Number(delay)||0)),t={id,fn,args,delay:d,due:now()+d,repeat,frame,native:0};tasks.set(id,t);arm(t);return id;}
  function cancel(id){const t=tasks.get(id);if(t){(t.frame?real.caf:real.clear)(t.native);tasks.delete(id);}}
  function reset(){for(const t of tasks.values())(t.frame?real.caf:real.clear)(t.native);tasks.clear();}
  window.setTimeout=(fn,delay,...args)=>add(fn,delay,args,false);window.setInterval=(fn,delay,...args)=>add(fn,delay,args,true);
  window.clearTimeout=window.clearInterval=cancel;window.requestAnimationFrame=fn=>add(fn,0,[],false,true);window.cancelAnimationFrame=cancel;
  function freezeVisuals(){if(!reasons.size||dead)return;for(const animation of document.getAnimations()){if(animation.playState==='running'||animation.pending){visuals.add(animation);animation.pause();}}}
  const visualObserver=new MutationObserver(freezeVisuals);visualObserver.observe(document.documentElement,{subtree:true,childList:true,attributes:true});
  function pause(reason,value){
    if(dead)return;const was=!!reasons.size;
    if(value&&!reasons.has(reason)){if(!was)frozenAt=raw();reasons.add(reason);}else if(!value)reasons.delete(reason);
    const is=!!reasons.size;if(was===is)return;
    if(is){for(const t of tasks.values())(t.frame?real.caf:real.clear)(t.native);window.GridlandBridge?.clearInput();freezeVisuals();}
    else{total+=raw()-frozenAt;for(const t of tasks.values())arm(t);}
    document.documentElement.classList.toggle('gridland-paused',is);
    if(!is){for(const animation of visuals){if(animation.playState==='paused')animation.play();}visuals.clear();}else freezeVisuals();
    document.getElementById('gridland-pause')?.toggleAttribute('hidden',!is);
  }
  function dispose(){if(dead)return;dead=true;reset();visualObserver.disconnect();for(const animation of visuals)animation.cancel();visuals.clear();window.GridlandBridge?.dispose();}
  window.GridlandClock={real,now,pause,dispose,reset,stats:()=>({paused:!!reasons.size,reasons:[...reasons],disposed:dead,timers:tasks.size,visuals:visuals.size,now:now()})};
  window.__gridlandDispose=dispose;
  document.addEventListener('visibilitychange',()=>pause('hidden',document.hidden));
  window.addEventListener('blur',()=>pause('blur',true));
  window.addEventListener('pagehide',e=>e.persisted?pause('bfcache',true):dispose());
  window.addEventListener('pageshow',e=>{if(e.persisted){pause('bfcache',false);pause('hidden',document.hidden);}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.repeat&&!e.target.closest('textarea,input')){e.preventDefault();e.stopImmediatePropagation();pause('keyboard',!reasons.has('keyboard'));}},true);
  for(const type of ['mousedown','touchstart','pointerdown','click','keydown'])document.addEventListener(type,e=>{if(reasons.size&&!e.target?.closest('#gridland-pause')){e.preventDefault();e.stopImmediatePropagation();}},true);
})();
