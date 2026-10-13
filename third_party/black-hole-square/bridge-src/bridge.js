// SPDX-License-Identifier: GPL-3.0-only
// Static ESM source; the locked official esbuild emits one classic-script bundle
// so this opaque-origin sandbox does not require module-script CORS permission.
import entitiesSource from '../adapted-src/entities.json';
import gameSystem from '../adapted-src/systems/game.js';
import dataSystem from '../adapted-src/systems/data.js';
import {REVISION,LEVELS,parseData,copyData} from './contract.ts';
const params=new URLSearchParams(location.search),session=params.get('session')??'';
const selected=Number(params.get('level')),start=Number(params.get('start'));
const origin=new URL(location.href).origin;
const valid=/^[a-zA-Z0-9-]{16,100}$/.test(session)&&Number.isInteger(selected)&&selected>=0&&selected<18&&
    Number.isInteger(start)&&start>=0&&start<=20&&((start<2&&selected===0)||start===selected+2||(start===20&&selected===17));
let runtime=null,lastSnapshot=null,hostPaused=true,hostMuted=true,changing=false,saved=true;
let saveId=0,ackId=0,credited=false,booted=false,epoch=0,lastSent='',lastSentTime=-Infinity;
let accepted=null;
const send=(type,extra={})=>{if(valid&&parent!==window)parent.postMessage({source:'playgarden-black-hole-square',revision:REVISION,session,type,...extra},origin);};
const snapshot=()=>{
    const state=runtime?.snapshot()??lastSnapshot;
    return state?structuredClone({...state,saved}):null;
};
const observe=force=>{
    const state=snapshot();if(!state)return;
    const {current,puzzle,frames,time,paused,settled,moves,budget,feedback,solved,ending,allSolved}=state;
    const summary={current,puzzle,frames,time,paused,settled,moves,budget,feedback,solved,saved,ending,allSolved};
    const key=JSON.stringify([current,moves,feedback,solved,saved,paused,settled]);
    if(force||key!==lastSent||time-lastSentTime>=150){lastSent=key;lastSentTime=time;send('snapshot',{state:summary});}
};
const effectivePause=()=>runtime?.setPaused(hostPaused||document.hidden||changing);
const dispose=()=>{
    epoch++;if(runtime){runtime.dispose();lastSnapshot={...runtime.snapshot(),saved};runtime=null;}
};
const fail=()=>{dispose();send('error',{message:'原版游戏未能继续，请重试载入。'});};
const boot=(initial,initialSaved)=>{
    if(runtime||!valid)return;
    const native=parseData(lastSnapshot?.native)??parseData(initial);if(!native)return;
    const thisEpoch=++epoch;
    changing=false;credited=false;saved=typeof lastSnapshot?.saved==='boolean'?lastSnapshot.saved:initialSaved;
    dataSystem.configure(native,data=>{
        if(thisEpoch!==epoch)return;
        saveId++;send('save',{saveId,native:data});
    });
    const entities=structuredClone(entitiesSource);
    // A same-document StrictMode reconnect resumes only the actual selected
    // stage and earned history. Unfinished board state is never fabricated.
    const current=booted&&lastSnapshot?lastSnapshot.current:start;
    entities.game.levels.current=current;
    entities.level.state.updates=[entities.game.levels.sequence[current]];
    if(current>=2)entities.game.canvas.oX=320;
    try {
        runtime=gameSystem.setup(entities,{
            paused:hostPaused||document.hidden,muted:hostMuted,
            onClear:id=>{
                if(thisEpoch!==epoch||changing||credited||id!==LEVELS[selected][0])return;
                const state=runtime?.snapshot();
                if(!state||state.current!==selected+2||state.board.some(tile=>tile>=2)||state.moves>LEVELS[selected][1]||!state.solved.includes(id))return;
                credited=true;send('complete',{level:selected,puzzle:id,moves:state.moves});observe(true);
            },
            onLevel:current=>{
                if(thisEpoch!==epoch||changing)return;
                if(current<2||current>19||current===selected+2){observe(true);return;}
                changing=true;effectivePause();
                const native=dataSystem.snapshot();observe(true);
                send('level',{level:current-2,native,saved});
            },
            onFrame:()=>observe(false),onError:fail,
        });
        booted=true;dataSystem.save('current',current);effectivePause();send('ready');observe(true);
    }catch{fail();}
};
window.addEventListener('message',event=>{
    if(!valid||event.source!==parent||event.origin!==origin||!event.data||
        event.data.source!=='playgarden-host'||event.data.session!==session)return;
    const data=event.data;
    if(data.type==='connect'){
        if(typeof data.paused!=='boolean'||typeof data.muted!=='boolean'||typeof data.saved!=='boolean')return;
        const native=parseData(data.native);if(!native)return;
        if(!accepted)accepted=copyData(native);
        hostPaused=data.paused;hostMuted=data.muted;boot(accepted,data.saved);
        runtime?.setMuted(hostMuted);effectivePause();observe(true);
    }else if(data.type==='pause'&&typeof data.paused==='boolean'){
        hostPaused=data.paused;runtime?.cancel();effectivePause();observe(true);
    }else if(data.type==='mute'&&typeof data.muted==='boolean'){
        hostMuted=data.muted;runtime?.setMuted(hostMuted);observe(true);
    }else if(data.type==='save-ack'&&Number.isInteger(data.saveId)&&data.saveId>ackId&&data.saveId<=saveId&&typeof data.saved==='boolean'){
        ackId=data.saveId;saved=data.saved;observe(true);
    }else if(data.type==='command'&&['previous','next','reset'].includes(data.action)&&!hostPaused&&!document.hidden&&!changing){
        runtime?.command(data.action);observe(true);
    }else if(data.type==='cancel')runtime?.cancel();
    else if(data.type==='dispose')dispose();
});
window.addEventListener('error',fail);
window.addEventListener('unhandledrejection',fail);
window.addEventListener('pagehide',dispose);
window.addEventListener('unload',dispose);
document.addEventListener('visibilitychange',()=>{runtime?.cancel();effectivePause();observe(true);});
Object.defineProperty(window,'__blackHoleSquareSnapshot',{value:snapshot,configurable:false,writable:false});
if(valid&&parent!==window)send('loaded');
else document.body.textContent='请从 Playgarden 的 Black Hole Square 页面启动游戏。';
