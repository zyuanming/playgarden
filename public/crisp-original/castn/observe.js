// SPDX-License-Identifier: GPL-3.0-only
(() => {
  let blue = 0, red = 0, casts = 0, pulls = 0, run = 0, phase = "title", oldNet = "ready";
  const originalScore = window.addScore;
  window.addScore = (...args) => {
    if (!window.isReplaying && window.__crispEngine.snapshot().phase === "inGame") {
      if (args[0] < 0) red++; else blue++;
    }
    return originalScore(...args);
  };
  window.__crispHint = "按住蓄力，松开抛网；网落入鱼群后再点一下收网。蓝鱼降水加分，红鱼涨水扣分。水淹岸边便结束。";
  window.__crispObserve = () => {
    const now = window.__crispEngine.snapshot();
    if (now.run !== run) { blue = red = casts = pulls = 0; oldNet = "ready"; }
    phase = now.phase; run = now.run;
    if (!now.replaying && phase === "inGame") {
      if (nodesState === "throw" && oldNet !== "throw") casts++;
      if (nodesState === "pull" && oldNet !== "pull") pulls++;
      oldNet = nodesState;
    }
    return { blue, red, casts, pulls, net: nodesState ?? "ready", power: throwPower ?? 0, waterY: waterY ?? 40,
      multiplier: multiplier ?? 1, nodes: (nodes ?? []).map(n => ({ x: n.pos.x, y: n.pos.y })),
      fishes: (fishes ?? []).map(f => ({ x: f.pos.x, y: f.pos.y, vx: f.vel.x, type: f.type })) };
  };
})();
