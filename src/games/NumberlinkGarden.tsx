// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { GameProps } from "../lib/types";
import { numberlinkChapters, numberlinkLevels } from "./numberlinkLevels";
import { createNumberlinkState, endpointPair, numberlinkCovered, numberlinkMarks, numberlinkSolved, pairConnected, playNumberlinkAction, undoNumberlinkAction, NUMBERLINK_HISTORY_LIMIT, type NumberlinkAction } from "./numberlinkLogic";
import { loadNumberlinkRound, saveNumberlinkRound } from "./numberlinkStorage";
import "./numberlinkGarden.css";

const intro = "点一个符号端点，再点线头上下左右的相邻格。彩线不能交叉，最后要铺满所有可走格。";
export default function NumberlinkGarden(props: GameProps) {
  return <NumberlinkRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function NumberlinkRound({ level, paused, freshStart, hintToken, undoToken, onComplete, onStatus }: GameProps) {
  const puzzle = numberlinkLevels[level] ?? numberlinkLevels[0];
  const [state, setState] = useState(() => freshStart ? createNumberlinkState(puzzle) : loadNumberlinkRound(level, puzzle));
  const [selected, setSelected] = useState<number | null>(null), [focusCell, setFocusCell] = useState(0);
  const [message, setMessage] = useState(intro), [saved, setSaved] = useState(true), [showExample, setShowExample] = useState(false);
  const stateRef = useRef(state), selectedRef = useRef<number | null>(null);
  const cellRefs = useRef(new Map<number, HTMLButtonElement>()), notified = useRef(false);
  const tokens = useRef({ hintToken, undoToken }), callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const won = numberlinkSolved(puzzle, state.paths), locked = paused || won;
  const covered = numberlinkCovered(puzzle, state.paths), total = puzzle.rows * puzzle.cols - puzzle.holes.length;
  const connections = state.paths.filter((_, pair) => pairConnected(puzzle, state.paths, pair)).length;
  const limit = state.history.length >= NUMBERLINK_HISTORY_LIMIT;
  const coords = (cell: number) => `${Math.floor(cell / puzzle.cols) + 1}行${cell % puzzle.cols + 1}列`;
  const points = (path: readonly number[]) => path.map(cell => `${(cell % puzzle.cols) * 100 + 50},${Math.floor(cell / puzzle.cols) * 100 + 50}`).join(" ");
  function report(text: string) { setMessage(text); callbacks.current.onStatus(text); }
  function select(pair: number | null) { selectedRef.current = pair; setSelected(pair); }
  function update(next: typeof state) { stateRef.current = next; setState(next); }
  function commit(action: NumberlinkAction) {
    if (paused || numberlinkSolved(puzzle, stateRef.current.paths)) return;
    const result = playNumberlinkAction(puzzle, stateRef.current, action);
    if (result.error) { report(result.error); return; }
    update(result.state);
    const mark = numberlinkMarks[action.pair];
    const done = pairConnected(puzzle, result.state.paths, action.pair);
    if (action.kind === "clear") report(`已清除${mark.symbol}${mark.name}路线，其他线不变。点任一同符号端点重新开始。`);
    else if (done) report(`${mark.symbol}${mark.name}相连了！${numberlinkCovered(puzzle, result.state.paths)} / ${total} 格已覆盖。全部接通后，也要铺满空格。`);
    else report(`${mark.symbol}${mark.name}线头在${coords(action.cell)}。继续点相邻格；点回自己的线，可以收回后半段。`);
  }
  function clickCell(cell: number) {
    if (paused || numberlinkSolved(puzzle, stateRef.current.paths)) return;
    setFocusCell(cell);
    const pair = selectedRef.current, owner = endpointPair(puzzle, cell);
    if (pair !== null && stateRef.current.paths[pair].length && (owner === -1 || owner === pair)) {
      commit({ kind: "step", pair, cell }); return;
    }
    if (owner !== -1) {
      select(owner); commit({ kind: "start", pair: owner, cell }); return;
    }
    report("先点一个带符号的端点，选好要画的彩线。");
  }
  function choosePair(pair: number) {
    if (locked) return;
    select(pair);
    const path = stateRef.current.paths[pair];
    report(path.length ? `已选${numberlinkMarks[pair].symbol}${numberlinkMarks[pair].name}，线头在${coords(path[path.length - 1])}。点回已有线可收回后半段。` : `已选${numberlinkMarks[pair].symbol}${numberlinkMarks[pair].name}。请点它的任一端点出发。`);
  }
  function revealExample() {
    if (locked) return;
    setShowExample(true);
    report("参考图展示一组完整可行路线，不是根据当前走法求出的下一步。可先清除不同的路线再参考；你的其他规则正确解法也会被接受。");
  }
  useEffect(() => { callbacks.current.onStatus(puzzle.lesson); }, [puzzle]);
  useEffect(() => { setSaved(saveNumberlinkRound(level, puzzle, state)); }, [level, puzzle, state]);
  useEffect(() => { if (paused) { select(null); setShowExample(false); } }, [paused]);
  useEffect(() => {
    if (!won || paused || notified.current) return;
    notified.current = true;
    report(`满园相逢！${puzzle.pairs.length} 对伙伴全部连通，${total} 格都铺好了。`);
    callbacks.current.onComplete();
  }, [won, paused, puzzle.pairs.length, total]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    const previous = stateRef.current.history[stateRef.current.history.length - 1];
    const next = undoNumberlinkAction(puzzle, stateRef.current);
    update(next); select(previous?.pair ?? null);
    report(previous ? "已撤销上一步，路线恢复到刚才。可以继续修改。" : "还没有可以撤销的落笔。");
  }, [undoToken, locked, puzzle]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (!locked) revealExample();
  }, [hintToken, locked]);
  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, cell: number) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const directions: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -puzzle.cols, ArrowDown: puzzle.cols };
    const delta = directions[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    let next = cell;
    do {
      const candidate = next + delta;
      if (candidate < 0 || candidate >= puzzle.rows * puzzle.cols || (Math.abs(delta) === 1 && Math.floor(candidate / puzzle.cols) !== Math.floor(next / puzzle.cols))) return;
      next = candidate;
    } while (puzzle.holes.includes(next));
    setFocusCell(next); cellRefs.current.get(next)?.focus({ preventScroll: true });
  }
  const pairTone = (pair: number): CSSProperties => ({ "--nl-color": numberlinkMarks[pair].color, "--nl-pale": numberlinkMarks[pair].pale } as CSSProperties);
  return <div className="numberlink-layout" data-numberlink-id={puzzle.id} data-numberlink-paths={JSON.stringify(state.paths)} data-numberlink-won={won}
    data-numberlink-covered={covered} data-numberlink-connected={connections} data-numberlink-moves={state.history.length} data-numberlink-selected={selected ?? ""}
    onKeyDownCapture={event => { if ((event.repeat || event.ctrlKey || event.metaKey || event.altKey) && ["Enter", " "].includes(event.key)) event.preventDefault(); }}>
    <section className="numberlink-play" aria-label="彩线连园游戏">
      <header className="numberlink-heading"><div><span className="numberlink-eyebrow">{numberlinkChapters[puzzle.chapter]}</span><h3>{puzzle.title}</h3></div><span className="numberlink-counter">{String(level + 1).padStart(2, "0")} / {numberlinkLevels.length}</span></header>
      <p className="numberlink-lesson">{puzzle.lesson}</p>
      <div className="numberlink-stats"><span>相逢 <strong>{connections} / {puzzle.pairs.length}</strong> 对</span><span>覆盖 <strong>{covered} / {total}</strong> 格</span><span>{paused ? "已暂停" : won ? "满园相逢 ✓" : "不计时 · 可修改"}</span></div>
      <div className="numberlink-meter" role="progressbar" aria-label="格子覆盖" aria-valuemin={0} aria-valuemax={total} aria-valuenow={covered}><span style={{ width: `${100 * covered / total}%` }} /></div>
      <div className="numberlink-pairs" role="group" aria-label="选择彩线">
        {puzzle.pairs.map((_, pair) => <button type="button" key={pair} data-numberlink-pair={pair} style={pairTone(pair)} className={selected === pair ? "is-selected" : ""}
          aria-label={`选择${numberlinkMarks[pair].name}路线`} aria-pressed={selected === pair} disabled={locked} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.altKey) choosePair(pair); }}>
          <span aria-hidden="true">{numberlinkMarks[pair].symbol}</span>{numberlinkMarks[pair].name}<small>{pairConnected(puzzle, state.paths, pair) ? "已接通 ✓" : state.paths[pair].length ? "画线中" : "待出发"}</small>
        </button>)}
      </div>
      <p className="numberlink-board-caption">先点符号，再逐格点相邻格 · 不用拖动</p>
      <div className={`numberlink-board ${paused ? "is-paused" : ""}`} role="group" aria-label={`${puzzle.rows}行${puzzle.cols}列彩线花园`}
        style={{ "--nl-cols": puzzle.cols } as CSSProperties}>
        <svg className="numberlink-lines" viewBox={`0 0 ${puzzle.cols * 100} ${puzzle.rows * 100}`} preserveAspectRatio="none" aria-hidden="true">
          {state.paths.map((path, pair) => <polyline key={pair} points={points(path)} fill="none" stroke={numberlinkMarks[pair].color} strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" opacity={selected === null || selected === pair ? 1 : .62} />)}
        </svg>
        {Array.from({ length: puzzle.rows * puzzle.cols }, (_, cell) => {
          const hole = puzzle.holes.includes(cell), endpoint = endpointPair(puzzle, cell), pathOwner = state.paths.findIndex(path => path.includes(cell));
          const pair = endpoint >= 0 ? endpoint : pathOwner, mark = pair >= 0 ? numberlinkMarks[pair] : null;
          const selectedPath = selected === null ? [] : state.paths[selected], isHead = selectedPath[selectedPath.length - 1] === cell;
          return hole ? <div key={cell} className="numberlink-hole" role="img" aria-label={`${coords(cell)}，石凳，不能经过`}><span aria-hidden="true">✿</span></div> :
            <button type="button" key={cell} data-numberlink-cell={cell} data-numberlink-owner={pathOwner} data-numberlink-endpoint={endpoint} data-numberlink-head={isHead}
              ref={node => { if (node) cellRefs.current.set(cell, node); else cellRefs.current.delete(cell); }}
              className={`numberlink-cell ${endpoint >= 0 ? "is-endpoint" : ""} ${isHead ? "is-head" : ""}`} style={pair >= 0 ? pairTone(pair) : undefined}
              aria-label={`${coords(cell)}，${endpoint >= 0 ? `${mark!.name}端点` : mark ? `${mark.name}路线` : "空格"}${isHead ? "，当前线头" : ""}`}
              tabIndex={focusCell === cell ? 0 : -1} disabled={locked || limit} onFocus={() => setFocusCell(cell)} onKeyDown={event => moveFocus(event, cell)}
              onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.altKey) clickCell(cell); }}>
              {endpoint >= 0 ? <span className="numberlink-endpoint" aria-hidden="true">{mark!.symbol}</span> : pathOwner >= 0 ? <span className="numberlink-path-mark" aria-hidden="true">{mark!.symbol}</span> : <span className="numberlink-empty-dot" aria-hidden="true">·</span>}
            </button>;
        })}
      </div>
      <div className="numberlink-actions"><button type="button" disabled={locked || selected === null || !state.paths[selected]?.length || limit} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.altKey && selected !== null) commit({ kind: "clear", pair: selected }); }}>清除选中路线</button>
        <span>{selected === null ? "请选择一个端点" : `正在编辑：${numberlinkMarks[selected].symbol} ${numberlinkMarks[selected].name}`}</span></div>
      <p className="numberlink-message" role="note">{message}</p>
      {limit && !won && <p className="numberlink-warning">本局记录已满。撤销一步或重来后可以继续。</p>}
      <p className="numberlink-save">{saved ? "此浏览器已保存路线和撤销记录，回来后可继续。" : "浏览器暂时无法保存，请保持页面打开；仍可正常画线和撤销。"}</p>
    </section>
    <aside className="numberlink-notes"><span className="numberlink-eyebrow">让每一格，都有相逢</span><h3>彩线绕一绕，<br />伙伴手牵手。</h3><p>同颜色、同符号的两个端点是一对。每条线只能横着或竖着走，不能踩到另一条线，也不能经过石凳。</p>
      <ol><li>点一个端点，然后逐格点相邻格。</li><li>连到相同符号的另一端。点击上方符号标签，可切换要修改的路线。</li><li>每对相连，且所有可走格都被覆盖，就成功了。</li></ol>
      <div className="numberlink-tip"><strong>接通了，还没铺满？</strong><p>近路可能留下空格。选中那条线，点回线上的格子收回后半段，再绕远一点。</p></div>
      <button type="button" className="numberlink-example-toggle" disabled={paused} onClick={() => { if (showExample) setShowExample(false); else if (!won) revealExample(); else setShowExample(true); }}>{showExample ? "收起参考图" : "查看完整参考图"}</button>
      {showExample && !paused && <figure className="numberlink-example" data-numberlink-example>
        <figcaption>一组可行路线 · 不判断唯一性</figcaption>
        <svg viewBox={`0 0 ${puzzle.cols * 100} ${puzzle.rows * 100}`} role="img" aria-label="本关一组完整参考路线；下面提供每条路线的行列坐标">
          {Array.from({ length: puzzle.rows * puzzle.cols }, (_, cell) => <rect key={cell} x={(cell % puzzle.cols) * 100 + 4} y={Math.floor(cell / puzzle.cols) * 100 + 4} width="92" height="92" rx="13" fill={puzzle.holes.includes(cell) ? "#cbd4c6" : "#f8f5ea"} />)}
          {puzzle.example.map((path, pair) => <g key={pair}><polyline points={points(path)} fill="none" stroke={numberlinkMarks[pair].color} strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />{puzzle.pairs[pair].map(cell => <g key={cell}><circle cx={(cell % puzzle.cols) * 100 + 50} cy={Math.floor(cell / puzzle.cols) * 100 + 50} r="31" fill={numberlinkMarks[pair].pale} stroke={numberlinkMarks[pair].color} strokeWidth="3" /><text x={(cell % puzzle.cols) * 100 + 50} y={Math.floor(cell / puzzle.cols) * 100 + 51} textAnchor="middle" dominantBaseline="central" fontSize="33" fill={numberlinkMarks[pair].color}>{numberlinkMarks[pair].symbol}</text></g>)}</g>)}
        </svg><p>这是独立于当前走法的一张参考图。没有承诺唯一解或最短路线；符合规则的其他铺法也有效。</p>
        <details><summary>参考路线的行列坐标</summary>{puzzle.example.map((path, pair) => <p key={pair}>{numberlinkMarks[pair].symbol} {numberlinkMarks[pair].name}：{path.map(coords).join(" → ")}</p>)}</details>
      </figure>}
      <details className="numberlink-help"><summary>修改、保存和键盘</summary><p>选中一条线，再点回它已经经过的格子，会收回后半段。点另一对端点会切换到那一对，并从所点端点重新画。也可用“清除选中路线”重画整条线。未通关前，工具栏的“撤销”可以退回一次落笔、回收或清除。</p><p>Tab 进入棋盘，方向键移动焦点，Enter 或空格落笔。方向键只移动焦点，不会自动画线；石凳会被跳过。长按与 Ctrl / Alt / ⌘ 组合不会重复落笔。Escape 暂停或继续。</p><p>暂停时不能修改路线。重来会清空本关彩线。端点本身计入覆盖格数；只有所有伙伴接通并覆盖全部可走格才算通关。</p></details>
    </aside>
  </div>;
}
