// SPDX-License-Identifier: GPL-3.0-only
export const EQUATION_SAVE='playgarden.equation-balance.v1';
export type Terms=readonly [number,number,number,number];
export type Card={id:string;op:'x'|'unit'|'mul'|'div';amount:number};
export type EquationLevel={id:string;title:string;initial:Terms;cards:readonly Card[];budget:number};
type Branch={terms:Terms;used:number;history:string[]};
export const solved=([a,b,c]:Terms)=>a===1&&b===0&&c===0;
const minus='−';
export const signed=(n:number)=>n<0?minus+Math.abs(n):String(n);
export const cardLabel=(c:Card)=>c.op==='mul'?'× '+c.amount:c.op==='div'?'÷ '+c.amount
  :(c.amount<0?minus:'+')+' '+Math.abs(c.amount)+(c.op==='x'?'x':'');
export function side(a:number,b:number){
  if(!a)return signed(b);
  const x=(a<0?minus:'')+(Math.abs(a)===1?'':Math.abs(a))+'x';
  return b?x+' '+(b<0?minus:'+')+' '+Math.abs(b):x;
}
export const show=([a,b,c,d]:Terms)=>side(a,b)+' = '+side(c,d);
export function applyCard(t:Terms,card:Card):{terms:Terms}|{blocked:string}{
  const [a,b,c,d]=t,n=card.amount;
  if(card.op==='x')return {terms:[a+n,b,c+n,d]};
  if(card.op==='unit')return {terms:[a,b+n,c,d+n]};
  if(card.op==='mul')return {terms:[a*n,b*n,c*n,d*n]};
  const i=t.findIndex(v=>v%n!==0);
  if(i>=0){
    const what=i%2===0?'枚 x 片':'枚单位片',where=i<2?'左盘':'右盘';
    return {blocked:where+'的 '+signed(t[i])+' '+what+'不能分成 '+n+' 个整数等组。'};
  }
  return {terms:[a/n,b/n,c/n,d/n]};
}
export function replay(level:EquationLevel, history:readonly string[]):Branch|null{
  if(history.length>level.budget)return null;
  let terms=level.initial,used=0;
  for(const id of history){
    const i=level.cards.findIndex(c=>c.id===id);
    if(i<0||(used&1<<i)||solved(terms))return null;
    const r=applyCard(terms,level.cards[i]);
    if('blocked' in r)return null;
    used|=1<<i;terms=r.terms;
  }
  return {terms,used,history:[...history]};
}
export function readEquation(level:EquationLevel,raw:string|null){
  try {
    const value=JSON.parse(raw??'null');
    if(value?.id===level.id&&Array.isArray(value.history)&&replay(level,value.history))return value.history as string[];
  }catch{/* Start a clean round. */}
  return [];
}
export function routeFrom(level:EquationLevel,state:Branch):string[]|null{
  function search(t:Terms,mask:number,remaining:number):string[]|null{
    if(solved(t))return [];
    if(!remaining)return null;
    for(let i=0;i<level.cards.length;i++){
      if(mask&1<<i)continue;
      const r=applyCard(t,level.cards[i]);
      if('blocked'in r)continue;
      const tail=search(r.terms,mask|1<<i,remaining-1);
      if(tail)return [level.cards[i].id,...tail];
    }
    return null;
  }
  return search(state.terms,state.used,level.budget-state.history.length);
}
