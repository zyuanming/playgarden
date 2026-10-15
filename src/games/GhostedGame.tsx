// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { GameProps } from "../lib/types";
import {copyContinuation, isContinuation, observedNativeSession, type Continuation} from "../../third_party/ghosted/bridge-src/continuation";
import "./ghostedGame.css";

const REVISION = "ghosted-846454c-playgarden-1";
const INTRO = "每走一步，离幽灵形态更近。用 13 步的生命、岩石与苹果安排路线，收齐金币。";
type Summary = {scene: string; initialized: boolean; paused: boolean; saved: boolean; progress: boolean[]; game: null | {level: number; cleared: boolean}};
type FrameWindow = Window & {__ghostedDispose?: () => void; __ghostedSnapshot?: () => unknown};
// A short-lived receipt copies only actual earned native flags and preferences.
// It never contains a board, coins, timers or fabricated successes.
let activeSession: string | null = null;
let activeOwner: {session: string; level: number; capture: (targetLevel: number) => Continuation | null} | null = null;
let handoff: {owner: string; created: number; continuation: Continuation} | null = null;
const keys = [
  {code: "ArrowUp", label: "向上", text: "↑"}, {code: "ArrowLeft", label: "向左", text: "←"},
  {code: "ArrowDown", label: "向下", text: "↓"}, {code: "ArrowRight", label: "向右", text: "→"},
  {code: "Enter", label: "确认或原版暂停", text: "确认"}, {code: "Escape", label: "返回或原版暂停", text: "菜单"},
  {code: "KeyR", label: "重试本关", text: "重试"}, {code: "KeyZ", label: "撤销一步", text: "撤销"},
];
const isSummary = (value: unknown): value is Summary => {
  if (!value || typeof value !== "object") return false;
  const state = value as Summary;
  return ["t", "c", "ls", "g", "e"].includes(state.scene) && typeof state.initialized === "boolean" &&
    typeof state.paused === "boolean" && typeof state.saved === "boolean" && Array.isArray(state.progress) &&
    state.progress.length === 13 && state.progress.every(item => typeof item === "boolean") &&
    (state.game === null || !!state.game && Number.isInteger(state.game.level) && state.game.level >= 1 &&
      state.game.level <= 13 && typeof state.game.cleared === "boolean");
};

