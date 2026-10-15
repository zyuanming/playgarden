// SPDX-License-Identifier: GPL-3.0-only
// New Playgarden lifecycle bridge. Upstream-derived modules retain MIT notices.
import { startGame } from "./engine.js";
import {copyContinuation, isContinuation, observedNativeSession, type Continuation} from "./continuation.js";

const parameters = new URLSearchParams(location.search);
const session = parameters.get("session") ?? "";
const selected = Number(parameters.get("level"));
const valid = /^[a-zA-Z0-9-]{16,80}$/.test(session) && Number.isInteger(selected) && selected >= 1 && selected <= 13;
const direct = parameters.get("entry") === "game";
const expectedReceipt = parameters.get("continuation");
let acceptedReceipt: Continuation | undefined;
const origin = location.origin;
const revision = "ghosted-846454c-playgarden-1";
const controls: Record<string, string> = {ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", Enter: "Enter", Space: " ", Escape: "Escape", Backspace: "Backspace", KeyR: "r", KeyZ: "z"};
let runtime: ReturnType<typeof startGame> | undefined;
let runningEvents: AbortController | undefined;
let interval = 0;
let hostPaused = true;
let hostMuted = true;
let changingLevel = false;
let finalCleared = false;
let lastComplete = 0;
let readySent = false;
let lastSnapshot: ReturnType<ReturnType<typeof startGame>["snapshot"]> | undefined;
const pulseTimers = new Set<number>();
const send = (type: string, extra: Record<string, unknown> = {}) => {
    if (valid && parent !== window) parent.postMessage({source: "playgarden-ghosted", revision, session, type, ...extra}, origin);
};
const snapshot = () => runtime?.snapshot() ?? (lastSnapshot ? structuredClone(lastSnapshot) : null);
const observe = () => {
    const state = snapshot();
    if (runtime && state?.assetsLoaded && !readySent) { readySent = true; send("ready"); }
    if (state) send("snapshot", {state: {scene: state.scene, initialized: state.initialized, paused: state.paused,
        progress: state.progress, saved: state.saved, game: state.game && {level: state.game.level, cleared: state.game.cleared}}});
};
const effectivePause = () => runtime?.program.setPaused(hostPaused || document.hidden || changingLevel);
const cancelInput = () => {
    pulseTimers.forEach(id => clearTimeout(id)); pulseTimers.clear(); runtime?.program.clearInput();
};
const dispose = () => {
    runningEvents?.abort(); runningEvents = undefined;
    clearInterval(interval); interval = 0; cancelInput();
    if (runtime) { runtime.program.dispose(); lastSnapshot = runtime.snapshot(); runtime = undefined; }
};
const boot = () => {
    if (runtime || !valid) return;
    changingLevel = false; finalCleared = false; lastComplete = 0; readySent = false;
    runningEvents = new AbortController();
    const signal = runningEvents.signal;
    const fail = (message: string) => { dispose(); send("error", {message}); };
    window.addEventListener("error", () => fail("原版游戏发生启动错误，请重试。"), {signal});
    window.addEventListener("unhandledrejection", () => fail("原版游戏发生运行错误，请重试。"), {signal});
    window.addEventListener("ghosted-level", ((event: CustomEvent<number>) => {
        const level = event.detail;
        if (!Number.isInteger(level) || level < 1 || level > 13) return;
        if (level === selected) return;
        // This event is produced only by the original menu or earned finale transition.
        // Observe immediately before the navigation message, not an older timer sample.
        const native = observedNativeSession(runtime?.snapshot());
        if (!native || (level === 13 && !native.progress.slice(0, 12).every(Boolean))) return;
        const continuation: Continuation = {nonce: crypto.randomUUID(), fromSession: session, targetLevel: level, native};
        changingLevel = true; cancelInput(); effectivePause(); observe();
        send("level", {level, continuation});
    }) as EventListener, {signal});
    window.addEventListener("ghosted-complete", ((event: CustomEvent<number>) => {
        if (event.detail !== selected || changingLevel || lastComplete === selected) return;
        if (selected === 13) { finalCleared = true; return; }
        lastComplete = selected; send("complete", {level: selected}); observe();
    }) as EventListener, {signal});
    window.addEventListener("ghosted-scene", ((event: CustomEvent<string>) => {
        if (event.detail === "e" && selected === 13 && finalCleared && lastComplete !== 13) {
            lastComplete = 13; send("complete", {level: 13});
        }
        observe();
    }) as EventListener, {signal});
    window.addEventListener("ghosted-error", ((event: CustomEvent<string>) => fail(String(event.detail).slice(0, 180))) as EventListener, {signal});
    // StrictMode can reconnect this same frame after disposal. Its last actual
    // observation takes precedence over the original one-use navigation receipt.
    const carried = observedNativeSession(lastSnapshot) ?? acceptedReceipt?.native;
    try { runtime = startGame(selected, direct, carried); }
    catch (error) {
        dispose(); send("error", {message: "原版游戏启动失败，请重试。"}); return;
    }
    runtime.program.setMuted(hostMuted); effectivePause();
    interval = window.setInterval(observe, 250);
    observe();
};
window.addEventListener("message", (event: MessageEvent) => {
    if (!valid || event.source !== parent || event.origin !== origin || !event.data ||
        event.data.source !== "playgarden-host" || event.data.session !== session) return;
    const data = event.data;
    switch (data.type) {
    case "connect":
        if (typeof data.paused !== "boolean" || typeof data.muted !== "boolean") return;
        if (!runtime && !acceptedReceipt && expectedReceipt !== null) {
            if (!isContinuation(data.continuation) || data.continuation.nonce !== expectedReceipt ||
                data.continuation.targetLevel !== selected || data.continuation.fromSession === session) {
                send("error", {message: "关卡交接未能验证，请重试。"}); return;
            }
            acceptedReceipt = copyContinuation(data.continuation);
        } else if (expectedReceipt === null && data.continuation !== undefined) return;
        hostPaused = data.paused; hostMuted = data.muted;
        boot(); runtime?.program.setMuted(hostMuted); effectivePause();
        if (runtime) observe(); break;
    case "pause":
        if (typeof data.paused !== "boolean") return;
        hostPaused = data.paused; cancelInput(); effectivePause(); observe(); break;
    case "mute":
        if (typeof data.muted !== "boolean") return;
        hostMuted = data.muted; runtime?.program.setMuted(hostMuted); observe(); break;
    case "key": {
        if (typeof data.code !== "string" || !Object.hasOwn(controls, data.code) ||
            typeof data.down !== "boolean" || hostPaused || changingLevel || document.hidden) return;
        runtime?.program.input(data.code, controls[data.code], data.down); break;
    }
    case "tap": {
        if (typeof data.code !== "string" || !Object.hasOwn(controls, data.code) ||
            hostPaused || changingLevel || document.hidden || pulseTimers.size >= 10) return;
        const code: string = data.code;
        runtime?.program.input(code, controls[code], true);
        const id = window.setTimeout(() => { pulseTimers.delete(id); runtime?.program.input(code, controls[code], false); }, 60);
        pulseTimers.add(id); break;
    }
    case "cancel": cancelInput(); break;
    case "dispose": dispose(); break;
    }
});
document.addEventListener("visibilitychange", () => {cancelInput(); effectivePause(); observe();});
window.addEventListener("pagehide", dispose, {once: true});
Object.defineProperty(window, "__ghostedSnapshot", {value: snapshot, configurable: false, writable: false});
Object.defineProperty(window, "__ghostedDispose", {value: dispose, configurable: false, writable: false});
if (valid) send("loaded");
else document.body.textContent = "请从 Playgarden 的 Ghosted 页面启动游戏。";
