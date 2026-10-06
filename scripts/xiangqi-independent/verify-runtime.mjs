/** Lightweight bridge: Python certificates/goldens versus real production code. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const args=process.argv.slice(2);
function arg(name){const i=args.indexOf(name);return i<0?undefined:args[i+1];}
const repo=path.resolve(arg('--repo')??'.');
const certificateFile=arg('--certificates');
if(!certificateFile)throw Error('Pass --certificates from verify_campaign.py');
const corpusFile=path.join(repo,'docs/xiangqi/corpus.json');
const raw=fs.readFileSync(corpusFile);
const corpus=JSON.parse(raw);
const certs=JSON.parse(fs.readFileSync(certificateFile));
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
assert.equal(certs.sourceSha256,hash(raw),'stale campaign certificate');
assert.equal(certs.oracleSha256,hash(fs.readFileSync(new URL('oracle.py',import.meta.url))),'stale oracle certificate');
assert.equal(certs.status,'PASS');assert.equal(corpus.length,13);assert.equal(certs.certificates.length,13);
const load=filename=>import(pathToFileURL(path.join(repo,'src/games',filename)));
const {Xiangqi}=await import(pathToFileURL(path.join(repo,'src/vendor/xiangqi/xiangqiCore.js')));
const {initialPosition,playMove}=await load('xiangqiLogic.ts');
const {meetsGoal,practiceResult,solvePuzzle}=await load('xiangqiPractice.ts');
const {xiangqiLevels,xiangqiChapters}=await load('xiangqiLevels.ts');
assert.deepEqual(xiangqiLevels,corpus,'runtime levels differ from certified corpus');
assert.equal(xiangqiChapters.length,3);
let goldenCount=0,candidates=0,solutions=0;
for(const test of JSON.parse(fs.readFileSync(new URL('golden.json',import.meta.url)))){
 const core=Xiangqi();assert.equal(core.load(test.fen),true,test.label);
 assert.deepEqual(core.moves().sort(),test.moves,test.label+' legal moves');
 assert.equal(core.in_check(),test.check,test.label+' check');
 assert.equal(core.in_checkmate(),test.check&&test.moves.length===0,test.label+' mate');
 assert.equal(core.in_stalemate(),!test.check&&test.moves.length===0,test.label+' stalemate');
 core.moves({opponent:true,legal:false});assert.equal(core.fen(),test.fen,test.label+' query mutation');
 goldenCount++;
}
assert.deepEqual([0,1,2,3].map(d=>Xiangqi().perft(d)),[1,44,1920,79666]);
for(const puzzle of corpus){
 const proof=certs.certificates.find(c=>c.id===puzzle.id);assert.ok(proof,puzzle.id+' absent proof');
 const before=initialPosition(puzzle.fen);assert.ok(before,puzzle.id+' invalid product state');
 assert.deepEqual([...before.legal].sort(),proof.initialLegalMoves,puzzle.id+' candidate set');
 assert.equal(before.check,proof.initialInCheck,puzzle.id+' initial check');
 assert.deepEqual(solvePuzzle(puzzle),proof.independentSolutions,puzzle.id+' complete solution set');
 assert.equal(practiceResult(puzzle,before),'ready');
 const found=[];
 for(const step of proof.allLegalMoveCertificates){
  const after=playMove(before,step.move);assert.notEqual(after,before,puzzle.id+' legal move rejected');
  assert.equal(after.fen,step.afterFen,puzzle.id+' child FEN');
  assert.equal(after.check,step.opponentInCheck,puzzle.id+' child check');
  assert.deepEqual([...after.legal].sort(),step.opponentLegalReplies,puzzle.id+' child replies');
  assert.equal(meetsGoal(puzzle,before,step.move,after),step.meetsGoal,puzzle.id+' goal predicate');
  assert.equal(practiceResult(puzzle,after),step.meetsGoal?'success':'retry',puzzle.id+' practice state');
  if(step.meetsGoal){found.push(step.move);solutions++;}
  candidates++;
 }
 assert.deepEqual(found,proof.independentSolutions);
 const unchanged=playMove(before,'a0i9');assert.equal(unchanged,before);
 assert.equal(meetsGoal(puzzle,before,'a0i9',unchanged),false);
}
console.log(JSON.stringify({status:'PASS',goldenCount,puzzles:corpus.length,candidates,solutions,corpusSha256:hash(raw)},null,2));
