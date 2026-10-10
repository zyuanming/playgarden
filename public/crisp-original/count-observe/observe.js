// SPDX-License-Identifier: GPL-3.0-only
// Copies original state and drawing events. No setters, synthetic input, timer,
// random calls, score writes, or changes to original update/drawing arguments.
(() => {
  let run = -1, turnsCreated = 0, correctAnswers = 0, wrongAnswers = 0;
  let counterAdvances = 0, losses = 0, lastAnswer = null;
  let display = { counter: null, result: null, answer: null, objects: [] };
  let observing = false;
  const copyObjects = () => (objs ?? []).map(o => ({
    x: o.p.x, y: o.p.y, type: o.type, color: o.color, scale: o.scale,
  }));
  const copyTargets = () => (targets ?? []).map(o => ({ type: o.type, color: o.color }));
  const sync = () => {
    const state = window.__crispEngine.snapshot();
    if (state.run !== run) {
      run = state.run; turnsCreated = correctAnswers = wrongAnswers = counterAdvances = losses = 0;
      lastAnswer = null;
      display = { counter: null, result: null, answer: null, objects: [] };
    }
    return state;
  };
  const drawCharacter = window.char, drawText = window.text, originalUpdate = window.update;
  window.char = function (...args) {
    if (observing && typeof args[1] === "object" && /^[a-i]$/.test(args[0])) {
      const n = args[0].charCodeAt(0) - 97;
      display.objects.push({ x: args[1].x, y: args[1].y,
        type: Math.floor(n / 3), color: n % 3, scale: args[2]?.scale?.x ?? 1 });
    }
    return drawCharacter.apply(this, args);
  };
  window.text = function (...args) {
    if (observing) {
      if (/^\? \d+$/.test(args[0])) display.counter = Number(args[0].slice(2));
      if (args[0] === "OK!" || args[0] === "ERROR") display.result = args[0];
      if (args[1] === 50 && args[2] === 50 && args[3]?.scale?.x === 3) display.answer = Number(args[0]);
    }
    return drawText.apply(this, args);
  };
  window.update = function (...args) {
    const state = sync();
    const active = state.phase === "inGame" && !state.replaying;
    const before = active ? { submitted: !!isPressed, count: count ?? 0,
      score, generated: ticks === 0 || !objs?.length, objects: copyObjects(),
      targets: copyTargets(), input: !!input.isJustPressed } : null;
    if (active) display = { counter: null, result: null, answer: null, objects: [] };
    observing = active;
    let result;
    try { result = originalUpdate.apply(this, args); }
    finally { observing = false; }
    if (active) {
      if (before.generated) turnsCreated++;
      if (!before.generated && count > before.count) counterAdvances++;
      if (!before.submitted && isPressed) {
        const correct = count === targetCount;
        if (correct) correctAnswers++; else wrongAnswers++;
        lastAnswer = { frame: state.frames, turn, count, targetCount, correct,
          automatic: !before.input, scoreBefore: before.score, scoreAfter: score,
          objects: before.generated ? copyObjects() : before.objects,
          targets: before.generated ? copyTargets() : before.targets };
      }
      if (window.__crispEngine.snapshot().phase === "gameOver") losses++;
    }
    return result;
  };
  window.__crispHint = "数出下方与上方任一小图标形状、颜色都相同的物体，大小不影响计数。问号后的数字会自动增加，等于总数时点一下停住；不是点物体加数。";
  window.__crispObserve = () => {
    sync();
    // Every nested object is a detached copy, including historical evidence.
    return JSON.parse(JSON.stringify({ turnsCreated, correctAnswers, wrongAnswers,
      counterAdvances, losses, lastAnswer, turn: turn ?? 0, count: count ?? 0,
      countdown: countTicks ?? 79, submitted: !!isPressed, revealTicks: nextTurnTicks ?? 0,
      targetIcons: copyTargets(), display, supportsReplay: false }));
  };
})();
