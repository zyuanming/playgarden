// SPDX-License-Identifier: GPL-3.0-only
export const PACKING_SAVE = 'playgarden.voxel-packing.v1';
export type Cube = readonly [number, number, number];
export type Axis = 'X' | 'Y' | 'Z';
export type Packing = { id: string; title: string; width: number; depth: number; height: number; fixed: readonly Cube[]; pieces: readonly (readonly Cube[])[] };
export type Drop = { piece: number; orientation: string; column: number; row: number };
export type Placement = Drop & { cells: Cube[]; mask: number; landing: number };
export type Layout = ReturnType<typeof preparePacking>;
export const shapeKey = (cells: readonly Cube[]) => cells.map(c => c.join(',')).sort().join(';');
function normalize(cells: readonly Cube[]): Cube[] {
  const min = [0, 1, 2].map(i => Math.min(...cells.map(c => c[i])));
  return cells.map(([x, y, z]) => [x - min[0], y - min[1], z - min[2]]);
}
export function rotate(cells: readonly Cube[], axis: Axis): Cube[] {
  return normalize(cells.map(([x,y,z]) => axis === 'X' ? [x,-z,y] : axis === 'Y' ? [z,y,-x] : [-y,x,z]));
}
export function rotations(cells: readonly Cube[]): Cube[][] {
  const queue = [normalize(cells)], known = new Set([shapeKey(queue[0])]);
  for (let n = 0; n < queue.length; n++) for (const axis of ['X','Y','Z'] as const) {
    const next = rotate(queue[n], axis), key = shapeKey(next);
    if (!known.has(key)) { known.add(key); queue.push(next); }
  }
  return queue;
}
const area = (p: Packing) => p.width * p.depth;
export const cellBit = (p: Packing, [x,y,z]: Cube) => 1 << (z * area(p) + y * p.width + x);
const boxMask = (p: Packing) => (1 << (area(p) * p.height)) - 1;
export const bits = (mask: number) => mask.toString(2).replaceAll('0','').length;
type Slot = Drop & { local: readonly Cube[] };
export function preparePacking(p: Packing) {
  const choices = p.pieces.map(c => rotations(c).map(local => ({ local, key: shapeKey(local) })));
  const slots: Slot[][] = choices.map((family, piece) => family.flatMap(({local,key}) => {
    const w = 1 + Math.max(...local.map(c=>c[0])), d = 1 + Math.max(...local.map(c=>c[1]));
    if (local.some(c=>c[2]>=p.height)) return [];
    return Array.from({length:Math.max(0,p.depth-d+1)},(_,row) =>
      Array.from({length:Math.max(0,p.width-w+1)},(_,column) => ({piece,orientation:key,column,row,local}))).flat();
  }));
  return {p,choices,slots, fixed:p.fixed.reduce((m,c)=>m|cellBit(p,c),0), full:boxMask(p), all:(1<<p.pieces.length)-1};
}
function tops(p:Packing, mask:number) {
  const a = area(p), out = Array<number>(a).fill(-1);
  for(let z=0;z<p.height;z++) for(let i=0;i<a;i++) if(mask & 1<<(z*a+i)) out[i]=z;
  return out;
}
function maskFor(p:Packing, top:number[], s:Slot) {
  let landing=0, mask=0;
  for(const [x,y,z] of s.local)
    landing=Math.max(landing,top[(y+s.row)*p.width+x+s.column]+1-z);
  for(const [x,y,z] of s.local) {
    if(z+landing>=p.height) return {landing,mask:0};
    mask|=1 << ((z+landing)*area(p)+(y+s.row)*p.width+x+s.column);
  }
  return {landing,mask};
}
export function inspectDrop(l:Layout, occ:number, move:Drop) {
  const shape=l.choices[move.piece]?.find(o=>o.key===move.orientation);
  if(!shape || !Number.isInteger(move.column) || !Number.isInteger(move.row) ||
     shape.local.some(([x,y])=>x+move.column<0||x+move.column>=l.p.width||y+move.row<0||y+move.row>=l.p.depth))
    return {kind:'wall'} as const;
  const slot={...move,local:shape.local};
  const {landing,mask}=maskFor(l.p,tops(l.p,occ),slot);
  const cells=shape.local.map(([x,y,z])=>[x+move.column,y+move.row,z+landing] as Cube);
  return {kind:mask?'ok':'rim',landing,mask,cells} as const;
}
export function sealed(p:Packing, mask:number) {
  // Removing a cube above a cavity is not a legal future move.
  const a=area(p), cross=(1<<a)-1;
  for(let z=1;z<p.height;z++) if(((mask>>(z*a))&cross)&~(mask>>((z-1)*a))) return true;
  return false;
}
export function getPackingHint(l:Layout, occupied:number, used:number, cap=150000) {
  const gone=new Set<number>(); let visited=0;
  const vol=area(l.p)*l.p.height, room=2**vol;
  // A deterministic bound on attempted landings as well as entered states.
  function search(mask:number, pieces:number): Drop|boolean|'budget' {
    if (pieces===l.all) return mask===l.full;
    if (sealed(l.p,mask)) return false;
    const key=pieces*room+mask;
    if(gone.has(key)) return false;
    const top=tops(l.p,mask);
    for(let i=0;i<l.p.pieces.length;i++) if(!(pieces & 1<<i)) {
      for(const s of l.slots[i]) {
        if(++visited>cap) return 'budget';
        const {mask:m}=maskFor(l.p,top,s);
        if(!m) continue;
        const rest=search(mask|m,pieces|1<<i);
        if(rest==='budget') return rest;
        if(rest) return {piece:s.piece,orientation:s.orientation,column:s.column,row:s.row};
      }
    }
    gone.add(key); return false;
  }
  const r=search(occupied,used);
  return typeof r==='object' ? {kind:'move',move:r} as const
    : r==='budget' ? {kind:'budget'} as const : {kind:'none'} as const;
}
export function replay(l:Layout, raw:string|null): Placement[] {
  try {
    const value=JSON.parse(raw??'null');
    if(value?.id!==l.p.id||!Array.isArray(value.moves)||value.moves.length>l.p.pieces.length) return [];
    const list:Placement[]=[]; let used=0, occ=l.fixed;
    for(const move of value.moves) {
      if(!move||!Number.isInteger(move.piece)||move.piece<0||move.piece>=l.p.pieces.length||used&1<<move.piece) return [];
      const preview=inspectDrop(l,occ,move);
      if(preview.kind!=='ok') return [];
      list.push({piece:move.piece,orientation:move.orientation,column:move.column,row:move.row,...preview});
      used|=1<<move.piece; occ|=preview.mask;
    }
    return list;
  } catch { return []; }
}
