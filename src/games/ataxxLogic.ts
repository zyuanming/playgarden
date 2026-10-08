/* Playgarden modifications: Copyright (c) 2026 YuanMing, GPL-3.0-only.
 * Rule core adapted from kz04px/libataxx, MIT, Copyright (c) 2019 kz04px.
 * Fixed source 4226c26dd11a1f74be708882ece6fd9dc96c767b; see vendor/libataxx/LICENSE.
 * Array-based port of is_legal_move, legal_moves, makemove, gameover and get_result.
 * Unlike upstream's 7x7 bitboard, teaching boards may be 3–7 squares wide.
 */
export type Side = 1 | 2;
export type Cell = -1 | 0 | Side;
export type Move = { from: number; to: number } | null;
export type Position = { size: number; board: Cell[]; turn: Side; quiet: number };
export type Lesson = { id: string; title: string; chapter: number; tip: string; size: number; board: Cell[]; goal: Goal };
export type Goal = { kind: 'move'; mode?: 'clone' | 'jump'; captures: number } | { kind: 'hold'; target: number } | { kind: 'win'; turns: number };
export const ATAXX_SAVE = 'playgarden.ataxx.v1';
export const other = (side: Side): Side => side === 1 ? 2 : 1;
export const distance = (a: number, b: number, size: number) => Math.max(Math.abs(a % size - b % size), Math.abs(Math.floor(a / size) - Math.floor(b / size)));
export const counts = (p: Position) => [p.board.filter(c => c === 1).length, p.board.filter(c => c === 2).length] as const;
export function validPosition(p: unknown): p is Position {
  if (!p || typeof p !== 'object') return false;
  const q = p as Position;
  if (!Number.isInteger(q.size) || q.size < 3 || q.size > 7 || !Array.isArray(q.board) || q.board.length !== q.size * q.size || ![1,2].includes(q.turn) || !Number.isInteger(q.quiet) || q.quiet < 0 || q.quiet > 100) return false;
  for (let i=0;i<q.board.length;i++) if (![-1,0,1,2].includes(q.board[i])) return false;
  return true;
}
function index(p: Position, i: number) { return Number.isInteger(i) && i >= 0 && i < p.board.length; }
/** Clone destinations are deduplicated, as in upstream Single moves; jumps keep their origin. */
export function pseudoMoves(p: Position, side: Side = p.turn): Exclude<Move,null>[] {
  const out: Exclude<Move,null>[] = [], clones = new Set<number>();
  for (let from=0;from<p.board.length;from++) if (p.board[from] === side) {
    const x=from%p.size,y=Math.floor(from/p.size);
    for (let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) {
      const nx=x+dx,ny=y+dy;
      if (nx<0||ny<0||nx>=p.size||ny>=p.size||(!dx&&!dy)) continue;
      const to=ny*p.size+nx;
      if (p.board[to]!==0) continue;
      if (Math.max(Math.abs(dx),Math.abs(dy))===1) { if(clones.has(to))continue;clones.add(to); }
      out.push({from,to});
    }
  }
  return out;
}
/** Terminal exhaustion/elimination takes precedence over the 100-ply no-clone draw. */
export function outcome(p: Position): Side | 0 | null {
  const [green,plum]=counts(p);
  if (!green || !plum || (!pseudoMoves(p,1).length && !pseudoMoves(p,2).length)) return green===plum?0:green>plum?1:2;
  return p.quiet>=100?0:null;
}
export function legal(p: Position, m: Move): boolean {
  if (!validPosition(p) || outcome(p)!==null) return false;
  if (m===null) return pseudoMoves(p).length===0;
  return !!m && index(p,m.from) && index(p,m.to) && p.board[m.from]===p.turn && p.board[m.to]===0 && distance(m.from,m.to,p.size)>=1 && distance(m.from,m.to,p.size)<=2;
}
export function moves(p: Position): Move[] { if(outcome(p)!==null)return [];const m=pseudoMoves(p);return m.length?m:[null]; }
export function captures(p: Position, m: Move): number[] { return m===null?[]:p.board.flatMap((c,i)=>c===other(p.turn)&&distance(i,m.to,p.size)===1?[i]:[]); }
/** Requires a generated or already validated move. No intermediate square blocks a jump. */
export function apply(p: Position, m: Move): Position {
  if(m===null)return {...p,turn:other(p.turn),quiet:p.quiet+1};
  const board=p.board.slice(),jump=distance(m.from,m.to,p.size)===2;
  if(jump)board[m.from]=0;
  board[m.to]=p.turn;
  for(const i of captures(p,m))board[i]=p.turn;
  return {size:p.size,board,turn:other(p.turn),quiet:jump?p.quiet+1:0};
}
export function play(p: Position,m:Move): Position { return legal(p,m)?apply(p,m):p; }
export function start(lesson?: Lesson): Position {
  if(lesson)return {size:lesson.size,board:lesson.board.slice(),turn:1,quiet:0};
  const board=Array<Cell>(49).fill(0);board[0]=board[48]=1;board[6]=board[42]=2;board[24]=-1;
  return {size:7,board,turn:1,quiet:0};
}
export function goalText(g: Goal): string {
  if(g.kind==='move')return `用一次${g.mode==='clone'?'复制':g.mode==='jump'?'跳跃':'移动'}，转化至少 ${g.captures} 枚紫子。`;
  if(g.kind==='hold')return `走一手，并承受紫方最不利的一次回击后，保留至少 ${g.target} 枚绿子（直接获胜也通过）。`;
  return `你最多走 ${g.turns} 手，让绿方赢下这盘残局。紫方会尽力阻挡。`;
}
export function stage(lesson: Lesson, history: Move[], p: Position): 'playing'|'success'|'retry' {
  const g=lesson.goal,result=outcome(p);
  if(g.kind==='move'){
    if(!history.length)return 'playing';const m=history[0],initial=start(lesson);
    return m!==null && captures(initial,m).length>=g.captures && (!g.mode || (distance(m.from,m.to,p.size)===1?'clone':'jump')===g.mode)?'success':'retry';
  }
  if(result!==null)return result===1?'success':'retry';
  if(g.kind==='hold')return history.length<2?'playing':counts(p)[0]>=g.target?'success':'retry';
  return history.length>=g.turns*2-1?'retry':'playing';
}
/** Saves contain only actions; every state and counter is reconstructed and revalidated. */
export function replay(initial:Position,history:unknown,lesson?:Lesson):Position|null {
  if(!Array.isArray(history)||history.length>5000)return null;
  let p=initial;const accepted:Move[]=[];
  for(const raw of history){
    if(lesson&&stage(lesson,accepted,p)!=='playing')return null;
    if(raw!==null&&(!raw||typeof raw!=='object'||Object.keys(raw).sort().join(',')!=='from,to'))return null;
    const m=raw as Move;if(!legal(p,m))return null;p=apply(p,m);accepted.push(m);
  }
  return p;
}
export function parseSave(raw:string|null,initial:Position,id:string,lesson?:Lesson):Move[]{
  if(!raw||raw.length>180000)return [];
  try{const v=JSON.parse(raw);if(v?.id!==id||!replay(initial,v.history,lesson))return [];return v.history;}catch{return [];}
}
export function point(i:number,size:number){return `${Math.floor(i/size)+1}行${i%size+1}列`;}
