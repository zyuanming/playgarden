/** Differential replay of actual TS against an independent Python bitboard oracle. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as engine from '../../src/games/ataxxLogic.ts';
const fixturePath=fileURLToPath(new URL('./fixtures.py', import.meta.url));
const generated=spawnSync('python3',[fixturePath],{encoding:'utf8',maxBuffer:32*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
assert.equal(generated.status,0,generated.stderr);
const cases=JSON.parse(generated.stdout),resultCode={x:1,o:2,draw:0};
const decode=p=>({size:p.size,board:[...p.cells].map(c=>({x:1,o:2,'.':0,'#':-1})[c]),turn:p.turn==='x'?1:2,quiet:p.halfmove});
const expectedResult=r=>r===null?null:resultCode[r];
const canonical=(p,m)=>m===null?'p':engine.distance(m.from,m.to,p.size)===1?`c:${m.to}`:`j:${m.from}:${m.to}`;
let transitions=0,aliases=0,illegalChecks=0,terminalChecks=0;
for(const c of cases){
  const p=decode(c.position), before=JSON.stringify(p);
  assert.equal(engine.validPosition(p),true,c.name);
  assert.equal(engine.outcome(p),expectedResult(c.result),`${c.name} result`);
  const moves=engine.moves(p),identities=moves.map(m=>canonical(p,m));
  assert.equal(new Set(identities).size,moves.length,`${c.name} dedup`);
  assert.deepEqual([...identities].sort(),c.successors.map(v=>v.action).sort(),`${c.name} legal set`);
  const byKey=new Map(moves.map(m=>[canonical(p,m),m]));
  for(const s of c.successors){
    const m=byKey.get(s.action),q=engine.play(p,m),expected=decode(s.after);
    assert.equal(engine.legal(p,m),true,`${c.name} ${s.action} legal`);
    assert.deepEqual(q,expected,`${c.name} ${s.action} successor`);
    assert.deepEqual(engine.apply(p,m),expected,`${c.name} ${s.action} unchecked successor`);
    assert.equal(engine.outcome(q),expectedResult(s.result),`${c.name} ${s.action} result`);
    assert.deepEqual(engine.replay(p,[m]),expected,`${c.name} replay`);
    assert.deepEqual(engine.parseSave(JSON.stringify({id:c.name,history:[m]}),p,c.name),[m],`${c.name} save`);
    transitions++;
    if(s.action.startsWith('c:'))for(let source=0;source<p.board.length;source++){
      if(p.board[source]!==p.turn||engine.distance(source,m.to,p.size)!==1)continue;
      assert.deepEqual(engine.play(p,{from:source,to:m.to}),expected,`${c.name} clone alias ${source}`);aliases++;
    }
  }
  for(const m of [{from:-1,to:0},{from:0,to:-1},{from:p.board.length,to:0},{from:0,to:p.board.length},{from:NaN,to:0},{from:0,to:Infinity},{from:0.5,to:0},{from:0,to:0},{from:'0',to:1},undefined,{},false]){
    assert.equal(engine.legal(p,m),false,`${c.name} malformed move`);
    assert.strictEqual(engine.play(p,m),p,`${c.name} illegal does not mutate`);illegalChecks++;
  }
  if(c.result!==null){
    for(let from=0;from<p.board.length;from++)for(let to=0;to<p.board.length;to++){
      assert.strictEqual(engine.play(p,{from,to}),p,`${c.name} post-terminal`);terminalChecks++;
    }
    assert.strictEqual(engine.play(p,null),p,`${c.name} post-terminal pass`);
  }
  assert.equal(JSON.stringify(p),before,`${c.name} original mutation`);
  assert.deepEqual(engine.replay(p,[]),p);
  for(const history of [null,{},'[]',[{from:0,to:1,extra:1}],[{from:0}],[false],[[]],Array(5001).fill(null)])assert.equal(engine.replay(p,history),null,`${c.name} malformed history`);
  for(const raw of [null,'{','null','{}','[]',JSON.stringify({id:'wrong',history:[]}),JSON.stringify({id:c.name,history:[{from:0,to:0}]}),' '.repeat(180001)])assert.deepEqual(engine.parseSave(raw,p,c.name),[],`${c.name} malformed storage`);
}
const initial=engine.start();
assert.equal(initial.size,7);assert.equal(initial.board[24],-1);assert.deepEqual(engine.counts(initial),[2,2]);
for(const invalid of [null,{},[],{...initial,size:2},{...initial,size:8},{...initial,size:3.5},{...initial,board:[]},{...initial,board:initial.board.map(()=>false)},{...initial,board:initial.board.map(()=>NaN)},{...initial,board:Array(49)},{...initial,turn:0},{...initial,turn:'1'},{...initial,quiet:NaN},{...initial,quiet:Infinity},{...initial,quiet:-1},{...initial,quiet:101},{...initial,quiet:0.5}])assert.equal(engine.validPosition(invalid),false);
const report={status:'PASS',oracle:'independent Python 49-bit coordinate-neighborhood model',fixtureSeed:9504226,positions:cases.length,transitions,cloneAliases:aliases,illegalChecks,postTerminalMoveChecks:terminalChecks,boardSizes:[3,4,5,6,7],storage:'action-only replay, malformed values, wrong IDs, impossible moves, oversized history/raw string',sourceCommit:'4226c26dd11a1f74be708882ece6fd9dc96c767b'};
writeFileSync(fileURLToPath(new URL('../../docs/ataxx/independent-runtime.json',import.meta.url)),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
