// SPDX-License-Identifier: GPL-3.0-only
import { useEffect,useRef,useState } from 'react';
import type { GameProps } from '../lib/types';
import { appointmentLevels } from './appointmentPlannerLevels';
import { APPOINTMENT_SAVE,blank,clock,nextPlan,predict,readAgenda,replayDay,sites,walk,type Task } from './appointmentPlannerLogic';
import './appointmentPlanner.css';
const intro='先选活动，看看走路、等待和结束时间，再加入日程。';
export default function AppointmentPlanner(props:GameProps){
  return <AgendaRound key={props.level+':'+props.resetToken} {...props}/>;
}
function AgendaRound({level,freshStart,paused,hintToken,undoToken,onStatus,onComplete}:GameProps){
  const d=appointmentLevels[level]??appointmentLevels[0];
  const key=APPOINTMENT_SAVE+'.round.'+level;
  const [agenda,setAgenda]=useState(()=>{
    try{return freshStart?blank():readAgenda(d,localStorage.getItem(key));}catch{return blank();}
  });
  const [picked,setPicked]=useState<string|null>(null);
  const [message,setMessage]=useState(agenda.order.length?'已恢复本机日程。':intro);
  const [saved,setSaved]=useState(true);
  const [suggested,setSuggested]=useState('');
  const refs=useRef({onStatus,onComplete});refs.current={onStatus,onComplete};
  const tokens=useRef({hintToken,undoToken,won:false});
  const p=replayDay(d,agenda.order)!;
  const won=p.left.length===0&&(!d.back||agenda.returned),locked=paused||won;
  const task=p.left.find(t=>t.id===picked);
  const forecast=task?predict(p.site,p.time,task,d.cutoff):null;
  const forecastHome=forecast&&p.left.length===1&&d.back?forecast.end+walk(forecast.task.site,'H'):null;
  function report(s:string){setMessage(s);refs.current.onStatus(s);}
  useEffect(()=>{refs.current.onStatus(message);},[]);
  useEffect(()=>{
    try{localStorage.setItem(key,JSON.stringify({id:d.id,...agenda}));setSaved(true);}
    catch{setSaved(false);}
  },[agenda,d.id,key]);
  useEffect(()=>{
    if(!won||paused||tokens.current.won)return;
    tokens.current.won=true;
    refs.current.onStatus(d.back?'所有活动完成，'+clock(p.home)+' 已回礼堂。':'所有活动完成，结束时间 '+clock(p.time)+'。');
    refs.current.onComplete();
  },[won,paused,d.back,p.home,p.time]);
  useEffect(()=>{
    if(tokens.current.undoToken===undoToken)return;
    tokens.current.undoToken=undoToken;if(locked)return;
    const last=agenda.order.at(-1);
    setSuggested('');
    if(!last){report('还没有可以撤销的安排。');return;}
    setAgenda({order:agenda.order.slice(0,-1),returned:false});
    setPicked(last);report('已撤销最后一项，地点和时间一并恢复。');
  },[undoToken,locked,agenda]);
  useEffect(()=>{
    if(tokens.current.hintToken===hintToken)return;
    tokens.current.hintToken=hintToken;if(locked)return;
    const route=nextPlan(d,p.site,p.time,p.left);
    if(!route){
      setSuggested('');
      if(!p.left.length&&d.back){
        report('从'+sites[p.site].name+'走回礼堂需 '+walk(p.site,'H')*5+' 分钟，预计 '+clock(p.home)+'，已超过截止时间。请撤销。');return;
      }
      const missed=p.left.find(t=>!predict(p.site,p.time,t,d.cutoff).legal);
      report(missed?'剩余活动 '+missed.id+'（'+missed.name+'）已来不及按时完成。请撤销。':'从当前安排已无法按时完成全部活动。请撤销。');
      return;
    }
    if(!route.length){setSuggested('return');report('活动都完成了，可以按时回礼堂。');return;}
    setSuggested(route[0]);setPicked(route[0]);report('已预览一项能继续完成日程的活动。尚未加入。');
  },[hintToken,locked,d,p]);
  function select(t:Task){
    if(locked)return;
    setPicked(t.id);setSuggested('');
  }
  function add(){
    if(locked||!forecast?.legal)return;
    setAgenda({order:[...agenda.order,forecast.task.id],returned:false});
    setPicked(null);setSuggested('');
    report(p.left.length===1&&d.back?'全部活动已排好。检查回到礼堂的时间。':'已安排 '+forecast.task.id+'，结束时间 '+clock(forecast.end)+'。');
  }
  function finishHome(){
    if(locked||!p.canReturn)return;
    setAgenda({...agenda,returned:true});setSuggested('');
  }
  return <div className="puzzle-layout ap-game" data-ap-id={d.id} data-ap-order={agenda.order.join('')}
    data-ap-time={p.time} data-ap-won={won} data-ap-picked={picked??''} data-ap-hint={suggested}
    data-ap-return={d.back&&!p.left.length?p.home:''} data-ap-returned={agenda.returned}>
    <section className="ap-panel" aria-label="活动规划">
      <header className="ap-heading"><div><small>校园活动 · 第 {level+1} 关</small><h3>{d.title}</h3></div><strong>{agenda.order.length} / {d.tasks.length} 项</strong></header>
      <div className="ap-clock">
        <div><small>当前位置</small><strong>{sites[agenda.returned?'H':p.site].name}</strong></div>
        <div><small>现在</small><strong>{clock(agenda.returned?p.home:p.time)}</strong></div>
        <div><small>{d.back?'回礼堂截止':'日程截止'}</small><strong>{clock(d.cutoff)}</strong></div>
      </div>
      {p.left.length>0 && <section className="ap-picks" aria-label="待安排的活动">
        <h4>待安排 <small>窗口内要完成，不能只在关门前开始</small></h4>
        <div className="ap-cards">
          {p.left.map(t=><button type="button" key={t.id} data-ap-task={t.id} aria-pressed={picked===t.id} disabled={locked}
            onClick={()=>select(t)}>
            <b>{t.id} · {t.name}</b><span>{sites[t.site].name} · {t.duration*5} 分钟</span><small>{clock(t.open)}–{clock(t.close)}</small>
          </button>)}
        </div>
      </section>}
      {forecast&&<section className="ap-preview" aria-label="活动预览" data-ap-preview={forecast.task.id} data-ap-start={forecast.start}
        data-ap-end={forecast.end} data-ap-legal={forecast.legal}>
        <h4>预览 · {forecast.task.name}</h4>
        <dl>
          <div><dt>步行 {forecast.walk*5} 分钟</dt><dd>{clock(forecast.depart)} → {clock(forecast.arrive)}</dd></div>
          <div><dt>等待 {forecast.wait*5} 分钟</dt><dd>{clock(forecast.arrive)} → {clock(forecast.start)}</dd></div>
          <div><dt>活动 {forecast.task.duration*5} 分钟</dt><dd>{clock(forecast.start)} → {clock(forecast.end)}</dd></div>
        </dl>
        {!forecast.legal&&<p className="ap-error">预计 {clock(forecast.end)} 结束，{sites[forecast.task.site].name} {clock(forecast.task.close)} 关门，日程截止 {clock(d.cutoff)}。</p>}
        {forecastHome!==null&&<p className={forecastHome>d.cutoff?'ap-error':''}>若加入这项，预计 {clock(forecastHome)} 回到礼堂；截止 {clock(d.cutoff)}。</p>}
      </section>}
      {p.left.length>0&&<button type="button" className="ap-primary" data-ap-add disabled={locked||!forecast?.legal} onClick={add}>加入日程</button>}
      {d.back&&p.left.length===0&&<section aria-label="回礼堂时间" className="ap-return" data-late={p.home>d.cutoff}>
        <h4>{agenda.returned?'已回到礼堂':'返程 · 回到礼堂'}</h4>
        <p>从{sites[p.site].name}步行 {walk(p.site,'H')*5} 分钟</p>
        <div className="ap-compare"><div><small>{agenda.returned?'实际到达':'预计到达'}</small><strong>{clock(p.home)}</strong></div>
          <div><small>回礼堂截止</small><strong>{clock(d.cutoff)}</strong></div></div>
        <p className={p.home>d.cutoff?'ap-error':''}>{p.home>d.cutoff?'晚了 '+(p.home-d.cutoff)*5+' 分钟，不能完成。请撤销调整顺序。':p.home===d.cutoff?'恰好准时。':'能按时到达。'}</p>
        <button type="button" className="ap-primary" data-ap-back disabled={locked||!p.canReturn} onClick={finishHome}>确认返回礼堂</button>
      </section>}
      <p className="ap-message" role="status">{paused?'已暂停。':won?'日程完成！':message}</p>
      <section className="ap-agenda" aria-label="已安排的活动">
        <h4>已安排</h4>
        {p.stops.length===0?<p>从 09:00 的礼堂出发。</p>:<ol>{p.stops.map(s=><li key={s.task.id}
          data-ap-stop={s.task.id} data-ap-start={s.start} data-ap-end={s.end}>
          <b>{s.task.id} · {s.task.name}</b><time>{clock(s.start)}–{clock(s.end)}</time>
          <small>走 {s.walk*5} 分钟 · 等 {s.wait*5} 分钟</small>
        </li>)}</ol>}
      </section>
      {!saved&&<small>浏览器无法保存这一局，刷新后可能丢失。</small>}
    </section>
    <aside className="game-notes">
      <span className="mini-label">时间窗口 · 路程 · 次序</span><h3>排完，不代表来得及回去。</h3>
      <p>活动都在同一条校园路上：礼堂 ─ 10 分钟 ─ 图书馆 ─ 5 分钟 ─ 工作室 ─ 10 分钟 ─ 花园。</p>
      <ol><li>点活动先预览。到早了自动等开门；放进日程后才会推进时间。</li>
        <li>必须在关门前做完，结束时间等于关门也算准时。</li>
        <li>有返程的关卡，还得走回礼堂。走偏可撤销，提示只做预览。</li></ol>
    </aside>
  </div>;
}
