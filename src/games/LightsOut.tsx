import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  createLightsOutState,
  lightNeighbors,
  lightsOutLevels,
  lightsOutSolved,
  playLight,
  solveLightsOut,
  undoLight,
} from "./lightsOutLogic";
import "./memoryLogicGames.css";

export default function LightsOut(props: GameProps) {
  return (
    <LightsOutRound key={`${props.level}:${props.resetToken}`} {...props} />
  );
}

function LightsOutRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = lightsOutLevels[level] ?? lightsOutLevels[0];
  const [state, setState] = useState(() => createLightsOutState(config));
  const [hint, setHint] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken });
  const notified = useRef(false);
  const won = lightsOutSolved(state.board);
  const remaining = state.board.filter(Boolean).length;
  const solution = useMemo(
    () => solveLightsOut(state.board, config.size),
    [state.board, config.size],
  );
  const preview =
    hover === null || paused ? [] : lightNeighbors(config.size, hover);

  useEffect(() => {
    if (won) {
      if (!paused && !notified.current) {
        notified.current = true;
        callbacks.current.onStatus(
          `所有灯都关好了！用了 ${state.moves} 步，让花园安静地休息吧。`,
        );
        callbacks.current.onComplete();
      }
    } else {
      callbacks.current.onStatus(
        state.moves
          ? `还有 ${remaining} 盏亮灯。亮灯变暗，暗灯也会变亮，试着一起考虑。`
          : "点击一盏灯，会同时切换它和上下左右的灯。把所有灯关掉就成功！",
      );
    }
  }, [won, paused, state.moves, remaining]);

  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || won) return;
    const next = solution?.[0];
    if (next === undefined) return;
    setHint(next);
    callbacks.current.onStatus(
      `试试第 ${Math.floor(next / config.size) + 1} 行第 ${(next % config.size) + 1} 列的小圆点位置。从当前局面出发，最少还需 ${solution!.length} 步。`,
    );
  }, [hintToken, paused, won, solution, config.size]);

  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    setHint(null);
    setState((current) => undoLight(current));
  }, [undoToken, paused]);

  return (
    <div className="mlg-layout mlg-lights">
      <section className="mlg-playfield" aria-label="熄灯花园">
        <div className="mlg-board-heading">
          <div>
            <span className="mlg-eyebrow">LIGHTS OUT</span>
            <h3>{config.title}</h3>
          </div>
          <span className="mlg-round-badge">
            {String(level + 1).padStart(2, "0")} / 12
          </span>
        </div>
        <div className="mlg-stats" aria-live="polite">
          <span>
            <strong>{remaining}</strong>盏灯亮着
          </span>
          <span>
            <strong>{state.moves}</strong>操作步数
          </span>
          <span className="mlg-pace">
            {paused
              ? "已暂停"
              : won
                ? "晚安，花园"
                : `起点最少 ${config.solution.length} 步`}
          </span>
        </div>
        <div
          className="mlg-lights-grid"
          style={{
            gridTemplateColumns: `repeat(${config.size}, minmax(0, 1fr))`,
          }}
          aria-label={`${config.size} 乘 ${config.size} 灯阵`}
        >
          {state.board.map((on, index) => (
            <button
              key={index}
              type="button"
              className={`mlg-light ${on ? "is-on" : ""} ${preview.includes(index) ? "is-neighbor" : ""} ${hint === index && !paused ? "is-hinted" : ""}`}
              aria-label={`第 ${Math.floor(index / config.size) + 1} 行第 ${(index % config.size) + 1} 列，${on ? "灯亮着" : "灯已关"}，切换相邻灯`}
              aria-pressed={on}
              disabled={paused || won}
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(null)}
              onClick={() => {
                setHint(null);
                setState((current) =>
                  playLight(current, config.size, index, paused),
                );
              }}
            >
              <span className="mlg-bulb" aria-hidden="true">
                <span />
                {on ? "✦" : "·"}
              </span>
              <span className="mlg-light-label" aria-hidden="true">
                {on ? "亮" : "暗"}
              </span>
              {hint === index && !paused && (
                <span className="mlg-hint-dot" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
        <p className="mlg-board-caption">
          一盏灯，一圈变化 · 点同一格两次会恢复原样
        </p>
      </section>
      <aside className="mlg-notes">
        <span className="mlg-eyebrow">逻辑 · 规律 · 推演</span>
        <h3>
          一点一点，
          <br />
          让花园入睡。
        </h3>
        <p>点击一格，它与上下左右的灯会一起切换。亮的变暗，暗的变亮。</p>
        <div
          className="mlg-cross-demo"
          aria-label="点击中心时，中心及上下左右会切换，斜角不受影响"
        >
          {Array.from({ length: 9 }, (_, i) => (
            <span
              key={i}
              className={[1, 3, 4, 5, 7].includes(i) ? "affected" : ""}
              aria-hidden="true"
            >
              {i === 4 ? "↟" : [1, 3, 5, 7].includes(i) ? "·" : ""}
            </span>
          ))}
        </div>
        <div className="mlg-note">
          <strong>每一步都能撤销。</strong>
          <p>
            不用担心把局面弄乱，每一关始终有解。提示会根据你现在的灯阵，标出下一步。
          </p>
        </div>
        <p className="mlg-keyboard">
          键盘：Tab 选择一格，Enter 或空格切换。浅色边框表示会被影响的灯。
        </p>
      </aside>
    </div>
  );
}
