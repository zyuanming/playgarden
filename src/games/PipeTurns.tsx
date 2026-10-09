// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { inspectPipes, pipeDirections, pipeTurnsHint, pipeTurnsLevels, rotatePipe } from "./pipeTurnsLogic";
import "./pipeTurns.css";
export default function PipeTurns(props: GameProps) { return <PipeRound key={`${props.level}:${props.resetToken}`} {...props} />; }
function PipeRound({ level, paused, hintToken, undoToken, onStatus, onComplete }: GameProps) {
  const config = pipeTurnsLevels[level] ?? pipeTurnsLevels[0];
  const [board, setBoard] = useState(() => [...config.initial]), [history, setHistory] = useState<number[][]>([]);
  const [hint, setHint] = useState<ReturnType<typeof pipeTurnsHint> | null>(null);
  const seenHint = useRef(hintToken), seenUndo = useRef(undoToken), done = useRef(false);
  const result = inspectPipes(config, board), locked = paused || result.won;
  useEffect(() => { onStatus("点击水管顺时针转 90°。把所有管道、每朵花与固定水源接成一个没有漏口的网络。"); }, []);
  useEffect(() => {
    if (seenHint.current === hintToken) return; seenHint.current = hintToken;
    if (locked) return; const next = pipeTurnsHint(config, board); setHint(next); onStatus(next.text);
  }, [hintToken, locked, config, board, onStatus]);
  useEffect(() => {
    if (seenUndo.current === undoToken) return; seenUndo.current = undoToken;
    if (locked) return;
    if (history.length) { setBoard(history[history.length - 1]); setHistory(history.slice(0, -1)); setHint(null); onStatus("已撤销一次旋转。"); }
    else onStatus("还没有旋转可以撤销。");
  }, [undoToken, locked, history, onStatus]);
  useEffect(() => { if (result.won && !paused && !done.current) { done.current = true; onStatus("全园通水！所有管道与花朵都连上水源，而且没有漏口。"); onComplete(); } }, [result.won, paused, onStatus, onComplete]);
  function turn(cell: number) {
    if (locked || cell === config.source || !board[cell] || rotatePipe(board[cell]) === board[cell]) return;
    setHistory([...history, board]); setBoard(board.map((m, i) => i === cell ? rotatePipe(m) : m)); setHint(null);
  }
  const tips = [[50, 0], [100, 50], [50, 100], [0, 50]];
  return <div className="puzzle-layout pt-game" data-pipe-turns-won={result.won} data-pipe-turns-board={board.join(",")} data-pipe-turns-moves={history.length}>
    <section className="pt-workbench" aria-label="水管旋转棋盘">
      <header className="pt-heading"><span className="mini-label">水管转转 · {config.title}</span><strong>{history.length} 次旋转</strong></header>
      <div className="pt-counters"><span>💧 通水 {result.wet.size}/{board.filter(Boolean).length}</span><span>✿ 花朵 {config.outlets.filter(i => result.wet.has(i)).length}/{config.outlets.length}</span><span className={result.leakCount ? "pt-leaking" : ""}>漏口 {result.leakCount}</span></div>
      <div className="pt-board" style={{ gridTemplateColumns: `repeat(${config.size}, 1fr)` }} aria-label="点击旋转，水源固定">
        {board.map((mask, i) => {
          const source = i === config.source, outlet = config.outlets.includes(i), fixed = source || mask === 15;
          return mask ? <button key={i} data-pipe-cell={i} data-pipe-mask={mask} className={`pt-tile ${result.wet.has(i) ? "pt-wet" : ""} ${hint?.cell === i ? "pt-hinted" : ""} ${source ? "pt-source" : ""}`} disabled={locked || fixed} onClick={() => turn(i)} aria-label={`第 ${Math.floor(i / config.size) + 1} 行第 ${i % config.size + 1} 列，${source ? "固定水源" : outlet ? "花朵出口" : mask === 15 ? "固定十字管" : "水管"}，管口朝${pipeDirections.filter(d => mask & d.bit).map(d => d.label).join("、")}，${result.leaks[i].length} 个漏口`}>
            <svg viewBox="0 0 100 100" aria-hidden="true"><g className="pt-pipe-shadow">{pipeDirections.map((d, k) => mask & d.bit ? <path key={k} d={`M50 50 L${tips[k][0]} ${tips[k][1]}`} /> : null)}</g><g className="pt-pipe-flow">{pipeDirections.map((d, k) => mask & d.bit ? <path key={k} d={`M50 50 L${tips[k][0]} ${tips[k][1]}`} /> : null)}</g><circle cx="50" cy="50" r="17" className="pt-joint" />{result.leaks[i].map(k => <circle key={k} cx={50 + (tips[k][0] - 50) * .8} cy={50 + (tips[k][1] - 50) * .8} r="4.5" className="pt-leak-dot" />)}<text x="50" y="58" textAnchor="middle">{source ? "水" : outlet ? "✿" : ""}</text></svg>
            <small>{Math.floor(i / config.size) + 1},{i % config.size + 1}</small>
          </button> : <div key={i} className="pt-empty" aria-label="空地，没有水管"><span aria-hidden="true">·</span></div>;
        })}
      </div>
      <p className="pt-feedback" role="status">{paused ? "已暂停，水管暂时锁定。" : result.won ? "每朵花都喝到水啦！" : hint?.text ?? "蓝色 = 已连到水源 · 红点 = 管口未接合。点击一次顺时针转 90°。"}</p>
    </section>
    <aside className="game-notes pt-notes"><span className="mini-label">方向 · 连通 · 完整网络</span><h3>转个弯，让水走通。</h3><p>{config.lesson}</p><ol><li>点击已有的直管、弯管、三通或花朵出口，顺时针旋转。</li><li>相邻管口必须面对面。朝向边界或没有对应管口都会漏水。</li><li>所有水管都要连到标有“水”的固定水源，所有花朵都要收到水，漏口必须为零。</li></ol><p>灰色空地不参与。蓝色只表示与水源连通；蓝管也可能仍有红色漏口。四向十字管旋转后不变，因此固定。</p><div className="pt-legend"><span>💧 一个水源</span><span>✿ 多个出口</span><span>↻ 只旋转，不搬动</span></div><p className="pt-access">触屏轻点；键盘 Tab 选择，Enter / 空格旋转。没有计时压力，撤销可恢复上一步。</p></aside>
  </div>;
}