export default function GhostedGame({level, paused, muted = false, freshStart, hintToken, undoToken, onComplete, onLevelChange, onStatus}: GameProps) {
  const selected = Math.max(1, Math.min(13, Math.trunc(level) + 1));
  const frame = useRef<HTMLIFrameElement>(null);
  const [instance] = useState(() => crypto.randomUUID());
  const [attempt, setAttempt] = useState(0);
  const session = `${instance}-${attempt}`;
  const [launch, setLaunch] = useState<Continuation | null>(() => {
    if (handoff?.continuation.targetLevel === selected && handoff.owner === activeSession &&
        performance.now() - handoff.created < 1000) return copyContinuation(handoff.continuation);
    // GameShell's explicit restart/level selection is a same-session remount.
    // Capture the authenticated departing frame synchronously, not a stale timer.
    if (activeOwner && activeOwner.session === activeSession && (freshStart || activeOwner.level !== selected)) return activeOwner.capture(selected);
    return null;
  });
  const [entry] = useState(() => freshStart || launch ? "game" : "title");
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  const [state, setState] = useState<Summary | null>(null);
  const flags = useRef({paused, muted}); flags.current = {paused, muted};
  const callbacks = useRef({onComplete, onLevelChange, onStatus}); callbacks.current = {onComplete, onLevelChange, onStatus};
  const tokens = useRef({hintToken, undoToken});
  const held = useRef(new Map<number, string>());
  const pending = useRef(false), credited = useRef(false);
  const summary = useRef<Summary | null>(null);
  const base = new URL("./games/ghosted/index.html", document.baseURI);
  base.searchParams.set("session", session); base.searchParams.set("level", String(selected)); base.searchParams.set("entry", entry);
  if (launch) base.searchParams.set("continuation", launch.nonce);
  const send = (type: string, extra: Record<string, unknown> = {}) => frame.current?.contentWindow?.postMessage(
    {source: "playgarden-host", session, type, ...extra}, location.origin);
  const cancel = () => {held.current.clear(); send("cancel");};
  useEffect(() => {
    activeSession = session;
    if (handoff?.continuation.nonce === launch?.nonce) handoff = null;
    setReady(false); setError("");
    const target = frame.current?.contentWindow as FrameWindow | null;
    const post = (type: string, extra: Record<string, unknown> = {}) => target?.postMessage({source: "playgarden-host", session, type, ...extra}, location.origin);
    const connection = () => ({...flags.current, ...(launch ? {continuation: launch} : {})});
    const connect = () => post("connect", connection());
    let authenticated = false;
    const startupTimer = window.setTimeout(() => setError("游戏资源未能启动，请检查连接后重试。"), 10000);
    activeOwner = {session, level: selected, capture: (targetLevel) => {
      if (!authenticated || frame.current?.contentWindow !== target) return null;
      try {
        const native = observedNativeSession(target?.__ghostedSnapshot?.());
        if (!native || !Number.isInteger(targetLevel) || targetLevel < 1 || targetLevel > 13) return null;
        return {nonce: crypto.randomUUID(), fromSession: session, targetLevel, native};
      } catch { return null; }
    }};
    const receive = (event: MessageEvent) => {
      const data = event.data;
      if (event.source !== target || event.origin !== location.origin || !data || data.source !== "playgarden-ghosted" ||
          data.session !== session || data.revision !== REVISION) return;
      if (data.type === "loaded") connect();
      else if (data.type === "ready") {authenticated = true; clearTimeout(startupTimer); setError(""); setReady(true); post("mute", {muted: flags.current.muted}); post("pause", {paused: flags.current.paused});}
      else if (data.type === "snapshot" && isSummary(data.state)) {summary.current = data.state; setState(data.state);}
      else if (data.type === "error" && typeof data.message === "string") {clearTimeout(startupTimer); setReady(false); setError(data.message.slice(0, 180));}
      else if (authenticated && data.type === "complete" && data.level === selected && !pending.current && !credited.current) {
        credited.current = true; callbacks.current.onComplete();
        callbacks.current.onStatus(selected === 13 ? "噩梦关完成，原作结局已呈现。谢谢游玩！" : `原作第 ${selected} 关完成。可以继续在原版关卡菜单探索。`);
      } else if (authenticated && data.type === "level" && Number.isInteger(data.level) && data.level >= 1 && data.level <= 13 &&
          data.level !== selected && !pending.current) {
        // The receipt came from this exact authenticated iframe and was copied
        // from its current native snapshot immediately before this notification.
        if (!isContinuation(data.continuation) || data.continuation.fromSession !== session ||
            data.continuation.targetLevel !== data.level ||
            (data.level === 13 && !data.continuation.native.progress.slice(0, 12).every(Boolean))) {
          setError("原版关卡交接未能验证，请重试。"); return;
        }
        if (!callbacks.current.onLevelChange) {setError("宿主暂不支持同步关卡选择。"); return;}
        pending.current = true; held.current.clear(); post("cancel");
        handoff = {owner: session, created: performance.now(), continuation: copyContinuation(data.continuation)};
        callbacks.current.onLevelChange(data.level - 1);
      }
    };
    window.addEventListener("message", receive);
    window.addEventListener("blur", cancel);
    connect(); callbacks.current.onStatus(INTRO);
    return () => {
      clearTimeout(startupTimer); authenticated = false;
      window.removeEventListener("message", receive); window.removeEventListener("blur", cancel);
      held.current.clear(); target?.__ghostedDispose?.(); post("dispose");
      if (activeSession === session) activeSession = null;
      if (activeOwner?.session === session) activeOwner = null;
      queueMicrotask(() => {if (handoff?.owner === session) handoff = null;});
    };
    // The keyed shell owns level/reset remounts; callbacks stay current via refs.
  }, [session, selected, entry, launch]);
  useEffect(() => {if (ready) {if (paused) held.current.clear(); send("pause", {paused});}}, [ready, paused, session]);
  useEffect(() => {if (ready) send("mute", {muted});}, [ready, muted, session]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    callbacks.current.onStatus("人形可以推动岩石；13 步后变成幽灵，沿路留下黏液。苹果让你重新获得 13 步，金币只在幽灵形态收集。先观察落点，再决定何时变身。提示不会移动棋盘。");
  }, [hintToken]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (ready && !paused) send("tap", {code: "KeyZ"});
  }, [undoToken, ready, paused]);
  const down = (event: PointerEvent<HTMLButtonElement>, code: string) => {
    if (!ready || paused || pending.current || !event.isPrimary || event.button !== 0) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    held.current.set(event.pointerId, code); send("key", {code, down: true});
  };
  const up = (event: PointerEvent<HTMLButtonElement>) => {
    const code = held.current.get(event.pointerId); held.current.delete(event.pointerId);
    if (code) send("key", {code, down: false});
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const unlocked = state?.progress.slice(0, 12).every(Boolean) ?? false;
  return <section className="ghosted-host" data-ghosted-ready={ready} data-ghosted-scene={state?.scene ?? "loading"}>
    <header className="ghosted-heading"><div><span>GHOSTED · JANI NYKÄNEN</span><h3>十三步后，换一种走法。</h3></div><b>12 关 + 噩梦终章</b></header>
    <p>{INTRO}</p>
    <p className="ghosted-stage">当前选择：{selected === 13 ? "噩梦终章" : `第 ${selected} 关`} · 原版已完成 {state?.progress.filter(Boolean).length ?? 0}/13</p>
    {selected === 13 && !unlocked && <p className="ghosted-unlock" role="note">先在原版中完成全部 12 个普通关卡，才能进入噩梦终章。下方原版菜单可以继续未完成的关卡。</p>}
    <div className="ghosted-frame-wrap"><iframe key={session} ref={frame} src={base.href} title="Ghosted 原版游戏" tabIndex={paused ? -1 : 0} aria-hidden={paused} onLoad={() => send("connect", {...flags.current, ...(launch ? {continuation: launch} : {})})} />
      {!ready && !error && <div className="ghosted-cover">正在准备原版游戏…</div>}
    </div>
    <div className="ghosted-controls" role="group" aria-label="Ghosted 触控操作">{keys.map(key => <button key={key.code} type="button" data-ghosted-key={key.code} aria-label={key.label} disabled={!ready || paused || pending.current}
      onPointerDown={event => down(event, key.code)} onPointerUp={up} onPointerCancel={event => {up(event); cancel();}} onLostPointerCapture={up}
      onClick={event => {if (event.detail === 0 && ready && !paused) send("tap", {code: key.code});}}>{key.text}</button>)}</div>
    <p className="ghosted-instructions">点“确认”开始。原版标题与操作说明后，用方向键选择关卡，再确认。游戏中方向键移动，R 重试，Z 撤销；“菜单”打开原版暂停菜单。</p>
    {error && <div className="ghosted-start-error"><p role="alert">{error}</p><button type="button" onClick={() => {
      // A later runtime failure may follow new earns, native AUDIO changes or
      // successful saves. Capture the current/disposed frame before replacement;
      // never roll it back to its initial navigation receipt.
      const current = activeOwner && activeOwner.session === session ? activeOwner.capture(selected) : null;
      if (current) setLaunch(current);
      setReady(false); setError(""); pending.current = false; credited.current = false;
      summary.current = null; setState(null); held.current.clear(); setAttempt(value => value + 1);
    }}>重试载入 Ghosted</button></div>}
    {state && !state.saved && <p role="alert">浏览器未能保存本作进度；本次游戏仍可继续。退出本作或刷新页面会丢失尚未保存的通关记录。</p>}
    <details className="ghosted-help"><summary>规则、保存与原作来源</summary>
      <p>人形可以推动岩石；13 步后变成幽灵，并沿路留下黏液。幽灵收集金币，苹果恢复人形与 13 步。保留原作的坑洞、按钮、传送箭头、全部 13 张地图和真实结局。</p>
      <p>前 12 关可自由选择。全部完成后，原作自动进入第 13 关。首次进入保留原版标题和说明；游玩中用上方关卡选择可切换到对应关卡，并保留本次已取得的解锁记录和原版声音设置。选择锁定的终章仍会回到原版菜单，不会跳过解锁条件。</p>
      <p>仅保存已完成关卡；重新进入会从关卡初始局面开始，不保存中途棋盘。原版 DELETE DATA 只删除本作的解锁记录；平台通关徽章单独保存。上方“重来”重启当前选择，不清除已取得的原版进度。</p>
      <p>方向按钮可按住连走；松手、触摸取消或移出页面会释放输入。上方暂停冻结画面、时间和声音。声音同时受上方开关和原版 AUDIO 设置控制。</p>
      <p>原作（2024）署名 Jani Nykänen，固定版本 846454c。代码、地图、原像素图集和本地合成音乐依据原仓库 README 的 MIT 声明保留；本站中文宿主和新增适配按 GPL-3.0-only 提供。
        <a href="./games/ghosted/LICENSE-MIT.txt" target="_blank" rel="noreferrer">原作完整许可</a> · <a href="./games/ghosted/PLAYGARDEN-COPYING.txt" target="_blank" rel="noreferrer">适配许可</a> · <a href="./games/ghosted/source.tar.gz" download>本作模块源码与构建说明</a></p>
    </details>
  </section>;
}
