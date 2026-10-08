// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Flag, Pause, Play, RotateCcw } from "lucide-react";
import type { GameProps } from "../lib/types";
import {
  advanceCrossing, createCrossing, crossingPieces, crossingStages,
  hopCrossing, loadCrossingCheckpoint, saveCrossingCheckpoint,
  type CrossingState, type FrogDirection,
} from "./frogCrossingLogic";
import "./frogCrossingGarden.css";
const CELL = 72;
const ROW = 64;
const directionKeys: Record<string, FrogDirection> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right",
};
function Frog({ x, y, small = false }: { x: number; y: number; small?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${small ? 0.69 : 1})`} aria-hidden="true">
    <ellipse cy="11" rx="24" ry="12" fill="#163f37" opacity=".15" />
    <path d="M-16 7L-25 17M16 7L25 17M-14-4L-24-9M14-4L24-9" stroke="#286347" strokeWidth="7" strokeLinecap="round" />
    <ellipse rx="20" ry="18" fill="#aad971" stroke="#286347" strokeWidth="2.4" />
    <circle cx="-11" cy="-15" r="8" fill="#aad971" stroke="#286347" strokeWidth="2" />
    <circle cx="11" cy="-15" r="8" fill="#aad971" stroke="#286347" strokeWidth="2" />
    <circle cx="-11" cy="-16" r="3" fill="#233e32" /><circle cx="11" cy="-16" r="3" fill="#233e32" />
    <path d="M-6 6Q0 11 6 6" fill="none" stroke="#286347" strokeWidth="2" strokeLinecap="round" />
  </g>;
}
export default function FrogCrossingGarden({ level, paused, resetToken, freshStart, hintToken, undoToken, onComplete, onStatus }: GameProps) {
  const index = Math.max(0, Math.min(crossingStages.length - 1, Math.floor(level) || 0));
  const stage = crossingStages[index];
  const [state, setState] = useState(() => createCrossing(freshStart ? [] : loadCrossingCheckpoint(stage, index)));
  const live = useRef(state);
  const [held, setHeld] = useState(false);
  const heldRef = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [pace, setPace] = useState(0.7);
  const paceRef = useRef(pace);
  paceRef.current = pace;
  const [canSave, setCanSave] = useState(true);
  const board = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const previous = useRef({ index, resetToken, hintToken, undoToken });
  const clip = `crossing-${useId().replace(/:/g, "")}`;
  function commit(next: CrossingState) {
    const before = live.current;
    live.current = next;
    setState(next);
    if (next.message !== before.message || next.phase !== before.phase) callbacks.current.onStatus(next.message);
    if (next.arrived.length !== before.arrived.length)
      setCanSave(saveCrossingCheckpoint(stage, index, next.arrived));
    if (next.phase === "won" && before.phase !== "won") callbacks.current.onComplete();
  }
  function focusBoard() { board.current?.focus({ preventScroll: true }); }
  function hold() {
    if (live.current.phase !== "playing") return;
    heldRef.current = true;
    setHeld(true);
    callbacks.current.onStatus("已经安全暂停。回来后按“继续过河”，水流和车流都会等你。");
  }
  function resume() {
    if (pausedRef.current || document.hidden) return;
    heldRef.current = false;
    setHeld(false);
    focusBoard();
  }
  function start() {
    if (pausedRef.current || document.hidden) return;
    heldRef.current = false;
    setHeld(false);
    const next = createCrossing(live.current.arrived);
    commit({ ...next, phase: "playing", message: stage.lesson });
    focusBoard();
  }
  function move(direction: FrogDirection) {
    if (pausedRef.current || heldRef.current || document.hidden) return;
    const next = hopCrossing(stage, live.current, direction);
    if (next !== live.current) commit(next);
  }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = directionKeys[event.key] ?? directionKeys[event.key.toLowerCase()];
    if (!direction) return;
    event.preventDefault();
    if (!event.repeat) move(direction);
  }
  useEffect(() => {
    callbacks.current.onStatus(stage.lesson);
  }, [stage]);
  useEffect(() => {
    if (previous.current.index !== index || previous.current.resetToken !== resetToken) {
      const reset = previous.current.index === index || freshStart;
      if (reset) setCanSave(saveCrossingCheckpoint(stage, index, []));
      const next = createCrossing(reset ? [] : loadCrossingCheckpoint(stage, index));
      live.current = next;
      setState(next);
      heldRef.current = false;
      setHeld(false);
      callbacks.current.onStatus(stage.lesson);
    } else if (freshStart) setCanSave(saveCrossingCheckpoint(stage, index, []));
    previous.current.index = index;
    previous.current.resetToken = resetToken;
  }, [index, resetToken, freshStart, stage]);
  useEffect(() => {
    if (previous.current.hintToken !== hintToken)
      callbacks.current.onStatus(`${stage.lesson} ${live.current.row === 0 ? "先在草岸对准空花叶的大致方向；看清下一条路再跳。" : "水流箭头就是木筏的方向；车道上的箭头是来车方向。草岸不受时间限制。"}`);
    if (previous.current.undoToken !== undoToken)
      callbacks.current.onStatus("实时过河不能撤回时间。失误后可以再试这次，已到家的伙伴会保留。");
    previous.current.hintToken = hintToken;
    previous.current.undoToken = undoToken;
  }, [hintToken, undoToken, stage]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) hold(); };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", hold);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", hold);
    };
  }, []);
  useEffect(() => {
    let frame = 0;
    let alive = true;
    let last: number | undefined;
    let lastPaint = 0;
    const animate = (now: number) => {
      if (!alive) return;
      const running = live.current.phase === "playing" && !pausedRef.current && !heldRef.current && !document.hidden;
      if (!running) last = undefined;
      else {
        const elapsed = last === undefined ? 0 : (now - last) / 1000;
        last = now;
        if (elapsed > 0.25) { hold(); last = undefined; }
        else if (elapsed > 0) {
          const before = live.current;
          const next = advanceCrossing(stage, before, elapsed * paceRef.current);
          if (next.phase !== before.phase) commit(next);
          else {
            live.current = next;
            if (now - lastPaint >= 30) { setState(next); lastPaint = now; }
          }
        }
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => { alive = false; cancelAnimationFrame(frame); };
  }, [stage, resetToken]);
  const locked = paused || held || state.phase !== "playing";
  const rows = stage.lanes.length + 1;
  const frogY = (stage.lanes.length - state.row) * ROW + ROW / 2;
  const currentLane = stage.lanes[state.row];
  const where = state.phase === "won" ? "到家了" : currentLane?.kind === "river" ? "木筏上" : currentLane?.kind === "road" ? "小路上" : "安全草岸";
  const directions = [
    { direction: "left" as const, label: "向左跳", text: "向左", Icon: ArrowLeft },
    { direction: "up" as const, label: "向前跳", text: "向前", Icon: ArrowUp },
    { direction: "down" as const, label: "向后跳", text: "向后", Icon: ArrowDown },
    { direction: "right" as const, label: "向右跳", text: "向右", Icon: ArrowRight },
  ];
  return <section className="frog-crossing" data-frog-game data-stage={stage.id} data-phase={state.phase} data-held={held} data-x={state.x.toFixed(3)} data-row={state.row} data-time={state.time.toFixed(3)} data-arrived={state.arrived.join(",")}>
    <header className="fc-heading">
      <div><span className="fc-eyebrow">A LITTLE POND VISIT</span><h2>{stage.title}</h2><p>{stage.lesson}</p></div>
      <span className="fc-stamp"><Flag size={16} /> {state.arrived.length} / {stage.goals.length} 到家</span>
    </header>
    <div className="fc-layout">
      <div className="fc-play">
        <div className="fc-board" ref={board} tabIndex={0} role="group" aria-label="池塘过河画面，方向键或 WASD 跳一步" onKeyDown={key}>
          <svg viewBox={`0 0 ${CELL * 7} ${rows * ROW}`} role="img" aria-label={`从下方草岸到上方空花叶；当前第 ${state.row + 1} 行，${where}`}>
            <defs><clipPath id={clip}><rect width={CELL * 7} height={rows * ROW} rx="18" /></clipPath></defs>
            <g clipPath={`url(#${clip})`}>
              <rect width={CELL * 7} height={rows * ROW} fill="#e4ecd2" />
              {stage.lanes.map((lane, row) => {
                const y = (stage.lanes.length - row) * ROW;
                return <g key={row} data-frog-lane={row} data-kind={lane.kind}>
                  <rect y={y} width={CELL * 7} height={ROW} fill={lane.kind === "road" ? "#56655e" : lane.kind === "river" ? "#8ec2c0" : row === 0 ? "#d6e6b9" : "#e4ecd2"} />
                  {lane.kind === "bank" ? <>
                    {[0, 1, 2, 3, 4, 5, 6].map((x) => <path key={x} d={`M${x * CELL + 15} ${y + 47}l-2-6m2 6l4-4`} stroke="#a5b68a" strokeWidth="2" fill="none" />)}
                    <text x="12" y={y + 18} className="fc-bank-label">{lane.label}</text>
                  </> : <>
                    {lane.kind === "road" ? <path d={`M0 ${y + ROW / 2}H${CELL * 7}`} stroke="#c2cbbb" strokeWidth="2" strokeDasharray="10 17" opacity=".65" /> : [12, 48].map((dy) => <path key={dy} d={`M0 ${y + dy}Q30 ${y + dy - 8} 60 ${y + dy}T120 ${y + dy}T180 ${y + dy}T240 ${y + dy}T300 ${y + dy}T360 ${y + dy}T420 ${y + dy}T504 ${y + dy}`} stroke="#c6e0d6" strokeWidth="1.5" fill="none" opacity=".6" />)}
                    {crossingPieces(lane, state.time).map((piece) => <g key={piece.key} transform={`translate(${piece.x * CELL} ${y})`}>
                      {lane.kind === "road" ? <>
                        <rect x="1" y="14" width={piece.width * CELL - 2} height="38" rx="9" fill={row % 2 ? "#efae83" : "#edcf78"} stroke="#384942" strokeWidth="2" />
                        <rect x={lane.speed > 0 ? Math.max(7, piece.width * CELL - 27) : 8} y="20" width="17" height="25" rx="4" fill="#536d65" />
                        <path d={`M12 13v-3m${piece.width * CELL - 24} 3v-3M12 53v3m${piece.width * CELL - 24}-3v3`} stroke="#233c33" strokeWidth="5" strokeLinecap="round" />
                      </> : <>
                        <rect x="1" y="12" width={piece.width * CELL - 2} height="40" rx="16" fill="#b88452" stroke="#705536" strokeWidth="2" />
                        <path d={`M18 24H${piece.width * CELL - 18}M27 38H${piece.width * CELL - 27}`} stroke="#dfb77e" strokeWidth="3" strokeLinecap="round" />
                        <ellipse cx="10" cy="32" rx="6" ry="13" fill="none" stroke="#775e3b" strokeWidth="2" />
                      </>}
                    </g>)}
                    <g opacity=".9"><rect x="5" y={y + 4} width="28" height="18" rx="7" fill={lane.kind === "road" ? "#334b40" : "#346763"} /><text x="19" y={y + 18} textAnchor="middle" fill="#fff" fontSize="17">{lane.speed > 0 ? "→" : "←"}</text></g>
                  </>}
                </g>;
              })}
              <rect width={CELL * 7} height={ROW} fill="#bed9bb" />
              {stage.goals.map((x, goal) => <g key={goal} transform={`translate(${x * CELL} 32)`}>
                <ellipse rx="32" ry="24" fill={state.arrived.includes(goal) ? "#60996b" : "#82b878"} stroke="#3b6c4e" strokeWidth="2" />
                <path d="M0 0L24-17L14 2Z" fill="#bed9bb" />
                {state.arrived.includes(goal) ? <Frog x={0} y={0} small /> : <><circle cx="-5" cy="0" r="11" fill="#fff2d2" /><circle cx="-5" cy="0" r="4" fill="#dd9a5a" /><text x="18" y="16" className="fc-goal-number">{goal + 1}</text></>}
              </g>)}
              {state.phase !== "won" && <Frog x={state.x * CELL} y={frogY} />}
            </g>
          </svg>
          {(state.phase !== "playing" || held) && <div className="fc-overlay">
            <div className="fc-sheet" role="group" aria-label="过河状态">
              <span className="fc-eyebrow">{state.phase === "won" ? "EVERYONE IS HOME" : held ? "TAKE YOUR TIME" : "ONE HOP AT A TIME"}</span>
              <h3>{held ? "池塘会等你" : state.phase === "won" ? "伙伴们都到家了" : state.phase === "stranded" ? "歇一下，再试这次" : state.arrived.length ? "下一位伙伴，准备好了吗？" : "一段小小的探访"}</h3>
              <p>{held ? "页面离开或画面卡顿时，车流和水流都会安全停下。" : state.phase === "ready" ? "避开小车，搭着木筏，跳上空花叶。草岸可以一直等。" : state.message}</p>
              {state.phase === "won" ? <small>用上方“下一关”继续探访。</small> : <button className="fc-main-button" disabled={paused} onClick={held ? resume : start}>
                {held || state.phase === "ready" ? <Play size={18} /> : <RotateCcw size={18} />}
                {held ? "继续过河" : state.phase === "stranded" ? "再试这次" : state.arrived.length ? "送下一位" : "开始过河"}
              </button>}
            </div>
          </div>}
        </div>
        <div className="fc-directions" role="group" aria-label="过河方向" onKeyDown={key}>
          {directions.map(({ direction, label, text, Icon }) => <button key={direction} disabled={locked} aria-label={label} onClick={() => move(direction)}><Icon size={23} /><span>{text}</span></button>)}
        </div>
      </div>
      <aside className="fc-notes">
        <div className="fc-location"><span className={`fc-location-dot ${currentLane?.kind ?? "bank"}`} /> <strong>{where}</strong><span>第 {state.row + 1} / {rows} 行</span></div>
        <div className="fc-pace" role="group" aria-label="水流与车流速度"><span>这一程的节奏</span><div><button aria-pressed={pace === 0.7} disabled={paused || held} onClick={() => setPace(0.7)}>悠闲</button><button aria-pressed={pace === 1} disabled={paused || held} onClick={() => setPace(1)}>标准</button></div></div>
        <button className="fc-rest-button" onClick={hold} disabled={locked}><Pause size={17} /> 歇一会儿</button>
        <ul className="fc-rules"><li><span className="fc-key road" /> 小车要绕开，等空隙再跳</li><li><span className="fc-key river" /> 木筏能搭乘，水面不能落脚</li><li><span className="fc-key bank" /> 草岸很安全，可以慢慢观察</li></ul>
        <p className="fc-footnote">每片花叶接一位伙伴。失败可无限再试，已到家的伙伴保留；“重来”会清空这一关的停靠。</p>
        <p className="fc-footnote">方向键 / WASD 跳一步 · Esc 暂停<br />无需按住、拖动或抢倒计时</p>
        <p className="fc-storage">{canSave ? "到岸进度仅存当前浏览器；离开后从出发岸继续。" : "浏览器没有保存成功。本次仍可继续，离开后可能需要重新出发。"}</p>
      </aside>
    </div>
    <p className="fc-message" aria-live="polite">{state.message}</p>
  </section>;
}
