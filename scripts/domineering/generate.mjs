// SPDX-License-Identifier: GPL-3.0-only
// Original deterministic campaign construction. Not a test or solver sweep.
import {writeFileSync} from 'node:fs';
const moves=(mask,vertical)=>Array.from({length:16},(_,i)=>i).filter(i=>(vertical?i<12:i%4<3)&&(mask&(1<<i))&&(mask&(1<<(i+(vertical?4:1)))));
const take=(m,i,v)=>m&~((1<<i)|(1<<(i+(v?4:1))));
const cache=new Map();
function winning(m,v){const k=m*2+Number(v);if(cache.has(k))return cache.get(k);const w=moves(m,v).some(i=>!winning(take(m,i,v),!v));cache.set(k,w);return w;}
const best=(m,v)=>moves(m,v).find(i=>!winning(take(m,i,v),!v))??moves(m,v)[0];
const bits=m=>m.toString(2).replaceAll('0','').length;
function connected(m){let seen=0,stack=[Math.log2(m&-m)];while(stack.length){let i=stack.pop();if(seen&(1<<i))continue;seen|=1<<i;for(const j of [i%4?i-1:-1,i%4<3?i+1:-1,i-4,i+4])if(j>=0&&j<16&&(m&(1<<j))&&!(seen&(1<<j)))stack.push(j);}return seen===m;}
function canonical(m){let variants=[];for(let t=0;t<8;t++){let n=0;for(let i=0;i<16;i++)if(m&(1<<i)){let x=i%4,y=i>>2;if(t&4)x=3-x;for(let k=0;k<(t&3);k++)[x,y]=[3-y,x];n|=1<<(y*4+x);}variants.push(n);}return Math.min(...variants);}
let seed=20261020;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
const selected=[],seen=new Set();
for(let count=6;count<=14;count++){let quota=count===6?4:count===7?6:count===8?10:count<=12?15:count===13?10:0;let attempts=0;while(quota&&attempts++<1000000){const m=random()&65535;if(bits(m)!==count||!connected(m)||seen.has(canonical(m))||moves(m,true).length<2||moves(m,false).length<2||!winning(m,true))continue;seen.add(canonical(m));selected.push(m);quota--;}}
// Fill to 100 using connected, orientation-distinct puzzles, never mirrors/rotations.
while(selected.length<100){const m=random()&65535;if(bits(m)<8||bits(m)>14||!connected(m)||seen.has(canonical(m))||moves(m,true).length<2||moves(m,false).length<2||!winning(m,true))continue;seen.add(canonical(m));selected.push(m);}
selected.sort((a,b)=>bits(a)-bits(b));
const levels=selected.slice(0,100).map((mask,index)=>{let m=mask,v=true,solution=[];while(moves(m,v).length){const i=best(m,v);solution.push(i);m=take(m,i,v);v=!v;}return {id:`domineering-${String(index+1).padStart(3,'0')}`,mask,cells:bits(mask),solution};});
writeFileSync('src/games/domineeringLevels.json',JSON.stringify(levels,null,2)+'\n');
console.log(`Created ${levels.length} original connected, symmetry-distinct positions.`);
