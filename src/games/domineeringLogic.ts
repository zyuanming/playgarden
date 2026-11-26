// SPDX-License-Identifier: GPL-3.0-only
import campaign from './domineeringLevels.json';
export const domineeringLevels = campaign;
export function legalMoves(mask: number, vertical: boolean): number[] {
  if (!Number.isInteger(mask) || mask < 0 || mask > 65535) return [];
  return Array.from({ length: 16 }, (_, i) => i).filter(i =>
    (vertical ? i < 12 : i % 4 < 3) && (mask & (1 << i)) && (mask & (1 << (i + (vertical ? 4 : 1)))));
}
export function place(mask: number, start: number, vertical: boolean): number | null {
  if (!legalMoves(mask, vertical).includes(start)) return null;
  return mask & ~((1 << start) | (1 << (start + (vertical ? 4 : 1))));
}
const memo = new Map<number, boolean>();
// At most 2 * 2^16 states. Every move removes two cells; recursion depth <= 8.
export function isWinning(mask: number, vertical: boolean): boolean {
  const key = mask * 2 + Number(vertical);
  const old = memo.get(key);
  if (old !== undefined) return old;
  const result = legalMoves(mask, vertical).some(i => !isWinning(place(mask, i, vertical)!, !vertical));
  memo.set(key, result);
  return result;
}
export function bestMove(mask: number, vertical: boolean): number | undefined {
  const options = legalMoves(mask, vertical);
  return options.find(i => !isWinning(place(mask, i, vertical)!, !vertical)) ?? options[0];
}
export type Placement = { start: number; vertical: boolean };
export type Position = { mask: number; pieces: Placement[]; result: 'playing' | 'won' | 'lost' };
export function playRound(position: Position, start: number): Position | null {
  if (position.result !== 'playing') return null;
  let mask = place(position.mask, start, true);
  if (mask === null) return null;
  const pieces = [...position.pieces, { start, vertical: true }];
  const reply = bestMove(mask, false);
  if (reply === undefined) return { mask, pieces, result: 'won' };
  mask = place(mask, reply, false)!;
  pieces.push({ start: reply, vertical: false });
  return { mask, pieces, result: legalMoves(mask, true).length ? 'playing' : 'lost' };
}
