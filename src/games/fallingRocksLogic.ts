// SPDX-License-Identifier: GPL-3.0-only
export type MineLevel={title:string;lesson:string;map:string[]};
export type MineState={cells:string;player:number;gems:number;lost:boolean};
export type MineAction={kind:"walk"|"dig";direction:number}|{kind:"wait"};
export const fallingRocksLevels:MineLevel[]=[
 {title:"从旁边挖",lesson:"不要站到岩石下面。侧挖支撑土，让岩石落下，再走它原来的位置。",map:["#######","####*E#","#..o..#","#S.:###","#######"]},
 {title:"深井里的回声",lesson:"每个有效回合，岩石只落一格。它会继续向井底下落。",map:["#######","#*....#","###o#.#","#..:..#","#S#.#E#","#...###","#######"]},
 {title:"两道石门",lesson:"两块岩石各有自己的支撑土。先采左边的宝石，再去右侧。",map:["#########","#*..#..E#","###.#.###","#..o.o..#","#S.:.:..#","#########"]},
 {title:"叠石高台",lesson:"下方石头先落，上方石头跟着落一格。观察整列支撑的变化。",map:["#########","###o#*E##","#..o...##","#..:...##","#S...####","#########"]},
 {title:"上下两层",lesson:"两颗宝石分布在不同高度。选择顺序，记住返回出口的路。",map:["#########","#..o...##","#..:.*E##","#S.######","#..o...##","#..:.*###","#########"]},
 {title:"井口绕行",lesson:"深井与右侧通道相连。采齐上、下两颗宝石才算完成。",map:["#########","#...*E###","#.#.#####","#..o...##","#S.:.#*##","###..#.##","###....##","#########"]},
 {title:"矿脉三岔口",lesson:"宝石藏在上方和小凹槽里，出口还在第二道岩石后面。",map:["###########","#*..#...E##","###.####.##","#..o...o.##","#S.:...:.##","#####*#####","###########"]},
 {title:"星光矿洞",lesson:"先打开左侧，再采凹槽里的宝石。最后从叠石上方走向星光出口。",map:["#############","#*..####*..E#","###.###.o.###","#..o....o...#","#S.:....:...#","#####*#######","#############"]},
];
export const mineDirectionNames=["上","右","下","左"],mineArrows=["↑","→","↓","←"];
export function initialMine(level:MineLevel):MineState{const map=level.map.join("");return {cells:map.replace("S","."),player:map.indexOf("S"),gems:0,lost:false};}
export function mineTotal(level:MineLevel){return [...level.map.join("")].filter(c=>c==="*").length;}
export function mineWon(level:MineLevel,state:MineState){return !state.lost&&state.gems===mineTotal(level)&&state.cells[state.player]==="E";}
export function mineStep(level:MineLevel,state:MineState,action:MineAction):MineState{
 if(state.lost||mineWon(level,state))return state;
 const width=level.map[0].length,cells=state.cells.split("");let player=state.player,gems=state.gems,lost=false;
 if(action.kind!=="wait"){
  const direction=action.direction;if(!Number.isInteger(direction)||direction<0||direction>3)return state;
  const next=player+[-width,1,width,-1][direction];
  if(next<0||next>=cells.length||((direction===1||direction===3)&&Math.floor(next/width)!==Math.floor(player/width)))return state;
  if(action.kind==="dig"){if(cells[next]!==":")return state;cells[next]=".";}
  else {if(cells[next]==="#"||cells[next]==="o")return state;player=next;if(cells[next]==="*"){gems++;cells[next]=".";}else if(cells[next]===":")cells[next]=".";}
 }
 // Snapshot bottom-up. Every rock gets exactly one chance to fall one cell this turn.
 const rocks=cells.flatMap((ch,i)=>ch==="o"?[i]:[]).reverse();
 for(const rock of rocks){const below=rock+width;if(below>=cells.length||cells[below]!==".")continue;cells[rock]=".";cells[below]="o";if(below===player)lost=true;}
 return {cells:cells.join(""),player,gems,lost};
}
const mineActions:MineAction[]=[...[0,1,2,3].map(direction=>({kind:"walk" as const,direction})),...[0,1,2,3].map(direction=>({kind:"dig" as const,direction})),{kind:"wait"}];
export type MineHint={status:"route";action:MineAction;length:number}|{status:"lost"|"solved"|"dead-end"|"budget"};
/** Search only on explicit hint request; a budget outcome is never called a dead end. */
export function mineHint(level:MineLevel,start:MineState,limit=12000):MineHint{
 if(start.lost)return {status:"lost"};if(mineWon(level,start))return {status:"solved"};
 const key=(s:MineState)=>`${s.player}/${s.cells}`;
 const queue:{state:MineState;first:MineAction|null;depth:number}[]=[{state:start,first:null,depth:0}],seen=new Set([key(start)]);
 let head=0;for(;head<queue.length&&head<limit;head++)for(const action of mineActions){const next=mineStep(level,queue[head].state,action);if(next===queue[head].state||next.lost||seen.has(key(next)))continue;seen.add(key(next));const first=queue[head].first??action,length=queue[head].depth+1;if(mineWon(level,next))return {status:"route",action:first,length};queue.push({state:next,first,depth:length});}
 return {status:head<queue.length?"budget":"dead-end"};
}
