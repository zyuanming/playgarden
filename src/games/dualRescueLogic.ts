// SPDX-License-Identifier: GPL-3.0-only
export type DresActor=0|1;
export type DresDirection='up'|'down'|'left'|'right';
export type DresAction={actor:DresActor;dir:DresDirection};
export type DresState={blue:number;amber:number;latches:number;moves:number;won:boolean};
export type DresLevel={title:string;rows:string[];tip:string};
export const dualRescueLevels:DresLevel[]=[
 {title:'隔岸互相开门',rows:['#######','#s~bAX#','#######','#t^aBY#','#######'],tip:'蓝伴能涉水并启动蓝开关；橙伴能走热地并启动橙开关。先替彼此开门。'},
 {title:'带着钥光折返',rows:['#########','#s.~..b##','#A#####.#','#X......#','#####.#.#','#t^a.B.Y#','#########'],tip:'蓝开关在远处。拿到钥光后，沿原路回来找蓝出口。'},
 {title:'共享的十字桥',rows:['#########','#s~b#..X#','#.#.#A###','#.......#','###B#.#.#','#Y..#a^t#','#########'],tip:'两人要穿过同一条桥，不能占同一格。给伙伴让出转弯的位置。'},
 {title:'温泉两侧的路',rows:['#########','#s..#..X#','#~#.#A#.#','#~b...a^#','###B###^#','#Y..#..t#','#########'],tip:'水路和热地分别通往两枚开关。先开门，再从不同方向回到出口。'},
 {title:'为你守住踏板',rows:['#########','#s~p.AX##','#########','#t^C.aY##','#########'],tip:'蓝伴站在蓝踏板 p 上，橙伴才能穿过 C 门。等橙伴启动 a，再离开踏板。'},
 {title:'回报一扇门',rows:['#########','#X.D.~s##','#b#######','#.......#','###B#q^t#','#Y..#...#','#########'],tip:'橙伴先守 q 踏板，让蓝伴穿过 D 门取 b。蓝开关会让 B 永久打开。'},
 {title:'双向的接力',rows:['#########','#s~pDbAX#','###.#####','#.......#','#####.###','#YBaCq^t#','#########'],tip:'先让蓝伴经过 D 到 b，把 C 永久打开；橙伴才能离开踏板去 a，回报 A 门。'},
 {title:'花谷联合救援',rows:['#########','#s~pD.b##','###.##A##','#...#..X#','#.#.#.#.#','#...#...#','###.##.##','#YBaCq^t#','#########'],tip:'左右花谷有回环，却不能绕过接力门。两枚开关点亮后，两位伙伴都要亲自回家。'},
];
export function dresTiles(l:DresLevel){return l.rows.join('');}
export function dresInitial(l:DresLevel):DresState{const tiles=dresTiles(l);return{blue:tiles.indexOf('s'),amber:tiles.indexOf('t'),latches:0,moves:0,won:false};}
export function dresGate(l:DresLevel,s:DresState,t:string){const tiles=dresTiles(l);return t==='A'?!!(s.latches&2):t==='B'?!!(s.latches&1):t==='C'?!!(s.latches&1)||tiles[s.blue]==='p':t==='D'?!!(s.latches&2)||tiles[s.amber]==='q':true;}
export const dresDirs:DresDirection[]=['up','down','left','right'];
export const dresNames:Record<DresDirection,string>={up:'上',down:'下',left:'左',right:'右'};
export function dresStep(l:DresLevel,s:DresState,a:DresAction):DresState|null{if(s.won)return null;const width=l.rows[0].length,tiles=dresTiles(l),from=a.actor===0?s.blue:s.amber,delta={up:-width,down:width,left:-1,right:1}[a.dir],to=from+delta;if(to<0||to>=tiles.length||((a.dir==='left'||a.dir==='right')&&Math.floor(to/width)!==Math.floor(from/width)))return null;const t=tiles[to];if(t==='#'||to===(a.actor===0?s.amber:s.blue)||(t==='~'&&a.actor!==0)||(t==='^'&&a.actor!==1)||!dresGate(l,s,t))return null;const n={...s,blue:a.actor===0?to:s.blue,amber:a.actor===1?to:s.amber,latches:s.latches|((a.actor===0&&t==='b')?1:(a.actor===1&&t==='a')?2:0),moves:s.moves+1};n.won=tiles[n.blue]==='X'&&tiles[n.amber]==='Y';return n;}
/** Current-position BFS, capped at 20,000 states. Returns a route or an honest bounded miss. */
export function dresPlan(l:DresLevel,start:DresState,limit=20000):DresAction[]|null{if(start.won)return[];const key=(s:DresState)=>`${s.blue}:${s.amber}:${s.latches}`,nodes:{s:DresState;parent:number;a:DresAction|null}[]=[{s:start,parent:-1,a:null}],seen=new Set([key(start)]);for(let i=0;i<nodes.length&&i<limit;i++)for(const actor of [0,1] as const)for(const dir of dresDirs){const a={actor,dir},s=dresStep(l,nodes[i].s,a);if(!s||seen.has(key(s)))continue;seen.add(key(s));nodes.push({s,parent:i,a});if(s.won){const path:DresAction[]=[];let p=nodes.length-1;while(nodes[p].parent>=0){path.unshift(nodes[p].a!);p=nodes[p].parent;}return path;}}return null;}
