// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import { domineeringLevels, legalMoves, bestMove, isWinning, playRound, type Position } from './domineeringLogic';
import './domineeringGarden.css';
export default function DomineeringGarden(props: GameProps) {
  return <Round key={`${props.level}:${props.resetToken}`} {...props} />;
}
function Round({ level, paused, hintToken, undoToken, onComplete, onStatus }: GameProps) {
  const lesson = domineeringLevels[level] ?? domineeringLevels[0];
  const [history, setHistory] = useState<Position[]>([{ mask: lesson.mask, pieces: [], result: 'playing' }]);
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<number | null>(null);
  const [message, setMessage] = useState('选一格作为竖牌上端，再按「放下竖牌」。让电脑没有横向空位，你就赢！');
  const position = history[history.length - 1];
  const live = useRef({ history, position, paused }); live.current = { history, position, paused };
  const done = useRef(false), tokens = useRef({ hintToken, undoToken });
  const callbacks = useRef({ onComplete, onStatus }); callbacks.current = { onComplete, onStatus };
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const report = (text: string) => { setMessage(text); callbacks.current.onStatus(text); };
  useEffect(() => { callbacks.current.onStatus('你放竖牌，电脑放横牌。轮到谁没有空位，谁就输。'); }, []);
  useEffect(() => { if (position.result === 'won' && !done.current && !paused) { done.current = true; callbacks.current.onComplete(); } }, [position.result, paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return; tokens.current.hintToken = hintToken;
    if (paused || position.result !== 'playing') return;
    const move = bestMove(position.mask, true); setHint(move ?? null);
    report(move === undefined ? '已无合法位置，可以撤销再想想。' : `${isWinning(position.mask, true) ? '精确搜索找到必胜路线的第一步' : '精确搜索显示此局面对完美对手无法保证获胜，可撤销；仍可尝试'}：竖牌上端放在 ${Math.floor(move / 4) + 1} 行 ${move % 4 + 1} 列。提示不会替你落子。`);
  }, [hintToken]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return; tokens.current.undoToken = undoToken;
    if (paused || done.current || history.length < 2) return;
    const next = history.slice(0, -1); live.current = { history: next, position: next[next.length - 1], paused };
    setHistory(next); setSelected(null); setHint(null); report('已撤销你的竖牌和电脑的横牌。');
  }, [undoToken]);
  const options = legalMoves(position.mask, true), locked = paused || position.result !== 'playing';
  function select(i: number) {
    if (live.current.paused || live.current.position.result !== 'playing') return;
    if (!legalMoves(live.current.position.mask, true).includes(i)) { report('这格不能作为上端：需要它与正下方都是空地。'); return; }
    setSelected(i); setHint(null); report(`预览 ${Math.floor(i / 4) + 1} 行 ${i % 4 + 1} 列的竖牌；确认后电脑会立即回应。`);
  }
  function commit() {
    const now = live.current; if (now.paused || selected === null) return;
    const next = playRound(now.position, selected); if (!next) return;
    const h = [...now.history, next]; live.current = { history: h, position: next, paused };
    setHistory(h); setSelected(null); setHint(null);
    report(next.result === 'won' ? '电脑已没有横向空位。你赢得了这片花园！' : next.result === 'lost' ? '轮到你了，但已没有竖向空位。这盘输了，可以撤销一轮。' : `电脑已放横牌。你还有 ${legalMoves(next.mask, true).length} 个竖向落点，想想怎样截断它的路线。`);
  }
  const preview = selected ?? hint;
  return <div className="domineering-garden" data-domineering-result={position.result} data-domineering-mask={position.mask} data-domineering-rounds={history.length - 1}>
    <section className="dg-main"><header><div><span className="dg-eyebrow">DOMINEERING · 方向就是策略</span><h3>横竖争地</h3></div><b>{level + 1} / 100</b></header>
      <p>每张骨牌占相邻两格。<strong>你只能竖放 ↓，电脑只能横放 →。</strong>轮到谁放不下，谁就输。</p>
      <div className="dg-legend"><span>↓ 你的竖牌</span><span>→ 电脑横牌</span><span>× 岩石不可用</span></div>
      <div className="dg-board" aria-label="四行四列争地棋盘">{Array.from({ length: 16 }, (_, i) => {
        const rock = !(lesson.mask & (1 << i));
        const piece = position.pieces.find(p => p.start === i || p.start + (p.vertical ? 4 : 1) === i);
        const covered = preview !== null && (i === preview || i === preview + 4);
        return <button key={i} ref={el => { cells.current[i] = el; }} type="button" data-cell={i}
          className={`dg-cell ${rock ? 'rock' : piece ? piece.vertical ? 'vertical' : 'horizontal' : 'empty'} ${covered ? 'preview' : ''} ${hint === i ? 'hint' : ''}`}
          disabled={locked} aria-pressed={selected === i} aria-label={`${Math.floor(i / 4) + 1}行${i % 4 + 1}列，${rock ? '岩石' : piece ? piece.vertical ? '你的竖牌' : '电脑横牌' : options.includes(i) ? '空地，可作上端' : '空地，不能作上端'}`}
          onClick={() => select(i)} onKeyDown={e => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const delta = ({ ArrowUp: -4, ArrowDown: 4, ArrowLeft: -1, ArrowRight: 1 } as Record<string, number>)[e.key];
            if (!delta) return; e.preventDefault();
            if ((e.key === 'ArrowLeft' && i % 4 === 0) || (e.key === 'ArrowRight' && i % 4 === 3)) return;
            cells.current[i + delta]?.focus({ preventScroll: true });
          }}><span aria-hidden="true">{rock ? '×' : piece ? piece.vertical ? '↓' : '→' : covered ? '↓' : '·'}</span><small>{Math.floor(i / 4) + 1},{i % 4 + 1}</small></button>;
      })}</div>
      <button className="dg-confirm" type="button" disabled={locked || selected === null} onClick={commit}>放下竖牌</button>
      <p className="dg-message" role="status">{paused ? '已暂停，棋盘不会改变。' : message}</p>
      {position.result !== 'playing' && <div className={`dg-result ${position.result}`}>{position.result === 'won' ? '✦ 你守住了自己的方向' : '这一轮让横牌占了上风'}{position.result === 'lost' && <p>点外壳「撤销」回到上一轮，或「重来」换个思路。</p>}</div>}
    </section>
    <aside className="dg-notes"><span className="dg-eyebrow">小棋盘，大取舍</span><h3>给自己留一条竖路</h3><p>你占住两格，也可能恰好切断电脑的横路。眼前能放下，不一定代表下一轮还有空间。</p><ol><li>点空地预览竖牌，上端和下端都会描边。</li><li>确认落子后，电脑按精确搜索立即放横牌。</li><li>剩余单格不算落点，空地多也可能先输。</li></ol><p>本关 {lesson.cells} 格空地。100 个固定开局，无镜像或旋转重复；每关先手存在必胜路线，但你的选择会改变结果。</p><details><summary>操作与提示</summary><p>触屏点格子再确认；键盘 Tab / 方向键移焦，Enter / 空格选择。提示只标建议，不自动通关。撤销回退整轮，胜利后锁定。暂停不接收落子。关卡成绩由大厅保存，局内棋盘不跨刷新保存。</p></details></aside>
  </div>;
}
