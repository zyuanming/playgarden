// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { bubbleShooterLevels, type BubbleColor } from "./bubbleShooterLevels";
import { BUBBLE_COURT, bubbleAngle, bubbleCenter, bubbleHint, bubbleKey, bubbleQueue, createBubbleState, replayBubbleShots, shootBubble, traceBubbleShot, type BubblePoint, type BubbleShot } from "./bubbleShooterLogic";
import { loadBubbleRound, saveBubbleRound } from "./bubbleShooterStorage";
import "./bubbleShooterGarden.css";

const colors: Record<BubbleColor, { name: string; symbol: string; fill: string }> = {
  R: { name: "珊瑚红", symbol: "✦", fill: "#cc594f" }, B: { name: "湖水蓝", symbol: "≋", fill: "#387fac" },
  G: { name: "薄荷绿", symbol: "✿", fill: "#378a71" }, Y: { name: "阳光黄", symbol: "●", fill: "#b8821d" },
};
const pointAlong = (path: readonly BubblePoint[], progress: number): BubblePoint => {
  const lengths = path.slice(1).map((point, index) => Math.hypot(point.x - path[index].x, point.y - path[index].y));
  let distance = lengths.reduce((sum, value) => sum + value, 0) * progress;
  for (let index = 0; index < lengths.length; index++) {
    if (distance <= lengths[index]) { const part = lengths[index] ? distance / lengths[index] : 1; return { x: path[index].x + (path[index + 1].x - path[index].x) * part, y: path[index].y + (path[index + 1].y - path[index].y) * part }; }
    distance -= lengths[index];
  }
  return path[path.length - 1];
};
function BubbleMark({ color, x, y, preview = false }: { color: BubbleColor; x: number; y: number; preview?: boolean }) {
  const palette = colors[color];
  return <g transform={`translate(${x} ${y})`} aria-hidden="true" opacity={preview ? 0.58 : 1}>
    <circle r="16.8" fill={palette.fill} stroke={preview ? "#183e40" : "#ffffff"} strokeWidth={preview ? 2 : 2.5} strokeDasharray={preview ? "3 3" : undefined} />
    <path d="M-10-7 Q-6-13 1-11" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity=".55" />
    <text textAnchor="middle" dominantBaseline="central" y="1" fill="white" fontSize={color === "Y" ? 14 : 21} fontWeight="800">{palette.symbol}</text>
  </g>;
}
export default function BubbleShooterGarden(props: GameProps) {
  return <BubbleRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function BubbleRound({ level, paused, freshStart, hintToken, undoToken, onComplete, onStatus }: GameProps) {
  const puzzle = bubbleShooterLevels[level] ?? bubbleShooterLevels[0];
  const [initial] = useState(() => freshStart ? { state: createBubbleState(puzzle), aim: 0 } : loadBubbleRound(level, puzzle));
  const [state, setState] = useState(initial.state), [aim, setAim] = useState(initial.aim);
  const [flight, setFlight] = useState<BubbleShot | null>(null), [position, setPosition] = useState<BubblePoint | null>(null);
  const [hidden, setHidden] = useState(() => document.hidden), [saved, setSaved] = useState(true);
  const [message, setMessage] = useState("点棋盘瞄准，查看虚线和落点，再点“发射泡泡”。");
  const live = useRef(state), angleRef = useRef(aim), busy = useRef(false), generation = useRef(0), notified = useRef(false);
  const tokens = useRef({ hintToken, undoToken }), callbacks = useRef({ onComplete, onStatus }); callbacks.current = { onComplete, onStatus };
  const frozen = paused || hidden, frozenRef = useRef(frozen); frozenRef.current = frozen;
  const locked = frozen || state.phase !== "ready" || Boolean(flight);
  const color = puzzle.queue[state.cursor], queue = bubbleQueue(puzzle, state);
  const preview = useMemo(() => state.phase === "ready" && color ? traceBubbleShot(state.board, color, aim) : null, [state, color, aim]);
  const pendingCount = preview ? preview.removed + preview.dropped : 0;
  const boardLabel = state.board.map(bubble => `${bubble.row + 1}行${bubble.col + 1}列${colors[bubble.color].name}`).join("，");

  function report(text: string) { setMessage(text); callbacks.current.onStatus(text); }
  function update(next: typeof state) { live.current = next; setState(next); }
  function cancelFlight() { generation.current++; busy.current = false; setFlight(null); setPosition(null); }
  function changeAim(value: number) {
    if (frozenRef.current || busy.current || live.current.phase !== "ready" || !Number.isFinite(value)) return;
    const next = bubbleAngle(value); angleRef.current = next; setAim(next);
  }
  function fire() {
    if (frozenRef.current || busy.current || live.current.phase !== "ready") return;
    const shot = traceBubbleShot(live.current.board, puzzle.queue[live.current.cursor], angleRef.current);
    if (!shot.landing) { report("这个方向没有可用落点，请调整角度再试。"); return; }
    busy.current = true; setPosition(shot.path[0]); setFlight(shot);
    report(`${colors[shot.color].name}出发了${shot.bounces ? `，经过 ${shot.bounces} 次墙壁反弹` : ""}。`);
  }
  function hint() {
    if (frozenRef.current || busy.current || live.current.phase !== "ready") return;
    const suggestion = bubbleHint(puzzle, live.current);
    if (suggestion === null) { report("暂时没有合适的落点，可以撤销一发或重来。"); return; }
    changeAim(suggestion);
    report("启发式提示：优先尝试这一发能消除或掉落更多泡泡的方向；只看当前一步，不保证过关或最少发数。确认预览后再发射。");
  }
  function undo() {
    if (frozenRef.current || live.current.phase === "won") return;
    if (busy.current) { cancelFlight(); report("已收回飞行中的泡泡，没有消耗发数。"); return; }
    if (!live.current.history.length) { report("还没有可撤销的发射。瞄准不会消耗泡泡。"); return; }
    const history = live.current.history, next = replayBubbleShots(puzzle, history.slice(0, -1));
    if (!next) return;
    angleRef.current = history[history.length - 1]; setAim(angleRef.current); update(next);
    report("已撤销上一发，颜色队列、消除和掉落都回到发射前。");
  }
  useEffect(() => { callbacks.current.onStatus(puzzle.lesson); }, [puzzle]);
  useEffect(() => { setSaved(saveBubbleRound(level, puzzle, state, aim)); }, [level, puzzle, state, aim]);
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  useEffect(() => { if (frozen && busy.current) { cancelFlight(); report("已暂停并收回飞行中的泡泡。继续后重新发射，不消耗发数。"); } }, [frozen]);
  useEffect(() => {
    if (!flight || frozen) return;
    const ticket = ++generation.current, before = live.current;
    let frame = 0, start: number | null = null;
    const duration = Math.min(1050, 760 + flight.bounces * 85);
    const tick = (now: number) => {
      if (generation.current !== ticket || frozenRef.current) return;
      if (start === null) start = now;
      const progress = Math.min(1, (now - start) / duration);
      setPosition(pointAlong(flight.path, progress));
      if (progress < 1) { frame = requestAnimationFrame(tick); return; }
      const next = shootBubble(puzzle, before, flight.angle);
      busy.current = false; setFlight(null); setPosition(null); update(next);
      if (next.phase === "lost") report("本轮泡泡用完了，或泡泡触到警戒线。可以撤销上一发，也可以重来。");
      else if (next.phase !== "won") report(flight.removed ? `连消 ${flight.removed} 颗${flight.dropped ? `，另外 ${flight.dropped} 颗失去支撑而落下` : ""}。继续观察下一颗的颜色。` : "泡泡已贴到落点。再用同色连成至少三颗，才能一起消除。");
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); generation.current++; };
  }, [flight, frozen, puzzle]);
  useEffect(() => {
    if (state.phase !== "won" || frozen || notified.current) return;
    notified.current = true;
    report(`天幕清空了！用了 ${state.history.length} 发，泡泡弹射完成。`); callbacks.current.onComplete();
  }, [state.phase, state.history.length, frozen]);
  useEffect(() => {
    if (tokens.current.hintToken !== hintToken) { tokens.current.hintToken = hintToken; hint(); }
  }, [hintToken]);
  useEffect(() => {
    if (tokens.current.undoToken !== undoToken) { tokens.current.undoToken = undoToken; undo(); }
  }, [undoToken]);

  return <div className="bubble-shooter-layout" data-bubble-level={puzzle.id} data-bubble-phase={state.phase} data-bubble-won={state.phase === "won"}
    data-bubble-board={state.board.map(bubble => `${bubbleKey(bubble)}:${bubble.color}`).join(",")} data-bubble-shots={state.history.length} data-bubble-aim={aim}
    data-bubble-flying={Boolean(flight)} data-bubble-last-removed={state.last?.removed ?? 0} data-bubble-last-dropped={state.last?.dropped ?? 0} data-bubble-last-bounces={state.last?.bounces ?? 0}
    onKeyDownCapture={event => { if ((event.repeat || event.ctrlKey || event.altKey || event.metaKey) && ["Enter", " "].includes(event.key)) event.preventDefault(); }}>
    <section className="bubble-shooter-play" aria-label="泡泡弹射游戏">
      <header className="bubble-shooter-heading"><div><span>BUBBLE POST / 泡泡邮局</span><h3>{puzzle.title}</h3></div><b>{String(level + 1).padStart(2, "0")}<small> / {bubbleShooterLevels.length}</small></b></header>
      <p className="bubble-shooter-lesson">{puzzle.lesson}</p>
      <div className="bubble-shooter-stats"><span>已发 <b>{state.history.length}</b></span><span>待发 <b>{queue.length}</b></span><span>场上 <b>{state.board.length}</b></span><span>{frozen ? "已暂停" : state.phase === "won" ? "已清空 ✓" : "不计时"}</span></div>
      <div className="bubble-shooter-stage" role="group" tabIndex={0} aria-label="泡泡瞄准区。点击或轻点瞄准；左右键调整角度，Enter 或空格发射。"
        onKeyDown={event => {
          if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || locked) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); changeAim(angleRef.current + (event.key === "ArrowLeft" ? -2 : 2)); }
          if (event.key === " " || event.key === "Enter") { event.preventDefault(); fire(); }
        }}>
        <svg viewBox={`0 0 ${BUBBLE_COURT.width} ${BUBBLE_COURT.height}`} role="img" aria-label={`泡泡棋盘，剩余 ${state.board.length} 颗。${boardLabel}`} data-bubble-board-svg
          onPointerDown={event => {
            if (locked || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return;
            const rect = event.currentTarget.getBoundingClientRect(), x = (event.clientX - rect.left) / rect.width * 360, y = (event.clientY - rect.top) / rect.height * 486;
            if (y >= BUBBLE_COURT.launcherY - 14) return;
            event.currentTarget.parentElement?.focus({ preventScroll: true });
            changeAim(Math.atan2(x - 180, 440 - y) * 180 / Math.PI);
          }}>
          <defs><pattern id={`bubble-dots-${level}`} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1" fill="#c8dbd5" /></pattern></defs>
          <rect width="360" height="486" rx="20" fill="#f5faf4" />
          <rect x="12" y="18" width="336" height="386" rx="12" fill={`url(#bubble-dots-${level})`} />
          <path d="M18 392V32H342V392" fill="none" stroke="#aec8bd" strokeWidth="3" />
          <path d="M18 395H342" stroke="#c68167" strokeWidth="1.5" strokeDasharray="5 6" /><text x="30" y="413" fill="#8e6352" fontSize="10">警戒线</text>
          {!frozen && preview && !flight && <g aria-hidden="true"><polyline points={preview.path.map(point => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#365e64" strokeWidth="2" strokeDasharray="4 7" strokeLinecap="round" />
            {preview.path.slice(1, -1).filter(point => point.x <= 18.1 || point.x >= 341.9).map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="6" fill="#f7d889" stroke="#896315" strokeWidth="1.5" />)}
          </g>}
          {state.board.map(bubble => { const center = bubbleCenter(bubble); return <BubbleMark key={bubbleKey(bubble)} color={bubble.color} x={center.x} y={center.y} />; })}
          {!frozen && !flight && preview?.landing && <BubbleMark color={preview.color} {...bubbleCenter(preview.landing)} preview />}
          <g aria-hidden="true"><ellipse cx="180" cy="465" rx="38" ry="7" fill="#cdded3" /><path d="M153 459 Q150 423 180 419 Q210 423 207 459Z" fill="#244a49" /><path d={`M180 440 L${180 + Math.sin(aim * Math.PI / 180) * 36} ${440 - Math.cos(aim * Math.PI / 180) * 36}`} stroke="#244a49" strokeWidth="18" strokeLinecap="round" /></g>
          {!flight && state.phase === "ready" && color && <BubbleMark color={color} x={180} y={440} />}
          {flight && position && <BubbleMark color={flight.color} {...position} />}
          {state.phase === "won" && <g aria-hidden="true"><rect x="68" y="190" width="224" height="78" rx="24" fill="#e0efe4" /><text x="180" y="222" textAnchor="middle" fontSize="25" fontWeight="800" fill="#244a49">天幕清空了</text><text x="180" y="247" textAnchor="middle" fontSize="13" fill="#42665b">每一颗都找到了伙伴</text></g>}
          {frozen && <g aria-hidden="true"><rect x="81" y="194" width="198" height="60" rx="22" fill="#fff8e6" /><text x="180" y="231" textAnchor="middle" fontSize="22" fontWeight="700" fill="#244a49">休息一下 · 已暂停</text></g>}
        </svg>
      </div>
      <div className="bubble-shooter-preview" data-bubble-preview-bounces={preview?.bounces ?? 0} data-bubble-preview-removed={preview?.removed ?? 0} data-bubble-preview-dropped={preview?.dropped ?? 0}>
        <strong>{state.phase === "won" ? "所有泡泡已清空" : state.phase === "lost" ? "撤销一发，或重新开始" : flight ? "泡泡飞行中…" : frozen ? "继续后再瞄准" : pendingCount ? `预计连消 ${preview?.removed} · 掉落 ${preview?.dropped}` : "落点已描边 · 同色至少三颗才消除"}</strong>
        {state.phase === "ready" && <small>{preview?.bounces ? `墙壁反弹 ${preview.bounces} 次` : "直线发射"} · 点棋盘只瞄准，不会发射</small>}
      </div>
      <div className="bubble-shooter-aim"><button type="button" aria-label="向左微调 2 度" disabled={locked || aim <= -74} onClick={() => changeAim(angleRef.current - 2)}>↖ <span>左移</span></button>
        <label>角度 <input type="number" inputMode="decimal" aria-label="瞄准角度" min={-74} max={74} step={1} value={aim} disabled={locked} onChange={event => { if (event.currentTarget.value !== "") changeAim(Number(event.currentTarget.value)); }} /> °</label>
        <button type="button" aria-label="向右微调 2 度" disabled={locked || aim >= 74} onClick={() => changeAim(angleRef.current + 2)}><span>右移</span> ↗</button></div>
      <input className="bubble-shooter-slider" type="range" min={-74} max={74} step={1} value={aim} aria-label="左右瞄准滑杆" disabled={locked} onChange={event => changeAim(Number(event.currentTarget.value))} />
      <div className="bubble-shooter-actions"><button type="button" className="bubble-shooter-fire" data-bubble-fire disabled={locked || !preview?.landing} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.altKey) fire(); }}>发射泡泡 <span aria-hidden="true">↗</span></button><button type="button" disabled={locked} onClick={hint}>找个方向</button></div>
      <p className="bubble-shooter-message" role="status" aria-live="polite">{message}</p>
      <p className="bubble-shooter-save">{saved ? "此浏览器会保存已完成的发射和撤销记录。" : "此浏览器暂时无法保存，请保持页面打开。"}</p>
    </section>
    <aside className="bubble-shooter-notes"><div className="bubble-shooter-stamp" aria-hidden="true">○<span>✦</span>○</div><span className="bubble-shooter-eyebrow">一封给颜色的信</span><h3>轻轻瞄准，<br />让同色相遇。</h3><p>把泡泡弹向天空。三颗或更多同色相连，就会一起消失；没有连接到天花板的泡泡也会落下。</p>
      <div className="bubble-shooter-queue"><strong>完整待发队列 <small>从左到右</small></strong><div aria-label={`待发颜色：${queue.map(item => colors[item].name).join("、") || "无"}`}>{queue.map((item, index) => <span className={`bubble-shooter-chip ${index === 0 ? "is-next" : ""}`} key={`${state.cursor}-${index}`} style={{ backgroundColor: colors[item].fill }} aria-label={`${index === 0 ? "当前" : `第 ${index + 1} 颗`}${colors[item].name}`}>{colors[item].symbol}{index === 0 && <i>现在</i>}</span>)}</div><p>每关泡泡有限，发完仍未清空就要重试。已经完全消失的颜色会自动跳过，待发数也会减少。</p></div>
      <ol><li>轻点棋盘选方向，或用左右按钮微调。</li><li>看虚线、反弹点和描边落点。</li><li>按“发射泡泡”。不同符号也代表不同颜色。</li></ol>
      <div className="bubble-shooter-palette">{(Object.keys(colors) as BubbleColor[]).map(item => <span key={item}><b style={{ color: colors[item].fill }}>{colors[item].symbol}</b>{colors[item].name}</span>)}</div>
      <details><summary>键盘、撤销与提示</summary><p>焦点在棋盘时，用左右方向键微调，Enter 或空格发射。也可以 Tab 到数字角度框直接输入，再 Tab 到发射按钮。长按不会连续发射。</p><p>未过关前可撤销上一发，包括失败的一发。暂停、切关或重来会收回尚未落定的泡泡，不扣发数。没有计时压力。</p><p>“找个方向”和工具栏提示只比较当前一发的效果，是启发式建议，不保证过关或最少发数。</p></details>
    </aside>
  </div>;
}
