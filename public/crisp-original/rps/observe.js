// SPDX-License-Identifier: GPL-3.0-only
// Observe the original sound/score/update boundaries without altering simulation state.
(() => {
  let run = -1, wins = 0, ties = 0, defeats = 0, acceptedInputs = 0, blockedInputs = 0, bottomLosses = 0;
  let lastEncounter = null, lastWin = null, lastTie = null, lastDefeat = null;
  const sync = () => {
    const s = window.__crispEngine.snapshot();
    if (s.run !== run) {
      run = s.run; wins = ties = defeats = acceptedInputs = blockedInputs = bottomLosses = 0;
      lastEncounter = lastWin = lastTie = lastDefeat = null;
    }
    return s.phase === "inGame" && !window.isReplaying;
  };
  const playOriginal = window.play, updateOriginal = window.update;
  window.play = function (...args) {
    if (sync()) {
      const sound = args[0];
      if (sound === "select") acceptedInputs++;
      if (sound === "explosion") bottomLosses++;
      const kind = sound === "coin" ? "win" : sound === "laser" ? "tie" : sound === "hit" ? "defeat" : null;
      if (kind && myHand) {
        const enemy = hands.find(h => h.lane === lanes[myHand.laneIndex] && Math.abs(myHand.ty - h.y) < 5 &&
          ((myHand.type - h.type + 3) % 3) === (kind === "win" ? 1 : kind === "tie" ? 0 : 2));
        lastEncounter = { kind, playerType: myHand.type, enemyType: enemy?.type ?? null,
          laneIndex: myHand.laneIndex, scoreBefore: score, multiplierBefore: multiplier,
          award: kind === "win" ? multiplier : 0, frame: window.__crispEngine.snapshot().frames,
          freezeTicks: kind === "defeat" ? 60 / Math.sqrt(difficulty) : myHand.freezeTicks };
        if (kind === "win") { wins++; lastWin = lastEncounter; }
        else if (kind === "tie") { ties++; lastTie = lastEncounter; }
        else { defeats++; lastDefeat = lastEncounter; }
      }
    }
    return playOriginal.apply(this, args);
  };
  window.update = function (...args) {
    const active = sync(), beforeInputs = acceptedInputs, pressed = input.isJustPressed;
    const result = updateOriginal.apply(this, args);
    if (active && pressed && beforeInputs === acceptedInputs && myHand?.freezeTicks >= 0) blockedInputs++;
    return result;
  };
  window.__crispHint = "每点一下同时右移一轨、轮换石头布剪刀。赢拳加分并升倍率，平局顶回，输拳冻结且重置倍率；有敌手漏到最底部才结束。";
  window.__crispObserve = () => {
    sync();
    return { wins, ties, defeats, acceptedInputs, blockedInputs, bottomLosses, lastEncounter, lastWin, lastTie, lastDefeat,
      multiplier: multiplier ?? 1,
      myHand: myHand ? { laneIndex: myHand.laneIndex, x: myHand.pos.x, y: myHand.pos.y, targetY: myHand.ty,
        vy: myHand.vy, type: myHand.type, freezeTicks: myHand.freezeTicks } : null,
      hands: (hands ?? []).map(h => ({ laneIndex: lanes.indexOf(h.lane), y: h.y, my: h.my, baseMy: h.baseMy, type: h.type, isDestroyed: h.isDestroyed })),
      lanes: (lanes ?? []).map(l => ({ x: l.x, handType: l.handType, nextTicks: l.nextTicks })) };
  };
})();
