// Adapted from Hexahedral, Copyright (c) 2018 Matthew Miner, MIT.
// The complete MIT license and exact upstream source are in vendor/hexahedral-original.
import type {HexahedralLevel} from '../games/hexahedralLevels';
export type HexahedralRound={cursor:number;tiles:string;history:number[];result:'playing'|'won'|'lost'};
export const freshHexahedral=(level:HexahedralLevel):HexahedralRound=>({cursor:level.start,tiles:level.rows.join(''),history:[],result:'playing'});
export function adjacentHexahedral(level:HexahedralLevel,from:number,to:number){const n=level.rows.length;return Number.isInteger(to)&&to>=0&&to<n*n&&Math.abs(Math.floor(from/n)-Math.floor(to/n))+Math.abs(from%n-to%n)===1;}
export function stepHexahedral(level:HexahedralLevel,current:HexahedralRound,to:number):HexahedralRound{
 if(current.result!=='playing'||!adjacentHexahedral(level,current.cursor,to)||current.tiles[to]==='x')return current;
 const cells=current.tiles.split('');cells[to]=cells[to]==='0'?'_':'0';const history=[...current.history,to];
 // The original checks victory before move exhaustion, so a win on the final
 // allowed move succeeds. The initial square is not automatically toggled.
 return{cursor:to,tiles:cells.join(''),history,result:!cells.includes('0')?'won':history.length>=level.maxMoves?'lost':'playing'};
}
export const hexahedralKey=(level:HexahedralLevel)=>'playgarden.hexahedral.v1.'+level.id;
export function loadHexahedral(level:HexahedralLevel){const fresh=freshHexahedral(level);try{const raw=localStorage.getItem(hexahedralKey(level));if(!raw||raw.length>4096)return fresh;const d=JSON.parse(raw);if(d.version!==1||d.id!==level.id||!Array.isArray(d.history)||d.history.length>level.maxMoves)return fresh;let s=fresh;for(const p of d.history){const next=stepHexahedral(level,s,p);if(next===s)return fresh;s=next;}return s;}catch{return fresh;}}
export function saveHexahedral(level:HexahedralLevel,round:HexahedralRound){try{localStorage.setItem(hexahedralKey(level),JSON.stringify({version:1,id:level.id,history:round.history}));return true;}catch{return false;}}
