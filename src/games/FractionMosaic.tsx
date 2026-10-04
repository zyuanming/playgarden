import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  createFractionState,
  formatFraction,
  fractionMosaicLevels,
  fractionMove,
  fractionMoveLabel,
  fractionWon,
  searchFraction,
  undoFraction,
  type FractionMove,
} from "./fractionMosaicLogic";
import "./numberSpatialWorkshops.css";

export default function FractionMosaic(props: GameProps) {
  return (
    <FractionRound key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function FractionRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = fractionMosaicLevels[level] ?? fractionMosaicLevels[0];
  const [state, setState] = useState(() => createFractionState(config));
  const current = useRef(state);
  const [selected, setSelected] = useState<string[]>([]),
    selection = useRef<string[]>([]);
  const [hint, setHint] = useState<FractionMove | null>(null);
  const [feedback, setFeedback] = useState(
    "每只托盘需要一片完整配方。选两片合并，选一片切分，配好后点托盘送入。",
  );
  const tokens = useRef({ hintToken, undoToken }),
    notified = useRef(false);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const won = fractionWon(config, state);
  const frozen = paused || won;
  function select(ids: string[]) {
    selection.current = ids;
    setSelected(ids);
  }
  useEffect(() => {
    if (!paused) callbacks.current.onStatus(feedback);
  }, [feedback, paused]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      setFeedback(
        `每盘都刚刚好！完成 ${config.targets.length} 份配方，所有材料都用上了。`,
      );
      callbacks.current.onComplete();
    }
  }, [won, paused, config.targets.length]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused || fractionWon(config, current.current)) return;
    const previous = current.current,
      next = undoFraction(previous);
    current.current = next;
    setState(next);
    select([]);
    setHint(null);
    setFeedback(
      previous === next
        ? "还没有操作可以撤销，已清除选择。"
        : "已恢复上一整步，材料、托盘和切分次数都回来了。",
    );
  }, [undoToken, paused, config]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || fractionWon(config, current.current)) return;
    const result = searchFraction(config, current.current),
      move = result.moves[0];
    setHint(move ?? null);
    if (move) {
      select(move.kind === "join" ? [move.first, move.second] : [move.piece]);
      setFeedback(
        `找到一条完成路线：${fractionMoveLabel(config, current.current, move)}。已选好材料，请你完成这一步。`,
      );
    } else {
      select([]);
      setFeedback(
        result.status === "limit"
          ? "本次搜索达到上限，还不能判断这条路线。可以撤销一步，或试试另一种切法。"
          : "当前剩余材料和切分次数无法完成配方。请撤销一步或重来。",
      );
    }
  }, [hintToken, paused, config]);
  function choose(id: string) {
    if (paused || fractionWon(config, current.current)) return;
    const ids = selection.current;
    select(
      ids.includes(id)
        ? ids.filter((v) => v !== id)
        : ids.length < 2
          ? [...ids, id]
          : [id],
    );
    setHint(null);
  }
  function act(move: FractionMove) {
    if (paused || fractionWon(config, current.current)) return;
    const before = current.current,
      next = fractionMove(before, config, move);
    if (next === before) {
      setFeedback(
        move.kind === "serve"
          ? "托盘需要精确相等的一片；先合并或切分，再送入。"
          : move.kind === "join"
            ? "合成的一片不能超过一整块。换两片试试。"
            : `这片不能这样等分，或切分次数已用完。最小的一格是 1/${config.denominator}。`,
      );
      return;
    }
    current.current = next;
    setState(next);
    select([]);
    setHint(null);
    setFeedback(
      `${fractionMoveLabel(config, before, move)}，完成。还可以切分 ${next.cutsLeft} 次。`,
    );
  }
  const fraction = (n: number) => formatFraction(n, config.denominator);
  const piece = state.pieces.find((p) => p.id === selected[0]);
  return (
    <div className="puzzle-layout nsw-game" data-number-spatial-game="fraction">
      <section className="nsw-workbench" aria-label="分数拼盘游戏">
        <header className="nsw-heading">
          <div>
            <span className="mini-label">分数拼盘 · 第 {level + 1} 关</span>
            <h3>{config.title}</h3>
          </div>
          <span className="nsw-badge">精确配方</span>
        </header>
        <div className="nsw-stats">
          <span>
            完成托盘{" "}
            <b>
              {state.filled.filter(Boolean).length} / {config.targets.length}
            </b>
          </span>
          <span>
            剩余切分{" "}
            <b data-fraction-cuts={state.cutsLeft}>{state.cutsLeft} 次</b>
          </span>
          <span>
            操作 <b>{state.history.length}</b>
          </span>
        </div>
        <div className="fm-trays" role="group" aria-label="目标托盘">
          {config.targets.map((target, i) => (
            <button
              key={i}
              type="button"
              data-fraction-tray={i}
              data-filled={state.filled[i]}
              className={`fm-tray ${state.filled[i] ? "nsw-complete" : ""} ${hint?.kind === "serve" && hint.tray === i && !paused ? "nsw-hinted" : ""}`}
              disabled={frozen || state.filled[i] || selected.length !== 1}
              onClick={() =>
                act({ kind: "serve", piece: selection.current[0], tray: i })
              }
              aria-label={`${i + 1} 号托盘，需要 ${fraction(target)}${state.filled[i] ? "，已完成" : ""}`}
            >
              <small>{i + 1} 号配方</small>
              <strong>{fraction(target)}</strong>
              <span>{state.filled[i] ? "配好了 ✓" : "点此送入一片"}</span>
            </button>
          ))}
        </div>
        <div className="fm-pantry">
          <div className="nsw-instruction">
            <b>材料台</b>
            <span>选 1 片切分 · 选 2 片合并</span>
          </div>
          <div className="fm-pieces" role="group" aria-label="可用分数片">
            {state.pieces.map((p) => (
              <button
                key={p.id}
                type="button"
                data-fraction-piece={p.id}
                data-units={p.units}
                aria-label={`分数片 ${p.id}，${fraction(p.units)}`}
                aria-pressed={selected.includes(p.id)}
                disabled={frozen}
                className={`fm-piece ${selected.includes(p.id) ? "nsw-selected" : ""}`}
                onClick={() => choose(p.id)}
              >
                <strong>{fraction(p.units)}</strong>
                <span
                  className="fm-tiles"
                  style={{
                    gridTemplateColumns: `repeat(${config.denominator <= 8 ? config.denominator : 6}, 1fr)`,
                  }}
                  aria-hidden="true"
                >
                  {Array.from({ length: config.denominator }, (_, n) => (
                    <i
                      key={n}
                      className={n < p.units ? "fm-tile-filled" : ""}
                    />
                  ))}
                </span>
                <small>
                  {p.units} / {config.denominator} 格
                </small>
              </button>
            ))}
            {!state.pieces.length && (
              <p className="fm-empty">材料全部变成了美味配方 ✓</p>
            )}
          </div>
        </div>
        <div className="fm-actions" role="group" aria-label="分数操作">
          <button
            type="button"
            data-fraction-action="join"
            className={hint?.kind === "join" && !paused ? "nsw-hinted" : ""}
            disabled={frozen || selected.length !== 2}
            onClick={() =>
              act({
                kind: "join",
                first: selection.current[0],
                second: selection.current[1],
              })
            }
          >
            合成一片 <b>＋</b>
          </button>
          {([2, 3] as const).map((parts) => (
            <button
              key={parts}
              type="button"
              data-fraction-action={`split-${parts}`}
              className={
                hint?.kind === "split" && hint.parts === parts && !paused
                  ? "nsw-hinted"
                  : ""
              }
              disabled={
                frozen ||
                selected.length !== 1 ||
                !state.cutsLeft ||
                !piece ||
                piece.units % parts !== 0
              }
              onClick={() =>
                act({ kind: "split", piece: selection.current[0], parts })
              }
            >
              平均分 {parts} 片 <b>÷{parts}</b>
            </button>
          ))}
          <button
            type="button"
            data-fraction-action="clear"
            disabled={frozen || !selected.length}
            onClick={() => {
              select([]);
              setHint(null);
            }}
          >
            清除选择
          </button>
        </div>
        <p className="nsw-feedback" role="status" aria-live="polite">
          {paused ? "已暂停，材料会原样等你回来。" : feedback}
        </p>
      </section>
      <aside className="game-notes nsw-notes">
        <span className="mini-label">分数 · 守恒 · 提前规划</span>
        <h3>
          拼一拼，
          <br />
          份量刚刚好。
        </h3>
        <p>
          每盘只能放一片与配方完全相等的材料。先把小片合起来，或用有限的切分次数做二等分、三等分。
        </p>
        <div className="note">
          <strong>这一关的小发现</strong>
          <p>{config.idea}</p>
        </div>
        <ul>
          <li>每次切分消耗 1 次机会，合并不消耗。</li>
          <li>
            最小一格是 1/{config.denominator}；切出的每片都必须包含完整格子。
          </li>
          <li>一片不能超过一整块，材料台最多放 10 片。</li>
          <li>所有材料都要用完；送入托盘后可用撤销取回。</li>
        </ul>
        <p className="muted">
          键盘：Tab 选择按钮，Enter /
          空格操作。提示会从当前材料重新找路，搜索未完成时不会声称无解。
        </p>
      </aside>
    </div>
  );
}
