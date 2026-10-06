/** Original Same Game rules and bounded current-position search. No level certificates. */
export interface SameGameLevel {
  id: string;
  title: string;
  chapter: number;
  width: number;
  height: number;
  colors: number;
  board: number[];
  objective?: string;
}

export interface SameGameState {
  board: number[];
  history: number[][];
}

export type SameGameHint =
  | { kind: 'move'; index: number; reason: string }
  | { kind: 'dead-end' | 'unavailable' | 'complete'; reason: string };

/** Validate shape and values, including hostile persisted input. */
export function isSameGameBoard(board: unknown, width: number, height: number): board is number[] {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && width <= 6 && height > 0 && height <= 7
    && Array.isArray(board) && board.length === width * height
    && Array.from(board).every(value => Number.isInteger(value) && value >= -1 && value <= 3);
}

export function createSameGameState(level: SameGameLevel): SameGameState {
  if (!isSameGameBoard(level.board, level.width, level.height)) throw new Error('Invalid Same Game level');
  return { board: [...level.board], history: [] };
}

export function samegameGroup(board: readonly number[], width: number, height: number, index: number): number[] {
  if (!isSameGameBoard(board, width, height) || !Number.isInteger(index) || index < 0 || index >= board.length || board[index] < 0) return [];
  const color = board[index];
  const group = [index];
  const seen = new Set(group);
  for (let cursor = 0; cursor < group.length; cursor++) {
    const cell = group[cursor];
    const x = cell % width;
    const y = Math.floor(cell / width);
    const neighbors = [x > 0 ? cell - 1 : -1, x + 1 < width ? cell + 1 : -1, y > 0 ? cell - width : -1, y + 1 < height ? cell + width : -1];
    for (const next of neighbors) {
      if (next >= 0 && board[next] === color && !seen.has(next)) {
        seen.add(next);
        group.push(next);
      }
    }
  }
  return group.sort((a, b) => a - b);
}

/** One representative per legal orthogonally connected group of two or more. */
export function samegameGroups(board: readonly number[], width: number, height: number): number[][] {
  if (!isSameGameBoard(board, width, height)) return [];
  return groupsUnchecked(board, width, height);
}

function groupsUnchecked(board: readonly number[], width: number, height: number): number[][] {
  const visited = new Uint8Array(board.length);
  const groups: number[][] = [];
  for (let index = 0; index < board.length; index++) {
    if (board[index] < 0 || visited[index]) continue;
    const group = [index];
    visited[index] = 1;
    for (let cursor = 0; cursor < group.length; cursor++) {
      const cell = group[cursor];
      const x = cell % width;
      const y = Math.floor(cell / width);
      for (const next of [x > 0 ? cell - 1 : -1, x + 1 < width ? cell + 1 : -1, y > 0 ? cell - width : -1, y + 1 < height ? cell + width : -1]) {
        if (next >= 0 && !visited[next] && board[next] === board[index]) {
          visited[next] = 1;
          group.push(next);
        }
      }
    }
    if (group.length > 1) groups.push(group.sort((a, b) => a - b));
  }
  return groups;
}

function removeUnchecked(board: readonly number[], width: number, height: number, group: readonly number[]): number[] {
  const removed = new Set(group);
  const next = Array<number>(board.length).fill(-1);
  let targetColumn = 0;
  for (let x = 0; x < width; x++) {
    const column: number[] = [];
    for (let y = height - 1; y >= 0; y--) {
      const cell = y * width + x;
      if (board[cell] >= 0 && !removed.has(cell)) column.push(board[cell]);
    }
    if (!column.length) continue;
    column.forEach((value, offset) => { next[(height - 1 - offset) * width + targetColumn] = value; });
    targetColumn++;
  }
  return next;
}

/** Singletons and malformed/out-of-range selections are no-ops, represented by null. */
export function removeSameGameGroup(board: readonly number[], width: number, height: number, index: number): number[] | null {
  const group = samegameGroup(board, width, height, index);
  return group.length > 1 ? removeUnchecked(board, width, height, group) : null;
}

export function isSameGameSolved(board: readonly number[]): boolean {
  return board.length > 0 && Array.from(board).every(value => value === -1);
}

