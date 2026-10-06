// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties} from "react";
import type {GameProps} from "../lib/types";
import {createMergeState,isMergeGameOver,mergeDirectionLabels,mergeDirections,mergeHint,mergeMove,undoMerge,type MergeDirection,type MergeState} from "./mergeLogic";
import {MERGE_BEST_KEY,parseMergeBest,readMergeBest,readMergeSave,saveMerge} from "./mergeStorage";
import "./mergeEscape.css";
import "./merge2048.css";
const arrows:Record<MergeDirection,string>={up:"↑",right:"→",down:"↓",left:"←"};
const colors=["#eee7db","#e9dfc2","#e8ad72","#e58e60","#d97152","#a84531","#6f8c3d","#567738","#46683f","#34633f","#244e35"];
export const MERGE_SLIDE_MS=150,MERGE_SETTLE_MS=110;
const position=(i:number)=>`translate(calc(${i%4} * (100% + var(--merge-gap))), calc(${Math.floor(i/4)} * (100% + var(--merge-gap))))`;
export default function MergeGarden(props:GameProps){return <MergeRound key={props.resetToken} {...props} freshStart={props.freshStart||props.resetToken>0}/>;}
function MergeRound({paused,freshStart,hintToken,undoToken,onStatus}:GameProps){
 const [state,setState]=useState(()=>!freshStart&&readMergeSave()||createMergeState()),current=useRef(state);
 const [best,setBest]=useState(()=>Math.max(readMergeBest(),state.score)),bestRef=useRef(best);
 const [storageOK,setStorageOK]=useState(true),[phase,setPhase]=useState<"idle"|"sliding"|"settling">("idle"),[effects,setEffects]=useState<number|null>(null),[hint,setHint]=useState<MergeDirection|null>(null);
 const [message,setMessage]=useState(isMergeGameOver(state.board)?`本局结束，得分 ${state.score}。再来一局吧。`:state.moves?"欢迎回来，接着这一局慢慢玩。":"滑动棋盘，或用方向键移动数字。试着刷新自己的最高分。");
 const boardRef=useRef<HTMLDivElement>(null),alive=useRef(true),busy=useRef(false),queue=useRef<MergeDirection[]>([]),animations=useRef<Animation[]>([]),timer=useRef<ReturnType<typeof setTimeout>|null>(null),epoch=useRef(0);
 const pausedRef=useRef(paused);pausedRef.current=paused;
 const reduced=useRef(typeof matchMedia==="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches),tokens=useRef({hintToken,undoToken}),pointer=useRef<{id:number;x:number;y:number}|null>(null),report=useRef(onStatus);report.current=onStatus;
 const executeRef=useRef<(direction:MergeDirection)=>void>(()=>{});
 function persist(next:MergeState){const result=saveMerge(next,bestRef.current);bestRef.current=result.best;setBest(result.best);setStorageOK(result.saved);}
 function cancelMotion(render=true){epoch.current++;if(timer.current!==null)clearTimeout(timer.current);timer.current=null;animations.current.forEach(a=>a.cancel());animations.current=[];queue.current=[];busy.current=false;pointer.current=null;if(render){setPhase("idle");setEffects(null);}}
 function execute(direction:MergeDirection){
  if(pausedRef.current||document.hidden||!alive.current)return;
  if(busy.current){queue.current.push(direction);return;}
  const previous=current.current,next=mergeMove(previous,direction);
  if(next===previous){setMessage(isMergeGameOver(previous.board)?"本局结束，没有可以移动的方向了。再来一局吧。":"这个方向没有变化，不会加分或新增数字。");return;}
  current.current=next;setState(next);persist(next);setHint(null);setEffects(null);
  const gain=next.score-previous.score,reached=Math.max(...previous.board)<2048&&Math.max(...next.board)>=2048;
  setMessage(isMergeGameOver(next.board)?`本局结束，得分 ${next.score}。重新开始会保留最高分。`:reached?"合成 2048 了！继续玩，看看还能走多远。":gain?`${mergeDirectionLabels[direction]}合并，得分 +${gain}。`:"数字已移动，继续找相同的伙伴。");
  if(!reduced.current){busy.current=true;setPhase("sliding");}
 }
 executeRef.current=execute;
 function newGame(){cancelMotion();const next=createMergeState();current.current=next;setState(next);persist(next);setHint(null);setMessage("新的一局开始了，最高分会一直保留。");boardRef.current?.focus({preventScroll:true});}
 useEffect(()=>{alive.current=true;persist(current.current);return()=>{alive.current=false;cancelMotion(false);};},[]);
 useEffect(()=>{if(!paused)report.current(message);},[message,paused]);
 useEffect(()=>{if(paused)cancelMotion();},[paused]);
 useEffect(()=>{
  const visibility=()=>{if(document.hidden)cancelMotion();};
  const media=typeof matchMedia==="function"?matchMedia("(prefers-reduced-motion: reduce)"):null;
  const preference=()=>{reduced.current=!!media?.matches;if(reduced.current)cancelMotion();};
  const storage=(e:StorageEvent)=>{if(e.key===MERGE_BEST_KEY){const value=Math.max(bestRef.current,parseMergeBest(e.newValue));bestRef.current=value;setBest(value);}};
  document.addEventListener("visibilitychange",visibility);media?.addEventListener?.("change",preference);window.addEventListener("storage",storage);
  return()=>{document.removeEventListener("visibilitychange",visibility);media?.removeEventListener?.("change",preference);window.removeEventListener("storage",storage);};
 },[]);
 useLayoutEffect(()=>{
  if(phase!=="sliding")return;const turn=epoch.current,active:Animation[]=[];
  for(const motion of state.motion){if(motion.from===motion.to)continue;const tile=boardRef.current?.querySelector<HTMLElement>(`[data-tile-id="${motion.id}"]`);if(tile?.animate)active.push(tile.animate([{transform:position(motion.from)},{transform:position(motion.to)}],{duration:MERGE_SLIDE_MS,easing:"cubic-bezier(.2,.7,.2,1)"}));}
  animations.current=active;timer.current=setTimeout(()=>{if(!alive.current||epoch.current!==turn)return;active.forEach(a=>a.cancel());animations.current=[];setEffects(current.current.moves);setPhase("settling");},MERGE_SLIDE_MS);
  return()=>{if(timer.current!==null)clearTimeout(timer.current);timer.current=null;active.forEach(a=>a.cancel());};
 },[phase,state.moves]);
 useLayoutEffect(()=>{
  if(phase!=="settling")return;const turn=epoch.current;
  timer.current=setTimeout(()=>{if(!alive.current||epoch.current!==turn)return;busy.current=false;setPhase("idle");while(queue.current.length&&!busy.current)executeRef.current(queue.current.shift()!);},MERGE_SETTLE_MS);
  return()=>{if(timer.current!==null)clearTimeout(timer.current);timer.current=null;};
 },[phase,state.moves]);
 useEffect(()=>{if(tokens.current.hintToken===hintToken)return;tokens.current.hintToken=hintToken;if(paused)return;const direction=mergeHint(current.current);setHint(direction);setMessage(direction?`可以试试${mergeDirectionLabels[direction]}：兼顾合并与空位。这是一步建议，不保证最终结果。`:"没有可移动的方向了。可以重新开始或撤销。");},[hintToken,paused]);
 useEffect(()=>{if(tokens.current.undoToken===undoToken)return;tokens.current.undoToken=undoToken;if(paused)return;cancelMotion();const previous=current.current,next=undoMerge(previous);current.current=next;setState(next);persist(next);setHint(null);setMessage(next===previous?"还没有可撤销的移动。":"已撤销一步，最高分仍然保留。");},[undoToken,paused]);
 const stuck=isMergeGameOver(state.board),largest=Math.max(...state.board),gain=state.score-(state.history.at(-1)?.score??state.score);
 const tiles=phase==="sliding"?state.motion.map(m=>({id:m.id,index:m.to,value:m.value,from:m.from})):state.tiles.map(t=>({...t,from:t.index}));
 return <div className="puzzle-layout me-game merge-garden merge-classic" data-game="merge" data-merge-phase={phase} data-merge-moves={state.moves} data-merge-over={stuck}>
  <section className="me-playfield" aria-label="2048 无尽模式">
   <header className="me-heading"><div><span className="mini-label">慢慢合并 · 挑战高分</span><h3>每一步，都有新可能。</h3></div><span className="merge-badge" aria-hidden="true">2048</span></header>
   <div className="me-scorebar"><div><small>本局得分</small><b data-merge-score>{state.score.toLocaleString()}</b>{effects===state.moves&&gain>0&&<span className="merge-gain" key={state.moves} aria-hidden="true">+{gain}</span>}</div><div><small>本机最高分</small><b data-merge-best>{best.toLocaleString()}</b></div><div><small>最大数字</small><b>{largest}</b></div></div>
   <div className="merge-board-wrap"><div ref={boardRef} className="merge-board" role="group" aria-label="2048 棋盘，滑动或方向键移动全部数字" tabIndex={0}
    onKeyDown={event=>{if(event.ctrlKey||event.metaKey||event.altKey)return;const direction=({ArrowUp:"up",ArrowRight:"right",ArrowDown:"down",ArrowLeft:"left",w:"up",d:"right",s:"down",a:"left"} as Record<string,MergeDirection>)[event.key];if(direction){event.preventDefault();if(!event.repeat||!busy.current)execute(direction);}}}
    onPointerDown={event=>{if(paused||!event.isPrimary||event.button!==0)return;pointer.current={id:event.pointerId,x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture?.(event.pointerId);event.currentTarget.focus({preventScroll:true});}}
    onPointerUp={event=>{const start=pointer.current;pointer.current=null;if(!start||start.id!==event.pointerId)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;execute(Math.abs(dx)>Math.abs(dy)?dx>0?"right":"left":dy>0?"down":"up");}}
    onPointerCancel={()=>{pointer.current=null;}} onLostPointerCapture={()=>{pointer.current=null;}}>
    <div className="merge-grid">{state.board.map((value,index)=><div className="merge-cell" key={index} data-merge-cell={index} data-value={value} aria-label={`第 ${Math.floor(index/4)+1} 行第 ${index%4+1} 列，${value||"空格"}`}/>)}</div>
    <div className="merge-tile-layer" aria-hidden="true">{tiles.map(tile=><div key={tile.id} data-tile-id={tile.id} data-tile-value={tile.value} data-tile-from={tile.from} data-tile-to={tile.index} className="merge-tile-position" style={{transform:position(tile.index)}}><div className={`merge-tile ${tile.value>=64?"merge-tile-dark":""} ${effects===state.moves&&state.mergedIds.includes(tile.id)?"merge-tile-merged":""} ${effects===state.moves&&tile.index===state.spawned?"merge-tile-new":""}`} style={{"--merge-color":colors[Math.min(colors.length-1,Math.log2(tile.value)-1)],"--merge-digits":String(tile.value).length} as CSSProperties}><span>{tile.value}</span></div></div>)}</div>
   </div><div className="merge-next"><span>{state.moves} 步 · 每次只合并一次</span><span>滑动 / 方向键 / WASD</span></div></div>
   <div className="merge-controls" aria-label="2048 方向按钮">{mergeDirections.map(direction=><button type="button" key={direction} data-merge-direction={direction} className={`merge-direction merge-${direction} ${hint===direction&&!paused?"me-hinted":""}`} aria-label={`${mergeDirectionLabels[direction]}合并`} disabled={paused||stuck} onClick={()=>execute(direction)}><span aria-hidden="true">{arrows[direction]}</span><small>{mergeDirectionLabels[direction]}</small></button>)}</div>
   <p className={`me-feedback ${stuck?"me-feedback-warning":""}`} role="status" aria-live="polite">{paused?"已暂停。准备好后继续这一局。":message}</p>
   {stuck&&<button className="primary merge-restart" onClick={newGame} disabled={paused}>再来一局</button>}
   {!storageOK&&<p className="merge-storage-warning" role="status">浏览器暂时无法保存，本局仍可继续；关闭页面可能丢失记录。</p>}
  </section>
  <aside className="game-notes me-notes"><span className="mini-label">经典 2048 · 无尽模式</span><h3>合到 2048，<br/>也可以继续。</h3><div className="me-objective"><small>你的每一局都值得留下</small><p><b>刷新最高分</b></p><span>本局与最高分会自动保存在这个浏览器。没有关卡，也没有时间限制。</span></div><ol className="me-instructions"><li><b>把相同数字推到一起</b><span>用方向键、WASD、按钮，或在棋盘上滑动。2 和 2 合成 4，4 和 4 合成 8。</span></li><li><b>每块每步只合并一次</b><span>2、2、4 先变成 4、4，下次才能合成 8。有效移动后随机出现一个 2 或 4。</span></li><li><b>留些空位，继续前进</b><span>只有没有可移动的方向时才结束。重新开始不会清除最高分；也可撤销最近 32 步。</span></li></ol><div className="note me-tip"><strong>试试把大数字留在角落</strong><p>围绕一个角落整理数字，给小数字留出相遇的空间。提示只提供当前一步建议。</p></div></aside>
 </div>;
}
