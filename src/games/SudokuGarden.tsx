import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  createSudokuState,
  isSudokuSolved,
  sudokuCandidates,
  sudokuConflicts,
  sudokuHint,
  sudokuInput,
  sudokuLevels,
  sudokuPeers,
  undoSudoku,
} from "./sudokuLogic";
import "./numberGames.css";

export default function SudokuGarden(props: GameProps) {
  return (
    <SudokuLevelView key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function SudokuLevelView({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = sudokuLevels[level] ?? sudokuLevels[0];
  const [state, setState] = useState(() => createSudokuState(config));
  const [selected, setSelected] = useState(config.givens.indexOf(0));
  const [noteMode, setNoteMode] = useState(false);
  const [hinted, setHinted] = useState<number | null>(null);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false);
  const conflicts = sudokuConflicts(state.values),
    peers = sudokuPeers(selected);
  const won = isSudokuSolved(config, state.values);
  const fixed = !!config.givens[selected];
  const filled = state.values.filter(Boolean).length;
  const candidates = sudokuCandidates(state.values, selected);
  useEffect(() => {
    onStatus(
      "选中一个空格，填入 1–4。每行、每列、每个 2×2 小方块里的数字都不能重复。",
    );
  }, []);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (paused || won) return;
    const hint = sudokuHint(config, state.values);
    if (!hint) return;
    setSelected(hint.index);
    setHinted(hint.index);
    cells.current[hint.index]?.focus();
    onStatus(
      `${hint.correction ? "先检查" : "看看"}第 ${Math.floor(hint.index / 4) + 1} 行第 ${(hint.index % 4) + 1} 列：${hint.correction ? "现在的数字会让后面无解，试着改成" : "这里可以填"} ${hint.value}。比较同一行、列和小方块的线索。`,
    );
  }, [hintToken, paused, won, config, state.values, onStatus]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (paused || won) return;
    const previous = undoSudoku(state);
    setState(previous);
    setHinted(null);
    onStatus(
      previous === state
        ? "还没有可以撤销的填写。"
        : "已撤销上次填写，数字和笔记都已恢复。",
    );
  }, [undoToken, paused, won, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus("每一行、每一列、每个小方块都完整了。数独花园开花啦！");
      onComplete();
    }
  }, [won, paused, onComplete, onStatus]);
  function input(value: number) {
    if (paused || won) return;
    if (fixed) {
      onStatus("深绿色数字是固定线索。请选择浅色格子填写。");
      return;
    }
    const next = sudokuInput(state, config, selected, value, noteMode);
    if (next === state) {
      if (noteMode && state.values[selected] && value)
        onStatus("先清空这个格子，再记下可能的数字。");
      return;
    }
    setState(next);
    setHinted(null);
    if (sudokuConflicts(next.values).length)
      onStatus(
        "带 ! 的格子有重复数字。检查相同的行、列或 2×2 小方块，再修改或撤销。",
      );
    else
      onStatus(
        noteMode && value
          ? "已更新候选笔记。笔记不算正式填写。"
          : "目前没有重复数字，继续寻找下一条线索。",
      );
  }
  return (
    <div
      className="puzzle-layout number-game"
      data-number-game="sudoku"
      onKeyDown={(event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.ctrlKey || event.metaKey || event.altKey || paused || won)
          return;
        if (/^[1-4]$/.test(event.key)) {
          event.preventDefault();
          input(Number(event.key));
        } else if (["Backspace", "Delete", "0"].includes(event.key)) {
          event.preventDefault();
          input(0);
        } else if (event.key.toLowerCase() === "n") {
          event.preventDefault();
          setNoteMode(!noteMode);
        }
      }}
    >
      <section className="number-play-area" aria-label="四格数独游戏">
        <div className="number-board-header">
          <div>
            <span className="mini-label">4 × 4 · 第 {level + 1} 关</span>
            <h3>{config.title}</h3>
          </div>
          <span className="number-count">
            <strong>{filled}</strong> / 16
          </span>
        </div>
        <div
          className={`number-sudoku-board ${won ? "number-won" : ""}`}
          role="group"
          aria-label="四格数独棋盘"
        >
          {state.values.map((value, index) => {
            const given = !!config.givens[index],
              conflict = conflicts.includes(index);
            return (
              <button
                key={index}
                type="button"
                ref={(button) => {
                  cells.current[index] = button;
                }}
                data-cell={index}
                data-value={value}
                data-given={given}
                className={`number-sudoku-cell ${given ? "number-given" : ""} ${index === selected ? "number-selected" : ""} ${peers.includes(index) ? "number-peer" : ""} ${conflict ? "number-conflict" : ""} ${hinted === index ? "number-hinted" : ""}`}
                aria-label={`第 ${Math.floor(index / 4) + 1} 行第 ${(index % 4) + 1} 列，${value || "空白"}${given ? "，固定线索" : "，可填写"}${conflict ? "，数字冲突" : ""}${state.notes[index].length ? `，笔记 ${state.notes[index].join("、")}` : ""}`}
                aria-pressed={selected === index}
                aria-invalid={conflict || undefined}
                disabled={paused || won}
                onFocus={() => {
                  if (!paused && !won) setSelected(index);
                }}
                onClick={() => {
                  setSelected(index);
                  setHinted(null);
                }}
                onKeyDown={(event) => {
                  if (event.ctrlKey || event.metaKey || event.altKey) return;
                  const delta: Record<string, number> = {
                    ArrowUp: -4,
                    ArrowDown: 4,
                    ArrowLeft: -1,
                    ArrowRight: 1,
                  };
                  if (!(event.key in delta)) return;
                  event.preventDefault();
                  if (paused || won) return;
                  const next = index + delta[event.key];
                  if (
                    next < 0 ||
                    next > 15 ||
                    (event.key === "ArrowLeft" && index % 4 === 0) ||
                    (event.key === "ArrowRight" && index % 4 === 3)
                  )
                    return;
                  setSelected(next);
                  cells.current[next]?.focus();
                }}
              >
                {value || (
                  <span className="number-notes" aria-hidden="true">
                    {[1, 2, 3, 4].map((v) => (
                      <span key={v}>
                        {state.notes[index].includes(v) ? v : ""}
                      </span>
                    ))}
                  </span>
                )}
                {conflict && (
                  <span className="number-error-mark" aria-hidden="true">
                    !
                  </span>
                )}
                {given && (
                  <span className="number-given-mark" aria-hidden="true">
                    •
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="number-board-footer">
          <span>
            {conflicts.length
              ? `${conflicts.length} 格数字冲突 !`
              : won
                ? "花园完成 ✓"
                : "深绿色数字是固定线索"}
          </span>
          <span>{config.givens.filter(Boolean).length} 个线索</span>
        </div>
        <div className="number-input-pad" role="group" aria-label="填入数字">
          {[1, 2, 3, 4].map((value) => (
            <button
              type="button"
              key={value}
              aria-label={`${noteMode ? "笔记" : "填入"} ${value}`}
              disabled={paused || won || fixed}
              onClick={() => input(value)}
            >
              {value}
            </button>
          ))}
          <button
            className="number-clear"
            type="button"
            aria-label="清空所选格"
            disabled={paused || won || fixed}
            onClick={() => input(0)}
          >
            清空
          </button>
        </div>
        <button
          type="button"
          className={`number-pencil ${noteMode ? "number-pencil-active" : ""}`}
          aria-pressed={noteMode}
          disabled={paused || won}
          onClick={() => setNoteMode(!noteMode)}
        >
          ✎ 候选笔记 {noteMode ? "已开启" : "已关闭"}
        </button>
      </section>
      <aside className="game-notes number-guide">
        <span className="mini-label">观察 · 排除 · 推理</span>
        <h3>让每个数字开花。</h3>
        <p>
          在每行、每列和粗线围出的 2×2 小方块里，填入
          1、2、3、4。每个数字只出现一次。
        </p>
        <div className="note">
          <strong>
            {fixed
              ? "这是固定线索"
              : `第 ${Math.floor(selected / 4) + 1} 行 · 第 ${(selected % 4) + 1} 列`}
          </strong>
          <p>
            {fixed
              ? "深绿色数字不能修改。看看它能帮你排除哪些可能。"
              : state.values[selected]
                ? "点击下方数字可以修改；清空后，可以用候选笔记记下想法。"
                : `当前不重复的候选：${candidates.length ? candidates.join("、") : "没有，检查附近的填写"}。候选只是可能，需要结合其他线索。`}
          </p>
        </div>
        <p>
          拿不准时，开启候选笔记。再次点击同一个数字即可划掉笔记；提示会指出下一格。
        </p>
        <p className="muted">
          键盘：方向键选择格子，1–4 填写，Delete / Backspace 清空，N
          切换笔记。也可以全程点击。
        </p>
      </aside>
    </div>
  );
}
