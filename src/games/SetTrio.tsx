// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useId, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import { setTrioLevels, type TrioCard } from './setTrioLevels';
import {
  SET_TRIO_SAVE, TRIO_ATTRIBUTES, TRIO_COLORS, TRIO_FILLS, TRIO_SHAPES,
  confirmTrio, initialTrio, parseTrioSave, selectTrio, serializeTrio,
  solveTrio, trioCardLabel, trioHint, trioRelations, trioRemaining, trioWon,
  undoTrio, validTrio, type TrioHint,
} from './setTrioLogic';
import './setTrio.css';

function CardSymbols({ card }: { card: TrioCard }) {
  const pattern = `trio-hatch-${useId().replace(/:/g, '')}`;
  const count = card[2] + 1;
  const centers = count === 1 ? [48] : count === 2 ? [31, 65] : [16, 48, 80];
  const fill = card[3] === 0 ? 'currentColor' : card[3] === 1 ? '#fff' : `url(#${pattern})`;
  return <svg viewBox="0 0 96 34" className={`trio-symbols trio-color-${card[0]}`} aria-hidden="true">
    <defs><pattern id={pattern} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
      <rect width="5" height="5" fill="#fff" /><path d="M0 0V5" stroke="currentColor" strokeWidth="2" />
    </pattern></defs>
    {centers.map((x) => <g key={x} transform={`translate(${x} 17)`} fill={fill} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
      {card[1] === 0 ? <circle r="10" /> : card[1] === 1 ? <path d="M0 -11L11 9H-11Z" /> : <path d="M0 -12L11 0L0 12L-11 0Z" />}
    </g>)}
  </svg>;
}
const intro = '选三张，逐项看“全同 / 全异”，再确认收起。把整桌牌收空即可过关。';
export default function SetTrio(props: GameProps) {
  return <TrioRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function TrioRound({ level, paused, freshStart, hintToken, undoToken, onComplete, onStatus }: GameProps) {
  const puzzle = setTrioLevels[level] ?? setTrioLevels[0];
  const [state, setState] = useState(() => {
    try { return parseTrioSave(freshStart ? null : localStorage.getItem(`${SET_TRIO_SAVE}.round.${level}`), puzzle); }
    catch { return initialTrio(); }
  });
  const [message, setMessage] = useState(intro);
  const [hint, setHint] = useState<TrioHint | null>(null);
  const [saved, setSaved] = useState(true);
  const tokens = useRef({ hintToken, undoToken });
  const completed = useRef(false);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const remaining = trioRemaining(puzzle, state);
  const won = trioWon(puzzle, state);
  const locked = paused || won;
  const selectedCards = state.selected.map((i) => puzzle.cards[i]);
  const relations = state.selected.length === 3 ? trioRelations(selectedCards) : null;
  const valid = validTrio(puzzle, state.selected);
  function report(text: string) { setMessage(text); callbacks.current.onStatus(text); }
  useEffect(() => {
    report(state.removed.length || state.selected.length ? '已恢复本机保存的收牌记录和选牌草稿。' : intro);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(`${SET_TRIO_SAVE}.round.${level}`, serializeTrio(puzzle, state));
      setSaved(true);
    } catch { setSaved(false); }
  }, [puzzle, level, state]);
  useEffect(() => {
    if (won && !paused && !completed.current) {
      completed.current = true;
      report(`整桌共鸣！${puzzle.cards.length} 张牌分成了 ${state.removed.length} 组，每组的四种属性都通过了检查。`);
      callbacks.current.onComplete();
    }
  }, [won, paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked) return;
    const suggestion = trioHint(puzzle, state);
    setHint(suggestion);
    report(suggestion.text);
  }, [hintToken, locked]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    const next = undoTrio(state);
    setState(next);
    setHint(null);
    report(next === state ? '还没有可以撤销的动作。' : state.removed.length ? '上一次收起的三张已回到桌面，并恢复为选牌预览；可取消或重新选择。' : '已取消选牌草稿。');
  }, [undoToken, locked]);
  function toggle(card: number) {
    if (locked) return;
    const next = selectTrio(puzzle, state, card);
    if (next === state) { report('已经选满三张。先点一张已选牌取消，或清空选择。'); return; }
    setState(next);
    setHint(null);
    if (next.selected.length === 3) {
      const bad = trioRelations(next.selected.map((i) => puzzle.cards[i])).flatMap((r, i) => r === 'mixed' ? [TRIO_ATTRIBUTES[i]] : []);
      report(bad.length ? `${bad.join('、')}出现“两同一异”。这组三张不能收起，可换一张再看看。` : '四种属性都合格。请确认收起；还没有改动桌面。');
    } else report(`已选 ${next.selected.length} / 3 张。点已选的牌可以取消。`);
  }
  function confirm() {
    if (locked || state.selected.length !== 3) return;
    const next = confirmTrio(puzzle, state);
    if (next === state) { report('还不能收起：每一项属性都必须全同或全异。没有任何牌被移走。'); return; }
    setState(next);
    setHint(null);
    const rest = trioRemaining(puzzle, next);
    if (!rest.length) return;
    report(solveTrio(puzzle, rest) === null
      ? `这三张有效，已经收起。但剩下的 ${rest.length} 张不能全部清空。请用“撤销”换一种搭配。`
      : `收起了一组！还剩 ${rest.length} 张。下一组也可以采用不同的属性组合。`);
  }
  function moveFocus(card: number, key: string) {
    if (locked) return;
    if (key === 'Home') { cells.current[remaining[0]]?.focus(); return; }
    if (key === 'End') { cells.current[remaining[remaining.length - 1]]?.focus(); return; }
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 } as Record<string, number>)[key];
    if (!step) return;
    let next = card + step;
    while (next >= 0 && next < puzzle.cards.length) {
      if (Math.abs(step) === 1 && Math.floor(next / 3) !== Math.floor(card / 3)) return;
      if (remaining.includes(next)) { cells.current[next]?.focus(); return; }
      next += step;
    }
  }
  return <div className="trio-layout" data-set-trio-game data-set-trio-id={puzzle.id} data-set-trio-won={won}
    data-set-trio-remaining={remaining.join(',')} data-set-trio-selected={state.selected.join(',')} data-set-trio-groups={state.removed.length}>
    <section className="trio-table" aria-label="三卡共鸣牌桌">
      <header className="trio-heading">
        <div><span className="trio-eyebrow">{puzzle.chapter}</span><h3>{puzzle.title}</h3></div>
        <span className="trio-number">{String(level + 1).padStart(2, '0')}<small> / 18</small></span>
      </header>
      <div className="trio-progress"><span>余牌 <strong>{remaining.length}</strong> / {puzzle.cards.length}</span><span>已收 <strong>{state.removed.length}</strong> 组</span><span>无计时 · 可撤销</span></div>
      <p className="trio-lesson">{puzzle.lesson}</p>
      <div className="trio-board" role="group" aria-label="可选择的属性卡片">
        {puzzle.cards.map((card, i) => {
          if (!remaining.includes(i)) return <div className="trio-empty" key={i} data-set-trio-removed={i} aria-label={`第 ${i + 1} 张已收起`}><span aria-hidden="true">✦</span><small>已收起</small></div>;
          const active = state.selected.includes(i), suggested = hint?.cards.includes(i);
          return <button type="button" key={i} ref={(el) => { cells.current[i] = el; }}
            className={`trio-card${active ? ' is-selected' : ''}${suggested ? ' is-hinted' : ''}`}
            data-set-trio-card={i} data-set-trio-code={card.join('')} data-set-trio-hinted={Boolean(suggested)}
            aria-label={`第 ${i + 1} 张，${trioCardLabel(card)}${suggested ? '，提示建议' : ''}`}
            aria-pressed={active} disabled={locked} onClick={() => toggle(i)}
            onKeyDown={(event) => {
              if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
              if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) { event.preventDefault(); moveFocus(i, event.key); }
            }}>
            <span className="trio-card-top" aria-hidden="true"><small>{String(i + 1).padStart(2, '0')}</small><b>{active ? `✓ ${state.selected.indexOf(i) + 1}` : suggested ? '提示' : ''}</b></span>
            <CardSymbols card={card} />
            <strong>{card[2] + 1} 个{TRIO_SHAPES[card[1]]}</strong>
            <span className="trio-card-detail">{TRIO_COLORS[card[0]]} · {TRIO_FILLS[card[3]]}</span>
          </button>;
        })}
      </div>
      <div className="trio-preview" aria-label="所选三张的属性检查" data-set-trio-preview={relations ? (valid ? 'valid' : 'invalid') : 'incomplete'}>
        <div className="trio-preview-title"><strong>{won ? '整桌收好啦' : `选牌预览 ${state.selected.length} / 3`}</strong><span>{paused ? '已暂停' : state.selected.length === 3 ? valid ? '四项全部合格' : '还需要换一张' : '选满三张后逐项检查'}</span></div>
        <div className="trio-checks">{TRIO_ATTRIBUTES.map((name, i) => <span key={name} className={relations?.[i] === 'mixed' ? 'is-mixed' : relations ? 'is-good' : ''}>
          <b>{name}</b><span>{relations ? relations[i] === 'same' ? '✓ 全同' : relations[i] === 'different' ? '✓ 全异' : '× 两同一异' : '待选满'}</span>
        </span>)}</div>
        <div className="trio-actions">
          <button type="button" data-set-trio-clear disabled={locked || !state.selected.length} onClick={() => { setState({ ...state, selected: [] }); setHint(null); report('已清空选择，桌面不变。'); }}>清空选择</button>
          <button type="button" className="trio-confirm" data-set-trio-confirm disabled={locked || state.selected.length !== 3} onClick={confirm}>{valid ? '确认收起这三张' : '检查这三张'}</button>
        </div>
      </div>
      <p className={`trio-message${hint ? ' has-hint' : ''}`} role="status" data-set-trio-message>{message}</p>
    </section>
    <aside className="trio-notes">
      <span className="trio-eyebrow">THREE IN HARMONY</span><h3>每一项，单独听</h3>
      <p>每张牌都有四种属性：颜色、形状、数量、填充。选三张，对每一项分别判断：</p>
      <ul><li><strong>全同：</strong>三个值完全一样。</li><li><strong>全异：</strong>三个值各不相同。</li><li><strong>两同一异：</strong>这一项不合格。</li></ul>
      <p>四项都合格才能收起。组内顺序不限；所有有效组合都接受。收空整桌才算完成。</p>
      <details><summary>选择、撤销和提示</summary>
        <p>先选牌、查看预览，再确认。点已选牌可取消。撤销会放回最近收起的三张并恢复预览；没有收牌记录时清空选择。</p>
        <p>合法的组也可能让余牌无法清空。可以撤销重选，没有失败惩罚。</p>
        <p>提示会穷举当前余牌的完整分组，标出一条可清空路径的第一组；若已无解，会说明至少需要撤销几次。提示不改动选牌或收牌。</p>
        <p>Tab 切换控件，Enter / 空格选牌，方向键在三列牌桌移动焦点。颜色和填充均有文字标签。</p>
      </details>
      <p className="trio-save" data-set-trio-save>{saved ? '选牌与收牌记录已保存在本机。' : '当前无法保存。仍可游玩，离开后这局可能丢失。'}</p>
      <p className="trio-origin">原创规则实现、十八个教学牌局与图形。采用通用的三值属性规则；与商业 SET® 品牌无关联。</p>
    </aside>
  </div>;
}
