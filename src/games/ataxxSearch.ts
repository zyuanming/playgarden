// Original Playgarden bounded search. No campaign answers are imported at runtime.
import { apply, counts, captures, distance, moves, outcome, pseudoMoves, stage, type Lesson, type Move, type Position } from './ataxxLogic.ts';
export type SearchResult={kind:'answer';move:Move;value:number;nodes:number;depth:number}|{kind:'budget';nodes:number};
const material=(p:Position)=>{const c=counts(p);return c[0]-c[1];};
function ordered(p:Position):Move[]{return moves(p).sort((a,b)=>{
  const gain=(m:Move)=>m===null?-100:captures(p,m).length*2+(distance(m.from,m.to,p.size)===1?1:0);
  return gain(b)-gain(a);
});}
export function solveLesson(lesson:Lesson,p:Position,history:Move[]=[],maxNodes=40000,milliseconds=200):SearchResult{
  maxNodes=Number.isFinite(maxNodes)?Math.max(0,Math.min(40000,Math.floor(maxNodes))):40000;
  milliseconds=Number.isFinite(milliseconds)?Math.max(0,Math.min(200,milliseconds)):200;
  let nodes=0;const until=Date.now()+milliseconds;let budget=false;
  const memo=new Map<string,{value:number;move:Move}>();
  function search(q:Position,h:Move[]):{value:number;move:Move}{
    nodes++;if(nodes>maxNodes||(nodes%64===0&&Date.now()>until)){budget=true;return {value:0,move:null};}
    const s=stage(lesson,h,q);
    if(s!=='playing'){
      let value=s==='success'?1:-1;
      // The hold lesson's reply really minimizes the surviving green pieces.
      if(lesson.goal.kind==='hold')value=outcome(q)===1?100:outcome(q)!==null?-100:counts(q)[0]-lesson.goal.target+0.5;
      return {value,move:null};
    }
    const key=q.board.join('')+':'+q.turn+':'+q.quiet+':'+h.length;
    const known=memo.get(key);if(known)return known;
    let best={value:q.turn===1?-Infinity:Infinity,move:null as Move};
    for(const move of ordered(q)){
      const v=search(apply(q,move),[...h,move]).value;
      if(budget)return best;
      if(q.turn===1?v>best.value:v<best.value)best={value:v,move};
      // Boolean win objectives can stop on a proved result for the side to play.
      if(lesson.goal.kind!=='hold'&&(q.turn===1?best.value===1:best.value===-1))break;
    }
    memo.set(key,best);return best;
  }
  const result=search(p,history);return budget?{kind:'budget',nodes}:{kind:'answer',...result,nodes,depth:lesson.goal.kind==='win'?lesson.goal.turns*2-1:lesson.goal.kind==='hold'?2:1};
}
export function chooseAI(p:Position,maxNodes=18000,milliseconds=180):SearchResult{
  maxNodes=Number.isFinite(maxNodes)?Math.max(0,Math.min(18000,Math.floor(maxNodes))):18000;
  milliseconds=Number.isFinite(milliseconds)?Math.max(0,Math.min(180,milliseconds)):180;
  const options=ordered(p);if(!options.length)return {kind:'answer',move:null,value:0,nodes:0,depth:0};
  let nodes=0,stopped=false;const deadline=Date.now()+milliseconds;
  let best={move:options[0],value:0,depth:0};
  function evaluate(q:Position){const end=outcome(q);if(end!==null)return end===0?0:end===1?10000+material(q):-10000+material(q);return material(q)*12+pseudoMoves(q,1).length-pseudoMoves(q,2).length;}
  function minimax(q:Position,depth:number,alpha:number,beta:number):number{
    nodes++;if(nodes>maxNodes||(nodes%32===0&&Date.now()>deadline)){stopped=true;return evaluate(q);}
    if(!depth||outcome(q)!==null)return evaluate(q);
    let value=q.turn===1?-Infinity:Infinity;
    for(const m of ordered(q)){
      const v=minimax(apply(q,m),depth-1,alpha,beta);if(stopped)return value;
      value=q.turn===1?Math.max(value,v):Math.min(value,v);
      if(q.turn===1)alpha=Math.max(alpha,value);else beta=Math.min(beta,value);
      if(alpha>=beta)break;
    }return value;
  }
  for(let depth=1;depth<=3;depth++){
    let round={move:options[0],value:p.turn===1?-Infinity:Infinity,depth};
    for(const m of options){const value=minimax(apply(p,m),depth-1,-Infinity,Infinity);if(stopped)break;if(p.turn===1?value>round.value:value<round.value)round={move:m,value,depth};}
    if(stopped)break;best=round;
  }
  return {kind:'answer',...best,nodes};
}
/** Bounded fallback when Workers are unavailable; never claims tactical proof. */
export function quickMove(p:Position):Move{return ordered(p)[0]??null;}
