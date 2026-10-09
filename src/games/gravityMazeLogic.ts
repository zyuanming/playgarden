// SPDX-License-Identifier: GPL-3.0-only
export type GravityLevel={title:string;lesson:string;map:string[]};
export type GravityState={position:number;direction:number;keys:number;lost:boolean};
export const gravityMazeLevels:GravityLevel[]=[
 {title:"绕过锁门",lesson:"钥匙在上层。先绕一圈，门才会放你通过。",map:["#######","#..a###","#.#.###","#S..AE#","#######"]},
 {title:"弯弯上坡",lesson:"转动重力，沿折返通道把钥匙带到另一侧。",map:["#######","#..a..#","#.###.#","#...#.#","###.#A#","#S..#E#","#######"]},
 {title:"两翼钥匙",lesson:"左翼藏着第二把钥匙。右侧的高门需要它。",map:["#########","#b..#..E#","###.#B###","#...#...#","#.#####A#","#S.....a#","#########"]},
 {title:"低处的荆棘",lesson:"下层有危险支路，先想好落点再改变方向。",map:["#########","#..b#..E#","#.#.#.#.#","#.#...#.#","#.#####B#","#...a...#","###.###.#","###S##X.#","#########"]},
 {title:"三把小钥匙",lesson:"上层横门打开后，原来的停靠点也变了。考虑取钥匙的次序。",map:["#########","#c..C..E#","###.###B#","#a..#b..#","#.###.#.#","#...A...#","###.#####","###S#####","#########"]},
 {title:"双环回廊",lesson:"两条环路通向同一处。不要滑入右下角的荆棘。",map:["###########","#..a#...b.#","#.#.#.###.#","#.#...#...#","#.#####.#B#","#...A...#E#","###.###.###","###S#X..###","###########"]},
 {title:"门后的转角",lesson:"经过出口还不够。三把钥匙齐全，出口才会接住小球。",map:["###########","#..a#c...E#","#.#.#.###C#","#.#...#...#","#.#####A#B#","#...#b..#.#","###.#.###.#","###S#.....#","###########"]},
 {title:"长廊里的归途",lesson:"先探左侧，穿过上层，再从底部钥匙折向右边的出口。",map:["#############","#c..C...#..E#","###.###.#.#B#","#a..#.......#","#.###.#.#A#.#","#...A...#...#","###.#.#.###.#","###S#b..#...#","#############"]},
];
export const gravityNames=["上","右","下","左"];
export const gravityArrows=["↑","→","↓","←"];
export function gravityWorld(level:GravityLevel){const width=level.map[0].length,cells=level.map.join("").split("");let allKeys=0;for(const ch of cells)if(ch>="a"&&ch<="c")allKeys|=1<<(ch.charCodeAt(0)-97);return {width,cells,allKeys,exit:cells.indexOf("E")};}
export function initialGravity(level:GravityLevel):GravityState{return {position:gravityWorld(level).cells.indexOf("S"),direction:2,keys:0,lost:false};}
export function gravityWon(level:GravityLevel,state:GravityState){const w=gravityWorld(level);return !state.lost&&state.position===w.exit&&state.keys===w.allKeys;}
export function rotateGravity(level:GravityLevel,state:GravityState,turn:-1|1):GravityState{
 if(state.lost||gravityWon(level,state))return state;
 const world=gravityWorld(level),direction=(state.direction+turn+4)%4,delta=[-world.width,1,world.width,-1][direction];
 let position=state.position,keys=state.keys,lost=false;
 for(let steps=0;steps<world.cells.length;steps++){
  const next=position+delta,ch=world.cells[next];
  if(next<0||next>=world.cells.length||((direction===1||direction===3)&&Math.floor(next/world.width)!==Math.floor(position/world.width))||ch==="#"||ch>="A"&&ch<="C"&&!(keys&(1<<(ch.charCodeAt(0)-65))))break;
  position=next;if(ch>="a"&&ch<="c")keys|=1<<(ch.charCodeAt(0)-97);
  if(ch==="X"){lost=true;break;}if(ch==="E"&&keys===world.allKeys)break;
 }
 return {position,direction,keys,lost};
}
/** Bounded exact current-state search: at most cells × 4 × 8 stable states. */
export function gravityPlan(level:GravityLevel,start:GravityState,limit=6000):(-1|1)[]|null{
 if(start.lost)return null;if(gravityWon(level,start))return [];
 const key=(s:GravityState)=>`${s.position}/${s.direction}/${s.keys}`;
 const queue:{state:GravityState;parent:number;turn:-1|1}[]=[{state:start,parent:-1,turn:1}],seen=new Set([key(start)]);
 for(let head=0;head<queue.length&&head<limit;head++)for(const turn of [-1,1] as const){const state=rotateGravity(level,queue[head].state,turn);if(state.lost||seen.has(key(state)))continue;seen.add(key(state));const index=queue.length;queue.push({state,parent:head,turn});if(gravityWon(level,state)){const path:(-1|1)[]=[];for(let at=index;queue[at].parent>=0;at=queue[at].parent)path.push(queue[at].turn);return path.reverse();}}
 return null;
}
