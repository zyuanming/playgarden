import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as E from '../../src/games/ataxxLogic.ts';
import {solveLesson,chooseAI} from '../../src/games/ataxxSearch.ts';
import {ataxxLevels} from '../../src/games/ataxxLevels.ts';
const canonical=(p,m)=>m===null?'p':E.distance(m.from,m.to,p.size)===1?`c:${m.to}`:`j:${m.from}:${m.to}`;
const generated=spawnSync('python3',[fileURLToPath(new URL('./campaign_states.py',import.meta.url))],{encoding:'utf8',maxBuffer:32*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
assert.equal(generated.status,0,generated.stderr);
const fixtures=JSON.parse(generated.stdout),lessons=new Map(ataxxLevels.map(l=>[l.id,l]));
let decisions=0,terminal=0,greenHints=0,purpleReplies=0,cloneAliases=0;
for(const f of fixtures){
 const lesson=lessons.get(f.id),initial=E.start(lesson);let p=initial;const history=[];
 for(const key of f.history){
  const m=E.moves(p).find(m=>canonical(p,m)===key);assert.notEqual(m,undefined,`${f.id} replay ${key}`);
  history.push(m);p=E.play(p,m);
 }
 assert.deepEqual(p,{size:f.position.size,board:[...f.position.cells].map(c=>({x:1,o:2,'.':0,'#':-1})[c]),turn:f.position.turn==='x'?1:2,quiet:f.position.halfmove});
 assert.equal(E.stage(lesson,history,p),f.stage,`${f.id} stage ${f.history}`);
 assert.deepEqual(E.replay(initial,history,lesson),p,`${f.id} action replay`);
 assert.deepEqual(E.parseSave(JSON.stringify({id:f.id,history}),initial,f.id,lesson),history);
 if(f.stage!=='playing'){
  terminal++;for(const m of E.moves(p))assert.equal(E.replay(initial,[...history,m],lesson),null,`${f.id} actions beyond completed lesson`);
  continue;
 }
 const answer=solveLesson(lesson,p,history);
 assert.equal(answer.kind,'answer',`${f.id} current-state search fits budget`);
 assert.equal(answer.value,f.value,`${f.id} exact minimax value ${f.history}`);
 assert.equal(f.choices[canonical(p,answer.move)],f.value,`${f.id} hint/worst reply is optimal ${f.history}`);
 assert.equal(E.legal(p,answer.move),true);
 assert.ok(answer.nodes<=40001);decisions++;
 if(p.turn===1)greenHints++;else purpleReplies++;
 // Every UI clone-source alias leads to the independently proved same value.
 for(const m of E.moves(p))if(m&&E.distance(m.from,m.to,p.size)===1){
  for(let from=0;from<p.board.length;from++)if(p.board[from]===p.turn&&E.distance(from,m.to,p.size)===1){
   assert.deepEqual(E.play(p,{from,to:m.to}),E.play(p,m));cloneAliases++;
  }
 }
}
// Compare every documented author certificate against the independently proven root choice set.
const independent=JSON.parse(readFileSync(fileURLToPath(new URL('../../docs/ataxx/independent-campaign.json',import.meta.url))));
const authored=JSON.parse(readFileSync(fileURLToPath(new URL('../../docs/ataxx/campaign.json',import.meta.url))));
for(const l of authored.levels){
 const p=E.start(l),proof=independent.levels.find(x=>x.id===l.id);
 assert.deepEqual(l.proof.winningMoves.map(m=>canonical(p,m)).sort(),[...proof.winningActions].sort(),`${l.id} certificate all alternatives`);
 const q=E.replay(p,l.proof.line,l);assert.ok(q,`${l.id} legal certificate`);assert.equal(E.stage(l,l.proof.line,q),'success');
 if(l.goal.kind==='win')assert.equal(proof.minimumWinningTurns,l.goal.turns,`${l.id} strict shorter-horizon failure`);
}
// Budget behavior: both zero and negative budgets safely stop; malformed or oversized budgets remain capped.
const last=ataxxLevels.at(-1),p=E.start(last);
for(const budget of [0,-1,-Infinity]){
 const r=solveLesson(last,p,[],budget,200);if(budget!==-Infinity)assert.equal(r.kind,'budget');assert.ok(r.nodes<=40001);
}
for(const budget of [NaN,Infinity,1e12]){
 const r=solveLesson(last,p,[],budget,Infinity);assert.ok(r.nodes<=40001);assert.equal(r.kind,'answer');
 const ai=chooseAI(E.start(),budget,Infinity);assert.ok(ai.nodes<=18001);assert.equal(E.legal(E.start(),ai.move),true);
}
const zero=chooseAI(E.start(),0,0);assert.ok(zero.nodes<=1);assert.equal(E.legal(E.start(),zero.move),true);
// Deterministic hard-cap stress: freeze the clock so wall time cannot hide a missing node cap.
const realNow=Date.now;
try{
 Date.now=()=>1000;
 const initial=E.start(),stress={...last,id:'independent-budget-stress',size:7,board:initial.board,goal:{kind:'win',turns:10}};
 const mixed={size:7,board:[1,0,2,2,0,1,0,2,0,0,0,2,1,0,0,1,0,1,0,2,1,1,1,0,1,0,2,0,1,0,0,0,0,0,2,0,0,2,0,2,2,0,1,0,0,0,1,0,0],turn:1,quiet:0};
 for(const budget of [NaN,Infinity,1e12]){
  const lessonResult=solveLesson(stress,initial,[],budget,Infinity);assert.equal(lessonResult.kind,'budget');assert.equal(lessonResult.nodes,40001);
  const aiResult=chooseAI(mixed,budget,Infinity);assert.equal(aiResult.nodes,18001);assert.equal(E.legal(mixed,aiResult.move),true);
 }
}finally{Date.now=realNow;}
const report={status:'PASS',independentStates:fixtures.length,decisionStates:decisions,terminalStates:terminal,currentGreenHints:greenHints,worstPurpleReplies:purpleReplies,cloneAliases,allRootAlternatives:'equal to independent complete sets',strictMinimumHumanTurns:'2 turns for levels 19–24; 3 for 25–30',budgetCaps:'40,000 lesson nodes and 18,000 AI nodes (+1 stop sentinel) under malformed and oversized parameters'};
writeFileSync(fileURLToPath(new URL('../../docs/ataxx/independent-campaign-runtime.json',import.meta.url)),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
