// SPDX-License-Identifier: MIT
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { carryLettersLevels } from "./carryLettersLevels";
import {
  carryAssignmentValid,
  carryColumns,
  carryNumber,
  carrySymbols,
  carryWon,
  createCarryState,
  editCarry,
  findCarryHint,
  publicCarry,
  undoCarry,
  type CarryHint,
} from "./carryLettersLogic";
import "./carryLetters.css";
export default function CarryLetters(props: GameProps) {
  return <CarryRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function CarryRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = carryLettersLevels[level] ?? carryLettersLevels[0];
  const puzzle = useMemo(() => publicCarry(config), [config]);
  const symbols = useMemo(() => carrySymbols(puzzle), [puzzle]);
  const [state, setState] = useState(() => createCarryState(puzzle));
  const [hint, setHint] = useState<CarryHint | null>(null),
    [busy, setBusy] = useState(false);
  const tokens = useRef({ hintToken, undoToken }),
    notified = useRef(false),
    request = useRef<AbortController | null>(null),
    inputs = useRef<Record<string, HTMLSelectElement | null>>({}),
    lastInput = useRef<string | null>(null);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const won = carryWon(puzzle, state.values),
    locked = paused || won;
  const valid = carryAssignmentValid(puzzle, state.values),
    columns = carryColumns(puzzle, state.values);
  function invalidate() {
    request.current?.abort();
    request.current = null;
    setHint(null);
    setBusy(false);
  }
  useEffect(() => {
    callbacks.current.onStatus(
      "同字母同数字，不同字母不同数字。首位不能为 0；从个位观察进位。",
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
    void findCarryHint(puzzle, state.values, {
      signal: controller.signal,
    }).then((next) => {
      if (!next || controller.signal.aborted || request.current !== controller)
        return;
      request.current = null;
      setBusy(false);
      setHint(next);
      callbacks.current.onStatus(next.text);
    });
  }, [hintToken, locked, puzzle, state.values]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    invalidate();
    setState((current) => undoCarry(puzzle, current));
    callbacks.current.onStatus(
      state.history.length
        ? "已撤销上一次数字填写。"
        : "还没有可以撤销的填写。",
    );
  }, [undoToken, locked, puzzle, state.history.length]);
  useEffect(() => {
    if (!won || paused || notified.current) return;
    notified.current = true;
    callbacks.current.onStatus("每个字母与每一列都吻合！算式成立。");
    callbacks.current.onComplete();
  }, [won, paused]);
  function edit(symbol: string, digit: number | null) {
    if (locked) return;
    invalidate();
    setState((current) => editCarry(puzzle, current, symbol, digit));
  }
  const width = Math.max(
    ...puzzle.addends.map((w) => w.length),
    puzzle.result.length,
  );
  return (
    <div
      className="puzzle-layout carry-letters"
      data-carry-letters-game
      data-carry-letters-won={won}
    >
      <section className="cl-workbench" aria-label="进位字母工作台">
        <span className="mini-label">进位字母 · {config.title}</span>
        <h3>同一个字母，同一个数字。</h3>
        <p className="cl-state" role="status">
          {paused
            ? "已暂停，填写已锁定。"
            : won
              ? "✓ 算式成立！"
              : !valid
                ? "! 有重复数字或首位 0。可修改、清空或撤销。"
                : `${symbols.length} 个字母 · ${width} 列 · ${puzzle.addends.length} 个加数`}
        </p>
        <div
          className="cl-equation"
          aria-label={`公开算式：${puzzle.addends.join(" 加 ")} 等于 ${puzzle.result}`}
        >
          {[...puzzle.addends, puzzle.result].map((word, row) => (
            <div
              key={row}
              className={`cl-number ${row === puzzle.addends.length ? "cl-result" : ""}`}
            >
              <span className="cl-sign" aria-hidden="true">
                {row === puzzle.addends.length ? "=" : row === 0 ? "" : "+"}
              </span>
              {Array.from({ length: width }, (_, col) => {
                const symbol = word[col - (width - word.length)],
                  digit = symbol ? state.values[symbol] : null;
                return (
                  <span
                    key={col}
                    className={`cl-place ${symbol ? "" : "cl-place-empty"}`}
                    aria-label={
                      symbol
                        ? `${symbol}，${digit == null ? "待填" : digit}`
                        : undefined
                    }
                  >
                    {symbol ? (
                      <>
                        <b>{symbol}</b>
                        <small>{digit ?? "?"}</small>
                      </>
                    ) : null}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cl-mapping" aria-label="字母数字映射">
          {symbols.map((symbol) => (
            <label key={symbol}>
              <span>
                {symbol}
                {symbol in puzzle.givens ? " · 已知" : ""}
              </span>
              <select
                data-carry-letter={symbol}
                ref={(node) => {
                  inputs.current[symbol] = node;
                }}
                onFocus={() => {
                  lastInput.current = symbol;
                }}
                aria-label={`字母 ${symbol}${symbol in puzzle.givens ? "，已知数字" : " 的数字"}`}
                value={state.values[symbol] ?? ""}
                disabled={locked || symbol in puzzle.givens}
                onChange={(e) =>
                  edit(
                    symbol,
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              >
                <option value="">待填</option>
                {Array.from({ length: 10 }, (_, n) => (
                  <option value={n} key={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="cl-help">
          Tab
          选择字母，方向键选择数字；选“待填”清空。提示只说明一条推论，不会自动填写。
        </p>
        {busy ? (
          <div className="cl-hint" role="status">
            正在逐列检查当前填写…{" "}
            <button
              data-carry-letters-cancel
              onClick={(event) => {
                const restore = document.activeElement === event.currentTarget;
                invalidate();
                if (restore) {
                  const symbol =
                    lastInput.current && !(lastInput.current in puzzle.givens)
                      ? lastInput.current
                      : symbols.find((s) => !(s in puzzle.givens));
                  if (symbol) inputs.current[symbol]?.focus();
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
            className="cl-hint"
            role="status"
            data-carry-letters-hint
            data-hint-kind={hint.kind}
          >
            {hint.text}
          </p>
        ) : null}
        <h4>从右向左的进位记录</h4>
        <ol className="cl-columns" aria-label="逐列进位检查">
          {columns.map((c) => (
            <li key={c.column} data-carry-column={c.column}>
              <strong>
                {["个位", "十位", "百位", "千位", "万位"][c.column]}
              </strong>
              <span>
                带入 {c.incoming ?? "?"} · 列和 {c.total ?? "?"} · 结果位{" "}
                {c.digit ?? "?"} · 送出 {c.outgoing ?? "?"}
              </span>
              <b>
                {c.matches === null
                  ? "待核对"
                  : c.matches
                    ? "✓ 本列吻合"
                    : "! 本列不符"}
              </b>
            </li>
          ))}
        </ol>
        <p className="cl-help">
          进位可以是 0、1 或 2。最高位送出必须为 0；列和按当前填写计算，若有 !
          请回头检查。
        </p>
        <p className="cl-total">
          数值核对：
          {puzzle.addends
            .map((w) => carryNumber(w, state.values) ?? "?")
            .join(" + ")}{" "}
          = {carryNumber(puzzle.result, state.values) ?? "?"}
        </p>
      </section>
      <aside className="game-notes cl-notes">
        <span className="mini-label">加法 · 约束 · 进位</span>
        <h3>把一大题，拆成小列。</h3>
        <p>{config.lesson}</p>
        <h4>公开规则</h4>
        <ul>
          <li>每个字母代表 0–9 中的一个数字。</li>
          <li>同字母处处相同，不同字母不能共用数字。</li>
          <li>多位数的首位不能为 0。</li>
          <li>所有加数的和等于横线下的结果。</li>
        </ul>
        <h4>公开数字线索</h4>
        <p>
          {Object.entries(puzzle.givens)
            .map(([s, n]) => `${s} = ${n}`)
            .join("；") || "本关没有预填数字。"}
        </p>
        <details open={level === 0}>
          <summary>怎样读一列？</summary>
          <p>
            例如某列是 7 + 8，再加右侧带来的 1，列和为 16：本位写 6，向左进
            1。这只是规则示例，不是本关答案。
          </p>
          <p>
            先确认右侧的进位，再处理左边。提示会使用当前填写；如果试填走入死路，可以撤销。
          </p>
        </details>
      </aside>
    </div>
  );
}
