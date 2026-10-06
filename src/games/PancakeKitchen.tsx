import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameProps } from '../lib/types';
import { pancakeChapters, pancakeLevels } from './pancakeLevels';
import { createPancakeState, flipPancakes, getPancakeHint, isPancakeSolved, playPancake, undoPancake } from './pancakeLogic';
import { loadPancakeRound, savePancakeRound } from './pancakeStorage';
import './pancakeKitchen.css';
const intro = '小在上、大在下就成功。先点第 2 层或更低的一层，预览它和上方整段，再点同层或“确认翻转”。';
export default function PancakeKitchen(props: GameProps) {
  const key = `${props.level}:${props.resetToken}`;
  const round = useRef({ key, level: props.level, fresh: false });
  if (round.current.key !== key) round.current = { key, level: props.level, fresh: round.current.level === props.level };
  return <PancakeRound key={key} {...props} fresh={Boolean(props.freshStart || round.current.fresh)} />;
}
function PancakeRound({level, paused, hintToken, undoToken, onComplete, onStatus, fresh}: GameProps & {fresh:boolean}) {
  const puzzle = pancakeLevels[level] ?? pancakeLevels[0], chapter = pancakeChapters[puzzle.chapter];
  const [state, setState] = useState(() => fresh ? createPancakeState(puzzle) : loadPancakeRound(level, puzzle));
  const [selected, setSelected] = useState<number | null>(null), [cursor, setCursor] = useState(2);
  const [saved, setSaved] = useState(true), [message, setMessage] = useState(intro), [hintKind, setHintKind] = useState('');
  const buttons = useRef<(HTMLButtonElement | null)[]>([]), completed = useRef(false), tokens = useRef({hintToken, undoToken});
  const callbacks = useRef({onComplete,onStatus}); callbacks.current={onComplete,onStatus};
  const won = isPancakeSolved(state.stack), preview = selected === null ? null : flipPancakes(state.stack, selected);
  function report(text:string) {setMessage(text); callbacks.current.onStatus(text);}
  useEffect(() => {setSaved(savePancakeRound(level,puzzle,state));}, [level,puzzle,state]);
  useEffect(() => {callbacks.current.onStatus(intro);}, []);
  useEffect(() => {
    if(!won || paused || completed.current)return;
    completed.current=true;
    report(state.moves===puzzle.minMoves ? `整叠排好了！用了 ${state.moves} 次，刚好达到这关的最少步数。` : `整叠排好了！用了 ${state.moves} 次。开局最少 ${puzzle.minMoves} 次，有兴趣可以重来再优化。`);
    callbacks.current.onComplete();
  },[won,paused,state.moves,puzzle.minMoves]);
  useEffect(() => {
    if(tokens.current.undoToken===undoToken)return; tokens.current.undoToken=undoToken;
    if(paused||won)return;
    setState(current=>undoPancake(current)); setSelected(null);setHintKind('');
    report(state.history.length?'已撤销一次翻转，整叠回到刚才的顺序。':'还没有可撤销的翻转。点选预览不会改变顺序。');
  },[undoToken,paused,won,state.history.length]);
  useEffect(() => {
    if(tokens.current.hintToken===hintToken)return;tokens.current.hintToken=hintToken;
    if(paused||won)return;
    const hint=getPancakeHint(state.stack);setHintKind(hint.kind);report(hint.reason);
    if(hint.kind==='move'){setSelected(hint.count);setCursor(hint.count);buttons.current[hint.count]?.focus({preventScroll:true});}
  },[hintToken,paused,won,state.stack]);
  function commit(count:number) {
    if(paused||won)return;
    const next=playPancake(state,count);if(next===state)return;
    setState(next);setSelected(null);setHintKind('');buttons.current[count]?.focus({preventScroll:true});
    report(`已翻转上方 ${count} 片。现在从上到下是 ${next.stack.join('、')}。`);
  }
  function choose(count:number) {
    if(paused||won)return;setCursor(count);setHintKind('');
    if(selected===count){commit(count);return;}
    setSelected(count);report(`选中上方 ${count} 片：${state.stack.slice(0,count).join('、')}。它们会倒转，下面的 ${state.stack.length-count} 片保持原位。再点第 ${count} 层或“确认翻转”。`);
  }
  return <div className="pancake-layout" data-pancake-won={won} data-pancake-hint={hintKind} onKeyDown={event=>{if((event.ctrlKey||event.metaKey||event.altKey)&&['Enter',' '].includes(event.key))event.preventDefault();}}>
    <section className="pancake-play" aria-label="煎饼翻排游戏">
      <header className="pancake-heading"><div><span className="pancake-eyebrow">第 {puzzle.chapter+1} 章 · {chapter.title}</span><h3>{puzzle.title}</h3></div><span>{String(level+1).padStart(3,'0')} / {pancakeLevels.length}</span></header>
      <p className="pancake-lesson" data-pancake-chapter={puzzle.chapter}>{chapter.lesson}</p>
      <div className="pancake-stats"><span>已翻 <strong data-pancake-moves>{state.moves}</strong> 次</span><span>开局最少 <strong>{puzzle.minMoves}</strong> 次</span><span>{paused?'已暂停':won?'排好了 ✓':'超步也能通关'}</span></div>
      <div className="pancake-stack-label"><strong>顶部 · 小饼在上</strong><span>数字越大，饼越大</span></div>
      <div className="pancake-stack" role="group" aria-label="煎饼堆，方向键选择层数，Enter 或空格预览和确认">
        {state.stack.map((size,index)=>{
          const count=index+1, highlighted=selected!==null&&count<=selected;
          const contents=<><span className="pancake-range" aria-hidden="true">{highlighted?'↕':'·'}</span><span className="pancake-cake-zone"><span className="pancake-cake" style={{'--cake-width':`${34+66*size/state.stack.length}%`} as CSSProperties}><strong>{size}</strong><span className="pancake-speckles" aria-hidden="true">···</span></span></span><span className="pancake-layer">第 {count} 层{count===1?<small>从下层选</small>:<small>{selected===count?'再点确认':'翻到这里'}</small>}</span></>;
          const cls=`pancake-row ${highlighted?'is-in-range':''} ${selected===count?'is-boundary':''}`;
          return count===1?<div className={cls} key={count} data-pancake-slot={count} data-size={size} data-in-range={highlighted} aria-label={`第 1 层，大小 ${size}，单片不需翻转`}>{contents}</div>:<button type="button" key={count} className={cls} ref={el=>{buttons.current[count]=el;}} data-pancake-slot={count} data-pancake-flip={count} data-size={size} data-in-range={highlighted} disabled={paused||won} aria-pressed={selected===count} aria-label={`第 ${count} 层，大小 ${size}，翻转上方 ${count} 片${selected===count?'，已选中，再次确认':''}`} tabIndex={cursor===count?0:-1} onFocus={()=>setCursor(count)} onClick={event=>{if(!event.ctrlKey&&!event.metaKey&&!event.altKey)choose(count);}} onKeyDown={event=>{
            if(event.ctrlKey||event.metaKey||event.altKey){if(['Enter',' '].includes(event.key))event.preventDefault();return;}
            if(paused||won)return;
            const next=event.key==='ArrowUp'?Math.max(2,count-1):event.key==='ArrowDown'?Math.min(state.stack.length,count+1):event.key==='Home'?2:event.key==='End'?state.stack.length:-1;
            if(next>=2){event.preventDefault();setCursor(next);buttons.current[next]?.focus({preventScroll:true});}
          }}>{contents}</button>;
        })}
      </div>
      <div className="pancake-plate" aria-hidden="true"/><p className="pancake-bottom">底部 · 大饼在下</p>
      <div className="pancake-confirm" role="group" aria-label="翻转预览操作"><button type="button" className="primary" disabled={paused||won||selected===null} onClick={event=>{if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&selected!==null)commit(selected);}}>确认翻转{selected===null?'':` ${selected} 片`}</button><button type="button" disabled={paused||won||selected===null} onClick={event=>{if(event.ctrlKey||event.metaKey||event.altKey)return;if(selected!==null)buttons.current[selected]?.focus({preventScroll:true});setSelected(null);setHintKind('');report('已取消预览，顺序没有改变。');}}>取消选择</button></div>
      <div className="pancake-preview" aria-label="翻转后的顺序预览"><strong>{selected===null?'选一层，先看会怎样翻':'翻转后 · 从上到下'}</strong><div className="pancake-preview-order" role="img" aria-label={preview?`翻转后从上到下：${preview.join('、')}`:'尚未选择翻转范围'}>{(preview??state.stack).map((size,index)=><span key={index} className={preview&&index<selected!?'will-flip':''}>{size}{index<state.stack.length-1&&<i aria-hidden="true">↓</i>}</span>)}</div><p>{selected===null?'第 2 层起都可以选；一次只翻上方整段。':`上方 ${selected} 片倒序 · 下方 ${state.stack.length-selected} 片不动`}</p></div>
      <p className="pancake-message" role="note">{message}</p>
      <p className="pancake-save">{saved?'这一局和撤销记录保存在此浏览器，可离开后继续。':'当前这一局暂时无法保存，请保持页面打开；仍可以继续玩和撤销。'}</p>
    </section>
    <aside className="pancake-notes"><span className="pancake-eyebrow">顺序 · 反转 · 规划</span><h3>翻一叠，<br/>换个顺序。</h3><p>每片大小都不同。把它们排成 1 在最上面、最大的在最下面，就能端上桌。</p><div className="pancake-goal" aria-label={`目标从上到下：${state.stack.map((_,i)=>i+1).join('、')}`}><span>目标 ↑ 顶</span>{state.stack.map((_,i)=><i key={i} style={{width:`${34+66*(i+1)/state.stack.length}%`}}>{i+1}</i>)}<span>底 ↓</span></div><ol><li>点一层，虚线标出会翻动的整段。</li><li>看看预览，再点同层或“确认翻转”。</li><li>排好了就成功。未完成时可以撤销，也可以重来。</li></ol><p>“开局最少”是完整搜索验证的最短步数，只作参考。没有步数上限，也不计时。</p><details><summary>键盘与提示</summary><p>Tab 进入煎饼堆，上下方向键换层，Home / End 到两端；Enter 或空格第一次选中、第二次确认。也可 Tab 到确认或取消。Escape 暂停/继续。</p><p>提示查询当前排列的精确最短距离，只预选下一步，不自动替你翻。数字与宽度共同表达大小，不需要分辨颜色。</p></details></aside>
  </div>;
}
