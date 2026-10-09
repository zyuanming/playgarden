// SPDX-License-Identifier: GPL-3.0-only
export type AmznState={you:number;bot:number;blocked:number[];turns:number;result:'playing'|'won'|'lost'};
export type AmznTurn={to:number;arrow:number};
const lesson=(title:string,you:number,bot:number,open:number[],tip:string)=>({title,you,bot,open,tip});
export const amazonGardenLevels=[
 lesson('留下自己的花圃',0,23,[0,1,5,6,23,24],'先移动，再射出一支永久封格的箭。比对手多留一个落脚点。'),
 lesson('越过长长的小径',0,23,[0,1,2,5,6,10,11,23,24],'棋子和箭都能沿八个方向走任意远，但不能穿过障碍或棋子。'),
 lesson('回身的一箭',0,23,[0,1,5,23,24],'刚离开的格子已经空出来了，也可以成为箭的目标。'),
 lesson('关上连接的门',6,24,[0,1,5,6,10,11,12,18,19,23,24],'中间的斜向细口连接两片花圃。封住它之前先选好自己站哪边。'),
 lesson('曲折的余地',1,24,[0,1,2,6,7,11,12,18,19,23,24],'狭窄连接处很容易把自己的余地剪断。先看下一次落脚点。'),
 lesson('剪去岔路',5,24,[0,1,2,5,6,7,10,12,18,19,23,24],'每次射箭都会减少一个空格；长射程与下一回合的空间一样重要。'),
 lesson('保留回转空间',10,24,[0,1,5,6,7,10,11,12,16,18,19,23,24],'不要只看这一手能走多远。保留连通的区域，让下一手还有选择。'),
 lesson('箭羽分园',6,24,[0,1,2,5,6,7,10,11,12,18,19,23,24],'尝试先封住两片区域的斜向连接，再利用更大的花园走到最后。'),
];
export function amznInitial(i:number):AmznState{const l=amazonGardenLevels[i]??amazonGardenLevels[0];return{you:l.you,bot:l.bot,blocked:Array.from({length:25},(_,n)=>n).filter(n=>!l.open.includes(n)),turns:0,result:'playing'};}
export function amznRays(from:number,occupied:number[]){const out:number[]=[];for(const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])for(let n=1;n<5;n++){const r=Math.floor(from/5)+dr*n,c=from%5+dc*n,p=r*5+c;if(r<0||r>=5||c<0||c>=5||occupied.includes(p))break;out.push(p);}return out;}
export function amznMoves(s:AmznState,side:0|1){return amznRays(side===0?s.you:s.bot,[...s.blocked,side===0?s.bot:s.you]);}
export function amznArrows(s:AmznState,side:0|1,to:number){return amznRays(to,[...s.blocked,side===0?s.bot:s.you]);}
export function amznTurns(s:AmznState,side:0|1):AmznTurn[]{return amznMoves(s,side).flatMap(to=>amznArrows(s,side,to).map(arrow=>({to,arrow})));}
export function amznApply(s:AmznState,t:AmznTurn,side:0|1){return{...s,you:side===0?t.to:s.you,bot:side===1?t.to:s.bot,blocked:[...s.blocked,t.arrow]};}
function mobility(s:AmznState,side:0|1){const seen=new Set<number>(),q=[side===0?s.you:s.bot],occupied=[...s.blocked,side===0?s.bot:s.you];for(let n=0;n<q.length;n++)for(const p of amznRays(q[n],occupied))if(!seen.has(p)){seen.add(p);q.push(p);}seen.delete(side===0?s.you:s.bot);return seen.size;}
/** Bounded local evaluation: immediate immobility, reachable territory, then mobility. */
export function amznChoice(s:AmznState,side:0|1,fixedTo?:number):AmznTurn|null{const choices=amznTurns(s,side).filter(t=>fixedTo===undefined||t.to===fixedTo);let best:AmznTurn|null=null,value=-Infinity;for(const t of choices){const n=amznApply(s,t,side),other=side===0?1:0,score=amznMoves(n,other).length===0?10000:mobility(n,side)*10-mobility(n,other)*12+amznMoves(n,side).length;if(score>value){best=t;value=score;}}return best;}
export function amznRound(s:AmznState,t:AmznTurn):AmznState{let n={...amznApply(s,t,0),turns:s.turns+1};if(!amznMoves(n,1).length)return{...n,result:'won'};const bot=amznChoice(n,1)!;n=amznApply(n,bot,1);return{...n,result:amznMoves(n,0).length?'playing':'lost'};}
export function amznLabel(p:number){return `${Math.floor(p/5)+1}行${p%5+1}列`;}
