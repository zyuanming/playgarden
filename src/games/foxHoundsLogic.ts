// SPDX-License-Identifier: GPL-3.0-only
// Independently written asymmetric diagonal-movement game and local AI.
export type FoxPosition={fox:number;hounds:number[]};
export type HoundMove={from:number;to:number};
export const foxRow=(cell:number)=>Math.floor(cell/8),foxCol=(cell:number)=>cell%8;
export function foxNeighbours(cell:number,forward=false){const x=foxCol(cell),y=foxRow(cell);return (forward?[-1]:[-1,1]).flatMap(dy=>[-1,1].flatMap(dx=>{const nx=x+dx,ny=y+dy;return nx>=0&&nx<8&&ny>=0&&ny<8?[ny*8+nx]:[];}));}
export const foxMoves=(p:FoxPosition)=>foxNeighbours(p.fox).filter(to=>!p.hounds.includes(to));
export const houndMoves=(p:FoxPosition):HoundMove[]=>p.hounds.flatMap(from=>foxNeighbours(from,true).filter(to=>to!==p.fox&&!p.hounds.includes(to)).map(to=>({from,to})));
export const foxMove=(p:FoxPosition,to:number):FoxPosition=>foxMoves(p).includes(to)?{...p,fox:to}:p;
export const houndMove=(p:FoxPosition,m:HoundMove):FoxPosition=>houndMoves(p).some(v=>v.from===m.from&&v.to===m.to)?{...p,hounds:p.hounds.map(c=>c===m.from?m.to:c).sort((a,b)=>a-b)}:p;
export function foxResult(p:FoxPosition){return foxRow(p.fox)===7?'won':foxMoves(p).length===0?'lost':'playing';}
export function foxEvaluate(p:FoxPosition){const passed=p.hounds.filter(h=>foxRow(h)<foxRow(p.fox)).length;return foxRow(p.fox)*26+passed*33+foxMoves(p).length*13-p.hounds.filter(h=>Math.abs(foxRow(h)-foxRow(p.fox))<=1&&Math.abs(foxCol(h)-foxCol(p.fox))<=2).length*8;}
export function foxSearch(p:FoxPosition,turn:'fox'|'hound',depth=6):{fox:number|null;hound:HoundMove|null;value:number}{const memo=new Map<string,number>();function solve(q:FoxPosition,t:boolean,d:number):number{const end=foxResult(q);if(end==='won')return 10000+d;if(end==='lost')return -10000-d;if(d===0)return foxEvaluate(q);const key=`${q.fox}|${q.hounds.join(',')}|${t}|${d}`,known=memo.get(key);if(known!==undefined)return known;let result:number;if(t){result=-Infinity;for(const to of foxMoves(q))result=Math.max(result,solve(foxMove(q,to),false,d-1));}else{const moves=houndMoves(q);result=moves.length?Infinity:solve(q,true,d-1);for(const move of moves)result=Math.min(result,solve(houndMove(q,move),true,d-1));}memo.set(key,result);return result;}let best=turn==='fox'?-Infinity:Infinity,fox:number|null=null,hound:HoundMove|null=null;if(turn==='fox'){for(const to of foxMoves(p)){const value=solve(foxMove(p,to),false,depth-1);if(value>best){best=value;fox=to;}}}else{for(const move of houndMoves(p)){const value=solve(houndMove(p,move),true,depth-1);if(value<best){best=value;hound=move;}}if(!hound)best=solve(p,true,depth-1);}return{fox,hound,value:best};}
export type FoxLesson={title:string;position:FoxPosition;tip:string};
export const foxHoundsLevels:FoxLesson[]=[
 {title:'最后一条小径',position:{fox:49,hounds:[10,12,17,21]},tip:'狐狸每步斜走一格。到达最下方的橙色边线，就逃出森林。'},
 {title:'从空隙穿过',position:{fox:42,hounds:[24,28,35,39]},tip:'猎犬只能向上斜走。留在它们身后的空地，很难再被封住。'},
 {title:'绕过最后一只',position:{fox:37,hounds:[17,19,40,46]},tip:'没有吃子，也不能跳跃。寻找两只猎犬之间的斜向通道。'},
 {title:'错开的队形',position:{fox:28,hounds:[24,33,39,51]},tip:'猎犬每轮只移动一只。注意队伍移动后新露出的空隙。'},
 {title:'右岸的小路',position:{fox:23,hounds:[26,28,33,37]},tip:'边线会减少选择。适时回到中间，保持狐狸的活动空间。'},
 {title:'先退一步',position:{fox:26,hounds:[33,35,53,55]},tip:'前方被堵住时，可以斜向后退。狐狸能后退，猎犬不能。'},
 {title:'穿越中线',position:{fox:19,hounds:[24,28,37,39]},tip:'先观察猎犬能够封住哪里，再选择穿线的一侧。'},
 {title:'林间回旋',position:{fox:12,hounds:[17,21,35,39]},tip:'综合使用前进、后退和侧翼通道，真正走到森林出口。'},
];
