import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {xiangqiLevels} from '../../src/games/xiangqiLevels.ts';
import {initialPosition,playMove,replayMoves,undoMoves} from '../../src/games/xiangqiLogic.ts';
import {solvePuzzle,practiceResult} from '../../src/games/xiangqiPractice.ts';
import {chooseMove} from '../../src/games/xiangqiAi.ts';
const corpus=JSON.parse(readFileSync(new URL('../../docs/xiangqi/corpus.json',import.meta.url)));
assert.deepEqual(xiangqiLevels,corpus);let candidates=0,solutions=0,assertions=1;
for(const puzzle of corpus){
 const p=initialPosition(puzzle.fen);assert(p);assert.equal(p.result,null);assert.deepEqual(solvePuzzle(puzzle),puzzle.solutions);assertions+=3;
 for(const move of p.legal){
  const after=playMove(p,move);assert.equal(practiceResult(puzzle,after),puzzle.solutions.includes(move)?'success':'retry');assert.deepEqual(replayMoves(p.initial,after.moves),after);assert.deepEqual(undoMoves(after),p);assertions+=3;candidates++;
 }
 solutions+=puzzle.solutions.length;
 const ai=chooseMove(p,{timeMs:800,nodeBudget:1000,maxDepth:1});assert(p.legal.includes(ai.move));assertions++;
 if(puzzle.objective==='mate'||puzzle.objective==='stalemate'){assert.equal(playMove(p,ai.move).winner,p.turn);assertions++;}
}
const sourceFiles=JSON.parse(readFileSync(new URL('../../docs/upstream/xiangqi.js/sources.json',import.meta.url)));
for(const source of sourceFiles){const bytes=readFileSync(new URL('../../docs/upstream/xiangqi.js/'+source.file,import.meta.url));assert.equal(bytes.length,source.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);assert(source.url.includes('/f9019ac2303d4b80ef0b82fd0515bfb55a80a62b/'));assertions+=3;}
assert.equal(readFileSync(new URL('../../public/xiangqi-LICENSE.txt',import.meta.url),'utf8'),readFileSync(new URL('../../docs/upstream/xiangqi.js/LICENSE',import.meta.url),'utf8'));assertions++;
const report={result:'pass',exercises:corpus.length,candidates,solutions,assertions,pinnedSourceFiles:sourceFiles.length,licenseMatches:true};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
