// SPDX-License-Identifier: MIT
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { GameProps } from "../lib/types";
import { memoryRoutesLevels } from "./memoryRoutesLevels";
import {
  beginMemoryRoute,
  createMemoryRouteState,
  enterMemoryRoute,
  memoryRouteHint,
  memoryRouteTarget,
  replayMemoryRoute,
  routeAddress,
  undoMemoryRoute,
} from "./memoryRoutesLogic";
import "./memoryRoutes.css";

export default function MemoryRoutes(props: GameProps) {
  const host = useRef<HTMLDivElement>(null);
  const focusedControl = useRef<HTMLElement | null>(null);
  return (
    <div
      ref={host}
      onFocusCapture={(event) => {
        focusedControl.current =
          event.target === host.current ? null : (event.target as HTMLElement);
      }}
      onBlurCapture={(event) => {
        const control = event.target as HTMLElement;
        // A real move to another control is never a reason to restore focus.
        // A null-target blur caused by disabling/hiding is repaired after commit.
        if (
          event.relatedTarget ||
          (!control.matches(":disabled") && !control.closest("[hidden]"))
        )
          focusedControl.current = null;
      }}
      className="memory-routes-host"
      data-memory-routes-host
      tabIndex={-1}
      aria-label="路线记忆工作区"
    >
      <MemoryRoutesRound
        key={`${props.level}:${props.resetToken}`}
        {...props}
        host={host}
        focusedControl={focusedControl}
      />
    </div>
  );
}
function MemoryRoutesRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
  host,
  focusedControl,
}: GameProps & {
  host: RefObject<HTMLDivElement | null>;
  focusedControl: RefObject<HTMLElement | null>;
}) {
  // Browsers differ on whether disabling a focused button leaves focus on it
  // or drops it to body. Remember only the currently focused internal control.
  useLayoutEffect(() => {
    const control = focusedControl.current,
      container = host.current;
    if (
      control &&
      container?.contains(control) &&
      (control.matches(":disabled") || control.closest("[hidden]")) &&
      (document.activeElement === control ||
        document.activeElement === document.body)
    ) {
      focusedControl.current = null;
      container.focus({ preventScroll: true });
    }
  });
  // A keyed round is about to disappear. Move only its own internal focus
  // to the stable host, without scrolling or moving focus off Shell controls.
  useLayoutEffect(
    () => () => {
      const container = host.current;
      if (
        container &&
        document.activeElement !== container &&
        container.contains(document.activeElement)
      ) {
        container.focus({ preventScroll: true });
      }
    },
    [host],
  );
  const config = memoryRoutesLevels[level] ?? memoryRoutesLevels[0];
  const [state, setState] = useState(createMemoryRouteState);
  const [hint, setHint] = useState<ReturnType<typeof memoryRouteHint> | null>(
    null,
  );
  const tokens = useRef({ hintToken, undoToken });
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const notified = useRef(false);
  const target = memoryRouteTarget(config);
  const won = state.phase === "complete",
    locked = paused || won;
  const showing = !paused && (state.phase === "observe" || won);
  const full = state.entered.length === target.length;
  const message = paused
    ? "已暂停。路线收起，回来后从这里继续。"
    : won
      ? "路线完整重现！每一次转弯和回访都找到了。"
      : state.phase === "observe"
        ? "慢慢观察站号和路线。准备好后点“藏起路线，开始回忆”。"
        : full
          ? "还有站点需要调整。撤销可以逐站退回，也可以再看路线。"
          : `请依次点出第 ${state.entered.length + 1} 站。每个格子可以重复经过，没有时间限制。`;
  useEffect(() => {
    callbacks.current.onStatus(message);
  }, [message]);
  useEffect(() => {
    if (!paused && won && !notified.current) {
      notified.current = true;
      callbacks.current.onComplete();
    }
  }, [won, paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked) return;
    const next = memoryRouteHint(config, state);
    setHint(next);
    callbacks.current.onStatus(next.text);
  }, [hintToken, locked, config, state]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    setState((current) => undoMemoryRoute(current));
    setHint(null);
    callbacks.current.onStatus(
      state.entered.length
        ? "已撤销最后一站。可以继续回忆，或再看路线。"
        : "还没有站点可以撤销。先观察，再开始回忆。",
    );
  }, [undoToken, locked, state.entered.length]);
  function enter(cell: number) {
    if (locked) return;
    setState((current) => enterMemoryRoute(config, current, cell));
    setHint(null);
  }
  return (
    <div
      className="puzzle-layout memory-routes"
      data-memory-routes-game
      data-memory-routes-phase={state.phase}
      data-memory-routes-won={won}
      data-memory-routes-entered={state.entered.join(",")}
    >
      <section className="mr-field" aria-label="路线记忆花园">
        <header className="mr-heading">
          <div>
            <span className="mini-label">
              路线记忆 · {String(level + 1).padStart(2, "0")} / 12
            </span>
            <h3>{config.title}</h3>
          </div>
          <span className="mr-emblem" aria-hidden="true">
            ⌁
          </span>
        </header>
        <div className="mr-stats">
          <span>
            <b>{target.length}</b> 站路线
          </span>
          <span>
            <b>{state.entered.length}</b> 站已记
          </span>
          <strong>
            {paused
              ? "已暂停"
              : won
                ? "✓ 已完成"
                : state.phase === "observe"
                  ? "① 观察"
                  : "② 回忆"}
          </strong>
        </div>
        <p className="mr-instruction" role="status">
          {message}
        </p>
        <div className="mr-board-wrap">
          <div
            className="mr-board"
            style={{
              gridTemplateColumns: `repeat(${config.size}, minmax(44px, 1fr))`,
            }}
            aria-label={`${config.size} 行 ${config.size} 列的路线地图`}
          >
            {Array.from({ length: config.size ** 2 }, (_, cell) => {
              const steps = showing
                ? target.flatMap((value, i) => (value === cell ? [i + 1] : []))
                : [];
              const entries = !paused
                ? state.entered.flatMap((value, i) =>
                    value === cell ? [i + 1] : [],
                  )
                : [];
              const suggested = !paused && hint?.cell === cell;
              return (
                <button
                  key={cell}
                  type="button"
                  data-memory-routes-cell={cell}
                  data-memory-routes-steps={steps.join(",")}
                  className={`mr-cell ${steps.length ? "mr-on-route" : ""} ${suggested ? "mr-hinted" : ""} ${!showing && entries.length ? "mr-entered" : ""}`}
                  disabled={locked || state.phase === "observe" || full}
                  aria-label={`${routeAddress(config.size, cell)}，第 ${Math.floor(cell / config.size) + 1} 行第 ${(cell % config.size) + 1} 列${steps.length ? `，路线第 ${steps.join("、")} 站` : ""}${!showing && entries.length ? `，已选为第 ${entries.join("、")} 站` : ""}${suggested ? "，提示位置" : ""}`}
                  onClick={(event) => {
                    if (!event.ctrlKey && !event.metaKey && !event.altKey)
                      enter(cell);
                  }}
                >
                  <span className="mr-address" aria-hidden="true">
                    {routeAddress(config.size, cell)}
                  </span>
                  <span className="mr-station" aria-hidden="true">
                    {steps.length
                      ? steps.join(" · ")
                      : !showing && entries.length
                        ? entries.join(" · ")
                        : "·"}
                  </span>
                  <span className="mr-cell-caption" aria-hidden="true">
                    {paused
                      ? "暂停"
                      : suggested
                        ? "提示"
                        : steps.includes(1)
                          ? "起点"
                          : steps.includes(target.length)
                            ? "终点"
                            : steps.length
                              ? "经过"
                              : !showing && entries.length
                                ? "已选择"
                                : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div
          className="mr-score"
          aria-label={showing ? "展示的完整路线" : "你的回忆路线"}
        >
          <span>
            {paused ? "路线暂时收起" : showing ? "观察路线" : "我的路线"}
          </span>
          <ol>
            {(paused ? [] : showing ? target : state.entered).map((cell, i) => (
              <li
                key={i}
                className={
                  !showing && full && cell !== target[i] ? "mr-wrong" : ""
                }
              >
                <small>{i + 1}</small>
                <b>{routeAddress(config.size, cell)}</b>
                {!showing && full && cell !== target[i] && (
                  <span aria-label="需要调整">×</span>
                )}
              </li>
            ))}
          </ol>
          {!paused && !showing && !state.entered.length && (
            <p>从你记住的起点开始。</p>
          )}
        </div>
        <div className="mr-actions">
          <button
            type="button"
            data-memory-routes-ready
            disabled={locked || state.phase !== "observe"}
            onClick={() => {
              setState((current) => beginMemoryRoute(current));
              setHint(null);
            }}
          >
            藏起路线，开始回忆
          </button>
          <button
            type="button"
            data-memory-routes-replay
            disabled={locked || state.phase !== "recall"}
            onClick={() => {
              setState((current) => replayMemoryRoute(current));
              setHint(null);
            }}
          >
            再看路线
          </button>
        </div>
        {hint && !paused && (
          <p className="mr-hint" role="status">
            ✦ {hint.text}
          </p>
        )}
        <p className="mr-keyboard">
          Tab 选择格子，Enter /
          空格确认。再次经过同一格时，再点一次。无需计时，不扣分。
        </p>
      </section>
      <aside className="game-notes mr-guide">
        <span className="mini-label">观察 · 分段 · 重现</span>
        <h3>
          记住一段
          <br />
          走过的风景。
        </h3>
        <p>{config.lesson}</p>
        <ol>
          <li>
            <b>先看</b> 每个大数字是到访次序；小地址 A1、B2 帮你定位。
          </li>
          <li>
            <b>再藏</b> 由你决定什么时候准备好，不会自动隐藏。
          </li>
          <li>
            <b>重走</b> 按原次序选择所有站点。重复的站也要选。
          </li>
        </ol>
        <div className="mr-note">
          <strong>忘了一点，也没关系。</strong>
          <p>
            “再看路线”随时重播并保留已选站点。提示指出下一站或首个错误站；撤销退回最后一站。重置会从观察重新开始。
          </p>
        </div>
        <p>
          这不是配对游戏：要记住的是地点的先后顺序。路线均为相邻格移动，答案没有隐藏规则。
        </p>
      </aside>
    </div>
  );
}
