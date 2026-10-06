#!/usr/bin/env node
/** Original deterministic prefix-reversal corpus. BFS supplies exact distances, not scramble lengths. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const check = process.argv.includes('--check');
const factorial = n => n < 2 ? 1 : n * factorial(n - 1);
const rank = a => a.reduce((r, v, i) => r + a.slice(i + 1).filter(x => x < v).length * factorial(a.length - i - 1), 0);
const flip = (a, k) => [...a.slice(0, k).reverse(), ...a.slice(k)];
const tables = new Map(), distances = {};
for (let n = 3; n <= 8; n++) {
  const goal = Array.from({length:n}, (_, i) => i + 1), queue = [goal];
  const data = new Int8Array(factorial(n)).fill(-1); data[0] = 0;
  for (let head = 0; head < queue.length; head++) {
    const a = queue[head], d = data[rank(a)];
    for (let k = 2; k <= n; k++) { const b = flip(a, k), r = rank(b); if (data[r] < 0) {data[r] = d + 1; queue.push(b);} }
  }
  if (queue.length !== factorial(n) || [...data].some(x => x < 0 || x > 9)) throw Error('Incomplete BFS');
  tables.set(n, queue); distances[n] = [...data].join('');
}
const distance = a => Number(distances[a.length][rank(a)]);
const solve = a => {const result = []; let board = [...a]; while (distance(board)) {const k = Array.from({length:board.length-1}, (_,i)=>i+2).find(k => distance(flip(board,k)) === distance(board)-1); if (!k) throw Error('Missing descent'); result.push(k); board=flip(board,k);} return result;};
const greedy = a => {const board=[...a], moves=[]; for(let size=a.length;size>1;size--) { const index=board.indexOf(size); if(index===size-1)continue; if(index>0){moves.push(index+1);board.splice(0,index+1,...board.slice(0,index+1).reverse());} moves.push(size);board.splice(0,size,...board.slice(0,size).reverse());} return moves.length;};
const features = a => ({
  optimalOpenings: Array.from({length:a.length-1},(_,i)=>i+2).filter(k=>distance(flip(a,k))===distance(a)-1),
  greedyMoves: greedy(a),
  breakpoints: a.reduce((total,v,i)=>total+Number(i===a.length-1?v!==a.length:Math.abs(v-a[i+1])!==1),0),
});
const chapters = [
 { id:'first-flip', title:'认准翻面范围', lesson:'目标是小在上、大在下。点第几层，就会把它和上面所有煎饼一起翻过来。先看虚线框，再确认。', count:8 },
 { id:'overlapping-flips', title:'两次翻转相遇', lesson:'一次翻转会改动一整段顺序。试着先把想放下去的煎饼带到顶端，再选新的层数。', count:12 },
 { id:'place-largest', title:'把大饼送到底', lesson:'先把最大的一片翻到顶部，再翻整叠，就能把它送到底部。这个方法总能整理好，但不一定最省步。', count:18 },
 { id:'keep-neighbors', title:'留住好邻居', lesson:'连续相邻的大小可以当作一组来观察。翻转可能拆散它们，也可能让两组刚好接上。', count:24 },
 { id:'compare-routes', title:'换条路线试试', lesson:'比较不同的首翻。眼前整齐不一定离目标更近；撤销和当前局面提示都能帮你检验想法。', count:26 },
 { id:'whole-stack', title:'整叠的计划', lesson:'8 片有 40,320 种排列。先整理成功，再挑战开局的最少步数；没有限时，超步也能通关。', count:32 },
];
const chosen = [], seen = new Set();
function add(a, chapter) {const key=a.join('');if(seen.has(key))return false;seen.add(key);const ordinal=chosen.filter(x=>x.chapter===chapter).length+1;chosen.push({id:`pancake-${String(chosen.length+1).padStart(3,'0')}`,title:`${chapters[chapter].title} · ${ordinal}`,chapter,stack:a,minMoves:distance(a),solution:solve(a),features:features(a)});return true;}
// A small, deliberately ordered introduction: one flip, two flips, then overlap.
for(const a of [[2,1,3],[3,2,1],[2,3,1],[3,1,2],[1,3,2],[4,3,2,1],[3,4,2,1],[2,4,1,3]])add(a,0);
function hash(a) {let h=2166136261;for(const value of a){h=Math.imul(h^value,16777619)>>>0;}return h;}
for(let chapter=1;chapter<chapters.length;chapter++) {
 const n=chapter+3, count=chapters[chapter].count;
 const pool=tables.get(n).filter(a=>distance(a)>=(chapter===1?2:chapter+1) && a.at(-1)!==n && !seen.has(a.join(''))).map(a=>({a,d:distance(a),f:features(a),h:hash(a)}));
 // Round-robin depth / optimal-choice / greedy-detour buckets preserves decision variety.
 const buckets=new Map();for(const item of pool){const key=`${item.d}:${item.f.optimalOpenings.length===1?'one':'many'}:${item.f.greedyMoves>item.d?'detour':'direct'}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(item);}
 const ordered=[...buckets.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([,items])=>items.sort((a,b)=>a.h-b.h));
 const selections=[];while(selections.length<count){let any=false;for(const b of ordered){if(b.length&&selections.length<count){selections.push(b.shift());any=true;}}if(!any)throw Error('Not enough distinct levels');}
 selections.sort((a,b)=>a.d-b.d||a.f.greedyMoves-b.f.greedyMoves||a.h-b.h).forEach(({a})=>add(a,chapter));
}
if(chosen.length!==120)throw Error('Unexpected campaign count');
const campaign={schemaVersion:1,method:'Complete reverse BFS under prefix flips k=2..n; all code, text and permutations authored for Playgarden.',chapters,levels:chosen};
const runtime=chosen.map(({solution,features,...level})=>level);
const files={
 'docs/pancake/campaign.json':JSON.stringify(campaign,null,2)+'\n',
 'src/games/pancakeLevels.ts':`import type { PancakeLevel } from './pancakeLogic';\n// Generated by scripts/pancake/generate.mjs. Certificates stay in docs/.\nexport const pancakeChapters = ${JSON.stringify(chapters,null,2)};\nexport const pancakeLevels: PancakeLevel[] = ${JSON.stringify(runtime,null,2)};\n`,
 'src/games/pancakeDistances.ts':`// Exact reverse-BFS distances, indexed by zero-based Lehmer rank. Maximum n=8.\n// Generated by scripts/pancake/generate.mjs; no search or certificate playback on the UI thread.\nexport const pancakeDistances: Record<number, string> = ${JSON.stringify(distances,null,2)};\n`,
};
for(const [path,text] of Object.entries(files)){if(check){if(readFileSync(root+path,'utf8')!==text)throw Error(`Regeneration mismatch: ${path}`);}else writeFileSync(root+path,text);}
console.log(JSON.stringify({levels:chosen.length,states:Object.values(distances).reduce((s,v)=>s+v.length,0),chapters:chapters.map((ch,i)=>({title:ch.title,count:chosen.filter(l=>l.chapter===i).length,depths:[...new Set(chosen.filter(l=>l.chapter===i).map(l=>l.minMoves))],greedyDetours:chosen.filter(l=>l.chapter===i&&l.features.greedyMoves>l.minMoves).length})),result:check?'reproduced':'generated'},null,2));
