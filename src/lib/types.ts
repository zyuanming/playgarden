export type { GameId } from "./catalog";
export type GameProps = {
  level: number;
  paused: boolean;
  resetToken: number;
  /** Explicit restart survives keyed remounts even when storage removal fails. */
  freshStart?: boolean;
  hintToken: number;
  undoToken: number;
  onComplete: () => void;
  onStatus: (text: string) => void;
};
export type Point = { x: number; y: number };
