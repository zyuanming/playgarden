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
  "nonogram",
  "boxes",
  "connect",
  "reversi",
  "merge",
  "traffic",
  "arithmetic",
  "word-search",
  "balance",
  "gears",
  "one-stroke",
  "map-colors",
  "futoshiki",
  "skyline",
  "jugs",
  "river",
  "sowing",
  "nim",
  "peg",
  "knight",
  "hashi",
  "slitherlink",
  "circuit",
  "stack-queue",
  "shikaku",
  "tents",
  "fraction",
  "coordinate",
  "hex",
  "dots",
  "incline",
  "buoyancy",
] as const;
export type GameId = (typeof GAME_IDS)[number];
export type Category =
  "逻辑思维" | "编程启蒙" | "空间想象" | "记忆观察" | "数字推理" | "科学实验";
export const CATEGORIES: readonly string[] = [
  "全部",
  "逻辑思维",
  "编程启蒙",
  "空间想象",
  "记忆观察",
  "数字推理",
  "科学实验",
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

export const strategyArtwork = (index: number) => ({
  url: "/strategy-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const discoveryArtwork = (index: number) => ({
  url: "/discovery-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const scienceArtwork = (index: number) => ({
  url: "/science-graph-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const planningArtwork = (index: number) => ({
  url: "/constraint-planning-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const classicArtwork = (index: number) => ({
  url: "/classic-tactics-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const networkCodeArtwork = (index: number) => ({
  url: "/network-code-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const regionNumberArtwork = (index: number) => ({
  url: "/region-number-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const strategyPhysicsArtwork = (index: number) => ({
  url: "/strategy-physics-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});
