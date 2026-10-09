// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import { Check, Music2, Target } from "lucide-react";
import type { GameProps } from "../lib/types";
import { createSoloChessState, moveSoloChess, SOLO_PIECE_NAMES, SOLO_PIECE_SYMBOLS, soloChessCoordinate, soloChessLevels, soloChessMoves, soloChessWon, solveSoloChess, undoSoloChess, type SoloChessMove, type SoloPiece } from "./soloChessLogic";
import "./soloChess.css";

export default function SoloChess(props: GameProps) {
  return <SoloChessRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function SoloChessRound({ level, paused, hintToken, undoToken, onComplete, onStatus }: GameProps) {
  const config = soloChessLevels[level] ?? soloChessLevels[0];
  const [state, setState] = useState(() => createSoloChessState(config));
  const current = useRef(state);
  const [selected, setSelected] = useState<number | null>(null), selection = useRef<number | null>(null);
  const [hinted, setHinted] = useState<SoloChessMove | null>(null);
  const [message, setMessage] = useState("先选一枚棋子，再点它能吃掉的棋子。每步必须吃子，最后只留一枚。这里不分敌我，也没有将军。");
  const callbacks = useRef({ onComplete, onStatus }); callbacks.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken }), notified = useRef(false);
  const won = soloChessWon(config, state.board), moves = soloChessMoves(config, state.board), count = state.board.filter(Boolean).length;
  const targets = moves.filter((move) => move.fromCell === selected).map((move) => move.toCell);
  const kinds = [...new Set(config.start.filter((kind): kind is SoloPiece => kind !== null))];
  useEffect(() => { if (!paused) callbacks.current.onStatus(message); }, [message, paused]);
  useEffect(() => {
    if (won && !paused && !notified.current) { notified.current = true; setMessage(`独奏完成！经过 ${state.history.length} 次吃子，棋盘上只剩一位演奏家。`); callbacks.current.onComplete(); }
  }, [won, paused, state.history.length]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || soloChessWon(config, current.current.board)) return;
    const result = solveSoloChess(config, current.current.board), move = result.solution?.[0];
    setHinted(move ?? null);
    if (move) {
      selection.current = move.fromCell; setSelected(move.fromCell);
      setMessage(`从当前棋盘继续：用 ${soloChessCoordinate(config, move.fromCell)} 的${SOLO_PIECE_NAMES[current.current.board[move.fromCell]!]}吃掉 ${soloChessCoordinate(config, move.toCell)} 的棋子。这是可完成的一种路线。`);
    } else setMessage(result.status === "limit" ? "本次搜索达到上限，还没有可靠建议。可以先想想哪枚棋子容易孤立。" : "当前布局无法收束为一枚棋子。请撤销最近的吃子，再试另一种顺序。");
  }, [hintToken, paused, config]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused || soloChessWon(config, current.current.board)) return;
    const next = undoSoloChess(config, current.current);
    setMessage(next === current.current ? "还没有吃子可以撤销。" : "已恢复上次吃子前的两枚棋子。换个顺序试试。" );
    current.current = next; setState(next); selection.current = null; setSelected(null); setHinted(null);
  }, [undoToken, paused, config]);
  function choose(cell: number) {
    if (paused || soloChessWon(config, current.current.board)) return;
    const piece = current.current.board[cell], from = selection.current;
    if (!piece) { setMessage("每步必须吃掉一枚棋子，不能走到空格。请点另一枚棋子作为目标。" ); return; }
    if (from === cell) { selection.current = null; setSelected(null); setHinted(null); setMessage("已取消选择，换一位演奏家试试。" ); return; }
    if (from !== null) {
      const next = moveSoloChess(config, current.current, { fromCell: from, toCell: cell });
      if (next !== current.current) {
        const kind = current.current.board[from]!;
        current.current = next; setState(next); selection.current = null; setSelected(null); setHinted(null);
        setMessage(soloChessMoves(config, next.board).length || soloChessWon(config, next.board) ? `${soloChessCoordinate(config, from)} 的${SOLO_PIECE_NAMES[kind]}吃到 ${soloChessCoordinate(config, cell)}，它仍然是一枚${SOLO_PIECE_NAMES[kind]}。` : "还有多枚棋子，但彼此已经吃不到了。请撤销一步，留出不同的接力点。" );
        return;
      }
    }
    selection.current = cell; setSelected(cell); setHinted(null);
    const legal = soloChessMoves(config, current.current.board).filter((move) => move.fromCell === cell).length;
    setMessage(`${from !== null ? "刚才那一步不能吃子；" : ""}已选中 ${soloChessCoordinate(config, cell)} 的${SOLO_PIECE_NAMES[piece]}，${legal ? `有 ${legal} 个可吃目标，点带圆圈的棋子。` : "暂时吃不到其他棋子，可以改选另一枚。"}`);
  }
  return <div className="schess-game" data-solo-chess-game data-solo-chess-won={won} data-solo-chess-count={count} data-solo-chess-captures={state.history.length}>
    <section className="schess-field" aria-label="棋子独奏棋盘"><header className="schess-heading"><div><span>SOLO CHESS · {level + 1}/{soloChessLevels.length}</span><h2>{config.title}</h2></div><Music2 size={31} aria-hidden="true" /></header>
      <div className="schess-stats"><span>剩余 <b>{count}</b> 枚</span><span>目标 <b>1</b> 枚</span><span>已吃 <b>{state.history.length}</b> 枚</span></div>
      <div className="schess-board-wrap"><div className="schess-columns" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${config.size}, 1fr)` }}>{Array.from({ length: config.size }, (_, col) => <span key={col}>{String.fromCharCode(65 + col)}</span>)}</div>
      <div className="schess-board" role="group" aria-label="先选棋子，再选可吃目标；Tab 和 Enter 也能操作" style={{ gridTemplateColumns: `repeat(${config.size}, minmax(0, 1fr))` }}>{state.board.map((piece, cell) => {
        const row = Math.floor(cell / config.size), col = cell % config.size, active = selected === cell, target = targets.includes(cell);
        return <button key={cell} type="button" data-sc-cell={cell} data-sc-piece={piece ?? ""} data-sc-selected={active} data-sc-target={target} className={`schess-cell ${(row + col) % 2 ? "schess-dark" : "schess-light"} ${active ? "schess-selected" : ""} ${target ? "schess-target" : ""} ${hinted?.toCell === cell ? "schess-hinted" : ""}`} disabled={paused || won} aria-pressed={active} aria-label={`${soloChessCoordinate(config, cell)}，${piece ? SOLO_PIECE_NAMES[piece] : "空格，不可落子"}${active ? "，已选中" : target ? "，可吃目标" : ""}`} onClick={() => choose(cell)}><small className="schess-row" aria-hidden="true">{row + 1}</small>{piece && <><span className="schess-piece" aria-hidden="true">{SOLO_PIECE_SYMBOLS[piece]}</span><span className="schess-name" aria-hidden="true">{SOLO_PIECE_NAMES[piece]}</span></>}{target && <span className="schess-target-ring" aria-hidden="true" />}</button>;
      })}</div></div>
      <div className="schess-selection"><Target size={16} aria-hidden="true" /><span>{won ? "演奏完成，只剩一枚棋子。" : selected === null ? "选择一枚棋子，查看它能吃谁。" : `${soloChessCoordinate(config, selected)} 已选中 · ${targets.length} 个可吃目标`}</span></div>
      <p className={`schess-feedback ${won ? "schess-success" : !moves.length ? "schess-stuck" : ""}`} role="status">{paused ? "棋盘已暂停，所有棋子保持原位。" : message}</p>
    </section>
    <aside className="schess-notes"><span className="schess-eyebrow">每一次落子，少一位伙伴</span><h3>一起上场，<br />一位谢幕。</h3><p>{config.lesson}</p><div className="schess-piece-guide" aria-label="本关棋子走法">{kinds.map((kind) => <div key={kind}><span aria-hidden="true">{SOLO_PIECE_SYMBOLS[kind]}</span><p><b>{SOLO_PIECE_NAMES[kind]}</b>{kind === "R" ? "横着或竖着走，不能越过棋子。" : kind === "B" ? "沿对角线走，不能越过棋子。" : kind === "N" ? "走日字：两格加一格，可以跳过棋子。" : "向任何方向走相邻一格。"}</p></div>)}</div><ol><li>所有棋子属于同一道谜题，没有黑白双方，也不检查将军。</li><li>每一步都必须吃子。移动到目标后，保留吃子者的种类。</li><li>空格不能作为落点；最后剩一枚任意棋子即通关。</li></ol><p className="schess-note"><Check size={15} aria-hidden="true" />提示从当前布局重新推演。走入死局时，可以撤销并改换吃子顺序。</p></aside>
  </div>;
}
