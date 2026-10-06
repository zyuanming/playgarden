#!/usr/bin/env node
/** Original deterministic corpus; brute force response signatures, D4 de-duplication,
 * and a replayable information-gathering trace. Trace length is NOT an optimum. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {blackboxUniverse,bestBlackboxProbe,observedBlackbox} from '../../src/games/blackboxLogic.ts';
const root=new URL('../../',import.meta.url);
const chapters=[
 {id:'first-signals',title:'听懂一颗星',lesson:'先从北边发射。● 表示光束正面碰到星；↩ 表示返回入口；另一侧的编号表示出口。用交叉证据找一颗星。',size:3,countAtoms:1,count:3},
 {id:'two-shadows',title:'两颗星的影子',lesson:'正前方有星会优先吸收；仅前侧有星，会在进入那一行前转弯，远离星。换一边探测，别只看一条线。',size:4,countAtoms:2,count:9},
 {id:'turn-together',title:'转弯遇上转弯',lesson:'两颗星同时在前侧，会让光束掉头。中途可以连续转弯；返回并不说明入口正前方有星。',size:4,countAtoms:3,count:12},
 {id:'wider-sky',title:'把视野放宽',lesson:'一条贯通的路线同时确定入口和出口。点击已有记录可以回看，不会增加探测数。先选能区别多种猜想的入口。',size:5,countAtoms:2,count:16},
 {id:'cross-evidence',title:'让证据交汇',lesson:'★ 是你的猜测，× 是空格笔记。它们不改变光束，也不限制提示的候选。发现冲突就撤销标注，再换一个角度。',size:5,countAtoms:3,count:20},
 {id:'deep-nebula',title:'星雾深处',lesson:'四颗星会遮挡或改变彼此的信号。没有限时或探测上限；验证比较所有边缘响应，任何完全等价的布局都能过关。',size:5,countAtoms:4,count:24},
];
function canonical(n,a){const options=[];for(let reflect=0;reflect<2;reflect++)for(let r=0;r<4;r++){options.push(a.map(cell=>{let x=cell%n,y=Math.floor(cell/n);if(reflect)x=n-1-x;for(let k=0;k<r;k++)[x,y]=[n-1-y,x];return y*n+x;}).sort((a,b)=>a-b).join(','));}return options.sort()[0];}
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function solve(n,target,universe){let candidates=universe,probes=[],trace=[];while(candidates.length>1){let hint=bestBlackboxProbe(n,candidates,observedBlackbox(probes));assert(hint);let p={port:hint.port,result:target.signature[hint.port]};probes.push(p);let observed=observedBlackbox(probes);candidates=candidates.filter(c=>observed.every(o=>c.signature[o.port]===o.result));trace.push({...p,candidates:candidates.length,worst:hint.worst,partitions:hint.partitions});}return trace;}
const levels=[],stats=[];
for(const [chapter,config]of chapters.entries()){
 const {size:n,countAtoms:k,count}=config,universe=blackboxUniverse(n,k),sigcounts=new Map();
 for(const c of universe){let sig=c.signature.join(',');sigcounts.set(sig,(sigcounts.get(sig)||0)+1);}
 const seen=new Set();let candidates=[];
 for(const c of universe){if(sigcounts.get(c.signature.join(','))!==1)continue;let can=canonical(n,c.atoms);if(seen.has(can))continue;seen.add(can);
 const edge=c.atoms.filter(i=>i%n===0||i%n===n-1||Math.floor(i/n)===0||Math.floor(i/n)===n-1).length;
 const adjacent=c.atoms.reduce((v,a)=>v+c.atoms.filter(b=>b>a&&Math.abs(a%n-b%n)+Math.abs(Math.floor(a/n)-Math.floor(b/n))===1).length,0);
 const trace=solve(n,c,universe),hits=c.signature.filter(r=>r===-1).length,returns=c.signature.filter(r=>r===-2).length;
 candidates.push({atoms:[...c.atoms],signature:[...c.signature],canonical:can,probeTrace:trace,metrics:{greedyProbes:trace.length,edge,adjacent,hits,returns,through:4*n-hits-returns},rank:hash(`${n}:${k}:${can}:starlab-20261006`)});
 }
 let selected=[];
 if(chapter===0)selected=[4,1,0].map(cell=>candidates.find(c=>c.atoms[0]===cell));
 else{
  // Round-robin through structural AND information-depth buckets, not random reskins.
  const buckets=new Map();for(const c of candidates){let key=[c.metrics.greedyProbes,c.metrics.edge,c.metrics.adjacent,Math.floor(c.metrics.returns/3)].join(':');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(c);}
  const ordered=[...buckets.entries()].sort((a,b)=>Number(a[0].split(':')[0])-Number(b[0].split(':')[0])||hash(a[0])-hash(b[0]));
  for(const [,b]of ordered)b.sort((a,b)=>a.rank-b.rank);
  // Sample the whole quality range in each chapter, then order easy-to-hard.
  for(let round=0;selected.length<count;round++){const available=ordered.filter(([,b])=>b[round]);assert(available.length);const remaining=count-selected.length;const indices=available.length<=remaining?available.map((_,i)=>i):Array.from({length:remaining},(_,i)=>Math.floor(i*(available.length-1)/Math.max(1,remaining-1)));for(const i of indices)selected.push(available[i][1][round]);}
  selected.sort((a,b)=>a.metrics.greedyProbes-b.metrics.greedyProbes||a.metrics.adjacent-b.metrics.adjacent||a.rank-b.rank);
 }
 assert.equal(selected.length,count);assert(selected.every(Boolean));
 for(const [i,c]of selected.entries()){const id=`blackbox-${String(levels.length+1).padStart(3,'0')}`;const {rank,...details}=c;levels.push({id,title:`${config.title} · ${i+1}`,chapter,size:n,...details});}
 stats.push({chapter:config.id,universe:universe.length,uniqueLayouts:[...sigcounts.values()].filter(v=>v===1).length,uniqueD4Classes:candidates.length,selected:selected.length,greedyRange:[Math.min(...selected.map(c=>c.metrics.greedyProbes)),Math.max(...selected.map(c=>c.metrics.greedyProbes))]});
}
const manifest={version:1,rules:'boundary-priority-front-then-diagonals-v1',ports:'N left-to-right, E top-to-bottom, S left-to-right, W top-to-bottom; -1 absorbed, -2 reflected',selection:'D4-distinct, unique full signatures; structurally stratified with deterministic hash, ordered by greedy evidence trace length. No shortest-probe claim.',chapters,stats,levels};
const runtime=levels.map(({id,title,chapter,size,atoms})=>({id,title,chapter,size,atoms}));
const outputs=[['src/games/blackboxLevels.ts',`import type { BlackboxLevel } from './blackboxLogic';\n// Generated by scripts/blackbox/generate.mjs. Evidence certificates stay outside the bundle.\nexport const blackboxChapters = ${JSON.stringify(chapters.map(({size,countAtoms,...c})=>c),null,2)};\nexport const blackboxLevels: BlackboxLevel[] = ${JSON.stringify(runtime,null,2)};\n`],['docs/blackbox/campaign.json',JSON.stringify(manifest,null,2)+'\n']];
for(const [path,text]of outputs){const url=new URL(path,root);if(process.argv.includes('--check'))assert.equal(readFileSync(url,'utf8'),text,`${path} must regenerate exactly`);else{mkdirSync(new URL('./',url),{recursive:true});writeFileSync(url,text);}}
console.log(JSON.stringify({result:'pass',count:levels.length,stats},null,2));
