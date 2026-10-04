// SPDX-License-Identifier: MIT
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { GameProps } from "../lib/types";
import { rhythmEchoLevels } from "./rhythmEchoLevels";
import {
  RHYTHM_UNIT_MS,
  beginRhythm,
  changeRhythmMode,
  createRhythmState,
  enterRhythm,
  replayRhythm,
  rhythmHint,
  rhythmIntervalLabels,
  rhythmIntervalMatches,
  rhythmTarget,
  rhythmToleranceMs,
  rhythmTransformLabels,
  undoRhythm,
  type RhythmInterval,
  type RhythmState,
} from "./rhythmEchoLogic";
import "./rhythmEcho.css";

function IntervalGlyph({ value }: { value: RhythmInterval }) {
  return (
    <span className="re-glyph" aria-hidden="true">
      <i />
      {Array.from({ length: value }, (_, i) => (
        <span key={i} />
      ))}
      <i />
    </span>
  );
}
export default function RhythmEcho(props: GameProps) {
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
      className="rhythm-echo-host"
      data-rhythm-echo-host
      tabIndex={-1}
      aria-label="节奏回声工作区"
    >
      <RhythmEchoRound
        key={`${props.level}:${props.resetToken}`}
        {...props}
        host={host}
        focusedControl={focusedControl}
      />
    </div>
  );
}
function RhythmEchoRound({
  level,
  paused,
  hintToken,
  undoToken,
  onStatus,
  onComplete,
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
  const config = rhythmEchoLevels[level] ?? rhythmEchoLevels[0];
  const [state, setState] = useState(createRhythmState);
  const [pageHidden, setPageHidden] = useState(
    () => document.visibilityState === "hidden",
  );
  const suspended = paused || pageHidden;
  const [hint, setHint] = useState<ReturnType<typeof rhythmHint> | null>(null);
  const [playback, setPlayback] = useState<{
    run: number;
    index: number;
  } | null>(null);
  const [armed, setArmed] = useState(false);
  const anchor = useRef<number | null>(null),
    run = useRef(0);
  const clock = useRef({ key: "", remaining: 0 });
  const tokens = useRef({ hintToken, undoToken }),
    notified = useRef(false);
  const callbacks = useRef({ onStatus, onComplete });
  callbacks.current = { onStatus, onComplete };
  const target = rhythmTarget(config),
    won = state.phase === "complete",
    locked = suspended || won;
  const full = state.entered.length === target.length;
  const showing = !suspended && (state.phase === "observe" || won);
  const message = suspended
    ? "已暂停。视觉演示会停在这里；现场敲击的未完成间隔已取消。"
    : won
      ? "回声吻合！间隔和顺序都完成了，两种模式获得相同通关。"
      : state.phase === "observe"
        ? "观察完整乐句，也可以播放无声的视觉节拍。准备好后藏起乐句。"
        : full
          ? "还有间隔需要调整。撤销最后一项，或再看乐句后继续。"
          : state.mode === "tokens"
            ? `选择第 ${state.entered.length + 1} 个间隔。任务卡一直可看，完全不计时。`
            : armed
              ? `下一次敲击会记录第 ${state.entered.length + 1} 个间隔。`
              : "先点一次大圆鼓，作为下一个间隔的起点；然后按记住的距离再次点它。";
  useEffect(() => {
    const visibilityChanged = () =>
      setPageHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", visibilityChanged);
    return () =>
      document.removeEventListener("visibilitychange", visibilityChanged);
  }, []);
  useEffect(() => {
    callbacks.current.onStatus(message);
  }, [message]);
  useEffect(() => {
    if (won && !suspended && !notified.current) {
      notified.current = true;
      callbacks.current.onComplete();
    }
  }, [won, suspended]);
  useEffect(() => {
    if (suspended) {
      anchor.current = null;
      setArmed(false);
    }
  }, [suspended]);
  // Exactly one bounded timeout. Pause or a hidden tab retains its remaining duration; every
  // stop, phase change, reset, level change, and unmount cancels stale callbacks.
  useEffect(() => {
    if (!playback || state.phase !== "observe" || won) {
      clock.current = { key: "", remaining: 0 };
      return;
    }
    const key = `${playback.run}:${playback.index}`;
    if (clock.current.key !== key)
      clock.current = {
        key,
        remaining:
          playback.index < target.length
            ? target[playback.index] * RHYTHM_UNIT_MS
            : 650,
      };
    if (suspended) return;
    const started = performance.now();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      clock.current.remaining = 0;
      setPlayback((current) =>
        !current ||
        current.run !== playback.run ||
        current.index !== playback.index
          ? current
          : current.index >= target.length
            ? null
            : { ...current, index: current.index + 1 },
      );
    }, clock.current.remaining);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (clock.current.key === key)
        clock.current.remaining = Math.max(
          0,
          clock.current.remaining - (performance.now() - started),
        );
    };
  }, [playback, suspended, state.phase, won, config]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked) return;
    const next = rhythmHint(config, state);
    setHint(next);
    callbacks.current.onStatus(next.text);
  }, [hintToken, locked, config, state]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    anchor.current = null;
    setArmed(false);
    setHint(null);
    setState((current) => undoRhythm(current));
    callbacks.current.onStatus(
      state.entered.length
        ? "已撤销最后一个间隔。现场模式下一次敲击将重新定起点。"
        : "还没有已完成的间隔可以撤销。现场模式的起点已取消。",
    );
  }, [undoToken, locked, state.entered.length]);
  function chooseMode(mode: RhythmState["mode"]) {
    if (locked || state.mode === mode) return;
    anchor.current = null;
    setArmed(false);
    setHint(null);
    setState((current) => changeRhythmMode(current, mode));
  }
  function tap() {
    if (locked || state.phase !== "recall" || state.mode !== "live" || full)
      return;
    const now = performance.now();
    if (anchor.current === null) {
      anchor.current = now;
      setArmed(true);
      return;
    }
    const gap = Math.max(0, now - anchor.current);
    const next = enterRhythm(config, state, gap);
    anchor.current = next.entered.length === target.length ? null : now;
    setArmed(anchor.current !== null);
    setState(next);
    setHint(null);
  }
  return (
    <div
      className="puzzle-layout rhythm-echo"
      data-rhythm-echo-game
      data-rhythm-echo-phase={state.phase}
      data-rhythm-echo-mode={state.mode}
      data-rhythm-echo-won={won}
      data-rhythm-echo-entered={state.entered.join(",")}
      data-rhythm-echo-playhead={playback?.index ?? "idle"}
    >
      <section className="re-field" aria-label="节奏回声工作台">
        <header className="re-heading">
          <div>
            <span className="mini-label">
              节奏回声 · {String(level + 1).padStart(2, "0")} / 12
            </span>
            <h3>{config.title}</h3>
          </div>
          <span className="re-emblem" aria-hidden="true">
            ◌
          </span>
        </header>
        <div className="re-stats">
          <span>
            <b>{target.length}</b> 个间隔
          </span>
          <span>
            <b>{state.entered.length}</b> 个已录
          </span>
          <strong>
            {suspended ? "已暂停" : won ? "✓ 已完成" : "无声也能玩"}
          </strong>
        </div>
        <p className="re-instruction" role="status">
          {message}
        </p>
        <section className="re-score" aria-label="完整乐句观察区">
          <div className="re-score-label">
            <b>
              {showing ? "完整乐句" : suspended ? "演示已暂停" : "乐句已藏起"}
            </b>
            <span>
              {showing ? "● 敲击 · 连线格数是间隔" : "忘了可以随时再看"}
            </span>
          </div>
          <div className="re-phrase">
            {showing ? (
              target.map((interval, i) => (
                <div
                  key={i}
                  data-rhythm-echo-score={i}
                  data-rhythm-echo-interval={interval}
                  className={`re-interval ${playback?.index === i ? "re-current" : ""}`}
                >
                  <small>间隔 {i + 1}</small>
                  <IntervalGlyph value={interval} />
                  <b>{rhythmIntervalLabels[interval]}</b>
                </div>
              ))
            ) : (
              <div className="re-hidden-score" aria-hidden="true">
                <span>●</span>
                <i />
                <span>?</span>
                <i />
                <span>●</span>
              </div>
            )}
          </div>
          <div className="re-playhead" aria-live="polite">
            {suspended
              ? "暂停期间不会继续走拍。"
              : playback
                ? playback.index === target.length
                  ? `第 ${target.length + 1} 次敲击 · 乐句结束`
                  : `● 第 ${playback.index + 1} 次敲击 · 接下来等待 ${target[playback.index]} 格`
                : showing
                  ? "静态乐句可一直观察；视觉播放是可选的。"
                  : "任务卡的规则仍然可看，没有隐藏规则。"}
          </div>
          <button
            type="button"
            className="re-play-button"
            data-rhythm-echo-play
            disabled={locked || state.phase !== "observe"}
            onClick={() =>
              setPlayback((current) =>
                current ? null : { run: ++run.current, index: 0 },
              )
            }
          >
            {playback ? "停止演示" : "播放视觉节拍"}
          </button>
        </section>
        <div className="re-actions">
          <button
            type="button"
            data-rhythm-echo-ready
            disabled={locked || state.phase !== "observe"}
            onClick={() => {
              setPlayback(null);
              anchor.current = null;
              setArmed(false);
              setHint(null);
              setState((current) => beginRhythm(current));
            }}
          >
            藏起乐句，开始回应
          </button>
          <button
            type="button"
            data-rhythm-echo-replay
            disabled={locked || state.phase !== "recall"}
            onClick={() => {
              setPlayback(null);
              anchor.current = null;
              setArmed(false);
              setHint(null);
              setState((current) => replayRhythm(current));
            }}
          >
            再看乐句
          </button>
        </div>
        <div className="re-mode" role="group" aria-label="回应方式">
          <button
            type="button"
            data-rhythm-echo-mode-button="tokens"
            aria-pressed={state.mode === "tokens"}
            disabled={locked}
            onClick={() => chooseMode("tokens")}
          >
            间隔卡 · 不计时
          </button>
          <button
            type="button"
            data-rhythm-echo-mode-button="live"
            aria-pressed={state.mode === "live"}
            disabled={locked}
            onClick={() => chooseMode("live")}
          >
            现场敲击 · 可选
          </button>
        </div>
        <p className="re-mode-note">
          两种方式同样通关。切换方式会清空当前回应；“再看乐句”会保留已录间隔。
        </p>
        <div
          className="re-token-panel"
          hidden={state.mode !== "tokens"}
          aria-label="不计时的间隔卡"
        >
          {([1, 2, 3] as const).map((interval) => (
            <button
              type="button"
              key={interval}
              data-rhythm-echo-token={interval}
              aria-label={`选择${rhythmIntervalLabels[interval]}`}
              className={hint?.interval === interval ? "re-hinted" : ""}
              disabled={locked || state.phase !== "recall" || full}
              onClick={(event) => {
                if (event.ctrlKey || event.metaKey || event.altKey) return;
                setState((current) => enterRhythm(config, current, interval));
                setHint(null);
              }}
            >
              <IntervalGlyph value={interval} />
              <b>{rhythmIntervalLabels[interval]}</b>
              <small>按一次，记录一个间隔</small>
            </button>
          ))}
        </div>
        <div className="re-live-panel" hidden={state.mode !== "live"}>
          <button
            type="button"
            className={`re-drum ${armed ? "re-armed" : ""}`}
            data-rhythm-echo-tap
            aria-label={armed ? "敲击并记录下一个间隔" : "敲击，设定间隔起点"}
            disabled={locked || state.phase !== "recall" || full}
            onKeyDown={(event) => {
              if (event.ctrlKey || event.metaKey || event.altKey) return;
              if (event.repeat && (event.key === " " || event.key === "Enter"))
                event.preventDefault();
            }}
            onClick={(event) => {
              if (!event.ctrlKey && !event.metaKey && !event.altKey) tap();
            }}
          >
            <span aria-hidden="true">●</span>
            <b>{armed ? "再敲一下" : "点一下开始"}</b>
            <small>Enter / 空格 / 触屏</small>
          </button>
          <p>
            1 格 = 1 秒。短间隔允许 ±0.45 秒，中间隔 ±0.70 秒，长间隔 ±1.05
            秒。暂停、切到其他页面、撤销或再看后，下一次敲击重新定起点。无需开启声音。
          </p>
        </div>
        <div className="re-answer" aria-label="已记录的回应">
          <strong>我的回应</strong>
          <ol>
            {state.entered.map((value, i) => (
              <li
                key={i}
                className={
                  full && !rhythmIntervalMatches(target[i], value, state.mode)
                    ? "re-wrong"
                    : ""
                }
              >
                <small>{i + 1}</small>
                <b>
                  {state.mode === "tokens"
                    ? `${value} 格`
                    : `${(value / 1000).toFixed(2)} 秒`}
                </b>
                {full && (
                  <span>
                    {rhythmIntervalMatches(target[i], value, state.mode)
                      ? "✓"
                      : "×"}
                  </span>
                )}
              </li>
            ))}
          </ol>
          {!state.entered.length && <p>准备好后，记录你的第一个间隔。</p>}
        </div>
        {hint && !suspended && (
          <p className="re-hint" role="status">
            ✦ {hint.text}
          </p>
        )}
      </section>
      <aside className="game-notes re-guide">
        <span className="mini-label">节奏 · 模式 · 变换</span>
        <h3>
          长短之间，
          <br />
          藏着小规律。
        </h3>
        <p>{config.lesson}</p>
        <section className="re-task" aria-label="公开的乐句规则">
          <h4>任务卡 · 一直可看</h4>
          <p>原始小节</p>
          <div className="re-motif">
            {config.motif.map((interval, i) => (
              <span key={i}>
                <IntervalGlyph value={interval} />
                <b>{rhythmIntervalLabels[interval]}</b>
              </span>
            ))}
          </div>
          <ol>
            {config.parts.map((part, i) => (
              <li key={i}>
                <b>{rhythmTransformLabels[part.transform]}</b>
                <span> × {part.repeat} 遍</span>
              </li>
            ))}
          </ol>
          <p>从上到下拼接；每条变换都从原始小节重新出发。</p>
        </section>
        <details open={level === 0}>
          <summary>第一次玩：怎样读节奏？</summary>
          <p>
            两次圆点敲击之间，连线有几格，就选择几格的间隔卡。例：短、长表示先等
            1 格敲一下，再等 3 格敲一下；总共需要三个敲击点。
          </p>
          <p>
            “倒序”把原始小节反过来；“首项移到末尾”保持其余顺序；“每项加 1
            格”只加长，不改变顺序。
          </p>
        </details>
        <div className="re-note">
          <strong>让思考决定节奏。</strong>
          <p>
            默认间隔卡完全不计时，与现场敲击获得相同完成结果。不会播放音频，也没有必须追赶的倒计时。
          </p>
          <p>
            提示指出下一项或首个需调整的间隔。撤销退回最后一个间隔；重置从观察开始。
          </p>
        </div>
        <p className="re-keyboard">
          键盘：Tab 选择，Enter / 空格确认。不使用全局快捷键，不拦截 Ctrl、⌘ 或
          Alt 组合键。
        </p>
        <span className="re-tolerance-detail">
          现场容差：
          {([1, 2, 3] as const)
            .map((value) => `${value} 格 ±${rhythmToleranceMs(value)} ms`)
            .join(" · ")}
        </span>
      </aside>
    </div>
  );
}
