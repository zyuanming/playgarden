// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  frogSwapLevels,
  frogDestinations,
  hopFrog,
  frogsWon,
  solveFrogs,
  type FrogPiece,
} from "./frogSwapLogic";
import "./frogSwap.css";
function Frog({ piece }: { piece: FrogPiece }) {
  return (
    <svg
      viewBox="0 0 60 56"
      className={`fs-frog ${piece === "E" ? "east" : "west"}`}
      aria-hidden="true"
    >
      <ellipse cx="30" cy="43" rx="23" ry="8" opacity=".18" fill="#255753" />
      <path
        d="M16 30 5 44 19 45M44 30 55 44 41 45"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <ellipse cx="30" cy="31" rx="20" ry="17" fill="currentColor" />
      <circle cx="20" cy="17" r="9" fill="currentColor" />
      <circle cx="40" cy="17" r="9" fill="currentColor" />
      <circle cx="20" cy="16" r="5" fill="#fffde9" />
      <circle cx="40" cy="16" r="5" fill="#fffde9" />
      <circle cx={piece === "E" ? 22 : 18} cy="16" r="2.3" fill="#334d3e" />
      <circle cx={piece === "E" ? 42 : 38} cy="16" r="2.3" fill="#334d3e" />
      <path
        d="M23 32q7 7 14 0"
        fill="none"
        stroke="#355e41"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
export default function FrogSwap(props: GameProps) {
  return <Round key={`${props.level}:${props.resetToken}`} {...props} />;
}
function Round({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const puzzle = frogSwapLevels[level] ?? frogSwapLevels[0];
  const [board, setBoard] = useState<FrogPiece[]>(() => [...puzzle.start]),
    [past, setPast] = useState<FrogPiece[][]>([]),
    [selected, setSelected] = useState<number | null>(null),
    [hint, setHint] = useState<number[]>([]),
    [message, setMessage] = useState(
      "点一只青蛙，再点发光的空石头。可以向前一步，或跳过一只异色青蛙。",
    );
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken }),
    done = useRef(false);
  const won = frogsWon(board, puzzle.goal),
    locked = paused || won;
  const targets = selected === null ? [] : frogDestinations(board, selected);
  function report(text: string) {
    setMessage(text);
    callbacks.current.onStatus(text);
  }
  useEffect(() => {
    callbacks.current.onStatus("点一只青蛙，再点发光的空石头。可以向前一步，或跳过一只异色青蛙。");
  }, []);
  useEffect(() => {
    if (won && !paused && !done.current) {
      done.current = true;
      report(
        `换岸成功！${board.filter((p) => p !== ".").length} 只青蛙都还在，并且两队完全交换了位置。`,
      );
      callbacks.current.onComplete();
    }
  }, [won, paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked) return;
    const plan = solveFrogs(board, puzzle.goal);
    setHint(plan?.[0] ?? []);
    report(
      plan?.length
        ? `让 ${plan[0][0] + 1} 号石头上的青蛙${Math.abs(plan[0][0] - plan[0][1]) === 2 ? "跳过异色伙伴" : "向前一步"}，到 ${plan[0][1] + 1} 号空石头。`
        : "这个局面已经无法全部换岸。请撤销刚才的移动，换一种顺序。",
    );
  }, [hintToken, locked]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    if (past.length) {
      setBoard(past.at(-1)!);
      setPast(past.slice(0, -1));
      report("已撤销一步，青蛙回到了刚才的位置。");
    } else report("还没有移动记录。");
    setSelected(null);
    setHint([]);
  }, [undoToken, locked]);
  function pick(index: number) {
    if (locked) return;
    if (board[index] !== ".") {
      setSelected(selected === index ? null : index);
      const possible = frogDestinations(board, index);
      report(
        possible.length
          ? `已选 ${index + 1} 号青蛙，点发光的空石头落脚。`
          : "这只青蛙暂时无路可走。可以改选另一只。",
      );
      return;
    }
    if (selected === null) {
      report("先选一只青蛙，再选它可以到达的空石头。");
      return;
    }
    const next = hopFrog(board, selected, index);
    if (!next) {
      report(
        "只能向前一步，或跳过恰好一只异色青蛙；不能后退、跳同色或跨空位。",
      );
      return;
    }
    const jump = Math.abs(selected - index) === 2;
    setPast([...past, board]);
    setBoard(next);
    setSelected(null);
    setHint([]);
    report(
      jump
        ? "轻轻一跳，伙伴留在原处，没有青蛙被移走。"
        : "向前一步。想想下一只该由谁接力。",
    );
  }
  return (
    <div
      className="fs-layout"
      data-frog-swap-game
      data-state={board.join("")}
      data-goal={puzzle.goal.join("")}
      data-moves={past.length}
      data-won={won}
    >
      <section className="fs-pond">
        <header>
          <div>
            <span>THE COURTEOUS CROSSING</span>
            <h3>{puzzle.title}</h3>
          </div>
          <b>
            {level + 1}
            <small> / {frogSwapLevels.length}</small>
          </b>
        </header>
        <p>{puzzle.lesson}</p>
        <div className="fs-directions">
          <span>
            <i className="fs-green" />
            绿蛙：编号变大 →
          </span>
          <span>
            ← 金蛙：编号变小
            <i className="fs-gold" />
          </span>
        </div>
        <div
          className="fs-stones"
          style={{
            gridTemplateColumns: `repeat(${Math.min(board.length, 5)},minmax(0,1fr))`,
          }}
          aria-label="按编号连续排列的河中石头"
        >
          {board.map((piece, i) => (
            <button
              key={i}
              data-frog-stone={i}
              data-piece={piece}
              aria-label={`${i + 1} 号石头，${piece === "." ? "空位" : piece === "E" ? "绿蛙，向大号移动" : "金蛙，向小号移动"}${targets.includes(i) ? "，可以落脚" : ""}`}
              aria-pressed={selected === i}
              disabled={locked}
              className={`fs-stone ${selected === i ? "selected" : ""} ${targets.includes(i) ? "target" : ""} ${hint.includes(i) ? "hinted" : ""}`}
              onClick={() => pick(i)}
            >
              <small>{i + 1}</small>
              {piece === "." ? (
                <span className="fs-empty">
                  {targets.includes(i) ? "落这里" : "空"}
                </span>
              ) : (
                <>
                  <Frog piece={piece} />
                  <strong>{piece === "E" ? "绿 →" : "← 金"}</strong>
                </>
              )}
            </button>
          ))}
        </div>
        <p className="fs-reading">
          按石头编号连续前进；换行后接着看下一号。跳跃不会移走任何青蛙。
        </p>
        <div className="fs-goal">
          <span>目标队形</span>
          <div>
            {puzzle.goal.map((p, i) => (
              <b
                key={i}
                className={
                  p === "E" ? "fs-east" : p === "W" ? "fs-west" : "fs-gap"
                }
              >
                {p === "E" ? "绿" : p === "W" ? "金" : "空"}
              </b>
            ))}
          </div>
        </div>
        <p className="fs-message" role="status">
          {message}
        </p>
        <div className="fs-foot">
          <span>已走 {past.length} 步</span>
          <span>
            {paused ? "已暂停" : won ? "全员换岸" : "没有计时，可以慢慢想"}
          </span>
        </div>
      </section>
      <aside className="fs-guide">
        <span>交替 · 让路</span>
        <h3>两队，交换岸边</h3>
        <p>绿蛙只能向更大的编号移动，金蛙只能向更小的编号移动。</p>
        <ol>
          <li>向前紧邻的石头空着：可以走一步。</li>
          <li>前面是一只异色青蛙，后面是空位：可以跳两步。</li>
          <li>不许后退、跳同色、跳多只，或跳过空石头。</li>
        </ol>
        <p>
          所有青蛙都必须保留。金蛙全部到左边，绿蛙全部到右边，空位留在中间。
        </p>
        <details>
          <summary>操作和解困</summary>
          <p>
            先选青蛙，再选发光空位。再点同一只可取消。Tab、Enter
            和空格也能操作。提示查找当前队形的完整换岸路线。卡住时用撤销恢复先前队形。暂停和通关后不能移动。
          </p>
        </details>
      </aside>
    </div>
  );
}
