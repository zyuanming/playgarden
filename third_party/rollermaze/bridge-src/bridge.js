// SPDX-License-Identifier: GPL-3.0-only
const rmCodes=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','KeyZ','KeyX','Semicolon','Period']);
function rmKey(code,down){if(!rmConnected||rmDisposed||rmPaused||!rmVisible||rmPending)return;
 if(code==='KeyR'&&down&&(gs.state===1||gs.state===2)){gs.timeline.reset();rmCompleteSent=false;createobjects();rmPublish();return;}
 if(!rmCodes.has(code))return;updatekeystate({code,preventDefault(){}},down?1:0);if(down)rmFeedback(300);}
// Accessible button activation is buffered until an eligible native logic step.
// A 120/144 Hz paint callback may contain no 60 Hz update at all.
function rmTap(code){
 if(!rmConnected||rmDisposed||rmPaused||!rmVisible||rmPending||!rmCodes.has(code)||gs.state!==STATEINPLAY)return;
 rmTapCode=code;rmFeedback(300);
}
function rmConsumeTap(){
 if(rmTapCode===null||gs.moving!==KEYNONE)return 0;
 const before=gs.keystate,code=rmTapCode;rmTapCode=null;
 updatekeystate({code,preventDefault(){}},1);
 return gs.keystate&~before; // Release only bits added by this tap, not held input.
}
function rmInit(){
 gs.levelnum=rmSelected;gs.canvas=document.getElementById('canvas');gs.osd=document.getElementById('osd');
 gs.gl=gs.canvas.getContext('webgl2');gs.ctx=gs.osd.getContext('2d');
 if(!gs.gl||!gs.ctx)throw Error('WebGL 2 unavailable');
 playfieldsize();createobjects();gs.program=W.init(gs.scene,gs.gl);
 document.addEventListener('keydown',event=>{if(rmCodes.has(event.code)||event.code==='KeyR'){event.preventDefault();rmKey(event.code,true);}});
 document.addEventListener('keyup',event=>{if(rmCodes.has(event.code)){event.preventDefault();rmKey(event.code,false);}});
 gs.osd.addEventListener('pointerdown',event=>{
  if(rmPaused||rmDisposed||rmPending||!event.isPrimary||event.button!==0)return;
  event.preventDefault();if(event.pointerType==='mouse')gs.osd.focus({preventScroll:true});
  rmPointer=event.pointerId;gs.osd.setPointerCapture(event.pointerId);pointerpos(event,1);rmFeedback(300);
 });
 gs.osd.addEventListener('pointermove',event=>{if(rmPointer===event.pointerId&&!rmPaused&&!rmPending)pointerpos(event,1);});
 const release=event=>{if(rmPointer!==event.pointerId)return;rmClearInput();if(gs.osd.hasPointerCapture(event.pointerId))gs.osd.releasePointerCapture(event.pointerId);};
 gs.osd.addEventListener('pointerup',release);gs.osd.addEventListener('pointercancel',release);gs.osd.addEventListener('lostpointercapture',release);
 gs.canvas.addEventListener('webglcontextlost',event=>{if(!rmDisposed){event.preventDefault();rmError(Error('WebGL context lost'));}});
 window.addEventListener('resize',playfieldsize);window.addEventListener('blur',rmClearInput);
 document.addEventListener('visibilitychange',()=>{rmVisible=!document.hidden;rmPause(rmPaused);});
 rmRequestFrame(rafcallback);
}
window.addEventListener('message',event=>{
 const data=event.data;if(event.source!==parent||!data||data.source!=='playgarden-host'||data.session!==rmSession)return;
 if(data.type==='dispose'){rmDispose();return;}if(rmDisposed)return;
 if(data.type==='connect'&&!rmConnected){
  if(!Number.isInteger(rmSelected)||rmSelected<0||rmSelected>=25||!rmSession)return;
  rmCleared=Array.isArray(data.cleared)?[...new Set(data.cleared.filter(n=>Number.isInteger(n)&&n>=0&&n<25))].sort((a,b)=>a-b):[];
  rmSaved=data.saved!==false;rmMuted=data.muted!==false;rmPaused=data.paused===true;
  try{rmInit();rmConnected=true;rmSend('ready');rmPublish();rmSchedule();}catch(error){rmError(error);}
 }else if(rmConnected){
  if(data.type==='pause')rmPause(data.paused===true);
  else if(data.type==='mute'){rmMuted=data.muted!==false;if(rmMuted)rmStopSound();rmPublish();}
  else if(data.type==='cancel')rmClearInput();
  else if(data.type==='key')rmKey(data.code,data.down===true);
  else if(data.type==='tap')rmTap(data.code);
  else if(data.type==='next'&&!rmPaused)rmNext();
  else if(data.type==='save-ack'&&data.saveId===rmSaveId){rmSaved=data.saved===true;rmPublish();}
 }
});
Object.defineProperty(window,'__rollermazeSnapshot',{value:()=>structuredClone(rmSnapshot()),writable:false});
window.addEventListener('pagehide',rmDispose);window.addEventListener('unload',rmDispose);
window.addEventListener('load',()=>rmSend('loaded'));
