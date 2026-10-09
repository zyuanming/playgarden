// SPDX-License-Identifier: GPL-3.0-only
(() => {
  let harvests = 0, bounces = 0, heldPasses = 0, run = 0, phase = "title", held = new WeakSet();
  const originalScore = window.addScore, originalPlay = window.play;
  window.addScore = (...args) => {
    if (!window.isReplaying && window.__crispEngine.snapshot().phase === "inGame") harvests++;
    return originalScore(...args);
  };
  window.play = (sound) => {
    if (sound === "hit" && !window.isReplaying && window.__crispEngine.snapshot().phase === "inGame") bounces++;
    return originalPlay(sound);
  };
  window.__crispHint = "小人会自动往前走，点一下反向，按住会穿过竹子。黄色成熟竹能收割，接近最高成熟度奖励 100 分；绿竹会反弹，长到顶端就结束。";
  window.__crispObserve = () => {
    const now = window.__crispEngine.snapshot();
    if (now.run !== run) { harvests = bounces = heldPasses = 0; held = new WeakSet(); }
    phase = now.phase; run = now.run;
    if (!now.replaying && now.phase === "inGame" && input.isPressed) {
      (bamboos ?? []).forEach(b => { if (Math.abs(b.x - x) < 5 && b.height >= 5 && !held.has(b)) { held.add(b); heldPasses++; } });
    }
    return { harvests, bounces, heldPasses, x: x ?? 190, vx: vx ?? 1, avx: avx ?? 0,
      bamboos: (bamboos ?? []).map(b => ({ x: b.x, height: b.height, speed: b.speed })) };
  };
})();
