// SPDX-License-Identifier: GPL-3.0-only
(() => {
  let parked = 0, pickups = 0, collisionLosses = 0, bottomLosses = 0, run = 0, phase = "title";
  const originalScore = window.addScore, originalText = window.text;
  window.addScore = (...args) => {
    if (!window.isReplaying && window.__crispEngine.snapshot().phase === "inGame") {
      if (args[1] === gold) pickups++; else parked++;
    }
    return originalScore(...args);
  };
  window.text = (...args) => {
    if (args[0] === "X" && !window.isReplaying && window.__crispEngine.snapshot().phase === "inGame") {
      if (typeof args[1] === "object") collisionLosses++; else bottomLosses++;
    }
    return originalText(...args);
  };
  window.__crispHint = "按住让所有车辆一同右转，松开回正向上。驶入右侧黄色空位得分，拾取金币增加倍率；停得越多，同屏车辆越多。撞车或掉出底部就结束。";
  window.__crispObserve = () => {
    const now = window.__crispEngine.snapshot();
    if (now.run !== run) parked = pickups = collisionLosses = bottomLosses = 0;
    phase = now.phase; run = now.run;
    return { parked, pickups, collisionLosses, bottomLosses, carAngle: carAngle ?? -Math.PI / 2, carCount: carCount ?? 1,
      multiplier: multiplier ?? 1, roadY: roadY ?? 0,
      gold: gold ? { x: gold.x, y: gold.y } : null,
      cars: (cars ?? []).map(c => ({ x: c.pos.x, y: c.pos.y, color: c.color })),
      parkedCars: (parkedCars ?? []).map(c => ({ x: c.pos.x, y: c.pos.y, angle: c.angle, color: c.color })) };
  };
})();
