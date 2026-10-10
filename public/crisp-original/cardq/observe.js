// SPDX-License-Identifier: GPL-3.0-only
// Read-only observation at original sound/update boundaries. No gameplay state is written.
(() => {
  let run = -1, playerMoves = 0, enemyMoves = 0, mistakes = 0, shuffles = 0, losses = 0;
  let lastPlayer = null, lastEnemy = null, lastMistake = null, lastShuffle = null;
  let pilesBeforeUpdate = [];
  const front = (cards) => (cards ?? []).filter(c => c.gPos.y === 0)
    .map(c => ({ column: c.gPos.x, num: c.num })).sort((a, b) => a.column - b.column);
  const sync = () => {
    const s = window.__crispEngine.snapshot();
    if (s.run !== run) {
      run = s.run; playerMoves = enemyMoves = mistakes = shuffles = losses = 0;
      lastPlayer = lastEnemy = lastMistake = lastShuffle = null;
    }
    return s.phase === "inGame" && !window.isReplaying;
  };
  const playOriginal = window.play, updateOriginal = window.update;
  window.play = function (...args) {
    if (sync()) {
      const sound = args[0], frame = window.__crispEngine.snapshot().frames;
      if (sound === "coin") {
        const placed = placedCards.at(-1);
        const pile = placed.tPos.x < 50 ? 0 : 1;
        const prior = placedCards.slice(0, -1).reverse().find(c => c.tPos.x === placed.tPos.x);
        playerMoves++;
        lastPlayer = { frame, column: Math.floor((input.pos.x - 50) / 15 + 2.5),
          pile, num: placed.num, previousNum: prior?.num ?? pilesBeforeUpdate[pile] ?? null,
          scoreBefore: score, award: multiplier, targetBefore: targetCenterY,
          frontAfter: front(playerCards), cardCount: playerCards.length };
      } else if (sound === "hit") {
        mistakes++;
        lastMistake = { frame, column: Math.floor((input.pos.x - 50) / 15 + 2.5),
          piles: [...placedCardNumbers], front: front(playerCards),
          scoreBefore: score, multiplierBefore: multiplier, targetBefore: targetCenterY };
      } else if (sound === "select") {
        enemyMoves++;
        lastEnemy = { frame, column: enemyNextMoveIndex, pilesBefore: [...placedCardNumbers],
          frontBefore: front(enemyCards), targetBefore: targetCenterY };
      } else if (sound === "powerUp") {
        shuffles++;
        lastShuffle = { frame, pilesBefore: [...placedCardNumbers] };
      } else if (sound === "explosion") losses++;
    }
    return playOriginal.apply(this, args);
  };
  window.update = function (...args) {
    const active = sync(), beforePlayer = playerMoves, beforeMistakes = mistakes;
    const beforeEnemy = enemyMoves, beforeShuffle = shuffles;
    pilesBeforeUpdate = [...(placedCardNumbers ?? [])];
    const result = updateOriginal.apply(this, args);
    if (active) {
      if (playerMoves > beforePlayer) Object.assign(lastPlayer, { scoreAfter: score, multiplierAfter: multiplier, targetAfter: targetCenterY });
      if (mistakes > beforeMistakes) Object.assign(lastMistake, { scoreAfter: score, multiplierAfter: multiplier, targetAfter: targetCenterY });
      if (enemyMoves > beforeEnemy) Object.assign(lastEnemy, { pilesAfter: [...placedCardNumbers], targetAfter: targetCenterY });
      if (shuffles > beforeShuffle) Object.assign(lastShuffle, { pilesAfter: [...placedCardNumbers] });
    }
    return result;
  };
  window.__crispHint = "点击下方五列中能接到中央牌的牌：点数相差 1，A 与 K 相邻。连续抢先出牌提升倍率；错点或对手出牌会把中线推向你。";
  window.__crispObserve = () => {
    sync();
    return { playerMoves, enemyMoves, mistakes, shuffles, losses,
      lastPlayer, lastEnemy, lastMistake, lastShuffle,
      centerY: centerY ?? 40, targetCenterY: targetCenterY ?? 40,
      multiplier: multiplier ?? 1, penaltyTicks: penaltyTicks ?? -1,
      enemyNextMoveTicks: enemyNextMoveTicks ?? 0,
      playerFront: front(playerCards), enemyFront: front(enemyCards),
      playerCardCount: playerCards?.length ?? 0, enemyCardCount: enemyCards?.length ?? 0,
      piles: [...(placedCardNumbers ?? [])] };
  };
})();
