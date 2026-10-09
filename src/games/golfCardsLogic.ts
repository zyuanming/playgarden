// SPDX-License-Identifier: GPL-3.0-only
// Original open-information miniature Golf solitaire teaching deals.
export type GolfLevel = { title:string; columns:number[][]; waste:number; stock:number[]; lesson:string };
export type GolfState = { heights:number[]; waste:number; stockIndex:number };
export type GolfAction = { kind:"play"; column:number } | { kind:"draw" };
export const golfCardsLevels:GolfLevel[] = [
 {title:"一步之差",columns:[[6,5],[4,5],[2,3]],waste:4,stock:[8],lesson:"只看废牌与牌列最下方的点数差。选走 5 后，先沿着同一列继续到 6，再回头下行。"},
 {title:"折返小径",columns:[[5,6],[7,6],[9,8]],waste:7,stock:[3],lesson:"方向可以在任何一步改变。下行到 5，再沿另一列的 6、7 转向上行，牌列位置不限制你。"},
 {title:"交错解锁",columns:[[6,4],[4,3],[7,5]],waste:5,stock:[10],lesson:"底牌会遮住同列更上方的牌。交替清理不同的列，让下一张正好接上当前废牌。"},
 {title:"边界不相连",columns:[[11,12],[2,1],[4,3]],waste:13,stock:[2],lesson:"K 只能接 Q，A 只能接 2；K 和 A 不循环相连。有限的储备牌可以把路径接到低点数区。"},
 {title:"跨过断桥",columns:[[5,4],[8,7],[10,9]],waste:3,stock:[11,6],lesson:"翻牌会替换废牌，原来的点数不能回用。先走完眼前的一段，再使用储备牌跨过缺失的点数。"},
 {title:"双七岔路",columns:[[8,7],[4,5],[6,7],[2,3]],waste:6,stock:[10],lesson:"两个相同的 7 打开不同后续。先看看各自背后的点数，选能让所有列相互接力的方向。"},
 {title:"四列接力",columns:[[3,4,5],[4,5,6],[5,6,7],[6,2,3]],waste:4,stock:[9,7],lesson:"每列加深到三张。先打开高处的折返，再留住能连接低点数的一列；不必把储备牌用完。"},
 {title:"双岸长廊",columns:[[1,12,11],[2,11,12],[3,10,13],[4,2,3]],waste:10,stock:[4,9],lesson:"先让 J、Q、K 交错接力，再用一次恰好的翻牌进入低点数区。最后一列还藏着回程的出口。"},
];
export const golfRank=(rank:number)=>rank===1?"A":rank===11?"J":rank===12?"Q":rank===13?"K":String(rank);
export const golfInitial=(level:GolfLevel):GolfState=>({heights:level.columns.map(c=>c.length),waste:level.waste,stockIndex:0});
export const golfWon=(state:GolfState)=>state.heights.every(h=>h===0);
export function golfActions(level:GolfLevel,state:GolfState):GolfAction[]{
 if(golfWon(state))return[];const result:GolfAction[]=[];
 level.columns.forEach((column,c)=>{const h=state.heights[c];if(h>0&&Math.abs(column[h-1]-state.waste)===1)result.push({kind:"play",column:c});});
 if(state.stockIndex<level.stock.length)result.push({kind:"draw"});return result;
}
export function golfMove(level:GolfLevel,state:GolfState,action:GolfAction):GolfState|null{
 if(!golfActions(level,state).some(a=>a.kind===action.kind&&(a.kind==="draw"||(action.kind==="play"&&a.column===action.column))))return null;
 if(action.kind==="draw")return{...state,waste:level.stock[state.stockIndex],stockIndex:state.stockIndex+1};
 const heights=[...state.heights];heights[action.column]--;return{...state,heights,waste:level.columns[action.column][heights[action.column]]};
}
export function golfHint(level:GolfLevel,start:GolfState):{action:GolfAction|null;text:string}{
 let visits=0,capped=false;const failed=new Set<string>();
 function find(state:GolfState):GolfAction[]|null{if(golfWon(state))return[];if(++visits>30000){capped=true;return null;}const key=`${state.heights.join(",")}/${state.waste}/${state.stockIndex}`;if(failed.has(key))return null;for(const action of golfActions(level,state)){const tail=find(golfMove(level,state,action)!);if(tail)return[action,...tail];if(capped)return null;}failed.add(key);return null;}
 const path=find(start),action=path?.[0]??null;
 return{action,text:action?action.kind==="draw"?`有完整清场路线：翻出储备牌 ${golfRank(level.stock[start.stockIndex])}，替换当前废牌。`:`有完整清场路线：取第 ${action.column+1} 列底牌 ${golfRank(level.columns[action.column][start.heights[action.column]-1])}。`:golfWon(start)?"所有牌列已清空。":capped?"提示达到本次搜索上限，未判断无解。请观察底牌或撤销。":"当前已没有清空所有牌列的路线。撤销或重来，再考虑不同的取牌、翻牌顺序。"};
}
