import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  createSlideState,
  isSlideSolved,
  legalSlideMoves,
  slideArrowTile,
  slideHint,
  slideLevels,
  slideManhattan,
  slideMove,
  undoSlide,
} from "./slideLogic";
import "./numberGames.css";

export default function SlidingTiles(props: GameProps) {
  return <SlidingLevel key={`${props.level}:${props.resetToken}`} {...props} />;
}
function SlidingLevel({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = slideLevels[level] ?? slideLevels[0];
  const [state, setState] = useState(() => createSlideState(config));
  const [hinted, setHinted] = useState<number | null>(null);
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false);
  const won = isSlideSolved(state.tiles, config.size);
  const legal = legalSlideMoves(state.tiles, config.size);
  const distance = slideManhattan(state.tiles, config.size);
  useEffect(() => {
    onStatus("点击空格旁边的数字，把它滑入空格。按顺序排好所有数字！");
  }, []);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (paused || won) return;
    const next = slideHint(state);
    setHinted(next);
    onStatus(
      next === null
        ? config.hint
        : `试着把数字 ${next} 移入空格。发亮的数字是已知解法的下一步；绕远时会先带你返回路线。`,
    );
  }, [hintToken, paused, won, state, onStatus, config.hint]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (paused || won) return;
    const previous = undoSlide(state);
    setState(previous);
    setHinted(null);
    onStatus(
      previous === state
        ? "还没有可以撤销的移动。"
        : "已退回上一步，可以换一条路线试试。",
    );
  }, [undoToken, paused, won, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus(`数字全部归位！你用了 ${state.history.length} 步。`);
      onComplete();
    }
  }, [won, paused, onComplete, onStatus, state.history.length]);
  function move(tile: number) {
    if (paused || won) return;
    const next = slideMove(state, tile);
    if (next === state) {
      onStatus("这个数字还够不到空格。只能移动紧挨空格的数字。");
      return;
    }
    setState(next);
    setHinted(null);
  }
  return (
    <div className="puzzle-layout number-game" data-number-game="slide">
      <section className="number-play-area" aria-label="数字滑块游戏">
        <div className="number-board-header">
          <div>
            <span className="mini-label">
              {config.size} × {config.size} · 第 {level + 1} 关
            </span>
            <h3>{config.title}</h3>
          </div>
          <span className="number-count">
            <strong>{state.history.length}</strong> 步
          </span>
        </div>
        <div
          className={`number-slide-board ${won ? "number-won" : ""}`}
          style={{ gridTemplateColumns: `repeat(${config.size}, 1fr)` }}
          role="group"
          aria-label="数字滑块棋盘，方向键移动空格"
          tabIndex={0}
          onKeyDown={(event) => {
            if (!event.key.startsWith("Arrow")) return;
            event.preventDefault();
            if (paused || won) return;
            const tile = slideArrowTile(state.tiles, config.size, event.key);
            if (tile !== null) move(tile);
          }}
        >
          {state.tiles.map((tile, index) =>
            tile === 0 ? (
              <div className="number-slide-gap" key="gap" aria-label="空格">
                <span aria-hidden="true">✦</span>
                <small>空格</small>
              </div>
            ) : (
              <button
                key={tile}
                type="button"
                data-tile={tile}
                data-position={index}
                className={`number-slide-tile ${legal.includes(tile) ? "number-movable" : ""} ${tile === index + 1 ? "number-home" : ""} ${hinted === tile ? "number-hinted" : ""}`}
                aria-label={`数字 ${tile}${legal.includes(tile) ? "，可滑入空格" : "，未与空格相邻"}${hinted === tile ? "，提示" : ""}`}
                disabled={paused || won}
                onClick={() => move(tile)}
              >
                {tile}
                <span className="number-slide-dot" aria-hidden="true">
                  {hinted === tile ? "↓" : legal.includes(tile) ? "•" : ""}
                </span>
              </button>
            ),
          )}
        </div>
        <div className="number-board-footer">
          <span>{won ? "排列完成 ✓" : "带圆点的数字可以移动"}</span>
          <span>最少 {config.par} 步</span>
        </div>
      </section>
      <aside className="game-notes number-guide">
        <span className="mini-label">排序 · 空间 · 规划</span>
        <h3>给数字找个家。</h3>
        <p>
          只有空格上下左右的数字能移动。按从左到右、从上到下的顺序排好，最后让空格停在右下角。
        </p>
        <div
          className="number-target"
          aria-label="完成目标"
          style={{ gridTemplateColumns: `repeat(${config.size}, 1fr)` }}
        >
          {Array.from({ length: config.size ** 2 }, (_, i) => (
            <span
              key={i}
              className={i === config.size ** 2 - 1 ? "number-target-gap" : ""}
            >
              {i === config.size ** 2 - 1 ? "·" : i + 1}
            </span>
          ))}
        </div>
        <div className="note">
          <strong>先想一小步</strong>
          <p>
            数字到目标格的总距离还有 {distance}{" "}
            格。绕个弯很正常，撤销和提示随时帮你。
          </p>
        </div>
        <p className="muted">
          键盘：Tab 选择数字，Enter /
          空格移动；棋盘内方向键移动空格。没有时间限制。
        </p>
      </aside>
    </div>
  );
}