export function playSameGame(state: SameGameState, level: SameGameLevel, index: number): SameGameState {
  if (isSameGameSolved(state.board)) return state;
  const next = removeSameGameGroup(state.board, level.width, level.height, index);
  return next ? { board: next, history: [...state.history, [...state.board]] } : state;
}

/** Completion is locked, matching GameShell; restarting begins a new round. */
export function undoSameGame(state: SameGameState): SameGameState {
  if (!state.history.length || isSameGameSolved(state.board)) return state;
  return { board: [...state.history[state.history.length - 1]], history: state.history.slice(0, -1) };
}

/**
 * Symmetries: color relabeling and occupied-column reflection followed by LEFT repacking.
 * Full-width reflection alone is not canonical after columns disappear. Vertical flips
 * and rotations are not rule symmetries because gravity always acts downwards.
 */
export function samegameCanonicalKey(board: readonly number[], width: number, height: number): string {
  const columns: number[][] = [];
  for (let x = 0; x < width; x++) {
    const column: number[] = [];
    for (let y = height - 1; y >= 0; y--) if (board[y * width + x] >= 0) column.push(board[y * width + x]);
    if (column.length) columns.push(column);
  }
  const encode = (ordered: number[][]) => {
    const colors = new Map<number, number>();
    return ordered.map(column => column.map(value => {
      if (!colors.has(value)) colors.set(value, colors.size);
      return colors.get(value);
    }).join('')).join('.');
  };
  const forward = encode(columns);
  const reverse = encode([...columns].reverse());
  return forward < reverse ? forward : reverse;
}

/**
 * Depth-first AND/OR search. Only proven wins/losses enter memo; budget exhaustion
 * propagates UNKNOWN, never a loss. At most 30,000 uncached positions are expanded.
 * A remaining color with exactly one tile is a sound impossibility certificate.
 */
export function getSameGameHint(level: SameGameLevel, board: readonly number[], budget = 30000): SameGameHint {
  if (!isSameGameBoard(board, level.width, level.height)) return { kind: 'unavailable', reason: '棋盘数据无效，请重来。' };
  if (isSameGameSolved(board)) return { kind: 'complete', reason: '所有花朵都清空了！' };
  const limit = Number.isFinite(budget) ? Math.min(30000, Math.max(0, Math.floor(budget))) : 30000;
  let nodes = 0;
  type Outcome = 'win' | 'loss' | 'unknown';
  const memo = new Map<string, Outcome>();
  const search = (position: readonly number[]): Outcome => {
    if (isSameGameSolved(position)) return 'win';
    const key = samegameCanonicalKey(position, level.width, level.height);
    const cached = memo.get(key);
    if (cached) return cached;
    if (nodes >= limit) return 'unknown';
    nodes++;
    const counts = [0, 0, 0, 0];
    for (const value of position) if (value >= 0) counts[value]++;
    if (counts.includes(1)) { memo.set(key, 'loss'); return 'loss'; }
    const groups = groupsUnchecked(position, level.width, level.height).sort((a, b) => b.length - a.length || a[0] - b[0]);
    let unknown = false;
    for (const group of groups) {
      const result = search(removeUnchecked(position, level.width, level.height, group));
      if (result === 'win') { memo.set(key, 'win'); return 'win'; }
      if (result === 'unknown') unknown = true;
    }
    const result = unknown ? 'unknown' : 'loss';
    if (!unknown) memo.set(key, result);
    return result;
  };
  const groups = groupsUnchecked(board, level.width, level.height).sort((a, b) => b.length - a.length || a[0] - b[0]);
  if (!groups.length) return { kind: 'dead-end', reason: '没有可消除的相邻花朵了。撤销一步，试试不同的顺序。' };
  let unknown = false;
  for (const group of groups) {
    const result = search(removeUnchecked(board, level.width, level.height, group));
    if (result === 'win') return { kind: 'move', index: group[0], reason: `经当前局面搜索，这簇 ${group.length} 朵花可以通向清空。先观察下落后哪些同色花朵会相遇。` };
    if (result === 'unknown') unknown = true;
  }
  return unknown
    ? { kind: 'unavailable', reason: '本次搜索已到上限，还没有找到可靠提示；这不代表无解。可以继续尝试或撤销。' }
    : { kind: 'dead-end', reason: '这个局面已无法全部清空。撤销一步，保护落单花朵再试。' };
}
