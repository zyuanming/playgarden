// Original pointer coordinate convention: Copyright (c) 2021 Quinten Clause, MIT.
// Owned Pointer Events and keyboard accessibility: GPL-3.0-only.
import soundSystem from './sound.js';
const add=(game,canvas,allowed,command)=>{
    const pointer=game.pointer, events=new AbortController(), signal=events.signal;
    let held=null, cell=0, keyboard=false;
    const coords=e=>{
        const b=canvas.getBoundingClientRect();
        return {x:(e.clientX-b.left)*game.canvas.gW/b.width,y:(e.clientY-b.top)*game.canvas.gH/b.height,
            inside:e.clientX>=b.left&&e.clientX<b.right&&e.clientY>=b.top&&e.clientY<b.bottom};
    };
    const cancel=()=>{
        const id=held;held=null;
        pointer.isDown=pointer.justDown=pointer.justUp=pointer.pointing=false;
        pointer.x=pointer.y=pointer.downX=pointer.downY=-1000;
        if (id!==null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    };
    canvas.tabIndex=0;
    canvas.setAttribute('aria-label','Black Hole Square 棋盘。方向键选择格子，回车或空格激活；R 重置，PageUp 和 PageDown 切换关卡。');
    canvas.addEventListener('pointerdown',e=>{
        if (!e.isPrimary||e.button!==0||held!==null||!allowed())return;
        e.preventDefault();canvas.focus();keyboard=false; soundSystem.unlock();
        const p=coords(e);if(!p.inside)return;
        held=e.pointerId;canvas.setPointerCapture(held);
        pointer.x=pointer.downX=p.x;pointer.y=pointer.downY=p.y;
        pointer.justDown=pointer.isDown=true;pointer.justUp=false;
    },{signal});
    canvas.addEventListener('pointermove',e=>{
        if (held!==null&&e.pointerId!==held)return;
        const p=coords(e);pointer.x=p.x;pointer.y=p.y;
    },{signal});
    canvas.addEventListener('pointerup',e=>{
        if(held!==e.pointerId)return;
        const p=coords(e),id=held,canActivate=allowed();held=null;
        pointer.isDown=false;pointer.justDown=false;
        if(canActivate&&p.inside){pointer.x=p.x;pointer.y=p.y;pointer.justUp=true;}
        else cancel();
        if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
    },{signal});
    canvas.addEventListener('pointercancel',cancel,{signal});
    canvas.addEventListener('lostpointercapture',()=>{if(held!==null)cancel();},{signal});
    window.addEventListener('blur',cancel,{signal});
    canvas.addEventListener('keydown',e=>{
        if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||!allowed())return;
        if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
            e.preventDefault();keyboard=true;
            const dx=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0;
            const dy=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0;
            cell=Math.max(0,Math.min(5,cell%6+dx))+6*Math.max(0,Math.min(5,Math.floor(cell/6)+dy));
        }else if(e.key==='Enter'||e.key===' '){
            e.preventDefault();keyboard=true;soundSystem.unlock();
            pointer.x=pointer.downX=16+cell%6*48+24+game.canvas.gX;
            pointer.y=pointer.downY=62+Math.floor(cell/6)*48+24+game.canvas.gY;
            pointer.justUp=true;
        }else if(e.key.toLowerCase()==='r'||e.key==='PageUp'||e.key==='PageDown'){
            e.preventDefault();command(e.key==='PageUp'?'previous':e.key==='PageDown'?'next':'reset');
        }
    },{signal});
    const focus=ctx=>{
        if(!keyboard||document.activeElement!==canvas)return;
        ctx.save();ctx.scale(game.canvas.zoom,game.canvas.zoom);
        ctx.strokeStyle='#ffd886';ctx.lineWidth=2;
        ctx.strokeRect(18+cell%6*48+game.canvas.oX,64+Math.floor(cell/6)*48+game.canvas.oY,44,44);ctx.restore();
    };
    return {cancel,focus,dispose:()=>{cancel();events.abort();}};
};
export default Object.freeze({add});
