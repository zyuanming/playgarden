// Original deterministic corpus engine. Columns contain bottom-to-top digit strings.
export function groups(columns, width, height) {
  const visited = new Set();
  const result = [];
  for (let x = 0; x < columns.length; x++) for (let y = 0; y < columns[x].length; y++) {
    const id = x * height + y;
    if (visited.has(id)) continue;
    const cells = [[x, y]];
    visited.add(id);
    for (let i = 0; i < cells.length; i++) {
      const [cx, cy] = cells[i];
      for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
        const nid = nx * height + ny;
        if (nx < 0 || nx >= columns.length || ny < 0 || ny >= columns[nx].length || visited.has(nid) || columns[nx][ny] !== columns[x][y]) continue;
        visited.add(nid);
        cells.push([nx, ny]);
      }
    }
    if (cells.length > 1) result.push({ cells, size: cells.length, index: Math.min(...cells.map(([cx, cy]) => (height - cy - 1) * width + cx)) });
  }
  return result.sort((a, b) => a.index - b.index);
}
export function remove(columns, group) {
  const sets = columns.map(() => new Set());
  group.cells.forEach(([x, y]) => sets[x].add(y));
  return columns.map((column, x) => [...column].filter((_, y) => !sets[x].has(y)).join('')).filter(Boolean);
}
function relabel(columns) {
  const map = new Map();
  return columns.map(column => [...column].map(c => { if (!map.has(c)) map.set(c, map.size); return map.get(c); }).join('')).join('.');
}
export function canonical(columns) {
  const a = relabel(columns), b = relabel([...columns].reverse());
  return a < b ? a : b;
}
export function fromBoard(board, width, height) {
  return Array.from({ length: width }, (_, x) => Array.from({ length: height }, (_, offset) => board[(height - offset - 1) * width + x]).filter(x => x >= 0).join('')).filter(Boolean);
}
export function toBoard(columns, width, height) {
  return Array.from({ length: width * height }, (_, i) => {
    const char = columns[i % width]?.[height - 1 - Math.floor(i / width)];
    return char === undefined ? -1 : Number(char);
  });
}
// Contacts created by a selected move, retaining original component and column identities.
function mergeEvidence(columns, group, height) {
  const removed = new Set(group.cells.map(([x, y]) => x * height + y));
  const components = new Map();
  let component = 0;
  for (let x = 0; x < columns.length; x++) for (let y = 0; y < columns[x].length; y++) {
    const id = x * height + y;
    if (components.has(id)) continue;
    const queue = [[x, y]];
    components.set(id, component);
    for (let i = 0; i < queue.length; i++) for (const [nx, ny] of [[queue[i][0]-1,queue[i][1]],[queue[i][0]+1,queue[i][1]],[queue[i][0],queue[i][1]-1],[queue[i][0],queue[i][1]+1]]) {
      const nid = nx * height + ny;
      if (nx < 0 || nx >= columns.length || ny < 0 || ny >= columns[nx].length || components.has(nid) || columns[nx][ny] !== columns[x][y]) continue;
      components.set(nid, component); queue.push([nx, ny]);
    }
    component++;
  }
  const fallen = columns.map((col, x) => [...col].map((color, y) => ({color, column:x, component:components.get(x*height+y), id:x*height+y})).filter(tile => !removed.has(tile.id)));
  let gravityJoins = 0, columnJoins = 0;
  for (let x=0;x<fallen.length;x++) for(let y=0;y<fallen[x].length;y++) {
    const a=fallen[x][y];
    for(const b of [fallen[x][y+1],fallen[x+1]?.[y]]) if(b && a.color===b.color && a.component!==b.component) gravityJoins++;
  }
  const packed=fallen.filter(col=>col.length);
  for(let x=0;x+1<packed.length;x++) for(let y=0;y<packed[x].length;y++) {
    const a=packed[x][y],b=packed[x+1][y];
    if(b && b.column-a.column>1 && a.color===b.color) columnJoins++;
  }
  return { gravityJoins, columnJoins, emptiedColumns: fallen.filter(col=>!col.length).length };
}
export function analyze(columns, width, height, nodeCap = 150000) {
  const nodes = new Map();
  const visit = position => {
    const key = canonical(position);
    if (nodes.has(key)) return nodes.get(key);
    if (nodes.size >= nodeCap) throw new Error('budget');
    const node = { tiles: position.reduce((n, col) => n + col.length, 0), win: position.length === 0, children: [], position };
    nodes.set(key, node);
    for (const group of groups(position, width, height)) {
      const next = remove(position, group);
      const child = visit(next);
      node.children.push({ index: group.index, size: group.size, key: canonical(next), win: child.win, moves: child.children.length });
      if (child.win) node.win = true;
    }
    return node;
  };
  const root = visit(columns);
  if (!root.win) return null;
  const frontier = {};
  let edges = 0, winning = 0, losing = 0, terminalLosing = 0, mixed = 0;
  for (const node of nodes.values()) {
    frontier[node.tiles] = (frontier[node.tiles] ?? 0) + 1;
    edges += node.children.length;
    if (node.win) winning++; else losing++;
    if (!node.win && !node.children.length) terminalLosing++;
    if (node.children.some(c => c.win) && node.children.some(c => !c.win)) mixed++;
  }
  // Prefer a safe smaller group when larger alternatives are dangerous, otherwise stable order.
  const solution = [], trace = [];
  let position = columns;
  while (position.length) {
    const options = groups(position, width, height).map(group => ({ group, next: remove(position, group) }));
    const annotated = options.map(({ group, next }) => ({ group, next, win: nodes.get(canonical(next)).win }));
    const safe = annotated.filter(x => x.win).sort((a, b) => a.group.size - b.group.size || a.group.index - b.group.index);
    const chosen = safe[0];
    if (!chosen) throw new Error('broken certificate');
    const largest = Math.max(...annotated.map(x => x.group.size));
    trace.push({ tiles: position.reduce((n, col) => n + col.length, 0), legalGroups: annotated.length, winningGroups: safe.length, losingGroups: annotated.length - safe.length, selectedIndex: chosen.group.index, selectedSize: chosen.group.size, largestGroupSize: largest, allLargestLose: annotated.filter(x => x.group.size === largest).every(x => !x.win), ...mergeEvidence(position, chosen.group, height) });
    solution.push(chosen.group.index);
    position = chosen.next;
  }
  let greedy = columns;
  const greedyMoves = [];
  while (true) {
    const legal = groups(greedy, width, height).sort((a, b) => b.size - a.size || a.index - b.index);
    if (!legal.length) break;
    greedyMoves.push(legal[0].index);
    greedy = remove(greedy, legal[0]);
  }
  const first = root.children;
  const largest = Math.max(...first.map(x => x.size));
  return {
    solution, trace,
    metrics: {
      reachableStates: nodes.size, winningStates: winning, losingStates: losing, terminalLosingStates: terminalLosing,
      transitionEdges: edges, remainingTileFrontier: frontier, peakFrontier: Math.max(...Object.values(frontier)), mixedChoiceStates: mixed,
      openingGroups: first.length, winningOpeningGroups: first.filter(x => x.win).length, losingOpeningGroups: first.filter(x => !x.win).length,
      openingDelayedTraps: first.filter(x => !x.win && x.moves > 0).length,
      allLargestOpeningGroupsLose: first.filter(x => x.size === largest).every(x => !x.win),
      certificateMoves: solution.length, certificateMixedChoices: trace.filter(x => x.losingGroups > 0).length,
      certificateForcedSafeChoices: trace.filter(x => x.winningGroups === 1 && x.losingGroups > 0).length,
      certificateLargestTraps: trace.filter(x => x.allLargestLose).length,
      certificateGravityMergeMoves: trace.filter(x => x.gravityJoins > 0).length,
      certificateColumnMergeMoves: trace.filter(x => x.columnJoins > 0).length,
      greedyLargestClears: !greedy.length, greedyLargestMoves: greedyMoves,
      greedyLargestRemainingTiles: greedy.reduce((n, col) => n + col.length, 0),
    },
    openingOutcomes: first.map(({ index, size, win, moves }) => ({ index, size, outcome: win ? 'clearable' : 'losing', nextLegalGroups: moves })),
  };
}
