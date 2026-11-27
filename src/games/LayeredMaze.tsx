// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameProps } from '../lib/types';
import { mazeBoards } from './layeredMazeLevels';
import {
  MAZE_SAVE, arrows, countBits, directionNames, directions, floorOf, floorSize, fullStampMask,
  initialMaze, loadMaze, mazeHint, moveMaze, openCell, stairAt, won, type Direction, type Move,
} from './layeredMazeLogic';
import './layeredMaze.css';

const intro = '集齐邮戳再进出口。楼梯通过一次后，两端都会关闭。';
const keys: Record<string, Move> = { ArrowUp: 'N', ArrowRight: 'E', ArrowDown: 'S', ArrowLeft: 'W' };
const showMove = (m: Move) => typeof m === 'number' ? '走楼梯 ' + (m + 1) : directionNames[m] + '一格';
export default function LayeredMaze(props: GameProps) {
  return <Round key={props.level + ':' + props.resetToken} {...props} />;
}
function Round({ level, paused, freshStart, hintToken, undoToken, onComplete, onStatus }: GameProps) {
  const b = mazeBoards[level] ?? mazeBoards[0];
  const saveKey = MAZE_SAVE + '.round.' + level;
  const [history, setHistory] = useState(() => {
    try { return freshStart ? initialMaze(b) : loadMaze(b, localStorage.getItem(saveKey)); }
    catch { return initialMaze(b); }
  });
  const p = history[history.length - 1].position;
  const area = floorSize(b), floor = floorOf(b, p.cell), currentStair = stairAt(b, p.cell);
  const [preview, setPreview] = useState<number | null>(null);
  const [message, setMessage] = useState(intro);
  const [hint, setHint] = useState<Move | null>(null);
  const [saved, setSaved] = useState(true);
  const live = useRef({ onStatus, onComplete });
  live.current = { onStatus, onComplete };
  const used = useRef({ hintToken, undoToken, completed: false });
  const finished = won(b, p), locked = paused || finished;
  const shown = preview ?? floor;
  const form = (f: number) => (f + 1) + ' 层';
  function report(s: string) {
    setMessage(s);
    live.current.onStatus(s);
  }
  useEffect(() => { live.current.onStatus(intro); }, []);
  useEffect(() => {
    try {
      localStorage.setItem(saveKey, JSON.stringify({ id: b.id, moves: history.slice(1).map(step => step.move) }));
      setSaved(true);
    } catch { setSaved(false); }
  }, [history, b.id, saveKey]);
  useEffect(() => {
    if (paused || !finished || used.current.completed) return;
    used.current.completed = true;
    live.current.onStatus('邮戳集齐，成功走出迷宫！');
    live.current.onComplete();
  }, [paused, finished]);
  useEffect(() => {
    if (used.current.hintToken === hintToken) return;
    used.current.hintToken = hintToken;
    if (locked) return;
    setPreview(null);
    const next = mazeHint(b, p);
    setHint(next?.move ?? null);
    report(next
      ? '建议' + showMove(next.move) + '，最短还需 ' + next.distance + ' 步。提示不会移动角色。'
      : '从当前位置已无通关路线。撤销上一次移动试试。');
  }, [b, p, hintToken, locked]);
  useEffect(() => {
    if (used.current.undoToken === undoToken) return;
    used.current.undoToken = undoToken;
    if (locked) return;
    setPreview(null);
    setHint(null);
    if (history.length === 1) { report('还没有可以撤销的移动。'); return; }
    setHistory(history.slice(0, -1));
    report('已撤销一步，邮戳与楼梯一并恢复。');
  }, [history, undoToken, locked]);

  function apply(move: Move) {
    if (locked || preview !== null) return;
    const next = moveMaze(b, p, move);
    if (!next) {
      report(typeof move === 'number'
        ? currentStair !== move ? '请先走到这座楼梯。' : '这座楼梯已经关闭。'
        : '那边走不通。');
      return;
    }
    setHint(null);
    setHistory([...history, { position: next, move }]);
    if (won(b, next)) return;
    report(next.cell === b.exit ? '还没集齐邮戳，可以继续走。'
      : typeof move === 'number' ? '来到' + form(floorOf(b, next.cell)) + '。楼梯 ' + (move + 1) + ' 的两端已关闭。'
      : next.stamps !== p.stamps ? '已收集邮戳 ' + countBits(next.stamps) + '/' + b.stamps.length + '。'
      : '已移动 ' + history.length + ' 步。');
  }
  return (
    <div className="puzzle-layout layered-maze" data-maze-id={b.id} data-pos={p.cell}
      data-spent={p.spent} data-stamps={p.stamps} data-view={shown} data-won={finished}>
      <section className="maze-panel" tabIndex={0} aria-label="层梯迷宫棋盘，方向键移动，数字键使用楼梯"
        onKeyDown={e => {
          if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.repeat) return;
          const action = Object.hasOwn(keys, e.key) ? keys[e.key] : /^[1-6]$/.test(e.key) ? Number(e.key) - 1 : undefined;
          if (action === undefined || locked || preview !== null) return;
          e.preventDefault();
          apply(action);
        }}>
        <header className="maze-head">
          <div><small>层梯迷宫 · 第 {level + 1} 关</small><h3>{b.title}</h3></div>
          <div className="maze-counters">
            <strong>邮戳 {countBits(p.stamps)} / {b.stamps.length}</strong>
            <span>{history.length - 1} 步</span>
          </div>
        </header>
        <div className="maze-floors" role="group" aria-label="查看楼层">
          {b.floors.map((_, f) => <button type="button" key={f} aria-pressed={shown === f}
            aria-label={f === floor ? form(f) + '，所在楼层' : '预览' + form(f)}
            onClick={() => setPreview(f === floor ? null : f)}
            disabled={paused}>
            <strong>{form(f)}</strong><small>{f === floor ? '所在' : '预览'}</small>
          </button>)}
        </div>
        <div className="maze-grid" style={{ '--maze-cols': b.width } as CSSProperties} aria-label={form(shown) + '地图'}>
          {Array.from({ length: area }, (_, i) => {
            const cell = shown * area + i, stair = stairAt(b, cell), stamp = b.stamps.indexOf(cell);
            const open = openCell(b, cell), spent = stair >= 0 && !!(p.spent & 1 << stair);
            const collected = stamp >= 0 && !!(p.stamps & 1 << stamp), player = p.cell === cell, exit = cell === b.exit;
            const destination = typeof hint === 'string' ? moveMaze(b, p, hint)?.cell : hint === stair ? p.cell : undefined;
            const label = [open ? '通道' : '墙', player && '你在这里', stair >= 0 && '梯' + (stair + 1) + (spent ? '已关' : ''),
              stamp >= 0 && (collected ? '邮戳已取' : '待取邮戳'), exit && '出口'].filter(Boolean).join('，');
            return <div key={cell} className="maze-cell" data-maze-cell={cell} data-wall={!open}
              data-spent={spent} data-stamp={stamp >= 0 && !collected} data-player={player}
              data-exit={exit} data-hinted={destination === cell} aria-label={label}>
              {stair >= 0 && <span className="maze-cell-mark">梯{stair + 1}{spent ? '·关' : ''}</span>}
              {stamp >= 0 && <span className="maze-symbol" aria-hidden="true">{collected ? '✓' : '✦'}</span>}
              {exit && <span className="maze-cell-mark maze-exit">{p.stamps === fullStampMask(b) ? '出口' : '出口·待戳'}</span>}
              {player && <span className="maze-player" aria-hidden="true">●</span>}
            </div>;
          })}
        </div>
        <div className="maze-controls">
          <div className="maze-pad" role="group" aria-label="移动方向">
            {(Object.keys(directions) as Direction[]).map(d => <button type="button" key={d} data-maze-move={d}
              data-hinted={hint === d} aria-label={directionNames[d]} disabled={locked || preview !== null}
              onClick={() => apply(d)}>{arrows[d]}</button>)}
          </div>
          {preview !== null ? <button type="button" className="maze-stair" onClick={() => setPreview(null)}>回到所在楼层</button>
            : <button type="button" className="maze-stair" data-hinted={hint === currentStair}
              disabled={locked || currentStair < 0 || !!(p.spent & 1 << currentStair)}
              data-maze-cross={currentStair} onClick={() => apply(currentStair)}>
              {currentStair < 0 ? '先走到楼梯' : p.spent & 1 << currentStair ? '梯 ' + (currentStair + 1) + ' 已关闭'
                : '走楼梯 ' + (currentStair + 1) + ' → ' + form(floorOf(b, b.stairs[currentStair].find(i => i !== p.cell)!))}
            </button>}
        </div>
        <p className="maze-message" role="status">{paused ? '已暂停。' : finished ? '邮戳集齐，成功走出迷宫！' : preview !== null
          ? '正在预览' + form(shown) + '，角色没有移动。' : message}</p>
        {!saved && <p className="maze-save-error">浏览器未能保存这局，刷新后可能丢失进度。</p>}
      </section>
      <aside className="game-notes">
        <span className="mini-label">单次楼梯 · 多层规划</span>
        <h3>留一条回来的路。</h3>
        <ol>
          <li>走过 ✦ 自动收集邮戳。集齐所有邮戳后，进入出口过关。</li>
          <li>站在楼梯格才能换层；每座楼梯只通行一次。楼梯关闭后，两端的格子依然可以走过。</li>
          <li>可预览其他楼层。走进死路时，撤销一步会一起恢复位置、邮戳和楼梯。</li>
        </ol>
        <p>桌面：方向键移动，数字键使用同编号楼梯。触屏：点方向或「走楼梯」。</p>
      </aside>
    </div>
  );
}
