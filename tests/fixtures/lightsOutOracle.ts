/** Independent test oracle. No imports from product logic or campaign data.
 * Enumerating first-row presses and chasing the remaining rows visits every
 * possible solution, so the shortest returned press list is an exact minimum.
 */
export function applyOracleLightMoves(
  initial: readonly boolean[],
  size: number,
  moves: readonly number[],
): boolean[] {
  const board = [...initial];
  for (const cell of moves) {
    const row = Math.floor(cell / size);
    const col = cell % size;
    for (const [dr, dc] of [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < size && c >= 0 && c < size)
        board[r * size + c] = !board[r * size + c];
    }
  }
  return board;
}

export function solveByRowChasing(
  initial: readonly boolean[],
  size: number,
): {
  minimumMoves: number | null;
  solution: number[] | null;
  solutionCount: number;
} {
  if (
    !Number.isInteger(size) ||
    size < 1 ||
    size > 5 ||
    initial.length !== size * size ||
    initial.some((value) => typeof value !== "boolean")
  )
    return { minimumMoves: null, solution: null, solutionCount: 0 };

  let solutionCount = 0;
  let best: number[] | null = null;
  for (let top = 0; top < 2 ** size; top++) {
    let board = [...initial];
    const moves: number[] = [];
    const press = (index: number) => {
      moves.push(index);
      board = applyOracleLightMoves(board, size, [index]);
    };
    for (let col = 0; col < size; col++) {
      if (top & (1 << col)) press(col);
    }
    for (let row = 1; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (board[(row - 1) * size + col]) press(row * size + col);
      }
    }
    if (board.every((value) => !value)) {
      solutionCount++;
      if (!best || moves.length < best.length) best = moves;
    }
  }
  return { minimumMoves: best?.length ?? null, solution: best, solutionCount };
}

export function solveLightsOutOracle(
  initial: readonly boolean[],
  size: number,
): number[] | null {
  return solveByRowChasing(initial, size).solution;
}

/** Board identity ignoring rotations/reflections, including the board size. */
export function lightsOutOrbitKey(
  initial: readonly boolean[],
  size: number,
): string {
  const variants: string[] = [];
  for (const mirrored of [false, true]) {
    for (let turns = 0; turns < 4; turns++) {
      const transformed: string[] = Array(initial.length);
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          let r = row;
          let c = mirrored ? size - 1 - col : col;
          for (let turn = 0; turn < turns; turn++) [r, c] = [c, size - 1 - r];
          transformed[r * size + c] = initial[row * size + col] ? "1" : "0";
        }
      }
      variants.push(transformed.join(""));
    }
  }
  return `${size}:${variants.sort()[0]}`;
}

export {
  applyOracleLightMoves as applyIndependent,
  lightsOutOrbitKey as canonicalBoard,
};
