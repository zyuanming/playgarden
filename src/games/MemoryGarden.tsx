import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  createMemoryState,
  flipMemoryCard,
  memoryFaces,
  memoryHint,
  memoryLevels,
  memoryWon,
  settleMemoryTurn,
  undoMemoryTurn,
} from "./memoryLogic";
import "./memoryLogicGames.css";

export default function MemoryGarden(props: GameProps) {
  return <MemoryRound key={`${props.level}:${props.resetToken}`} {...props} />;
}

function MemoryRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = memoryLevels[level] ?? memoryLevels[0];
  const [state, setState] = useState(createMemoryState);
  const [hint, setHint] = useState<number[]>([]);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const notified = useRef(false);
  const tokens = useRef({ hintToken, undoToken });
  const mismatch = state.open.length === 2 ? state.open.join(",") : "";
  const clock = useRef({ key: "", remaining: config.mismatchMs });
  const won = memoryWon(config, state);
  const position = (index: number) =>
    `第 ${Math.floor(index / config.columns) + 1} 行第 ${(index % config.columns) + 1} 列`;

  useEffect(() => {
    if (won) {
      if (!paused && !notified.current) {
        notified.current = true;
        callbacks.current.onStatus(
          `全部找到！用了 ${state.turns} 回合，花园里的 ${config.pairs} 对伙伴都团聚了。`,
        );
        callbacks.current.onComplete();
      }
    } else if (state.open.length === 2) {
      callbacks.current.onStatus(
        "这两张不一样。记住它们的位置，稍后会自动翻回。",
      );
    } else if (state.open.length === 1) {
      callbacks.current.onStatus("记住这个形状，再翻一张找它的伙伴。");
    } else if (state.turns) {
      callbacks.current.onStatus(
        `已找到 ${state.matched.length / 2} / ${config.pairs} 对。慢慢来，没有时间限制。`,
      );
    } else {
      callbacks.current.onStatus(
        "每次翻开两张卡片，找出相同的形状。没有时间限制。",
      );
    }
  }, [state, won, paused, config.pairs]);

  useEffect(() => {
    if (!mismatch) {
      clock.current = { key: "", remaining: config.mismatchMs };
      return;
    }
    if (clock.current.key !== mismatch)
      clock.current = { key: mismatch, remaining: config.mismatchMs };
    if (paused) return;
    const start = performance.now();
    const timer = setTimeout(() => {
      clock.current.remaining = 0;
      setState((current) => settleMemoryTurn(current));
    }, clock.current.remaining);
    return () => {
      clearTimeout(timer);
      clock.current.remaining = Math.max(
        0,
        clock.current.remaining - (performance.now() - start),
      );
    };
  }, [mismatch, paused, config.mismatchMs]);

  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || won) return;
    const pair = memoryHint(config, state);
    setHint(pair);
    callbacks.current.onStatus(
      pair.length
        ? `小提示：${position(pair[0])}和${position(pair[1])}是一对，找找带小圆点的卡片。`
        : "先记住这两张卡片，等它们翻回后再试提示。",
    );
  }, [hintToken, paused, state, won, config]);

  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    setHint([]);
    setState((current) => undoMemoryTurn(current));
  }, [undoToken, paused]);

  return (
    <div className="mlg-layout mlg-memory">
      <section className="mlg-playfield" aria-label="记忆花园">
        <div className="mlg-board-heading">
          <div>
            <span className="mlg-eyebrow">MEMORY GARDEN</span>
            <h3>{config.title}</h3>
          </div>
          <span className="mlg-round-badge">
            {String(level + 1).padStart(2, "0")} / 12
          </span>
        </div>
        <div className="mlg-stats" aria-live="polite">
          <span>
            <strong>
              {state.matched.length / 2}
              <small> / {config.pairs}</small>
            </strong>
            配对成功
          </span>
          <span>
            <strong>{state.turns}</strong>翻牌回合
          </span>
          <span className="mlg-pace">
            {paused ? "已暂停" : won ? "满园花开" : "不赶时间"}
          </span>
        </div>
        <div
          className="mlg-memory-grid"
          style={{
            gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))`,
          }}
          aria-label="记忆卡片"
        >
          {config.cards.map((faceId, index) => {
            const matched = state.matched.includes(index);
            const visible = !paused && (matched || state.open.includes(index));
            const face = memoryFaces[faceId];
            const suggested = !paused && hint.includes(index) && !matched;
            return (
              <button
                key={index}
                type="button"
                className={`mlg-memory-card ${visible ? "is-open" : ""} ${matched && !paused ? "is-matched" : ""} ${suggested ? "is-hinted" : ""}`}
                disabled={
                  paused ||
                  won ||
                  matched ||
                  state.open.length === 2 ||
                  state.open.includes(index)
                }
                aria-label={`${position(index)}，${paused ? "已暂停" : visible ? `${face.name}${matched ? "，已配对" : "，已翻开"}` : "未翻开的卡片"}`}
                aria-pressed={visible}
                onClick={() => {
                  setHint([]);
                  setState((current) =>
                    flipMemoryCard(config, current, index, paused),
                  );
                }}
              >
                {visible ? (
                  <>
                    <span
                      className="mlg-face"
                      style={{ color: face.color }}
                      aria-hidden="true"
                    >
                      {face.symbol}
                    </span>
                    <span className="mlg-face-name" aria-hidden="true">
                      {face.name}
                    </span>
                    {matched && (
                      <span className="mlg-match-mark" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </>
                ) : (
                  <span className="mlg-card-back" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                )}
                {suggested && (
                  <span className="mlg-hint-dot" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
        <p className="mlg-board-caption">
          {paused
            ? "暂停时卡片暂时收起，回来后继续这一回合。"
            : "相同形状是一对 · 不同形状会自动翻回"}
        </p>
      </section>
      <aside className="mlg-notes">
        <span className="mlg-eyebrow">观察 · 记忆 · 发现</span>
        <h3>
          让形状
          <br />
          找到伙伴。
        </h3>
        <p>翻开一张，记住它住在哪里。再翻一张，相同的形状就会留在花园里。</p>
        <ol className="mlg-instructions">
          <li>
            <b>看位置</b>
            <span>用行和列，记住卡片的小住址。</span>
          </li>
          <li>
            <b>记形状</b>
            <span>每种形状有名字，不必只靠颜色。</span>
          </li>
          <li>
            <b>找伙伴</b>
            <span>每多翻一张，都会多知道一点。</span>
          </li>
        </ol>
        <div className="mlg-note">
          <strong>慢慢玩，更有趣。</strong>
          <p>
            提示会点亮一对卡片的位置。撤销可以退回这一整回合，连已经配好的卡片也能恢复。
          </p>
        </div>
        <p className="mlg-keyboard">键盘：Tab 选择卡片，Enter 或空格翻开。</p>
      </aside>
    </div>
  );
}
