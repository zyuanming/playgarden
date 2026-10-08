// Original deterministic composition. Runtime answers are never bundled.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {apply,start,stage,moves,captures,distance,outcome,counts} from '../../src/games/ataxxLogic.ts';
let seed=951008;
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function canonical(l){const n=l.size,all=[];for(let t=0;t<8;t++){const b=[];for(let y=0;y<n;y++)for(let x=0;x<n;x++){let a=x,c=y;if(t&4)a=n-1-a;for(let r=0;r<(t&3);r++)[a,c]=[n-1-c,a];b[c*n+a]=l.board[y*n+x];}all.push(b.join(','));}return `${n}:${all.sort()[0]}`;}
function solve(l,p=start(l),h=[],cap=90000){
 let nodes=0;const memo=new Map();
 function f(p,h){if(++nodes>cap)throw Error('budget');const s=stage(l,h,p);if(s!=='playing')return s==='success';
  const key=p.board.join(',')+':'+p.turn+':'+p.quiet+':'+h.length;if(memo.has(key))return memo.get(key);
  const want=p.turn===1;for(const m of moves(p)){const result=f(apply(p,m),[...h,m]);if(result===want){memo.set(key,want);return want;}}memo.set(key,!want);return !want;
 }return {won:f(p,h),nodes};
}
function winning(l){const p=start(l);return moves(p).filter(m=>solve(l,apply(p,m),[m]).won);}
function path(l){let p=start(l),h=[];while(stage(l,h,p)==='playing'){
 const options=moves(p);let pick=options[0];
 if(p.turn===1)pick=options.find(m=>solve(l,apply(p,m),[...h,m]).won)??pick;
 else {const lose=options.find(m=>!solve(l,apply(p,m),[...h,m]).won);pick=lose??options.sort((a,b)=>counts(apply(p,a))[0]-counts(apply(p,b))[0])[0];}
 p=apply(p,pick);h.push(pick);
 }if(stage(l,h,p)!=='success')throw Error('bad proof');return h;}
