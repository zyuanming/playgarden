#!/usr/bin/env node
/** Executable Node 24 checks against the actual production TypeScript, no npm dependency. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { pancakeLevels } from '../../src/games/pancakeLevels.ts';
import { createPancakeState, flipPancakes, getPancakeHint, isPancakeSolved, isPancakeStack, pancakeDistance, pancakeRank, playPancake, undoPancake, PANCAKE_SAVE_LIMIT } from '../../src/games/pancakeLogic.ts';
import { parsePancakeRound, savePancakeRound } from '../../src/games/pancakeStorage.ts';
const campaign=JSON.parse(readFileSync(new URL('../../docs/pancake/campaign.json',import.meta.url),'utf8'));
const started=performance.now();let moves=0,hints=0,edges=0,maximumHintMs=0,states=0,saveChecks=0;
function* permutations(a) {if(!a.length){yield [];return;}for(let i=0;i<a.length;i++)for(const tail of permutations(a.filter((_,j)=>j!==i)))yield[a[i],...tail];}
for(let n=3;n<=8;n++){
 let ordinal=0;
 for(const a of permutations(Array.from({length:n},(_,i)=>i+1))){
  assert.equal(pancakeRank(a),ordinal++);const d=pancakeDistance(a);assert.ok(d>=0&&d<=9);
  const start=performance.now(),hint=getPancakeHint(a);maximumHintMs=Math.max(maximumHintMs,performance.now()-start);
  if(d===0)assert.equal(hint.kind,'complete');else{assert.equal(hint.kind,'move');assert.equal(pancakeDistance(flipPancakes(a,hint.count)),d-1);}
  for(let k=2;k<=n;k++){const b=flipPancakes(a,k);assert.deepEqual(flipPancakes(b,k),a);assert.ok(Math.abs(pancakeDistance(b)-d)<=1);edges++;}
  states++;
 }
}
for(const [i,level] of pancakeLevels.entries()){
 const proof=campaign.levels[i];assert.deepEqual(level.stack,proof.stack);assert.equal(level.minMoves,pancakeDistance(level.stack));
 let state=createPancakeState(level);
 for(const k of proof.solution){const before=state;state=playPancake(state,k);moves++;assert.notEqual(state,before);if(!isPancakeSolved(state.stack))assert.deepEqual(undoPancake(state),before);
  assert.deepEqual(parsePancakeRound(JSON.stringify({version:1,id:level.id,...state}),level),state);saveChecks++;
 }
 assert.ok(isPancakeSolved(state.stack));assert.equal(state.moves,proof.minMoves);assert.equal(undoPancake(state),state);assert.equal(playPancake(state,2),state);
 let board=[...level.stack];while(!isPancakeSolved(board)){const hint=getPancakeHint(board);assert.equal(hint.kind,'move');board=flipPancakes(board,hint.count);hints++;}
 const initial=createPancakeState(level);
 for(const bad of ['bad json','null',JSON.stringify({version:1,id:level.id,stack:[...level.stack].sort((a,b)=>a-b),history:[],moves:0}),JSON.stringify({version:1,id:'wrong',...state}),JSON.stringify({version:1,id:level.id,...state,history:[]}),JSON.stringify({version:1,id:level.id,...state,moves:0})])assert.deepEqual(parsePancakeRound(bad,level),initial);
}
for(const bad of [[],Array(3),[1,1,3],[0,1,2],[1,2],[1,2,3,4,5,6,7,8,9],[true,2,3],[1,2,4],null]){assert.equal(isPancakeStack(bad),false);assert.equal(pancakeRank(bad),-1);assert.equal(pancakeDistance(bad),null);assert.equal(isPancakeSolved(bad),false);}
for(const k of [-1,0,1,4,2.5,NaN,Infinity])assert.equal(flipPancakes([2,1,3],k),null);
const level=pancakeLevels[119],initial=createPancakeState(level);let long=initial;
for(let i=0;i<PANCAKE_SAVE_LIMIT;i++)long=playPancake(long,2);
assert.equal(long.moves,PANCAKE_SAVE_LIMIT);assert.deepEqual(parsePancakeRound(JSON.stringify({version:1,id:level.id,...long}),level),long);
globalThis.localStorage={setItem(){throw Error('blocked');},getItem(){throw Error('blocked');}};
assert.equal(savePancakeRound(119,level,initial),false);assert.equal(savePancakeRound(119,level,playPancake(long,2)),false);
console.log(JSON.stringify({result:'pass',levels:pancakeLevels.length,states,edges,certificateMoves:moves,hintReplayMoves:hints,saveChecks,maximumHintMs,elapsedMs:performance.now()-started},null,2));
