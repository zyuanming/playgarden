import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import type {GameProps} from '../lib/types';
import {ataxxLevels} from './ataxxLevels';
import {ATAXX_SAVE,apply,captures,counts,distance,goalText,legal,outcome,parseSave,point,replay,stage,start,type Move,type Position} from './ataxxLogic';
import {chooseAI,quickMove,solveLesson,type SearchResult} from './ataxxSearch';
import './ataxxGarden.css';
const chapters=['第一颗孢子','落点涟漪','看过回击','两手合围','三手终章'];
export default function AtaxxGarden(props:GameProps){
  const key=`${props.freePlay}:${props.level}:${props.resetToken}`;
  const round=useRef({key,level:props.level,free:props.freePlay,fresh:false});
  if(round.current.key!==key)round.current={key,level:props.level,free:props.freePlay,fresh:round.current.level===props.level&&round.current.free===props.freePlay};
  return <AtaxxRound key={key} {...props} freshStart={props.freshStart||round.current.fresh}/>;
}
function AtaxxRound({level,freePlay=false,paused,freshStart,hintToken,undoToken,onComplete,onStatus}:GameProps){
  const lesson=freePlay?undefined:(ataxxLevels[level]??ataxxLevels[0]),id=lesson?.id??'free',initial=useMemo(()=>start(lesson),[lesson]);
  const intro=lesson?goalText(lesson.goal):'绿方先行，你与本地轻量电脑对弈。先点绿子，再点空格预览，确认后移动。';
  const saveKey=`${ATAXX_SAVE}.round.${freePlay?'free':level}`;
  const [history,setHistory]=useState<Move[]>(()=>{try{return parseSave(freshStart?null:localStorage.getItem(saveKey),initial,id,lesson);}catch{return [];}});
  const p=useMemo(()=>replay(initial,history,lesson)??initial,[initial,history,lesson]),end=outcome(p),phase=lesson?stage(lesson,history,p):'playing';
  const [selected,setSelected]=useState<number|null>(null),[pending,setPending]=useState<Move>(null),[message,setMessage]=useState(intro),[thinking,setThinking]=useState(false),[saved,setSaved]=useState(true);
  const [hidden,setHidden]=useState(()=>typeof document!=='undefined'&&document.hidden),[hintRequest,setHintRequest]=useState(0);
  const state=useRef({p,history,pending,selected,locked:false});
  const locked=paused||hidden||end!==null||phase!=='playing'||p.turn!==1;
  state.current={p,history,pending,selected,locked};
  const callbacks=useRef({onComplete,onStatus});callbacks.current={onComplete,onStatus};
  const tokens=useRef({hintToken,undoToken}),complete=useRef(false),handledHint=useRef(0),buttons=useRef<(HTMLButtonElement|null)[]>([]);
  const [green,plum]=counts(p),converted=pending?captures(p,pending):[];
  function report(text:string){setMessage(text);callbacks.current.onStatus(text);}
  function commit(next:Move[]){
    const nextP=replay(initial,next,lesson);if(!nextP)return;
    state.current={p:nextP,history:next,pending:null,selected:null,locked:paused||hidden||nextP.turn!==1||outcome(nextP)!==null||(lesson?stage(lesson,next,nextP)!=='playing':false)};
    setHistory(next);setSelected(null);setPending(null);
  }
  useEffect(()=>{callbacks.current.onStatus(intro);},[]);
  useEffect(()=>{const update=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  useEffect(()=>{try{localStorage.setItem(saveKey,JSON.stringify({id,history}));setSaved(true);}catch{setSaved(false);}},[history,id,saveKey]);
  useEffect(()=>{
    if(paused||hidden)return;
    if(phase==='success'&&!complete.current){complete.current=true;report('这一课完成！可以进入下一关，或到自由对弈里试试完整一盘。');callbacks.current.onComplete();}
    else if(phase==='retry')report('这次还没达到目标。可以撤销整回合，观察回击后再试；也可以重来。');
    else if(freePlay&&end!==null)report(end===0?'和局。用上方“重来”开始新一盘。':`${end===1?'绿方':'紫方'}获胜，最终 ${green} : ${plum}。用上方“重来”再来一盘。`);
  },[phase,end,paused,hidden,freePlay,green,plum]);
  useEffect(()=>{
    if(tokens.current.undoToken===undoToken)return;tokens.current.undoToken=undoToken;
    if(paused||hidden||complete.current)return;
    const h=state.current.history;let q=initial,last=-1;
    for(let i=0;i<h.length;i++){if(q.turn===1)last=i;q=apply(q,h[i]);}
    if(last>=0){commit(h.slice(0,last));report('已撤销你的上一手，以及随后紫方的回击。');}
  },[undoToken,paused,hidden]);
  useEffect(()=>{if(tokens.current.hintToken===hintToken)return;tokens.current.hintToken=hintToken;if(!state.current.locked)setHintRequest(v=>v+1);},[hintToken]);
  // One cancellable task belongs to one exact position. Pause, hide, undo,
  // restart, mode/level changes and unmount terminate the worker and timer.
  useEffect(()=>{
    setThinking(false);
    if(paused||hidden||phase!=='playing'||end!==null)return;
    const reply=p.turn===2;
    if(!reply&&hintRequest===handledHint.current)return;
    if(!reply)handledHint.current=hintRequest;
    let active=true,worker:Worker|undefined;let watchdog:ReturnType<typeof setTimeout>|undefined;
    setThinking(true);
    function deliver(result:SearchResult,fallback=false){
      if(!active)return;active=false;worker?.terminate();if(watchdog)clearTimeout(watchdog);setThinking(false);
      if(state.current.p!==p||paused||hidden)return;
      if(reply){
        // At this point hold lessons have a one-ply exact, finite reply tree.
        if(result.kind==='budget'&&lesson?.goal.kind==='hold')result=solveLesson(lesson,p,history);
        const move=result.kind==='answer'?result.move:quickMove(p);
        if(!legal(p,move)){report('电脑未能给出合法移动。请撤销或重来。');return;}
        commit([...history,move]);
        report(move===null?'紫方没有合法落点，本回合跳过。轮到绿方。':`紫方${distance(move.from,move.to,p.size)===1?'复制':'跳跃'}到${point(move.to,p.size)}，转化 ${captures(p,move).length} 枚绿子。${fallback?'本次使用本地备用分析。':''}轮到绿方。`);
      }else{
        if(result.kind==='budget'){report('分析达到预算，暂时没有可靠提示；这不表示无解。');return;}
        if(lesson&&result.value<=0){report('当前局面没有能保证完成本课目标的走法。可以撤销上一回合再试。');return;}
        const move=result.move;
        if(!legal(p,move)){report('暂时没有可用提示。');return;}
        if(move===null){report('绿方没有合法落点，点“跳过回合”让紫方继续。');return;}
        setSelected(move.from);setPending(move);state.current.selected=move.from;state.current.pending=move;
        report(`${lesson?'当前局面的完整目标搜索':'有限深度策略建议'}：从${point(move.from,p.size)}${distance(move.from,move.to,p.size)===1?'复制':'跳跃'}到${point(move.to,p.size)}。先看转化预览，再按“确认移动”。${freePlay?'这不是必胜保证。':''}`);
        buttons.current[move.to]?.focus({preventScroll:true});
      }
    }
    function fallback(){worker?.terminate();const result=lesson?solveLesson(lesson,p,history,40000,200):chooseAI(p,1500,35);deliver(result,true);}
    const timer=setTimeout(()=>{
      if(!active)return;
      try{
        worker=new Worker(new URL('./ataxx.worker.ts',import.meta.url),{type:'module'});
        worker.onmessage=e=>deliver(e.data.result as SearchResult);
        worker.onerror=()=>fallback();
        worker.postMessage({id:1,p,history,lesson});
        watchdog=setTimeout(fallback,1600);
      }catch{fallback();}
    },reply?240:0);
    return()=>{active=false;clearTimeout(timer);if(watchdog)clearTimeout(watchdog);worker?.terminate();};
  },[p,history,lesson,paused,hidden,phase,end,hintRequest]);
  function cellClick(i:number){
    const now=state.current;if(now.locked)return;
    if(now.p.board[i]===1){const next=now.selected===i?null:i;setSelected(next);setPending(null);now.selected=next;now.pending=null;report(next===null?'已取消选择。':`已选${point(i,p.size)}。实心小点可复制，空心小圈可跳跃。`);return;}
    if(now.selected===null){report('先选择一枚绿子，再选择空地。');return;}
    const move={from:now.selected,to:i};
    if(!legal(now.p,move)){report('这里不能落脚：请选择距离一格或两格的空地。');return;}
    now.pending=move;setPending(move);report(`预览${distance(move.from,move.to,p.size)===1?'复制：原位保留':'跳跃：原位腾空'}，会转化 ${captures(p,move).length} 枚紫子。按“确认移动”落下这一手。`);
  }
  function confirm(){const now=state.current;if(now.locked||now.pending===null||!legal(now.p,now.pending))return;const move=now.pending;now.pending=null;commit([...now.history,move]);}
  const canPass=!locked&&legal(p,null);
  return <div className="ataxx-layout" data-ataxx-id={id} data-ataxx-history={JSON.stringify(history)} data-ataxx-board={p.board.join(',')} data-ataxx-turn={p.turn} data-ataxx-phase={phase} data-ataxx-end={end??''} onKeyDown={e=>{if((e.ctrlKey||e.metaKey||e.altKey)&&['Enter',' '].includes(e.key))e.preventDefault();}}>
    <section className="ataxx-play" aria-label="胞子争园棋局">
      <header className="ataxx-heading"><div><span className="ataxx-eyebrow">{lesson?`第 ${lesson.chapter+1} 章 · ${chapters[lesson.chapter]}`:'ATAXX · 一盘小小的生长竞赛'}</span><h3>{lesson?.title??'这片花园，由你开局'}</h3></div><span className="ataxx-count">{lesson?`${String(level+1).padStart(2,'0')} / 30`:'7 × 7'}</span></header>
      <p className="ataxx-goal">{intro}</p>
      <div className="ataxx-score" aria-label={`绿方${green}枚，紫方${plum}枚`}><span><i className="ataxx-token green" aria-hidden="true">✦</i>绿方 · 你 <strong>{green}</strong></span><span><strong>{plum}</strong>紫方 · 电脑<i className="ataxx-token plum" aria-hidden="true">◆</i></span></div>
      <div className="ataxx-score-track" aria-hidden="true"><i style={{width:`${100*green/(green+plum||1)}%`}}/></div>
      <div className="ataxx-turn">{paused?'已暂停':hidden?'离开页面，棋局暂停':phase==='success'?'本课完成':phase==='retry'?'再想一手':end!==null?end===0?'和局':end===1?'绿方获胜':'紫方获胜':thinking?p.turn===2?'紫方正在想一手…':'正在分析提示…':p.turn===1?'轮到绿方，慢慢想':'轮到紫方'}<span>第 {history.length+1} 手</span></div>
      <div className="ataxx-board" role="group" aria-label={`${p.size}乘${p.size}孢子棋盘`} style={{'--ataxx-size':p.size} as CSSProperties}>
        {p.board.map((cell,i)=>{const d=selected===null?0:distance(selected,i,p.size),reachable=selected!==null&&cell===0&&d>0&&d<=2,preview=pending?.to===i,changed=converted.includes(i);return <button type="button" key={i} data-cell={i} data-owner={cell} ref={el=>{buttons.current[i]=el;}} disabled={locked||cell===-1} className={`ataxx-cell ${cell===-1?'gap':''} ${selected===i?'selected':''} ${reachable?d===1?'clone-target':'jump-target':''} ${preview?'preview':''} ${changed?'converts':''}`} aria-pressed={selected===i||preview} aria-label={`${point(i,p.size)}，${cell===-1?'石头':cell===0?'空地':cell===1?'绿子':'紫子'}${reachable?d===1?'，可复制':'，可跳跃':''}${preview?'，预览落点':''}${changed?'，将转为绿色':''}`} onClick={()=>cellClick(i)} onKeyDown={e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const delta=({ArrowLeft:-1,ArrowRight:1,ArrowUp:-p.size,ArrowDown:p.size} as Record<string,number>)[e.key];if(!delta)return;e.preventDefault();let next=i+delta;while(next>=0&&next<p.board.length&&(Math.abs(delta)!==1||Math.floor(next/p.size)===Math.floor(i/p.size))){if(p.board[next]!==-1){buttons.current[next]?.focus({preventScroll:true});break;}next+=delta;}}}>
          <span className="ataxx-coordinate" aria-hidden="true">{Math.floor(i/p.size)+1},{i%p.size+1}</span>
          {cell===1||cell===2?<span className={`ataxx-piece ${cell===1?'green':'plum'}`} aria-hidden="true">{cell===1?'✦':'◆'}</span>:cell===-1?<span className="ataxx-rock" aria-hidden="true"/>:preview?<span className="ataxx-ghost" aria-hidden="true">✦</span>:reachable?<span className="ataxx-target" aria-hidden="true"/>:null}
          {changed&&<span className="ataxx-flip" aria-hidden="true">↻</span>}
        </button>;})}
      </div>
      <div className="ataxx-actions"><button type="button" className="ataxx-confirm" disabled={locked||pending===null} onClick={confirm}>确认移动{pending?` · ${distance(pending.from,pending.to,p.size)===1?'复制':'跳跃'}`:''}</button><button type="button" disabled={locked||selected===null} onClick={()=>{state.current.pending=null;state.current.selected=null;setPending(null);setSelected(null);report('预览已取消，棋盘没有改变。');}}>取消选择</button>{canPass&&<button type="button" onClick={()=>{const now=state.current;if(!now.locked&&legal(now.p,null))commit([...now.history,null]);}}>跳过回合</button>}</div>
      <div className="ataxx-legend"><span>● 一格复制</span><span>○ 两格跳跃</span><span>↻ 将被转化</span><span>石头不可落脚</span></div>
      <p className="ataxx-message" role="status">{message}</p>
    </section>
    <aside className="ataxx-notes"><span className="ataxx-eyebrow">GROW · LEAP · TURN</span><h3>一步生，两步移</h3><div className="ataxx-rule-card"><b>01 · 复制</b><p>相邻八格内生出一枚新孢子，原位仍然保留。</p><b>02 · 跳跃</b><p>两格远的空地也能到达，但原位会腾空。可以跨过石头和其他棋子。</p><b>03 · 转化</b><p>落点周围八格内的所有对方棋子变成你的颜色，不需要夹住。</p></div>{lesson?<p className="ataxx-lesson-tip">{lesson.tip}</p>:<p className="ataxx-lesson-tip">抢得更多，也要留下安全的后方。一步吃很多，不一定能躲过下一手回击。</p>}<details><summary>终局与操作说明</summary><p>一方没有棋子，或双方都无法移动时，数实际棋子，多者获胜，同数和局。只有一方无步则跳过。若连续 100 手没有复制且仍有合法移动，则和局；转化不会重置计数。</p><p>方向键移动焦点，Enter / 空格选择；移动需另按确认。暂停会停止电脑分析，离开页面也会暂停。撤销退回你的上一手之前。</p><p>自由对弈使用有时间和节点上限的本地轻量电脑，不保证最优。练习的提示只分析当前局面，不会自动代下。</p></details><p className="ataxx-save">{saved?'当前棋局已保存在本机。':'当前无法保存，离开后可能丢失这盘棋。'}</p></aside>
  </div>;
}
