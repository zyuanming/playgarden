// SPDX-License-Identifier: GPL-3.0-only
// Original small tactical positions; independently implemented pawn-only play.
export type HexSide="green"|"brown";
export type HexPiece=HexSide|null;
export type HexMove={from:number;to:number};
export type HexLevel={title:string;size:3|4;green:number[];brown:number[];lesson:string};
export type HexState={board:HexPiece[];winner:HexSide|null;lastGreen:HexMove|null;lastBrown:HexMove|null};
export const hexapawnLevels:HexLevel[]=[
 {title:"先走空格",size:3,green:[6],brown:[2],lesson:"绿色向上，棕色向下。前方为空才能直走一格；先到对岸的一方立刻获胜。"},
 {title:"拦住冲线",size:3,green:[7],brown:[3,2],lesson:"左侧对手下一步就能冲线。用斜吃处理眼前威胁，再向对岸前进；直走不能吃子。"},
 {title:"直挡斜吃",size:4,green:[9],brown:[5,6],lesson:"正前方有对手时不能直走。斜前方有对手才可以吃；吃掉侧面的棋子，就能绕过正面的阻挡。"},
 {title:"封锁取胜",size:3,green:[3,8],brown:[0,2],lesson:"不一定要冲到终点。把双方同列堵住，并让对手轮到走时没有合法着法，也能取胜。"},
 {title:"双兵护航",size:3,green:[6,7],brown:[1,2],lesson:"先推进边兵，后面的同伴可以斜着回吃。不要只看一枚棋子，观察两枚绿色小兵的接应关系。"},
 {title:"留兵防守",size:4,green:[12,13],brown:[3,6],lesson:"对手的中路兵已走得更远。先推进边兵，把另一枚留下来拦截冲线威胁；一味一起直冲会输。"},
 {title:"先解前线",size:4,green:[9,12],brown:[4,5],lesson:"前线小兵被正面堵住，却有斜吃的出口。先解除前线压力，别急着推进后排小兵。"},
 {title:"接力换子",size:3,green:[6,7,8],brown:[0,2],lesson:"把中兵送到交汇点，让两侧同伴接力回吃。每次交换后重新检查对方的回应；冲线或让对手无棋可走都算胜。"},
];
export const hexOther=(side:HexSide):HexSide=>side==="green"?"brown":"green";
export function hexMoves(board:HexPiece[],size:number,side:HexSide):HexMove[]{
 const moves:HexMove[]=[],dr=side==="green"?-1:1;
 for(let from=0;from<board.length;from++){if(board[from]!==side)continue;const row=Math.floor(from/size),col=from%size,nextRow=row+dr;if(nextRow<0||nextRow>=size)continue;
  // Stable tie order: captures left/right, then a quiet forward step.
  for(const dc of [-1,1]){const c=col+dc,to=nextRow*size+c;if(c>=0&&c<size&&board[to]===hexOther(side))moves.push({from,to});}
  const to=nextRow*size+col;if(board[to]===null)moves.push({from,to});
 }
 return moves;
}
export function hexAfter(board:HexPiece[],move:HexMove):HexPiece[]{const next=[...board];next[move.to]=next[move.from];next[move.from]=null;return next;}
export function hexWinner(board:HexPiece[],size:number,toMove:HexSide):HexSide|null{
 if(board.slice(0,size).includes("green"))return"green";
 if(board.slice(-size).includes("brown"))return"brown";
 return hexMoves(board,size,toMove).length===0?hexOther(toMove):null;
}
export function hexInitial(level:HexLevel):HexState{const board:HexPiece[]=Array(level.size*level.size).fill(null);level.green.forEach(i=>board[i]="green");level.brown.forEach(i=>board[i]="brown");return{board,winner:hexWinner(board,level.size,"green"),lastGreen:null,lastBrown:null};}
export type HexEvaluation={winner:HexSide;plies:number;move:HexMove|null};
const evaluations=new Map<string,HexEvaluation>();
// Exact minimax, without heuristics or a time cutoff. All moves strictly reduce
// total forward distance; these authored 3x3/4x4 positions have at most five pawns.
export function hexEvaluate(board:HexPiece[],size:number,side:HexSide):HexEvaluation{
 const key=`${size}/${side}/${board.map(p=>p==="green"?"g":p==="brown"?"b":".").join("")}`,cached=evaluations.get(key);if(cached)return cached;
 const winner=hexWinner(board,size,side);if(winner){const result={winner,plies:0,move:null};evaluations.set(key,result);return result;}
 let best:HexEvaluation|null=null;
 for(const move of hexMoves(board,size,side)){const tail=hexEvaluate(hexAfter(board,move),size,hexOther(side)),candidate={winner:tail.winner,plies:tail.plies+1,move};
  if(!best||(candidate.winner===side&&best.winner!==side)||(candidate.winner===best.winner&&(candidate.winner===side?candidate.plies<best.plies:candidate.plies>best.plies)))best=candidate;
 }
 evaluations.set(key,best!);return best!;
}
export function hexPlayTurn(level:HexLevel,state:HexState,move:HexMove):HexState|null{
 if(state.winner||!hexMoves(state.board,level.size,"green").some(m=>m.from===move.from&&m.to===move.to))return null;
 let board=hexAfter(state.board,move),winner=hexWinner(board,level.size,"brown");if(winner)return{board,winner,lastGreen:move,lastBrown:null};
 const reply=hexEvaluate(board,level.size,"brown").move!;board=hexAfter(board,reply);winner=hexWinner(board,level.size,"green");return{board,winner,lastGreen:move,lastBrown:reply};
}
export const hexSquare=(cell:number,size:number)=>`${String.fromCharCode(65+cell%size)}${size-Math.floor(cell/size)}`;
export function hexHint(level:HexLevel,state:HexState):{move:HexMove|null;text:string}{
 if(state.winner)return{move:null,text:state.winner==="green"?"绿色已获胜。":"棕色已获胜。可撤销整轮，重新选择绿色的着法。"};
 const result=hexEvaluate(state.board,level.size,"green"),move=result.move!;
 return{move,text:result.winner==="green"?`当前有强制获胜路线：先从 ${hexSquare(move.from,level.size)} 走到 ${hexSquare(move.to,level.size)}。对手最佳应对下，最多还需 ${result.plies} 个双方半步。`:`当前对手正确应对时会赢。可撤销上一轮；若继续，${hexSquare(move.from,level.size)} → ${hexSquare(move.to,level.size)} 能尽量延长抵抗。`};
}
