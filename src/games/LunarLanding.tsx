// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { GameProps } from "../lib/types";
import { createLunarLanding, emptyLunarInput, lunarGuidance, lunarLandingLevels, lunarWind, LUNAR_WORLD, setLunarThrottle, startLunarLanding, stepLunarLanding, type LunarInput, type LunarState } from "./lunarLandingLogic";
import "./lunarLanding.css";

type Control = keyof LunarInput;
const keyControl = (key: string): Control | undefined => ({ ArrowUp: "engine", " ": "engine", w: "engine", ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right", ArrowDown: "brake", s: "brake" } as Record<string, Control>)[key.length === 1 ? key.toLowerCase() : key];
const number = (n: number) => n.toFixed(1);

export default function LunarLanding({ level, paused, resetToken, hintToken, undoToken, onComplete, onStatus }: GameProps) {
  const [state, setState] = useState(() => createLunarLanding(level));
  const live = useRef(state);
  const [localPause, setLocalPause] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [held, setHeld] = useState(emptyLunarInput);
  const input = useRef(emptyLunarInput());
  const keys = useRef(new Map<string, Control>());
  const pointers = useRef(new Map<number, { control: Control; target: HTMLButtonElement }>());
  const board = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const completed = useRef(false);
  const frozen = paused || localPause || hidden;
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;
  const generation = useRef(0);
  const hintSeen = useRef(hintToken);
  const undoSeen = useRef(undoToken);
  const stage = lunarLandingLevels[state.level];

  function commit(next: LunarState) { live.current = next; setState(next); }
  function syncInput() {
    const next = emptyLunarInput();
    for (const control of keys.current.values()) next[control] = true;
    for (const { control } of pointers.current.values()) next[control] = true;
    input.current = next; setHeld(next);
  }
  function clearInput(publish = true) {
    keys.current.clear();
    const captures = [...pointers.current.entries()];
    pointers.current.clear();
    input.current = emptyLunarInput();
    for (const [id, { target }] of captures) if (target.hasPointerCapture(id)) target.releasePointerCapture(id);
    if (publish) setHeld(emptyLunarInput());
  }
  function suspend() {
    frozenRef.current = true;
    clearInput();
    setLocalPause(true);
  }
  useLayoutEffect(() => {
    generation.current++;
    clearInput();
    completed.current = false;
    setLocalPause(false);
    setHidden(document.hidden);
    const next = createLunarLanding(level);
    commit(next);
    callbacks.current.onStatus(lunarGuidance(next));
  }, [level, resetToken]);
  useLayoutEffect(() => {
    if (frozen) clearInput();
  }, [frozen]);
  useEffect(() => {
    const visibility = () => {
      setHidden(document.hidden);
      if (document.hidden) suspend();
    };
    const blur = () => suspend();
    const pagehide = () => suspend();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    window.addEventListener("pagehide", pagehide);
    return () => {
      generation.current++;
      clearInput(false);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pagehide", pagehide);
    };
  }, []);
  useEffect(() => {
    if (frozen || state.phase !== "flying") return;
    let frame = 0, last: number | undefined;
    const ownGeneration = generation.current;
    let active = true;
    const tick = (now: number) => {
      if (!active || ownGeneration !== generation.current || frozenRef.current || document.hidden || live.current.phase !== "flying") return;
      if (last !== undefined) commit(stepLunarLanding(live.current, input.current, Math.min(0.05, (now - last) / 1000)));
      last = now;
      if (live.current.phase === "flying") frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(frame); };
  }, [frozen, state.phase, level, resetToken]);
  useEffect(() => {
    if (state.phase === "won" || state.phase === "crashed") {
      clearInput();
      callbacks.current.onStatus(state.reason);
    }
    if (state.phase === "won" && !completed.current) {
      completed.current = true;
      callbacks.current.onComplete();
    }
  }, [state.phase]);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (live.current.phase !== "won") callbacks.current.onStatus(lunarGuidance(live.current));
  }, [hintToken]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (live.current.phase !== "won") callbacks.current.onStatus("实时飞行不能撤销。按暂停可以停下来思考，按重来可无限次尝试。");
  }, [undoToken]);

  function start() {
    if (frozenRef.current) return;
    clearInput();
    commit(startLunarLanding(live.current));
    callbacks.current.onStatus(stage.lesson);
    board.current?.focus({ preventScroll: true });
    board.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }
  function retry() {
    if (paused || hidden || live.current.phase === "won") return;
    generation.current++;
    clearInput();
    setLocalPause(false);
    completed.current = false;
    const next = createLunarLanding(level);
    commit(next);
    callbacks.current.onStatus(lunarGuidance(next));
  }
  function resume() {
    if (paused || document.hidden) return;
    clearInput();
    setLocalPause(false);
    board.current?.focus({ preventScroll: true });
    board.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }
  function throttle(value: number) {
    if (frozenRef.current) return;
    commit(setLunarThrottle(live.current, value));
  }
  function keyDown(event: KeyboardEvent, fixedControl?: Control) {
    if (event.ctrlKey || event.metaKey || event.altKey || frozenRef.current || event.repeat) return;
    if (!fixedControl && ["1", "2", "3"].includes(event.key)) { event.preventDefault(); throttle(({ "1": 0.3, "2": 0.6, "3": 1 } as Record<string, number>)[event.key]); return; }
    const control = fixedControl && [" ", "Enter"].includes(event.key) ? fixedControl : !fixedControl ? keyControl(event.key) : undefined;
    if (!control || live.current.phase !== "flying") return;
    event.preventDefault();
    keys.current.set(event.code || event.key, control);
    syncInput();
  }
  function keyUp(event: KeyboardEvent) {
    if (keys.current.delete(event.code || event.key)) { event.preventDefault(); syncInput(); }
  }
  function pointerDown(event: PointerEvent<HTMLButtonElement>, control: Control) {
    if (frozenRef.current || live.current.phase !== "flying" || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { control, target: event.currentTarget });
    syncInput();
  }
  function pointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    syncInput();
  }
  function holdButton(control: Control, label: string, glyph: string, detail: string) {
    return <button type="button" className={`lunar-hold lunar-${control}`} aria-label={label} aria-pressed={held[control]} data-lunar-control={control}
      disabled={frozen || state.phase !== "flying"}
      onPointerDown={event => pointerDown(event, control)} onPointerUp={pointerUp} onPointerCancel={pointerUp} onLostPointerCapture={pointerUp}
      onContextMenu={event => event.preventDefault()} onKeyDown={event => keyDown(event, control)} onKeyUp={keyUp}
      onBlur={() => { keys.current.clear(); syncInput(); }}>
      <span aria-hidden="true">{glyph}</span><b>{label}</b><small>{detail}</small>
    </button>;
  }
  const terminal = state.phase === "won" || state.phase === "crashed";
  const verticalSafe = state.vy >= 0 && state.vy <= stage.maxVertical;
  const horizontalSafe = Math.abs(state.vx) <= stage.maxHorizontal;
  const aligned = Math.abs(stage.pad.x - state.x) <= stage.pad.width / 2 - LUNAR_WORLD.halfWidth;
  const altitude = Math.max(0, stage.pad.y - state.y - LUNAR_WORLD.foot);
  const wind = lunarWind(stage, state.elapsed);
  const terrainPath = `M 0 440 L ${stage.terrain.map(point => point.join(" ")).join(" L ")} L 720 440 Z`;
  const status = frozen ? "飞行已暂停，松开控制后再继续。" : lunarGuidance(state);

  return <section className="lunar-landing" data-lunar-phase={state.phase} data-lunar-won={state.phase === "won"} data-lunar-frozen={frozen}
    data-lunar-x={state.x.toFixed(3)} data-lunar-y={state.y.toFixed(3)} data-lunar-vx={state.vx.toFixed(3)} data-lunar-vy={state.vy.toFixed(3)}
    data-lunar-fuel={state.fuel.toFixed(3)} data-lunar-time={state.elapsed.toFixed(3)} data-lunar-engine={held.engine && !frozen} data-lunar-throttle={state.throttle}>
    <header className="lunar-heading"><div><span>LUNAR FLIGHT SCHOOL</span><h2>{stage.name}</h2></div><p>{stage.lesson}</p></header>
    <div className="lunar-readouts" aria-label="飞行仪表">
      <div data-safe={verticalSafe}><span>{state.vy < 0 ? "↑ 上升速度" : "↓ 下降速度"}</span><strong>{number(Math.abs(state.vy))}</strong><small>落地 ≤ {stage.maxVertical}</small></div>
      <div data-safe={horizontalSafe}><span>{state.vx < -0.2 ? "←" : state.vx > 0.2 ? "→" : "↔"} 横向速度</span><strong>{number(Math.abs(state.vx))}</strong><small>落地 ≤ {stage.maxHorizontal}</small></div>
      <div><span>距平台高度</span><strong>{number(altitude)}</strong><small>目标{aligned ? "已对齐" : `在${stage.pad.x > state.x ? "右" : "左"} ${Math.round(Math.abs(stage.pad.x - state.x))}`}</small></div>
      <div data-safe={state.fuel > stage.fuel * 0.2}><span>剩余燃料</span><strong>{Math.ceil(state.fuel)}</strong><small>起始 {stage.fuel} · 可重试</small></div>
    </div>
    <div className="lunar-cockpit">
      <div className="lunar-stage" ref={board} tabIndex={0} role="group" aria-label="月面飞行区。上方向键或空格主推力，左右键横移，下方向键制动，数字一二三切换油门。"
        onKeyDown={event => keyDown(event)} onKeyUp={keyUp} onBlur={() => { keys.current.clear(); syncInput(); }}>
        <svg viewBox="0 0 720 440" role="img" aria-label={`飞船距目标平台高度 ${Math.round(altitude)}，${aligned ? "横向已对齐" : `目标在${stage.pad.x > state.x ? "右" : "左"}侧`}。灰色是不可着陆的岩地。`}>
          <rect width="720" height="440" rx="16" fill="#14263a" />
          <g fill="#96b2c8" opacity="0.75">{[[32, 32], [85, 145], [155, 53], [216, 96], [278, 25], [322, 136], [402, 40], [470, 79], [523, 26], [612, 114], [684, 42], [656, 221], [62, 265], [525, 179]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2 : 1} />)}</g>
          <circle cx="610" cy="66" r="27" fill="#aac9cb" /><path d="M 601 41 A 27 27 0 0 0 610 93 A 27 27 0 0 1 601 41" fill="#65979f" />
          <rect x={stage.pad.x - stage.pad.width / 2} y="35" width={stage.pad.width} height={stage.pad.y - 35} fill="#95e6c8" opacity="0.055" />
          <path d={`M ${stage.pad.x} 42 V ${stage.pad.y - 18}`} stroke="#96b4b5" strokeDasharray="4 9" opacity="0.5" />
          <path d={terrainPath} fill="#607782" stroke="#89a0a8" strokeWidth="3" />
          <path d={`M ${stage.pad.x - stage.pad.width / 2} ${stage.pad.y} H ${stage.pad.x + stage.pad.width / 2}`} stroke="#b9f7cc" strokeWidth="7" />
          <g fill="#dcffe3"><path d={`M ${stage.pad.x - stage.pad.width / 2} ${stage.pad.y - 22} v 15 m 0 -15 l 12 5 -12 5 M ${stage.pad.x + stage.pad.width / 2} ${stage.pad.y - 22} v 15 m 0 -15 l -12 5 12 5`} stroke="#b9f7cc" strokeWidth="2" /></g>
          <text x={stage.pad.x} y={stage.pad.y + 28} textAnchor="middle" fill="#fff" fontSize="17" fontWeight="700">安全平台 · 双脚入内</text>
          {state.phase !== "crashed" && <path d={`M ${state.x} ${state.y + 17} V ${stage.pad.y}`} stroke="#e9dcb2" opacity="0.32" strokeDasharray="3 6" />}
          <g transform={`translate(${state.x} ${state.y})`}>
            {state.engine && !frozen && <path d={`M -7 8 Q 0 ${23 + state.throttle * 21} 7 8`} fill="#ffc06a" />}
            {state.lateral > 1 && !frozen && <path d="M -12 -4 L -28 0 L -12 4" fill="#ffc06a" />}
            {state.lateral < -1 && !frozen && <path d="M 12 -4 L 28 0 L 12 4" fill="#ffc06a" />}
            <path d="M -9 4 L -15 16 H -21 M 9 4 L 15 16 H 21" fill="none" stroke="#e5ebda" strokeWidth="3" strokeLinejoin="round" />
            <path d="M -13 5 L -11 -9 L -5 -17 H 5 L 11 -9 L 13 5 Z" fill={state.phase === "crashed" ? "#d69579" : "#f3e4b4"} stroke="#fdf7df" strokeWidth="2" />
            <rect x="-6" y="-11" width="12" height="9" rx="3" fill="#365d6d" stroke="#9ecece" />
            <path d="M -7 7 H 7" stroke="#899783" strokeWidth="4" />
          </g>
          <text x="22" y="30" fill="#d1e4e9" fontSize="15">{Math.abs(wind) < 0.1 ? "侧风 0" : `模拟侧风 ${wind < 0 ? "←" : "→"} ${number(Math.abs(wind))}`} · 重力 {stage.gravity}</text>
        </svg>
        {(state.phase !== "flying" || localPause || hidden) && <div className="lunar-stage-message" role="status">
          <strong>{state.phase === "won" ? "欢迎来到月面" : state.phase === "crashed" ? "再试一次，你会更稳" : localPause || hidden ? "已安全暂停" : "准备下降"}</strong>
          <span>{state.phase === "won" ? "双脚入内 · 速度合格" : state.phase === "crashed" ? state.reason : localPause || hidden ? "没有流逝的飞行时间，也没有保持中的推力。" : "按下开始后，重力才会生效。"}</span>
          {state.phase === "ready" && !localPause && !hidden && <button className="lunar-action" onClick={start} disabled={paused}>开始下降</button>}
          {state.phase === "crashed" && <button className="lunar-action" onClick={retry} disabled={paused || hidden}>重新尝试</button>}
          {(localPause || hidden) && !terminal && <button className="lunar-action" onClick={resume} disabled={paused || hidden}>继续飞行</button>}
        </div>}
      </div>
      <div className="lunar-console">
        <div className="lunar-throttle" role="group" aria-label="主推力油门"><span>先选油门，再按住主推力</span><div>{[[0.3, "缓降"], [0.6, "减速"], [1, "强推"]].map(([value, title]) => <button type="button" key={value} disabled={frozen || terminal} aria-pressed={state.throttle === value} aria-label={`油门 ${Number(value) * 100}%`} onClick={() => throttle(Number(value))}><b>{Number(value) * 100}%</b><small>{title}</small></button>)}</div></div>
        <div className="lunar-controls" aria-label="按住飞行控制，松开即停推力">
          {holdButton("left", "向左推", "←", "A / ←")}
          {holdButton("engine", "主推力", "↑", "空格 / ↑")}
          {holdButton("right", "向右推", "→", "D / →")}
          {holdButton("brake", "横向制动", "↔", "按住稳住横速 · S / ↓")}
        </div>
        <div className="lunar-flight-actions"><button type="button" disabled={paused || hidden || terminal || state.phase === "ready"} onClick={localPause ? resume : suspend}>{localPause ? "恢复飞行" : "暂停飞行"}</button><span>按住生效，松开仍有惯性</span></div>
      </div>
    </div>
    <p className="lunar-guidance">{status}</p>
    <details className="lunar-help"><summary>飞行小抄与训练设定</summary><p>先点击飞行区，再用方向键驾驶；数字 1 / 2 / 3 选油门。触屏可以同时按住主推力与一个横向控制。暂停、离开窗口或切换标签页会释放所有控制；回来后请明确继续，再重新按住。</p><p>主推力只向上，松开后重力仍会加速下降。左右推力改变横速，松开不会自动停车；横向制动用反向喷气抵消横移，不会自动对齐平台。着陆必须让两个支脚都位于平台内，且下降与横向速度均合格。</p><p>这是简化的虚构训练，不按真实月球比例：侧风和可变重力用于练习。30% 推力恰好抵消重力 18；第 10 关重力 24，需要交替调节。没有时限，也不限重试次数。</p></details>
  </section>;
}
