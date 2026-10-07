// SPDX-License-Identifier: GPL-3.0-only
/** Original classic 2048 implementation; no upstream source or authored levels. */
export type MergeDirection = "up" | "right" | "down" | "left";
export const mergeDirections: MergeDirection[] = ["up", "right", "down", "left"];
export const mergeDirectionLabels: Record<MergeDirection,string> = {up:"向上",right:"向右",down:"向下",left:"向左"};
export type MergeMotion = {from:number;to:number;value:number;merged:boolean};
export type MergeTile = {id:number;index:number;value:number};
export type MergeSnapshot = {board:number[];seed:number;score:number;moves:number};
export type MergeState = MergeSnapshot & {tiles:MergeTile[];nextId:number;history:MergeSnapshot[];spawned:number|null;motion:(MergeMotion & {id:number})[];mergedIds:number[]};
export const MERGE_HISTORY_LIMIT=32;
export function validMergeBoard(board:readonly number[]):boolean {
  return Array.isArray(board)&&board.length===16&&Array.from(board).every(v=>Number.isSafeInteger(v)&&(v===0||(v>=2&&2**Math.round(Math.log2(v))===v)));
}
export function mergeLine(line:readonly number[]):{line:number[];score:number}{
  const compact=line.filter(Boolean),result:number[]=[];let score=0;
  for(let i=0;i<compact.length;i++){if(compact[i]===compact[i+1]&&Number.isSafeInteger(compact[i]*2)){const value=compact[i]*2;result.push(value);score+=value;i++;}else result.push(compact[i]);}
  while(result.length<line.length)result.push(0);return {line:result,score};
}
export function slideMergeBoard(board:readonly number[],direction:MergeDirection):{board:number[];score:number;changed:boolean;motion:MergeMotion[]}{
  if(!validMergeBoard(board)||!mergeDirections.includes(direction))return {board:[...board],score:0,changed:false,motion:[]};
  const next=Array<number>(16).fill(0),motion:MergeMotion[]=[];let score=0;
  for(let lane=0;lane<4;lane++){
    const indices=Array.from({length:4},(_,step)=>direction==="left"?lane*4+step:direction==="right"?lane*4+3-step:direction==="up"?step*4+lane:(3-step)*4+lane);
    const occupied=indices.filter(i=>board[i]);let output=0;
    for(let i=0;i<occupied.length;i++){const from=occupied[i],to=indices[output++],value=board[from],merged=board[occupied[i+1]]===value&&Number.isSafeInteger(value*2);motion.push({from,to,value,merged});if(merged){motion.push({from:occupied[++i],to,value,merged:true});next[to]=value*2;score+=value*2;}else next[to]=value;}
  }
  return {board:next,score,changed:next.some((v,i)=>v!==board[i]),motion};
}
export function nextMergeSeed(seed:number):number{return (Math.imul(seed>>>0,1664525)+1013904223)>>>0;}
export function nextMergeValue(seed:number):number{return (nextMergeSeed(seed)>>>16)%10===0?4:2;}
export function spawnMergeTile(board:readonly number[],seed:number):{board:number[];seed:number;index:number|null}{
  const empty=board.flatMap((v,i)=>v===0?[i]:[]);if(!empty.length)return {board:[...board],seed,index:null};const nextSeed=nextMergeSeed(seed),index=empty[nextSeed%empty.length],next=[...board];next[index]=nextMergeValue(seed);return {board:next,seed:nextSeed,index};
}
export function legalMergeMoves(board:readonly number[]):MergeDirection[]{return mergeDirections.filter(d=>slideMergeBoard(board,d).changed);}
export function isMergeGameOver(board:readonly number[]):boolean{return validMergeBoard(board)&&legalMergeMoves(board).length===0;}
export function isMergeWon(board:readonly number[],target=2048):boolean{return board.some(v=>v>=target);}
export function mergeSnapshot(s:MergeSnapshot):MergeSnapshot{return {board:[...s.board],seed:s.seed,score:s.score,moves:s.moves};}
export function restoreMergeState(snapshot:MergeSnapshot,history:MergeSnapshot[]=[]):MergeState{return {...mergeSnapshot(snapshot),tiles:snapshot.board.flatMap((value,index)=>value?[{id:index+1,index,value}]:[]),nextId:17,history:history.slice(-MERGE_HISTORY_LIMIT),spawned:null,motion:[],mergedIds:[]};}
export function randomMergeSeed():number{if(typeof globalThis.crypto?.getRandomValues==="function")return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];return Math.floor(Math.random()*0x100000000)>>>0;}
export function createMergeState(seed=randomMergeSeed()):MergeState{const first=spawnMergeTile(Array(16).fill(0),seed),second=spawnMergeTile(first.board,first.seed);return restoreMergeState({board:second.board,seed:second.seed,score:0,moves:0});}
export function mergeMove(state:MergeState,direction:MergeDirection):MergeState{
  const moved=slideMergeBoard(state.board,direction);if(!moved.changed)return state;
  const spawned=spawnMergeTile(moved.board,state.seed),tiles:MergeTile[]=[],mergedIds:number[]=[];let nextId=state.nextId;const byIndex=new Map(state.tiles.map(t=>[t.index,t]));
  for(let index=0;index<16;index++){const sources=moved.motion.filter(m=>m.to===index);if(!sources.length)continue;const merged=sources.length===2,id=merged?nextId++:byIndex.get(sources[0].from)!.id;tiles.push({id,index,value:moved.board[index]});if(merged)mergedIds.push(id);}
  if(spawned.index!==null)tiles.push({id:nextId++,index:spawned.index,value:spawned.board[spawned.index]});
  return {...state,board:spawned.board,tiles,nextId,seed:spawned.seed,score:state.score+moved.score,moves:state.moves+1,spawned:spawned.index,history:[...state.history.slice(-(MERGE_HISTORY_LIMIT-1)),mergeSnapshot(state)],mergedIds,motion:moved.motion.map(m=>({...m,id:byIndex.get(m.from)!.id}))};
}
export function undoMerge(state:MergeState):MergeState{const previous=state.history.at(-1);return previous?restoreMergeState(previous,state.history.slice(0,-1)):state;}
/** One-step heuristic, not a promised solution or a hidden teaching route. */
export function mergeHint(state:MergeState):MergeDirection|null{let best:MergeDirection|null=null,rank=-Infinity;for(const direction of mergeDirections){const moved=slideMergeBoard(state.board,direction);if(!moved.changed)continue;const empty=moved.board.filter(v=>v===0).length,largest=Math.max(...moved.board),corner=[0,3,12,15].some(i=>moved.board[i]===largest)?1:0,value=empty*100+moved.score+corner*20;if(value>rank){rank=value;best=direction;}}return best;}
