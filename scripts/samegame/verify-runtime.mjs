#!/usr/bin/env node
/** Runtime transition and hint smoke, executable without npm dependencies in Node 24. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { samegameLevels } from '../../src/games/samegameLevels.ts';
import { createSameGameState, getSameGameHint, isSameGameSolved, isSameGameBoard, playSameGame, removeSameGameGroup, samegameCanonicalKey, samegameGroups, undoSameGame } from '../../src/games/samegameLogic.ts';
const campaign = JSON.parse(readFileSync(new URL('../../docs/samegame/campaign.json', import.meta.url), 'utf8'));
let certificateMoves = 0, hintCalls = 0, openingChecks = 0, reflectionChecks = 0, maximumHintMs = 0;
const started = performance.now();
for (const [index, level] of samegameLevels.entries()) {
  const proof = campaign.levels[index];
  assert.equal(level.id, proof.id);
  assert.deepEqual(level.board, proof.board);
  assert.equal(samegameCanonicalKey(level.board, level.width, level.height), proof.canonicalKey);
  let state = createSameGameState(level);
  for (const selected of proof.solution) {
    const before = state.board;
    const used = Array.from({length: level.width}, (_, x) => before.some((c, i) => i % level.width === x && c >= 0)).filter(Boolean).length;
    const mirrored = before.map((_, i) => i % level.width < used ? before[Math.floor(i / level.width) * level.width + used - 1 - i % level.width] : -1);
    for (const group of samegameGroups(before, level.width, level.height)) {
      const mirrorIndex = Math.floor(group[0] / level.width) * level.width + used - 1 - group[0] % level.width;
      const after = removeSameGameGroup(before, level.width, level.height, group[0]);
      const mirrorAfter = removeSameGameGroup(mirrored, level.width, level.height, mirrorIndex);
      assert.ok(after && mirrorAfter);
      assert.equal(samegameCanonicalKey(after, level.width, level.height), samegameCanonicalKey(mirrorAfter, level.width, level.height));
      reflectionChecks++;
    }
    state = playSameGame(state, level, selected);
    assert.notEqual(state.board, before);
    certificateMoves++;
  }
  assert.ok(isSameGameSolved(state.board));
  assert.equal(undoSameGame(state), state);
  let board = [...level.board];
  while (!isSameGameSolved(board)) {
    const start = performance.now();
    const hint = getSameGameHint(level, board);
    maximumHintMs = Math.max(maximumHintMs, performance.now() - start);
    assert.equal(hint.kind, 'move', `${level.id}: ${hint.reason}`);
    board = removeSameGameGroup(board, level.width, level.height, hint.index);
    assert.ok(board);
    hintCalls++;
  }
  for (const outcome of proof.openingOutcomes) {
    const next = removeSameGameGroup(level.board, level.width, level.height, outcome.index);
    const start = performance.now();
    const hint = getSameGameHint(level, next, 30000);
    maximumHintMs = Math.max(maximumHintMs, performance.now() - start);
    assert.notEqual(hint.kind, 'unavailable');
    assert.equal(hint.kind === 'dead-end', outcome.outcome === 'losing', `${level.id} opening index ${outcome.index}`);
    openingChecks++;
  }
}
const fixture = { id:'fixture',title:'fixture',chapter:0,colors:2,width:2,height:2,board:[0,1,0,1] };
assert.equal(getSameGameHint(fixture, fixture.board, 0).kind, 'unavailable');
assert.equal(getSameGameHint(fixture, fixture.board, 1).kind, 'move');
assert.equal(getSameGameHint(fixture, [0,1,1,0], 0).kind, 'dead-end');
assert.equal(getSameGameHint(fixture, [0,0,1,-1], 100).kind, 'dead-end');
assert.equal(isSameGameSolved([]),false);
assert.equal(isSameGameSolved(Array(4)),false);
assert.equal(isSameGameBoard(Array(4),2,2),false);
for(const bad of [-1,4,1.5,NaN,Infinity]) assert.equal(removeSameGameGroup(fixture.board,2,2,bad),null);
assert.deepEqual(removeSameGameGroup([0,1,2,3,0,1,2,3,0,1,2,3],4,3,1),[0,2,3,-1,0,2,3,-1,0,2,3,-1]);
console.log(JSON.stringify({ levels:samegameLevels.length, certificateMoves, hintCalls, openingChecks, reflectionChecks, maximumHintMs:Math.round(maximumHintMs*100)/100, elapsedMs:Math.round(performance.now()-started), result:'pass' }, null, 2));
