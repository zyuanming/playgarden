import {chooseAI,solveLesson} from './ataxxSearch.ts';
import type {Lesson,Move,Position} from './ataxxLogic.ts';
export type Request={id:number;p:Position;history:Move[];lesson?:Lesson};
self.onmessage=(event:MessageEvent<Request>)=>{
  const {id,p,history,lesson}=event.data;
  try{self.postMessage({id,result:lesson?solveLesson(lesson,p,history):chooseAI(p)});}catch{self.postMessage({id,result:{kind:'budget',nodes:0}});}
};
