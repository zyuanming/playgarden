// SPDX-License-Identifier: GPL-3.0-only
// Adapted from Simon Tatham and contributors' MIT magnets.c: OPPOSITE,
// count_rowcol, check_rowcol and check_completion. See vendor/sgtatham-magnets.
export type MagnetsLevel = {
  id: string; title: string; chapter: number; width: number; height: number;
  dominoes: number[][]; rowPlus: number[]; rowMinus: number[];
  colPlus: number[]; colMinus: number[];
};
// One value per domino: -1 undecided, 0 neutral, 1 first cell +, 2 first cell −.
export const MAGNETS_SAVE = 'playgarden.magnets.v1';
export const oppositePole = (v: number) => (v * 2) % 3;
export const initialMagnets = (p: MagnetsLevel): number[] => p.dominoes.map(() => -1);
export function validMagnetsState(p: MagnetsLevel, state: number[]) {
  return state.length === p.dominoes.length && Array.from(state).every(v => Number.isInteger(v) && v >= -1 && v <= 2);
}
export function magnetCells(p: MagnetsLevel, state: number[]) {
  const cells = Array(p.width * p.height).fill(-1) as number[];
  p.dominoes.forEach(([a,b], d) => {const v = state[d]; cells[a] = v; cells[b] = v < 0 ? -1 : oppositePole(v);});
  return cells;
}
export function inspectMagnets(p: MagnetsLevel, state: number[]) {
  const cells = magnetCells(p, state), conflicts = new Set<number>();
  const malformed = !validMagnetsState(p, state);
  // count_rowcol / check_rowcol: an absent (-1) clue imposes no constraint.
  const line = (ids: number[], pole: number, target: number) => {
    const count = ids.filter(i => cells[i] === pole).length;
    const unknown = ids.filter(i => cells[i] < 0).length;
    const impossible = target >= 0 && (count > target || count + unknown < target);
    if (impossible) ids.forEach(i => conflicts.add(i));
    return { count, target, impossible, exact: target < 0 || count === target };
  };
  const rows = Array.from({length:p.height}, (_,y) => {
    const ids = Array.from({length:p.width}, (_,x) => y*p.width+x);
    return [line(ids,1,p.rowPlus[y]),line(ids,2,p.rowMinus[y])];
  });
  const cols = Array.from({length:p.width}, (_,x) => {
    const ids = Array.from({length:p.height}, (_,y) => y*p.width+x);
    return [line(ids,1,p.colPlus[x]),line(ids,2,p.colMinus[x])];
  });
  // check_completion: all dominoes are explicitly set, and identical non-neutral
  // terminals cannot touch orthogonally (diagonals deliberately do not count).
  cells.forEach((v,i) => { if (v <= 0) return;
    for (const j of [i%p.width+1<p.width ? i+1 : -1,i+p.width<cells.length ? i+p.width : -1])
      if(j>=0 && cells[j]===v) {conflicts.add(i);conflicts.add(j);}
  });
  const missing = state.filter(v=>v<0).length;
  return { cells, rows, cols, conflicts, missing,
    won: !malformed && missing===0 && conflicts.size===0 && [...rows,...cols].every(r=>r.every(c=>c.exact)) };
}
export function changeMagnets(p: MagnetsLevel, state: number[], d: number, v: number) {
  if(!validMagnetsState(p,state) || !Number.isInteger(d) || d<0 || d>=state.length || !Number.isInteger(v) || v< -1 || v>2 || state[d]===v || inspectMagnets(p,state).won) return state;
  const next=[...state];next[d]=v;return next;
}
export function parseMagnetsSave(raw: string|null,p: MagnetsLevel):number[][] {
  const fresh=[initialMagnets(p)]; if(!raw)return fresh;
  try {const x=JSON.parse(raw);if(x.id!==p.id || !Array.isArray(x.history) || x.history.length<1 || x.history.length>2001 || !x.history.every((s:unknown)=>Array.isArray(s)&&validMagnetsState(p,s))) return fresh;
    return x.history;
  }catch{return fresh;}
}
// Bounded paired-domain search. Each domino assignment fixes both poles; local
// count and adjacency checks prune. Does not read any campaign answer.
export function solveMagnets(p: MagnetsLevel, initial: number[], budget=100000): {kind:'solution';state:number[];nodes:number}|{kind:'none'|'budget';nodes:number} {
  let nodes=0, exceeded=false; let answer:number[]|undefined;
  if(!validMagnetsState(p,initial))return {kind:'none',nodes};
  function visit(s:number[]) {
    if(++nodes>budget){exceeded=true;return;}
    const check=inspectMagnets(p,s); if(check.conflicts.size)return;
    if(check.won){answer=s;return;}
    let best=-1, choices:number[]=[];
    for(let d=0;d<s.length;d++)if(s[d]<0){
      const possible=[0,1,2].filter(v=>{const t=[...s];t[d]=v;return !inspectMagnets(p,t).conflicts.size;});
      if(!possible.length)return;
      if(best<0||possible.length<choices.length){best=d;choices=possible;if(possible.length===1)break;}
    }
    if(best<0)return;
    for(const v of choices){const t=[...s];t[best]=v;visit(t);if(answer||exceeded)return;}
  }
  visit([...initial]);return answer ? {kind:'solution',state:answer,nodes} : {kind:exceeded?'budget':'none',nodes};
}
