// SPDX-License-Identifier: GPL-3.0-only
// A small offline host for the original MIT game, not a replacement rules engine.
import {instantiateBlicblockOriginal} from './blicblockOriginal';

export type BlicColor='magenta'|'orange'|'yellow'|'green'|'blue'|'white';
export type BlicBlock={id:string;color:BlicColor;x:number;y:number;active:boolean;locked:boolean;sliding:boolean;plummetting:boolean;highlight:boolean};
export type BlicSnapshot={blocks:BlicBlock[];upcoming:BlicBlock[];score:number;level:number;tickLength:number;gameover:boolean;paused:boolean;busy:boolean;best:number;storageOK:boolean;mode:number;timers:number;disposed:boolean;clears:number};
type Job={fn:()=>void;delay:number;repeat:boolean;remaining:number;due:number;handle:ReturnType<typeof setTimeout>|null};
type Info={current_score:number;level:number;tick_length:number;game_over:boolean;in_progress:boolean;plummetting_block:boolean;sliding_block:boolean};
type Original={blocks:BlicBlock[];upcoming:BlicBlock[];info:Info};
type Scope={game_info?:Info;[key:string]:unknown;$on:(name:string,fn:()=>void)=>void;$emit:(name:string)=>void;$watch:(name:string,fn:()=>void)=>void};
const STORAGE_KEY='playgarden.blicblock.best.v1';

export function createBlicblockRuntime(changed:(s:BlicSnapshot)=>void,mode=0){
 const jobs=new Set<Job>(),events=new Map<string,()=>void>(),watches:{name:string;fn:()=>void;value:unknown}[]=[];
 let disposed=false,paused=false,core:Original|undefined,storageOK=true,best=0;
 try{const stored=localStorage.getItem(STORAGE_KEY);if(stored!==null){const n=Number(stored);if(Number.isSafeInteger(n)&&n>=0)best=n;}}catch{storageOK=false;}
 const scope:Scope={
  $on:(name,fn)=>{events.set(name,fn);},
  $emit:name=>{events.get(name)?.();},
  $watch:(name,fn)=>{watches.push({name,fn,value:Symbol('initial')});},
 };
 function digest(){for(const watch of watches){const value=watch.name==='game_info.level'?scope.game_info?.level:undefined;if(watch.value!==value){watch.value=value;watch.fn();}}}
 function snapshot():BlicSnapshot{return {blocks:core?core.blocks.map(b=>({...b})):[],upcoming:core?core.upcoming.map(b=>({...b})):[],score:core?.info.current_score??0,level:core?.info.level??1,tickLength:core?.info.tick_length??1200,gameover:core?.info.game_over??false,paused,busy:!!(core?.info.plummetting_block||core?.info.sliding_block),best,storageOK,mode,timers:jobs.size,disposed,clears:(core?.info.current_score??0)/1000};}
 function publish(){if(!disposed){digest();changed(snapshot());}}
 function arm(job:Job){
  if(paused||disposed||!jobs.has(job))return;
  job.due=performance.now()+job.remaining;
  job.handle=setTimeout(()=>{job.handle=null;if(disposed||paused)return;if(!job.repeat)jobs.delete(job);job.fn();publish();if(job.repeat&&jobs.has(job)){job.remaining=job.delay;arm(job);}},job.remaining);
 }
 function schedule(fn:()=>void,delay:number,repeat:boolean){const job:Job={fn,delay,repeat,remaining:delay,due:0,handle:null};jobs.add(job);arm(job);return job;}
 function cancel(job:Job|undefined){if(!job)return;if(job.handle!==null)clearTimeout(job.handle);jobs.delete(job);}
 const interval=Object.assign((fn:()=>void,delay:number)=>schedule(fn,delay,true),{cancel});
 core=instantiateBlicblockOriginal({scope,root:{collapse:{nav:true},$watch:()=>{}},interval,timeout:(fn:()=>void,delay:number)=>schedule(fn,delay,false),params:mode?{cascade_count:String(mode)}:{},restart:()=>{},storage:{
  get:(name:string)=>name==='high_score'&&best>0?{value:best}:undefined,
  set:(name:string,value:{value:number})=>{if(name!=='high_score'||!Number.isSafeInteger(value.value)||value.value<0)return;best=Math.max(best,value.value);try{localStorage.setItem(STORAGE_KEY,String(best));storageOK=true;}catch{storageOK=false;}},
 }});
 digest();
 return {
  snapshot,
  input(direction:'left'|'right'|'down'){if(disposed||paused||core?.info.game_over)return;scope.$emit('move_'+direction);publish();},
  pause(value:boolean){if(disposed||paused===value)return;paused=value;if(value){for(const job of jobs){if(job.handle!==null){clearTimeout(job.handle);job.handle=null;job.remaining=Math.max(0,job.due-performance.now());}}}else{for(const job of jobs)arm(job);}publish();},
  dispose(){disposed=true;for(const job of jobs)if(job.handle!==null)clearTimeout(job.handle);jobs.clear();events.clear();watches.length=0;},
 };
}
export type BlicRuntime=ReturnType<typeof createBlicblockRuntime>;
