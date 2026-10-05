import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameProps } from '../lib/types';
import { slantLevels } from './slantLevels';
import { slantChapters } from './slantCampaign';
import { newSlantState, playSlant, slantHint, slantWon, undoSlant } from './slantLogic';
import { loadSlantRound, saveSlantRound } from './slantStorage';
import './slantForest.css';
export default function SlantForest({level,paused,resetToken,hintToken,undoToken,onComplete,onStatus}:GameProps) {
 const puzzle=slantLevels[level] ?? slantLevels[0], chapter=slantChapters[puzzle.chapter];
 const [state,setState]=useState(()=>loadSlantRound(level,puzzle));
 const [tool,setTool]=useState<'cycle'|-1|0|1>('cycle');
 const [hint,setHint]=useState<{cell:number;value:number}|null>(null);
 const [saved,setSaved]=useState(true);
 const cells=useRef<(HTMLButtonElement|null)[]>([]), completed=useRef(false);
 const callbacks=useRef({onComplete,onStatus}); callbacks.current={onComplete,onStatus};
 const tokens=useRef({resetToken,hintToken,undoToken,level});
 const won=slantWon(puzzle,state.board), filled=state.board.filter(Boolean).length;
 useEffect(()=>{
  if(tokens.current.level===level && tokens.current.resetToken===resetToken)return;
  const changedLevel=tokens.current.level!==level;
  tokens.current={resetToken,hintToken,undoToken,level}; completed.current=false;setHint(null);
  setState(changedLevel?loadSlantRound(level,puzzle):newSlantState(puzzle));
 },[level,puzzle,resetToken,hintToken,undoToken]);
 useEffect(()=>{setSaved(saveSlantRound(level,state,puzzle));},[level,state,puzzle]);
 useEffect(()=>{
  if(won&&!completed.current){completed.current=true;callbacks.current.onStatus('森林连起来了！每个数字都满足，而且没有任何闭环。');callbacks.current.onComplete();}
  else if(!won&&!hint)callbacks.current.onStatus(`每格画一条斜线，让相连线段数等于顶点数字，并避免闭环。已填 ${filled}/${state.board.length} 格。`);
 },[won,filled,state.board]);
 useEffect(()=>{
  if(tokens.current.undoToken===undoToken)return;tokens.current.undoToken=undoToken;
  if(paused||won)return;setHint(null);setState(current=>undoSlant(puzzle,current));
 },[undoToken,paused,won,puzzle]);
 useEffect(()=>{
  if(tokens.current.hintToken===hintToken)return;tokens.current.hintToken=hintToken;
  if(paused||won)return;
  const next=slantHint(puzzle,state.board);setHint(next.cell<0?null:next);callbacks.current.onStatus(next.message);
 },[hintToken,paused,won,puzzle,state.board]);
 function place(index:number,value?:number){if(paused||won)return;setHint(null);setState(current=>playSlant(puzzle,current,index,value??(tool==='cycle'?(current.board[index]===0?-1:current.board[index]===-1?1:0):tool)));}
 return <div className="slant-layout" data-slant-won={won}>
  <section className="slant-play" aria-label="斜线森林棋盘">
   <div className="slant-heading"><div><span className="slant-eyebrow">第 {puzzle.chapter+1} 章 · {chapter.title}</span><h3>一笔一径，连成森林</h3></div><span className="slant-round">{String(level+1).padStart(3,'0')} / {slantLevels.length}</span></div>
   <div className="slant-stats"><span><strong>{filled}</strong> / {state.board.length} 格</span><span><strong>{state.moves}</strong> 笔操作</span><span>{paused?'已暂停':won?'森林完成':chapter.advanced?'反向推演':'逻辑传播'}</span></div>
   <div className="slant-tools" role="group" aria-label="画线工具">
    {([['cycle','循环画线'],[-1,'反斜线 \\'],[1,'正斜线 /'],[0,'橡皮擦']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={tool===value} disabled={paused||won} onClick={()=>setTool(value)}>{label}</button>)}
   </div>
   <div className="slant-scroll" tabIndex={0} role="region" aria-label="可滚动棋盘，大棋盘可向右或向下滚动">
    <div className="slant-board" style={{'--slant-width':puzzle.width,'--slant-height':puzzle.height} as CSSProperties}>
     <div className="slant-cells">
      {state.board.map((value,index)=><button key={index} type="button" ref={el=>{cells.current[index]=el;}} className={`slant-cell ${hint?.cell===index?'is-hinted':''}`} data-cell={index} data-value={value} disabled={paused||won} aria-label={`第 ${Math.floor(index/puzzle.width)+1} 行第 ${index%puzzle.width+1} 列，${value===0?'空白':value===-1?'反斜线':'正斜线'}`} onClick={event=>{if(!event.ctrlKey&&!event.metaKey&&!event.altKey)place(index);}} onKeyDown={event=>{
       if(event.ctrlKey||event.metaKey||event.altKey||paused||won)return;
       const x=index%puzzle.width,y=Math.floor(index/puzzle.width);
       const next=event.key==='ArrowLeft'?y*puzzle.width+Math.max(0,x-1):event.key==='ArrowRight'?y*puzzle.width+Math.min(puzzle.width-1,x+1):event.key==='ArrowUp'?Math.max(0,y-1)*puzzle.width+x:event.key==='ArrowDown'?Math.min(puzzle.height-1,y+1)*puzzle.width+x:-1;
       if(next>=0){event.preventDefault();cells.current[next]?.focus({preventScroll:true});cells.current[next]?.scrollIntoView({block:'nearest',inline:'nearest'});}
       else if(['/', '\\','Backspace','Delete'].includes(event.key)){event.preventDefault();place(index,event.key==='/'?1:event.key==='\\'?-1:0);}
      }}><svg viewBox="0 0 48 48" aria-hidden="true">{value!==0&&<line x1={value===-1?0:48} y1="0" x2={value===-1?48:0} y2="48"/>}{hint?.cell===index&&!value&&<line className="slant-ghost" x1={hint.value===-1?0:48} y1="0" x2={hint.value===-1?48:0} y2="48"/>}</svg><span className="slant-cell-number" aria-hidden="true">{index+1}</span></button>)}
     </div>
     {puzzle.clues.map((clue,i)=>clue<0?null:<span key={i} className="slant-clue" style={{left:16+(i%(puzzle.width+1))*48,top:16+Math.floor(i/(puzzle.width+1))*48}} aria-label={`顶点第 ${Math.floor(i/(puzzle.width+1))+1} 行第 ${i%(puzzle.width+1)+1} 列，需要 ${clue} 条线`}>{clue}</span>)}
    </div>
   </div>
   <p className="slant-caption">点一下：空白 → ＼ → ／ → 空白。大棋盘可以滚动，格子始终保持 48 像素。</p>
   <p className="slant-save" role="note">{saved?'当前关卡和每一笔都保存在此浏览器，可随时离开再继续。':'浏览器暂时无法保存这一局，请保持页面打开。'}</p>
  </section>
  <aside className="slant-notes"><span className="slant-eyebrow">连接 · 推理 · 无环</span><h3>数字是路口，<br/>斜线是小径。</h3><p>每格恰好放一条斜线。圆圈里的数字，表示有几条线碰到这个顶点。没有数字的顶点也可以连线。</p>
   <div className="slant-demo" aria-label="规则示意：每格画一条斜线，围成圈的路径不允许"><svg viewBox="0 0 200 82" aria-hidden="true"><path d="M12 16L48 52L84 16 M112 34L138 8L164 34L138 60Z"/><circle cx="48" cy="52" r="13"/><text x="48" y="57">2</text><text x="48" y="79">数字相符</text><text x="138" y="79">闭环不允许</text></svg></div>
   <div className="slant-lesson" aria-label="本章练习"><strong>第 {puzzle.chapter+1} 章 · {chapter.title}</strong><p>{chapter.lesson}</p><p>本章 {level-chapter.start+1} / {chapter.count} 关 · 共 {slantChapters.length} 章</p></div>
   <p>所有数字对上还不够：任何地方都不能围成圈。提示只标出经当前局面推演可确定的一笔，不会替你落子。</p>
   <details><summary>键盘操作与难度说明</summary><p>方向键移动焦点，/ 或 \\ 画线，Enter 或空格循环，Backspace 擦除。浏览器快捷键照常使用。</p><p>前三章可用数字传播与闭环排除完成；后三章直接传播会停住，需要比较假设。本项目分级不等同于原版 Easy/Hard。</p></details>
  </aside>
 </div>;
}
