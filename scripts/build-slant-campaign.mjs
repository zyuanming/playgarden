import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { generatePuzzle } from './slant/adapted-generator.mjs';
import { solveSlant, slantWon } from '../src/games/slantLogic.ts';
const SOURCE = 'a7c7826bce5cbb9b9c337c11b9b7f8b278e76fba';
export function canonical(p) {
 let {width:w,height:h,clues:a}=p; const forms=[];
 for(let r=0;r<4;r++) {
  forms.push(`${w}x${h}:${a.join(',')}`);
  const mirror=[]; for(let y=0;y<=h;y++) for(let x=0;x<=w;x++) mirror.push(a[y*(w+1)+w-x]);
  forms.push(`${w}x${h}:${mirror.join(',')}`);
  const rotated=Array(a.length); for(let y=0;y<=h;y++) for(let x=0;x<=w;x++) rotated[x*(h+1)+h-y]=a[y*(w+1)+x];
  [w,h]=[h,w]; a=rotated;
 }
 return forms.sort()[0];
}
const hash=p=>createHash('sha256').update(canonical(p)).digest('hex');
const chapters=[
 {title:'数字的入口',lesson:'从边角数字开始，数清每个顶点伸出的线。',width:5,height:5,count:50,advanced:false},
 {title:'森林的连锁',lesson:'顺着已填斜线传播约束，留意一笔闭环。',width:5,height:5,count:50,advanced:false},
 {title:'沿路推演',lesson:'在更大的森林中交替使用数字与闭环排除。',width:8,height:8,count:50,advanced:false},
 {title:'反向求证',lesson:'直接传播会停住时，比较两个方向的后果，再排除矛盾。',width:5,height:5,count:50,advanced:true},
 {title:'交织的约束',lesson:'跨越稀疏线索，追踪长路径与假设之间的联系。',width:8,height:8,count:50,advanced:true},
 {title:'深林远行',lesson:'分区推进，再检查连接处。保持每段路径都没有闭环。',width:12,height:10,count:50,advanced:true},
];
const pools=[[5,5,false,500],[8,8,false,250],[5,5,true,250],[8,8,true,250],[12,10,true,250]];
const seen=new Set(), grouped=[]; const stats=[];
for(const [w,h,advanced,count] of pools){
 const selected=[], record={width:w,height:h,advanced,candidates:count,unique:0,duplicates:0,rejected:0};
 for(let i=0;i<count;i++) {
  const seed=`playgarden/slant/v1/${w}x${h}/${advanced?'search':'logic'}/${String(i+1).padStart(6,'0')}`;
  const p=generatePuzzle(w,h,seed,advanced), result=solveSlant(p,undefined,25000);
  const logic=solveSlant(p,undefined,1), normalizedPuzzleHash=hash(p);
  if(result.status!=='unique'||!slantWon(p,p.solution)||(advanced&&logic.status==='unique')) {record.rejected++;continue;}
  if(seen.has(normalizedPuzzleHash)){record.duplicates++;continue;} seen.add(normalizedPuzzleHash);
  const score=advanced?result.stats.branches*100+result.stats.maxDepth*10+result.stats.rounds:result.stats.rounds*10+result.stats.cycleSteps;
  selected.push({...p,seed,normalizedPuzzleHash,sourceCommit:SOURCE,generatorVersion:'playgarden-slant-v1',params:`${w}x${h}-${advanced?'search':'logic'}`,solverBudget:25000,difficultyEvidence:{...result.stats,logicOnlySolved:logic.status==='unique',score},contentVersion:1}); record.unique++;
  if((i+1)%25===0) console.log(`${w}x${h} ${advanced?'search':'logic'} ${i+1}/${count}: ${selected.length} accepted`);
 }
 selected.sort((a,b)=>a.difficultyEvidence.score-b.difficultyEvidence.score||a.seed.localeCompare(b.seed));
 grouped.push(selected);stats.push(record);console.log('pool',record);
}
const certificates=[];
for(let c=0;c<chapters.length;c++){
 const chapter=chapters[c], pool=grouped[c<2?0:c-1];
 const take=chapter.count;
 // First two chapters are separated by measured propagation difficulty.
 const offset=c===1?Math.floor(pool.length/2):0, available=c<2?Math.floor(pool.length/2):pool.length;
 if(available<take)throw new Error(`Insufficient verified candidates chapter ${c+1}: ${available}`);
 for(let i=0;i<take;i++){
  const pick=pool[offset+Math.floor(i*(available-1)/(take-1))];
  certificates.push({...pick,id:`slant-v1-${String(certificates.length+1).padStart(3,'0')}`,chapter:c,tutorialGoal:chapter.lesson});
 }
}
if(new Set(certificates.map(p=>p.normalizedPuzzleHash)).size!==certificates.length)throw new Error('Duplicate selected puzzle');
mkdirSync('tests/fixtures',{recursive:true});
writeFileSync('tests/fixtures/slantCertificates.json',JSON.stringify(certificates));
const runtime=certificates.map(({solution,...p})=>p);
writeFileSync('src/games/slantLevels.ts',`// Generated deterministically by scripts/build-slant-campaign.mjs. Do not reorder.\nimport type { SlantPuzzle, SlantStats } from './slantLogic';\nexport type SlantLevel = SlantPuzzle & {id:string;chapter:number;sourceCommit:string;generatorVersion:string;params:string;seed:string;rawDescription:string;normalizedPuzzleHash:string;solverBudget:number;difficultyEvidence:SlantStats & {logicOnlySolved:boolean;score:number};tutorialGoal:string;contentVersion:number};\nexport const slantLevels: SlantLevel[] = ${JSON.stringify(runtime)};\n`);
writeFileSync('src/games/slantCampaign.ts',`// Lightweight catalog/chapter metadata; no solver or answer imports.\nexport const SLANT_LEVEL_COUNT = ${certificates.length};\nexport const slantChapters = ${JSON.stringify(chapters.map((c,i)=>({...c,start:i*50})))};\n`);
writeFileSync('docs/slant-generation-report.json',JSON.stringify({sourceCommit:SOURCE,generatorVersion:'playgarden-slant-v1',node:process.version,candidatePools:stats,count:certificates.length,d4Distinct:certificates.length,independentlyVerified:false,chapters:chapters.map((c,i)=>({title:c.title,firstScore:certificates[i*50].difficultyEvidence.score,lastScore:certificates[i*50+49].difficultyEvidence.score}))},null,2));
console.log('Generated',certificates.length,'distinct runtime/certificate records. Independent oracle verification remains required.');
