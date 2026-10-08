import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameProps } from '../lib/types';
import { signpostLevels } from './signpostLevels';
import { SIGNPOST_SAVE, DIRECTIONS, DIRECTION_NAMES, initialSignpost, inspectSignpost, linkSignpost, unlinkSignpost, parseSignpostSave, pointsTo, solveSignpost } from './signpostLogic';
import './signpostGarden.css';
const chapters=['顺着路标','远近之间','数字驿站','交错岔路','完整旅途'];
const intro='先点任意格作为起点，再点它箭头方向上的另一格。可以跨格，也可以先拼接路线中段。';
export default function SignpostGarden(props:GameProps){
  const key=`${props.level}:${props.resetToken}`,round=useRef({key,level:props.level,fresh:false});
  if(round.current.key!==key)round.current={key,level:props.level,fresh:round.current.level===props.level};
  return <SignpostRound key={key} {...props} freshStart={props.freshStart||round.current.fresh}/>;
}
function SignpostRound({level,paused,freshStart,hintToken,undoToken,onComplete,onStatus}:GameProps){
  const p=signpostLevels[level]??signpostLevels[0],n=p.width*p.height;
  const [history,setHistory]=useState(()=>{try{return parseSignpostSave(freshStart?null:localStorage.getItem(`${SIGNPOST_SAVE}.round.${level}`),p);}catch{return [initialSignpost(p)];}});
  const state=history[history.length-1],check=inspectSignpost(p,state),blocked=paused||check.won;
  const [selected,setSelected]=useState<number|null>(null),[hint,setHint]=useState<number|null>(null),[message,setMessage]=useState(intro),[saved,setSaved]=useState(true);
  const callbacks=useRef({onComplete,onStatus});callbacks.current={onComplete,onStatus};
  const tokens=useRef({hintToken,undoToken}),completed=useRef(false),cells=useRef<(HTMLButtonElement|null)[]>([]);
  const coord=(i:number)=>`${Math.floor(i/p.width)+1}行${i%p.width+1}列`;
  function report(s:string){setMessage(s);callbacks.current.onStatus(s);}
  useEffect(()=>{callbacks.current.onStatus(intro);},[]);
  useEffect(()=>{try{localStorage.setItem(`${SIGNPOST_SAVE}.round.${level}`,JSON.stringify({id:p.id,history}));setSaved(true);}catch{setSaved(false);}},[p,level,history]);
  useEffect(()=>{if(check.won&&!paused&&!completed.current){completed.current=true;setSelected(null);setHint(null);report(`路标贯通！1 到 ${n} 的每一格都恰好经过一次。`);callbacks.current.onComplete();}},[check.won,paused,n]);
  useEffect(()=>{if(tokens.current.undoToken===undoToken)return;tokens.current.undoToken=undoToken;if(blocked)return;setHistory(h=>h.length>1?h.slice(0,-1):h);setHint(null);setSelected(null);report('已撤销上一次连线或断开。');},[undoToken,blocked]);
  useEffect(()=>{if(tokens.current.hintToken===hintToken)return;tokens.current.hintToken=hintToken;if(blocked)return;setHint(null);const r=solveSignpost(p,state);
    if(r.kind==='budget')report('搜索达到预算，暂时没有可靠建议；这不代表无解。');
    else if(r.kind==='none')report('当前几段连线无法组成完整路线。请撤销最近的尝试，或选中一格并断开出线。');
    else{const from=state.findIndex((v,i)=>v!==r.state[i]);if(from>=0){setSelected(from);setHint(r.state[from]);report(`搜索当前连线得到兼容完整路线：从${coord(from)}连接到${coord(r.state[from])}。这是搜索建议，点虚线框目标确认，不会自动代填。`);cells.current[r.state[from]]?.focus({preventScroll:true});}}
  },[hintToken,blocked,p,state]);
  function save(next:number[]){setHistory(h=>[...h.slice(-499),next]);setHint(null);}
  function click(i:number){
    if(blocked)return;
    if(selected===null){setSelected(i);setHint(null);report(p.clues[i]===n?`${coord(i)}是终点 ${n}，没有出线。可从其他格连入。`:`已选${coord(i)}。请点箭头${DIRECTION_NAMES[p.arrows[i]]}方的目标，或再点本格取消选择。`);return;}
    if(selected===i){setSelected(null);setHint(null);report('已取消选择，可以从任意格重新起笔。');return;}
    const r=linkSignpost(p,state,selected,i);
    if(r.state===state){report(r.reason);return;}
    save(r.state);setSelected(r.state[i]===-1&&p.clues[i]!==n?i:null);
    report(`已连接${coord(selected)} → ${coord(i)}。${r.state[i]===-1&&p.clues[i]!==n?'可沿新选中格继续；也可点“换个起点”拼接别处。':'可选任意格继续拼接。'}`);
  }
  function disconnect(){if(blocked||selected===null)return;const next=unlinkSignpost(p,state,selected);if(next!==state){save(next);report(`已断开${coord(selected)}的出线，其他连线保留。`);}}
  return <div className="signpost-layout" data-signpost-id={p.id} data-signpost-state={state.join(',')} data-signpost-selected={selected??''} data-signpost-won={check.won} onKeyDown={e=>{if((e.ctrlKey||e.metaKey||e.altKey)&&['Enter',' '].includes(e.key))e.preventDefault();}}>
    <section className="signpost-play" aria-label="箭头路标棋局">
      <header className="signpost-heading"><div><span className="signpost-eyebrow">第 {p.chapter+1} 章 · {chapters[p.chapter]}</span><h3>{p.title}</h3></div><span>{String(level+1).padStart(2,'0')} / 30</span></header>
      <p className="signpost-intro">把所有格子连成 1 → {n}。箭头给方向，固定数字给路程。</p>
      <div className="signpost-stats"><span>已连 <strong>{check.links}</strong> / {n-1} 段</span><span>{p.width} × {p.height} 路标图</span></div>
      <div className="signpost-toolbar"><button type="button" disabled={blocked||selected===null} onClick={()=>{setSelected(null);setHint(null);report('请选择新的起点，可以先连接路线中段。');}}>换个起点</button><button type="button" disabled={blocked||selected===null||state[selected]<0} onClick={disconnect}>断开出线</button><span>{selected===null?'① 选起点 → ② 点目标':`已选 ${coord(selected)}`}</span></div>
      <div className="signpost-board" style={{'--signpost-width':p.width} as CSSProperties} role="group" aria-label={`${p.width}乘${p.height}箭头棋盘`}>
        {p.arrows.map((direction,i)=>{const ray=selected!==null&&pointsTo(p,selected,i),active=selected===i;
          return <button type="button" key={i} ref={el=>{cells.current[i]=el;}} data-cell={i} data-label={check.labels[i]} className={`signpost-cell ${p.clues[i]?'fixed':''} ${active?'selected':''} ${ray?'ray':''} ${hint===i?'hint':''} ${state[i]>=0?'linked':''}`} disabled={blocked} aria-pressed={active} aria-label={`${coord(i)}，${p.clues[i]?`固定数字${p.clues[i]}`:`编号${check.labels[i]}`}，${direction<0?'终点':`箭头向${DIRECTION_NAMES[direction]}`}，${state[i]>=0?`出线到${coord(state[i])}`:'无出线'}，${check.prev[i]>=0?`来路为${coord(check.prev[i])}`:'无来路'}${ray?'，在所选箭头方向上':''}`} onClick={()=>click(i)} onKeyDown={e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const d=({ArrowLeft:-1,ArrowRight:1,ArrowUp:-p.width,ArrowDown:p.width} as Record<string,number>)[e.key];if(!d)return;e.preventDefault();const j=i+d;if(j>=0&&j<n&&(Math.abs(d)!==1||Math.floor(j/p.width)===Math.floor(i/p.width)))cells.current[j]?.focus({preventScroll:true});}}>
            <span className="signpost-coordinate" aria-hidden="true">{Math.floor(i/p.width)+1},{i%p.width+1}</span>
            <strong aria-hidden="true">{check.labels[i]}</strong>
            <span className="signpost-arrow" aria-hidden="true">{direction<0?'●':DIRECTIONS[direction]}</span>
            <span className="signpost-tags" aria-hidden="true">{p.clues[i]?'固定':state[i]>=0?'已连':''}{check.prev[i]>=0?' · 入':''}</span>
          </button>;
        })}
      </div>
      <div className="signpost-legend"><span>粗框：固定数字</span><span>浅底：箭头射线</span><span>A1、A2：同段相邻编号</span></div>
      <p className="signpost-message" role="status">{message}</p>
      {check.links>0&&<details className="signpost-links"><summary>查看已连路线（{check.links} 段）</summary><ul>{state.map((to,i)=>to>=0?<li key={i}>{coord(i)} → {coord(to)}<span>{check.labels[i]} → {check.labels[to]}</span></li>:null)}</ul></details>}
    </section>
    <aside className="signpost-notes"><span className="signpost-eyebrow">SIGNPOST · 路线手记</span><h3>方向确定，距离由你</h3><ol><li>每格恰好用一次，连成从 1 到 {n} 的一条路线。</li><li>出发格的箭头指向下一格。目标可以很远，中间经过的格子不算走过。</li><li>粗框数字固定。例如 4 和 7 之间必须恰好经过两格。</li><li>每格最多一条来路、一条去路，路线不能成环。终点 ● 没有出线。</li></ol><p>可以从中段拼起。A1 → A2 表示暂未确定绝对数字的一段；接到固定数字后会自动编号。</p><p>浅色格仅表示方向相符，不保证可完成。明显冲突会拒绝；更深的错误要用撤销、断开或提示检查。</p><p>Enter / 空格操作，方向键移动焦点。点所选格取消，或用“换个起点”。暂停、重来、撤销和提示在上方。</p><p className="signpost-save">{saved?'当前局面已保存在本机，保留最近 500 步。':'当前无法保存，离开后可能丢失这局。'}</p></aside>
  </div>;
}
