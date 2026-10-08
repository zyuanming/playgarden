// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameProps } from '../lib/types';
import { FREECELL_SUITS, freecellGardenLevels, type FreecellCard } from './freecellGardenLevels';
import {
  FREECELL_SAVE, SUIT_NAMES, SUIT_SYMBOLS, cardLabel, cardRank, cardSuit,
  freecellDestinations, freecellHint, freecellMoveError, freecellWon, initialFreecell,
  moveFreecell, placeKey, placeLabel, rankLabel, redCard, restoreFreecell, samePlace,
  serializeFreecell, topCard, undoFreecell, type FreecellPlace, type FreecellSource,
} from './freecellGardenLogic';
import './freecellGarden.css';

const intro = '先选一张露出的顶牌，再点带“可放”标记的目标。每次只移动一张。';
function Face({ card, compact = false }: { card: FreecellCard; compact?: boolean }) {
  const suit = cardSuit(card);
  return <span className={`fg-face${redCard(card) ? ' fg-red' : ' fg-black'}${compact ? ' fg-compact' : ''}`}>
    <strong>{rankLabel(cardRank(card))}<span aria-hidden="true">{SUIT_SYMBOLS[suit]}</span></strong>
    <small>{SUIT_NAMES[suit]}</small>
  </span>;
}
export default function FreecellGarden(props: GameProps) {
  return <FreecellRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function FreecellRound({ level, freshStart, paused, hintToken, undoToken, onComplete, onStatus }: GameProps) {
  const deal = freecellGardenLevels[level] ?? freecellGardenLevels[0];
  const [state, setState] = useState(() => {
    try { return restoreFreecell(freshStart ? null : localStorage.getItem(`${FREECELL_SAVE}.round.${level}`), deal); }
    catch { return initialFreecell(deal); }
  });
  const [message, setMessage] = useState(intro);
  const [saved, setSaved] = useState(true);
  const [hintSource, setHintSource] = useState<FreecellSource | null>(null);
  const completed = useRef(false);
  const tokens = useRef({ hintToken, undoToken });
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const won = freecellWon(deal, state.board), locked = paused || won;
  const selectedCard = state.selected ? topCard(state.board, state.selected) : null;
  const targets = state.selected ? freecellDestinations(deal, state.board, state.selected) : [];
  const homeCount = state.board.foundations.reduce((sum, rank) => sum + rank, 0);
  function report(text: string) { setMessage(text); callbacks.current.onStatus(text); }
  useEffect(() => { report(state.moves.length || state.selected ? '已重放并恢复本机保存的合法移动；选牌草稿也已恢复。' : intro); }, []);
  useEffect(() => {
    try {
      const serialized = serializeFreecell(deal, state);
      if (serialized === null) { setSaved(false); return; }
      localStorage.setItem(`${FREECELL_SAVE}.round.${level}`, serialized); setSaved(true);
    } catch { setSaved(false); }
  }, [deal, level, state]);
  useEffect(() => {
    if (won && !paused && !completed.current) {
      completed.current = true;
      report(`四种花色全部归位！${deal.maxRank * 4} 张牌都已按 A 到 ${deal.maxRank} 排好。`);
      callbacks.current.onComplete();
    }
  }, [won, paused, deal]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    setState(undoFreecell(deal, state)); setHintSource(null);
    report(state.moves.length ? '已撤销上一次移动；选择已取消。' : state.selected ? '已取消选择，牌桌没有改变。' : '还没有可以撤销的移动。');
  }, [undoToken, locked]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked) return;
    const hint = freecellHint(deal, state); setHintSource(hint.source); report(hint.text);
  }, [hintToken, locked]);
  function cancel() {
    if (locked) return;
    setState({ ...state, selected: null }); setHintSource(null); report('已取消选择，牌桌没有改变。');
  }
  function activate(place: FreecellPlace) {
    if (locked) return;
    setHintSource(null);
    if (state.selected) {
      if (samePlace(state.selected, place)) { cancel(); return; }
      const move = { from: state.selected, to: place };
      const error = freecellMoveError(deal, state.board, move);
      if (error) { report(`${error} 牌没有移动；可换个目标或取消选择。`); return; }
      const next = moveFreecell(deal, state.board, move);
      if (!next) return;
      setState({ board: next, moves: [...state.moves, move], selected: null });
      report(`${cardLabel(selectedCard!)}已移到${placeLabel(place)}。`);
      return;
    }
    if (place.kind === 'foundation') { report('归位后的牌留在这里；需要取回时请用“撤销”。'); return; }
    const card = topCard(state.board, place);
    if (!card) { report('这里是空的。先选另一处的顶牌，再把它移过来。'); return; }
    setState({ ...state, selected: place });
    const options = freecellDestinations(deal, state.board, place);
    report(`已选${cardLabel(card)}。${options.length ? `${options.length} 个合法目标已标出。` : '暂时没有合法目标。'}再点这张牌或“取消选择”可取消。`);
  }
  function buttonState(place: FreecellPlace) {
    const legal = targets.some((target) => samePlace(target, place));
    const active = samePlace(state.selected, place);
    const hinted = samePlace(hintSource, place);
    return { legal, active, hinted, className: `fg-card-button${legal ? ' is-legal' : ''}${active ? ' is-selected' : ''}${hinted ? ' is-hinted' : ''}` };
  }
  function preview(place: FreecellPlace) {
    const attrs = buttonState(place);
    return <span className="fg-target-tag">{attrs.active ? '已选 · 再点取消' : attrs.legal ? '↘ 可放' : attrs.hinted ? '提示起点' : '\u00a0'}</span>;
  }
  return <div className="fg-layout" data-freecell-game data-freecell-id={deal.id} data-freecell-won={won}
    data-freecell-moves={state.moves.length} data-freecell-selected={state.selected ? placeKey(state.selected) : ''}>
    <section className="fg-table" aria-label="空位纸牌牌桌">
      <header className="fg-heading"><div><span className="fg-eyebrow">留一点空间，下一步就会发生</span><h3>{deal.title}</h3></div><span className="fg-level">{String(level + 1).padStart(2, '0')}<small> / 12</small></span></header>
      <p className="fg-lesson">{deal.lesson}</p>
      <div className="fg-deck" data-freecell-deck><span>本关：四花色 A–{deal.maxRank}，共 <strong>{deal.maxRank * 4}</strong> 张</span><span>{deal.columns.length} 列 · {deal.cells.length} 个空位 · 单张移动</span></div>
      <div className="fg-stations">
        <section className="fg-parking" aria-label="单张临时空位"><h4>临时空位 <small>每格一张</small></h4>
          <div className="fg-cells" style={{ '--fg-cell-count': state.board.cells.length } as CSSProperties}>{state.board.cells.map((card, index) => {
            const place: FreecellPlace = { kind: 'cell', index }, attrs = buttonState(place);
            return <div className="fg-station" key={index}><span className="fg-place-name">空位 {index + 1}</span><button type="button" className={attrs.className} disabled={locked} aria-pressed={attrs.active}
              data-freecell-place={placeKey(place)} data-freecell-card={card ?? ''} data-freecell-legal={attrs.legal}
              aria-label={`空位 ${index + 1}，${card ? cardLabel(card) : '空'}${attrs.legal ? '，可放' : ''}`} onClick={() => activate(place)}>
              {card ? <Face card={card} /> : <span className="fg-empty"><b aria-hidden="true">＋</b><small>暂时停靠</small></span>}{preview(place)}
            </button></div>;
          })}</div>
        </section>
        <section className="fg-homes" aria-label="同花色升序归位区"><h4>归位区 <small>A → {deal.maxRank}</small></h4><div className="fg-foundations">{FREECELL_SUITS.map((suit, index) => {
          const place: FreecellPlace = { kind: 'foundation', index }, attrs = buttonState(place), rank = state.board.foundations[index];
          return <div className="fg-station" key={suit}><span className="fg-place-name">{SUIT_NAMES[suit]}</span><button type="button" className={`${attrs.className} fg-home`} disabled={locked}
            data-freecell-place={placeKey(place)} data-freecell-rank={rank} data-freecell-legal={attrs.legal}
            aria-label={`${SUIT_NAMES[suit]}归位区，${rank ? `已到 ${rankLabel(rank)}` : '等待 A'}${attrs.legal ? '，可放' : ''}`} onClick={() => activate(place)}>
            {rank ? <Face card={`${suit}${rank}`} /> : <span className={`fg-empty ${['H', 'D'].includes(suit) ? 'fg-red' : 'fg-black'}`}><b aria-hidden="true">{SUIT_SYMBOLS[suit]}</b><small>从 A 开始</small></span>}{preview(place)}
          </button></div>;
        })}</div></section>
      </div>
      <div className="fg-progress"><span>归位 <strong>{homeCount} / {deal.maxRank * 4}</strong></span><span>移动 <strong>{state.moves.length}</strong> 步</span><span>无计时 · 可撤销</span></div>
      <div className={`fg-columns fg-cols-${state.board.columns.length}`} style={{ '--fg-columns': state.board.columns.length } as CSSProperties} aria-label="牌列，按编号从左到右、换行继续">
        {state.board.columns.map((column, index) => {
          const place: FreecellPlace = { kind: 'column', index }, attrs = buttonState(place), card = column.at(-1);
          return <section className="fg-column" aria-label={`第 ${index + 1} 列，${column.length} 张`} key={index}><h4>第 {index + 1} 列 <small>{column.length} 张</small></h4>
            <div className="fg-stack">{column.slice(0, -1).map((covered) => <div className="fg-covered" key={covered} aria-label={`${cardLabel(covered)}，被覆盖，不可移动`}><Face card={covered} compact /></div>)}
              <button type="button" className={attrs.className} disabled={locked} aria-pressed={attrs.active}
                data-freecell-place={placeKey(place)} data-freecell-card={card ?? ''} data-freecell-legal={attrs.legal}
                aria-label={`第 ${index + 1} 列，${card ? `顶牌${cardLabel(card)}` : '空列，任意单张可放'}${attrs.legal ? '，可放' : ''}`} onClick={() => activate(place)}>
                {card ? <Face card={card} /> : <span className="fg-empty"><b aria-hidden="true">◇</b><small>任意单张</small></span>}{preview(place)}
              </button>
            </div>
          </section>;
        })}
      </div>
      <div className="fg-selection"><p>{paused ? '已暂停，牌桌已锁定。' : won ? '四种花色都到家了。' : selectedCard ? `已选：${cardLabel(selectedCard)}。点“可放”处完成移动。` : '先点顶牌，再点目标。空列也可以放牌。'}</p><button type="button" data-freecell-cancel disabled={locked || !state.selected} onClick={cancel}>取消选择</button></div>
      <p className="fg-message" role="status" data-freecell-message>{message}</p>
    </section>
    <aside className="fg-notes"><span className="fg-eyebrow">FREECELL · 小牌堆练习</span><h3>给下一步，留一个空位</h3>
      <ol><li><strong>牌列：</strong>只移动最下方完整露出的顶牌。叠放时红黑交替，新牌点数恰好小 1；空列可放任意一张。</li><li><strong>空位：</strong>每格最多一张；可以从空位移到另一空位、牌列或归位区。</li><li><strong>归位：</strong>每种花色从 A 开始，依次 2、3……直到本关最大点数。不能跳点数或混花色。</li></ol>
      <p>红色：♥ 红桃、♦ 方块。黑色：♠ 黑桃、♣ 梅花。花色都有符号和文字。</p>
      <details><summary>本关牌组与操作说明</summary><p>这是 12 个原创有限教学牌局。每关包含完整的四种花色 A–{deal.maxRank}，共 {deal.maxRank * 4} 张，并非完整 52 张牌模式。</p>
        <p>开局归位：{FREECELL_SUITS.map((suit, i) => `${SUIT_NAMES[suit]}${deal.foundations[i] ? `已到 ${rankLabel(deal.foundations[i])}` : '为空'}`).join('；')}。开局已归位的牌也计入总数。</p>
        <p>任何合法单张移动都会接受，包括空位之间的转移。不提供整串搬运，也不会自动归位。归位后不能直接取回，但可以撤销最近的移动。</p>
        <p>点已选牌或“取消选择”取消；Tab 换控件，Enter / 空格操作，Escape 暂停。提示只建议当前合法的一步，不保证它能通向完成。</p>
      </details>
      <p className="fg-save" data-freecell-save>{saved ? '移动记录和选择已存本机；恢复时逐步检查是否合法。' : '本机存档暂不可用或记录过长；仍可游玩，离开后可能回到上次保存的位置。'}</p>
      <p className="fg-origin">通用 FreeCell 规则的原创实现、手作教学牌局与矢量插画。GPL-3.0-only，无第三方游戏代码或素材。</p>
    </aside>
  </div>;
}
