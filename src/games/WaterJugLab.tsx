import { useEffect, useRef, useState } from "react";
import { Droplets, ArrowRight, Check, FlaskConical } from "lucide-react";
import type { GameProps } from "../lib/types";
import {
  applyWaterJugMove,
  createWaterJugState,
  solveWaterJug,
  undoWaterJug,
  waterJugLevels,
  waterJugMove,
  waterJugMoveLabel,
  waterJugWon,
  type WaterJugMove,
} from "./waterJugLogic";
import "./transferPlanning.css";

export default function WaterJugLab(props: GameProps) {
  return (
    <WaterJugRound key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function WaterJugRound({
  level,
  paused,
  hintToken,
  undoToken,
  onStatus,
  onComplete,
}: GameProps) {
  const config = waterJugLevels[level] ?? waterJugLevels[0];
  const [state, setState] = useState(() => createWaterJugState(config));
  const current = useRef(state);
  const [selected, setSelected] = useState(0);
  const selectedRef = useRef(0);
  const [hint, setHint] = useState<WaterJugMove | null>(null);
  const [feedback, setFeedback] = useState(
    "先选一只壶，再装满、倒空或倒入另一只壶。让所有壶同时达到目标水量。",
  );
  const callbacks = useRef({ onStatus, onComplete });
  callbacks.current = { onStatus, onComplete };
  const tokens = useRef({ hintToken, undoToken });
  const notified = useRef(false);
  const won = waterJugWon(config, state.volumes);
  useEffect(() => {
    if (!paused) callbacks.current.onStatus(feedback);
  }, [feedback, paused]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      setFeedback(
        `水量刚刚好！用了 ${state.history.length} 步，本关最短 ${config.par} 步。`,
      );
      callbacks.current.onComplete();
    }
  }, [won, paused, state.history.length, config.par]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused) return;
    const route = solveWaterJug(config, current.current.volumes);
    const next = route?.[0];
    if (next) {
      const jug = next.kind === "pour" ? next.from : next.jug;
      selectedRef.current = jug;
      setSelected(jug);
      setHint(next);
      setFeedback(
        `下一步：${waterJugMoveLabel(next)}。从当前水量出发，最少还需 ${route!.length} 步。`,
      );
    } else
      setFeedback(
        route
          ? "每只壶都已经达到精确目标。"
          : "当前水量无法到达目标，请撤销或重来。",
      );
  }, [hintToken, paused, config]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    const previous = current.current;
    const next = undoWaterJug(previous);
    current.current = next;
    setState(next);
    setHint(null);
    setFeedback(
      next === previous
        ? "还没有可以撤销的操作。"
        : "已恢复上一步的所有水量。可以换个办法试试。",
    );
  }, [undoToken, paused]);
  function choose(jug: number) {
    if (paused || waterJugWon(config, current.current.volumes)) return;
    selectedRef.current = jug;
    setSelected(jug);
    setHint(null);
    setFeedback(
      `已选中 ${jug + 1} 号壶：${current.current.volumes[jug]} / ${config.capacities[jug]} 升。请选择操作。`,
    );
  }
  function move(candidate: WaterJugMove) {
    if (paused || waterJugWon(config, current.current.volumes)) return;
    const previous = current.current;
    const next = waterJugMove(previous, config, candidate);
    if (next === previous) {
      setFeedback(
        "水量没有变化：满壶不能再装，空壶不能再倒，也不能倒入满壶。这样不算一步。",
      );
      return;
    }
    current.current = next;
    setState(next);
    setHint(null);
    setFeedback(
      `${waterJugMoveLabel(candidate)}，完成。每次都倒到来源壶空了或目标壶满了，不能中途停止。`,
    );
  }
  const hinted = (candidate: WaterJugMove) =>
    JSON.stringify(hint) === JSON.stringify(candidate) && !paused;
  return (
    <div className="puzzle-layout tp-game water-jug-lab">
      <section className="tp-playfield" aria-label="量水实验室">
        <header className="tp-heading">
          <div>
            <span className="mini-label">WATER JUG LAB · {level + 1} / 12</span>
            <h3>{config.title}</h3>
          </div>
          <FlaskConical aria-hidden="true" size={32} />
        </header>
        <div className="tp-stats">
          <span>
            <b data-jug-moves>{state.history.length}</b> 步
          </span>
          <span>
            最短 <b>{config.par}</b> 步
          </span>
          <span>精确到每一升</span>
        </div>
        <div
          className="tp-jug-board"
          role="group"
          aria-label="量水操作区，数字选壶，F 装满，E 倒空"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.repeat)
              return;
            if (
              /^[1-3]$/.test(event.key) &&
              Number(event.key) <= config.capacities.length
            ) {
              event.preventDefault();
              choose(Number(event.key) - 1);
            }
            if (event.key.toLowerCase() === "f") {
              event.preventDefault();
              move({ kind: "fill", jug: selectedRef.current });
            }
            if (event.key.toLowerCase() === "e") {
              event.preventDefault();
              move({ kind: "empty", jug: selectedRef.current });
            }
          }}
        >
          <div
            className="tp-jugs"
            style={{
              gridTemplateColumns: `repeat(${config.capacities.length}, minmax(0, 1fr))`,
            }}
          >
            {config.capacities.map((capacity, jug) => (
              <button
                type="button"
                key={jug}
                data-jug={jug}
                data-volume={state.volumes[jug]}
                className={`tp-jug ${selected === jug ? "tp-selected" : ""} ${state.volumes[jug] === config.target[jug] ? "tp-matched" : ""}`}
                aria-pressed={selected === jug}
                aria-label={`${jug + 1} 号壶，容量 ${capacity} 升，当前 ${state.volumes[jug]} 升，目标 ${config.target[jug]} 升`}
                disabled={paused || won}
                onClick={() => choose(jug)}
              >
                <span className="tp-jug-name">
                  {jug + 1} 号壶 <small>{capacity} 升</small>
                </span>
                <span className="tp-vessel" aria-hidden="true">
                  <span
                    className="tp-water"
                    style={{
                      height: `${(state.volumes[jug] / capacity) * 100}%`,
                    }}
                  />
                  <span
                    className="tp-target-line"
                    style={{
                      bottom: `calc(${(config.target[jug] / capacity) * 100}% - 1px)`,
                    }}
                  />
                  <span className="tp-volume">
                    {state.volumes[jug]}
                    <small>升</small>
                  </span>
                </span>
                <span className="tp-jug-target">
                  目标 {config.target[jug]} 升{" "}
                  {state.volumes[jug] === config.target[jug] && (
                    <Check size={16} aria-hidden="true" />
                  )}
                </span>
              </button>
            ))}
          </div>
          <div className="tp-action-panel">
            <p>
              <b>{selected + 1} 号壶</b> 已选中 <span>请选择一个操作</span>
            </p>
            <div className="tp-actions">
              {(["fill", "empty"] as const).map((kind) => {
                const action = { kind, jug: selected };
                return (
                  <button
                    type="button"
                    key={kind}
                    data-jug-action={kind}
                    className={hinted(action) ? "tp-hinted" : ""}
                    disabled={
                      paused ||
                      won ||
                      !applyWaterJugMove(config, state.volumes, action)
                    }
                    onClick={() => move(action)}
                  >
                    {kind === "fill" ? (
                      <Droplets size={17} />
                    ) : (
                      <span aria-hidden="true">↧</span>
                    )}
                    {kind === "fill" ? "装满" : "倒空"} {selected + 1} 号壶
                  </button>
                );
              })}
              {config.capacities.map((_, to) => {
                if (to === selected) return null;
                const action: WaterJugMove = {
                  kind: "pour",
                  from: selected,
                  to,
                };
                return (
                  <button
                    type="button"
                    key={to}
                    data-jug-action="pour"
                    data-jug-from={selected}
                    data-jug-to={to}
                    className={hinted(action) ? "tp-hinted" : ""}
                    disabled={
                      paused ||
                      won ||
                      !applyWaterJugMove(config, state.volumes, action)
                    }
                    onClick={() => move(action)}
                  >
                    {selected + 1} 号壶{" "}
                    <ArrowRight size={16} aria-hidden="true" /> {to + 1} 号壶
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <p className={`tp-feedback ${won ? "tp-success" : ""}`} role="status">
          {paused ? "已暂停。水量会留在原处。" : feedback}
        </p>
        {won && (
          <div className="tp-complete" data-jug-complete>
            <Check size={22} />
            水量刚刚好！
          </div>
        )}
      </section>
      <aside className="game-notes tp-notes">
        <span className="mini-label">容量 · 差值 · 顺序规划</span>
        <h3>
          {config.capacities.length === 2 ? "用两只壶，" : "多一个帮手，"}
          <br />
          {config.capacities.length === 2
            ? "量出第三种水量。"
            : "安排三份水量。"}
        </h3>
        <div className="tp-goal">
          <strong>所有目标要同时满足</strong>
          <p>
            {config.target
              .map((amount, i) => `${i + 1} 号壶 ${amount} 升`)
              .join(" · ")}
          </p>
        </div>
        <ol>
          <li>装满：水源无限，每次加到壶的容量。</li>
          <li>倒空：把整壶水倒回回收池。</li>
          <li>
            倒入：倒到来源壶空了或目标壶满了。中途不能停止；转移时水量守恒。
          </li>
        </ol>
        <div className="note">
          <strong>这一关的小发现</strong>
          <p>{config.lesson}</p>
        </div>
        <p className="muted">
          不计时，不限步数。提示会按当前水量重新规划。每个按钮都可用 Tab + Enter
          / 空格操作；在量水操作区也可按 1–3 选壶、F 装满、E 倒空。
        </p>
      </aside>
    </div>
  );
}
