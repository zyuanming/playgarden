// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useRef,useState} from "react";
import type {GameProps} from "../lib/types";
import {inspectStory,moveStory,storyHint,storySequenceLevels} from "./storySequenceLogic";
import "./storySequence.css";
export default function StorySequence(props:GameProps){return <Round key={`${props.level}:${props.resetToken}`} {...props}/>;}
function Round({level,paused,hintToken,undoToken,onStatus,onComplete}:GameProps){
 const story=storySequenceLevels[level]??storySequenceLevels[0];
 const [order,setOrder]=useState(()=>[...story.initial]),[selected,setSelected]=useState(story.initial[0]),[history,setHistory]=useState<number[][]>([]),[hint,setHint]=useState<ReturnType<typeof storyHint>>(null),[review,setReview]=useState(false);
 const seenHint=useRef(hintToken),seenUndo=useRef(undoToken),done=useRef(false),check=inspectStory(story,order),locked=paused||check.won;
 const selectedPosition=order.indexOf(selected),firstBroken=check.links.findIndex(v=>!v);
 useEffect(()=>{onStatus("把打乱的句子排成完整故事。选择句子后，用上移、下移调整；也可在句子上直接按方向键。");},[]);
 useEffect(()=>{if(seenHint.current===hintToken)return;seenHint.current=hintToken;if(locked)return;const h=storyHint(story,order);setHint(h);if(h){setSelected(h.id);onStatus(h.text);}},[hintToken,locked,story,order,onStatus]);
 useEffect(()=>{if(seenUndo.current===undoToken)return;seenUndo.current=undoToken;if(locked)return;if(history.length){setOrder(history.at(-1)!);setHistory(history.slice(0,-1));setHint(null);setReview(false);}else onStatus("还没有移动可以撤销。");},[undoToken,locked,history,onStatus]);
 useEffect(()=>{if(check.won&&!paused&&!done.current){done.current=true;onStatus("先后与因果都连起来了，故事完整了！");onComplete();}},[check.won,paused,onStatus,onComplete]);
 function move(id:number,delta:-1|1){if(locked)return;const next=moveStory(order,id,delta);if(next===order)return;setHistory([...history,order]);setOrder(next);setSelected(id);setHint(null);setReview(false);}
 return <div className="puzzle-layout ss-game" data-story-order={order.join(",")} data-story-won={check.won} data-story-moves={history.length}>
  <section className="ss-paper" aria-label="故事句条排序"><header><span className="mini-label">故事排序 · {story.theme}</span><span>{history.length} 次移动</span></header><h3>{story.title}</h3><p className="ss-subtitle">把句条排成一条清楚的时间线。</p>
   <ol className="ss-strips">{order.map((id,position)=><li key={id}><span className="ss-number" aria-hidden="true">{position+1}</span><button data-story-card={id} disabled={locked} aria-pressed={selected===id} className={`${selected===id?"ss-selected":""} ${hint?.id===id?"ss-hinted":""}`} onClick={()=>setSelected(id)} onKeyDown={e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;if(e.key==="ArrowUp"||e.key==="ArrowDown"){e.preventDefault();move(id,e.key==="ArrowUp"?-1:1);}}}>{story.sentences[id]}</button></li>)}</ol>
   <div className="ss-controls"><button data-story-up disabled={locked||selectedPosition===0} onClick={()=>move(selected,-1)}>↑ 上移所选句</button><button data-story-down disabled={locked||selectedPosition===order.length-1} onClick={()=>move(selected,1)}>↓ 下移所选句</button><button data-story-review disabled={locked} onClick={()=>setReview(true)}>检查先后关系</button></div>
   <p className="ss-feedback" role="status">{paused?"已暂停，句条暂时锁定。":check.won?story.ending:hint?.text??(review&&firstBroken>=0?`${check.satisfied}/${check.links.length} 条先后关系正确。再想一想：${story.reasons[firstBroken]}`:`已选第 ${selectedPosition+1} 句。留意“先”“之后”以及事情发生的原因。`)}</p>
  </section><aside className="game-notes"><span className="mini-label">时间 · 因果 · 阅读</span><h3>让故事一步一步发生。</h3><p>每张句条都是原创故事的一部分。它们可以移动，但句子里的事实不会改变。</p><ol><li>先读完句条，找出故事的起点和结果。</li><li>点击句条，再按上移或下移。键盘也能 Tab 选择句条，直接按 ↑ ↓ 调整。</li><li>用“检查先后关系”获得具体的因果反馈；提示会指出当前应移到哪里的一句话。</li></ol><p>通关需要每一条先后关系成立。没有倒计时，可以反复读、尝试与撤销。</p><div className="ss-flower" aria-hidden="true">✿</div></aside>
 </div>;
}
