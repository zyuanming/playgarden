// Offline, deterministic curation. Node 24; no packages, network, or randomness.
// Runtime RREF scores candidates; tests use independent row chasing as the oracle.
import { readFileSync, writeFileSync } from 'node:fs';
import { solveLightsOut } from '../src/games/lightsOutLogic.ts';

const stages = [
  { title: '初识联动', size: 3, targets: [1,1,1,2,2,2,2,2,3,3,3,3,3,3], lesson: '先分清角、边和中心的影响范围。亮灯不一定就是要按的开关。' },
  { title: '叠加与抵消', size: 3, targets: [3,3,3,3,4,4,4,4,4,4,5,5,5,5], lesson: '同一盏灯被切换两次会抵消。试着找出重叠的十字，而不是只追着亮灯点。' },
  { title: '四阶边界', size: 4, targets: [3,3,3,3,4,4,4,4,4,5,5,5,5,5], lesson: '棋盘变大了，角和边的规则不变。先观察一个开关会影响哪些格，再动手。' },
  { title: '逐行推演', size: 4, targets: [5,5,5,5,6,6,6,6,6,6,7,7,7,7], lesson: '试着确定第一行的按法，再按下一行中正对亮灯的位置，逐行清理。最后一行不全暗，就调整第一行重试。' },
  { title: '五阶起步', size: 5, targets: [6,6,6,6,7,7,7,7,7,8,8,8,8,8], lesson: '把四阶的逐行方法带到五阶。先计划第一行，后面的按法会被上一行的亮灯确定。' },
  { title: '连锁规划', size: 5, targets: [8,8,8,8,9,9,9,9,9,10,10,10,10,10], lesson: '暂时点亮更多灯也可能是正确的一步。关注整片联动，必要时用撤销比较两种方案。' },
  { title: '全局观察', size: 5, targets: [10,10,10,10,11,11,11,11,11,12,12,12,12,12], lesson: '按键顺序不会改变最终结果，每格最多需要按一次。把计划当作一组选中的开关来检查。' },
  { title: '静夜挑战', size: 5, targets: [12,12,12,12,13,13,13,13,13,13,14,14,14,15], lesson: '综合运用抵消与逐行推演。最少步数只是参考，任何让所有灯熄灭的方案都能通关。' },
];
const pop = (v) => { let n = 0; for (; v; v &= v - 1) n++; return n; };
const positions = (mask, size) => Array.from({length:size*size}, (_,i)=>i).filter(i=>mask&(1<<i));
const asBoard = (mask, size) => Array.from({length:size*size}, (_,i)=>!!(mask&(1<<i)));
function variants(mask, size) {
  const result = [];
  for (let flip = 0; flip < 2; flip++) for (let turns = 0; turns < 4; turns++) {
    let transformed = 0;
    for (const cell of positions(mask, size)) {
      let r = Math.floor(cell/size), c = cell%size;
      if (flip) c = size-1-c;
      for (let t=0;t<turns;t++) [r,c]=[c,size-1-r];
      transformed |= 1 << (r*size+c);
    }
    result.push(transformed);
  }
  return [...new Set(result)];
}
function toggles(presses, size) {
  const full = (1 << (size*size))-1;
  let left = 0; for (let r=0;r<size;r++) left |= 1 << (r*size);
  const right = left << (size-1);
  return (presses ^ (presses<<size) ^ (presses>>>size) ^ ((presses&~right)<<1) ^ ((presses&~left)>>>1)) & full;
}
const selected = [], poolStats = {};
for (const size of [3,4,5]) {
  const pool = new Map();
  const add = mask => {
    if (!mask) return;
    const orbit = variants(mask,size), key = Math.min(...orbit);
    if (pool.has(key)) return;
    const solution = solveLightsOut(asBoard(mask,size),size);
    if (!solution?.length) return;
    pool.set(key, {mask, key, orbit, solution, distance:size*size});
  };
  if (size < 5) {
    // Complete small-board space, not a seeded/random sample.
    for (let mask=1;mask<1<<(size*size);mask++) add(mask);
  } else {
    // Exhaust every switch pattern supported on any three of five rows.
    for (let a=0;a<3;a++) for (let b=a+1;b<4;b++) for (let c=b+1;c<5;c++) {
      for (let code=0;code<32768;code++) {
        const presses = ((code&31)<<(a*5)) | (((code>>>5)&31)<<(b*5)) | ((code>>>10)<<(c*5));
        add(toggles(presses,5));
      }
    }
    // Deliberate dense finale family: all-on and one/two-switch deviations.
    const full = (1<<25)-1;
    add(full);
    for (let a=0;a<25;a++) {
      add(full^toggles(1<<a,5));
      for (let b=a+1;b<25;b++) add(full^toggles((1<<a)|(1<<b),5));
    }
  }
  poolStats[size] = {};
  for (const p of pool.values()) poolStats[size][p.solution.length] = (poolStats[size][p.solution.length]??0)+1;
  const used = new Set();
  const pick = (candidate, chapter, step) => {
    if (!candidate || used.has(candidate.key)) throw new Error('Missing/duplicate curated board');
    used.add(candidate.key);
    const title = chapter===0 && step<3 ? ['角落的一盏','边上的回声','中心的十字'][step] : chapter===7 && step===13 ? '满园星光' : `${stages[chapter].title} · ${step+1}`;
    selected.push({size, chapter, title, mask:candidate.mask, solution:candidate.solution});
    for (const p of pool.values()) {
      p.distance = Math.min(p.distance,...candidate.orbit.map(v=>pop(p.mask^v)));
    }
  };
  for (let chapter=0;chapter<stages.length;chapter++) {
    const stage=stages[chapter]; if (stage.size!==size) continue;
    for (let step=0;step<14;step++) {
      const target=stage.targets[step];
      if (chapter===0 && step<3) {
        const mask=toggles(1<<[0,1,4][step],3), key=Math.min(...variants(mask,3));
        const p=pool.get(key); pick({...p,mask,solution:[[0],[1],[4]][step]},chapter,step); continue;
      }
      if (chapter===7 && step===13) { pick(pool.get((1<<25)-1),chapter,step); continue; }
      // Maximin board-orbit distance avoids near-copy chains. Tie-break by
      // alternating sparse/balanced/dense light counts, then stable mask order.
      const density=[0.3,0.5,0.7][step%3]*size*size;
      const candidates=[...pool.values()].filter(p=>!used.has(p.key)&&p.solution.length===target);
      candidates.sort((a,b)=>b.distance-a.distance || Math.abs(pop(a.mask)-density)-Math.abs(pop(b.mask)-density) || a.key-b.key);
      pick(candidates[0],chapter,step);
    }
  }
}
const chapters = stages.map(({title,size,lesson},i)=>({title,size,lesson,start:i*14,count:14}));
const output = `// Generated by scripts/build-lights-out-campaign.mjs. Fixed campaign v1 (2026-10-05 rebuild).\n// The previous unpushed pack was unavailable; this is a newly curated campaign.\nexport const LIGHTS_OUT_CAMPAIGN_VERSION = 1;\nexport const lightsOutChapters = ${JSON.stringify(chapters,null,2)} as const;\n\n// [initial light bitmask, one exact minimum-solution bitmask, title]\nexport const lightsOutBoards: readonly (readonly [number, number, string])[] = [\n${selected.map(p=>`  [${p.mask}, ${p.solution.reduce((m,i)=>m|(1<<i),0)}, ${JSON.stringify(p.title)}],`).join('\n')}\n];\nexport const LIGHTS_OUT_LEVEL_COUNT = lightsOutBoards.length;\n`;
const path = new URL('../src/games/lightsOutCampaign.ts',import.meta.url);
if (process.argv.includes('--write')) writeFileSync(path,output);
else if (readFileSync(path,'utf8')!==output) throw new Error('Fixed campaign differs; review before regenerating with --write');
console.log(JSON.stringify({version:1,levels:selected.length,chapters:chapters.length,poolStats,minimumMoves:selected.map(p=>p.solution.length)},null,2));
