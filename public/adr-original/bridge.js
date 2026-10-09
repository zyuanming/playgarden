// SPDX-License-Identifier: GPL-3.0-only
// Responsive presentation and host lifecycle; original campaign actions remain intact.
(() => {
  'use strict';
  const session=new URLSearchParams(location.search).get('session')||'';
  const target=location.origin;
  let heartbeat=0,observer,resizeObserver,disposed=false,active=null,lastModule='',lastHeight=0;
  const held=new Map();const counters={battles:0,deaths:0,crashes:0,homecomings:0,endings:0};
  const send=(type,extra={})=>parent.postMessage({source:'playgarden-adr',session,type,...extra},target);
  const status=message=>send('status',{message});
  const plain=x=>JSON.parse(JSON.stringify(x??null));
  function moduleName(){for(const name of ['Room','Outside','Path','World','Ship','Space'])if(window[name]===Engine.activeModule)return name;return 'Room';}
  function snapshot(){return {
    module:moduleName(),title:document.title,clock:ADRClock.stats(),
    stores:plain(State?.stores),game:plain(State?.game),outfit:plain(Path?.outfit),previous:plain(State?.previous),
    mapSize:State?.game?.world?.map?.length||0,position:plain(World?.curPos),dead:!!World?.dead,
    event:Events.activeEvent?.()?{name:Events.activeScene||'',combat:!!Events.activeEvent().scenes?.[Events.activeScene]?.combat}:null,
    health:World.health,water:World.water,counters:{...counters},
    flight:{altitude:Space.altitude||0,hull:Space.hull||0,x:Space.shipX,y:Space.shipY,done:!!Space.done,directions:[!!Space.up,!!Space.down,!!Space.left,!!Space.right]},
    finished:!!Engine.GAME_OVER,ending:readEnding(),storageAvailable:!window.ADRStorageUnavailable
  };}
  function readEnding(){try{return JSON.parse(ADRStorage.ending||'null');}catch{return null;}}
  function layout(){
    if(disposed)return;
    const name=moduleName();document.body.dataset.adrModule=name;
    const stores=document.getElementById('storesContainer'),main=document.getElementById('main');
    if(stores&&main&&stores.parentElement!==main)main.append(stores);
    const panels={Room:'roomPanel',Outside:'outsidePanel',Path:'pathPanel',Ship:'shipPanel'};
    document.querySelectorAll('#locationSlider > .location').forEach(el=>el.classList.toggle('adr-active',el.id===panels[name]));
    document.getElementById('adr-directions').hidden=!['World','Space'].includes(name)||Engine.GAME_OVER;
    const space=document.getElementById('spacePanel');
    if(space){
      let viewport=document.getElementById('adr-space-viewport');
      if(!viewport){viewport=document.createElement('div');viewport.id='adr-space-viewport';space.before(viewport);viewport.append(space);}
      const width=Math.min(700,document.getElementById('wrapper').clientWidth);viewport.style.height=width+'px';space.style.transform='scale('+(width/700)+')';
    }
    const world=document.getElementById('map');
    if(world&&!world.parentElement.classList.contains('adr-map-scroll')){const scroll=document.createElement('div');scroll.className='adr-map-scroll';scroll.tabIndex=0;scroll.setAttribute('aria-label','完整世界地图，可左右滚动');world.before(scroll);scroll.append(world);}
    document.querySelectorAll('.button,.headerButton,.menuBtn,.endGameOption,.upBtn,.dnBtn,.upManyBtn,.dnManyBtn').forEach(el=>{
      if(!el.hasAttribute('role'))el.setAttribute('role','button');
      el.tabIndex=el.classList.contains('disabled')?-1:0;
      el.setAttribute('aria-disabled',String(el.classList.contains('disabled')));
      if(el.matches('.upBtn,.dnBtn,.upManyBtn,.dnManyBtn')){
        const row=el.closest('.workerRow,.outfitRow');
        const title=row?.querySelector('.row_key')?.textContent||'数量';
        el.setAttribute('aria-label',(el.matches('.upBtn,.upManyBtn')?'增加':'减少')+title+(el.matches('.upManyBtn,.dnManyBtn')?' 多个':' 一个'));
      }
    });
    if(name!==lastModule){lastModule=name;status(document.title+'。进度自动保存在此浏览器。');}
    const height=Math.min(1000,Math.max(560,document.body.scrollHeight));
    if(height!==lastHeight){lastHeight=height;send('height',{height});}
  }
  function clearDirections(){for(const {code,repeat} of held.values()){if(repeat)clearInterval(repeat);if(window.Engine)Engine.keyUp({which:code});}held.clear();}
  function direction(button,event){
    if(ADRClock.stats().paused||Engine.keyLock)return;
    event.preventDefault();button.setPointerCapture?.(event.pointerId);
    const code=Number(button.dataset.key);Engine.keyDown({which:code});
    const repeat=Engine.activeModule===World?setInterval(()=>{if(!Engine.keyLock)Engine.keyDown({which:code});},220):0;
    held.set(event.pointerId,{code,repeat});
  }
  function endDirection(event){const heldKey=held.get(event.pointerId);if(!heldKey)return;if(heldKey.repeat)clearInterval(heldKey.repeat);held.delete(event.pointerId);Engine.keyUp({which:heldKey.code});}
  function dispose(){if(disposed)return;disposed=true;clearDirections();ADRClock.real.clear(heartbeat);observer?.disconnect();resizeObserver?.disconnect();window.removeEventListener('message',receive);}
  function recordEnding(score,total){
    const old=readEnding();const result={completed:true,score,total,count:(old?.count||0)+1,completedAt:new ADRClock.real.Date().toISOString()};
    ADRStorage.ending=JSON.stringify(result);counters.endings++;send('complete',{score,total,count:result.count});
  }
  window.ADRBridge={status,clearDirections,dispose,recordEnding};
  window.__adrRead=snapshot;
  function receive(e){
    if(e.origin!==target||e.source!==parent||e.data?.source!=='playgarden-host'||e.data.session!==session)return;
    if(e.data.type==='pause'){
      if(!e.data.paused){ADRClock.pause('blur',false);ADRClock.pause('keyboard',false);}
      ADRClock.pause('host',!!e.data.paused);
    } else if(e.data.type==='restart'){Engine.confirmDelete();}
    else if(e.data.type==='dispose')ADRClock.dispose();
  }
  window.addEventListener('message',receive);
  window.addEventListener('error',event=>send('error',{message:event.message}));
  document.getElementById('adr-resume').addEventListener('click',()=>{ADRClock.pause('blur',false);ADRClock.pause('keyboard',false);ADRClock.pause('hidden',document.hidden);});
  document.querySelectorAll('#adr-directions button').forEach(button=>{
    button.addEventListener('pointerdown',event=>direction(button,event));
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,endDirection);
    button.addEventListener('pointerleave',endDirection);
    button.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&!e.repeat){e.preventDefault();Engine.keyDown({which:Number(button.dataset.key)});}});
    button.addEventListener('keyup',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();Engine.keyUp({which:Number(button.dataset.key)});}});
  });
  document.addEventListener('keydown',e=>{
    if(e.target.matches('.button,.headerButton,.menuBtn,.endGameOption,.upBtn,.dnBtn,.upManyBtn,.dnManyBtn')&&['Enter',' '].includes(e.key)&&!e.repeat){e.preventDefault();if(!e.target.classList.contains('disabled'))e.target.click();}
  });
  // Intercept only presentation selection; no gameplay action is replaced.
  Object.defineProperty(Engine,'activeModule',{get:()=>active,set:value=>{active=value;queueMicrotask(layout);},configurable:false});
  for(const [object,key,counter] of [[World,'die','deaths'],[World,'goHome','homecomings'],[Space,'crash','crashes']]){
    const original=object[key];object[key]=function(...args){counters[counter]++;return original.apply(this,args);};
  }
  const combat=Events.startCombat;
  if(typeof combat==='function')Events.startCombat=function(...args){counters.battles++;return combat.apply(this,args);};
  // The old fixed-height gradient is absent in the scrolling layout. Retain a
  // bounded readable history instead of treating its zero height as a cutoff.
  Notifications.clearHidden=function(){document.querySelectorAll('#notifications .notification').forEach((el,index)=>{if(index>=80)el.remove();});};
  document.getElementById('saveNotify').textContent=_('saved.');
  Engine.init();
  observer=new MutationObserver(()=>layout());
  observer.observe(document.getElementById('wrapper'),{childList:true,subtree:true});
  resizeObserver=new ResizeObserver(layout);resizeObserver.observe(document.getElementById('wrapper'));
  function tick(){if(disposed)return;layout();send('snapshot',{state:snapshot()});heartbeat=ADRClock.real.set(tick,250);}
  tick();send('ready',{revision:'adr-d6d1c1b-playgarden-1',campaign:true,finiteLevels:0});
  if(new URLSearchParams(location.search).get('restart')==='1'){const clean=new URL(location.href);clean.searchParams.delete('restart');history.replaceState(null,'',clean);Engine.confirmDelete();}
})();
