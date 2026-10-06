import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameProps } from '../lib/types';
import { samegameLevels } from './samegameLevels';
import { createSameGameState, getSameGameHint, isSameGameSolved, playSameGame, removeSameGameGroup, samegameGroup, samegameGroups, undoSameGame } from './samegameLogic';
import { loadSameGameRound, saveSameGameRound } from './samegameStorage';
import './samegameGarden.css';

const flowers = [{ symbol: '✿', name: '圆瓣花' }, { symbol: '◆', name: '菱瓣花' }, { symbol: '✦', name: '星瓣花' }, { symbol: '●', name: '圆果花' }];
const chapters = [
  { title: '认识花簇', lesson: '上下左右相连的同类花朵才是一簇。先看看选中了几朵，再确认消除。' },
  { title: '借一步下落', lesson: '下面的花簇消失后，上方花朵会落下。观察原本分开的同类是否会相遇。' },
  { title: '给花列让路', lesson: '一列清空后，右边的列向左靠拢。先消哪一簇，会改变下一次的邻居。' },
  { title: '留住花伴', lesson: '小心只剩一朵的花。比较不同选择的预览，让每一种花都还有机会成簇。' },
  { title: '规划整座花园', lesson: '最大的花簇未必是好开局。先安排连接与收列，再决定消除顺序；随时可以撤销。' },
];
const intro = '目标是清空所有花朵。先点选一簇上下左右相连、至少 2 朵的同类花，再点同簇或“确认消除”。';
export default function SameGameGarden(props: GameProps) {
  const key = `${props.level}:${props.resetToken}`;
  const round = useRef({ key, level: props.level, fresh: false });
  if (round.current.key !== key) round.current = { key, level: props.level, fresh: round.current.level === props.level };
  return <SameGameRound key={key} {...props} fresh={round.current.fresh} />;
}
function SameGameRound({ level, paused, hintToken, undoToken, onComplete, onStatus, fresh }: GameProps & { fresh: boolean }) {
  const puzzle = samegameLevels[level] ?? samegameLevels[0], chapter = chapters[puzzle.chapter];
  const [state, setState] = useState(() => fresh ? createSameGameState(puzzle) : loadSameGameRound(level, puzzle));
  const [selected, setSelected] = useState<number | null>(null), [cursor, setCursor] = useState(0), [saved, setSaved] = useState(true), [message, setMessage] = useState(intro), [hintKind, setHintKind] = useState('');
  const cells = useRef<(HTMLButtonElement | null)[]>([]), completed = useRef(false), tokens = useRef({ hintToken, undoToken });
  const callbacks = useRef({ onComplete, onStatus }); callbacks.current = { onComplete, onStatus };
  const won = isSameGameSolved(state.board), remaining = state.board.filter(v => v >= 0).length;
  const group = selected === null ? [] : samegameGroup(state.board, puzzle.width, puzzle.height, selected);
  const preview = selected === null ? null : removeSameGameGroup(state.board, puzzle.width, puzzle.height, selected);
  const stuck = !won && samegameGroups(state.board, puzzle.width, puzzle.height).length === 0;
  function report(text: string) { setMessage(text); callbacks.current.onStatus(text); }
  useEffect(() => { setSaved(saveSameGameRound(level, puzzle, state)); }, [level, puzzle, state]);
  useEffect(() => { callbacks.current.onStatus(intro); }, []);
  useEffect(() => {
    if (!won || paused || completed.current) return;
    completed.current = true; report('所有花朵都找到了伙伴，花园清空了！'); callbacks.current.onComplete();
  }, [won, paused]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return; tokens.current.undoToken = undoToken;
    if (paused || won) return;
    setState(current => undoSameGame(current)); setSelected(null); setHintKind('');
    report(state.history.length ? '已撤销上一次消除，花朵回到原位。' : '还没有可以撤销的消除。点选预览不会改变棋盘。');
  }, [undoToken, paused, won, state.history.length]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return; tokens.current.hintToken = hintToken;
    if (paused || won) return;
    const hint = getSameGameHint(puzzle, state.board); setHintKind(hint.kind); report(hint.reason);
    if (hint.kind === 'move') { setSelected(hint.index); setCursor(hint.index); cells.current[hint.index]?.focus({ preventScroll: true }); }
    else setSelected(null);
  }, [hintToken, paused, won, puzzle, state.board]);
  function commit(index: number) {
    if (paused || won) return;
    const next = playSameGame(state, puzzle, index); if (next === state) return;
    setState(next); setSelected(null); setHintKind(''); cells.current[index]?.focus({ preventScroll: true });
    const left = next.board.filter(v => v >= 0).length;
    report(left === 0 ? '花园已清空！' : samegameGroups(next.board, puzzle.width, puzzle.height).length === 0 ? '暂时没有可消除的花簇了。撤销一步，试试另一种顺序。' : `消除了 ${remaining - left} 朵，剩余 ${left} 朵。花朵已下落，空列已向左收拢。`);
  }
  function choose(index: number) {
    if (paused || won) return;
    setCursor(index); setHintKind('');
    const next = samegameGroup(state.board, puzzle.width, puzzle.height, index);
    if (next.length < 2) { setSelected(null); report(state.board[index] < 0 ? '这里已经是空地。选择一簇至少 2 朵的花。' : '这朵花暂时没有相邻的同类。试着让别处的花落下或靠拢。'); return; }
    if (group.includes(index)) commit(index);
    else { setSelected(index); report(`选中了 ${next.length} 朵${flowers[state.board[index]].name}。先看消除后的预览，再点同簇或“确认消除”。`); }
  }
  return <div className="samegame-layout" data-samegame-won={won} data-samegame-hint={hintKind} onKeyDown={event => { if ((event.ctrlKey || event.metaKey || event.altKey) && ['Enter', ' '].includes(event.key)) event.preventDefault(); }}>
    <section className="samegame-play" aria-label="花簇消除游戏">
      <header className="samegame-heading"><div><span className="samegame-eyebrow">第 {puzzle.chapter + 1} 章 · {chapter.title}</span><h3>{puzzle.title}</h3></div><span>{String(level + 1).padStart(3, '0')} / {samegameLevels.length}</span></header>
      <p className="samegame-lesson" data-samegame-chapter={puzzle.chapter}>{chapter.lesson}</p>
      <div className="samegame-stats"><span>剩余 <strong>{remaining}</strong> 朵</span><span>已消 <strong>{state.history.length}</strong> 簇</span><span>{paused ? '已暂停' : won ? '花园清空 ✓' : stuck ? '试试撤销' : '慢慢想，不计时'}</span></div>
      <div className="samegame-board-wrap"><div className="samegame-board" role="group" aria-label="花簇棋盘，方向键移动，Enter 或空格点选和确认" style={{ '--sg-width': puzzle.width } as CSSProperties}>
        {state.board.map((value, index) => <button type="button" key={index} ref={el => { cells.current[index] = el; }} data-samegame-cell={index} data-value={value} data-selected={group.includes(index)} className={`samegame-cell flower-${value} ${group.includes(index) ? 'is-selected' : ''}`} disabled={paused || won} tabIndex={cursor === index ? 0 : -1} aria-pressed={group.includes(index)} aria-label={`第 ${Math.floor(index / puzzle.width) + 1} 行第 ${index % puzzle.width + 1} 列，${value < 0 ? '空地' : flowers[value].name}${group.includes(index) ? '，已选中' : ''}`} onFocus={() => setCursor(index)} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.altKey) choose(index); }} onKeyDown={event => {
          if (event.ctrlKey || event.metaKey || event.altKey) { if (['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) event.preventDefault(); return; }
          if (paused || won) return;
          const x = index % puzzle.width, y = Math.floor(index / puzzle.width);
          const next = event.key === 'ArrowLeft' ? y * puzzle.width + Math.max(0, x - 1) : event.key === 'ArrowRight' ? y * puzzle.width + Math.min(puzzle.width - 1, x + 1) : event.key === 'ArrowUp' ? Math.max(0, y - 1) * puzzle.width + x : event.key === 'ArrowDown' ? Math.min(puzzle.height - 1, y + 1) * puzzle.width + x : -1;
          if (next >= 0) { event.preventDefault(); setCursor(next); cells.current[next]?.focus({ preventScroll: true }); }
        }}><span aria-hidden="true">{value < 0 ? '·' : flowers[value].symbol}</span>{group.includes(index) && <small aria-hidden="true">✓</small>}</button>)}
      </div></div>
      <div className="samegame-confirm" role="group" aria-label="花簇预览操作"><button type="button" className="primary" disabled={paused || won || !preview} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.altKey && selected !== null) commit(selected); }}>确认消除{preview ? ` ${group.length} 朵` : ''}</button><button type="button" disabled={paused || won || selected === null} onClick={event => { if (event.ctrlKey || event.metaKey || event.altKey) return; if (selected !== null) cells.current[selected]?.focus({ preventScroll: true }); setSelected(null); setHintKind(''); report('已取消预览，棋盘没有改变。'); }}>取消选择</button></div>
      <p className="samegame-message" role="note">{message}</p>
      <div className="samegame-preview-area" aria-label="消除后预览"><div><strong>下一步会变成这样</strong><p>{preview ? `下落 ↓ · 空列向左收拢 ← · 将剩 ${remaining - group.length} 朵` : '点选花簇后，这里展示确认消除后的棋盘。'}</p></div><div className={`samegame-preview ${preview ? '' : 'is-empty'}`} style={{ '--sg-width': puzzle.width } as CSSProperties} role="img" aria-label={preview ? `消除后预览：${preview.map((value, index) => value < 0 ? null : `第 ${Math.floor(index / puzzle.width) + 1} 行第 ${index % puzzle.width + 1} 列${flowers[value].name}`).filter(Boolean).join('；') || '所有花朵清空'}` : '尚未选中花簇'}>{(preview ?? state.board.map(() => -1)).map((value, index) => <span key={index} className={`flower-${value}`}>{value < 0 ? '·' : flowers[value].symbol}</span>)}</div></div>
      <p className="samegame-save">{saved ? '当前关卡和每次消除都保存在此浏览器，可离开后继续。' : '浏览器暂时无法保存这一局，请保持页面打开。'}</p>
    </section>
    <aside className="samegame-notes"><span className="samegame-eyebrow">连接 · 下落 · 规划</span><h3>给每朵花，<br />留一位伙伴。</h3><p>目标是清空整块花田。至少 2 朵同类花上下左右连在一起才能消除；只在对角碰到不算相连。</p><ol><li>点一朵花，查看整簇与预览。</li><li>再点同簇，或点“确认消除”。</li><li>花朵向下落，空列向左收拢。没有自动连消。</li></ol><div className="samegame-key" aria-label="花朵种类">{flowers.slice(0, puzzle.colors).map((flower, index) => <span key={flower.name}><i className={`flower-${index}`} aria-hidden="true">{flower.symbol}</i>{flower.name}</span>)}</div><p>没有步数或时间限制。剩下孤单的花并不是惩罚：撤销后换个顺序，看看它们能否重新相遇。</p><details><summary>键盘与提示</summary><p>Tab 进入棋盘，方向键移动；Enter 或空格第一次选中、第二次确认。也可 Tab 到确认和取消按钮。Escape 暂停/继续。</p><p>提示从当前局面搜索一条清空路径，只展示下一簇，不替你消除，也不代表最少步数。搜索达到预算时会明确说明；找不到可靠建议不等于无解。</p></details></aside>
  </div>;
}
