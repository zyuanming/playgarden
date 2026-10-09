// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {GameProps} from '../lib/types';
import {tilePairsLevels,pairSymbols,tileFree,solvePairs} from './tilePairsLogic';
import './tilePairs.css';
export default function TilePairs(props:GameProps){return <Round key={`${props.level}:${props.resetToken}`} {...props}/>;}
function Round({level,paused,hintToken,undoToken,onStatus,onComplete}:GameProps){
  const puzzle=tilePairsLevels[level]??tilePairsLevels[0];const [pairs,setPairs]=useState<number[][]>([]),[selected,setSelected]=useState<number|null>(null),[hint,setHint]=useState<number[]>([]),[message,setMessage]=useState('找两张相同的自由牌：顶上没有牌，并且左边或右边至少一侧空着。');
  const callbacks=useRef({onStatus,onComplete});callbacks.current={onStatus,onComplete};const tokens=useRef({hintToken,undoToken}),done=useRef(false);const removed=pairs.flat(),won=removed.length===puzzle.tiles.length,locked=paused||won;
  function report(s:string){setMessage(s);callbacks.current.onStatus(s);}
  useEffect(()=>{if(won&&!paused&&!done.current){done.current=true;report('满庭清爽！所有牌都用相同的自由牌配对收好了。');callbacks.current.onComplete();}},[won,paused]);
  useEffect(()=>{if(tokens.current.hintToken===hintToken)return;tokens.current.hintToken=hintToken;if(locked)return;const plan=solvePairs(puzzle.tiles,removed);setHint(plan?.[0]??[]);report(plan?.length?`试试发光的两张“${pairSymbols[puzzle.tiles[plan[0][0]].symbol]}”。它们都没有被压住，并有空的一侧。`:'这次搜索没有找到清空路径。请撤销上一对，换一种配法。');},[hintToken,locked]);
  useEffect(()=>{if(tokens.current.undoToken===undoToken)return;tokens.current.undoToken=undoToken;if(locked)return;setPairs(pairs.slice(0,-1));setSelected(null);setHint([]);report(pairs.length?'上一对牌已经放回原位。':'还没有收起的牌。');},[undoToken,locked]);
  function pick(id:number){if(locked)return;const t=puzzle.tiles[id];if(!tileFree(t,puzzle.tiles,removed)){report('这张牌还被压住，或左右两侧都被挡住。');return;}if(selected===id){setSelected(null);return;}if(selected===null){setSelected(id);report(`已选“${pairSymbols[t.symbol]}”，再找一张相同的自由牌。`);return;}if(puzzle.tiles[selected].symbol!==t.symbol){setSelected(id);report('两个字不同。已经改选这张牌，请找相同的搭档。');return;}setPairs([...pairs,[selected,id]]);setSelected(null);setHint([]);report('配对成功，新的空边露出来了。');}
  return <div className="tp-layout" data-tile-pairs-game data-removed={removed.join(',')} data-won={won} data-pairs={pairs.length}>
    <section className="tp-table"><header><div><span>MOONLIT TILE GARDEN</span><h3>{puzzle.title}</h3></div><b>{String(level+1).padStart(2,'0')}<small> / {tilePairsLevels.length}</small></b></header><p>{puzzle.lesson}</p>
      <div className="tp-meta"><span>余牌 {puzzle.tiles.length-removed.length}</span><span>收好 {pairs.length} 对</span><span>{paused?'已暂停':won?'牌园清空':'无计时 · 随时撤销'}</span></div>
      <div className="tp-board" aria-label="叠放的牌园" style={{aspectRatio:`${puzzle.width} / ${puzzle.height*1.38}`}}>
        {puzzle.tiles.map(t=>{if(removed.includes(t.id))return null;const free=tileFree(t,puzzle.tiles,removed);return <button key={t.id} data-pair-tile={t.id} data-x={t.x} data-y={t.y} data-z={t.z} data-symbol={t.symbol} data-free={free} aria-label={`第 ${t.id+1} 张，${pairSymbols[t.symbol]}，第 ${t.z+1} 层，${free?'自由牌':'被挡住'}`} aria-pressed={selected===t.id} disabled={locked||!free} onClick={()=>pick(t.id)} className={`tp-tile ${free?'free':'blocked'} ${selected===t.id?'selected':''} ${hint.includes(t.id)?'hinted':''}`} style={{left:`${t.x*100/puzzle.width}%`,top:`${t.y*100/puzzle.height}%`,width:`${100/puzzle.width-1}%`,height:`${100/puzzle.height-3}%`,zIndex:t.z+1,'--rise':`${t.z*3}px`} as CSSProperties}><small>{t.z+1} 层</small><strong>{pairSymbols[t.symbol]}</strong><span>{['✿','◇','❋','✧'][t.symbol%4]}</span></button>;})}
      </div><p className="tp-message" role="status">{message}</p>
    </section><aside className="tp-guide"><span>观察 · 留出一侧</span><h3>有空间，才自由</h3><p>上层牌可能遮住下层；移开后会露出来。关键是判断哪些牌可以拿。</p><ol><li>牌的正上方没有其他牌压着。</li><li>同层的左侧或右侧，至少一侧没有紧邻的牌。</li><li>两张牌的字必须相同。</li></ol><p>上方没有牌还不够；左右都挤着也不能取。灰暗的牌暂时不能选择。</p><details><summary>操作与提示</summary><p>点两张相同的自由牌即可收起。点已选牌可取消，点不同字会改选。Tab、Enter 和空格也可以操作。撤销放回上一对。提示从当前叠牌寻找一条完整清空路线，不会偷偷移牌。通关后牌桌锁定。</p></details><p className="tp-note">原创牌面与布局，采用通用麻将接龙配对规则。</p></aside>
  </div>;
}
