// SPDX-License-Identifier: GPL-3.0-only
// Original implementation, move search and tactical position data.
export type MorrisBoard=number[];
export type MorrisMove={from:number;to:number};
export const morrisLines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export function morrisWinner(board:MorrisBoard){for(const line of morrisLines)if(board[line[0]]&&line.every(i=>board[i]===board[line[0]]))return board[line[0]];return 0;}
export function morrisAdjacent(a:number,b:number){return morrisLines.some(line=>{const i=line.indexOf(a),j=line.indexOf(b);return i>=0&&j>=0&&Math.abs(i-j)===1;});}
export function morrisMoves(board:MorrisBoard,player:number):MorrisMove[]{if(morrisWinner(board))return [];const count=board.filter(v=>v===player).length,empty=board.flatMap((v,i)=>v===0?[i]:[]);if(count<3)return empty.map(to=>({from:-1,to}));return board.flatMap((v,from)=>v===player?empty.filter(to=>morrisAdjacent(from,to)).map(to=>({from,to})):[]);}
export function morrisApply(board:MorrisBoard,player:number,move:MorrisMove){if(!morrisMoves(board,player).some(m=>m.from===move.from&&m.to===move.to))return board;const next=[...board];if(move.from>=0)next[move.from]=0;next[move.to]=player;return next;}
export function morrisBest(board:MorrisBoard,player:number,depth=7):{move:MorrisMove|null;score:number}{const memo=new Map<string,number>();function search(b:MorrisBoard,p:number,d:number):number{const winner=morrisWinner(b);if(winner)return winner===p?1000+d:-1000-d;const moves=morrisMoves(b,p);if(!moves.length)return 0;if(!d)return morrisLines.reduce((score,line)=>{const own=line.filter(i=>b[i]===p).length,other=line.filter(i=>b[i]===3-p).length;return score+(other===0?own*own:0)-(own===0?other*other:0);},0);const key=b.join('')+p+d,old=memo.get(key);if(old!==undefined)return old;let best=-Infinity;for(const move of moves){best=Math.max(best,-search(morrisApply(b,p,move),3-p,d-1));if(best>=1000+d-1)break;}memo.set(key,best);return best;}let best=-Infinity,choice:MorrisMove|null=null;for(const move of morrisMoves(board,player)){const score=-search(morrisApply(board,player,move),3-player,depth-1);if(score>best){best=score;choice=move;}}return{move:choice,score:best};}
export type MorrisLesson={title:string;board:MorrisBoard;tip:string};
export const threeMorrisLevels:MorrisLesson[]=[
 {title:'落下第三颗种子',board:[1,1,0,2,0,0,2,0,0],tip:'双方还各有一颗未落。找出能立即排成直线的空点。'},
 {title:'对角线也会开花',board:[1,2,0,0,1,0,2,0,0],tip:'连线包括两条对角线。放子阶段直接点空点即可。'},
 {title:'从中间移开',board:[1,2,0,0,1,2,1,0,2],tip:'三颗子都落下以后，不再增加棋子。沿线移动一格，换一个角度成线。'},
 {title:'边上的转机',board:[1,2,0,0,1,2,2,1,0],tip:'先选自己的棋子，再选与它有连线的相邻空点。不是任意空点都能跳过去。'},
 {title:'先守，再成线',board:[1,0,2,0,2,1,0,1,2],tip:'紫方也在寻找三子成线。认真看它的威胁，再准备下一手。'},
 {title:'中心的调度',board:[2,1,0,2,0,1,1,0,2],tip:'中心连接的路线最多。利用它，让两颗原本分散的棋子互相照应。'},
 {title:'打开另一条路',board:[1,0,2,2,1,2,1,0,0],tip:'先挪开一颗棋子，才能为后面的移动留出空点。'},
 {title:'三手小棋局',board:[1,0,2,1,2,2,0,0,1],tip:'最后的残局要看得更远。连成自己的直线之前，也要挡住紫方。'},
];
