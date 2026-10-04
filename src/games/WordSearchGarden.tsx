import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  chooseWordSearchCell,
  clearWordSearchSelection,
  createWordSearchState,
  isWordSearchSolved,
  undoWordSearch,
  wordSearchCoordinate,
  wordSearchDirection,
  wordSearchHint,
  wordSearchKeyboardCell,
  wordSearchLevels,
  type WordSearchSolution,
} from "./wordSearchLogic";
import "./mathWordGames.css";

export default function WordSearchGarden(props: GameProps) {
  return (
    <WordSearchLevel key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function WordSearchLevel({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = wordSearchLevels[level] ?? wordSearchLevels[0];
  const [state, setState] = useState(createWordSearchState);
  const [hint, setHint] = useState<WordSearchSolution | null>(null);
  const [focused, setFocused] = useState(0);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false);
  const won = isWordSearchSolved(config, state);
  const foundCells = new Set(state.found.flatMap((word) => word.path));
  const foundWords = new Set(state.found.map((word) => word.word));
  const selectedText = state.selectedPath
    .map((index) => config.grid[index])
    .join("");

  useEffect(() => {
    onStatus(
      "先点词语的第一个字，再点最后一个字。横、竖、斜都可以，反过来找也可以。",
    );
  }, []);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (paused || won) return;
    const next = wordSearchHint(config, state);
    setHint(next);
    setState(clearWordSearchSelection(state));
    if (next)
      onStatus(
        `找找“${next.word}”：从${wordSearchCoordinate(next.start, config.size)}开始，${wordSearchDirection(next.path, config.size)}，一共 ${next.path.length} 格。点亮边框的是这条路线。`,
      );
  }, [hintToken, paused, won, state, config, onStatus]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (paused || won) return;
    const last = state.found.at(-1);
    setState(undoWordSearch(state));
    setHint(null);
    onStatus(
      last
        ? `已撤销“${last.word}”，其他找到的词仍然保留。`
        : "还没有找到的词可以撤销，已清除当前选择。",
    );
  }, [undoToken, paused, won, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus(
        `都找到了！${config.words.length} 个词组成了一座小小的文字花园。`,
      );
      onComplete();
    }
  }, [won, paused, onComplete, onStatus, config.words.length]);

  function choose(index: number) {
    if (paused || won) return;
    const result = chooseWordSearchCell(config, state, index);
    setState(result.state);
    setHint(null);
    setFocused(index);
    if (result.outcome === "start")
      onStatus(
        `起点是“${config.grid[index]}”，在${wordSearchCoordinate(index, config.size)}。再点同一直线上的最后一个字。`,
      );
    else if (result.outcome === "clear") onStatus("已取消起点，可以重新选择。");
    else if (result.outcome === "invalid")
      onStatus("这两个字不在同一条横线、竖线或斜线上。重新选一个起点吧。");
    else if (result.outcome === "miss")
      onStatus(
        `“${result.state.selectedPath.map((cell) => config.grid[cell]).join("")}”还不是清单里的完整词语。再找找，起点和终点要刚好包住这个词。`,
      );
    else if (result.outcome === "duplicate")
      onStatus(`“${result.word}”已经找到了。看看清单中还没有对勾的词。`);
    else if (
      result.outcome === "found" &&
      !isWordSearchSolved(config, result.state)
    )
      onStatus(
        `找到“${result.word}”了！还剩 ${config.words.length - result.state.found.length} 个词。`,
      );
  }

  return (
    <div
      className="puzzle-layout math-word-game"
      data-math-word-game="word-search"
    >
      <section className="mw-play-area" aria-label="寻词花园游戏">
        <div className="mw-board-header">
          <div>
            <span className="mini-label">
              {config.size} × {config.size} · 第 {level + 1} 关
            </span>
            <h3>{config.title}</h3>
          </div>
          <span
            className="mw-word-count"
            aria-label={`已找到 ${state.found.length} / ${config.words.length} 个词`}
          >
            <strong>{state.found.length}</strong> / {config.words.length}
          </span>
        </div>
        <div
          className={`mw-word-board ${won ? "mw-won" : ""}`}
          style={{
            gridTemplateColumns: `repeat(${config.size}, minmax(0, 1fr))`,
          }}
          role="group"
          aria-label="寻词棋盘，方向键移动，回车选择起点和终点"
        >
          {config.grid.map((letter, index) => {
            const selected = state.selectedPath.includes(index),
              found = foundCells.has(index),
              isStart = state.start === index;
            return (
              <button
                key={index}
                type="button"
                ref={(element) => {
                  cellRefs.current[index] = element;
                }}
                data-cell={index}
                data-letter={letter}
                data-found={found ? "true" : "false"}
                className={`mw-word-cell ${found ? "mw-found" : ""} ${selected ? "mw-selected" : ""} ${isStart ? "mw-start" : ""} ${hint?.path.includes(index) ? "mw-hinted" : ""}`}
                aria-label={`${wordSearchCoordinate(index, config.size)}，${letter}${isStart ? "，已选起点" : selected ? "，所选路线" : ""}${found ? "，已找到的词" : ""}${hint?.path.includes(index) ? "，提示" : ""}`}
                aria-pressed={selected}
                tabIndex={focused === index ? 0 : -1}
                disabled={paused || won}
                onFocus={() => setFocused(index)}
                onClick={() => choose(index)}
                onKeyDown={(event) => {
                  if (event.ctrlKey || event.metaKey || event.altKey) return;
                  if (
                    !event.key.startsWith("Arrow") &&
                    event.key !== "Home" &&
                    event.key !== "End"
                  )
                    return;
                  event.preventDefault();
                  if (paused || won) return;
                  const next = wordSearchKeyboardCell(
                    config.size,
                    index,
                    event.key,
                  );
                  setFocused(next);
                  cellRefs.current[next]?.focus();
                }}
              >
                <span>{letter}</span>
                <small aria-hidden="true">
                  {isStart ? "起" : found ? "✓" : ""}
                </small>
              </button>
            );
          })}
        </div>
        <div className="mw-word-selection">
          <div>
            <span className="mini-label">
              {state.start !== null
                ? "已选起点 · 接着选终点"
                : selectedText
                  ? "刚才的路线"
                  : "先选起点，再选终点"}
            </span>
            <p aria-label="所选文字">
              {selectedText || "在字里行间，找个小发现。"}
            </p>
          </div>
          <button
            type="button"
            disabled={paused || won || state.selectedPath.length === 0}
            onClick={() => {
              setState(clearWordSearchSelection(state));
              setHint(null);
              onStatus("已清除选择，找到的词仍然保留。");
            }}
          >
            清除选择
          </button>
        </div>
        <p className="mw-board-caption">
          直线连词 · 可以反向 · 同一个字可以属于不同词
        </p>
      </section>
      <aside className="game-notes mw-guide">
        <span className="mini-label">观察 · 识字 · 专注</span>
        <h3>
          把藏起来的词，
          <br />
          一个个找出来。
        </h3>
        <ul className="mw-word-list" aria-label="待寻找的词语">
          {config.words.map((word) => (
            <li
              key={word}
              data-word={word}
              data-complete={foundWords.has(word) ? "true" : "false"}
              className={foundWords.has(word) ? "mw-word-done" : ""}
            >
              <span aria-hidden="true">{foundWords.has(word) ? "✓" : "○"}</span>
              <strong>{word}</strong>
              <small>{foundWords.has(word) ? "已找到" : "待寻找"}</small>
            </li>
          ))}
        </ul>
        <div className="note">
          <strong>这一关的小发现</strong>
          <p>{config.idea}</p>
        </div>
        <p>
          词语可以横着、竖着或斜着排列。点击首尾两个字，中间的字会自动连成一条直线；不用按住，也不用拖动。
        </p>
        <p className="muted">
          键盘：Tab 进入棋盘，方向键移动，Enter /
          空格选字。提示只点亮路线，不会替你找到。没有时间限制。
        </p>
      </aside>
    </div>
  );
}
