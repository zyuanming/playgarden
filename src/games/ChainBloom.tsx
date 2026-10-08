// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { GameProps } from "../lib/types";
import {
  BLOOM_ARENA, BLOOM_INITIAL_RADIUS, BLOOM_LIFETIME,
  bloomCount, bloomRadius, bloomStage, clampBloomPoint,
  createBloom, igniteBloom, loadBloom, saveBloom, stepBloom,
  type BloomPoint, type BloomState,
} from "./chainBloomLogic";
import "./chainBloom.css";

const hues = ["#277d6c", "#bc6132", "#775b9c", "#3a6ca4"];
export default function ChainBloom({ level, paused, resetToken, freshStart, hintToken, onStatus, onComplete }: GameProps) {
  const initial = useRef<{ state: BloomState; restored: boolean } | null>(null);
  if (!initial.current) {
    const restored = freshStart ? null : loadBloom(level);
    initial.current = { state: restored ?? createBloom(level), restored: !!restored };
  }
  const [state, setState] = useState(initial.current.state);
  const [localPause, setLocalPause] = useState(initial.current.restored);
  const [hidden, setHidden] = useState(document.hidden);
  const [storageOk, setStorageOk] = useState(true);
  const [runId, setRunId] = useState(0);
  const live = useRef(state);
  const completed = useRef(false);
  const stageElement = useRef<HTMLDivElement>(null);
  const pending = useRef<{ id: number; x: number; y: number } | null>(null);
  const identity = useRef(`${level}:${resetToken}`);
  const callbacks = useRef({ onStatus, onComplete });
  callbacks.current = { onStatus, onComplete };
  const stage = bloomStage(state.level);
  const frozen = paused || localPause || hidden;
  const stopped = state.phase === "won" || state.phase === "retry";
  const fillId = useId().replaceAll(":", "");

  function persist(next: BloomState) { setStorageOk(saveBloom(next)); }
  function commit(next: BloomState, save = false) {
    live.current = next;
    setState(next);
    if (save) persist(next);
  }
  function restart() {
    pending.current = null;
    completed.current = false;
    setRunId((value) => value + 1);
    setLocalPause(false);
    commit(createBloom(level), true);
    callbacks.current.onStatus("回到相同的起点了。可以换个位置，也可以多等一会儿。");
  }
  useEffect(() => {
    if (identity.current !== `${level}:${resetToken}`) {
      identity.current = `${level}:${resetToken}`;
      restart();
    } else callbacks.current.onStatus(initial.current?.restored ? "已恢复上次花园，暂停着等你。点继续漂动再开始。" : bloomStage(level).lesson);
    // The shell usually remounts; this also supports an in-place reset.
  }, [level, resetToken]);
  useEffect(() => {
    if (hintToken) callbacks.current.onStatus(bloomStage(live.current.level).lesson);
  }, [hintToken]);
  useEffect(() => {
    const freeze = () => {
      pending.current = null;
      setLocalPause(true);
      persist(live.current);
    };
    const visibility = () => { setHidden(document.hidden); if (document.hidden) freeze(); };
    const save = () => { saveBloom(live.current); };
    window.addEventListener("blur", freeze);
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      pending.current = null;
      save();
      window.removeEventListener("blur", freeze);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (frozen || stopped) {
      pending.current = null;
      persist(live.current);
      return;
    }
    let frame = 0;
    let last: number | undefined;
    let saveAfter = 0;
    let active = true;
    const tick = (now: number) => {
      if (!active) return;
      if (last !== undefined) {
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
        const next = stepBloom(live.current, dt);
        if (next !== live.current) commit(next);
        saveAfter += dt;
        if (saveAfter >= 1) { persist(next); saveAfter = 0; }
        if (next.phase === "won" || next.phase === "retry") {
          persist(next);
          return;
        }
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(frame); };
  }, [frozen, stopped, level, resetToken, runId]);
  useEffect(() => {
    if (state.phase === "won" && !completed.current) {
      completed.current = true;
      callbacks.current.onStatus(`点亮 ${bloomCount(state)} 颗，达到 ${stage.target} 颗的目标！一次花火，接成了整条花径。`);
      callbacks.current.onComplete();
    } else if (state.phase === "retry") {
      callbacks.current.onStatus(`点亮了 ${bloomCount(state)} 颗，还差 ${Math.max(0, stage.target - bloomCount(state))} 颗。没有次数限制，换个时机再试吧。`);
    }
  }, [state.phase]);

  function choose(point: BloomPoint | null) {
    if (paused || hidden || live.current.phase !== "watching") return;
    commit({ ...live.current, aim: point ? clampBloomPoint(point) : null }, true);
  }
  function nudge(dx: number, dy: number) {
    const point = live.current.aim ?? { x: 320, y: 210 };
    choose({ x: point.x + dx, y: point.y + dy });
  }
  function ignite() {
    if (frozen || live.current.phase !== "watching" || !live.current.aim) return;
    pending.current = null;
    commit(igniteBloom(live.current), true);
    callbacks.current.onStatus("花火开始接力了。每颗种子只会开花一次，等最后一朵消散再看结果。");
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const pointer = pending.current;
    pending.current = null;
    if (!pointer || pointer.id !== event.pointerId || Math.hypot(pointer.x - event.clientX, pointer.y - event.clientY) > 16) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    choose({ x: (event.clientX - rect.left) / rect.width * BLOOM_ARENA.width, y: (event.clientY - rect.top) / rect.height * BLOOM_ARENA.height });
    stageElement.current?.focus({ preventScroll: true });
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const directions: Record<string, [number, number]> = { ArrowLeft: [-12,0], ArrowRight: [12,0], ArrowUp: [0,-12], ArrowDown: [0,12] };
    if (directions[event.key]) { event.preventDefault(); nudge(...directions[event.key]); }
    if ((event.key === "Enter" || event.key === " ") && !event.repeat) { event.preventDefault(); ignite(); }
    if (event.key.toLowerCase() === "c") { event.preventDefault(); choose(null); }
  }
  const count = bloomCount(state);
  const remaining = Math.max(0, stage.target - count);
  const canAim = state.phase === "watching" && !paused && !hidden;
  const status = state.phase === "won" ? "接力完成" : state.phase === "retry" ? "再试也没关系" : state.phase === "blooming" ? remaining === 0 ? "目标已达成，花火还在继续" : "花火正在接力" : localPause ? "暂停观察中" : "选一个位置，等一个好时机";
  return (
    <section className="chain-bloom" data-bloom-phase={state.phase} data-bloom-time={state.elapsed.toFixed(3)} data-bloom-hits={count} data-bloom-aim-x={state.aim?.x ?? "none"} data-bloom-aim-y={state.aim?.y ?? "none"} data-bloom-paused={frozen}>
      <div className="cbl-heading">
        <div><span className="cbl-eyebrow">一次点燃 · 无限次重试</span><h2>{stage.title}</h2></div>
        <div className="cbl-counter" aria-label={`已点亮 ${count} 颗，目标 ${stage.target} 颗`}><strong>{count}<span> / {stage.target}</span></strong><small>已点亮 / 目标</small></div>
      </div>
      <p className="cbl-lesson">{stage.lesson}</p>
      <div className="cbl-progress" role="progressbar" aria-label="本次点亮目标" aria-valuemin={0} aria-valuemax={stage.target} aria-valuenow={Math.min(count, stage.target)}><span style={{ width: `${Math.min(100, count / stage.target * 100)}%` }} /></div>
      <div className="cbl-arena-wrap">
        <div ref={stageElement} className={`cbl-arena ${canAim ? "cbl-aiming" : ""}`} tabIndex={0} role="group" aria-label="花火场地。点击选点，方向键微调，回车点燃；C 取消选点。" aria-describedby="cbl-instructions"
          onKeyDown={keyboard}
          onPointerDown={(event) => { if (event.isPrimary && event.button === 0 && canAim) pending.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; }}
          onPointerUp={pointerUp} onPointerCancel={() => { pending.current = null; }} onPointerLeave={() => { pending.current = null; }} onBlur={() => { pending.current = null; }}>
          <svg viewBox="0 0 640 420" aria-hidden="true">
            <defs><radialGradient id={`cbl-bg-${fillId}`}><stop stopColor="#fffbea"/><stop offset="1" stopColor="#e9f3ed"/></radialGradient></defs>
            <rect x="0" y="0" width="640" height="420" rx="20" fill={`url(#cbl-bg-${fillId})`}/>
            <path d="M0 348 Q105 293 204 356 T423 345 T640 335 V420 H0Z" fill="#dce9d9" opacity=".55"/>
            <path d="M0 383 Q130 334 292 387 T640 365" fill="none" stroke="#c4d8c4" strokeWidth="2"/>
            <rect x="14" y="14" width="612" height="392" rx="14" fill="none" stroke="#a3baac" strokeDasharray="3 8"/>
            {state.rings.map((ring) => {
              const color = ring.id === -1 ? "#47775b" : hues[ring.id % hues.length];
              const r = bloomRadius(ring, stage);
              return <g key={ring.id} opacity={Math.max(.12, 1 - ring.age / BLOOM_LIFETIME * .65)}><circle cx={ring.x} cy={ring.y} r={r} fill={color} fillOpacity=".13" stroke={color} strokeWidth="2"/><circle cx={ring.x} cy={ring.y} r={Math.max(0, r - 5)} fill="none" stroke={color} strokeOpacity=".25"/><path transform={`translate(${ring.x} ${ring.y})`} d="M0-9 Q5-4 9 0 Q4 5 0 9 Q-5 4-9 0 Q-4-5 0-9Z" fill={color}/></g>;
            })}
            {state.seeds.map((seed, id) => seed.lit ? <circle key={id} cx={seed.x} cy={seed.y} r="3" fill={hues[id % hues.length]} opacity=".45"/> : <g key={id} data-bloom-seed={id} transform={`translate(${seed.x} ${seed.y})`}>
              <circle r="14" fill={hues[id % hues.length]} opacity=".08"/>
              <path d={`M${-seed.vx / 7} ${-seed.vy / 7} L0 0`} stroke={hues[id % hues.length]} strokeWidth="2" strokeLinecap="round" opacity=".45"/>
              <circle r="6.5" fill={hues[id % hues.length]} stroke="#fffdf2" strokeWidth="2"/>
              <path d="M-2-2 L2 2 M2-2 L-2 2" stroke="#fff" strokeWidth="1" opacity=".8"/>
            </g>)}
            {state.phase === "watching" && state.aim && <g className="cbl-preview" transform={`translate(${state.aim.x} ${state.aim.y})`}><circle r={BLOOM_INITIAL_RADIUS} fill="#527863" fillOpacity=".04" stroke="#527863" strokeWidth="1.5" strokeDasharray="6 5"/><circle r="12" fill="#fffbea" stroke="#2c6248" strokeWidth="2"/><path d="M-6 0H6 M0-6V6" stroke="#2c6248" strokeWidth="2"/></g>}
          </svg>
          {localPause && !stopped && <span className="cbl-pause-tag">已暂停 · 可安心选点</span>}
        </div>
      </div>
      <div className={`cbl-state cbl-state-${state.phase}`} aria-live="polite"><strong>{status}</strong><span>{state.phase === "watching" ? "虚线是第一朵花长大后的范围" : remaining ? `还差 ${remaining} 颗 · 共 ${state.seeds.length} 颗种子` : `已达到目标 · 共 ${state.seeds.length} 颗种子`}</span></div>
      <div className="cbl-controls">
        <button type="button" className="cbl-ignite" disabled={!canAim || frozen || !state.aim} onClick={ignite}>点燃这朵花</button>
        <button type="button" disabled={paused || hidden || stopped} onClick={() => { pending.current = null; setLocalPause((value) => !value); persist(live.current); }}>{localPause ? "继续漂动" : "暂停观察"}</button>
        {state.phase === "retry" ? <button type="button" className="cbl-retry" disabled={paused || hidden} onClick={restart}>再试一次</button> : state.phase !== "won" && <button type="button" disabled={paused || hidden} onClick={restart}>重新观察</button>}
        <button type="button" disabled={!canAim || !state.aim} onClick={() => choose(null)}>取消选点</button>
      </div>
      <div className="cbl-aim-controls" role="group" aria-label="微调点燃位置">
        <span>微调</span>{([[-12,0,"向左","←"],[0,-12,"向上","↑"],[0,12,"向下","↓"],[12,0,"向右","→"]] as const).map(([dx,dy,label,glyph]) => <button type="button" key={label} aria-label={label} disabled={!canAim} onClick={() => nudge(dx,dy)}>{glyph}</button>)}
        <small>{state.aim ? `选点 ${Math.round(state.aim.x)}, ${Math.round(state.aim.y)}` : "尚未选点"}</small>
      </div>
      <p id="cbl-instructions" className="cbl-help">点击场地只预览，再按“点燃这朵花”确认。种子碰到花圈就会停住开花；花圈先长大，再消散。颜色不影响规则。观察不限时，可暂停，失败随时重试。</p>
      {!storageOk && <p className="cbl-storage" role="status">浏览器暂时不能保存，仍可继续玩；离开页面后本次进度可能丢失。</p>}
    </section>
  );
}
