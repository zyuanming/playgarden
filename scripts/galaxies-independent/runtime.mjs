#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Independent differential/negative testing. Only the system under test is
// imported; expected completions come from the separate Python geometric oracle.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=resolve(process.argv[2]||'.'),here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(repo,'package.json')),ts=require('typescript');
const source=readFileSync(resolve(repo,'src/games/galaxiesLogic.ts'),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const api=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const levelSource=readFileSync(resolve(repo,'src/games/galaxiesLevels.ts'),'utf8');
const levels=JSON.parse(levelSource.split('export const galaxiesLevels: GalaxiesLevel[] = ')[1].trim().replace(/;$/,''));
const proofs=JSON.parse(readFileSync(resolve(repo,'docs/galaxies/campaign.json'),'utf8')).levels;
const pfor=(p,id='fixture')=>({...p,id,title:id,chapter:0});
let completionCases=0,correctPartial=0,wrongHints=0,editGuards=0,saveRejections=0;
const fixtures=JSON.parse(execFileSync('python3',[resolve(here,'fixtures.py')],{maxBuffer:15*1024*1024,encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
for(const f of fixtures){
 const p=pfor(f);
 for(let i=0;i<f.states.length;i++){
  assert.equal(api.inspectGalaxies(p,f.states[i]).won,f.expected[i],JSON.stringify({p:{size:p.size,centers:p.centers},state:f.states[i]}));
  completionCases++;
 }
}
for(let k=0;k<levels.length;k++){
 const p=levels[k],answer=proofs[k].solution,initial=api.initialGalaxies(p);
 const allStart=JSON.stringify(initial),allAnswer=JSON.stringify(answer);
 const editable=initial.flatMap((g,i)=>g<0?[i]:[]);
 assert.equal(api.inspectGalaxies(p,answer).won,true);
 let prefix=[...initial];
 for(const i of editable){
  const res=api.solveGalaxies(p,prefix);assert.equal(res.kind,'solution');assert.deepEqual(res.cells,answer);correctPartial++;
  for(let g=0;g<p.centers.length;g++){
   if(g===answer[i])continue;
   const bad=api.changeGalaxies(p,initial,i,g);
   const result=api.solveGalaxies(p,bad);
   assert.equal(result.kind,'none',`${p.id} wrong single ${i}->${g}`);wrongHints++;
  }
  prefix=api.changeGalaxies(p,prefix,i,answer[i]);
 }
 assert.deepEqual(prefix,answer);
 for(const i of editable){assert.equal(api.changeGalaxies(p,answer,i,-1),answer);editGuards++;}
 for(let i=0;i<initial.length;i++)if(initial[i]>=0){
  for(let g=-1;g<p.centers.length;g++){assert.equal(api.changeGalaxies(p,initial,i,g),initial);editGuards++;}
 }
 for(const i of [-1,initial.length,initial.length+100,1.5,NaN,Infinity,-Infinity]){assert.equal(api.changeGalaxies(p,initial,i,0),initial);editGuards++;}
 for(const g of [-2,p.centers.length,p.centers.length+100,0.5,NaN,Infinity,-Infinity]){assert.equal(api.changeGalaxies(p,initial,editable[0],g),initial);editGuards++;}
 assert.equal(api.changeGalaxies(p,initial,editable[0],-1),initial);
 assert.equal(JSON.stringify(initial),allStart);assert.equal(JSON.stringify(answer),allAnswer);
 assert.equal(api.solveGalaxies(p,initial,0).kind,'budget');
 assert.equal(api.solveGalaxies(p,initial,1).kind==='none',false);
 const raw=(history,id=p.id)=>JSON.stringify({id,history});
 const fresh=[initial],i=editable[0],fixedI=initial.findIndex(g=>g>=0);
 const badValues=[null,true,false,'0',-2,p.centers.length,0.1,{},[],Infinity];
 const invalid=[null,'','{','null','[]','{}',raw([]),raw(null),raw([initial],'wrong-id'),raw([initial.slice(1)]),raw([[...initial,0]]),raw(Array(2002).fill(initial))];
 for(const v of badValues){const s=[...initial];s[i]=v;invalid.push(raw([s]));}
 const tampered=[...initial];tampered[fixedI]=-1;invalid.push(raw([tampered]));
 for(const v of invalid){assert.deepEqual(api.parseGalaxiesSave(v,p),fresh);saveRejections++;}
 assert.deepEqual(api.parseGalaxiesSave(raw([initial,prefix]),p),[initial,prefix]);
 assert.equal(api.parseGalaxiesSave(raw(Array(2001).fill(initial)),p).length,2001);
 const badGame=[...initial];badGame[i]=(answer[i]+1)%p.centers.length;
 assert.deepEqual(api.parseGalaxiesSave(raw([badGame]),p),[badGame]); // user's mistakes must survive reload
}
// Public, non-campaign ambiguous fixture proves solver respects current choices,
// not just campaign certificates. Two different legal completions are accepted.
const p=pfor({size:3,centers:[[1,3],[3,3],[5,3]]},'ambiguous');
const a=[1,1,1,0,1,2,1,1,1],b=[0,1,2,0,1,2,0,1,2];
for(const target of [a,b]){
 assert.equal(api.inspectGalaxies(p,target).won,true);
 const s=api.initialGalaxies(p);s[0]=target[0];
 assert.deepEqual(api.solveGalaxies(p,s),{kind:'solution',cells:target});
}
// Named adversarial cases isolate the rule obligations as well as exhaustive cases.
const negatives=[
 {name:'disconnected symmetric islands',size:3,centers:[[3,3],[3,1],[1,3],[5,3],[3,5]],state:[0,1,0,2,0,3,0,4,0]},
 {name:'extra star inside region',size:3,centers:[[3,3],[1,1]],state:Array(9).fill(0)},
 {name:'symmetric region with wrong center',size:3,centers:[[1,1]],state:Array(9).fill(0)},
 {name:'asymmetric connected region',size:3,centers:[[3,3]],state:[-1,0,0,0,0,0,0,0,0]},
 {name:'split vertex-star neighborhood',size:2,centers:[[2,2]],state:[0,0,0,-1]},
 {name:'unassigned cell',size:3,centers:[[3,3]],state:[-1,-1,-1,-1,0,-1,-1,-1,-1]},
];
for(const f of negatives)assert.equal(api.inspectGalaxies(pfor(f),f.state).won,false,f.name);
const bound=pfor({size:4,centers:[[1,1]]});assert.equal(api.opposite(bound,0,15),-1);assert.equal(api.opposite(bound,-1,0),-1);
for(const [center,want] of [[[3,3],[4]],[[2,3],[3,4]],[[3,2],[1,4]],[[2,2],[0,1,3,4]]])assert.deepEqual(api.coreCells(pfor({size:3,centers:[center]}),0).sort((a,b)=>a-b),want);
const malformedLevel=pfor({size:3,centers:[[3,3]]},'malformed');
const malformedStates=[[],Array(8).fill(0),Array(10).fill(0),[NaN,0,0,0,0,0,0,0,NaN],Array(9),[null,0,0,0,0,0,0,0,null],[undefined,0,0,0,0,0,0,0,undefined],[Infinity,0,0,0,0,0,0,0,Infinity],[0.5,0,0,0,0,0,0,0,0.5],[1,0,0,0,0,0,0,0,1],[-2,0,0,0,0,0,0,0,-2],['0',0,0,0,0,0,0,0,'0']];
const sparse=Array(9).fill(0);delete sparse[0];delete sparse[8];malformedStates.push(sparse);
for(const state of malformedStates)assert.equal(api.inspectGalaxies(malformedLevel,state).won,false,'malformed board');
const result={completionCases,correctPartial,wrongHints,editGuards,saveRejections,ambiguousFixtureSolutions:2,namedAdversarialCases:negatives.length,malformedStateRejections:malformedStates.length,status:'pass'};
writeFileSync(resolve(process.argv[3]||'runtime-report.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
