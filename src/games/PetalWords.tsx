// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import { guessPetal, hintPetal, loadPetal, newPetalState, petalEnded, petalErrors, petalWon, petalWordLevels, savePetal, type PetalState } from './petalWordsLogic';
import './petalWords.css';
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export default function PetalWords(props:GameProps){return <PetalRound key={`${props.level}:${props.resetToken}`} {...props}/>;}
function PetalRound({level,paused,freshStart,hintToken,undoToken,onComplete,onStatus}:GameProps){
  const p=petalWordLevels[level]??petalWordLevels[0];
  const [s,setS]=useState(()=>freshStart?newPetalState():loadPetal(p,level));
  const [message,setMessage]=useState(p.lesson as string),[saved,setSaved]=useState(true);
  const live=useRef(s),tokens=useRef({hintToken,undoToken}),done=useRef(false),callbacks=useRef({onComplete,onStatus});callbacks.current={onComplete,onStatus};
  const errors=petalErrors(p,s),won=petalWon(p,s),ended=petalEnded(p,s);
  function report(text:string){setMessage(text);callbacks.current.onStatus(text);}
  function commit(next:PetalState){live.current=next;setS(next);}
  function guess(c:string){if(paused)return;const next=guessPetal(p,live.current,c);if(next===live.current)return;commit(next);report(p.word.includes(c)?`${c} 在花信里，所有相同位置都打开了。`:`这封花信没有 ${c}。少一片花瓣，再想想其他字母。`);}
  function hint(){if(paused)return;const before=live.current,next=hintPetal(p,before);if(next===before){report(petalEnded(p,before)?'这轮已经结束，可以重来。':'只剩一片花瓣，先自己试一试；提示不会直接让这轮失败。');return;}commit(next);report(`花瓣提示打开了 ${next.hints.at(-1)}，用去一片花瓣；它不会算作误猜。`);}
  useEffect(()=>{callbacks.current.onStatus(p.lesson);},[p]);
  useEffect(()=>{setSaved(savePetal(p,level,s));},[p,level,s]);
  useEffect(()=>{if(won&&!paused&&!done.current){done.current=true;report(`花信拼好了：${p.word}，${p.gloss}。`);callbacks.current.onComplete();}else if(ended&&!won)report(`花瓣用完了，答案是 ${p.word}（${p.gloss}）。可以撤销上一字母，或重来练习。`);},[won,ended,paused,p]);
  useEffect(()=>{if(tokens.current.hintToken!==hintToken){tokens.current.hintToken=hintToken;hint();}},[hintToken]);
  useEffect(()=>{if(tokens.current.undoToken===undoToken)return;tokens.current.undoToken=undoToken;if(paused||won)return;const last=live.current.guessed.at(-1);if(!last){report('还没有试过字母。');return;}commit({guessed:live.current.guessed.slice(0,-1),hints:live.current.hints.filter(c=>c!==last)});report(`已收回 ${last}，花瓣和字母一起恢复。`);},[undoToken,paused,won]);
  return <section className="petal-words" data-petal-game data-petal-id={p.id} data-petal-errors={errors} data-petal-guessed={s.guessed.join('')} data-petal-won={won}>
    <div className="pw-play"><header><div><span className="pw-eyebrow">A LETTER IN EVERY PETAL</span><h3>{p.gloss}的花信</h3></div><b>{level+1}<small> / 12</small></b></header>
      <p className="pw-lesson">{p.lesson}</p><div className="pw-clue"><span>这一封的线索</span><strong>{p.clue}</strong></div>
      <div className="pw-flower-row"><svg className="pw-flower" viewBox="0 0 210 205" role="img" aria-label={`还剩${Math.max(0,6-errors)}片花瓣`}><path d="M105 119V201M105 177Q61 172 71 153Q99 151 105 177" fill="#6f9b64" stroke="#46764b" strokeWidth="5"/>{[0,60,120,180,240,300].map((a,i)=><ellipse key={a} cx="105" cy="43" rx="22" ry="39" transform={`rotate(${a} 105 87)`} fill={i<6-errors?'#f3bc78':'#edf0e2'} stroke={i<6-errors?'#be874d':'#cbd4bd'} strokeWidth="2" strokeDasharray={i<6-errors?undefined:'4 5'}/>)}<circle cx="105" cy="87" r="30" fill="#fff1b3" stroke="#be874d" strokeWidth="2"/><circle cx="96" cy="84" r="3" fill="#755b33"/><circle cx="114" cy="84" r="3" fill="#755b33"/><path d="M97 96Q105 102 113 96" fill="none" stroke="#755b33" strokeWidth="2.5"/></svg><div className="pw-petals"><strong>{Math.max(0,6-errors)}<small> / 6 片花瓣</small></strong><span>误猜 {s.guessed.filter(c=>!p.word.includes(c)).length} 次 · 提示 {s.hints.length} 次</span><p>猜中不掉花瓣，重复按不会再扣。提示一次用一片。</p></div></div>
      <div className="pw-word" aria-label={`花信：${p.word.split('').map(c=>s.guessed.includes(c)||ended?c:'空格').join('，')}`}>{p.word.split('').map((c,i)=><span key={i} className={s.guessed.includes(c)?'is-open':ended?'is-answer':''} data-petal-letter={s.guessed.includes(c)||ended?c:''}>{s.guessed.includes(c)||ended?c:'·'}</span>)}</div>
      <div className="pw-keyboard" tabIndex={0} role="group" aria-label="字母花田，按键盘A到Z或点击字母" onKeyDown={e=>{if(/^[a-z]$/i.test(e.key)&&!e.repeat&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();e.stopPropagation();guess(e.key.toUpperCase());}}} onKeyDownCapture={e=>{if(e.repeat&&(e.key==='Enter'||e.key===' '))e.preventDefault();}}>
        {alphabet.map(c=><button type="button" key={c} data-petal-key={c} disabled={paused||ended||s.guessed.includes(c)} className={s.guessed.includes(c)?p.word.includes(c)?'pw-correct':'pw-absent':''} aria-label={`字母 ${c}${s.guessed.includes(c)?p.word.includes(c)?'，猜中':'，已排除':''}`} onClick={e=>{if(!e.ctrlKey&&!e.altKey&&!e.metaKey)guess(c);}}>{c}</button>)}
      </div><p className="pw-message" role="note">{message}</p><p className="pw-save">{saved?'已试字母与提示记录只保存在这个浏览器。':'浏览器暂时无法保存，请保持页面打开。'}</p>
    </div><aside className="pw-notes"><span className="pw-eyebrow">不需要抢时间</span><h3>猜一个字母，<br/>读一封花信。</h3><ol><li>看中文线索，想一想英文拼写。</li><li>每次选一个 A–Z 字母。相同字母一次全开。</li><li>花瓣用完前拼出整词，就成功了。</li></ol><div className="pw-tip"><strong>想借一片花瓣？</strong><p>上方“提示”会打开一个尚未猜中的正确字母，花费一片花瓣。剩一片且还差多个字母时，会先留给你自己尝试。</p></div><p>没有倒计时。未完成前可以撤销，包括误猜和提示；花瓣用完也可撤销，或用“重来”重新练习。</p><details><summary>键盘与保存</summary><p>Tab 进入字母花田后，直接按 A–Z。也可逐个Tab到按钮，按Enter或空格。长按不会重复猜字母。暂停会禁用字母与提示，重来会清空本关记录。</p></details></aside>
  </section>;
}
