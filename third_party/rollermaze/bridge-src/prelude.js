// SPDX-License-Identifier: GPL-3.0-only
// Owned clock/RAF queue for this opaque-origin game only; browser globals are unchanged.
const rmParams=new URLSearchParams(location.search),rmSession=rmParams.get('session')||'';
const rmSelected=Number(rmParams.get('level')||0),rmRevision='rollermaze-2a08f83-playgarden-1';
let rmConnected=false,rmDisposed=false,rmPaused=true,rmMuted=true,rmVisible=!document.hidden;
let rmTime=0,rmLast=null,rmFrame=null,rmSerial=0,rmFrames=0,rmSnapshotAt=-1000;
const rmCallbacks=new Map();
let rmCleared=[],rmSaved=true,rmSaveId=0,rmMoves=0,rmSafeSpots=0,rmCollisions=0,rmLastSafe='';
let rmCompleteSent=false,rmPending=false,rmFailures=0,rmAudio=null,rmAudioGain=null;
const rmOscillators=new Set();
const rmNow=()=>rmTime;
function rmSend(type,extra={}){parent.postMessage({source:'playgarden-rollermaze',revision:rmRevision,session:rmSession,type,...extra},'*');}
function rmSchedule(){if(rmConnected&&!rmDisposed&&!rmPaused&&rmVisible&&rmFrame===null&&rmCallbacks.size)rmFrame=requestAnimationFrame(rmPump);}
function rmRequestFrame(callback){const id=++rmSerial;rmCallbacks.set(id,callback);rmSchedule();return id;}
function rmPump(timestamp){
  rmFrame=null;if(rmDisposed||rmPaused||!rmVisible)return;
  if(rmLast!==null)rmTime+=Math.max(0,timestamp-rmLast);
  rmLast=timestamp;rmFrames++;
  const batch=[...rmCallbacks];for(const [id] of batch)rmCallbacks.delete(id);
  try{for(const [,callback]of batch){if(rmDisposed)break;callback(rmTime);}}catch(error){rmError(error);return;}
  if(rmTime-rmSnapshotAt>=100){rmSnapshotAt=rmTime;rmPublish();}rmSchedule();
}
function rmClearInput(){if(typeof gs==='undefined')return;gs.keystate=0;gs.touch=false;rmPointer=null;rmTapCode=null;}
function rmStopSound(){for(const oscillator of rmOscillators){try{oscillator.stop();oscillator.disconnect();}catch{}}rmOscillators.clear();}
function rmPause(value){rmPaused=value;rmClearInput();rmLast=null;if(rmFrame!==null){cancelAnimationFrame(rmFrame);rmFrame=null;}
 if(rmPaused||!rmVisible){rmStopSound();if(rmAudio?.state==='running')void rmAudio.suspend().catch(()=>{});}rmSchedule();rmPublish();}
function rmFeedback(frequency=330){
 if(rmDisposed||rmPaused||!rmVisible||rmMuted)return;
 try{if(!rmAudio){rmAudio=new AudioContext();rmAudioGain=rmAudio.createGain();rmAudioGain.gain.value=.07;rmAudioGain.connect(rmAudio.destination);}
 if(rmAudio.state==='suspended')void rmAudio.resume().catch(()=>{});
 const oscillator=rmAudio.createOscillator(),gain=rmAudio.createGain(),now=rmAudio.currentTime;
 oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.7,now);gain.gain.exponentialRampToValueAtTime(.001,now+.09);
 oscillator.connect(gain);gain.connect(rmAudioGain);rmOscillators.add(oscillator);
 oscillator.onended=()=>{rmOscillators.delete(oscillator);oscillator.disconnect();gain.disconnect();};oscillator.start(now);oscillator.stop(now+.1);
 }catch{/* Sound is optional; gameplay does not depend on audio support. */}}
function rmComplete(level){if(rmCompleteSent||rmDisposed)return;rmCompleteSent=true;
 if(!rmCleared.includes(level))rmCleared.push(level);rmCleared.sort((a,b)=>a-b);
 rmSend('save',{saveId:++rmSaveId,cleared:[...rmCleared]});rmFeedback(780);
 rmSend('complete',{level,moves:rmMoves});rmClearInput();rmPublish();}
function rmNext(){if(rmDisposed||rmPending||!rmCompleteSent||rmSelected>=24)return;rmPending=true;rmClearInput();rmSend('level',{level:rmSelected+1});}
function rmFail(){rmFailures++;rmFeedback(110);rmClearInput();rmPublish();}
function rmSafeSpot(x,y){const key=x+','+y;if(key!==rmLastSafe){rmLastSafe=key;rmSafeSpots++;rmFeedback(600);}}
function rmSnapshot(){return {level:rmSelected,title:levels[rmSelected]?.title||'',state:gs.state,paused:rmPaused||!rmVisible,
 frames:rmFrames,time:rmTime,remaining:gs.timeout<0?null:Math.max(0,(gs.timeout-rmTime)/1000),
 position:gs.models[gs.player]?.p.slice()||[],target:gs.tp.slice(),moving:gs.moving,keys:gs.keystate,touch:gs.touch,
 cleared:[...rmCleared],saved:rmSaved,moves:rmMoves,safeSpots:rmSafeSpots,collisions:rmCollisions,failures:rmFailures,
 blocks:gs.blocks.map(b=>({x:b.x,y:b.y,blocked:b.blocked})),npcs:gs.npcs.map(n=>({deadly:n.deadly,position:gs.models[n.id].p.slice()})),
 ready:rmConnected&&!rmDisposed,ending:gs.state===4,audio:{enabled:!rmMuted,context:rmAudio?.state||'none',oscillators:rmOscillators.size},
 map:{width:gs.level?.width,height:gs.level?.height,tiles:gs.level?.tiles.slice()||[]}};}
function rmPublish(){if(rmConnected&&!rmDisposed)rmSend('snapshot',{state:rmSnapshot()});}
function rmDispose(){if(rmDisposed)return;rmDisposed=true;rmClearInput();if(rmFrame!==null)cancelAnimationFrame(rmFrame);rmFrame=null;rmCallbacks.clear();
 rmStopSound();if(rmAudio&&rmAudio.state!=='closed')void rmAudio.close().catch(()=>{});rmAudioGain=null;
 if(typeof gs!=='undefined'){gs.timeline.end();for(const model of gs.models)model.anim?.end();gs.gl?.getExtension('WEBGL_lose_context')?.loseContext();}}
function rmError(error){rmSend('error',{message:'游戏资源未能启动或图形设备不可用，请重试。'});rmDispose();}
function write(ctx,x,y,text,size,style){ctx.save();ctx.font=`bold ${size*8}px ui-monospace, monospace`;ctx.textBaseline='top';
 ctx.lineWidth=3;ctx.strokeStyle='#172331';ctx.fillStyle=style;ctx.strokeText(text,x,y,text.length*size*4);ctx.fillText(text,x,y,text.length*size*4);ctx.restore();}
let rmPointer=null,rmTapCode=null;
