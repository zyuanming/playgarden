// Original frame/update/draw order: Copyright (c) 2021 Quinten Clause, MIT.
// Playgarden lifecycle, observation, and controls: GPL-3.0-only.
import updateSystem from './update.js';
import drawSystem from './draw.js';
import resizeSystem from './resize.js';
import pointerSystem from './pointer.js';
import dataSystem from './data.js';
import puzzleSystem from './updates/puzzle.js';
import soundSystem from './sound.js';
const types=['blackhole','blanksquare','xsquare','arrowup','arrowright','arrowdown','arrowleft','neutronstar'];
const setup=(entities,{onClear,onLevel,onFrame,onError,paused:initialPaused=true,muted=true})=>{
    const game=entities.game,canvas=document.createElement('canvas');
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas 2D unavailable');
    document.body.appendChild(canvas);resizeSystem.resize(game,canvas);
    let paused=initialPaused,disposed=false,raf=0,last=null,time=0,frames=0;
    const events=new AbortController(),signal=events.signal;
    puzzleSystem.configure(onClear);
    const command=action=>{
        if(paused||disposed)return;
        const current=game.levels.current;
        if(!['previous','next','reset'].includes(action))return;
        pointer.cancel();
        puzzleSystem.navigate(entities,Math.max(0,Math.min(game.levels.sequence.length-1,
            action==='reset'?current:current+(action==='next'?1:-1))));
        const selected=game.levels.current;
        if(selected!==current)onLevel(selected);
    };
    const pointer=pointerSystem.add(game,canvas,()=>!paused&&!disposed&&puzzleSystem.settled(entities)&&
        (game.pointer.isDown||Math.abs(game.canvas.oX-game.canvas.gX)<1/game.canvas.zoom),command);
    canvas.addEventListener('wheel',event=>{
        if(paused||disposed||!Number.isFinite(event.deltaX)||Math.abs(event.deltaX)<1)return;
        event.preventDefault();pointer.cancel();puzzleSystem.wheel(event.deltaX);
    },{signal,passive:false});
    soundSystem.setMuted(muted);soundSystem.setPaused(paused);
    const snapshot=()=>{
        const current=game.levels.current,puzzleId=game.levels.sequence[current],puzzle=entities[puzzleId].puzzle;
        return {current,puzzle:puzzleId,frames,time,paused,disposed,settled:puzzleSystem.settled(entities),
            moves:puzzleSystem.observe().moves,budget:Number(puzzle.taps)||0,feedback:entities.feedback.text.text,
            ending:puzzleId==='end',allSolved:dataSystem.load('solved').length===18,solved:dataSystem.load('solved'),
            native:dataSystem.snapshot(),board:Array.from({length:36},(_,i)=>{
                const piece=entities['piece'+i];return piece?types.findIndex(type=>piece[type]!==undefined)+1:0;
            }),overlays:Array.from({length:36},(_,i)=>{
                const piece=entities['top'+i];return piece?types.findIndex(type=>piece[type]!==undefined)+1:0;
            }),canvas:{width:game.canvas.gW,height:game.canvas.gH,x:game.canvas.oX,y:game.canvas.oY},
            audio:soundSystem.observe()};
    };
    const onF=stamp=>{
        raf=0;if(paused||disposed)return;
        // Real elapsed time, with a bounded integration step and a fresh epoch
        // after pause/background gaps. No elapsed-time catch-up or mocked clock.
        const delta=last===null?0:Math.max(0,Math.min(34,stamp-last));last=stamp;time+=delta;
        try {
            resizeSystem.resize(game,canvas);
            const wasPointing=game.pointer.pointing;game.pointer.pointing=false;
            let updates=[],draws=[];
            game.statemachine.active.forEach(id=>{
                const entity=entities[id];if(!entity.state)return;
                updates=[...updates,...entity.state.updates];draws=[...draws,...entity.state.draws];
            });
            const before=game.levels.current;
            updateSystem.process(entities,updates,time,delta);
            game.pointer.justDown=game.pointer.justUp=false;
            if(wasPointing!==game.pointer.pointing)canvas.style.cursor=game.pointer.pointing?'pointer':'default';
            ctx.clearRect(0,0,game.canvas.w,game.canvas.h);
            drawSystem.process(entities,draws,ctx,time,delta);pointer.focus(ctx);frames++;
            if(before!==game.levels.current){pointer.cancel();onLevel(game.levels.current);}
            onFrame(snapshot());
        }catch(error){dispose();onError(error);return;}
        if(!paused&&!disposed)raf=requestAnimationFrame(onF);
    };
    const setPaused=value=>{
        if(disposed)return;
        paused=value;pointer.cancel();last=null;soundSystem.setPaused(value);
        if(paused){cancelAnimationFrame(raf);raf=0;}
        else if(!raf)raf=requestAnimationFrame(onF);
    };
    const setMuted=value=>{if(!disposed)soundSystem.setMuted(value);};
    const dispose=()=>{
        if(disposed)return;disposed=true;paused=true;cancelAnimationFrame(raf);raf=0;
        pointer.dispose();events.abort();soundSystem.dispose();canvas.remove();
    };
    if(!paused)raf=requestAnimationFrame(onF);
    return Object.freeze({snapshot,setPaused,setMuted,command,cancel:pointer.cancel,dispose});
};
export default Object.freeze({setup});
