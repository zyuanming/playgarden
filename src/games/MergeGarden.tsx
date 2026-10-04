import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import {
  createMergeState,
  isMergeGameOver,
  isMergeWon,
  legalMergeMoves,
  mergeDirectionLabels,
  mergeDirections,
  mergeHint,
  mergeLevels,
  mergeMove,
  nextMergeValue,
  undoMerge,
  type MergeDirection,
  type MergeHint,
} from "./mergeLogic";
import "./mergeEscape.css";

const arrows: Record<MergeDirection, string> = {
  up: "↑",
  right: "→",
  down: "↓",
  left: "←",
};
const leafColors = [
  "#eef2d9",
  "#dce9b4",
  "#dafa3b",
  "#b9d382",
  "#92bc79",
  "#649c71",
  "#438269",
  "#296951",
  "#205643",
  "#174b3a",
  "#10372e",
];
export default function MergeGarden(props: GameProps) {
  return <MergeRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function MergeRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = mergeLevels[level] ?? mergeLevels[0];
  const [state, setState] = useState(() => createMergeState(config));
  const [hint, setHint] = useState<MergeHint | null>(null);
  const [feedback, setFeedback] = useState(
    "用方向键或下方按钮移动整盘。相同数字相遇，就长成下一片叶子。",
  );
  const tokens = useRef({ hintToken, undoToken }),
    notified = useRef(false);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const won = isMergeWon(state.board, config.target),
    stuck = isMergeGameOver(state.board);
  const legal = legalMergeMoves(state.board),
    largest = Math.max(...state.board);
  const progress = Math.min(
    100,
    (Math.log2(largest) / Math.log2(config.target)) * 100,
  );
  useEffect(() => {
    if (!paused) callbacks.current.onStatus(feedback);
  }, [feedback, paused]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      setFeedback(
        `花园长出了 ${config.target}！用了 ${state.history.length} 步，合并得分 ${state.score}。`,
      );
      callbacks.current.onComplete();
    } else if (stuck && !won && !paused)
      setFeedback(
        "暂时没有可移动的方向。撤销一两步，给数字换个相遇的顺序。也可以重来。",
      );
  }, [won, stuck, paused, state.history.length, state.score, config.target]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || won) return;
    const next = mergeHint(state);
    setHint(next);
    if (next.kind === "move")
      setFeedback(
        `试试${mergeDirectionLabels[next.direction]}合并。这一步来自当前棋盘的已验证路线。`,
      );
    else if (next.kind === "undo")
      setFeedback(
        `这次合并已偏离已验证路线。先撤销 ${next.steps} 步，再点提示；撤销会恢复数字和下一片叶子的位置。`,
      );
  }, [hintToken, paused, won, state]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    setState((current) => undoMerge(current));
    setHint(null);
    setFeedback(
      state.history.length
        ? "已恢复上一步的数字、得分与种子。可以放心换一个方向。"
        : "还没有可以撤销的移动。",
    );
  }, [undoToken, paused, state.history.length]);
  function move(direction: MergeDirection) {
    if (paused || won) return;
    if (!legal.includes(direction)) {
      setFeedback("这个方向没有发生变化，所以不会长出新数字。试试另一个方向。");
      return;
    }
    setState((current) => mergeMove(current, direction));
    setHint(null);
    setFeedback(
      `${mergeDirectionLabels[direction]}整理好了。新叶会在每次有效移动后出现，重来时顺序完全相同。`,
    );
  }
  return (
    <div className="puzzle-layout me-game merge-garden" data-game="merge">
      <section className="me-playfield" aria-label="合并花园挑战">
        <header className="me-heading">
          <div>
            <span className="mini-label">
              MERGE GARDEN · 第 {level + 1} / 12 关
            </span>
            <h3>{config.title}</h3>
          </div>
          <span className="me-round-icon" aria-hidden="true">
            ✦
          </span>
        </header>
        <div className="me-scorebar">
          <div>
            <small>这一关，长到</small>
            <b>{config.target}</b>
          </div>
          <div>
            <small>合并得分</small>
            <b data-merge-score>{state.score}</b>
          </div>
          <div>
            <small>步数</small>
            <b data-merge-moves>{state.history.length}</b>
          </div>
        </div>
        <div className="merge-board-wrap">
          <div
            className={`merge-board ${won ? "me-board-won" : ""}`}
            role="group"
            aria-label="合并棋盘，方向键移动全部数字"
            tabIndex={0}
            onKeyDown={(event) => {
              const direction = (
                {
                  ArrowUp: "up",
                  ArrowRight: "right",
                  ArrowDown: "down",
                  ArrowLeft: "left",
                  w: "up",
                  d: "right",
                  s: "down",
                  a: "left",
                } as Record<string, MergeDirection>
              )[event.key];
              if (direction) {
                event.preventDefault();
                move(direction);
              }
            }}
          >
            {state.board.map((value, index) => (
              <div
                key={index}
                data-merge-cell={index}
                data-value={value}
                className={`merge-tile ${value >= 64 ? "merge-tile-dark" : ""} ${index === state.spawned ? "merge-tile-new" : ""} ${value >= config.target ? "merge-tile-goal" : ""}`}
                style={
                  {
                    "--merge-color": value
                      ? leafColors[
                          Math.min(leafColors.length - 1, Math.log2(value) - 1)
                        ]
                      : "#25493e",
                  } as CSSProperties
                }
                aria-label={`第 ${Math.floor(index / 4) + 1} 行第 ${(index % 4) + 1} 列，${value || "空格"}${index === state.spawned ? "，新数字" : ""}`}
              >
                {value ? (
                  <>
                    <span>{value}</span>
                    <i aria-hidden="true">
                      {value >= config.target ? "✦" : ""}
                    </i>
                  </>
                ) : (
                  <span className="merge-empty-dot" aria-hidden="true">
                    ·
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="merge-next">
            <span>
              <i aria-hidden="true">✿</i> 下一片叶子{" "}
              <b>{nextMergeValue(state.seed)}</b>
            </span>
            <span>固定种子 · 可复盘</span>
          </div>
        </div>
        <div className="merge-controls" aria-label="合并方向按钮">
          {mergeDirections.map((direction) => (
            <button
              type="button"
              key={direction}
              data-merge-direction={direction}
              className={`merge-direction merge-${direction} ${hint?.kind === "move" && hint.direction === direction && !paused ? "me-hinted" : ""}`}
              aria-label={`${mergeDirectionLabels[direction]}合并`}
              disabled={paused || won || stuck}
              onClick={() => move(direction)}
            >
              <span aria-hidden="true">{arrows[direction]}</span>
              <small>{mergeDirectionLabels[direction]}</small>
            </button>
          ))}
        </div>
        <p
          className={`me-feedback ${stuck && !won ? "me-feedback-warning" : ""}`}
          role="status"
          aria-live="polite"
        >
          {paused ? "已暂停，数字正在休息。" : feedback}
        </p>
      </section>
      <aside className="game-notes me-notes">
        <span className="mini-label">配对 · 规划 · 数字生长</span>
        <h3>
          让相同的数字，
          <br />
          在花园里相遇。
        </h3>
        <div className="me-objective">
          <small>当前最大数字 / 目标</small>
          <p>
            <b>{largest}</b>
            <span> / {config.target}</span>
          </p>
          <div className="me-progress" aria-hidden="true">
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
        <ol className="me-instructions">
          <li>
            <b>整盘一起移动</b>
            <span>
              用按钮或方向键，把数字推向同一边。只有相同数字才能合并。
            </span>
          </li>
          <li>
            <b>每片叶子只合并一次</b>
            <span>2 + 2 + 4 会先变成 4 和 4，要再移动一次才能得到 8。</span>
          </li>
          <li>
            <b>每次有效移动长一片新叶</b>
            <span>
              下一片是 2 或 4，位置由固定种子选择。没有移动时不会新增数字。
            </span>
          </li>
        </ol>
        <div className="note me-tip">
          <strong>这一关的观察笔记</strong>
          <p>{config.lesson}</p>
        </div>
        <p className="me-keyboard">
          棋盘内：方向键 /
          WASD。也能点方向按钮。不限时；提示给出已验证路线，偏离后会建议撤销回到路线。
        </p>
      </aside>
    </div>
  );
}
