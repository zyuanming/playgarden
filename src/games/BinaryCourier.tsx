// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  binaryBits,
  binaryCardLabel,
  binaryCourierLevels,
  binaryHint,
  binaryWon,
  createBinaryState,
  executeBinaryOp,
  moveBinary,
  undoBinary,
} from "./binaryCourierLogic";
import "./binaryCourier.css";

export default function BinaryCourier(props: GameProps) {
  return <CourierLevel key={`${props.level}:${props.resetToken}`} {...props} />;
}
function CourierLevel({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = binaryCourierLevels[level] ?? binaryCourierLevels[0];
  const [state, setState] = useState(() => createBinaryState(config));
  const [hint, setHint] = useState<ReturnType<typeof binaryHint> | null>(null);
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false);
  const board = state.board,
    won = binaryWon(config, board),
    locked = paused || won;
  const bits = binaryBits(config.width, board.value),
    target = binaryBits(config.width, config.target);
  const remaining = board.remaining.reduce((a, b) => a + b, 0);
  useEffect(() => {
    onStatus(
      "点击操作卡改变寄存器。每张卡只能用标示的次数，让所有位与目标一致。",
    );
  }, []);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (paused || won) return;
    const next = binaryHint(config, board);
    setHint(next);
    onStatus(next.text);
  }, [hintToken, paused, won, config, board, onStatus]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (paused) return;
    const next = undoBinary(state);
    setState(next);
    setHint(null);
    onStatus(
      next === state
        ? "还没有操作可以撤销。"
        : "已撤销一步，寄存器和卡片次数一起恢复。",
    );
  }, [undoToken, paused, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus(
        `位型准确送达！用了 ${state.history.length} 步，最短纪录 ${config.par} 步。`,
      );
      onComplete();
    }
  }, [won, paused, state.history.length, config.par, onComplete, onStatus]);
  function act(card: number) {
    if (locked) return;
    const next = moveBinary(config, state, card);
    if (next === state) return;
    setState(next);
    setHint(null);
    onStatus(
      `${binaryCardLabel(config.width, config.cards[card])}：${bits} → ${binaryBits(config.width, next.board.value)}。`,
    );
  }
  return (
    <div
      className="puzzle-layout binary-courier"
      data-binary-game
      data-binary-value={board.value}
      data-binary-bits={bits}
      data-binary-remaining={board.remaining.join(",")}
      data-binary-won={won}
      tabIndex={0}
      aria-label="位流快递工作台，数字一至八执行对应卡片"
      onKeyDown={(event) => {
        if (
          locked ||
          event.repeat ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        )
          return;
        if (/^[1-8]$/.test(event.key)) {
          event.preventDefault();
          act(Number(event.key) - 1);
        }
      }}
    >
      <section className="by-workbench" aria-label="固定宽度寄存器">
        <div className="by-heading">
          <span className="mini-label">位流快递 · {config.title}</span>
          <strong>
            {config.width} 位 · {state.history.length} 步
          </strong>
        </div>
        <p className="by-instruction">
          {paused
            ? "已暂停，寄存器和卡片暂时锁定。"
            : won
              ? "目标位型已送达！"
              : "每张卡都会立即执行并消耗一次。目标一致就通关，不必用光卡片。"}
        </p>
        <div className="by-register" aria-label={`当前寄存器 ${bits}`}>
          <div className="by-register-label">
            <strong>当前寄存器</strong>
            <span>高位 ← → 低位</span>
          </div>
          <div
            className="by-bit-row"
            style={{
              gridTemplateColumns: `repeat(${config.width}, minmax(0, 1fr))`,
            }}
          >
            {[...bits].map((bit, i) => (
              <div
                key={i}
                className={`by-bit ${bit === "1" ? "lit" : ""} ${bit === target[i] ? "match" : ""}`}
                data-binary-bit={i}
                aria-label={`位 ${config.width - 1 - i}：${bit}，${bit === target[i] ? "匹配" : "待调整"}`}
              >
                <small>位 {config.width - 1 - i}</small>
                <b>{bit}</b>
                <span>{bit === target[i] ? "✓" : "·"}</span>
              </div>
            ))}
          </div>
          <div className="by-register-label by-target-label">
            <strong>目标位型</strong>
            <span>
              {[...bits].filter((bit, i) => bit === target[i]).length} /{" "}
              {config.width} 位匹配
            </span>
          </div>
          <div
            className="by-target-row"
            style={{
              gridTemplateColumns: `repeat(${config.width}, minmax(0, 1fr))`,
            }}
            aria-label={`目标 ${target}`}
          >
            {[...target].map((bit, i) => (
              <span key={i} className={bit === "1" ? "lit" : ""}>
                {bit}
              </span>
            ))}
          </div>
        </div>
        <div className="by-heading by-card-heading">
          <h4>操作卡</h4>
          <span>还剩 {remaining} 次使用机会</span>
        </div>
        <div className="by-cards" aria-label="可消耗的操作卡">
          {config.cards.map((card, i) => (
            <button
              key={i}
              data-binary-card={i}
              disabled={locked || board.remaining[i] === 0}
              className={`${hint?.card === i ? "by-hinted" : ""} ${board.remaining[i] === 0 ? "spent" : ""}`}
              aria-label={`${i + 1}：${binaryCardLabel(config.width, card)}，剩余 ${board.remaining[i]} 次`}
              onClick={() => act(i)}
            >
              <span className="by-card-top">
                <kbd>{i + 1}</kbd>
                <small>
                  {board.remaining[i]
                    ? `剩余 ${board.remaining[i]} 次`
                    : "已用完"}
                </small>
              </span>
              <strong>{binaryCardLabel(config.width, card)}</strong>
              <span className="by-preview">
                执行后{" "}
                <b>
                  {binaryBits(
                    config.width,
                    executeBinaryOp(config.width, board.value, card),
                  )}
                </b>
              </span>
            </button>
          ))}
        </div>
        {remaining === 0 && !won && (
          <p className="by-alert" role="status">
            卡片已用完，目标尚未匹配。撤销或重置，再试另一条路线。
          </p>
        )}
        <div className="by-history" aria-label="执行轨迹">
          <strong>信号轨迹</strong>
          <ol>
            <li>
              <span>出发</span>
              <b>{binaryBits(config.width, config.start)}</b>
            </li>
            {state.history.map((step, i) => (
              <li key={i}>
                <span>
                  {i + 1}.{" "}
                  {binaryCardLabel(config.width, config.cards[step.card])}
                </span>
                <b>
                  {binaryBits(
                    config.width,
                    executeBinaryOp(
                      config.width,
                      step.board.value,
                      config.cards[step.card],
                    ),
                  )}
                </b>
              </li>
            ))}
          </ol>
        </div>
        <p className="by-keyboard">
          点击卡片，或聚焦工作台后按数字 1–8。Tab 移动焦点，Enter /
          空格执行按钮。撤销会归还卡片。
        </p>
      </section>
      <aside className="game-notes by-notes">
        <span className="mini-label">位运算 · 掩码 · 执行顺序</span>
        <h3>只搬信号，不猜数字。</h3>
        <p>{config.lesson}</p>
        <div className="by-rule">
          <strong>边界规则</strong>
          <p>
            宽度始终为 {config.width}{" "}
            位。左移或右移时，移出边界的位丢弃，空出来的位置补
            0；不会循环，也不会补符号位。
          </p>
          <p>非 NOT 只翻转这 {config.width} 位，不会产生额外高位。</p>
        </div>
        <dl className="by-legend">
          <div>
            <dt>与 AND</dt>
            <dd>掩码为 1：保留；为 0：清零</dd>
          </div>
          <div>
            <dt>或 OR</dt>
            <dd>掩码为 1：点亮；为 0：不变</dd>
          </div>
          <div>
            <dt>异或 XOR</dt>
            <dd>掩码为 1：翻转；为 0：不变</dd>
          </div>
        </dl>
        <p className="by-par">
          最短纪录：<b>{config.par} 步</b>。多用几步也能通关。
        </p>
        {hint && (
          <p className="by-hint" role="status">
            {hint.text}
          </p>
        )}
      </aside>
    </div>
  );
}
