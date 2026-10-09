// SPDX-License-Identifier: GPL-3.0-only
/** Ideal rigid 2D serial stack: each interface supports ALL mass above it. */
export type BscuBlock={name:string;width:number;mass:number;core:number;color:string};
export type BscuLevel={title:string;base:[number,number];blocks:BscuBlock[];target:number;guide:number[];tip:string};
export type BscuState={placed:number[];result:'playing'|'won'|'lost';failed:number|null;message:string};
export type BscuSupport={layer:number;lo:number;hi:number;com:number;mass:number;stable:boolean};
const block=(name:string,width:number,mass:number,color:string,core=width/2):BscuBlock=>({name,width,mass,color,core});
const teal='#518b83',sand='#c7995b',rose='#bb7772',blue='#6f91ab',gold='#d1ad50';
export const balanceSculptureLevels:BscuLevel[]=[
 {title:'安稳的第一件作品',base:[4,8],blocks:[block('宽底座',6,4,teal),block('小冠石',2,1,gold)],target:7,guide:[3,6],tip:'接触面提供支撑。冠石放下后，底座也要承担它的重量。'},
 {title:'轻轻向外伸',base:[4,6],blocks:[block('沉底座',6,4,teal),block('轻挑梁',4,1,sand),block('小冠石',2,1,gold)],target:8,guide:[2,5,7],tip:'上层能伸出边缘，但它连同更高层的合重心必须落在下方接触区。'},
 {title:'重底座的本领',base:[4,6],blocks:[block('厚石基',8,8,blue),block('长木梁',7,1,sand),block('远端冠石',2,1,gold)],target:9,guide:[1,4,8],tip:'质量八的底座能把整座作品的重心拉回基台内，但不能替上层接口兜底。'},
 {title:'细腰上的横梁',base:[3,7],blocks:[block('宽石座',8,5,teal),block('细石柱',2,3,blue),block('轻长梁',7,1,sand),block('冠石',2,1,gold)],target:7,guide:[1,4,1,6],tip:'整座重心正常不代表不会倒。细柱与长梁的接触面也必须逐层检查。'},
 {title:'更重的冠石',base:[4,6],blocks:[block('稳固石座',8,6,teal),block('承重横梁',7,4,rose),block('重冠石',2,3,gold)],target:8,guide:[1,2,7],tip:'冠石这次重三份。先为它预留重心余量，不能照搬轻冠石的摆法。'},
 {title:'窄台四层塔',base:[5,6],blocks:[block('宽基座',8,4,teal),block('中层梁',6,2,sand),block('塔身',3,1,blue),block('尖顶',1,1,gold)],target:7.5,guide:[1,3,6,7],tip:'基台只宽一格。四层的总重心必须留在这一格内，每个上层接口也要稳定。'},
 {title:'看见偏心配重',base:[4,6],blocks:[block('左芯石座',8,6,rose,2),block('短梁',4,2,sand),block('远端冠石',2,1,gold)],target:9,guide:[3,5,8],tip:'石座内部左侧有配重，白色重心线不在几何正中。按真实质心计算，别只看外形。'},
 {title:'六层悬挑雕塑',base:[5,7],blocks:[block('宽底座',9,6,teal),block('窄支柱',3,4,blue),block('偏芯长梁',8,3,rose,3),block('左芯配重梁',6,3,teal,1),block('轻挑梁',6,1,sand),block('顶端冠石',2,1,gold)],target:10,guide:[1,4,3,4,5,9],tip:'两块偏心梁、一个窄支柱和最远的冠石。每放一块，都重新核对全部六个承重接口。'},
];
export const BSCU_WIDTH=14;
export function bscuInitial():BscuState{return{placed:[],result:'playing',failed:null,message:'选择水平位置，再放下这一层。'};}
export function bscuSupports(l:BscuLevel,placed:number[]):BscuSupport[]{const checks:BscuSupport[]=[];for(let layer=0;layer<placed.length;layer++){const block=l.blocks[layer],lower=layer===0?l.base:[placed[layer-1],placed[layer-1]+l.blocks[layer-1].width],lo=Math.max(placed[layer],lower[0]),hi=Math.min(placed[layer]+block.width,lower[1]);let mass=0,moment=0;for(let j=layer;j<placed.length;j++){const b=l.blocks[j];mass+=b.mass;moment+=b.mass*(placed[j]+b.core);}const com=moment/mass;checks.push({layer,lo,hi,com,mass,stable:hi>lo&&com>=lo-1e-9&&com<=hi+1e-9});}return checks;}
export function bscuStable(l:BscuLevel,placed:number[]){return bscuSupports(l,placed).every(c=>c.stable);}
export function bscuPlace(l:BscuLevel,s:BscuState,x:number):BscuState{if(s.result!=='playing')return s;const b=l.blocks[s.placed.length];if(!b||!Number.isFinite(x)||x<0||x+b.width>BSCU_WIDTH||Math.abs(x*2-Math.round(x*2))>1e-8)return s;const placed=[...s.placed,x],checks=bscuSupports(l,placed),bad=checks.find(c=>!c.stable);if(bad)return{...s,result:'lost',failed:x,message:`第 ${bad.layer+1} 层接口失稳：上方合重心 ${bad.com.toFixed(2)}，接触区 ${bad.lo.toFixed(1)}–${bad.hi.toFixed(1)}。可撤销这次放置。`};if(placed.length===l.blocks.length){const center=x+b.width/2,won=Math.abs(center-l.target)<1e-8;return{placed,result:won?'won':'lost',failed:null,message:won?'所有接口稳定，冠石也抵达目标。雕塑完成！':`全部稳定，但冠石中心 ${center} 没到目标 ${l.target}。可撤销顶层重新摆放。`};}return{placed,result:'playing',failed:null,message:'这一层站稳了。下一块会改变每一个下方接口的合重心。'};}
/** Bounded current-prefix continuation, never resets or removes existing layers. */
export function bscuPlan(l:BscuLevel,s:BscuState,limit=20000):{path:number[]|null;visited:number;exhausted:boolean}{let visited=0,exhausted=false;function visit(placed:number[]):number[]|null{if(++visited>limit){exhausted=true;return null;}if(placed.length===l.blocks.length)return[];const i=placed.length,b=l.blocks[i],last=i===l.blocks.length-1;const candidates=last?[l.target-b.width/2]:Array.from({length:(BSCU_WIDTH-b.width)*2+1},(_,n)=>n/2).sort((a,c)=>Math.abs(a-l.guide[i])-Math.abs(c-l.guide[i]));for(const x of candidates){if(x<0||x+b.width>BSCU_WIDTH||!bscuStable(l,[...placed,x]))continue;const next=visit([...placed,x]);if(next)return[x,...next];if(exhausted)return null;}return null;}const path=s.result==='playing'?visit(s.placed):null;return{path,visited,exhausted};}
