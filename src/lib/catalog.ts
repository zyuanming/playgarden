/** Stable identifiers are never reused: local progress is keyed by these IDs. */
export const GAME_IDS = [
  "light",
  "robot",
  "bridge",
  "slide",
  "lights-out",
  "sudoku",
  "memory",
  "mines",
  "hanoi",
] as const;
export type GameId = (typeof GAME_IDS)[number];
export type Category =
  "逻辑思维" | "编程启蒙" | "空间想象" | "记忆观察" | "数字推理";
export const CATEGORIES: readonly string[] = [
  "全部",
  "逻辑思维",
  "编程启蒙",
  "空间想象",
  "记忆观察",
  "数字推理",
];
export type GameMeta = {
  id: GameId;
  title: string;
  subtitle: string;
  category: Category;
  difficulty: "初级" | "中级" | "进阶";
  tone: "green" | "purple" | "orange";
  levelCount: number;
  artwork: { url: string; position: string; size: string };
  source: { kind: "original"; license: "MIT"; notes: string };
};
export const firstGameArtwork = (index: number) => ({
  url: "/game-art.webp",
  position: `${index * 50}% 50%`,
  size: "300% auto",
});
export const expansionArtwork = (index: number) => ({
  url: "/expansion-art.webp",
  position: `${(index % 3) * 50}% ${index < 3 ? 12 : 88}%`,
  size: "300% auto",
});
