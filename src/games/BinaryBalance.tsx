// SPDX-License-Identifier: GPL-3.0-only
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import type { GameProps } from "../lib/types";
import { binaryBalanceLevels } from "./binaryBalanceLevels";
import {
  binaryConflicts,
  binaryLabel,
  binaryWon,
  createBinaryState,
  editBinary,
  findBinaryHint,
  publicBinary,
  undoBinary,
  type BinaryCell,
  type BinaryHint,
} from "./binaryBalanceLogic";
import "./binaryBalance.css";
export default function BinaryBalance(props: GameProps) {
  return <BinaryRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function BinaryRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = binaryBalanceLevels[level] ?? binaryBalanceLevels[0],
    puzzle = useMemo(() => publicBinary(config), [config]),
    n = puzzle.size;
  const [state, setState] = useState(() => createBinaryState(puzzle));
  const [selected, setSelected] = useState(() =>
    Math.max(0, puzzle.givens.indexOf(0)),
  );
  const [hint, setHint] = useState<BinaryHint | null>(null),
    [busy, setBusy] = useState(false);
  const tokens = useRef({ hintToken, undoToken }),
    notified = useRef(false),
    request = useRef<AbortController | null>(null),
    buttons = useRef<(HTMLButtonElement | null)[]>([]),
    boardWrap = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const won = binaryWon(puzzle, state.cells),
    locked = paused || won,
    conflicts = binaryConflicts(puzzle, state.cells);
  function invalidate() {
    request.current?.abort();
    request.current = null;
    setHint(null);
    setBusy(false);
  }
  useEffect(() => {
    callbacks.current.onStatus(
      "选一格填 A 或 B。每行每列各一半，不能三连，完整行列不能重复。",
    );
    return () => request.current?.abort();
  }, []);
  useEffect(() => {
    if (paused) invalidate();
  }, [paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked) return;
    invalidate();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    void findBinaryHint(puzzle, state.cells, {
      signal: controller.signal,
    }).then((next) => {
      if (!next || controller.signal.aborted || request.current !== controller)
        return;
      request.current = null;
      setBusy(false);
      setHint(next);
      callbacks.current.onStatus(next.text);
    });
  }, [hintToken, locked, puzzle, state.cells]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    invalidate();
    setState((current) => undoBinary(puzzle, current));
    callbacks.current.onStatus(
      state.history.length ? "已撤销上一次填写。" : "还没有可以撤销的填写。",
    );
  }, [undoToken, locked, puzzle, state.history.length]);
  useEffect(() => {
    if (!won || paused || notified.current) return;
    notified.current = true;
    callbacks.current.onStatus("每行每列都平衡，而且各不相同！");
    callbacks.current.onComplete();
  }, [won, paused]);
  function input(index: number, value: BinaryCell) {
    if (locked || puzzle.givens[index]) return;
    invalidate();
    setState((current) => editBinary(puzzle, current, index, value));
  }
  function keyboard(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (locked || e.ctrlKey || e.metaKey || e.altKey) return;
    const directions: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -n,
      ArrowDown: n,
    };
    if (e.key in directions) {
      e.preventDefault();
      const next = index + directions[e.key];
      if (
        next < 0 ||
        next >= n * n ||
        ((e.key === "ArrowLeft" || e.key === "ArrowRight") &&
          Math.floor(next / n) !== Math.floor(index / n))
      )
        return;
      setSelected(next);
      buttons.current[next]?.focus();
      return;
    }
    if (
      ["a", "b", "1", "2", "0", "Delete", "Backspace"].includes(
        e.key.toLowerCase(),
      ) ||
      ["Delete", "Backspace"].includes(e.key)
    ) {
      e.preventDefault();
      input(
        index,
        ["a", "1"].includes(e.key.toLowerCase())
          ? 1
          : ["b", "2"].includes(e.key.toLowerCase())
            ? 2
            : 0,
      );
    }
  }
  function focusCell(index: number) {
    setSelected(index);
    // Keep the focused cell (and its focus ring) visible inside the narrow board.
    // Native focus still handles ordinary vertical page scrolling.
    const viewport = boardWrap.current,
      cell = buttons.current[index];
    if (!viewport || !cell) return;
    const outer = viewport.getBoundingClientRect(),
      inner = cell.getBoundingClientRect();
    if (inner.left < outer.left)
      viewport.scrollLeft -= outer.left - inner.left + 6;
    else if (inner.right > outer.right)
      viewport.scrollLeft += inner.right - outer.right + 6;
  }
  function countLine(indices: number[]) {
    return `A ${indices.filter((i) => state.cells[i] === 1).length} · B ${indices.filter((i) => state.cells[i] === 2).length}`;
  }
  return (
    <div
      className="puzzle-layout binary-balance"
      data-binary-balance-game
      data-binary-balance-won={won}
    >
      <section className="bb-workbench" aria-label="双符平衡工作台">
        <span className="mini-label">双符平衡 · {config.title}</span>
        <h3>一半 A，一半 B。</h3>
        <p className="bb-state" role="status">
          {paused
            ? "已暂停，填写已锁定。"
            : won
              ? "✓ 全部行列平衡！"
              : conflicts.length
                ? "! 标记格与当前规则冲突，可修改或撤销。"
                : `每行每列各 ${n / 2} 个 A 和 ${n / 2} 个 B`}
        </p>
        <p className="bb-help" id="bb-scroll-help">
          窄屏可左右滑动棋盘；方向键移动会显示所选格。
        </p>
        <div className="bb-board-wrap" ref={boardWrap}>
          <div
            className="bb-board"
            role="group"
            aria-describedby="bb-scroll-help"
            aria-label={`${n} 行 ${n} 列，固定线索标有小圆点，方向键移动，A 或 B 填写`}
            style={{ "--bb-size": n } as CSSProperties}
          >
            {state.cells.map((value, index) => {
              const given = Boolean(puzzle.givens[index]),
                bad = conflicts.includes(index),
                row = Math.floor(index / n) + 1,
                col = (index % n) + 1;
              return (
                <button
                  key={index}
                  ref={(el) => {
                    buttons.current[index] = el;
                  }}
                  className={`bb-cell bb-value-${value} ${given ? "bb-given" : ""} ${selected === index ? "bb-selected" : ""} ${bad ? "bb-conflict" : ""}`}
                  data-binary-cell={index}
                  data-value={value}
                  data-given={given}
                  tabIndex={selected === index ? 0 : -1}
                  aria-label={`第 ${row} 行第 ${col} 列，${binaryLabel(value)}${given ? "，固定线索" : "，可填写"}${bad ? "，存在冲突" : ""}`}
                  aria-pressed={selected === index}
                  aria-disabled={given || locked}
                  disabled={locked}
                  onClick={() => {
                    if (!locked) setSelected(index);
                  }}
                  onFocus={() => focusCell(index)}
                  onKeyDown={(e) => keyboard(e, index)}
                >
                  <span>{value ? binaryLabel(value) : "·"}</span>
                  {given ? <small aria-hidden="true">●</small> : null}
                  {bad ? (
                    <b className="bb-alert" aria-hidden="true">
                      !
                    </b>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        <p className="bb-selection" aria-live="polite">
          已选：第 {Math.floor(selected / n) + 1} 行第 {(selected % n) + 1} 列 ·{" "}
          {binaryLabel(state.cells[selected])}
          {puzzle.givens[selected] ? "（固定线索）" : ""}
        </p>
        <div className="bb-pad" role="group" aria-label="填写所选格">
          <button
            data-binary-input="1"
            disabled={locked || Boolean(puzzle.givens[selected])}
            onClick={() => input(selected, 1)}
          >
            填 A
          </button>
          <button
            data-binary-input="2"
            disabled={locked || Boolean(puzzle.givens[selected])}
            onClick={() => input(selected, 2)}
          >
            填 B
          </button>
          <button
            data-binary-input="0"
            disabled={locked || Boolean(puzzle.givens[selected])}
            onClick={() => input(selected, 0)}
          >
            清空
          </button>
        </div>
        <p className="bb-help">
          点格子后选 A / B / 清空。键盘：方向键移动，A 或 1 填 A，B 或 2 填
          B，Delete 清空。● 是不可改的公开线索。
        </p>
        {busy ? (
          <div className="bb-hint" role="status">
            正在检验当前填写…{" "}
            <button
              data-binary-balance-cancel
              onClick={(event) => {
                const restore = document.activeElement === event.currentTarget;
                invalidate();
                if (restore) {
                  const index = puzzle.givens[selected]
                    ? puzzle.givens.indexOf(0)
                    : selected;
                  buttons.current[index]?.focus();
                }
                callbacks.current.onStatus("已取消提示计算。");
              }}
            >
              取消计算
            </button>
          </div>
        ) : null}
        {hint ? (
          <p
            className="bb-hint"
            role="status"
            data-binary-balance-hint
            data-hint-kind={hint.kind}
          >
            {hint.text}
          </p>
        ) : null}
        <div className="bb-counts">
          <div>
            <h4>行计数</h4>
            {Array.from({ length: n }, (_, r) => (
              <p
                key={r}
                aria-label={`第${r + 1}行：${countLine(Array.from({ length: n }, (_, c) => r * n + c))}`}
              >
                {r + 1}：
                {countLine(
                  Array.from({ length: n }, (_, c) => r * n + c),
                ).replaceAll(" ", "")}
              </p>
            ))}
          </div>
          <div>
            <h4>列计数</h4>
            {Array.from({ length: n }, (_, c) => (
              <p
                key={c}
                aria-label={`第${c + 1}列：${countLine(Array.from({ length: n }, (_, r) => r * n + c))}`}
              >
                {c + 1}：
                {countLine(
                  Array.from({ length: n }, (_, r) => r * n + c),
                ).replaceAll(" ", "")}
              </p>
            ))}
          </div>
        </div>
      </section>
      <aside className="game-notes bb-notes">
        <span className="mini-label">平衡 · 排除 · 唯一</span>
        <h3>两种符号，三条规则。</h3>
        <p>{config.lesson}</p>
        <ol>
          <li>每行每列 A、B 数量相同。</li>
          <li>横竖都不能连续三个相同符号。</li>
          <li>任意两条完整的行不能相同，完整的列也不能相同。</li>
        </ol>
        <p>
          A 和 B
          都有文字标记，不用分辨颜色也能解题。固定线索保留小圆点与语音标签。
        </p>
        <details open={level === 0}>
          <summary>几个小推论</summary>
          <p>
            A A 空格 → 最后一格填 B。A 空格 A → 中间也填 B。某行 A
            的数量已到一半 → 剩余空格都填 B。
          </p>
          <p>
            若这些办法都不够，就比较两条快填满的行列。提示会搜索当前填写的合法延续，不会替你填完整答案。
          </p>
        </details>
      </aside>
    </div>
  );
}
