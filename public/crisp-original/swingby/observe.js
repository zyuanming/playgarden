// SPDX-License-Identifier: GPL-3.0-only
// Snapshot-only telemetry: the original ship, stars, damage and non-monotonic score stay untouched.
(() => {
  let run = -1, collisionFrames = 0, healingFrames = 0, heldFrames = 0, releasedFrames = 0, starGenerations = 0;
  let maxDamage = 0, lastDamageDelta = 0, lastCollision = null, lastRecovery = null;
  const sync = () => {
    const s = window.__crispEngine.snapshot();
    if (s.run !== run) {
      run = s.run; collisionFrames = healingFrames = heldFrames = releasedFrames = starGenerations = 0;
      maxDamage = lastDamageDelta = 0; lastCollision = lastRecovery = null;
    }
    return s.phase === "inGame" && !window.isReplaying;
  };
  const originalUpdate = window.update;
  window.update = function (...args) {
    const active = sync(), before = ticks ? (hitCount ?? 0) : 0;
    const oldAddX = starAddPos?.x ?? 0, oldAddY = starAddPos?.y ?? 0;
    const result = originalUpdate.apply(this, args);
    if (active) {
      if (input.isPressed) heldFrames++; else releasedFrames++;
      lastDamageDelta = hitCount - before;
      maxDamage = Math.max(maxDamage, hitCount);
      const event = { before, after: hitCount, x: ship.pos.x, y: ship.pos.y, difficulty, ticks };
      if (lastDamageDelta > 0) { collisionFrames++; lastCollision = event; }
      if (lastDamageDelta < 0) { healingFrames++; lastRecovery = event; }
      if (ticks && (starAddPos.x !== oldAddX || starAddPos.y !== oldAddY)) starGenerations++;
    }
    return result;
  };
  window.__crispHint = "按住向右侧推，松开继续受引力飞行。分数是离起点的直线距离，返回时会减少；擦碰会累积损伤，离开星体后恢复，超过 99 才结束。";
  window.__crispObserve = () => {
    sync();
    return { ship: ship ? { x: ship.pos.x, y: ship.pos.y, vx: ship.vel.x, vy: ship.vel.y } : null,
      hitCount: hitCount ?? 0, collisionFrames, healingFrames, heldFrames, releasedFrames, starGenerations,
      maxDamage, lastDamageDelta, lastCollision, lastRecovery,
      stars: (stars ?? []).map(s => ({ x: s.pos.x, y: s.pos.y, radius: s.radius, screenX: s.screenPos.x, screenY: s.screenPos.y })),
      starAddPos: starAddPos ? { x: starAddPos.x, y: starAddPos.y } : null,
      shipScreenPos: shipScreenPos ? { x: shipScreenPos.x, y: shipScreenPos.y } : null };
  };
})();
