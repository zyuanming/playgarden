#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Only the system under test is imported. Expected tiny-grid outcomes come from
// independent literal Python enumeration; campaign answers from the MILP report.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const repo=resolve(process.argv[2]||'.'),here=dirname(fileURLToPath(import.meta.url));
const report=process.argv[3]||resolve(repo,'docs/magnets/independent-campaign.json');
const output=process.argv[4]||'/tmp/magnets-runtime-review.json';
const require=createRequire(resolve(repo,'package.json')),ts=require('typescript');
const source=readFileSync(resolve(repo,'src/games/magnetsLogic.ts'),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const api=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const levels=JSON.parse(readFileSync(resolve(repo,'src/games/magnetsLevels.ts'),'utf8').split('export const magnetsLevels: MagnetsLevel[] = ')[1].trim().replace(/;$/,''));
const certificate=JSON.parse(readFileSync(report,'utf8'));
for(const file of ['src/games/magnetsLevels.ts','docs/magnets/campaign.json']){
 const actual=createHash('sha256').update(readFileSync(resolve(repo,file))).digest('hex');
 assert.equal(actual,certificate.hashes[file],`Stored independent proof is stale for ${file}; regenerate with optional MILP verifier.`);
}
assert.equal(certificate.summary.levels,36);
const proofs=certificate.levels;
assert.equal(proofs.length,levels.length);
for(const proof of proofs){assert.equal(proof.solutions,1);assert.equal(proof.exhausted,true);}
const count={fixtures:0,inspection:0,hints:0,budgets:0,campaignHints:0,wrongCampaignHints:0,terminalGuards:0,invalidGuards:0,saveRejections:0,pairChecks:0};
const start=performance.now();
const fixtures=JSON.parse(execFileSync('python3',[resolve(here,'fixtures.py')],{encoding:'utf8',maxBuffer:30*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',OPENBLAS_NUM_THREADS:'1'}}));
for(const f of fixtures){
 count.fixtures++;
 for(const {state,expected,solvable} of f.cases){
  const p=f.puzzle,actual=api.inspectMagnets(p,state),before=JSON.stringify(state);
  assert.deepEqual({...actual,conflicts:[...actual.conflicts].sort((a,b)=>a-b)},expected,JSON.stringify({p,state}));count.inspection++;
  const hint=api.solveMagnets(p,state);
  assert.equal(hint.kind,solvable?'solution':'none',JSON.stringify({p,state}));count.hints++;
  if(hint.kind==='solution'){
   assert.equal(api.inspectMagnets(p,hint.state).won,true);
   state.forEach((v,i)=>{if(v!==-1)assert.equal(hint.state[i],v,'hint overwrites current choice');});
  }
  assert.equal(JSON.stringify(state),before,'query mutates input');
  assert.equal(api.solveMagnets(p,state,0).kind,'budget');count.budgets++;
  for(let d=0;d<state.length;d++){
   for(const v of [-1,0,1,2]){
    const changed=api.changeMagnets(p,state,d,v);
    if(expected.won||state[d]===v){assert.equal(changed,state);count.terminalGuards++;}
    else {
     assert.deepEqual(changed,state.map((x,i)=>i===d?v:x));
     const cells=api.magnetCells(p,changed),[a,b]=p.dominoes[d];
     assert.equal(cells[a],v);assert.equal(cells[b],[-1,0,2,1][v+1]);count.pairChecks++;
    }
   }
  }
 }
}
for(let k=0;k<levels.length;k++){
 const p=levels[k],answer=proofs[k].solution,initial=api.initialMagnets(p);
 assert.equal(proofs[k].id,p.id);
 assert.equal(api.inspectMagnets(p,answer).won,true);
 let prefix=[...initial];
 for(let d=0;d<initial.length;d++){
  // Test every correct prefix, including nonempty state preservation and neutral decisions.
  const solved=api.solveMagnets(p,prefix);
  assert.equal(solved.kind,'solution',`${p.id} prefix ${d}`);assert.deepEqual(solved.state,answer);count.campaignHints++;
  prefix=api.changeMagnets(p,prefix,d,answer[d]);
 }
 assert.deepEqual(prefix,answer);
 for(const d of [...new Set([0,Math.floor(initial.length/2),initial.length-1])]){
  for(const v of [0,1,2].filter(x=>x!==answer[d])){
   const wrong=api.changeMagnets(p,initial,d,v),res=api.solveMagnets(p,wrong);
   assert.equal(res.kind,'none',`${p.id} wrong ${d}=${v}`);count.wrongCampaignHints++;
  }
 }
 for(let d=0;d<answer.length;d++){
  assert.equal(api.changeMagnets(p,answer,d,-1),answer);count.terminalGuards++;
 }
 for(const d of [-1,initial.length,10000,0.5,NaN,Infinity,-Infinity]){
  assert.equal(api.changeMagnets(p,initial,d,0),initial);count.invalidGuards++;
 }
 for(const v of [-2,3,0.5,NaN,Infinity,-Infinity,undefined,null,'1']){
  assert.equal(api.changeMagnets(p,initial,0,v),initial);count.invalidGuards++;
  const bad=[...initial];bad[0]=v;
  assert.equal(api.validMagnetsState(p,bad),false);
  assert.equal(api.inspectMagnets(p,bad).won,false);
  assert.equal(api.solveMagnets(p,bad).kind,'none');
  assert.equal(api.changeMagnets(p,bad,1,0),bad);count.invalidGuards++;
 }
 for(const bad of [[],initial.slice(1),[...initial,0],Array(initial.length)]){
  assert.equal(api.validMagnetsState(p,bad),false);
  assert.equal(api.inspectMagnets(p,bad).won,false);
  assert.equal(api.solveMagnets(p,bad).kind,'none');count.invalidGuards++;
 }
 const fresh=[initial];
 for(const raw of ['{','null','[]',JSON.stringify({id:'wrong',history:fresh}),JSON.stringify({id:p.id,history:[]}),
  JSON.stringify({id:p.id,history:[[]]}),JSON.stringify({id:p.id,history:[Array(initial.length).fill(null)]}),
  JSON.stringify({id:p.id,history:Array(2002).fill(initial)}),JSON.stringify({id:p.id,history:[{length:initial.length}]})]){
  assert.deepEqual(api.parseMagnetsSave(raw,p),fresh);count.saveRejections++;
 }
 const history=[initial,initial.map((v,i)=>i===0?0:v)];
 assert.deepEqual(api.parseMagnetsSave(JSON.stringify({id:p.id,history}),p),history);
}
const p=fixtures.find(f=>f.solutionCount===0).puzzle;
assert.equal(api.solveMagnets(p,api.initialMagnets(p),0).kind,'budget');
assert.equal(api.solveMagnets(p,api.initialMagnets(p)).kind,'none');
const hash=createHash('sha256').update(source).digest('hex');
const result={status:'pass',runtimeSha256:hash,count,seconds:Math.round(performance.now()-start)/1000,
 limitations:['DOM/pixel review is handled separately; this report makes no screenshot claims.']};
writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
