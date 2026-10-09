// SPDX-License-Identifier: GPL-3.0-only
export type PairTile = {id:number;x:number;y:number;z:number;symbol:number};
export type PairLevel = {title:string;lesson:string;tiles:PairTile[];width:number;height:number};
export const pairSymbols=['梅','竹','兰','菊','月','山','风','雨','云','泉','星','日'];
type Position=[number,number,number];
function row(y:number,width:number,z=0,start=0):Position[]{return Array.from({length:width},(_,x)=>[x+start,y,z]);}
export function tileFree(tile:PairTile,tiles:PairTile[],removed:readonly number[]):boolean{
  const live=tiles.filter(t=>!removed.includes(t.id));
  if(removed.includes(tile.id)||live.some(t=>t.z>tile.z&&Math.abs(t.x-tile.x)<.98&&Math.abs(t.y-tile.y)<.98))return false;
  const side=(dx:number)=>live.some(t=>t.z===tile.z&&t.y===tile.y&&t.x===tile.x+dx);
  return !side(-1)||!side(1);
}
function layout(title:string,lesson:string,positions:Position[]):PairLevel{
  const tiles=positions.map(([x,y,z],id)=>({id,x,y,z,symbol:0}));const removed:number[]=[];let pair=0;
  // Author a solvable arrangement by assigning symbols along a geometric removal order.
  while(removed.length<tiles.length){const free=tiles.filter(t=>tileFree(t,tiles,removed));if(free.length<2)throw new Error('Layer geometry has fewer than two free tiles');const a=free[pair%2?free.length-1:0],b=free[pair%2?Math.floor((free.length-1)/2):free.length-1];a.symbol=pair%pairSymbols.length;b.symbol=a.symbol;removed.push(a.id,b.id);pair++;}
  return {title,lesson,tiles,width:Math.max(...tiles.map(t=>t.x))+1,height:Math.max(...tiles.map(t=>t.y))+1};
}
export const tilePairsLevels:PairLevel[]=[
  layout('两端起步','左右至少有一边空着的牌，才能取走。',[...row(0,4),...row(1,4)]),
  layout('长廊相逢','同样的字未必都能拿；先看看牌的左右两侧。',[...row(0,6),...row(1,6)]),
  layout('小屋屋顶','上方压着牌时不能取，先从屋顶开始。',[...row(0,4),...row(1,4),...row(0,2,1,1),...row(1,2,1,1)]),
  layout('双翼花台','两翼会分别打开新的空边。跨行寻找相同的字。',[...row(0,6),...row(1,4,0,1),...row(2,6),...row(1,2,1,2)]),
  layout('月下长桥','桥上的牌压着下面，取掉上层才能释放底层。',[...row(0,6),...row(1,6),...row(0,4,1,1),...row(1,4,1,1)]),
  layout('三层小塔','一层层解开塔顶，留意刚刚露出的牌。',[...row(0,4),...row(1,4),...row(2,4),...row(0,2,1,1),...row(1,2,1,1),...row(2,2,1,1),...row(1,2,2,1)]),
  layout('错落庭院','相同字可能有四张，选对搭档会影响后面的空间。',[...row(0,6),...row(1,6),...row(2,6),...row(0,4,1,1),...row(2,4,1,1)]),
  layout('山月满庭','上下层与两侧都要看。收空整座牌园才算完成。',[...row(0,6),...row(1,6),...row(2,6),...row(0,4,1,1),...row(1,4,1,1),...row(2,4,1,1),...row(1,2,2,2)]),
];
export function solvePairs(tiles:PairTile[],removed:readonly number[]):[number,number][]|null{
  const seen=new Set<string>();let budget=50000;
  function visit(gone:number[]):[number,number][]|null{
    if(gone.length===tiles.length)return [];
    const key=[...gone].sort((a,b)=>a-b).join(',');if(seen.has(key)||--budget<=0)return null;seen.add(key);
    const free=tiles.filter(t=>tileFree(t,tiles,gone));
    for(let a=0;a<free.length;a++)for(let b=a+1;b<free.length;b++)if(free[a].symbol===free[b].symbol){const pair:[number,number]=[free[a].id,free[b].id];const rest=visit([...gone,...pair]);if(rest)return[pair,...rest];}return null;
  }return visit([...removed]);
}