const levels=[],seen=new Set();
function add(l){const key=canonical(l);if(seen.has(key))return false;const ws=winning(l);if(!ws.length)throw Error('unsolved');seen.add(key);const id=`ataxx-${String(levels.length+1).padStart(2,'0')}`;levels.push({...l,id,proof:{winningMoves:ws,line:path(l),canonicalSha256:createHash('sha256').update(key).digest('hex')}});console.log(id,l.title,'answers',ws.length);return true;}
function board(n,greens,plums,gaps=[]){const b=Array(n*n).fill(0);for(const i of greens)b[i]=1;for(const i of plums)b[i]=2;for(const i of gaps)b[i]=-1;return b;}
const tutorials=[
 [3,[0],[4,8],[],{kind:'move',mode:'clone',captures:1},'留下一枚','先点绿子，再点相邻空格。复制会留下原位的绿子；落点周围的紫子也变绿。'],
 [4,[0],[6,15],[1,4,5],{kind:'move',mode:'jump',captures:1},'越过小石桥','跳到横、竖或斜向距离两格的空地。可以跨过石头；原位会空出来。'],
 [4,[0],[2,8,10,15],[],{kind:'move',mode:'clone',captures:3},'斜角也算邻居','转化影响落点周围的八个格，包括四个斜角。找能同时碰到三枚紫子的落点。'],
 [4,[0],[6,7,11,15],[],{kind:'move',mode:'jump',captures:4},'一跃四邻','距离按横、竖位移的较大值算；两格远的斜跳也合法。选落点时看看完整的八邻域。'],
 [4,[0,3],[5,6,9,10,15],[8],{kind:'move',captures:3},'先看落点','这次复制或跳跃都可以。先数落点周围的紫子，再找能到达它的绿子。'],
 [5,[0],[7,11,12,13,17],[6],{kind:'move',mode:'jump',captures:3},'隔岸相逢','石头只挡落脚，不挡跨越。预览显示将转化的紫子，确认后才真正移动。'],
];
function candidate(size,density,gapRate){return Array.from({length:size*size},()=>{const r=rand();return r<gapRate?-1:r<density?(rand()<.5?1:2):0;});}
if(!process.argv.includes('--check')){
 for(const [size,g,p,z,goal,title,tip] of tutorials){const l={size,board:board(size,g,p,z),goal,title,tip,chapter:0};if(!winning(l).length){const max=Math.max(...moves(start(l)).map(m=>captures(start(l),m).length));l.goal.captures=max;}add(l);}
 for(let ch=1;ch<5;ch++){
  let tries=0;
  while(levels.length<(ch+1)*6){if(++tries>200000)throw Error('cannot compose chapter '+ch);
   const size=ch===1?(levels.length%2?5:4):ch===2?4:levels.length%3===0?3:4;
   const b=candidate(size,ch===1?.63:ch===2?.86:.94,ch===1?.08:ch===2?.09:.16);
   const p={size,board:b,turn:1,quiet:0};if(outcome(p)!==null)continue;
   const ms=moves(p);if(ms.length<3||ms.length>26||!moves({...p,turn:2}).length||counts(p).some(c=>c<2))continue;
   let l={size,board:b,chapter:ch,title:'',tip:'',goal:null};
   try{
    if(ch===1){const cap=Math.max(...ms.map(m=>captures(p,m).length));if(cap<3||cap>6||ms.filter(m=>captures(p,m).length===cap).length>3)continue;l.goal={kind:'move',captures:cap};l.title=['花心涟漪','拐角汇合','两岸选择','石间穿行','外沿包围','整圈转绿'][levels.length-6];l.tip='同一个落点，复制和跳跃可能有不同代价。先选绿子，再点空地预览，最后确认。';}
    else if(ch===2){if(ms.some(m=>outcome(apply(p,m))===1))continue;const scores=ms.map(m=>{const q=apply(p,m);const value=z=>outcome(z)===1?100:outcome(z)!==null?-100:counts(z)[0];if(outcome(q)!==null)return value(q);return Math.min(...moves(q).map(r=>value(apply(q,r))));});const best=Math.max(...scores);if(best<3||best>=100||best===Math.min(...scores)||scores.filter(s=>s===best).length>4)continue;
     const gain=ms.map(m=>counts(apply(p,m))[0]);const maxGain=Math.max(...gain);if(levels.length<15&&!scores.some((s,i)=>s===best&&gain[i]<maxGain))continue;
     l.goal={kind:'hold',target:best};l.title=['别急着吃','留住退路','边角守护','诱饵花丛','两处牵制','稳住阵地'][levels.length-12];l.tip='紫方会选让你剩下绿子最少的一手。眼前吃得最多，未必回击后留下最多。';}
    else {const turns=ch===3?2:3;l.goal={kind:'win',turns};l.title=(ch===3?['收拢包围','切断回路','补上空隙','两步合围','转角逆转','临门一跃']:['缓一手','跨区援手','双翼推进','连环转化','以退为进','满园生长'])[levels.length-(ch===3?18:24)];l.tip='这是一盘可对弈的残局。要考虑所有紫方回击；不能只靠眼前的子数领先。';
     if(solve({...l,goal:{kind:'win',turns:turns-1}}).won||!solve(l).won)continue;
     const ws=winning(l);if(ws.length===ms.length||ws.length>4)continue;
    }
    if(!seen.has(canonical(l)))add(l);
   }catch(e){if(e.message!=='budget')throw e;}
  }
  console.log('chapter',ch,'candidates',tries);
 }
 mkdirSync('docs/ataxx',{recursive:true});writeFileSync('docs/ataxx/campaign.json',JSON.stringify({seed:951008,origin:'30 original Playgarden lessons; no upstream levels',levels},null,2)+'\n');
 writeFileSync('src/games/ataxxLevels.ts',"import type {Lesson} from './ataxxLogic';\nexport const ataxxLevels:Lesson[] = "+JSON.stringify(levels.map(({proof,...l})=>l),null,2)+';\n');
}else{
 const data=JSON.parse(readFileSync('docs/ataxx/campaign.json','utf8'));if(data.levels.length!==30)throw Error('count');const keys=new Set();for(const l of data.levels){const k=canonical(l);if(keys.has(k))throw Error('D4 duplicate');keys.add(k);if(!solve(l).won)throw Error('unsolved '+l.id);let p=start(l);const h=[];for(const m of l.proof.line){p=apply(p,m);h.push(m);}if(stage(l,h,p)!=='success')throw Error('bad line');}
 console.log('30 original lessons, D4 distinct, author proofs replayed. Independent verifier remains separate.');
}
