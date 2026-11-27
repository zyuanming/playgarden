// SPDX-License-Identifier: GPL-3.0-only
export const APPOINTMENT_SAVE='playgarden.appointment-planner.v1';
export const sites={
  H:{name:'礼堂',pos:0},
  L:{name:'图书馆',pos:2},
  S:{name:'工作室',pos:3},
  G:{name:'花园',pos:5},
} as const;
export type Site=keyof typeof sites;
export type Task={id:string;site:Site;name:string;open:number;close:number;duration:number};
export type Day={id:string;title:string;cutoff:number;back:boolean;tasks:readonly Task[]};
export type Stop={task:Task;from:Site;depart:number;arrive:number;start:number;end:number;walk:number;wait:number;legal:boolean};
export type Agenda={order:string[];returned:boolean};
export const blank=():Agenda=>({order:[],returned:false});
export const walk=(a:Site,b:Site)=>Math.abs(sites[a].pos-sites[b].pos);
export function clock(unit:number){
  const n=540+unit*5;
  return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
}
export function predict(site:Site,time:number,task:Task,cutoff:number):Stop{
  const minutes=walk(site,task.site),arrive=time+minutes;
  const start=Math.max(arrive,task.open),end=start+task.duration;
  return {task,from:site,depart:time,arrive,start,end,walk:minutes,wait:start-arrive,legal:end<=task.close&&end<=cutoff};
}
export function replayDay(d:Day,order:readonly string[]){
  let site:Site='H',time=0;
  const used=new Set<string>(),stops:Stop[]=[];
  for(const id of order){
    const t=d.tasks.find(t=>t.id===id);
    if(!t||used.has(id)) return null;
    const next=predict(site,time,t,d.cutoff);
    if(!next.legal)return null;
    stops.push(next);used.add(id);site=t.site;time=next.end;
  }
  const left=d.tasks.filter(t=>!used.has(t.id));
  const home=time+walk(site,'H');
  return {site,time,stops,left,home,canReturn:d.back&&left.length===0&&home<=d.cutoff};
}
export function readAgenda(d:Day,raw:string|null):Agenda{
  try{
    const s=JSON.parse(raw??'null');
    if(s?.id!==d.id||!Array.isArray(s.order)||s.order.length>d.tasks.length||typeof s.returned!=='boolean')return blank();
    const plan=replayDay(d,s.order);
    if(!plan||s.returned&&!plan.canReturn)return blank();
    return {order:s.order,returned:s.returned};
  }catch{return blank();}
}
export function nextPlan(d:Day,site:Site,time:number,left:readonly Task[]):string[]|null{
  if(!left.length)return !d.back||time+walk(site,'H')<=d.cutoff?[]:null;
  // Earliest possible service is sufficient: starting later cannot make a future time window easier.
  for(const t of left){
    const c=predict(site,time,t,d.cutoff);
    if(!c.legal)continue;
    const tail=nextPlan(d,t.site,c.end,left.filter(item=>item.id!==t.id));
    if(tail)return [t.id,...tail];
  }
  return null;
}
