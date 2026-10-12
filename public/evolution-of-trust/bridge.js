// SPDX-License-Identifier: GPL-3.0-only
(function(){
  'use strict';
  var session=new URLSearchParams(location.search).get('session')||'';
  var host=parent, origin=location.origin, booted=false, ready=false, disposed=false, hostPaused=false;
  var entered=new Set(), complete=false, chapter='intro', requestedMute=true;
  var originalLoad=window.onload;
  function send(type,extra){if(disposed)return;host.postMessage(Object.assign({source:'playgarden-trust',session:session,type:type},extra||{}),origin);}
  function snapshot(){return {chapter:chapter,slide:window.slideshow?slideshow.slideIndex:-1,totalSlides:window.SLIDES?SLIDES.length:0,visited:entered.size,complete:complete,paused:TrustLifecycle.isPaused(),muted:window.Howler?Howler._muted:requestedMute,transitioning:!!window.Scratcher&&Scratcher.isTransitioning};}
  function report(){send('snapshot',{state:snapshot()});}
  function fail(message){
    var p=document.getElementById('runtime-error');if(!p){p=document.createElement('p');p.id='runtime-error';p.setAttribute('role','alert');document.body.prepend(p);}
    p.textContent=message;send('error',{message:message});
  }
  window.TrustFail=fail;
  window.onload=function(){send('hello');};
  function setPause(value){
    hostPaused=!!value;document.body.dataset.paused=String(hostPaused);
    (hostPaused?TrustLifecycle.pause():TrustLifecycle.resume()).then(function(){if(!disposed)report();});
  }
  function boot(data){
    if(booted||disposed)return;booted=true;hostPaused=!!data.paused;requestedMute=data.muted!==false;
    Howler.mute(requestedMute);
    var observations={rounds:0,play:0,eliminate:0,reproduce:0};
    function observe(){
      document.body.dataset.trustRounds=String(observations.rounds);
      document.body.dataset.trustPlaySteps=String(observations.play);
      document.body.dataset.trustEliminateSteps=String(observations.eliminate);
      document.body.dataset.trustReproduceSteps=String(observations.reproduce);
    }
    observe();
    subscribe('iterated/round/end',function(){observations.rounds++;observe();});
    subscribe('tournament/step/completed',function(step){if(['play','eliminate','reproduce'].includes(step)){observations[step]++;observe();}});
    subscribe('preloader/done',function(){
      ready=true;send('ready',{revision:'trust-6ec45d7-playgarden-1',finiteLevels:0});
      if(hostPaused)setPause(true);report();
    });
    subscribe('slideshow/slideChange',function(id){
      if(id)chapter=id;
      entered.add(slideshow.slideIndex);
      if(slideshow.slideIndex===SLIDES.length-1&&entered.size===SLIDES.length){complete=true;send('complete');}
      report();
    });
    subscribe('start/game',function(){
      // Resume the browser's gesture-gated audio context. Muting remains the
      // player's choice; the first start click does not enable sound by itself.
      if(Howler.ctx&&Howler.ctx.state==='suspended'&&!hostPaused)Howler.ctx.resume().catch(function(){});
    });
    if(hostPaused)setPause(true);
    try{originalLoad();}catch(error){fail('游戏加载失败，请使用顶部“重来”重新载入。');throw error;}
  }
  function receive(event){
    var d=event.data;
    if(disposed||event.source!==host||event.origin!==origin||!d||d.source!=='playgarden-host'||d.session!==session)return;
    if(d.type==='init')boot(d);
    else if(d.type==='pause')setPause(d.paused);
    else if(d.type==='mute'){requestedMute=!!d.muted;Howler.mute(requestedMute);document.getElementById('sound').setAttribute('sound',requestedMute?'off':'on');report();}
    else if(d.type==='hint')send('status',{message:'试着先合作，再观察对手如何回应。手机下方提供可读文字和完整控件；原作章节圆点可随时重看，沙盒可自由修改人数、收益与规则。'});
    else if(d.type==='hello'){if(ready)send('ready',{revision:'trust-6ec45d7-playgarden-1',finiteLevels:0});else send('hello');}
    else if(d.type==='dispose')dispose();
  }
  function dispose(){
    if(disposed)return;disposed=true;window.removeEventListener('message',receive);
    if(window.TrustUI)TrustUI.dispose();TrustLifecycle.dispose();
  }
  window.__trustDispose=dispose;
  window.addEventListener('message',receive);
  window.addEventListener('unhandledrejection',function(){if(!disposed)fail('一个游戏资源未能载入，请使用顶部“重来”重试。');});
})();
