// SPDX-License-Identifier: GPL-3.0-only
(() => {
  const game = location.pathname.split("/").at(-2);
  const supportsReplay = window.options?.isReplayEnabled === true;
  const names = { makemaze: "迷墙导金", "count-observe": "数形定格", cardq: "纸牌争先", castn: "抛网捕鱼", bamboo: "竹林巧收", parking: "同步泊车", pizzaarrow: "披萨神箭", rps: "猜拳四轨", swingby: "引力远航" };
  if (!(game in names)) throw new Error("Unknown original game");
  const session = new URLSearchParams(location.search).get("session") || "";
  const engine = window.__crispEngine, audio = window.__crispAudio;
  const control = new AbortController();
  const listen = (target, type, handler) => target.addEventListener(type, handler, { signal: control.signal });
  const key = `playgarden.crisp.${game}.records`;
  let best = 0, runs = 0, lastPhase = "title", disposed = false, hostPaused = false, localPaused = false;
  let lastScore = 0, lastPostedFrame = -1;
  const overlay = document.getElementById("crisp-pause");
  try {
    const record = JSON.parse(localStorage.getItem(key) || "null");
    if (record && Number.isFinite(record.best)) best = Math.max(0, record.best);
    if (record && Number.isInteger(record.runs)) runs = Math.max(0, record.runs);
  } catch {}
  const send = (type, data = {}) => parent.postMessage({ source: "playgarden-crisp", session, game, type, ...data }, location.origin);
  function publish(force = false) {
    const live = engine.snapshot();
    if (live.phase === "gameOver" && lastPhase !== "gameOver" && !live.replaying) {
      runs++; best = Math.max(best, Math.floor(live.score));
      try { localStorage.setItem(key, JSON.stringify({ best, runs })); } catch {}
      send("status", { message: `本局 ${Math.floor(live.score)} 分，最高 ${best} 分。点击画布再来一局；${supportsReplay ? "稍候会回放刚才的操作。" : "稍候返回标题页。"}` });
    }
    if (live.phase === "inGame" && lastPhase !== "inGame") {
      send("status", { message: `${names[game]}已开始。${window.__crispHint}` });
    }
    if (lastPhase !== live.phase || lastScore !== live.score) force = true;
    lastPhase = live.phase; lastScore = live.score;
    const state = { ...live, best, runs, audio: audio.snapshot(), mechanics: window.__crispObserve(), hostPaused, localPaused };
    // Read-only DOM evidence for accessibility and real-input E2E. It never changes gameplay.
    document.body.dataset.crispState = JSON.stringify(state);
    document.body.dataset.crispPhase = live.phase;
    if (force || live.frames - lastPostedFrame >= 8) {
      send("snapshot", { state }); lastPostedFrame = live.frames;
    }
  }
  function pause() {
    const value = hostPaused || localPaused || document.hidden;
    engine.pause(value); audio.setPaused(value);
    overlay.hidden = !value || hostPaused;
    publish(true);
  }
  function dispose() {
    if (disposed) return;
    disposed = true; engine.dispose();
    const closed = audio.dispose();
    control.abort(); window.__crispAfterFrame = null;
    publish(true);
    return Promise.resolve(closed).then(() => { publish(true); send("disposed", { state: engine.snapshot(), audio: audio.snapshot() }); window.__crispAudioChanged = null; });
  }
  window.__crispAfterFrame = publish;
  window.__crispAudioChanged = () => publish(true);
  window.__crispDispose = dispose;
  listen(window, "message", (event) => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.source !== "playgarden-host" || event.data.session !== session) return;
    const data = event.data;
    if (data.type === "dispose") return dispose();
    if (disposed) return;
    if (data.type === "pause") {
      hostPaused = !!data.paused;
      if (!hostPaused) localPaused = false;
      pause();
    } else if (data.type === "mute") { audio.setMuted(data.muted); publish(true); }
    else if (data.type === "restart") { engine.restart(); publish(true); }
    else if (data.type === "hint") send("status", { message: window.__crispHint });
  });
  listen(document, "keydown", (event) => {
    if (!["KeyP", "Escape"].includes(event.code) || event.repeat) return;
    event.preventDefault();
    if (hostPaused) return;
    localPaused = !localPaused; pause();
    if (!localPaused) audio.gesture();
  });
  listen(overlay, "pointerdown", (event) => {
    event.preventDefault();
    if (hostPaused) return;
    localPaused = false; pause(); audio.gesture();
  });
  listen(window, "blur", () => { if (!disposed) { localPaused = true; pause(); } });
  listen(document, "visibilitychange", () => { if (document.hidden) localPaused = true; pause(); });
  listen(window, "pagehide", dispose);
  listen(window, "error", (event) => { send("error", { message: event.message }); dispose(); });
  try {
    window.onLoad();
    audio.setMuted(true);
    publish(true);
    send("ready", { revision: "crisp-cfb39d2f-playgarden-1", endless: true });
  } catch (error) { send("error", { message: String(error) }); dispose(); }
})();
