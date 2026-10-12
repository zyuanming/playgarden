// SPDX-License-Identifier: GPL-3.0-only
// Host controls, accessibility, read-only observation and authentic dragon-clear notification.
(() => {
  'use strict';
  const session=new URLSearchParams(location.search).get('session')||'',origin=location.origin;
  const send=(type,data={})=>parent.postMessage({source:'playgarden-gridland',session,type,...data},origin);
  let Engine,E,State,World,Board,Graphics,$,heartbeat=0,dead=false,initial=true,hostPaused=false,ready=false,initCount=0,labels=null;
  const plain=x=>JSON.parse(JSON.stringify(x??null));
  function fail(message){const el=document.getElementById('gridland-error');el.hidden=false;el.textContent=message;send('error',{message});}
  function clearInput(){Engine?.clearInput();}
  function resume(){for(const reason of ['blur','hidden','keyboard','native'])GridlandClock.pause(reason,reason==='hidden'&&document.hidden);if(E)E.trigger('unpause');GridlandClock.pause('host',hostPaused);}
  function beforeInit(){initCount++;if(!initial){clearInput();if($){$('*').stop(true,false);$.fx.stop();$.timers.length=0;}GridlandClock.reset();}initial=false;}
  function snapshot(){
    if(!State?.buildings)return {started:false,initCount,clock:GridlandClock.stats(),storageAvailable:GridlandSave.available()};
    const dude=World.getDude(),tiles=[];
    document.querySelectorAll('.tile:not(.hidden):not(.pooled)').forEach(el=>{const tile=$.data(el,'tile');if(!tile)return;tiles.push({row:tile.options.row,col:tile.options.column,type:tile.options.type?.className||'',effect:el.classList.contains('effect_explosive')?'explosive':null});});
    return {started:Engine.isStarted(),initCount,clock:GridlandClock.stats(),storageAvailable:GridlandSave.available(),night:World.isNight(),canMove:!!dude&&Engine.canAcceptInput(),rows:Board.options.rows,columns:Board.options.columns,tiles,
      day:State.dayNumber,level:State.level,xp:State.xp,health:State.health,maxHealth:State.maxHealth(),gem:State.gem,mana:State.mana,counts:plain(State.counts),items:plain(State.items),prestige:State.prestige,
      buildings:State.buildings.map(b=>({type:b.options.type.className,built:b.built,obsolete:!!b.obsolete,required:plain(b.requiredResources)})),stores:State.stores.map(b=>({type:b.options.type.className,quantity:b._quantity})),
      hero:dude?{x:dude.p(),hp:dude.hp(),sword:dude.sword,shield:dude.shield}:null,finished:!!State.counts?.DRAGONS,casual:require('app/gameoptions').get('casualMode',false)};
  }
  function accessibility(){
    document.querySelectorAll('.saveSlot,.menu li,.menuBtn,.difficultySwitch,#pauseIcon').forEach(el=>{el.setAttribute('role','button');el.tabIndex=0;});
    document.querySelectorAll('.tile').forEach(el=>{const t=$.data(el,'tile');
      if(!t||el.classList.contains('hidden')||el.classList.contains('pooled')){el.tabIndex=-1;el.setAttribute('aria-hidden','true');el.removeAttribute('role');el.removeAttribute('aria-label');return;}
      el.removeAttribute('aria-hidden');el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label',`第${t.options.row+1}行第${t.options.column+1}列 ${t.options.type.className}`);
    });
  }
  function tick(){
    if(dead)return;
    if(Graphics?.isReady()&&!ready){ready=true;send('ready',{revision:'gridland-06af02c-playgarden-1',campaign:true,finiteLevels:0});GridlandClock.pause('host',hostPaused);}
    if($&&ready){accessibility();send('snapshot',{state:snapshot()});}
    heartbeat=GridlandClock.real.set(tick,500);
  }
  function dispose(){if(dead)return;dead=true;GridlandClock.real.clear(heartbeat);labels?.disconnect();window.removeEventListener('message',receive);clearInput();}
  function receive(e){
    if(e.origin!==origin||e.source!==parent||e.data?.source!=='playgarden-host'||e.data.session!==session)return;
    if(e.data.type==='pause'){hostPaused=!!e.data.paused;if(!hostPaused)resume();GridlandClock.pause('host',hostPaused);}
    else if(e.data.type==='hello'&&ready)send('ready',{revision:'gridland-06af02c-playgarden-1',campaign:true,finiteLevels:0});
    else if(e.data.type==='dispose')GridlandClock.dispose();
  }
  window.GridlandBridge={beforeInit,clearInput,dispose,started(){send('status',{message:'白天匹配收集材料、建造村落；夜晚匹配获得装备或引来敌人。黎明自动保存。'});}};
  window.__gridlandRead=snapshot;
  window.addEventListener('message',receive);window.addEventListener('error',e=>fail(e.message));
  document.getElementById('gridland-resume').addEventListener('click',resume);
  document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&!e.repeat&&e.target.matches('[role="button"]')){e.preventDefault();if(e.target.matches('.tile')){e.target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:0,clientY:0}));e.target.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));}else e.target.click();}});
  requirejs.config({baseUrl:'js',paths:{jquery:'../lib/jquery',base64:'../lib/base64'},waitSeconds:30});
  requirejs.onError=err=>fail('本地游戏资源加载失败：'+String(err.requireType||err.message));
  requirejs(['jquery','app/engine','app/eventmanager','app/gamestate','app/world','app/gameboard','app/graphics/graphics'],function(j,eng,events,state,world,board,graphics){
    $=j;Engine=eng;E=events;State=state;World=world;Board=board;Graphics=graphics;
    const trigger=E.trigger;
    E.trigger=function(name,args){const result=trigger.call(this,name,args);if(name==='gameOver')send('complete',{dragons:State.counts.DRAGONS,day:State.dayNumber});return result;};
    // Original tile objects are pooled. Observe their class/position changes so
    // accessibility follows the active board, never pooled or stale coordinates.
    labels=new MutationObserver(accessibility);labels.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
    Engine.init();tick();
  });
})();
