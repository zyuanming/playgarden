export type GameId = "light" | "robot" | "bridge";
export type GameProps = {
  level: number;
  paused: boolean;
  resetToken: number;
  hintToken: number;
  undoToken: number;
  onComplete: () => void;
  onStatus: (text: string) => void;
};
export type Point = { x: number; y: number };
