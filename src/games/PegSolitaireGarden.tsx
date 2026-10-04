import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import {
  createPegState,
  isPegSolved,
  legalPegMoves,
  movePeg,
  pegCellLabel,
  pegHint,
  pegKeyboardCell,
  pegLevels,
  undoPeg,
  type PegHint,
} from "./pegLogic";
import "./solitaireTour.css";

function Sprout() {
  return (
    <svg className="st-sprout" viewBox="0 0 40 40" aria-hidden="true">
      <path
        d="M20 32V16"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M20 23C8 23 7 12 8 10C17 9 23 15 20 23ZM21 18C20 9 25 5 33 6C34 13 29 19 21 18Z"
        fill="currentColor"
      />
      <path
        d="m10 13 8 7m5-5 7-6"
        fill="none"
        stroke="#dceec8"
        strokeWidth="1.5"
      />
    </svg>
  );
}
export default function PegSolitaireGarden(props: GameProps) {
  return <PegRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function PegRound({
  level,
  paused,
  hintToken,
  undoToken,
  onStatus,
  onComplete,
}: GameProps) {
  const config = pegLevels[level] ?? pegLevels[0];
  const [state, setState] = useState(() => createPegState(config));
  const current = useRef(state);
  const [selected, setSelected] = useState<number | null>(null);
  const selectedRef = useRef<number | null>(null);
  const [hint, setHint] = useState<PegHint | null>(null);
  const [feedback, setFeedback] = useState(
    "先选一棵小芽，再点直线方向隔一格的空穴。收起被跳过的小芽，最后在星星穴留下一棵。",
  );
  const tokens = useRef({ hintToken, undoToken }),
    notified = useRef(false);
  const callbacks = useRef({ onStatus, onComplete });
  callbacks.current = { onStatus, onComplete };
  const cells = useRef<(HTMLButtonElement | null)[]>([]),
    description = useId();
  const won = isPegSolved(config, state),
    moves = legalPegMoves(config, state.pegs);
  const selectedMoves =
    selected === null ? [] : moves.filter((m) => m[0] === selected);
  function select(cell: number | null) {
    selectedRef.current = cell;
    setSelected(cell);
  }
  useEffect(() => {
    if (!paused) callbacks.current.onStatus(feedback);
  }, [feedback, paused]);
  useEffect(() => {
    if (!won || paused || notified.current) return;
    notified.current = true;
    setFeedback(
      `小芽归位！经过 ${state.history.length} 跳，唯一的小芽停在 ${pegCellLabel(config, config.target)} 星星穴。`,
    );
    callbacks.current.onComplete();
  }, [won, paused, state.history.length, config]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused) return;
    const result = pegHint(config, current.current);
    setHint(result);
    if (result.kind === "move" && result.move) {
      const [from, over, to] = result.move;
      setFeedback(
        `试试从 ${pegCellLabel(config, from)} 跳过 ${pegCellLabel(config, over)}，落到 ${pegCellLabel(config, to)}。这一步有已验证的后续路线；请自己点起点和落点。`,
      );
    } else if (result.kind === "undo")
      setFeedback(
        `${result.reason === "budget" ? "提示在本次搜索额度内还没找到完整路线，这不代表无解。" : "当前小芽分布无法只留一棵在目标穴。"}可以撤销 ${result.undoSteps} 次，回到一处已验证能完成的位置。`,
      );
    else if (result.kind === "complete")
      setFeedback("已经完成了：唯一的小芽正好在星星穴。");
    else
      setFeedback(
        result.reason === "budget"
          ? "本次搜索额度已用完，暂时不能确定后续路线。可以撤销或重来再观察。"
          : "暂时没有可验证的提示，可以撤销或重来。",
      );
  }, [hintToken, paused, config]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    const before = current.current,
      next = undoPeg(before);
    current.current = next;
    setState(next);
    select(null);
    setHint(null);
    setFeedback(
      next === before
        ? "还没有可以撤销的跳跃。"
        : "已恢复上一跳前的全部小芽，重新选择起点吧。",
    );
  }, [undoToken, paused]);
  function choose(cell: number) {
    const before = current.current;
    if (paused || isPegSolved(config, before)) return;
    setHint(null);
    if (before.pegs.includes(cell)) {
      if (selectedRef.current === cell) {
        select(null);
        setFeedback("已取消选择。可以换一棵小芽出发。");
        return;
      }
      select(cell);
      const options = legalPegMoves(config, before.pegs).filter(
        (m) => m[0] === cell,
      );
      setFeedback(
        options.length
          ? `已选 ${pegCellLabel(config, cell)}。点带小圆点的空穴完成一跳。`
          : `${pegCellLabel(config, cell)} 现在没有可跳的落点。可以换一棵小芽，或撤销一步。`,
      );
      return;
    }
    const from = selectedRef.current;
    if (from === null) {
      setFeedback("这里是空穴。请先点一棵小芽，再点它的落点。");
      return;
    }
    const next = movePeg(config, before, from, cell);
    if (next === before) {
      setFeedback(
        "这一步不能跳：必须直线跨过一棵相邻小芽，落在隔一格的空穴，不能斜跳或跨过空地。",
      );
      return;
    }
    current.current = next;
    setState(next);
    select(cell);
    if (!isPegSolved(config, next))
      setFeedback(
        legalPegMoves(config, next.pegs).length
          ? `落在 ${pegCellLabel(config, cell)}，还剩 ${next.pegs.length} 棵。可以继续跳，也可以换一棵小芽。`
          : `还剩 ${next.pegs.length} 棵，当前没有合法跳跃${next.pegs.length === 1 ? "，但它没有停在星星穴" : ""}。可以撤销或看提示。`,
      );
  }
  return (
    <div
      className="puzzle-layout st-game"
      data-solitaire-game="peg"
      data-peg-complete={won}
    >
      <section className="st-playfield" aria-label="独苗跳棋挑战">
        <header className="st-heading">
          <div>
            <span className="mini-label">独苗跳棋 · {level + 1} / 12</span>
            <h3>{config.title}</h3>
          </div>
          <span className="st-emblem" aria-hidden="true">
            <Sprout />
          </span>
        </header>
        <div className="st-stats">
          <span>
            还剩 <b data-peg-count>{state.pegs.length}</b> 棵小芽
          </span>
          <span>
            <b data-peg-moves>{state.history.length}</b> 次跳跃
          </span>
          <span>
            目标 <b>★ {pegCellLabel(config, config.target)}</b>
          </span>
        </div>
        <div className="st-board-scroll">
          <div
            className={`st-board st-peg-board ${won ? "st-won" : ""}`}
            style={{ "--st-columns": config.width } as CSSProperties}
            role="group"
            aria-label="独苗跳棋棋盘"
            aria-describedby={description}
          >
            {Array.from({ length: config.width * config.height }, (_, cell) => {
              if (!config.holes.includes(cell))
                return (
                  <span
                    key={cell}
                    className="st-missing"
                    data-peg-mask={cell}
                    aria-hidden="true"
                  />
                );
              const occupied = state.pegs.includes(cell),
                target = cell === config.target,
                active = selected === cell,
                reachable = selectedMoves.some((m) => m[2] === cell),
                hinted =
                  hint?.kind === "move" &&
                  !!hint.move &&
                  (hint.move[0] === cell || hint.move[2] === cell);
              return (
                <button
                  key={cell}
                  ref={(node) => {
                    cells.current[cell] = node;
                  }}
                  type="button"
                  data-peg-cell={cell}
                  data-peg-occupied={occupied}
                  data-peg-selected={active}
                  data-peg-target={target}
                  data-peg-hinted={hinted}
                  className={`st-cell st-peg-cell ${occupied ? "st-occupied" : ""} ${active ? "st-selected" : ""} ${target ? "st-target" : ""} ${hinted ? "st-hinted" : ""}`}
                  disabled={paused || won}
                  aria-pressed={active}
                  aria-label={`${pegCellLabel(config, cell)}，${occupied ? "有小芽" : "空穴"}${target ? "，星星目标穴" : ""}${active ? "，已选起点" : ""}${reachable ? "，可落下" : ""}${hinted ? "，提示格" : ""}`}
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
                        pegKeyboardCell(config, cell, event.key)
                      ]?.focus();
                  }}
                >
                  <small className="st-coordinate" aria-hidden="true">
                    {pegCellLabel(config, cell)}
                  </small>
                  <span className="st-hole" aria-hidden="true">
                    {occupied ? (
                      <Sprout />
                    ) : reachable ? (
                      <i className="st-landing-dot" />
                    ) : null}
                  </span>
                  {target && (
                    <span className="st-star" aria-hidden="true">
                      ★
                    </span>
                  )}
                  {hinted && (
                    <span className="st-hint-label" aria-hidden="true">
                      {hint!.move![0] === cell ? "起" : "落"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <p className="st-legend">芽 = 棋子　○ = 空穴　★ = 最终目标</p>
        <p className="st-feedback" data-peg-feedback>
          {feedback}
        </p>
        {won && <div className="st-complete">★ 独苗回到花园中央</div>}
      </section>
      <aside className="game-notes st-notes">
        <span className="mini-label">空间规划 · 倒着想 · 每跳少一棵</span>
        <h3>
          收起一片绿，
          <br />
          留住最后的小芽。
        </h3>
        <p id={description}>
          点小芽选起点，再点落点。只能横跳或竖跳：跨过相邻的一棵小芽，落在后面的空穴，跨过的小芽会被收起。最后必须只剩一棵，而且停在星星穴。
        </p>
        <div className="note">
          <strong>这一关的小发现</strong>
          <p>{config.idea}</p>
        </div>
        <p className="st-rule-card">
          一跳前：芽 · 芽 · 空<br />
          一跳后：空 · 空 · 芽
        </p>
        <p className="muted">
          无需拖动。Tab 或方向键移动焦点，Enter /
          空格选择。撤销恢复完整的一跳；重来恢复本关布局。没有计时，也不用抢快。
        </p>
      </aside>
    </div>
  );
}
