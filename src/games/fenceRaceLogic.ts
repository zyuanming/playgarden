// SPDX-License-Identifier: GPL-3.0-only
/** Original five-by-five teaching variant. Walls block two edges, never cells. */
export type FraceWall={r:number;c:number;o:'h'|'v'};
export type FraceState={you:number;bot:number;walls:FraceWall[];stock:[number,number];turns:number;result:'playing'|'won'|'lost'};
export type FraceAction={kind:'move';to:number}|{kind:'wall';wall:FraceWall};
export const FRACE_SIZE=5;
const h=(r:number,c:number):FraceWall=>({r,c,o:'h'}),v=(r:number,c:number):FraceWall=>({r,c,o:'v'});
export const fenceRaceLevels=[
 {title:'先抵达另一岸',you:12,bot:0,stock:[0,0],walls:[],tip:'你向上、电脑向下。先走到对岸任意一格获胜。'},
 {title:'面对面的一跃',you:17,bot:12,stock:[0,0],walls:[],tip:'对手相邻且身后通畅时，可以直线跳过对手。'},
 {title:'墙后的侧步',you:12,bot:7,stock:[0,0],walls:[h(0,2)],tip:'对手身后被墙或边界挡住时，才可以绕到它两侧。'},
 {title:'留出一条路',you:17,bot:0,stock:[2,1],walls:[h(1,0)],tip:'墙阻挡相邻两条边；两位棋手都必须保留到终点的路线。'},
 {title:'走路还是筑墙',you:13,bot:1,stock:[1,2],walls:[h(0,0),v(2,1)],tip:'筑墙用掉整整一回合。增加对手的路程，也要算上自己的停步。'},
 {title:'绕过长围栏',you:16,bot:4,stock:[2,1],walls:[h(1,0),h(1,2),v(0,3)],tip:'两段围栏可接成长墙，但不能重叠或在中点交叉。'},
 {title:'交错的小径',you:18,bot:0,stock:[2,2],walls:[h(2,1),v(0,2),h(0,0)],tip:'先比较两人的剩余路程，再决定保留哪一面墙。'},
 {title:'最后的花园赛道',you:12,bot:0,stock:[2,2],walls:[h(0,0),v(0,2),h(3,3)],tip:'这是五乘五原创教学残局。看清墙端、跳跃与对手的下一步。'},
].map(x=>({...x,stock:x.stock as [number,number]}));
export function fraceInitial(index:number):FraceState{const l=fenceRaceLevels[index]??fenceRaceLevels[0];return{you:l.you,bot:l.bot,stock:[...l.stock],walls:l.walls.map(w=>({...w})),turns:0,result:'playing'};}
export function fraceEdge(a:number,b:number,walls:FraceWall[]){const ar=Math.floor(a/5),ac=a%5,br=Math.floor(b/5),bc=b%5;if(Math.abs(ar-br)+Math.abs(ac-bc)!==1)return false;return !walls.some(w=>w.o==='h'?ac===bc&&Math.min(ar,br)===w.r&&(ac===w.c||ac===w.c+1):ar===br&&Math.min(ac,bc)===w.c&&(ar===w.r||ar===w.r+1));}
export function fraceAdjacent(p:number,walls:FraceWall[]){return Array.from({length:25},(_,i)=>i).filter(i=>fraceEdge(p,i,walls));}
export function fraceDistance(start:number,goal:number,walls:FraceWall[]){const queue=[start],dist=new Map([[start,0]]);for(let i=0;i<queue.length;i++){const a=queue[i];if(Math.floor(a/5)===goal)return dist.get(a)!;for(const b of fraceAdjacent(a,walls))if(!dist.has(b)){dist.set(b,dist.get(a)!+1);queue.push(b);}}return 99;}
export function fraceMoves(s:FraceState,side:0|1){const p=side===0?s.you:s.bot,other=side===0?s.bot:s.you,result:number[]=[];for(const near of fraceAdjacent(p,s.walls)){if(near!==other){result.push(near);continue;}const pr=Math.floor(p/5),pc=p%5,nr=Math.floor(near/5),nc=near%5,rr=nr+(nr-pr),cc=nc+(nc-pc),behind=rr*5+cc;if(rr>=0&&rr<5&&cc>=0&&cc<5&&fraceEdge(near,behind,s.walls))result.push(behind);else for(const diagonal of fraceAdjacent(near,s.walls)){const dr=Math.floor(diagonal/5)-nr,dc=diagonal%5-nc;if(dr*(nr-pr)+dc*(nc-pc)===0)result.push(diagonal);}}return [...new Set(result)];}
export function fraceCanWall(s:FraceState,w:FraceWall,side:0|1){if(s.stock[side]<=0||w.r<0||w.r>3||w.c<0||w.c>3)return false;if(s.walls.some(a=>a.o===w.o?(w.o==='h'?a.r===w.r&&Math.abs(a.c-w.c)<2:a.c===w.c&&Math.abs(a.r-w.r)<2):a.r===w.r&&a.c===w.c))return false;const walls=[...s.walls,w];return fraceDistance(s.you,0,walls)<99&&fraceDistance(s.bot,4,walls)<99;}
export function fraceActions(s:FraceState,side:0|1):FraceAction[]{const actions:FraceAction[]=fraceMoves(s,side).map(to=>({kind:'move',to}));if(s.stock[side])for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(const o of ['h','v'] as const){const wall={r,c,o};if(fraceCanWall(s,wall,side))actions.push({kind:'wall',wall});}return actions;}
export function fraceApply(s:FraceState,a:FraceAction,side:0|1):FraceState{const next={...s,stock:[...s.stock] as [number,number],walls:[...s.walls]};if(a.kind==='move'){if(side===0)next.you=a.to;else next.bot=a.to;if(Math.floor(a.to/5)===(side===0?0:4))next.result=side===0?'won':'lost';}else{next.walls.push(a.wall);next.stock[side]--;}return next;}
const score=(s:FraceState)=>s.result==='won'?1000:s.result==='lost'?-1000:fraceDistance(s.bot,4,s.walls)-fraceDistance(s.you,0,s.walls);
/** Deterministic local opponent: score next distances, prefer movement on ties. */
export function fraceBot(s:FraceState){const actions=fraceActions(s,1);return actions.reduce((best,a)=>{const cost=(x:FraceAction)=>score(fraceApply(s,x,1))+(x.kind==='wall'?0.2:0);return cost(a)<cost(best)?a:best;},actions[0]);}
export function fraceRound(s:FraceState,a:FraceAction){let next=fraceApply(s,a,0);next.turns=s.turns+1;if(next.result==='playing')next=fraceApply(next,fraceBot(next),1);return next;}
/** One player action and one deterministic opponent reply, not a victory proof. */
export function fraceHint(s:FraceState):FraceAction|null{if(s.result!=='playing')return null;const actions=fraceActions(s,0);return actions.reduce((best,a)=>{const value=(x:FraceAction)=>score(fraceRound(s,x))-(x.kind==='wall'?0.1:0);return value(a)>value(best)?a:best;},actions[0]);}
export function fraceDescribe(a:FraceAction){return a.kind==='move'?`走到 ${Math.floor(a.to/5)+1} 行 ${a.to%5+1} 列`:`在 ${a.wall.r+1} 行 ${a.wall.c+1} 列的交点放${a.wall.o==='h'?'横':'竖'}墙`;}
