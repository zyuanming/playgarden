// SPDX-License-Identifier: GPL-3.0-only
// Host persistence validation. Upstream game source retains its CC-BY-SA-4.0 license.
import {swapMaps} from './swapMaps';
export type SwapDirection='up'|'down'|'left'|'right';
export type SwapActor={id:number;type:number;x:number;y:number;vx:number;vy:number;hitWall:boolean;prevX?:number;prevY?:number;vxo?:number;vyo?:number};
export type SwapSave={version:1;source:'a3cfb7d2';level:number;ticks:number;deaths:number;result:'playing'|'won'|'lost';actors:SwapActor[];motion:{vx:number;vy:number;trail:number[][]};gates:{x:number;y:number;open:boolean;touching:boolean;just:boolean}[];plates:{x:number;y:number;down:boolean}[];anyDown:boolean[]};
export type SwapSnapshot=SwapSave&{gridSize:number;width:number;height:number;started:boolean;held:SwapDirection[];credits:boolean};
export type SwapRuntime={snapshot:()=>SwapSnapshot;start:()=>void;step:()=>void;hold:(direction:SwapDirection,down:boolean)=>void;cancel:()=>void;swap:()=>void;retry:()=>void;save:()=>SwapSave;restore:(value:unknown)=>boolean;dispose:()=>void};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const finite=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const integer=(v:unknown,min:number,max:number)=>finite(v,min,max)&&Number.isInteger(v);
const bool=(v:unknown)=>typeof v==='boolean';
function touching(actor:SwapActor,tile:number,level:number){const map=swapMaps[level],g=640/Math.max(map.sizeX,map.sizeY),x=actor.x-g/2+5,y=actor.y-g/2+5;return[[x,y],[x+g-10,y],[x,y+g-10],[x+g-10,y+g-10]].some(([px,py])=>map.tiles[Math.round((py-g/2)/g)]?.[Math.round((px-g/2)/g)]===tile);}
/** Whitelist values into existing instances only. Never deserialize constructors/functions. */
export function validSwapSave(value:unknown,fresh:SwapSave):value is SwapSave {
 if(!record(value)||value.version!==1||value.source!=='a3cfb7d2'||value.level!==fresh.level||!integer(value.ticks,0,100_000_000)||!integer(value.deaths,0,1_000_000)||!['playing','won','lost'].includes(String(value.result)))return false;
 const map=swapMaps[fresh.level],g=640/Math.max(map.sizeX,map.sizeY),width=g*map.sizeX,height=g*map.sizeY;
 const a=value.actors;if(!Array.isArray(a)||a.length!==fresh.actors.length||a.length===0)return false;
 const offset=fresh.actors.findIndex(actor=>record(a[0])&&actor.id===a[0].id);if(offset<0)return false;
 for(let i=0;i<a.length;i++){const v=a[i],expected=fresh.actors[(i+offset)%a.length];if(!record(v)||v.id!==expected.id||v.type!==expected.type||!finite(v.x,0,width)||!finite(v.y,0,height)||![0,7,-7].includes(v.vx as number)||![0,7,-7].includes(v.vy as number)||!bool(v.hitWall))return false;for(const k of ['prevX','prevY','vxo','vyo'])if(k in v&&!finite(v[k],-640,640))return false;}
 const motion=value.motion;if(!record(motion)||!finite(motion.vx,-8,8)||!finite(motion.vy,-8,8)||!Array.isArray(motion.trail)||motion.trail.length>4||!motion.trail.every(p=>Array.isArray(p)&&p.length===2&&finite(p[0],0,width)&&finite(p[1],0,height)))return false;
 if(!Array.isArray(value.gates)||value.gates.length!==fresh.gates.length||!value.gates.every((t,i)=>record(t)&&t.x===fresh.gates[i].x&&t.y===fresh.gates[i].y&&bool(t.open)&&bool(t.touching)&&bool(t.just)))return false;
 if(!Array.isArray(value.plates)||value.plates.length!==fresh.plates.length||!value.plates.every((t,i)=>record(t)&&t.x===fresh.plates[i].x&&t.y===fresh.plates[i].y&&bool(t.down)))return false;
 if(!Array.isArray(value.anyDown)||value.anyDown.length!==10||!value.anyDown.every(bool))return false;
 if(value.result==='won'&&!a.some(actor=>touching(actor,2,fresh.level)))return false;
 if(value.result==='lost'&&(!a.some(actor=>touching(actor,3,fresh.level))||Number(value.deaths)<1))return false;
 return true;
}
export const swapSaveKey=(level:number)=>`playgarden.swap.v1.${level}`;
export function loadSwap(runtime:SwapRuntime,level:number){try{const raw=localStorage.getItem(swapSaveKey(level));return !!raw&&raw.length<100000&&runtime.restore(JSON.parse(raw));}catch{return false;}}
export function saveSwap(runtime:SwapRuntime,level:number){try{localStorage.setItem(swapSaveKey(level),JSON.stringify(runtime.save()));return true;}catch{return false;}}
