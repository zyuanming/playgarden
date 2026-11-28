// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useRef,useState} from "react";
import type {GameProps} from "../lib/types";
import {boothMatchLevels} from "./boothMatchLevels";
import {booths,conflicts,moveTeam,rankTotal,teams,type BoothBoard} from "./boothMatchLogic";
import "./boothMatch.css";

const intro="先选一支队伍，再选它要去的展台。";
const victory="配对稳定！没有队伍和展台同时想换到对方。";
export default function BoothMatch(props:GameProps) {
  return <Round key={props.level+":"+props.resetToken} {...props}/>;
}
function Round({level,paused,hintToken,undoToken,onComplete,onStatus}:GameProps) {
  const board:BoothBoard=boothMatchLevels[level]??boothMatchLevels[0];
  const count=board.teams.length;
  const [seats,setSeats]=useState<number[]>(()=>Array(count).fill(-1));
  const [history,setHistory]=useState<number[][]>([]);
  const [selected,setSelected]=useState<number|null>(null);
  const [inspect,setInspect]=useState<number|null>(null);
  const [showReport,setShowReport]=useState(false);
  const [won,setWon]=useState(false);
  const [message,setMessage]=useState(intro);
  const seen=useRef({hintToken,undoToken});
  const live=useRef({onComplete,onStatus});
  live.current={onComplete,onStatus};
  const placed=seats.filter(n=>n>=0).length;
  const locked=paused||won;
  const total=rankTotal(board,seats);
  const blocking=showReport?conflicts(board,seats)[0]:undefined;
  function report(text:string){setMessage(text);live.current.onStatus(text);}
  function review(submit:boolean){
    if(locked) return;
    if(placed<count){
      setShowReport(false);
      if(!submit){
        const next=seats.indexOf(-1);
        setSelected(next);
        setInspect(null);
      }
      report("还有 "+(count-placed)+" 支队伍没入场。先把每个展台配齐。");
      return;
    }
    const blocked=conflicts(board,seats)[0];
    setShowReport(!!blocked);
    if(blocked){
      setSelected(blocked.team);
      setInspect(blocked.booth);
      report(teams[blocked.team]+"与"+booths[blocked.booth]+"都想换到对方。");
    }else if(submit){
      setWon(true);
      report(victory);
      live.current.onComplete();
    }else report("没有一对同时想换。提交后才算通关。");
  }
  useEffect(()=>{live.current.onStatus(intro);},[]);
  useEffect(()=>{
    if(seen.current.hintToken!==hintToken){seen.current.hintToken=hintToken;review(false);}
    if(seen.current.undoToken!==undoToken){
      seen.current.undoToken=undoToken;
      if(!locked && history.length){
        setSeats(history[history.length-1]);
        setHistory(history.slice(0,-1));
        setSelected(null);
        setInspect(null);
        setShowReport(false);
        report("已撤销上一次配对。");
      }
    }
  });
  function pick(team:number){
    if(locked) return;
    const next=selected===team?null:team;
    setSelected(next);
    setShowReport(false);
    report(next===null?intro:"已选"+teams[next]+"，再选展台。");
  }
  function place(booth:number){
    if(locked) return;
    setInspect(booth);
    if(selected===null){
      report("在下方看"+booths[booth]+"展台偏好；选队后再点展台可安排。");
      return;
    }
    if(seats[selected]===booth){
      report(teams[selected]+"已经在"+booths[booth]+"展台。");
      return;
    }
    const previous=seats[selected],occupant=seats.indexOf(booth);
    setHistory([...history.slice(-79),seats]);
    setSeats(moveTeam(seats,selected,booth));
    setSelected(null);
    setShowReport(false);
    report(occupant<0?teams[selected]+"加入"+booths[booth]+"展台。":previous<0
      ?teams[selected]+"加入"+booths[booth]+"；"+teams[occupant]+"回到待安排。"
      :teams[selected]+"与"+teams[occupant]+"交换了展台。");
  }
  function list(order:string,labels:readonly string[],current:number,suggestion:number){
    return <ol className="bm-ranks">{[...order].map((v,j)=>{
      const i=Number(v);
      return <li key={v} data-current={i===current} data-suggested={i===suggestion}
        aria-label={"第 "+(j+1)+" 名 "+labels[i]+(i===current?"，当前":i===suggestion?"，想换到":"")}>
        <span>{j+1}</span>{labels[i]}{i===current?<em>在位</em>:i===suggestion?<em>想换</em>:null}
      </li>;
    })}</ol>;
  }

  return <div className="puzzle-layout booth-match" data-board={board.id} data-seats={seats.map(n=>n<0?"_":n).join("")} data-won={won}>
    <section className="bm-panel" aria-label="展台配对操作区">
      <header className="bm-hero"><div><small>工坊市集 / {String(level+1).padStart(2,"0")}</small><h3>{board.title}</h3></div><b>{placed}/{count} 入场</b></header>
      <p className="bm-instruction">先点队伍，再点展台。两个位置都有人时，交换展台。</p>
      <div className="bm-floor">
        <div><h4>01 · 选队伍</h4>
          {board.teams.map((_,i)=><button type="button" key={i} data-team={i} aria-label={"选择"+teams[i]} aria-pressed={selected===i} data-block={blocking?.team===i}
            disabled={locked} onClick={()=>pick(i)}><strong>{teams[i]}</strong><small>{seats[i]>=0?booths[seats[i]]:"待安排"}</small></button>)}
        </div>
        <div><h4>02 · 选展台</h4>
          {board.booths.map((_,i)=>{
            const occupant=seats.indexOf(i);
            return <button type="button" key={i} data-booth={i} aria-label={"展台"+booths[i]} data-inspect={inspect===i} data-block={blocking?.booth===i}
              disabled={locked} onClick={()=>place(i)}><strong>{booths[i]}</strong><small>{occupant>=0?teams[occupant]:"空位"}</small></button>;
          })}
        </div>
      </div>
      {blocking&&<section className="bm-conflict" data-conflict={blocking.team+","+blocking.booth} aria-label="双方都想换">
        <strong>× 双方都想换</strong>
        <p data-rank-change="team">{teams[blocking.team]}：{booths[seats[blocking.team]]}（第 {blocking.teamBefore}）→ {booths[blocking.booth]}（第 {blocking.teamAfter}）</p>
        <p data-rank-change="booth">{booths[blocking.booth]}：{teams[seats.indexOf(blocking.booth)]}（第 {blocking.boothBefore}）→ {teams[blocking.team]}（第 {blocking.boothAfter}）</p>
      </section>}
      {(selected!==null||inspect!==null)&&<div className="bm-active">
        {selected!==null&&<section><h4>{teams[selected]}偏好</h4>{list(board.teams[selected],booths,seats[selected],blocking?.booth??-1)}</section>}
        {inspect!==null&&<section><h4>{booths[inspect]}展台偏好</h4>{list(board.booths[inspect],teams,seats.indexOf(inspect),blocking?.team??-1)}</section>}
      </div>}
      <details className="bm-all">
        <summary>查看双方完整名次</summary>
        <div className="bm-active">
          <section><h4>各队的偏好</h4>{board.teams.map((order,i)=><div key={i}><h5>{teams[i]}</h5>{list(order,booths,seats[i],-1)}</div>)}</section>
          <section><h4>各展台的偏好</h4>{board.booths.map((order,i)=><div key={i}><h5>{booths[i]}</h5>{list(order,teams,seats.indexOf(i),-1)}</div>)}</section>
        </div>
      </details>
      <footer className="bm-footer">
        <div><p className="bm-status" role="status">{paused?"已暂停。":message}</p>
          {total!==null&&<small>总名次 <b data-rank-total={total}>{total}</b> · 仅供参考，不决定通关</small>}</div>
        <button type="button" disabled={locked} onClick={()=>review(true)}>提交安排</button>
      </footer>
    </section>
    <aside className="game-notes bm-notes">
      <span className="mini-label">双方偏好 / 稳定匹配</span>
      <h3>一边想换，不算冲突。</h3>
      <ol><li>每支队伍恰好去一个展台，每台恰好接一队。名次越小越喜欢。</li>
        <li>队伍想去别的展台，而那个展台也更喜欢这支队伍，才算一对冲突。</li>
        <li>满员且没有这样的冲突时，提交即可。总名次再低，也不一定稳定。</li></ol>
      <p>键盘用 Tab 切换选项、Enter 选择。可用「撤销」恢复上一次安排。</p>
    </aside>
  </div>;
}
