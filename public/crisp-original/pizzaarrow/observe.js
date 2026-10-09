// SPDX-License-Identifier: GPL-3.0-only
// Read-only event counters. Original update, drawing, sounds and scores run exactly once.
(() => {
  let run = -1, pulls = 0, shots = 0, autoShots = 0, yellowHits = 0, splits = 0, redLosses = 0;
  let lastCut = null, lastShot = null, priorWidth = null;
  const sync = () => {
    const s = window.__crispEngine.snapshot();
    if (s.run !== run) {
      run = s.run; pulls = shots = autoShots = yellowHits = splits = redLosses = 0;
      lastCut = lastShot = priorWidth = null;
    }
    return s.phase === "inGame" && !window.isReplaying;
  };
  const updateOriginal = window.update, playOriginal = window.play, scoreOriginal = window.addScore;
  window.update = function (...args) {
    sync(); priorWidth = pizza ? pizza.to - pizza.from : null;
    return updateOriginal.apply(this, args);
  };
  window.play = function (...args) {
    if (sync()) {
      if (args[0] === "select") pulls++;
      if (args[0] === "laser") {
        shots++;
        const automatic = !!arrow && arrow.x > 90 && !input.isJustReleased;
        if (automatic) autoShots++;
        lastShot = { automatic, frame: window.__crispEngine.snapshot().frames, x: arrow?.x ?? 0, gameSpeed };
      }
      if (args[0] === "hit") yellowHits++;
      if (args[0] === "explosion") redLosses++;
    }
    return playOriginal.apply(this, args);
  };
  window.addScore = function (...args) {
    if (sync()) {
      splits++;
      lastCut = { award: args[0], multiplier, removedRadians: pizzaPart.to - pizzaPart.from,
        beforeWidth: priorWidth, afterWidth: pizza.to - pizza.from, scoreBefore: score,
        frame: window.__crispEngine.snapshot().frames };
    }
    return scoreOriginal.apply(this, args);
  };
  window.__crispHint = "按住拉弓减慢转动，松开射出；拉满会自动发射。切下扇区按面积和倍率计分，黄色擦边可能只耗箭，碰红色内弧结束。每换一盘，所需箭数增加。";
  window.__crispObserve = () => {
    sync();
    return { pulls, shots, autoShots, yellowHits, splits, glancingHits: yellowHits - splits, redLosses, lastCut, lastShot,
      pizza: pizza ? { from: pizza.from, to: pizza.to, angle: pizza.angle, angleVel: pizza.angleVel, y: pizza.y } : null,
      pizzaPart: pizzaPart ? { from: pizzaPart.from, to: pizzaPart.to, x: pizzaPart.pos.x, y: pizzaPart.pos.y } : null,
      arrow: arrow ? { x: arrow.x, vx: arrow.vx } : null,
      arrowCount: arrowCount ?? 1, nextArrowCount: nextArrowCount ?? 1, nextPizzaTicks: nextPizzaTicks ?? 0,
      gameSpeed: gameSpeed ?? 1, multiplier: multiplier ?? 1 };
  };
})();
