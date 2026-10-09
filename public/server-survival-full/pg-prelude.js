// SPDX-License-Identifier: GPL-3.0-only
window.PG_EMBEDDED=true;
window.PG_SHELL_PAUSED=false;
window.PG_FINISHED=false;
const params=new URLSearchParams(location.search);
window.PG_SESSION=params.get('session')||'';
window.PG_LEVEL=Math.min(25,Math.max(1,Number(params.get('level'))||1));
window.PG_MODE=params.get('mode')==='free'?'free':'campaign';
window.pgSend=(type,extra={})=>parent.postMessage({source:'playgarden-server-survival',session:window.PG_SESSION,type,...extra},location.origin);
// Capture before upstream listeners: the outer pause/complete state owns all input.
for(const name of ['click','pointerdown','pointerup','mousedown','mouseup','touchstart','touchmove','wheel','keydown','keyup']){
 document.addEventListener(name,event=>{
  if(window.PG_SHELL_PAUSED||window.PG_FINISHED){event.preventDefault();event.stopImmediatePropagation();return;}
  if((name==='keydown'||name==='keyup')&&(event.ctrlKey||event.metaKey||event.altKey))event.stopImmediatePropagation();
 },{capture:true,passive:false});
}
window.addEventListener('error',event=>window.pgSend('error',{message:String(event.message||'原作模块加载失败')}));
window.addEventListener('unhandledrejection',event=>window.pgSend('error',{message:String(event.reason?.message||event.reason||'原作模块运行失败')}));
