import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateFilled, fullClues, randomFor, encodeDescription, generatePuzzle } from './adapted-generator.mjs';
import { slantWon, solveSlant, newSlantState, playSlant, undoSlant, slantHint } from '../../src/games/slantLogic.ts';
test('adapted generator gives acyclic certificates and reproducible clues', () => {
 for (let seed = 0; seed < 100; seed++) { const solution = generateFilled(5, 5, randomFor(String(seed))); const p = {width:5,height:5,clues:fullClues(5,5,solution)}; assert.ok(slantWon(p,solution)); assert.equal(solveSlant(p).status,'unique'); assert.deepEqual(generateFilled(5,5,randomFor(String(seed))),solution); }
 assert.equal(encodeDescription([-1,-1,0,-1,2]), 'b0a2');
});
test('rejects unnumbered loop, missing square, wrong degree and distinguishes budgets',()=>{
 const p={width:2,height:2,clues:Array(9).fill(-1)};
 assert.equal(slantWon(p,[1,-1,-1,1]),false);
 assert.equal(slantWon(p,[-1,-1,-1,0]),false);
 assert.equal(slantWon({...p,clues:[0,...p.clues.slice(1)]},[-1,-1,-1,-1]),false);
 assert.equal(solveSlant(p).status,'multiple');
 assert.equal(solveSlant(p,undefined,0).status,'timeout');
 assert.equal(solveSlant({...p,clues:[0,...p.clues.slice(1)]},[-1,0,0,0]).status,'unsat');
 assert.equal(slantWon(p,[-1,-1,-1,-1]),true);
});
test('state input and hints honour the current board',()=>{
 const p=generatePuzzle(5,5,'test-core'), state=newSlantState(p);
 assert.equal(playSlant(p,state,-1,-1),state); assert.equal(playSlant(p,state,0,-1,true),state);
 const next=playSlant(p,state,0,p.solution[0]); assert.deepEqual(undoSlant(p,next).board,state.board);
 let won=state; p.solution.forEach((v,i)=>won=playSlant(p,won,i,v)); assert.ok(slantWon(p,won.board)); assert.equal(undoSlant(p,won),won); assert.equal(playSlant(p,won,0,0),won);
 const bad=state.board.slice(); bad[0]=-p.solution[0]; assert.equal(slantHint(p,bad).cell,-1);
 assert.equal(slantHint(p,next.board).value,p.solution[1]);
});
