// SPDX-License-Identifier: GPL-3.0-only
// Observation only: delegate every original call unchanged and return copied data.
(() => {
  let run = -1, wallEdits = 0, goldCollected = 0, angryMoves = 0;
  let brokenWalls = 0, escapes = 0, losses = 0, nextIdentity = 1;
  let lastEdit = null, lastGold = null, lastAngry = null, lastBreak = null;
  let lastEscape = null, lastLoss = null;
  let identities = new WeakMap();
  const point = p => ({ x: p.x, y: p.y });
  const identify = p => {
    if (!identities.has(p)) identities.set(p, nextIdentity++);
    return identities.get(p);
  };
  const sync = () => {
    const s = window.__crispEngine.snapshot();
    if (s.run !== run) {
      run = s.run; wallEdits = goldCollected = angryMoves = brokenWalls = escapes = losses = 0;
      lastEdit = lastGold = lastAngry = lastBreak = lastEscape = lastLoss = null;
      identities = new WeakMap(); nextIdentity = 1;
    }
    return s.phase === "inGame" && !window.isReplaying;
  };
  const frame = () => window.__crispEngine.snapshot().frames;
  const playOriginal = window.play, removeGoldOriginal = window.removeGold;
  const checkExitOriginal = window.checkDownExit, addScoreOriginal = window.addScore;
  const updateOriginal = window.update;
  window.play = function (...args) {
    if (sync()) {
      if (args[0] === "select") {
        const x = Math.floor((input.pos.x - wallOfs.x + 3) / 6);
        const y = Math.floor((input.pos.y - wallOfs.y + 3) / 6);
        wallEdits++;
        lastEdit = { frame: frame(), x, y, before: walls[x][y], after: !walls[x][y],
          onGold: golds.some(g => g.x === x && g.y === y) };
      } else if (args[0] === "powerUp") {
        brokenWalls++;
        const x = lastAngry.x, y = lastAngry.y + 1;
        lastBreak = { frame: frame(), x, y, before: walls[x][y], after: null };
      } else if (args[0] === "lucky") {
        losses++;
        lastLoss = { frame: frame(), missed: golds.filter(g => g.y * 6 + wallOfs.y < 0)
          .map(g => ({ ...point(g), screenY: g.y * 6 + wallOfs.y })) };
      }
    }
    return playOriginal.apply(this, args);
  };
  window.removeGold = function (...args) {
    const active = sync(), p = args[0];
    const collected = active && golds.find(g => p.x === g.x && p.y === g.y);
    const before = score, award = multiplier;
    const event = collected ? { frame: frame(), id: identify(collected), ...point(collected),
      award, scoreBefore: before, multiplierBefore: multiplier } : null;
    const result = removeGoldOriginal.apply(this, args);
    if (event) {
      goldCollected++;
      lastGold = { ...event, scoreAfter: score, multiplierAfter: multiplier };
    }
    return result;
  };
  window.checkDownExit = function (...args) {
    const result = checkExitOriginal.apply(this, args);
    if (sync() && !result) {
      angryMoves++;
      lastAngry = { frame: frame(), ...point(args[0]), downExit: false };
    }
    return result;
  };
  window.addScore = function (...args) {
    const active = sync(), before = score;
    const result = addScoreOriginal.apply(this, args);
    if (active && args[0] < 0) {
      escapes++;
      lastEscape = { frame: frame(), award: args[0], scoreBefore: before,
        scoreAfter: score, multiplierAfter: multiplier, missScrAfter: missScr };
    }
    return result;
  };
  window.update = function (...args) {
    const active = sync(), before = brokenWalls;
    const result = updateOriginal.apply(this, args);
    if (active && brokenWalls > before) lastBreak.after = walls[lastBreak.x][lastBreak.y];
    return result;
  };
  window.__crispHint = "点按或拖动格子增删墙，让自动行进的小人经过金币。堵住向下出口会让小人变红拆墙；金币滚出顶部就结束。";
  window.__crispObserve = () => {
    sync();
    // No reference to an original array, Vector, entity, or event escapes this function.
    return JSON.parse(JSON.stringify({ wallEdits, goldCollected, angryMoves, brokenWalls,
      escapes, losses, lastEdit, lastGold, lastAngry, lastBreak, lastEscape, lastLoss,
      size: { x: wallSize.x, y: wallSize.y }, offset: wallOfs ? point(wallOfs) : { x: 5, y: -2 },
      walls: walls?.map(column => [...column]) ?? [],
      golds: golds?.map(g => ({ id: identify(g), ...point(g), screenY: g.y * 6 + wallOfs.y })) ?? [],
      enemies: enemies?.map(e => ({ id: identify(e), ...point(e.pos), screen: point(e.scPos),
        angle: e.angle, angleVel: e.angleVel, ticks: e.ticks, moveInterval: e.moveInterval,
        angry: e.isAngry })) ?? [],
      multiplier: multiplier ?? 1, missScr: missScr ?? 0, nextEnemyTicks: nextEnemyTicks ?? 0,
      goldMinY: goldMinY ?? 99, previousWall: pwp ? point(pwp) : null }));
  };
})();
