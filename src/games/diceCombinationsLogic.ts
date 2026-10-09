// SPDX-License-Identifier: GPL-3.0-only
// Fixed, openly disclosed teaching sequences, never random dice.
export type DiceCategory = "pair"|"triple"|"four"|"house"|"straight"|"five"|"sixes"|"chance";
export type DiceLevel = {title:string;categories:DiceCategory[];target:number;rounds:number[][][];lesson:string};
export type DiceState = {round:number;roll:number;dice:number[];held:number;scores:Partial<Record<DiceCategory,number>>};
export type DiceAction = {kind:"hold";index:number}|{kind:"roll"}|{kind:"score";category:DiceCategory};
export const diceCategoryInfo:Record<DiceCategory,{title:string;rule:string;max:number}>={
 pair:{title:"一对",rule:"最高的一对：点数 × 2",max:12},triple:{title:"三同",rule:"至少三颗相同：点数 × 3",max:18},four:{title:"四同",rule:"至少四颗相同：点数 × 4",max:24},house:{title:"三带二",rule:"恰好三颗同点 + 两颗同点：25",max:25},straight:{title:"五连顺",rule:"1–5 或 2–6，五颗不重复：40",max:40},five:{title:"五同",rule:"五颗相同：50",max:50},sixes:{title:"收集六",rule:"所有点数为 6 的骰子相加",max:30},chance:{title:"总和",rule:"五颗骰子的点数全部相加",max:30},
};
export const diceCombinationsLevels:DiceLevel[]=[
 {title:"留住一对",categories:["triple","chance"],target:32,rounds:[[[2,2,1,4,6],[5,1,2,2,3],[1,4,2,6,2]],[[1,2,3,4,5],[6,6,4,5,6],[2,2,6,6,1]]],lesson:"先保留已有的一对，把其他骰子按固定序列重投，凑成三同。下一轮再为总和保留大点数。"},
 {title:"及时记分",categories:["pair","chance"],target:36,rounds:[[[6,1,2,3,4],[2,6,3,4,5],[1,2,6,5,6]],[[5,5,5,5,4],[1,2,1,2,1],[2,1,2,1,2]]],lesson:"骰子够用了就能立即记分，不必耗尽三次机会。保住两颗 6，并把下一轮现成的高总和留下。"},
 {title:"修补顺子",categories:["straight","chance"],target:55,rounds:[[[1,2,3,3,6],[6,6,6,4,5],[2,2,2,1,1]],[[1,2,3,4,5],[2,2,2,2,2],[1,1,1,1,1]]],lesson:"顺子需要五个不重复的连续点数。留下 1、2、3，只替换重复和多余的骰子。"},
 {title:"两种同点",categories:["house","triple"],target:43,rounds:[[[3,3,5,1,6],[1,1,2,3,5],[2,4,1,1,2]],[[6,6,1,2,3],[1,1,6,4,5],[2,3,1,2,2]]],lesson:"三带二必须恰好是三颗加两颗；五同不算。保留两个不同点数的小组，再分配到合适栏目。"},
 {title:"栏目留给谁",categories:["pair","straight"],target:52,rounds:[[[1,2,3,4,5],[2,2,2,2,2],[1,1,1,1,1]],[[6,6,2,4,1],[1,2,3,3,2],[3,1,4,4,3]]],lesson:"每个栏目整课只能记一次。当前现成的顺子应留给五连顺，下一轮的两颗 6 再填一对。"},
 {title:"三轮分工",categories:["sixes","four","chance"],target:68,rounds:[[[6,6,1,2,3],[1,1,6,6,6],[2,3,1,1,2]],[[4,4,4,1,6],[1,1,1,4,3],[2,2,2,1,1]],[[6,5,4,4,3],[1,1,1,1,1],[2,2,2,2,2]]],lesson:"三轮各有优势：收集六、四同与总和。不要把珍贵的栏目过早用在低分组合上。"},
 {title:"成组保留",categories:["five","house","chance"],target:95,rounds:[[[5,5,2,3,4],[1,1,5,5,5],[2,2,1,1,1]],[[2,2,4,4,6],[6,6,6,6,4],[1,1,1,1,1]],[[4,4,4,4,4],[1,1,1,1,1],[2,2,2,2,2]]],lesson:"同样是保留，有时留两颗扩展成五同，有时留四颗只补最后一颗。选择取决于本轮应填的栏目。"},
 {title:"组合花束",categories:["straight","house","chance"],target:94,rounds:[[[2,3,4,1,1],[1,1,1,5,6],[1,1,1,1,1]],[[4,4,6,2,1],[1,1,1,4,6],[1,1,1,1,1]],[[6,2,5,1,4],[1,6,1,6,6],[3,2,6,1,4]]],lesson:"把顺子、三带二与大总和分配到三轮。最后可保住四颗 6，继续修补第五颗；每个选择都能提前规划。"},
];
export function diceScore(category:DiceCategory,dice:number[]):number{const counts=Array.from({length:7},(_,rank)=>dice.filter(d=>d===rank).length),sum=dice.reduce((a,b)=>a+b,0);switch(category){case"chance":return sum;case"sixes":return counts[6]*6;case"house":return counts.includes(3)&&counts.includes(2)?25:0;case"straight":return new Set(dice).size===5&&Math.max(...dice)-Math.min(...dice)===4?40:0;case"five":return counts.includes(5)?50:0;default:{const n=category==="pair"?2:category==="triple"?3:4;for(let r=6;r>=1;r--)if(counts[r]>=n)return r*n;return 0;}}}
export const diceInitial=(level:DiceLevel):DiceState=>({round:0,roll:0,dice:[...level.rounds[0][0]],held:0,scores:{}});
export const diceTotal=(state:DiceState)=>Object.values(state.scores).reduce((sum,value)=>sum+(value??0),0);
export const diceFinished=(level:DiceLevel,state:DiceState)=>level.categories.every(c=>state.scores[c]!==undefined);
export const diceWon=(level:DiceLevel,state:DiceState)=>diceFinished(level,state)&&diceTotal(state)>=level.target;
export function diceMove(level:DiceLevel,state:DiceState,action:DiceAction):DiceState|null{
 if(diceFinished(level,state))return null;
 if(action.kind==="hold"){if(!Number.isInteger(action.index)||action.index<0||action.index>=5||state.roll>=2)return null;return{...state,held:state.held^(1<<action.index)};}
 if(action.kind==="roll"){if(state.roll>=2||state.held===31)return null;return{...state,roll:state.roll+1,dice:state.dice.map((d,i)=>state.held&(1<<i)?d:level.rounds[state.round][state.roll+1][i])};}
 if(!level.categories.includes(action.category)||state.scores[action.category]!==undefined)return null;
 const scores={...state.scores,[action.category]:diceScore(action.category,state.dice)},round=state.round+1;
 return round>=level.rounds.length?{...state,round,scores,held:0}:{round,roll:0,dice:[...level.rounds[round][0]],held:0,scores};
}
export type DiceAdvice={category:DiceCategory|null;holdMask:number|null;total:number;text:string};
// At most three categories, three rounds, two rerolls, and 31 masks per reroll.
// Search is over this finite disclosed training table, not random probabilities.
export function diceHint(level:DiceLevel,state:DiceState):DiceAdvice{
 if(diceFinished(level,state))return{category:null,holdMask:null,total:diceTotal(state),text:diceWon(level,state)?"已达到目标，全部栏目已填完。":"本课栏目已填完但总分不足。可以撤销最后一次记分，重新分配或重投。"};
 type Plan={score:number;masks:number[]};const cache=new Map<string,Plan>();
 function best(round:number,roll:number,dice:number[],category:DiceCategory):Plan{
  const key=`${round}/${roll}/${dice.join("")}/${category}`,cached=cache.get(key);if(cached)return cached;
  let result:Plan={score:diceScore(category,dice),masks:[]};
  if(roll<2&&result.score<diceCategoryInfo[category].max)for(let mask=0;mask<31;mask++){
   const next=dice.map((d,i)=>mask&(1<<i)?d:level.rounds[round][roll+1][i]),tail=best(round,roll+1,next,category);
   if(tail.score>result.score)result={score:tail.score,masks:[mask,...tail.masks]};
   if(result.score===diceCategoryInfo[category].max)break;
  }
  cache.set(key,result);return result;
 }
 const futureCache=new Map<string,number>();
 function future(round:number,left:DiceCategory[]):number{if(!left.length)return 0;const key=`${round}/${left.join(",")}`,cached=futureCache.get(key);if(cached!==undefined)return cached;let high=0;for(const category of left){const value=best(round,0,level.rounds[round][0],category).score+future(round+1,left.filter(c=>c!==category));high=Math.max(high,value);}futureCache.set(key,high);return high;}
 const left=level.categories.filter(c=>state.scores[c]===undefined);let chosen=left[0],plan:Plan={score:-1,masks:[]},reachable=-1;
 for(const category of left){const candidate=best(state.round,state.roll,state.dice,category),value=candidate.score+future(state.round+1,left.filter(c=>c!==category));if(value>reachable){reachable=value;chosen=category;plan=candidate;}}
 const total=diceTotal(state)+reachable;if(total<level.target)return{category:null,holdMask:null,total,text:`按当前固定序列，最高可达 ${total} 分，低于目标 ${level.target}。建议撤销更早的记分或重投。`};
 if(plan.masks.length){const holdMask=plan.masks[0],names=Array.from({length:5},(_,i)=>i).filter(i=>holdMask&(1<<i)).map(i=>i+1);return{category:null,holdMask,total,text:`当前最高可达 ${total} 分。先${names.length?`只保留第 ${names.join("、")} 颗`:"取消所有保留"}，再重投；为“${diceCategoryInfo[chosen].title}”准备组合。`};}
 return{category:chosen,holdMask:null,total,text:`当前最高可达 ${total} 分。现在把 ${plan.score} 分记入“${diceCategoryInfo[chosen].title}”，把其他栏目留给后面的轮次。`};
}
