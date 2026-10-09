// SPDX-License-Identifier: GPL-3.0-only
export type TubeBoard = number[][];
export type TubeMove = [number, number];
export const tubeColors = ['珊瑚', '海蓝', '金黄', '葡萄', '薄荷'];
export const colorTubesLevels = [
  { title: '借一只空管', lesson: '先把顶上的珠子移到空管，再把同色珠子聚在一起。', capacity: 2, tubes: [[0,1],[1,0],[]] },
  { title: '三色交班', lesson: '空管是工作台。给暂时没有家的珠子留一点空间。', capacity: 2, tubes: [[0,1],[1,2],[2,0],[]] },
  { title: '藏在中间', lesson: '只能搬最上面的一颗，底下的颜色要逐层解开。', capacity: 3, tubes: [[0,1,0],[1,0,1],[],[]] },
  { title: '三管回环', lesson: '先观察各管最底下的颜色，再安排收集的位置。', capacity: 3, tubes: [[0,1,2],[1,2,0],[2,0,1],[],[]] },
  { title: '双珠盖帽', lesson: '连续的同色珠子也要一颗颗搬；不要把唯一的空位用满。', capacity: 3, tubes: [[0,1,1],[1,2,2],[2,3,3],[3,0,0],[],[]] },
  { title: '深管整理', lesson: '四颗同色珠子才算装满一管。先解开交错的顶层。', capacity: 4, tubes: [[0,1,0,1],[1,0,1,0],[2,2,2,2],[],[]] },
  { title: '四季轮换', lesson: '完成一管后，可以把注意力放到还混色的管子。', capacity: 3, tubes: [[0,1,2],[1,2,3],[2,3,0],[3,0,1],[],[]] },
  { title: '五色花房', lesson: '五种颜色交织。让每次搬动都为后面露出有用的颜色。', capacity: 3, tubes: [[0,1,2],[1,2,3],[2,3,4],[3,4,0],[4,0,1],[],[]] },
] as const;
export function tubesWon(board: TubeBoard, capacity: number) { return board.every(t => !t.length || t.length === capacity && t.every(c => c === t[0])); }
export function moveTube(board: TubeBoard, capacity: number, from: number, to: number): TubeBoard | null {
  const a = board[from], b = board[to];
  if (!a || !b || from === to || !a.length || b.length >= capacity || b.length > 0 && b[b.length-1] !== a[a.length-1]) return null;
  return board.map((t,i) => i === from ? t.slice(0,-1) : i === to ? [...t,a[a.length-1]] : [...t]);
}
/** Symmetry-reduced, bounded search from the live board; never assumes the opening layout. */
export function solveTubes(start: TubeBoard, capacity: number): TubeMove[] | null {
  const seen = new Set<string>(); let budget = 90000;
  function visit(board: TubeBoard): TubeMove[] | null {
    if (tubesWon(board,capacity)) return [];
    if (--budget <= 0) return null;
    const key = board.map(t=>t.join('')).sort().join('|');
    if (seen.has(key)) return null; seen.add(key);
    const moves: {move: TubeMove; board: TubeBoard; score:number}[] = [];
    for (let a=0;a<board.length;a++) {
      if (board[a].length===capacity && board[a].every(v=>v===board[a][0])) continue;
      for(let b=0;b<board.length;b++) {
        if (!board[b].length && board[a].every(v=>v===board[a][0])) continue;
        const next=moveTube(board,capacity,a,b); if(next) moves.push({move:[a,b],board:next,score:board[b].length * 3 + (board[a].length===1?2:0)});
      }
    }
    moves.sort((a,b)=>b.score-a.score);
    for(const next of moves) { const rest=visit(next.board); if(rest) return [next.move,...rest]; }
    return null;
  }
  return visit(start);
}
