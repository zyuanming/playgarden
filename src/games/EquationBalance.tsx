// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useRef,useState} from 'react';
import type {GameProps} from '../lib/types';
import {equationLevels} from './equationBalanceLevels';
import {EQUATION_SAVE,applyCard,cardLabel,readEquation,replay,routeFrom,show,signed,solved,type Terms} from './equationBalanceLogic';
import './equationBalance.css';

const intro='选一张牌，预览两边同时操作后的结果。目标是左边只剩一个 x。';
function Scales({terms,preview=false}:{terms:Terms;preview?:boolean}){
  const tray=(x:number,u:number,name:string)=><div className="eq-tray">
    <small>{name}</small><div><b data-eq-negative={x<0}>{signed(x)} x 片</b><b data-eq-negative={u<0}>{signed(u)} 单位片</b></div>
  </div>;
  return <div className={'eq-scales'+(preview?' eq-projection':'')}>
    {tray(terms[0],terms[1],'左盘')}<span aria-hidden="true">=</span>{tray(terms[2],terms[3],'右盘')}
  </div>;
}
export default function EquationBalance(props:GameProps){
  return <Round key={props.level+':'+props.resetToken} {...props}/>;
}
function Round({level,paused,freshStart,hintToken,undoToken,onComplete,onStatus}:GameProps){
  const p=equationLevels[level]??equationLevels[0];
  const key=EQUATION_SAVE+'.round.'+level;
  const [history,setHistory]=useState<string[]>(()=>{
    try{return freshStart?[]:readEquation(p,localStorage.getItem(key));}catch{return [];}
  });
  const state=replay(p,history)!;
  const [pick,setPick]=useState<string|null>(null);
  const [message,setMessage]=useState(history.length?'已恢复本机等式和用牌记录。':intro);
  const [suggestion,setSuggestion]=useState('');
  const [saved,setSaved]=useState(true);
  const c=useRef({onStatus,onComplete});c.current={onStatus,onComplete};
  const tokens=useRef({hintToken,undoToken,won:false});
  const win=solved(state.terms),locked=paused||win,left=p.budget-history.length;
  const card=p.cards.find(x=>x.id===pick);
  const result=card&&!history.includes(card.id)?applyCard(state.terms,card):null;
  function report(s:string){setMessage(s);c.current.onStatus(s);}
  useEffect(()=>{c.current.onStatus(message);},[]);
  useEffect(()=>{
    try{localStorage.setItem(key,JSON.stringify({id:p.id,history}));setSaved(true);}catch{setSaved(false);}
  },[history,key,p.id]);
  useEffect(()=>{
    if(!win||paused||tokens.current.won)return;
    tokens.current.won=true;
    c.current.onStatus('等式解开：'+show(state.terms)+'。');
    c.current.onComplete();
  },[paused,win,state.terms]);
  useEffect(()=>{
    if(tokens.current.hintToken===hintToken)return;
    tokens.current.hintToken=hintToken;if(locked)return;
    const route=routeFrom(p,state);
    if(route?.length){
      setPick(route[0]);setSuggestion(route[0]);
      report('已预览牌 '+route[0]+'。沿一条可行路线还需 '+route.length+' 步，未用牌。');
    }else{
      setSuggestion('');
      report('现有顺序用掉了需要的步骤，剩余卡牌和步数无法解开。请撤销。');
    }
  },[hintToken,locked,p,state]);
  useEffect(()=>{
    if(tokens.current.undoToken===undoToken)return;
    tokens.current.undoToken=undoToken;if(locked)return;
    const last=history.at(-1);
    if(!last){report('还没有可以撤销的用牌。');return;}
    setHistory(history.slice(0,-1));setPick(null);setSuggestion('');
    report('已撤销，等式、卡牌和步数一并恢复。');
  },[undoToken,locked,history]);
  function commit(){
    if(locked||left<1||!card||!result||'blocked' in result)return;
    setHistory([...history,card.id]);setPick(null);setSuggestion('');
    if(!solved(result.terms))report(left===1?'步数已用完，还没单独留下 x。可以撤销。':'两边都用了 '+cardLabel(card)+'，等式依然成立。');
  }

  return <div className="puzzle-layout eq-game" data-eq-id={p.id} data-eq-terms={state.terms.join(',')}
    data-eq-history={history.join('')} data-eq-left={left} data-eq-hint={suggestion} data-eq-won={win}>
    <section className="eq-panel" aria-label="等式工作台">
      <header className="eq-head"><div><small>代数工坊 · 第 {level+1} 关</small><h3>{p.title}</h3></div><b>剩余 {left} / {p.budget} 步</b></header>
      <h4 className="eq-expression" data-eq-current>{show(state.terms)}</h4>
      <Scales terms={state.terms}/>
      <div className="eq-cards" role="group" aria-label="任选一张操作牌">
        {p.cards.map(c=>{
          const used=history.includes(c.id);
          return <button key={c.id} type="button" data-eq-card={c.id} data-used={used}
            aria-label={'牌 '+c.id+' '+cardLabel(c)+(used?' 已用':'')} aria-pressed={pick===c.id}
            onClick={()=>{setPick(c.id);setSuggestion('');}} disabled={locked||used||left<1}>
            <small>{c.id}{used?' · 已用':''}</small><strong>{cardLabel(c)}</strong>
          </button>;
        })}
      </div>
      <section className="eq-preview" aria-label="操作预览">
        <h4>预览 · {card?'两边同时 '+cardLabel(card):'先选操作牌'}</h4>
        {result&&'terms' in result
          ? <><p data-eq-projection>{show(result.terms)}</p><Scales terms={result.terms} preview/><small>确认后剩余 {left-1} 步</small></>
          : <p className={result?'eq-problem':''}>{result&&'blocked'in result?result.blocked+' 这局只用整枚筹码；普通代数可以有分数。':'预览和提示不会消耗卡牌。'}</p>}
      </section>
      <button className="eq-apply" type="button" data-eq-apply disabled={locked||left<1||!result||'blocked'in result} onClick={commit}>确认用牌</button>
      <p className="eq-message" role="status">{paused?'已暂停。':win?'等式解开：'+show(state.terms)+'。':message}</p>
      {history.length>0&&<ol className="eq-log" aria-label="用牌记录">
        {history.map((id,i)=><li key={id}><b>{i+1}. {cardLabel(p.cards.find(c=>c.id===id)!)}</b><span>{show(replay(p,history.slice(0,i+1))!.terms)}</span></li>)}
      </ol>}
      {!saved&&<small>浏览器无法保存本局，刷新后可能丢失。</small>}
    </section>
    <aside className="game-notes">
      <span className="mini-label">等价变形 · 操作顺序</span><h3>两边一起变，等式不变。</h3>
      <ol><li>每张牌对左右两盘做同一种操作，只能用一次。x 片和单位片分别记数；负数表示负的项。</li>
        <li>这里除法要能把每类片分成完整等组。普通代数可以出现分数，游戏里用整片表示。</li>
        <li>在预算内，让左边只剩一个正的 x，右边只剩单位数。走偏可撤销或用提示。</li></ol>
      <p>点卡片查看预览，再确认；电脑也可以用 Tab 和空格。</p>
    </aside>
  </div>;
}
