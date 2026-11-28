// SPDX-License-Identifier: GPL-3.0-only
export const ingredients = ["果露","茶汤","清水"] as const;
export type RecipeOrder = { topUp: number[]; ratio: number[]; volumes: number[] };
export type RecipeBoard = { id: string; title: string; scoopUnits: number; stock: number[]; orders: RecipeOrder[] };
export type Pour = { mix: number[]; scoops: number[] };
export const sum = (v: number[]) => v.reduce((a,b)=>a+b,0);
const gcd = (a: number,b: number): number => b ? gcd(b,a%b) : a;
export function ratioLabel(v: number[]) {
  const d=v.reduce(gcd,0);
  return d ? v.map(n=>n/d).join(":") : "—";
}
export function measure(board: RecipeBoard, pour: Pour) {
  const stock = board.stock.map((stock,i)=>stock-pour.mix[i]*sum(pour.scoops));
  const ready = sum(pour.mix)===board.scoopUnits;
  const orders = board.orders.map((order,i)=>{
    const actual = order.topUp.map((n,j)=>n+pour.scoops[i]*pour.mix[j]);
    const total = sum(actual);
    const ratioOK = total>0 && actual.every((n,j)=>n*sum(order.ratio)===order.ratio[j]*total);
    return {actual,total,ratioOK,volumeOK:order.volumes.includes(total)};
  });
  return {stock,ready,orders,pass:ready && stock.every(n=>n>=0) && orders.every(o=>o.ratioOK && o.volumeOK)};
}
