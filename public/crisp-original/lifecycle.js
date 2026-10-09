// SPDX-License-Identifier: GPL-3.0-only
(() => {
  let context = null, destination = null, muted = true, paused = false, unlocked = false, disposed = false;
  const voices = new Set();
  let closing = Promise.resolve();
  const changed = () => window.__crispAudioChanged?.();
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (Context) {
      context = new Context();
      context.addEventListener("statechange", changed);
      destination = context.createGain();
      destination.gain.value = 0;
      destination.connect(context.destination);
      const create = context.createBufferSource.bind(context);
      context.createBufferSource = () => {
        const voice = create();
        voices.add(voice);
        voice.addEventListener("ended", () => voices.delete(voice), { once: true });
        return voice;
      };
      context.suspend().catch(() => {});
    }
  } catch {
    if (context) { context.removeEventListener("statechange", changed); context.close().catch(() => {}); }
    context = null; destination = null;
  }
  function gain() {
    if (destination && context.state !== "closed") destination.gain.setValueAtTime(disposed || muted || paused || !unlocked ? 0 : 1, context.currentTime);
  }
  function reconcile() {
    gain();
    if (!context || context.state === "closed") return;
    if (disposed || paused || !unlocked) {
      context.suspend().catch(() => {});
    } else {
      context.resume().then(() => { gain(); if (disposed || paused) context.suspend().catch(() => {}); }).catch(() => {});
    }
  }
  window.__crispAudio = Object.freeze({
    context, destination,
    gesture() {
      if (disposed || paused) return;
      unlocked = true;
      if (context && window.sss) window.sss.startAudio();
      reconcile();
    },
    setMuted(value) { muted = !!value; gain(); },
    setPaused(value) { paused = !!value; reconcile(); },
    dispose() {
      if (disposed) return closing;
      disposed = true; gain();
      for (const voice of voices) { try { voice.stop(); } catch {} try { voice.disconnect(); } catch {} }
      voices.clear();
      if (destination) destination.disconnect();
      if (context && context.state !== "closed") closing = context.close().catch(() => {}).then(() => context.removeEventListener("statechange", changed));
      return closing;
    },
    snapshot() { return { state: context?.state ?? "unavailable", muted, paused, unlocked, disposed, voices: voices.size, gain: destination?.gain.value ?? 0 }; },
  });
})();
