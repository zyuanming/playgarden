// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import {colorTubesLevels, moveTube, solveTubes, tubeColors, tubesWon, type TubeBoard, type TubeMove} from './colorTubesLogic';
import './colorTubes.css';
export default function ColorTubes(props: GameProps) { return <Round key={`${props.level}:${props.resetToken}`} {...props}/>; }
function Round({level,paused,hintToken,undoToken,onComplete,onStatus}:GameProps) {
  const puzzle=colorTubesLevels[level]??colorTubesLevels[0];
  const [board,setBoard]=useState<TubeBoard>(()=>puzzle.tubes.map(t=>[...t]));
  const [past,setPast]=useState<TubeBoard[]>([]), [selected,setSelected]=useState<number|null>(null),[hint,setHint]=useState<TubeMove|null>(null);
  const [message,setMessage]=useState('先选来源管，再选目标管。一次只移动最上面一颗珠子。');
  const tokens=useRef({hintToken,undoToken}),done=useRef(false),callbacks=useRef({onComplete,onStatus}); callbacks.current={onComplete,onStatus};
  const won=tubesWon(board,puzzle.capacity),locked=paused||won;
  function report(text:string){setMessage(text);callbacks.current.onStatus(text);}
  useEffect(()=>{if(won&&!paused&&!done.current){done.current=true;report('整理完成！每颗珠子都在装满的同色管里。');callbacks.current.onComplete();}},[won,paused]);
  useEffect(()=>{if(tokens.current.hintToken===hintToken)return;tokens.current.hintToken=hintToken;if(locked)return;const plan=solveTubes(board,puzzle.capacity);setHint(plan?.[0]??null);report(plan?.length?`把 ${plan[0][0]+1} 号管顶端的${tubeColors[board[plan[0][0]].at(-1)!]}珠移到 ${plan[0][1]+1} 号管。`:'本次搜索未找到整理路径。可以撤销最近一步，恢复更多空位。');},[hintToken,locked]);
  useEffect(()=>{if(tokens.current.undoToken===undoToken)return;tokens.current.undoToken=undoToken;if(locked)return;if(past.length){setBoard(past.at(-1)!);setPast(past.slice(0,-1));report('已撤销上一颗珠子的移动。');}else report('还没有移动记录。');setSelected(null);setHint(null);},[undoToken,locked]);
  function select(index:number){if(locked)return;if(selected===null){if(!board[index].length){report('这是一只空管。先选一只有珠子的来源管。');return;}setSelected(index);report(`已选 ${index+1} 号管，请选目标管。`);return;}if(selected===index){setSelected(null);return;}const next=moveTube(board,puzzle.capacity,selected,index);if(!next){report('目标必须有空位，并且为空管或顶部同色。点原管可取消选择。');return;}setPast([...past,board]);setBoard(next);setSelected(null);setHint(null);report('移动成功。继续把同色珠子装满一管。');}
  return <div className="ct-layout" data-color-tubes-game data-state={JSON.stringify(board)} data-capacity={puzzle.capacity} data-won={won} data-moves={past.length}>
    <section className="ct-workshop"><header><div><span>COLOR CONSERVATORY</span><h3>{puzzle.title}</h3></div><b>{level+1}<small> / {colorTubesLevels.length}</small></b></header>
      <p className="ct-lesson">{puzzle.lesson}</p><div className="ct-meter"><span>每管 {puzzle.capacity} 颗</span><span>已搬 {past.length} 颗</span><span>{paused?'已暂停':won?'整理完成':'慢慢来 · 不计时'}</span></div>
      <div className="ct-tubes" aria-label="彩珠试管">{board.map((tube,i)=><button key={i} className={`ct-tube ${selected===i?'selected':''} ${hint?.includes(i)?'hinted':''}`} data-tube={i} disabled={locked} aria-pressed={selected===i} aria-label={`${i+1} 号管，从底到顶：${tube.map(c=>tubeColors[c]).join('、')||'空管'}，${tube.length}/${puzzle.capacity}`} onClick={()=>select(i)}>
        <span className="ct-glass">{Array.from({length:puzzle.capacity},(_,j)=><span key={j} className={`ct-bead ${tube[j]===undefined?'empty':`color-${tube[j]}`}`} style={{bottom:`${j* (100/puzzle.capacity)}%`,height:`${100/puzzle.capacity}%`}}>{tube[j]===undefined?'·':['●','◆','★','✿','▲'][tube[j]]}</span>)}</span><strong>{i+1} 号管</strong><small>{hint?.[0]===i?'从这里搬':hint?.[1]===i?'放到这里':`${tube.length} / ${puzzle.capacity}`}</small></button>)}</div>
      <p className="ct-message" role="status">{message}</p></section>
    <aside className="ct-guide"><span>整理的艺术</span><h3>给每种颜色一个家</h3><p>先点来源管，再点目标管。只能移动最上面的一颗珠子。</p><ol><li>目标管必须还有空位。</li><li>空管可以接任意颜色。</li><li>非空管只能接与顶端同色的珠子。</li></ol><p>所有非空管都装满同一种颜色才算完成。空管可以留下。</p><details><summary>小窍门与操作</summary><p>空管是临时工作台，尽量让一次移动露出下一个需要的颜色。Tab 切换管子，Enter 或空格选择。提示根据当前局面寻找完整整理路径，撤销只退回一步。暂停和通关后操作锁定。</p></details><div className="ct-key">{tubeColors.map((c,i)=><span key={c}><b className={`color-${i}`}>{['●','◆','★','✿','▲'][i]}</b>{c}</span>)}</div></aside>
  </div>;
}
