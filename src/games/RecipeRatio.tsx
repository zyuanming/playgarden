// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useRef,useState} from "react";
import type {GameProps} from "../lib/types";
import {recipeRatioLevels} from "./recipeRatioLevels";
import {ingredients,measure,ratioLabel,sum,type Pour} from "./recipeRatioLogic";
import "./recipeRatio.css";

const start = "先填满标准勺，再为每杯选勺数。";
const complete = "每杯比例、容量和共享库存都对上了！";
export default function RecipeRatio(props: GameProps) {
  return <Round key={props.level+":"+props.resetToken} {...props}/>;
}
function Round({level,paused,hintToken,undoToken,onComplete,onStatus}: GameProps) {
  const board=recipeRatioLevels[level]??recipeRatioLevels[0];
  const names=ingredients.slice(0,board.stock.length);
  const empty=():Pour=>({mix:board.stock.map(()=>0),scoops:board.orders.map(()=>1)});
  const [pour,setPour]=useState(empty);
  const [history,setHistory]=useState<Pour[]>([]);
  const [won,setWon]=useState(false);
  const [message,setMessage]=useState(start);
  const callbacks=useRef({onComplete,onStatus});
  callbacks.current={onComplete,onStatus};
  const seen=useRef({hintToken,undoToken});
  const used=sum(pour.mix);
  const current=measure(board,pour);
  const locked=paused||won;
  const glasses=board.orders.map((_,i)=>["甲","乙","丙"][i]);
  function report(next:string){setMessage(next);callbacks.current.onStatus(next);}
  function issue(){
    if(!current.ready) return "标准勺还差 "+(board.scoopUnits-used)+" 格。";
    const short=current.stock.findIndex(n=>n<0);
    if(short>=0) return "共享库存："+names[short]+"还差 "+(-current.stock[short])+" 格。";
    const wrong=current.orders.findIndex(o=>!o.ratioOK || !o.volumeOK);
    if(wrong>=0) return glasses[wrong]+"杯"+(current.orders[wrong].ratioOK?"容量":"比例")+"还不符合订单。";
    return null;
  }
  useEffect(()=>{callbacks.current.onStatus(start);},[]);
  useEffect(()=>{
    if(seen.current.hintToken!==hintToken){
      seen.current.hintToken=hintToken;
      if(!locked) report(issue()??"三个条件都满足，按交付即可。");
    }
    if(seen.current.undoToken!==undoToken){
      seen.current.undoToken=undoToken;
      if(!locked && history.length){
        setPour(history[history.length-1]);
        setHistory(history.slice(0,-1));
        report("已撤销上一次调整。");
      }
    }
  });
  function update(key:keyof Pour,i:number,delta:number){
    if(locked) return;
    const v=pour[key][i]+delta;
    if(key==="mix" ? v<0 || delta>0 && used>=board.scoopUnits : v<1 || v>4) return;
    setHistory([...history.slice(-79),pour]);
    setPour({...pour,[key]:pour[key].map((n,j)=>i===j?v:n)});
    setMessage("已更新预览，交付前还可以调整。");
  }
  function deliver(){
    if(locked) return;
    if(!current.pass){report(issue()??start);return;}
    setWon(true);
    report(complete);
    callbacks.current.onComplete();
  }
  function stepper(key:keyof Pour,i:number,name:string){
    const n=pour[key][i];
    return <div className="rr-stepper" role="group" aria-label={name}>
      <button type="button" aria-label={"减少"+name} disabled={locked || n===(key==="mix"?0:1)} onClick={()=>update(key,i,-1)}>−</button>
      <output aria-label={name} data-control={key+"-"+i}>{n}</output>
      <button type="button" aria-label={"增加"+name} disabled={locked || (key==="mix"?used>=board.scoopUnits:n===4)} onClick={()=>update(key,i,1)}>+</button>
    </div>;
  }
  return <div className="puzzle-layout recipe-ratio" data-board={board.id} data-won={won}>
    <section className="rr-panel" aria-label="配方比例操作区">
      <header className="rr-hero"><div><small>配方工房 / {String(level+1).padStart(2,"0")}</small><h3>{board.title}</h3></div>
        <svg viewBox="0 0 96 64" aria-hidden="true"><path d="M20 27h55c-2 15-12 24-27 24S22 42 20 27Z" fill="#f3b456" stroke="#301d29" strokeWidth="3"/><path d="M70 27 91 7M32 22l-4-9m16 9V8m12 14 4-9" fill="none" stroke="#ffe5bd" strokeWidth="3" strokeLinecap="round"/><path d="M16 53h58" stroke="#ffe5bd" strokeWidth="2" strokeDasharray="3 4"/></svg>
      </header>
      <div className="rr-work">
        <div className="rr-mix">
          <h4>01 · 标准勺 <b>{used} / {board.scoopUnits} 格</b></h4>
          <div className="rr-units" aria-hidden="true">
            {Array.from({length:board.scoopUnits},(_,i)=>{
              const color=pour.mix.findIndex((_,j)=>i<sum(pour.mix.slice(0,j+1)));
              return <span key={i} data-ingredient={color} />;
            })}
          </div>
          {names.map((name,i)=><div className="rr-row" key={name}>
            <span><i data-ingredient={i}/>{name}</span>{stepper("mix",i,name)}
          </div>)}
        </div>
        <div className="rr-stock">
          <h4>02 · 共享库存</h4>
          <p>只扣本次加入的原料，不扣杯里预装的。</p>
          {names.map((name,i)=><div className="rr-row" data-stock={i} data-remaining={current.stock[i]} key={name}>
            <span><i data-ingredient={i}/>{name}</span><b>{current.stock[i]<0?"缺 "+(-current.stock[i]):"余 "+current.stock[i]} / {board.stock[i]} 格</b>
          </div>)}
        </div>
      </div>
      <h4 className="rr-orders-label">03 · 顾客订单 <small>每杯加的是同一种标准勺</small></h4>
      <div className="rr-orders">
        {board.orders.map((order,i)=>{
          const info=current.orders[i];
          return <article className="rr-order" key={i} data-order={i} data-actual={info.actual.join(",")}
              data-ratio={current.ready&&info.ratioOK} data-volume={current.ready&&info.volumeOK}>
            <h5>{glasses[i]}杯 <b>{info.total} 格</b></h5>
            <div className="rr-glass" aria-hidden="true">
              {info.actual.map((n,j)=>n>0&&<span key={j} data-ingredient={j} style={{flex:n}}/>)}
            </div>
            <p className="rr-counts">{names.map((name,j)=><span key={name}>{name} <b>{info.actual[j]}</b></span>)}</p>
            <dl>
              <div><dt>预装</dt><dd>{order.topUp.some(Boolean)?names.map((name,j)=>order.topUp[j]?name+" "+order.topUp[j]:"").filter(Boolean).join(" · "):"空杯"}</dd></div>
              <div><dt>比例</dt><dd data-check={current.ready&&info.ratioOK}>{ratioLabel(info.actual)} / 目标 {ratioLabel(order.ratio)} {current.ready?(info.ratioOK?"✓":"×"):""}</dd></div>
              <div><dt>容量</dt><dd data-check={current.ready&&info.volumeOK}>{order.volumes.join(" 或 ")} 格 {current.ready?(info.volumeOK?"✓":"×"):""}</dd></div>
            </dl>
            {stepper("scoops",i,glasses[i]+"杯勺数")}
          </article>;
        })}
      </div>
      <footer className="rr-footer"><p className="rr-status" role="status">{paused?"已暂停。":message}</p>
        <button type="button" disabled={locked} onClick={deliver}>交付</button>
      </footer>
    </section>
    <aside className="game-notes rr-notes">
      <span className="mini-label">同一种味道，不同一杯量</span>
      <h3>先调一勺，再决定倒多少。</h3>
      <p>一勺果露 3 格、茶汤 1 格，倒两勺就是 6 格和 2 格。比例仍是 3:1，总量从 4 格变成 8 格。</p>
      <div className="rr-scale" aria-label="一勺 4 格，两勺 8 格，比例都是三比一">
        {[1,2].map(k=><div key={k}><b>{k} 勺</b><div aria-hidden="true">{Array.from({length:k*4},(_,i)=><span key={i} data-ingredient={i<k*3?0:1}/>)}</div><small>{k*4} 格 · 3:1</small></div>)}
      </div>
      <p>有些杯里已有原料。它们会改变成品比例，但不占用共享库存。键盘可用 Tab 切换按钮，再按 Enter 操作。</p>
    </aside>
  </div>;
}
