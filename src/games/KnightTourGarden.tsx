import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import {
  createKnightState,
  isKnightSolved,
  knightCellLabel,
  knightHint,
  knightKeyboardCell,
  knightLevels,
  knightNextCells,
  moveKnight,
  undoKnight,
  type KnightHint,
} from "./knightLogic";
import "./solitaireTour.css";

function GardenKnight() {
  return (
    <svg className="st-knight-symbol" viewBox="0 0 40 40" aria-hidden="true">
      <path
        d="M9 33h24l-3-7c1-11-3-18-13-19l-3-4-2 7-7 10 5 5 7-5-3 7Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="m16 14 5 4-3 6M11 33h20"
        fill="none"
        stroke="#edf5d9"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="14" cy="14" r="1.6" fill="#edf5d9" />
    </svg>
  );
}
export default function KnightTourGarden(props: GameProps) {
  return <KnightRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function KnightRound({
  level,
  paused,
  hintToken,
  undoToken,
  onStatus,
  onComplete,
}: GameProps) {
  const config = knightLevels[level] ?? knightLevels[0];
  const [state, setState] = useState(() => createKnightState(config));
  const current = useRef(state);
  const [hint, setHint] = useState<KnightHint | null>(null);
  const [feedback, setFeedback] = useState(
    `从 ${knightCellLabel(config, config.start)} 出发。每一步走 L 形，只落到没走过的方格；点带圆点的格子试一试。`,
  );
  const tokens = useRef({ hintToken, undoToken }),
    notified = useRef(false);
  const callbacks = useRef({ onStatus, onComplete });
  callbacks.current = { onStatus, onComplete };
  const cells = useRef<(HTMLButtonElement | null)[]>([]),
    description = useId();
  const won = isKnightSolved(config, state),
    nextCells = knightNextCells(config, state),
    at = state.path.at(-1)!;
  useEffect(() => {
    if (!paused) callbacks.current.onStatus(feedback);
  }, [feedback, paused]);
  useEffect(() => {
    if (!won || paused || notified.current) return;
    notified.current = true;
    setFeedback(
      `送信完成！${config.cells.length} 个方格，每格恰好到访一次，一共 ${config.cells.length - 1} 次 L 形跳跃。`,
    );
    callbacks.current.onComplete();
  }, [won, paused, config]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused) return;
    const result = knightHint(config, current.current);
    setHint(result);
    if (result.kind === "move" && result.cell !== null)
      setFeedback(
        `下一站可以选 ${knightCellLabel(config, result.cell)}。它符合 L 形走法，并有已验证的完整后续路线；点这格才会移动。`,
      );
    else if (result.kind === "undo")
      setFeedback(
        `${result.reason === "budget" ? "本次搜索额度内还没找到完整路线，这不代表无解。" : "当前路线不能走遍剩下的方格。"}可以撤销 ${result.undoSteps} 次，回到一处已验证能完成的位置。`,
      );
    else if (result.kind === "complete")
      setFeedback("每一格都已到访一次，这段旅程完成了！");
    else
      setFeedback(
        result.reason === "budget"
          ? "本次搜索额度已用完，暂时不能确定下一站。可以撤销或重来再观察。"
          : "暂时没有可验证的提示，可以撤销或重来。",
      );
  }, [hintToken, paused, config]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    const before = current.current,
      next = undoKnight(before);
    current.current = next;
    setState(next);
    setHint(null);
    setFeedback(
      next === before
        ? "已经在起点，还没有可以撤销的跳跃。"
        : `退回 ${knightCellLabel(config, next.path.at(-1)!)}。刚才的方格已恢复为未走过，可以重新规划。`,
    );
  }, [undoToken, paused, config]);
  function choose(cell: number) {
    const before = current.current;
    if (paused || isKnightSolved(config, before)) return;
    setHint(null);
    if (before.path.includes(cell)) {
      setFeedback("这里已经有脚印了。每个方格只能到访一次；想退回请用撤销。");
      return;
    }
    const next = moveKnight(config, before, cell);
    if (next === before) {
      setFeedback(
        "这不是一个 L 形落点。请横着两格、竖着一格，或竖着两格、横着一格。",
      );
      return;
    }
    current.current = next;
    setState(next);
    if (!isKnightSolved(config, next))
      setFeedback(
        knightNextCells(config, next).length
          ? `第 ${next.path.length} 站：${knightCellLabel(config, cell)}。还剩 ${config.cells.length - next.path.length} 格未到访，继续寻找新的 L 形落点。`
          : `来到 ${knightCellLabel(config, cell)}，还有 ${config.cells.length - next.path.length} 格，但没有可走的落点了。撤销一步或看提示再试。`,
      );
  }
  return (
    <div
      className="puzzle-layout st-game"
      data-solitaire-game="knight"
      data-knight-complete={won}
    >
      <section className="st-playfield" aria-label="骑士巡游挑战">
        <header className="st-heading">
          <div>
            <span className="mini-label">骑士巡游 · {level + 1} / 12</span>
            <h3>{config.title}</h3>
          </div>
          <span className="st-emblem" aria-hidden="true">
            <GardenKnight />
          </span>
        </header>
        <div className="st-stats">
          <span>
            已到访 <b data-knight-visited-count>{state.path.length}</b> /{" "}
            {config.cells.length} 格
          </span>
          <span>
            <b data-knight-moves>{state.path.length - 1}</b> 次跳跃
          </span>
          <span>
            当前位置 <b>{knightCellLabel(config, at)}</b>
          </span>
        </div>
        <div className="st-board-scroll">
          <div
            className={`st-board st-knight-board ${won ? "st-won" : ""}`}
            style={{ "--st-columns": config.width } as CSSProperties}
            role="group"
            aria-label="骑士巡游棋盘"
            aria-describedby={description}
          >
            {Array.from({ length: config.width * config.height }, (_, cell) => {
              if (!config.cells.includes(cell))
                return (
                  <span
                    key={cell}
                    className="st-missing st-knight-missing"
                    data-knight-mask={cell}
                    aria-hidden="true"
                  />
                );
              const order = state.path.indexOf(cell) + 1,
                active = at === cell,
                reachable = nextCells.includes(cell),
                hinted = hint?.kind === "move" && hint.cell === cell;
              return (
                <button
                  key={cell}
                  ref={(node) => {
                    cells.current[cell] = node;
                  }}
                  type="button"
                  data-knight-cell={cell}
                  data-knight-current={active}
                  data-knight-order={order}
                  data-knight-reachable={reachable}
                  data-knight-hinted={hinted}
                  className={`st-cell st-knight-cell ${((cell % config.width) + Math.floor(cell / config.width)) % 2 ? "st-dark-square" : ""} ${order ? "st-visited" : ""} ${active ? "st-current" : ""} ${hinted ? "st-hinted" : ""}`}
                  disabled={paused || won}
                  aria-current={active ? "location" : undefined}
                  aria-label={`${knightCellLabel(config, cell)}${active ? "，骑士当前位置" : order ? `，已到访第 ${order} 站` : "，未到访"}${cell === config.start ? "，起点" : ""}${reachable ? "，可跳入" : ""}${hinted ? "，提示格" : ""}`}
                  onClick={() => choose(cell)}
                  onKeyDown={(event) => {
                    if (
                      event.altKey ||
                      event.ctrlKey ||
                      event.metaKey ||
                      ![
                        "ArrowUp",
                        "ArrowDown",
                        "ArrowLeft",
                        "ArrowRight",
                        "Home",
                        "End",
                      ].includes(event.key)
                    )
                      return;
                    event.preventDefault();
                    if (!paused && !won)
                      cells.current[
                        knightKeyboardCell(config, cell, event.key)
                      ]?.focus();
                  }}
                >
                  <small className="st-coordinate" aria-hidden="true">
                    {knightCellLabel(config, cell)}
                  </small>
                  {active ? (
                    <GardenKnight />
                  ) : order ? (
                    <span className="st-order" aria-hidden="true">
                      {order}
                    </span>
                  ) : reachable ? (
                    <i className="st-landing-dot" aria-hidden="true" />
                  ) : (
                    <span className="st-square-seed" aria-hidden="true">
                      ·
                    </span>
                  )}
                  {active && (
                    <span className="st-current-order" aria-hidden="true">
                      {order}
                    </span>
                  )}
                  {cell === config.start && (
                    <span className="st-start-mark" aria-hidden="true">
                      起
                    </span>
                  )}
                  {hinted && (
                    <span className="st-hint-label" aria-hidden="true">
                      去
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <p className="st-legend">
          小马 = 当前位置　● = 可跳入　数字 = 到访顺序
        </p>
        <div className="st-route">
          <span className="mini-label">我的送信路线</span>
          <p data-knight-route>
            {state.path
              .map((cell) => knightCellLabel(config, cell))
              .join(" → ")}
          </p>
        </div>
        <p className="st-feedback" data-knight-feedback>
          {feedback}
        </p>
        {won && <div className="st-complete">★ 每一个角落，都留下了脚印</div>}
      </section>
      <aside className="game-notes st-notes">
        <span className="mini-label">空间感 · 路线规划 · 换个方向想</span>
        <h3>
          一跳一个 L，
          <br />
          把信送到每片叶子。
        </h3>
        <p id={description}>
          小马从起点出发。每步横着两格再竖着一格，或竖着两格再横着一格，可以向任意方向。只在有方框的格子落下，每一格恰好到访一次。可以跳过其他格子，不需要回到起点。
        </p>
        <div className="note">
          <strong>这一关的小发现</strong>
          <p>{config.idea}</p>
        </div>
        <div
          className="st-rule-card st-knight-rule"
          aria-label="L 形走法示意：先向右两格，再向下一格"
        >
          <svg viewBox="0 0 120 70" aria-hidden="true">
            <path
              d="M16 18h80v36"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="4 5"
            />
            <circle cx="16" cy="18" r="8" fill="currentColor" />
            <circle cx="56" cy="18" r="4" fill="currentColor" />
            <path
              d="m88 46 8 10 8-10"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            走两格，再转一格
            <br />
            <small>八个方向都可以</small>
          </span>
        </div>
        <p className="muted">
          无需拖动。Tab 或方向键移动焦点，Enter /
          空格跳入。提示会检查当前路线；搜索没完成时会如实说明，也可指引你撤回已验证的位置。
        </p>
      </aside>
    </div>
  );
}
