// SPDX-License-Identifier: GPL-3.0-only
// Original implementation of the mathematical Chomp rules; no imported source or levels.
export type ChompMove = {row:number;col:number};
export type ChompLesson = {title:string;shape:number[];tip:string};
export const chompGardenLevels:ChompLesson[]=[
 {title:'留下一颗苦杏仁',shape:[2,2],tip:'一口可以拿走一个矩形。设法让对方只剩左下角。'},
 {title:'长边的节奏',shape:[3,3],tip:'观察横向和纵向的剩余长度，不要只想着多吃。'},
 {title:'细长饼干',shape:[4,4],tip:'很大的一口不一定有利。先找能让对方无好棋的形状。'},
 {title:'方形缺角',shape:[3,3,3],tip:'方形的两条边可以相互照应，留意对称的阶梯。'},
 {title:'三层茶点',shape:[4,4,4],tip:'每一口都能同时改变几层。比较下一轮的选择。'},
 {title:'远端诱惑',shape:[5,5,5],tip:'饼干变宽了，但胜负仍取决于留给对手的形状。'},
 {title:'双向台阶',shape:[4,4,4,4],tip:'从当前形状重新判断，不要机械重复上一关的第一口。'},
 {title:'最后的下午茶',shape:[5,5,5,5],tip:'完整小棋盘搜索会认真回击。把最后一颗苦杏仁留给它。'},
];
export function chompMoves(shape:number[],safeOnly=false):ChompMove[]{const moves:ChompMove[]=[];shape.forEach((n,row)=>{for(let col=0;col<n;col++)if(!safeOnly||row!==shape.length-1||col!==0)moves.push({row,col});});return moves;}
export function chompBite(shape:number[],{row,col}:ChompMove){if(!Number.isInteger(row)||!Number.isInteger(col)||row<0||row>=shape.length||col<0||col>=shape[row])return [...shape];return shape.map((n,r)=>r<=row?Math.min(n,col):n);}
const memo=new Map<string,boolean>();
export function chompWinning(shape:number[]):boolean{const key=shape.join(',');const known=memo.get(key);if(known!==undefined)return known;const result=chompMoves(shape,true).some(move=>!chompWinning(chompBite(shape,move)));memo.set(key,result);return result;}
export function chompBest(shape:number[]):ChompMove|null{const moves=chompMoves(shape,true);return moves.find(move=>!chompWinning(chompBite(shape,move)))??moves[0]??null;}
export const chompPoison=(shape:number[],move:ChompMove)=>move.row===shape.length-1&&move.col===0;
