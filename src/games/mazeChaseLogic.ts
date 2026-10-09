// SPDX-License-Identifier: GPL-3.0-only
export type MazeChaseLevel = {title:string;lesson:string;rows:string[];patrols:number[][]};
export const mazeChaseLevels:MazeChaseLevel[] = [
 {title:"池边绕行",lesson:"观察守卫下一步的空心影子，先走外圈再过桥。",rows:["#########","#S..*..E#","#.#.#.#.#","#*.....*#","#.#.#.#.#","#...*...#","#########"],patrols:[[30,31,32,31]]},
 {title:"两条长廊",lesson:"短路经过巡逻线；可以在岔路等待一个回合。",rows:["#########","#S.*#..E#","#.#.#.#.#","#.......#","#.#.#.#.#","#*..#*.*#","#########"],patrols:[[29,30,31,32,33,32,31,30]]},
 {title:"回字花圃",lesson:"长环和内侧捷径相连，不必追着守卫走。",rows:["#########","#S..*..E#","#.#####.#","#.*...*.#","#.#.#.#.#","#*..*...#","#########"],patrols:[[28,29,30,31,32,33,34,33,32,31,30,29]]},
 {title:"中央十字",lesson:"两位守卫轮流经过中路，等一等也会改变他们的位置。",rows:["#########","#S.*#*.E#","#.#.#.#.#","#*.....*#","#.#.#.#.#","#..*#*..#","#########"],patrols:[[29,30,31,30],[33,34,43,34]]},
 {title:"花篱口袋",lesson:"进入支路之前，留好回到主路的时机。",rows:["###########","#S.*#*...E#","#.#.#.###.#","#.#...*...#","#.###.#.#.#","#*....#*.*#","###########"],patrols:[[38,39,40,41,40,39],[57,58,59,60,59,58]]},
 {title:"双桥回环",lesson:"两座桥连接上下环路；记住巡逻总会向前一步。",rows:["###########","#S.*...*E.#","#.#.###.#.#","#*..#*....#","#.#.#.#.#.#","#...*...*.#","###########"],patrols:[[14,15,16,17,18,17,16,15],[60,61,62,63,64,63,62,61]]},
 {title:"错峰采星",lesson:"在不同周期的巡逻间找空档，不能迎面交换位置。",rows:["###########","#S..*#*..E#","#.##.#.##.#","#*.......*#","#.#.#.#.#.#","#..*...*..#","###########"],patrols:[[36,37,38,39,38,37],[59,60,61,62,63,62,61,60]]},
 {title:"星光大巡游",lesson:"绕过两片花篱，收齐七颗星豆后回到右上出口。",rows:["###########","#S.*...*.E#","#.#.###.#.#","#*..*#...*#","#.#..#.#..#","#..*...*..#","###########"],patrols:[[14,15,16,17,18,17,16,15],[57,58,59,60,61,60,59,58]]},
];
export const mazeMoves=[{name:"向上",key:"ArrowUp",dx:0,dy:-1,icon:"↑"},{name:"向右",key:"ArrowRight",dx:1,dy:0,icon:"→"},{name:"向下",key:"ArrowDown",dx:0,dy:1,icon:"↓"},{name:"向左",key:"ArrowLeft",dx:-1,dy:0,icon:"←"},{name:"等待",key:" ",dx:0,dy:0,icon:"·"}];
export type MazeChaseState={cell:number;mask:number;turn:number;caught:boolean};
export function mazeWorld(level:MazeChaseLevel){const cells=level.rows.join("").split("");return {cells,width:level.rows[0].length,start:cells.indexOf("S"),exit:cells.indexOf("E"),pellets:cells.flatMap((c,i)=>c==="*"?[i]:[])};}
export function initialMazeChase(level:MazeChaseLevel):MazeChaseState{return {cell:mazeWorld(level).start,mask:0,turn:0,caught:false};}
export function mazeChaseWon(level:MazeChaseLevel,state:MazeChaseState){const w=mazeWorld(level);return !state.caught&&state.cell===w.exit&&state.mask===(1<<w.pellets.length)-1;}
export function moveMazeChase(level:MazeChaseLevel,state:MazeChaseState,move:number):MazeChaseState|null{
 if(state.caught||mazeChaseWon(level,state))return null;const w=mazeWorld(level),d=mazeMoves[move];const cell=state.cell+d.dx+d.dy*w.width;if(w.cells[cell]===undefined||w.cells[cell]==="#"||Math.abs(cell%w.width-state.cell%w.width)>1)return null;
 const caught=level.patrols.some(p=>{const a=p[state.turn%p.length],b=p[(state.turn+1)%p.length];return cell===b||(cell===a&&state.cell===b);});const pellet=w.pellets.indexOf(cell);return {cell,mask:pellet<0?state.mask:state.mask|1<<pellet,turn:state.turn+1,caught};
}
export function mazeChaseHint(level:MazeChaseLevel,state:MazeChaseState):{move:number|null;text:string}{
 if(state.caught)return {move:null,text:"被守卫碰到了，请重来。"};if(mazeChaseWon(level,state))return {move:null,text:"已经收齐星豆并到达出口。"};
 const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a;const period=level.patrols.reduce((a,p)=>a*p.length/gcd(a,p.length),1);const queue:{s:MazeChaseState;first:number;depth:number}[]=[{s:state,first:-1,depth:0}],seen=new Set([`${state.cell}:${state.mask}:${state.turn%period}`]);
 for(let head=0;head<queue.length&&head<70000;head++){const node=queue[head];for(let m=0;m<5;m++){const next=moveMazeChase(level,node.s,m);if(!next||next.caught)continue;const first=node.first<0?m:node.first;if(mazeChaseWon(level,next))return {move:first,text:`下一步${mazeMoves[first].name}。从当前局面找到一条 ${node.depth+1} 回合的安全路线；没有自动移动。`};const key=`${next.cell}:${next.mask}:${next.turn%period}`;if(!seen.has(key)){seen.add(key);queue.push({s:next,first,depth:node.depth+1});}}}
 const safe=mazeMoves.findIndex((_,m)=>{const n=moveMazeChase(level,state,m);return !!n&&!n.caught;});return {move:safe<0?null:safe,text:safe<0?"下一步已无安全位置，请重来。":`有界搜索尚未找到完整路线。${mazeMoves[safe].name}这一步安全，但不保证后面能通关。`};
}
