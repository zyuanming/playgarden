// SPDX-License-Identifier: MIT
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { codeCluesLevels } from "./codeCluesLevels";
import {
  CODE_SYMBOLS,
  codeCandidates,
  codeLabel,
  codeWon,
  createCodeState,
  editCode,
  findCodeHint,
  publicCode,
  submitCode,
  undoCode,
  type CodeFeedback,
  type CodeHint,
} from "./codeCluesLogic";
import "./codeClues.css";
function FeedbackRow({ row, label }: { row: CodeFeedback; label: string }) {
  return (
    <li className="cc-feedback">
      <span className="cc-row-label">{label}</span>
      <strong>{codeLabel(row.guess)}</strong>
      <div>
        <span>
          ✓ 就位 <b>{row.exact}</b>
        </span>
        <span>
          ↔ 错位 <b>{row.misplaced}</b>
        </span>
      </div>
    </li>
  );
}
export default function CodeClues(props: GameProps) {
  return (
    <CodeLevelView key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function CodeLevelView({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = codeCluesLevels[level] ?? codeCluesLevels[0];
  const puzzle = useMemo(() => publicCode(config), [config]);
  const [state, setState] = useState(() => createCodeState(puzzle));
  const [hint, setHint] = useState<CodeHint | null>(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0);
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false);
  const request = useRef<AbortController | null>(null);
  const history = useRef<HTMLOListElement>(null);
  const won = codeWon(puzzle, state),
    locked = paused || won;
  const remaining = useMemo(
    () => codeCandidates(puzzle, state.transcript).length,
    [puzzle, state.transcript],
  );
  function invalidateHint() {
    request.current?.abort();
    request.current = null;
    setHint(null);
    setBusy(false);
    setProgress(0);
  }
  useEffect(() => {
    onStatus(
      "选好每格符号后提交。就位与错位分别计数，次数不限；所有符号都可以重复。",
    );
    return () => {
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (paused) invalidateHint();
  }, [paused]);
  useEffect(() => {
    // Reveal new feedback without moving keyboard focus or the surrounding page.
    if (history.current)
      history.current.scrollTop = history.current.scrollHeight;
  }, [state.transcript.length]);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (locked) return;
    invalidateHint();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    onStatus("正在按公开记录比较下一步试探；可取消，也可继续编辑。");
    void findCodeHint(puzzle, state.transcript, {
      signal: controller.signal,
      onProgress: (n) => {
        if (!controller.signal.aborted) setProgress(n);
      },
    }).then((result) => {
      if (
        controller.signal.aborted ||
        request.current !== controller ||
        !result
      )
        return;
      request.current = null;
      setBusy(false);
      setHint(result);
      onStatus(result.text);
    });
  }, [hintToken, locked, puzzle, state.transcript, onStatus]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (locked) return;
    invalidateHint();
    const next = undoCode(puzzle, state);
    setState(next);
    onStatus(
      next === state
        ? "还没有可以撤销的编辑或提交。"
        : "已撤销一次编辑或提交；草稿和公开记录一起恢复。",
    );
  }, [undoToken, locked, puzzle, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus(
        `全部 ${puzzle.slots} 格就位！共提交 ${state.transcript.length} 次，记录仍可回看。`,
      );
      onComplete();
    }
  }, [
    won,
    paused,
    puzzle.slots,
    state.transcript.length,
    onComplete,
    onStatus,
  ]);
  function edit(slot: number, symbol: number) {
    if (locked) return;
    invalidateHint();
    setState((s) => editCode(puzzle, s, slot, symbol));
  }
  function submit() {
    if (locked) return;
    invalidateHint();
    const next = submitCode(config, state);
    setState(next);
    const row = next.transcript.at(-1)!;
    onStatus(
      `第 ${next.transcript.length} 次：就位 ${row.exact}，错位 ${row.misplaced}。`,
    );
  }
  return (
    <div
      className="puzzle-layout code-clues"
      data-code-clues-game
      data-code-clues-won={won}
      data-code-clues-guesses={state.transcript.length}
    >
      <section className="cc-workbench" aria-label="码符侦探工作台">
        <div className="cc-heading">
          <span className="mini-label">码符侦探 · {config.title}</span>
          <strong>{remaining} 种候选</strong>
        </div>
        <div
          className="cc-vault"
          aria-label={
            won
              ? `已破解：${codeLabel(state.draft)}`
              : `${puzzle.slots} 格待破解的密码`
          }
        >
          {Array.from({ length: puzzle.slots }, (_, i) => (
            <span key={i}>
              {won ? CODE_SYMBOLS[state.draft[i]].glyph : "?"}
            </span>
          ))}
        </div>
        <p className="cc-instruction">
          {paused
            ? "已暂停，草稿与提交锁定。"
            : won
              ? "已破解！下方保留全部推理记录。重来会开启新一轮。"
              : `${puzzle.slots} 格 · ${puzzle.symbols} 种符号 · 可重复 · 提交次数不限`}
        </p>
        <div className="cc-draft" aria-label="当前猜测">
          {state.draft.map((symbol, slot) => (
            <label key={slot}>
              <span>第 {slot + 1} 格</span>
              <select
                aria-label={`第 ${slot + 1} 格符号`}
                data-code-clues-slot={slot}
                value={symbol}
                disabled={locked}
                onChange={(e) => edit(slot, Number(e.target.value))}
              >
                {CODE_SYMBOLS.slice(0, puzzle.symbols).map((s, value) => (
                  <option key={value} value={value}>
                    {s.glyph} {s.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <button
          className="cc-submit"
          data-code-clues-submit
          disabled={locked}
          onClick={submit}
        >
          提交这组猜测
        </button>
        {busy && (
          <div className="cc-hint" role="status">
            <p>比较下一步分组中…已计算 {progress} 对。只用公开线索与记录。</p>
            <button
              data-code-clues-cancel
              onClick={() => {
                invalidateHint();
                onStatus("已取消提示计算。");
              }}
            >
              取消计算
            </button>
          </div>
        )}
        {hint && (
          <div className="cc-hint" role="status" data-code-clues-hint>
            <p>{hint.text}</p>
            {hint.guess && (
              <button
                data-code-clues-use-hint
                disabled={locked}
                onClick={() => {
                  if (locked || !hint.guess) return;
                  const guess = hint.guess;
                  invalidateHint();
                  setState((s) =>
                    guess.reduce(
                      (next, symbol, slot) =>
                        editCode(puzzle, next, slot, symbol),
                      s,
                    ),
                  );
                  onStatus("已填入建议，可先检查再提交。");
                }}
              >
                填入建议，不自动提交
              </button>
            )}
          </div>
        )}
        <h4>
          你的调查记录 <span>({state.transcript.length})</span>
        </h4>
        <p className="cc-help">
          ✓ 就位：符号和位置都对。↔
          错位：符号对但位置不对。每个符号最多匹配一次。
          新反馈显示在底部，可滚动回看旧记录。
        </p>
        <ol
          className="cc-history"
          ref={history}
          tabIndex={0}
          aria-label="猜测与反馈记录，可滚动回看"
        >
          {state.transcript.length ? (
            state.transcript.map((row, i) => (
              <FeedbackRow
                key={i}
                row={row}
                label={`第 ${i + 1} 次${i === state.transcript.length - 1 ? " · 最新反馈" : ""}`}
              />
            ))
          ) : (
            <li className="cc-empty">
              还没有提交。先选一组能帮你收集信息的符号。
            </li>
          )}
        </ol>
        <p className="cc-help">
          Tab 移动焦点，方向键选择符号，Enter /
          空格按按钮。撤销恢复一次编辑或提交；暂停会取消正在计算的提示。
        </p>
      </section>
      <aside className="game-notes cc-notes">
        <span className="mini-label">证据 · 排除 · 信息量</span>
        <h3>每次试探，问一个好问题。</h3>
        <p>{config.lesson}</p>
        <h4>公开起始线索</h4>
        {puzzle.initialClues.length ? (
          <ol className="cc-initial">
            {puzzle.initialClues.map((row, i) => (
              <FeedbackRow key={i} row={row} label={`线索 ${i + 1}`} />
            ))}
          </ol>
        ) : (
          <p>
            本关没有预先试探。全部 {puzzle.symbols ** puzzle.slots}{" "}
            种序列都可能出现。
          </p>
        )}
        <details open={level === 0}>
          <summary>第一次玩：完整示范</summary>
          <p>
            第一关先试“圆、圆”，得到就位 1、错位
            0：恰好有一个圆。再试“三角、圆”，得到就位 0、错位
            2：两个符号都在，但位置都不对。因此交换成“圆、三角”，提交即全部就位。
          </p>
          <p>
            若答案是“圆、圆、方”，试“圆、方、方”会得到就位 2、错位
            0。多出来的那个方不能再次匹配。
          </p>
        </details>
        <h4>提示如何思考？</h4>
        <p>
          从公开线索和已提交反馈筛选候选，再比较所有合法试探。让下一次反馈可能留下的最大候选组尽量小；这是单步精确比较，不承诺全程最少次数。
        </p>
        <p>
          候选数会根据已知证据更新。提示不读取隐藏答案，也不会因符号的颜色而改变含义。
        </p>
      </aside>
    </div>
  );
}
