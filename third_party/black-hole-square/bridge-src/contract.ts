// SPDX-License-Identifier: GPL-3.0-only
export const REVISION = 'black-hole-square-8d48aae-playgarden-1';
export const STORAGE = 'playgarden.black-hole-square.native.v1';
export const LEVELS = [
  ['click',4],['wait',5],['push',6],['move',5],['tango',6],['substitute',6],
  ['wander',15],['double',5],['conflict',10],['extract',5],['grab',9],['twin',11],
  ['snare',9],['sink',6],['support',8],['snatch',12],['swivel',14],['turmoil',20],
] as const;
export type NativeData = { current: number; solved: string[]; solutions: Record<string,string[]> };
export type Summary = { current:number; puzzle:string; frames:number; time:number; paused:boolean; settled:boolean;
  moves:number; budget:number; feedback:string; solved:string[]; saved:boolean; ending:boolean; allSolved:boolean };
export const emptyData = (): NativeData => ({current:0,solved:[],solutions:{}});
export const copyData = (data:NativeData):NativeData => ({current:data.current,solved:[...data.solved],
  solutions:Object.fromEntries(Object.entries(data.solutions).map(([id,values])=>[id,[...values]]))});
export function parseData(value:unknown):NativeData|null {
  if (!value || typeof value!=='object' || Array.isArray(value)) return null;
  const v=value as NativeData;
  if (!Number.isInteger(v.current) || v.current<0 || v.current>20 || !Array.isArray(v.solved) || v.solved.length>18 ||
      !v.solved.every(id=>typeof id==='string'&&LEVELS.some(l=>l[0]===id)) || new Set(v.solved).size!==v.solved.length ||
      !v.solutions || typeof v.solutions!=='object' || Array.isArray(v.solutions) || Object.keys(v.solutions).length>18) return null;
  for (const [id,values] of Object.entries(v.solutions)) {
    const level=LEVELS.find(l=>l[0]===id);
    if (!level || !Array.isArray(values) || values.length>64 || !v.solved.includes(id)) return null;
    for (const text of values) {
      if (typeof text!=='string' || text.length>100) return null;
      try { const cells:unknown=JSON.parse(text); if (!Array.isArray(cells) || !cells.length || cells.length>level[1] ||
          !cells.every(i=>Number.isInteger(i)&&i>=0&&i<36)) return null; }
      catch { return null; }
    }
  }
  return copyData(v);
}
export function parseSummary(value:unknown):Summary|null {
  if (!value || typeof value!=='object') return null;
  const s=value as Summary;
  if (!Number.isInteger(s.current)||s.current<0||s.current>20 || typeof s.puzzle!=='string' ||
      !Number.isInteger(s.frames)||s.frames<0||!Number.isFinite(s.time)||s.time<0||
      !Number.isInteger(s.moves)||s.moves<0||s.moves>20||!Number.isInteger(s.budget)||s.budget<0||s.budget>20||
      typeof s.feedback!=='string'||s.feedback.length>100||
      !['paused','settled','saved','ending','allSolved'].every(k=>typeof (s as unknown as Record<string,unknown>)[k]==='boolean')||
      !parseData({current:s.current,solved:s.solved,solutions:{}})) return null;
  const expected=s.current===0?'titlescreen':s.current===1?'startscreen':s.current===20?'end':LEVELS[s.current-2][0];
  if(s.puzzle!==expected||s.ending!==(s.current===20)||s.allSolved!==(s.solved.length===18))return null;
  return {...s,solved:[...s.solved]};
}
