// SPDX-License-Identifier: GPL-3.0-only
// Original cuboid movement engine and route-authored bridge layouts.
export type RollDirection='up'|'down'|'left'|'right';
export type RollPose={x:number;y:number;axis:'stand'|'wide'|'tall'};
export type RollLesson={title:string;tip:string;tiles:string[];start:RollPose;goal:string;fragile:string[];width:number;height:number};
export const rollKey=({x,y,axis}:RollPose)=>`${x},${y},${axis}`;
export const rollCells=(p:RollPose):string[]=>[`${p.x},${p.y}`,...(p.axis==='wide'?[`${p.x+1},${p.y}`]:p.axis==='tall'?[`${p.x},${p.y+1}`]:[])];
export function rollStep(p:RollPose,d:RollDirection):RollPose{const {x,y,axis}=p;if(d==='left')return axis==='stand'?{x:x-2,y,axis:'wide'}:axis==='wide'?{x:x-1,y,axis:'stand'}:{x:x-1,y,axis};if(d==='right')return axis==='stand'?{x:x+1,y,axis:'wide'}:axis==='wide'?{x:x+2,y,axis:'stand'}:{x:x+1,y,axis};if(d==='up')return axis==='stand'?{x,y:y-2,axis:'tall'}:axis==='tall'?{x,y:y-1,axis:'stand'}:{x,y:y-1,axis};return axis==='stand'?{x,y:y+1,axis:'tall'}:axis==='tall'?{x,y:y+2,axis:'stand'}:{x,y:y+1,axis};}
export function rollLegal(l:RollLesson,p:RollPose){return rollCells(p).every(cell=>l.tiles.includes(cell))&&!(p.axis==='stand'&&l.fragile.includes(`${p.x},${p.y}`));}
export const rollSolved=(l:RollLesson,p:RollPose)=>p.axis==='stand'&&`${p.x},${p.y}`===l.goal;
const directions:RollDirection[]=['up','right','down','left'];
export function rollSolution(l:RollLesson,start:RollPose):RollDirection[]|null{const queue:{p:RollPose;path:RollDirection[]}[]=[{p:start,path:[]}],seen=new Set([rollKey(start)]);for(let q=0;q<queue.length;q++){const {p,path}=queue[q];if(rollSolved(l,p))return path;for(const d of directions){const next=rollStep(p,d),key=rollKey(next);if(rollLegal(l,next)&&!seen.has(key)){seen.add(key);queue.push({p:next,path:[...path,d]});}}}return null;}
function bridge(title:string,route:string,tip:string,fragileCount=0,branches:[number,number][]=[]):RollLesson{let p:RollPose={x:0,y:0,axis:'stand'};const poses=[p];const map:Record<string,RollDirection>={R:'right',L:'left',U:'up',D:'down'};for(const char of route){p=rollStep(p,map[char]);poses.push(p);}const raw=[...new Set([...poses.flatMap(rollCells),...branches.map(([x,y])=>`${x},${y}`)])];const points=raw.map(c=>c.split(',').map(Number)),minX=Math.min(...points.map(c=>c[0])),minY=Math.min(...points.map(c=>c[1]));const shifted=poses.map(p=>({...p,x:p.x-minX,y:p.y-minY}));const tiles=points.map(([x,y])=>`${x-minX},${y-minY}`),stands=new Set(shifted.filter(p=>p.axis==='stand').flatMap(rollCells));const fragile=tiles.filter(c=>!stands.has(c)).filter((_,i)=>i%3===0).slice(0,fragileCount);const goal=shifted[shifted.length-1];return{title,tip,tiles,start:shifted[0],goal:`${goal.x},${goal.y}`,fragile,width:Math.max(...points.map(c=>c[0]))-minX+1,height:Math.max(...points.map(c=>c[1]))-minY+1};}
export const rollingBlockLevels:RollLesson[]=[
 bridge('第一次翻身','RR','石柱站立时，翻一下会躺着占两格。再翻一次才会站起来。'),
 bridge('石桥转角','RRDD','到达拐角前，先让石柱站稳。转向会改变它占地的方向。'),
 bridge('横卧过河','RDDR','横卧时可以侧移。不要把两格长的石柱当成一枚方块。'),
 bridge('薄石阶梯','DRRDDRRD','带裂纹的薄石只能承受躺着的石柱，站上去会碎裂。',2),
 bridge('回头的桥','RRDRRDLL','终点藏在回转处。观察石柱最后一次起身的位置。',1,[[4,0],[5,0]]),
 bridge('弯月长桥','RDDRRUUR','沿弯曲石桥两次侧移，方向相同，姿态也可能不同。',2,[[3,0],[3,1]]),
 bridge('两岸之间','DRRRRDDLLLLU','窄桥两边看起来很近，却需要横卧穿过通道。',3,[[2,0],[2,1]]),
 bridge('云上折返','RDD RDRRD RUUR ULLU'.replaceAll(' ',''),'最终试炼：连过窄桥、转角和薄石。只有直立在圆形终点才算完成。',4,[[4,2],[5,2],[7,1]]),
];
export const rollLabels:Record<RollDirection,string>={up:'向上',down:'向下',left:'向左',right:'向右'};
