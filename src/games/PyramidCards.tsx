// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { pyramidCardsLevels, pyramidExposed, pyramidHint, pyramidInitial, pyramidMove, pyramidRank, pyramidWon, type PyramidAction, type PyramidState } from "./pyramidCardsLogic";
import "./pyramidCards.css";
export default function PyramidCards(props:GameProps) { return <Round key={`${props.level}:${props.resetToken}`} {...props}/>; }
function Round({level,paused,hintToken,undoToken,onStatus,onComplete}:GameProps) {
  const config = pyramidCardsLevels[level] ?? pyramidCardsLevels[0];
  const [state,setState] = useState(pyramidInitial), [history,setHistory] = useState<PyramidState[]>([]), [selected,setSelected] = useState<number|null>(null), [hint,setHint] = useState<ReturnType<typeof pyramidHint>|null>(null), [feedback,setFeedback] = useState("先找到两张不被压住、点数合计 13 的牌。K 可单独移走。");
  const seenHint=useRef(hintToken), seenUndo=useRef(undoToken), done=useRef(false);
  const won=pyramidWon(config,state), locked=paused||won;
  useEffect(()=>{ onStatus("两张露出的牌合为 13 即可移除；K 单独移除。清空整座金字塔获胜。"); },[]);
  useEffect(()=>{ if(seenHint.current===hintToken)return;seenHint.current=hintToken;if(locked)return;const next=pyramidHint(config,state);setHint(next);setSelected(null);setFeedback(next.text);onStatus(next.text); },[hintToken,locked,config,state,onStatus]);
  useEffect(()=>{ if(seenUndo.current===undoToken)return;seenUndo.current=undoToken;if(locked)return;if(history.length){setState(history[history.length-1]);setHistory(history.slice(0,-1));setSelected(null);setHint(null);setFeedback("已恢复上一步，连同储备牌和废牌一起恢复。");}else setFeedback("还没有可以撤销的移牌。"); },[undoToken,locked,history]);
  useEffect(()=>{if(won&&!paused&&!done.current){done.current=true;onStatus("金字塔清空！你打开了通往塔顶的每条路。");onComplete();}},[won,paused,onStatus,onComplete]);
  function act(action:PyramidAction){if(locked)return;const next=pyramidMove(config,state,action);if(!next)return;setHistory([...history,state]);setState(next);setSelected(null);setHint(null);setFeedback(action.kind==="draw"?"翻出一张储备牌。旧废牌不再可用，但可以撤销。":"移除成功。看看上方是否有新牌露出来。");}
  function pick(cell:number){if(locked||!(cell<0?state.waste!==null:pyramidExposed(config,state,cell)))return;const rank=cell<0?state.waste!:config.cards[cell];if(rank===13){act({kind:"remove",cards:[cell]});return;}if(selected===cell){setSelected(null);setFeedback("已取消选择。");return;}if(selected===null){setSelected(cell);setFeedback(`已选 ${pyramidRank(rank)}，还需要 ${pyramidRank(13-rank)}。`);return;}const action:PyramidAction={kind:"remove",cards:[selected,cell]};if(pyramidMove(config,state,action)){act(action);}else{setSelected(cell);setFeedback("这两张合计不是 13；已改选刚点击的牌。");}}
  const hinted=(i:number)=>hint?.action?.kind==="remove"&&hint.action.cards.includes(i);
  return <div className="puzzle-layout pyrcard-game" data-pyramid-state={JSON.stringify(state)} data-pyramid-won={won} data-pyramid-moves={history.length}>
    <section className="pyrcard-table" aria-label="金字塔纸牌牌桌"><header><span className="mini-label">PYRAMID · {config.title}</span><strong>已清 {config.cards.filter((_,i)=>state.removed&(1<<i)).length}/{config.cards.length}</strong></header>
      <div className="pyrcard-pyramid">{Array.from({length:config.rows},(_,r)=><div className="pyrcard-row" key={r}>{Array.from({length:r+1},(_,c)=>{const i=r*(r+1)/2+c, removed=Boolean(state.removed&(1<<i)), exposed=pyramidExposed(config,state,i);return <button key={i} data-pyramid-card={i} className={`pyrcard-card ${removed?"pyrcard-removed":""} ${!exposed?"pyrcard-covered":""} ${selected===i?"pyrcard-selected":""} ${hinted(i)?"pyrcard-hinted":""}`} disabled={locked||!exposed} onClick={()=>pick(i)} aria-pressed={selected===i} aria-label={`第 ${i+1} 张，${pyramidRank(config.cards[i])}，${removed?"已移除":exposed?"可用":"被下方两张牌覆盖"}`}><span>{removed?"·":pyramidRank(config.cards[i])}</span><small>{removed?"空位":!exposed?"锁住":`#${i+1}`}</small></button>;})}</div>)}</div>
      <div className="pyrcard-stock"><button className={`pyrcard-draw ${hint?.action?.kind==="draw"?"pyrcard-hinted":""}`} disabled={locked||state.stockIndex>=config.stock.length} onClick={()=>act({kind:"draw"})}>翻储备牌<span>剩 {config.stock.length-state.stockIndex} 张</span></button><button data-pyramid-waste className={`pyrcard-card ${selected===-1?"pyrcard-selected":""} ${hinted(-1)?"pyrcard-hinted":""}`} disabled={locked||state.waste===null} onClick={()=>pick(-1)} aria-pressed={selected===-1} aria-label={`废牌，${state.waste===null?"空":pyramidRank(state.waste)}`}><span>{state.waste===null?"·":pyramidRank(state.waste)}</span><small>废牌</small></button><p>只用最上面的废牌<br/>不循环，不回收</p></div>
      <p className="pyrcard-feedback" role="status">{paused?"已暂停，牌桌已锁定。":won?"整座金字塔已清空，花园开门啦！":feedback}</p>
    </section><aside className="game-notes pyrcard-notes"><span className="mini-label">观察覆盖 · 配对十三</span><h3>先开路，再找搭档。</h3><p>{config.lesson}</p><ol><li>A=1，J=11，Q=12，K=13。两张合为 13，或单张 K，可以移走。</li><li>牌的下方两张直接支撑都被移除，它才可使用。露出的不同层可以配对。</li><li>翻牌会丢弃旧废牌。储备牌只有一轮；塔清空即获胜，储备牌无需用完。</li></ol><p>原创微型教学牌组，共 8 课，每课 6–10 张塔牌。不是完整 52 张牌的随机牌局；花色不参与规则。</p><p>点按操作；Tab 定位，Enter / 空格选牌。提示从当前牌桌寻找通关路线；走入死路可撤销。</p></aside>
  </div>;
}
