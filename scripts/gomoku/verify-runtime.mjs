import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {emptyPosition,playMove,replayMoves,winningLinesAt,immediateWins,undoMoves,opponent} from '../../src/games/gomokuLogic.ts';
import {chooseMove} from '../../src/games/gomokuAi.ts';
import {gomokuLevels} from '../../src/games/gomokuLevels.ts';
import {meetsGoal,practiceResult,validPracticeRound,practiceDefense} from '../../src/games/gomokuPractice.ts';
const json=(path)=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const fixtures=json('../../docs/gomoku/rule-fixtures.json'),corpus=json('../../docs/gomoku/corpus.json'),certificates=json('../../docs/gomoku/certificates.json');
const normal=lines=>[...new Set(lines.map(line=>line.slice().sort((a,b)=>a-b).join(',')))].sort();
let assertions=0,branches=0,goalMoves=0;
for(const f of fixtures.positions){
 for(const stone of [1,2]){
  const actual=f.board.flatMap((s,i)=>s===stone?winningLinesAt(f.board,i):[]);
  assert.deepEqual(normal(actual),normal(f.expected.winningLines[stone]),f.id);assertions++;
  if(!f.expected.winners.length){assert.deepEqual(immediateWins(f.board,stone),f.expected.winningMoves[stone],f.id);assertions++;}
 }
}
for(const f of fixtures.histories){
 const p=replayMoves(f.moves);assert(p,f.id);assertions++;
 assert.deepEqual(p.board,f.expected.board,f.id);assert.equal(p.turn,f.expected.toMove);assert.equal(p.winner,f.expected.winner||null);assert.equal(p.draw,f.expected.draw);assertions+=4;
 if(!p.winner&&!p.draw)for(const stone of [1,2]){assert.deepEqual(immediateWins(p.board,stone),f.expected.winningMoves[stone],f.id);assertions++;}
 const n=Math.min(3,p.moves.length);assert.deepEqual(undoMoves(p,n),replayMoves(p.moves.slice(0,p.moves.length-n)));assertions++;
}
for(const f of fixtures.invalidHistories){assert.equal(replayMoves(f.moves),null,f.id);assertions++;}
assert.equal(corpus.length,24);assert.deepEqual(corpus.map(p=>p.id),gomokuLevels.map(p=>p.id));assertions+=2;
for(const p of corpus){
 const runtime=gomokuLevels.find(x=>x.id===p.id);for(const key of ['moves','solution','solutions','continuation','objective'])assert.deepEqual(runtime[key],p[key],p.id);assertions+=5;
 const start=replayMoves(p.moves);assert(start);const actual=[];
 for(let i=0;i<225;i++){if(start.board[i])continue;goalMoves++;const after=playMove(start,i);if(meetsGoal(after,start.turn,p.objective))actual.push(i);}
 assert.deepEqual(actual,p.solutions,p.id);assertions++;
 let end=start;for(const [n,move] of p.continuation.entries()){
  if(p.objective==='fork'&&n>0)break;
  end=playMove(end,move);assert(validPracticeRound(runtime,end),p.id);assertions++;
 }
 assert.equal(practiceResult(runtime,end),'success',p.id);assertions++;
 const cert=certificates[p.id];if(!cert)continue;
 const first=playMove(start,cert.firstMove);assert.equal(practiceDefense(runtime,first),immediateWins(first.board,start.turn)[0]);assertions++;
 for(const branch of cert.branches){
  branches++;const reply=playMove(first,branch.opponentMove);assert.notEqual(reply,first);assert.equal(reply.winner,null);assert.equal(reply.draw,false);assertions+=3;
  assert.deepEqual(immediateWins(reply.board,start.turn),branch.winningMoves);assertions++;
  for(const m of branch.winningMoves){assert.equal(playMove(reply,m).winner,start.turn);assertions++;}
 }
}
for(const difficulty of ['gentle','steady'])for(const p of corpus){
 const pos=replayMoves(p.moves);const before=JSON.stringify(pos);const result=chooseMove(pos,difficulty,{nodeBudget:150,timeMs:50});assert(result.move!==null);assert.equal(pos.board[result.move],0);assert.equal(JSON.stringify(pos),before);assertions+=3;
 const wins=immediateWins(pos.board,pos.turn),threats=immediateWins(pos.board,opponent(pos.turn));
 if(wins.length){assert(wins.includes(result.move));assertions++;}else if(threats.length===1){assert.equal(result.move,threats[0]);assertions++;}
}
const sourceManifest=json('../../vendor/open-gomoku/sources.json');
for(const s of sourceManifest){const b=readFileSync(new URL('../../vendor/open-gomoku/'+s.file,import.meta.url));assert.equal(b.length,s.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),s.sha256);assert(s.url.includes('/0d8f81e687a04c729b1dfe5b0ce028295528cc17/'));assertions+=3;}
assert.equal(readFileSync(new URL('../../public/gomoku-LICENSE.txt',import.meta.url),'utf8').trim(),readFileSync(new URL('../../vendor/open-gomoku/LICENSE',import.meta.url),'utf8').trim());assertions++;
const report={result:'pass',assertions,staticBoards:fixtures.positions.length,legalHistories:fixtures.histories.length,illegalHistories:fixtures.invalidHistories.length,exercises:corpus.length,goalMoves,opponentBranches:branches,pinnedSourceFiles:sourceManifest.length,licenseMatches:true};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
