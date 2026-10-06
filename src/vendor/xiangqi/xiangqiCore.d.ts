/** Narrow typed boundary for the reviewed, BSD-2-Clause JavaScript adaptation. */
export type Color = "r" | "b";
export type PieceType = "p" | "c" | "r" | "n" | "b" | "a" | "k";
export type Piece = { type: PieceType; color: Color };
export type CoreMove = {
  from: string;
  to: string;
  iccs: string;
  color: Color;
  piece: string;
  captured?: PieceType;
  flags: string;
};
export interface Core {
  load(fen: string): boolean;
  validate_fen(fen: string): {
    valid: boolean;
    error: string;
    error_number: number;
  };
  fen(): string;
  board(): (Piece | null)[][];
  turn(): Color;
  moves(): string[];
  moves(options: { verbose: true; square?: string }): CoreMove[];
  moves(options: {
    square?: string;
    legal?: boolean;
    opponent?: boolean;
  }): string[];
  move(move: string | { from: string; to: string }): CoreMove | null;
  undo(): CoreMove | null;
  get(square: string): Piece | null;
  in_check(): boolean;
  attacked(color: Color): boolean;
  in_checkmate(): boolean;
  in_stalemate(): boolean;
  perft(depth: number): number;
}
export function Xiangqi(fen?: string): Core;
