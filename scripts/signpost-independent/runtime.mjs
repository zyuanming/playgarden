// Independent oracle-based runtime review. Run with Node 24 type stripping.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { initialSignpost, inspectSignpost, linkSignpost, unlinkSignpost, parseSignpostSave, solveSignpost, pointsTo } from '../../src/games/signpostLogic.ts';
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(process.argv[2] ?? resolve(here, '../..'));
const report = JSON.parse(readFileSync(process.argv[3] ?? '/tmp/signpost-independent-report.json', 'utf8'));
const levelsSource = readFileSync(resolve(repo, 'src/games/signpostLevels.ts'), 'utf8');
const levels = JSON.parse(levelsSource.split('export const signpostLevels: SignpostLevel[] = ')[1].trim().replace(/;$/, ''));
assert.equal(report.count, 30);
const cases = [], rays = [];
let seed = 940031;
function random(n) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; }
for (const [i, p] of levels.entries()) {
  const path = report.levels[i].solution, n = path.length;
  assert.equal(report.levels[i].id, p.id);
  const blank = initialSignpost(p), complete = [...blank];
  path.slice(0,-1).forEach((a,k) => { complete[a] = path[k+1]; });
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    rays.push([p,a,b]);
    const state = [...blank]; state[a] = b; cases.push([p,state]);
  }
  // Exhaust every subset of the independently solved first puzzle's edges;
  // randomized masks for larger boards, including disjoint unanchored chains.
  for (let mask = 0; mask < (i === 0 ? 256 : 80); mask++) {
    const state = blank.map((_, a) => ((i === 0 ? mask >> path.indexOf(a) : random(2)) & 1) ? complete[a] : -1);
    cases.push([p,state]);
  }
  // Runtime transitions must accept arbitrarily ordered correct fragments.
  for (let trial = 0; trial < 5; trial++) {
    let state = blank;
    const order = path.slice(0,-1).map((_, k) => k);
    for (let k = order.length-1; k > 0; k--) { const j = random(k+1); [order[k],order[j]] = [order[j],order[k]]; }
    const history = [state];
    for (const k of order) {
      const r = linkSignpost(p,state,path[k],path[k+1]);
      assert.equal(r.reason,''); assert.notStrictEqual(r.state,state);
      state = r.state; history.push(state); cases.push([p,state]);
      if (!inspectSignpost(p,state).won) {
        const split = unlinkSignpost(p,state,path[k]);
        assert.equal(split[path[k]],-1);
        assert.deepEqual(linkSignpost(p,split,path[k],path[k+1]).state,state);
      }
      const completion = solveSignpost(p,state);
      assert.equal(completion.kind,'solution');
      assert.deepEqual(completion.state,complete);
    }
    assert.deepEqual(state,complete); assert.equal(inspectSignpost(p,state).won,true);
    assert.strictEqual(unlinkSignpost(p,state,path[0]),state);
    assert.strictEqual(linkSignpost(p,state,path[0],path[1]).state,state);
    assert.deepEqual(parseSignpostSave(JSON.stringify({id:p.id,history}),p),history);
    const forged = [blank,complete];
    assert.deepEqual(parseSignpostSave(JSON.stringify({id:p.id,history:forged}),p),[blank]);
    assert.deepEqual(parseSignpostSave(JSON.stringify({id:p.id,history:[complete,blank]}),p),[blank]);
  }
  assert.equal(solveSignpost(p,blank,0).kind,'budget');
  assert.equal(solveSignpost(p,blank,1).kind,'budget');
  for (const [a,b] of report.levels[i].locally_accepted_wrong_edges.slice(0,3)) {
    const r = linkSignpost(p,blank,a,b); assert.notStrictEqual(r.state,blank);
    assert.equal(solveSignpost(p,r.state).kind,'none');
  }
  for (let trial = 0; trial < 100; trial++) cases.push([p,blank.map(() => random(n+1)-1)]);
  for (const [a,b] of [[-1,0],[n,0],[0,n],[0,-1],[0,0],[NaN,0],[0,Infinity],[0,0.5]]) {
    assert.strictEqual(linkSignpost(p,blank,a,b).state,blank);
  }
  for (const raw of ['{','null','{}',JSON.stringify({id:p.id,history:[]}),JSON.stringify({id:p.id,history:[blank,blank]}),JSON.stringify({id:p.id,history:Array(502).fill(blank)})]) assert.deepEqual(parseSignpostSave(raw,p),[blank]);
  for (const malformed of [[],[...blank,0],blank.map(()=>NaN),blank.map(()=>null),blank.map(()=>true)]) assert.equal(inspectSignpost(p,malformed).valid,false);
}
// A deliberately branching 6x6 fixture exceeds 50,000 visits. It makes the
// NaN/Infinity/oversized-budget regression observable, unlike easy campaigns.
{
  const p = {id:'budget-hard-cap',title:'budget',chapter:0,width:6,height:6,arrows:[],clues:Array(36).fill(0)};
  for (let y=0;y<6;y++) for (let x=0;x<6;x++) p.arrows.push(y%2===0?(x===5?4:2):(x===0?4:6));
  p.clues[0]=1; p.clues[30]=36; p.arrows[30]=-1;
  const blank=initialSignpost(p), baseline=solveSignpost(p,blank);
  assert.equal(baseline.kind,'budget'); assert.ok(baseline.nodes<=50001);
  for (const budget of [NaN,Infinity,-Infinity,1e9]) {
    assert.deepEqual(solveSignpost(p,blank,budget),baseline);
  }
  assert.deepEqual(solveSignpost(p,blank,1.9),solveSignpost(p,blank,1));
  assert.deepEqual(solveSignpost(p,blank,-10),solveSignpost(p,blank,0));
}
// Start with a genuinely unanchored internal segment; attach an anchor later.
{
  const p = levels[14]; let state = initialSignpost(p);
  for (const [a,b] of [[1,3],[3,2],[2,0]]) state = linkSignpost(p,state,a,b).state;
  const relative = inspectSignpost(p,state);
  assert.deepEqual([1,3,2,0].map(i=>relative.labels[i]),['A1','A2','A3','A4']);
  assert.deepEqual([1,3,2,0].map(i=>relative.numbers[i]),[0,0,0,0]);
  state = linkSignpost(p,state,0,4).state;
  const anchored = inspectSignpost(p,state);
  assert.deepEqual([1,3,2,0,4].map(i=>anchored.numbers[i]),[2,3,4,5,6]);
  assert.equal(anchored.won,false);
  state = unlinkSignpost(p,state,0);
  assert.deepEqual([1,3,2,0].map(i=>inspectSignpost(p,state).labels[i]),['A1','A2','A3','A4']);
  cases.push([p,state]);
}
// All 5^4 successor arrays on two small fixtures, including non-anchor cycles.
for (const p of [
  {width:2,height:2,arrows:[2,4,0,6],clues:[0,0,0,0]},
  {width:2,height:2,arrows:[2,4,2,-1],clues:[1,0,0,4]},
]) for (let code = 0; code < 625; code++) {
  let rest = code; const state = [];
  for (let i=0;i<4;i++) { state.push(rest%5-1);rest=Math.floor(rest/5); }
  cases.push([p,state]);
}
const child = spawnSync('python3',[resolve(here,'oracle.py')],{input:JSON.stringify({states:cases,rays}),encoding:'utf8',maxBuffer:32*1024*1024});
assert.equal(child.status,0,child.stderr);
const expected = JSON.parse(child.stdout);
for (const [i,[p,state]] of cases.entries()) {
  const actual = inspectSignpost(p,state), want = expected.states[i];
  assert.equal(actual.valid,want.valid,`validity case ${i}: ${JSON.stringify({p,state})}`);
  assert.equal(actual.won,want.won,`completion case ${i}`);
  if (want.valid) assert.deepEqual(actual.numbers,want.numbers,`anchor propagation case ${i}`);
}
for (const [i,[p,a,b]] of rays.entries()) assert.equal(pointsTo(p,a,b),expected.rays[i],`ray case ${i}`);
console.log(`Signpost independent runtime: ${cases.length} state-oracle comparisons; ${rays.length} ray comparisons; 150 shuffled full replays; split/rejoin, current-state hints, budgets, invalid input, terminal locks and save history passed.`);
