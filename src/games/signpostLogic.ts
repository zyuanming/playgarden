// SPDX-License-Identifier: GPL-3.0-only
// whichdir/ispointing and linked-number consistency adapted from MIT Signpost.
// Full fixed upstream source and licence: vendor/sgtatham-signpost.
export type SignpostLevel = { id: string; title: string; chapter: number; width: number; height: number; arrows: number[]; clues: number[] };
export const SIGNPOST_SAVE = 'playgarden.signpost.v1';
export const DIRECTIONS = ['↑','↗','→','↘','↓','↙','←','↖'];
export const DIRECTION_NAMES = ['上','右上','右','右下','下','左下','左','左上'];
const delta = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
export const initialSignpost = (p: SignpostLevel): number[] => p.arrows.map(() => -1);
export function pointsTo(p: SignpostLevel, from: number, to: number) {
  const n=p.width*p.height;
  if (!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=n||to>=n||from===to||p.clues[from]===n||p.arrows[from]<0) return false;
  let x=from%p.width, y=Math.floor(from/p.width);
  const [dx,dy]=delta[p.arrows[from]] ?? [0,0];
  if(!dx&&!dy) return false;
  while(true){ x+=dx;y+=dy;if(x<0||y<0||x>=p.width||y>=p.height)return false;if(y*p.width+x===to)return true; }
}
// Every connected component must be a directed chain. Numeric anchors determine
// its offset, while unanchored components retain relative A1, A2 ... labels.
export function inspectSignpost(p: SignpostLevel, next: number[]) {
  const n=p.width*p.height, prev=Array(n).fill(-1) as number[], numbers=Array(n).fill(0) as number[], labels=Array(n).fill('·') as string[], groups:number[][]=[];
  const bad=(reason: string)=>({valid:false,won:false,reason,prev,numbers,labels,groups,links:0});
  if(next.length!==n||!Array.from(next).every(v=>Number.isInteger(v)&&v>=-1&&v<n))return bad('存档格式不正确。');
  for(let i=0;i<n;i++)if(next[i]>=0){const j=next[i];if(!pointsTo(p,i,j))return bad('下一格必须位于箭头所指的直线上。');if(prev[j]>=0)return bad('每格只能有一个前驱。');prev[j]=i;}
  const visited=new Set<number>();let letter=0;
  for(let i=0;i<n;i++)if(prev[i]<0){
    const chain:number[]=[];let j=i;
    while(j>=0){if(visited.has(j))return bad('路线不能形成环。');visited.add(j);chain.push(j);j=next[j];}
    let start:number|null=null;
    for(let k=0;k<chain.length;k++){const clue=p.clues[chain[k]];if(clue){const offset=clue-k;if(start!==null&&start!==offset)return bad('这条连线让固定数字的间隔不符。');start=offset;}}
    if(start!==null){if(start<1||start+chain.length-1>n)return bad('路线越过了起点或终点。');chain.forEach((cell,k)=>{numbers[cell]=start+k;labels[cell]=String(start+k);});}
    else if(chain.length>1){const prefix=String.fromCharCode(65+letter++);chain.forEach((cell,k)=>{labels[cell]=`${prefix}${k+1}`;});}
    groups.push(chain);
  }
  if(visited.size!==n)return bad('路线不能形成环。');
  const seen=new Set<number>();for(const v of numbers)if(v){if(seen.has(v))return bad('两段路线占用了同一个数字。');seen.add(v);}
  const links=next.filter(j=>j>=0).length;
  // Complete = every number 1..n occurs exactly once, with all n−1 explicit
  // successor links present and every ray valid. No answer-certificate lookup.
  const won=links===n-1&&seen.size===n&&groups.length===1;
  return {valid:true,won,reason:'',prev,numbers,labels,groups,links};
}
export function linkSignpost(p: SignpostLevel, state: number[], from: number, to: number) {
  const check=inspectSignpost(p,state);
  if(!check.valid||check.won)return {state,reason:check.won?'本关已完成。':check.reason};
  if(!pointsTo(p,from,to))return {state,reason:'下一格必须位于箭头所指的直线上，可以跨过其他格。'};
  if(state[from]>=0)return {state,reason:'这格已有去向。请先断开它的出线，再连接。'};
  if(check.prev[to]>=0)return {state,reason:'目标已有来路。请先断开原来的连线。'};
  const next=[...state];next[from]=to;const result=inspectSignpost(p,next);
  return result.valid?{state:next,reason:''}:{state,reason:result.reason};
}
export function unlinkSignpost(p: SignpostLevel,state:number[],from:number){
  const check=inspectSignpost(p,state);
  if(!check.valid||check.won||!Number.isInteger(from)||from<0||from>=state.length||state[from]<0)return state;
  const next=[...state];next[from]=-1;return next;
}
export function solveSignpost(p: SignpostLevel,state:number[],budget=50000):{kind:'solution';state:number[];nodes:number}|{kind:'none'|'budget';nodes:number}{
  const check=inspectSignpost(p,state);let nodes=0,exceeded=false,answer:number[]|null=null;
  if(!check.valid)return {kind:'none',nodes};
  const n=state.length,anchors=new Map(p.clues.map((v,i)=>[v,i])),start=anchors.get(1);
  if(start===undefined)return {kind:'none',nodes};
  const edges=state.map((v,i)=>v>=0?[v]:Array.from({length:n},(_,j)=>j).filter(j=>pointsTo(p,i,j)));
  const used=new Set<number>([start]),path=[start];
  function visit(){
    if(++nodes>Math.max(0,budget)){exceeded=true;return;}
    if(path.length===n){answer=initialSignpost(p);for(let k=0;k<n-1;k++)answer[path[k]]=path[k+1];return;}
    const from=path[path.length-1],k=path.length+1;
    for(const to of edges[from]){
      if(used.has(to)||(p.clues[to]>0&&p.clues[to]!==k)||(anchors.has(k)&&anchors.get(k)!==to)||(check.prev[to]>=0&&check.prev[to]!==from))continue;
      used.add(to);path.push(to);visit();path.pop();used.delete(to);if(answer||exceeded)return;
    }
  }
  visit();return answer?{kind:'solution',state:answer,nodes}:{kind:exceeded?'budget':'none',nodes};
}
export function parseSignpostSave(raw:string|null,p:SignpostLevel):number[][]{
  const fresh=[initialSignpost(p)];if(!raw)return fresh;
  try{const x=JSON.parse(raw);if(x.id!==p.id||!Array.isArray(x.history)||x.history.length<1||x.history.length>501||!x.history.every((s:unknown)=>Array.isArray(s)&&inspectSignpost(p,s).valid))return fresh;
    // A persisted undo step must be one legal link addition/removal. Otherwise
    // reject the whole untrusted history rather than restore forged transitions.
    for(let k=1;k<x.history.length;k++){
      const a=x.history[k-1] as number[],b=x.history[k] as number[];
      if(inspectSignpost(p,a).won)return fresh;
      const diff=a.map((v,i)=>v===b[i]?-1:i).filter(i=>i>=0);
      if(diff.length!==1)return fresh;const i=diff[0];
      if(a[i]!==-1&&b[i]!==-1)return fresh;
    }
    return x.history;
  }catch{return fresh;}
}
