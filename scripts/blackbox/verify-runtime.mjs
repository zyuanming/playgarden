#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {blackboxLevels} from '../../src/games/blackboxLevels.ts';
import {BLACKBOX_SAVE_LIMIT,blackboxUniverse,blackboxCandidates,blackboxSignature,traceBlackbox,validAtoms,createBlackboxState,markBlackbox,undoBlackbox,fireBlackbox,observedBlackbox,checkBlackbox,getBlackboxHint,bestBlackboxProbe} from '../../src/games/blackboxLogic.ts';
import {parseBlackboxRound,loadBlackboxRound,saveBlackboxRound} from '../../src/games/blackboxStorage.ts';
const campaign=JSON.parse(readFileSync(new URL('../../docs/blackbox/campaign.json',import.meta.url),'utf8'));
const oracle=JSON.parse(execFileSync('python3',[fileURLToPath(new URL('../blackbox-independent/emit_vectors.py',import.meta.url))],{encoding:'utf8',maxBuffer:4*1024*1024}));
for(const vector of oracle.vectors)assert.deepEqual(blackboxSignature(vector.size,vector.atoms),vector.signature);
const started=performance.now();let layouts=0,ports=0,hintSteps=0,saveChecks=0,maxHintMs=0;
const digests=[];
for(const[n,k]of[[3,1],[4,2],[4,3],[5,2],[5,3],[5,4]]){
 const universe=blackboxUniverse(n,k),hash=createHash('sha256');
 for(const c of universe){layouts++;hash.update(`${c.atoms.join(',')}:${c.signature.join(',')}\n`);for(let p=0;p<n*4;p++){ports++;let out=c.signature[p];assert(out===-1||out===-2||Number.isInteger(out)&&out>=0&&out<n*4&&out!==p);if(out>=0)assert.equal(c.signature[out],p);}}
 digests.push({size:n,count:k,layouts:universe.length,sha256:hash.digest('hex')});
}
function saved(level,state){assert.deepEqual(parseBlackboxRound(JSON.stringify({version:1,id:level.id,...state}),level),state);saveChecks++;}
for(const[index,level]of blackboxLevels.entries()){
 const proof=campaign.levels[index],initial=createBlackboxState(level);assert.deepEqual(blackboxSignature(level.size,level.atoms),proof.signature);
 assert.equal(blackboxCandidates(level.size,level.atoms.length,proof.signature.map((result,port)=>({port,result}))).length,1);
 let state=initial;
 for(const entry of proof.probeTrace){const before=state;state=fireBlackbox(level,state,entry.port);assert.notEqual(state,before);assert.equal(state.probes.at(-1).result,entry.result);assert.equal(blackboxCandidates(level.size,level.atoms.length,observedBlackbox(state.probes)).length,entry.candidates);assert.equal(fireBlackbox(level,state,entry.port),state);if(entry.result>=0)assert.equal(fireBlackbox(level,state,entry.result),state);saved(level,state);}
 for(const cell of level.atoms){const before=state;state=markBlackbox(state,cell,1);assert.deepEqual(undoBlackbox(state),before);saved(level,state);}
 const win=checkBlackbox(level,state);assert.equal(win.kind,'won');assert(win.state.submitted);saved(level,win.state);assert.equal(markBlackbox(win.state,0,-1),win.state);assert.equal(undoBlackbox(win.state),win.state);assert.equal(fireBlackbox(level,win.state,0),win.state);assert.equal(checkBlackbox(level,win.state).kind,'locked');
 // Replay evidence-only hints from a blank board, never pass hidden atoms to the hint function.
 state=initial;let iterations=0;
 while(!state.submitted){assert(++iterations<=4*level.size+level.atoms.length+1);const then=performance.now(),hint=getBlackboxHint(level.size,level.atoms.length,state);maxHintMs=Math.max(maxHintMs,performance.now()-then);hintSteps++;
  if(hint.kind==='mark'){const candidates=blackboxCandidates(level.size,level.atoms.length,observedBlackbox(state.probes));assert(candidates.every(c=>c.atoms.includes(hint.cell)===(hint.value===1)));state=markBlackbox(state,hint.cell,hint.value);}
  else if(hint.kind==='probe'){const before=state;state=fireBlackbox(level,state,hint.port);assert.notEqual(state,before);}
  else {assert.equal(hint.kind,'ready');state=checkBlackbox(level,state).state;assert(state.submitted);}
  saved(level,state);
 }
 // Bad guesses report observable evidence. Re-checking cannot charge duplicate probes.
 state=initial;const wrong=blackboxUniverse(level.size,level.atoms.length).find(c=>c.signature.some((r,p)=>r!==proof.signature[p]));
 for(const cell of wrong.atoms)state=markBlackbox(state,cell,1);
 const mismatch=checkBlackbox(level,state);assert.equal(mismatch.kind,'conflict');assert.notEqual(mismatch.actual,mismatch.predicted);assert.equal(mismatch.actual,proof.signature[mismatch.port]);assert.equal(mismatch.state.probes.length,1);assert.equal(checkBlackbox(level,mismatch.state).state,mismatch.state);saved(level,mismatch.state);
 for(const bad of ['bad json','null','[]',JSON.stringify({version:1,id:level.id,...initial,submitted:true}),JSON.stringify({version:1,id:'wrong',...state}),JSON.stringify({version:1,id:level.id,...state,history:[]}),JSON.stringify({version:1,id:level.id,...initial,probes:[{port:0,result:999}]}),JSON.stringify({version:1,id:level.id,...initial,probes:[{port:0,result:proof.signature[0]},{port:0,result:proof.signature[0]}]})])assert.deepEqual(parseBlackboxRound(bad,level),initial);
}
// Explicit non-unique witness: an equivalent layout MUST pass even if it is not the preset.
const equivalent={id:'equivalent-test',title:'equivalent',chapter:0,size:3,atoms:[0,8]};
assert.deepEqual(blackboxSignature(3,[0,8]),blackboxSignature(3,[2,6]));
let eq=createBlackboxState(equivalent);eq=markBlackbox(markBlackbox(eq,2,1),6,1);const won=checkBlackbox(equivalent,eq);assert.equal(won.kind,'won');saved(equivalent,won.state);
const observed=blackboxSignature(3,[0,8]).map((result,port)=>({port,result}));assert.equal(getBlackboxHint(3,2,{marks:Array(9).fill(0),probes:observed}).kind,'equivalent');assert.equal(bestBlackboxProbe(3,blackboxCandidates(3,2,observed),observed),null);
for(const atoms of [[NaN],[Infinity],[-1],[9],[0,0],Array(1),[false],null,'0',[0,1,2,3,4]])assert.equal(validAtoms(3,atoms),false);
for(const n of [0,2,6,3.1,NaN,Infinity])assert.equal(blackboxSignature(n,[0]),null);
for(const p of [-1,12,0.1,NaN,Infinity])assert.equal(traceBlackbox(3,[0],p),null);
const l=blackboxLevels[0],initial=createBlackboxState(l);
assert.equal(getBlackboxHint(3,1,{marks:Array(9).fill(0),probes:[{port:1,result:-1},{port:1,result:-2}]}).kind,'invalid');
assert.deepEqual(blackboxCandidates(3,1,[null]),[]);assert.deepEqual(blackboxCandidates(3,1,Array(1)),[]);
assert.equal(checkBlackbox(l,{...initial,marks:[0]}).kind,'count');
assert.deepEqual(parseBlackboxRound(JSON.stringify({version:1,id:l.id,...initial,probes:[{port:0,result:9},{port:9,result:0}]}),l),initial);
for(const cell of [-1,9,0.1,NaN,Infinity])assert.equal(markBlackbox(initial,cell,1),initial);
for(const v of [-2,2,NaN,Infinity,false])assert.equal(markBlackbox(initial,0,v),initial);
assert.equal(checkBlackbox(l,initial).kind,'count');assert.equal(undoBlackbox(initial),initial);
let long=initial;for(let i=0;i<BLACKBOX_SAVE_LIMIT;i++)long=markBlackbox(long,0,i%2?0:1);saved(l,long);
globalThis.localStorage={setItem(){throw Error('blocked');},getItem(){throw Error('blocked');}};
assert.equal(saveBlackboxRound(0,l,initial),false);assert.deepEqual(loadBlackboxRound(0,l),initial);assert.equal(saveBlackboxRound(0,l,markBlackbox(long,0,1)),false);
const report={result:'pass',oracleLayouts:oracle.layouts,oraclePorts:oracle.ports,levels:blackboxLevels.length,layouts,ports,hintSteps,saveChecks,maxHintMs,digests,elapsedMs:performance.now()-started};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
