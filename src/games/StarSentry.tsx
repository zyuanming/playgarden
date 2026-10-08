// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { GameProps } from "../lib/types";
import { createStarSentry, emptySentryInput, sentryGuidance, starSentryLevels, startStarSentry, stepStarSentry, toggleSentryAuto, SENTRY_WORLD, type SentryInput, type SentryState } from "./starSentryLogic";
import "./starSentry.css";

type Control = keyof SentryInput;
const keyControl = (key: string): Control | undefined => ({ ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right", " ": "fire", ArrowUp: "fire", w: "fire" } as Record<string, Control>)[key.length === 1 ? key.toLowerCase() : key];

export default function StarSentry({ level, paused, resetToken, hintToken, undoToken, onStatus, onComplete }: GameProps) {
  const [state, setState] = useState(() => createStarSentry(level));
  const live = useRef(state);
  const [localPause, setLocalPause] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [held, setHeld] = useState(emptySentryInput);
  const input = useRef(emptySentryInput());
  const keys = useRef(new Map<string, Control>());
  const pointers = useRef(new Map<number, { control: Control; target: HTMLButtonElement }>());
  const arena = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const completed = useRef(false);
  const generation = useRef(0);
  const hintSeen = useRef(hintToken), undoSeen = useRef(undoToken);
  const frozen = paused || hidden || localPause;
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;
  const stage = starSentryLevels[state.level];
  const terminal = state.phase === "won" || state.phase === "lost";

  function commit(next: SentryState) { live.current = next; setState(next); }
  function syncInput() {
    const next = emptySentryInput();
    for (const value of keys.current.values()) next[value] = true;
    for (const { control } of pointers.current.values()) next[control] = true;
    input.current = next; setHeld(next);
  }
  function clearInput(publish = true) {
    keys.current.clear();
    const captures = [...pointers.current.entries()];
    pointers.current.clear();
    input.current = emptySentryInput();
    for (const [id, { target }] of captures) if (target.hasPointerCapture(id)) target.releasePointerCapture(id);
    if (publish) setHeld(emptySentryInput());
  }
  function suspend() {
    frozenRef.current = true;
    clearInput();
    if (live.current.autoFire) commit({ ...live.current, autoFire: false });
    setLocalPause(true);
  }
  useLayoutEffect(() => {
    generation.current++;
    clearInput(); completed.current = false;
    setLocalPause(false); setHidden(document.hidden);
    const next = createStarSentry(level);
    commit(next); callbacks.current.onStatus(sentryGuidance(next));
  }, [level, resetToken]);
  useLayoutEffect(() => {
    if (!frozen) return;
    clearInput();
    if (live.current.autoFire) commit({ ...live.current, autoFire: false });
  }, [frozen]);
  useEffect(() => {
    const visibility = () => { setHidden(document.hidden); if (document.hidden) suspend(); };
    const blur = () => suspend();
    const keyup = (event: globalThis.KeyboardEvent) => { if (keys.current.delete(event.code || event.key)) syncInput(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    window.addEventListener("pagehide", blur);
    window.addEventListener("keyup", keyup);
    return () => {
      generation.current++; clearInput(false);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pagehide", blur);
      window.removeEventListener("keyup", keyup);
    };
  }, []);
  useEffect(() => {
    if (frozen || state.phase !== "playing") return;
    let frame = 0, last: number | undefined, active = true;
    const ownGeneration = generation.current;
    const tick = (now: number) => {
      if (!active || ownGeneration !== generation.current || frozenRef.current || document.hidden || live.current.phase !== "playing") return;
      if (last !== undefined) commit(stepStarSentry(live.current, input.current, Math.min(0.05, (now - last) / 1000)));
      last = now;
      if (live.current.phase === "playing") frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(frame); };
  }, [frozen, state.phase, level, resetToken]);
  useEffect(() => {
    if (state.phase === "won" || state.phase === "lost") {
      clearInput(); callbacks.current.onStatus(state.reason);
    }
    if (state.phase === "won" && !completed.current) { completed.current = true; callbacks.current.onComplete(); }
  }, [state.phase]);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (live.current.phase !== "won") callbacks.current.onStatus(sentryGuidance(live.current));
  }, [hintToken]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (live.current.phase !== "won") callbacks.current.onStatus("实时守望不能撤销。随时暂停思考，也可以重来，无限次尝试。");
  }, [undoToken]);
  function focusArena() {
    arena.current?.focus({ preventScroll: true });
    arena.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }
  function start() {
    if (frozenRef.current || live.current.phase !== "ready") return;
    clearInput(); commit(startStarSentry(live.current));
    callbacks.current.onStatus(stage.lesson); focusArena();
  }
  function retry() {
    if (paused || hidden || live.current.phase === "won") return;
    generation.current++; clearInput(); completed.current = false; setLocalPause(false);
    const next = createStarSentry(level); commit(next); callbacks.current.onStatus(sentryGuidance(next));
  }
  function resume() {
    if (paused || document.hidden) return;
    clearInput(); setLocalPause(false); focusArena();
  }
  function toggleAuto() {
    if (frozenRef.current) return;
    commit(toggleSentryAuto(live.current));
  }
  function keyDown(event: KeyboardEvent, fixed?: Control) {
    if (event.ctrlKey || event.metaKey || event.altKey || frozenRef.current || event.repeat || live.current.phase !== "playing") return;
    const control = fixed && [" ", "Enter"].includes(event.key) ? fixed : !fixed ? keyControl(event.key) : undefined;
    if (!control) return;
    event.preventDefault(); keys.current.set(event.code || event.key, control); syncInput();
  }
  function keyUp(event: KeyboardEvent) {
    if (keys.current.delete(event.code || event.key)) { event.preventDefault(); syncInput(); }
  }
  function pointerDown(event: PointerEvent<HTMLButtonElement>, control: Control) {
    if (frozenRef.current || live.current.phase !== "playing" || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { control, target: event.currentTarget }); syncInput();
  }
  function pointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    syncInput();
  }
  function controlButton(control: Control, label: string, glyph: string, key: string) {
    return <button type="button" className={`sentry-hold sentry-${control}`} aria-label={label} aria-pressed={held[control] && !frozen}
      data-sentry-control={control} disabled={frozen || state.phase !== "playing"}
      onPointerDown={event => pointerDown(event, control)} onPointerUp={pointerUp} onPointerCancel={pointerUp} onLostPointerCapture={pointerUp}
      onKeyDown={event => keyDown(event, control)} onKeyUp={keyUp} onBlur={() => { keys.current.clear(); syncInput(); }}
      onContextMenu={event => event.preventDefault()}>
      <span aria-hidden="true">{glyph}</span><b>{label}</b><small>{key}</small>
    </button>;
  }

  return <section className="star-sentry" data-sentry-phase={state.phase} data-sentry-won={state.phase === "won"} data-sentry-frozen={frozen}
    data-sentry-x={state.x.toFixed(3)} data-sentry-time={state.elapsed.toFixed(3)} data-sentry-shields={state.shields}
    data-sentry-auto={state.autoFire} data-sentry-fired={state.fired} data-sentry-hits={state.hits} data-sentry-remaining={state.robots.length}
    data-sentry-left={held.left && !frozen} data-sentry-right={held.right && !frozen} data-sentry-fire={held.fire && !frozen}>
    <header className="sentry-heading"><div><span>THE QUIET ORBIT</span><h2>{stage.name}</h2></div><p>{stage.lesson}</p></header>
    <div className="sentry-hud" aria-label="守望状态">
      <div><span>飞船护盾</span><strong aria-label={`剩余 ${state.shields} 格，共 3 格`}>{"◆".repeat(state.shields)}<i>{"◇".repeat(3 - state.shields)}</i></strong></div>
      <div><span>剩余机器人</span><strong>{state.robots.length}<small> 台</small></strong></div>
      <div><span>守望节奏</span><strong className="sentry-pace">{frozen ? "已暂停" : state.phase === "ready" ? "准备中" : terminal ? "本轮结束" : "慢慢来"}</strong></div>
    </div>
    <div className="sentry-cockpit">
      <div className="sentry-arena" ref={arena} tabIndex={0} role="group" aria-label="星门守望游戏区。左右方向键或 A、D 横移，空格或上方向键发射。"
        onKeyDown={event => keyDown(event)} onKeyUp={keyUp} onBlur={() => { keys.current.clear(); syncInput(); }}>
        <svg viewBox="0 0 600 440" role="img" aria-label={`飞船在横向 ${Math.round(state.x / 6)}% 处，剩余 ${state.robots.length} 台机器人和 ${state.shields} 格护盾。浅蓝色掩体阻挡双方子弹，橙色圈表示即将反击。`}>
          <rect width="600" height="440" rx="18" fill="#102b3c" />
          <path d="M 53 259 Q 300 -34 547 259" fill="none" stroke="#33566a" strokeWidth="20" opacity=".4" />
          <path d="M 53 259 Q 300 -34 547 259" fill="none" stroke="#789b9d" strokeWidth="2" strokeDasharray="4 18" opacity=".55" />
          <g fill="#9ebcc5">{[[35, 52], [112, 40], [195, 26], [288, 39], [402, 23], [493, 49], [565, 82], [42, 186], [561, 252], [118, 254], [463, 222], [80, 346], [535, 353]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2 : 1} />)}</g>
          <circle cx="510" cy="58" r="18" fill="#778f83" /><path d="M 505 41 A 18 18 0 0 0 510 76 A 18 18 0 0 1 505 41" fill="#b6c5a0" />
          <path d="M 22 357 H 578" stroke="#617e88" strokeDasharray="4 10" opacity=".65" />
          <text x="24" y="430" fill="#bcd3d6" fontSize="13">横移轨道</text><text x="576" y="430" textAnchor="end" fill="#bcd3d6" fontSize="13">← 留出躲避空间 →</text>
          {state.shelters.map(shelter => <g key={shelter.id} data-sentry-shelter={shelter.id} data-hp={shelter.hp} transform={`translate(${shelter.x} ${shelter.y})`}>
            {shelter.hp > 0 ? <><path d={`M ${-shelter.width / 2} 10 V -2 L ${-shelter.width / 2 + 12} -12 H ${shelter.width / 2 - 12} L ${shelter.width / 2} -2 V 10 Z`} fill="#559395" stroke="#b4e1d6" strokeWidth="2" />
              {Array.from({ length: shelter.maxHp }, (_, i) => <rect key={i} x={-shelter.maxHp * 5 + i * 10 + 1} y="-3" width="7" height="6" rx="1" fill={i < shelter.hp ? "#e5f5d9" : "#2f535c"} />)}</>
              : <path d={`M ${-shelter.width / 2} 10 H ${shelter.width / 2}`} stroke="#5e737b" strokeWidth="2" strokeDasharray="3 6" />}
          </g>)}
          {state.robots.map(robot => <g key={robot.id} data-sentry-robot={robot.id} data-x={robot.x.toFixed(2)} data-y={robot.y.toFixed(2)} data-hp={robot.hp} transform={`translate(${robot.x} ${robot.y})`}>
            {state.warnings.some(warning => warning.robotId === robot.id) && <><circle r="29" fill="none" stroke="#ffd1a0" strokeWidth="3" strokeDasharray="5 4" /><path d="M 0 31 V 48 M -4 44 L 0 49 L 4 44" fill="none" stroke="#ffd1a0" strokeWidth="3" /></>}
            <path d="M -19 -8 L -11 -17 H 11 L 19 -8 V 12 L 10 18 H -10 L -19 12 Z" fill={robot.hp > 1 ? "#d0b48e" : "#8cb7bb"} stroke="#e1f1e6" strokeWidth="2" />
            <path d="M -24 -4 H -19 M 19 -4 H 24 M -11 18 V 23 M 11 18 V 23" stroke="#c5e0d7" strokeWidth="4" />
            <rect x="-13" y="-7" width="26" height="12" rx="5" fill="#16374a" /><circle cx="-6" cy="-1" r="2.5" fill="#f5e8af" /><circle cx="6" cy="-1" r="2.5" fill="#f5e8af" />
            {Array.from({ length: robot.hp }, (_, i) => <circle key={i} cx={robot.hp === 1 ? 0 : i * 9 - 4.5} cy="11" r="2.6" fill="#203c47" />)}
          </g>)}
          {state.shots.map(shot => <g key={shot.id} data-sentry-shot={shot.side} data-x={shot.x.toFixed(2)} data-y={shot.y.toFixed(2)}>
            {shot.side === "ship" ? <rect x={shot.x - 4} y={shot.y - 10} width="8" height="19" rx="4" fill="#edffc7" /> : <path d={`M ${shot.x} ${shot.y + 9} L ${shot.x - 6} ${shot.y - 3} Q ${shot.x} ${shot.y - 12} ${shot.x + 6} ${shot.y - 3} Z`} fill="#ffbf90" stroke="#fff0db" strokeWidth="1.5" />}
          </g>)}
          <g transform={`translate(${state.x} ${SENTRY_WORLD.shipY})`} data-sentry-ship="true">
            {state.invulnerable > 0 && <ellipse rx="29" ry="29" fill="#d5eff011" stroke="#e6f6d5" strokeWidth="2" strokeDasharray="4 5" />}
            <path d="M 0 -24 L 10 -6 L 21 10 V 17 L 0 9 L -21 17 V 10 L -10 -6 Z" fill={state.phase === "lost" ? "#a49b8d" : "#f1e7b5"} stroke="#fff5ce" strokeWidth="2" />
            <path d="M 0 -12 L 6 3 H -6 Z" fill="#347485" /><path d="M -5 14 H 5 L 0 23 Z" fill="#87c5c7" />
          </g>
        </svg>
        {(state.phase !== "playing" || localPause || hidden) && <div className="sentry-message" role="status">
          <strong>{state.phase === "won" ? "归途，一路明亮" : state.phase === "lost" ? "休整一下，再出发" : localPause || hidden ? "已安全暂停" : "准备守望星门"}</strong>
          <span>{terminal ? state.reason : localPause || hidden ? "时间已冻结，横移和自动射击都已松开。" : "左右横移，向上发射。清空机器人即过关。"}</span>
          {state.phase === "ready" && !localPause && !hidden && <button type="button" className="sentry-action" onClick={start} disabled={paused}>开始守望</button>}
          {state.phase === "lost" && <button type="button" className="sentry-action" onClick={retry} disabled={paused || hidden}>重新尝试</button>}
          {(localPause || hidden) && !terminal && <button type="button" className="sentry-action" onClick={resume} disabled={paused || hidden}>继续守望</button>}
        </div>}
      </div>
      <div className="sentry-console">
        <div className="sentry-controls" role="group" aria-label="按住操作，松开即停">
          {controlButton("left", "向左移动", "←", "A / ←")}
          {controlButton("fire", "发射光束", "↑", "空格 / ↑")}
          {controlButton("right", "向右移动", "→", "D / →")}
        </div>
        <div className="sentry-actions">
          <button type="button" className="sentry-auto" aria-pressed={state.autoFire} disabled={frozen || state.phase !== "playing"} onClick={toggleAuto}>{state.autoFire ? "关闭自动射击" : "开启自动射击"}</button>
          <button type="button" disabled={paused || hidden || state.phase !== "playing"} onClick={localPause ? resume : suspend}>{localPause ? "恢复守望" : "暂停守望"}</button>
        </div>
        <p className="sentry-tip">手机上可开启自动射击，再用两侧按钮横移。橙色是反击，浅蓝掩体会挡住双方的弹道。</p>
      </div>
    </div>
    <p className="sentry-save-note">12 个有限关卡 · 无倒计时 · 无限重试。已完成关卡与所选关卡保存在本机；本轮飞行不保存，重新进入会安全地从准备状态开始。</p>
  </section>;
}
