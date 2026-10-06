// SPDX-License-Identifier: GPL-3.0-only
import {MERGE_HISTORY_LIMIT,mergeSnapshot,restoreMergeState,validMergeBoard,type MergeSnapshot,type MergeState} from "./mergeLogic";
export const MERGE_SAVE_KEY="playgarden.merge.v1.round.free";
export const MERGE_BEST_KEY="playgarden.merge.v1.best";
function validSnapshot(value:unknown):value is MergeSnapshot{if(!value||typeof value!=="object")return false;const s=value as MergeSnapshot;return validMergeBoard(s.board)&&s.board.filter(Boolean).length>=2&&Number.isSafeInteger(s.score)&&s.score>=0&&s.score%4===0&&Number.isSafeInteger(s.moves)&&s.moves>=0&&Number.isInteger(s.seed)&&s.seed>=0&&s.seed<=0xffffffff;}
export function parseMergeSave(raw:string|null):MergeState|null{try{const s=JSON.parse(raw??"null");if(s?.version!==1||!validSnapshot(s.current))return null;return restoreMergeState(s.current,Array.isArray(s.history)?s.history.slice(-MERGE_HISTORY_LIMIT).filter(validSnapshot):[]);}catch{return null;}}
export function serializeMergeSave(state:MergeState):string{return JSON.stringify({version:1,current:mergeSnapshot(state),history:state.history.slice(-MERGE_HISTORY_LIMIT)});}
export function parseMergeBest(raw:string|null):number{if(raw===null||!/^\d+$/.test(raw))return 0;const n=Number(raw);return Number.isSafeInteger(n)&&n>=0?n:0;}
export function readMergeBest():number{try{return parseMergeBest(localStorage.getItem(MERGE_BEST_KEY));}catch{return 0;}}
export function readMergeSave():MergeState|null{try{return parseMergeSave(localStorage.getItem(MERGE_SAVE_KEY));}catch{return null;}}
/** Separate best record survives restart, undo and corrupted round data. */
export function saveMerge(state:MergeState,best:number):{best:number;saved:boolean}{const highest=Math.max(best,state.score,readMergeBest());let saved=true;try{localStorage.setItem(MERGE_BEST_KEY,String(highest));}catch{saved=false;}try{localStorage.setItem(MERGE_SAVE_KEY,serializeMergeSave(state));}catch{saved=false;}return {best:highest,saved};}
