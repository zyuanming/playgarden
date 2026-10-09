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
  "untangle",
  "minimum-network",
  "hitori",
  "nurikabe",
  "binary",
  "sorting-network",
  "voxel",
  "cube-net",
  "kakuro",
  "arithmetic-cage",
  "town-tour",
  "postman-routes",
  "conditional-sorter",
  "state-machine-locks",
  "parabolic",
  "current-circuit",
  "budget-town",
  "concurrent-kitchen",
  "code-clues",
  "energy-dispatch",
  "rolling-faces",
  "shape-mosaic",
  "ice-stops",
  "fleet-logic",
  "carry-letters",
  "binary-balance",
  "pipe-capacity",
  "railway-timetable",
  "function-factory",
  "compression-post",
  "paper-fold",
  "tree-rotations",
  "spectral-filters",
  "wave-studio",
  "memory-routes",
  "rhythm-echo",
  "symmetry-repair",
  "probability-bag",
  "slant",
  "samegame",
  "pancake",
  "blackbox",
  "gomoku",
  "xiangqi",
  "cloudrunner",
  "breakout",
  "snake",
  "falling",
  "flood",
  "akari",
  "galaxies",
  "magnets",
  "signpost",
  "ataxx",
  "loopover",
  "set-trio",
  "numberlink",
  "bubble-shooter",
  "frog-crossing",
  "lunar-landing",
  "chain-bloom",
  "bloom-tap",
  "word-ladder",
  "freecell-garden",
  "star-sentry",
  "petal-words",
  "color-tubes",
  "pipe-turns",
  "chomp-garden",
  "rolling-block",
  "tile-pairs",
  "matchstick-equations",
  "star-battle",
  "domino-trail",
  "frog-swap",
  "three-morris",
  "fox-hounds",
  "solo-chess",
  "scene-differences",
  "cipher-letters",
  "crossword-garden",
  "cloud-stack",
  "story-sequence",
  "garden-links",
  "gravity-maze",
  "falling-rocks",
  "pyramid-cards",
  "golf-cards",
  "dice-combinations",
  "river-pong",
  "hexapawn",
  "mini-golf",
] as const;
export type GameId = (typeof GAME_IDS)[number];
export type Category =
  | "逻辑思维"
  | "编程启蒙"
  | "空间想象"
  | "记忆观察"
  | "数字推理"
  | "科学实验"
  | "动作反应";
export const CATEGORIES: readonly string[] = [
  "全部",
  "逻辑思维",
  "编程启蒙",
  "空间想象",
  "记忆观察",
  "数字推理",
  "科学实验",
  "动作反应",
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
  resumeKey?: string;
  freePlay?: boolean;
  /** One open-ended score game; no finite levels or practice mode. */
  endless?: boolean;
  freePlayCaption?: string;
  modeLabels?: { free: string; practice: string };
  allowUndo?: boolean;
  source:
    | { kind: "original"; license: "GPL-3.0-only"; notes: string }
    | {
        kind: "adapted";
        license: "MIT" | "BSD-2-Clause";
        notes: string;
        author: string;
        workTitle?: string;
        url: string;
        commit: string;
        notice: string;
      };
};
// Resolve public artwork beside the document, including the /playgarden/ Pages base.
export const firstGameArtwork = (index: number) => ({
  url: "./game-art.webp",
  position: `${index * 50}% 50%`,
  size: "300% auto",
});
export const expansionArtwork = (index: number) => ({
  url: "./expansion-art.webp",
  position: `${(index % 3) * 50}% ${index < 3 ? 12 : 88}%`,
  size: "300% auto",
});

export const strategyArtwork = (index: number) => ({
  url: "./strategy-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const discoveryArtwork = (index: number) => ({
  url: "./discovery-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const scienceArtwork = (index: number) => ({
  url: "./science-graph-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const planningArtwork = (index: number) => ({
  url: "./constraint-planning-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const classicArtwork = (index: number) => ({
  url: "./classic-tactics-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const networkCodeArtwork = (index: number) => ({
  url: "./network-code-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const regionNumberArtwork = (index: number) => ({
  url: "./region-number-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const strategyPhysicsArtwork = (index: number) => ({
  url: "./strategy-physics-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const optimizationIslandsArtwork = (index: number) => ({
  url: "./optimization-islands-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const bitSpatialArtwork = (index: number) => ({
  url: "./bit-spatial-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const mathRouteCodeArtwork = (index: number) => ({
  url: "./math-route-code-art.webp",
  position: `${(index % 2) * 100}% ${[6, 50, 94][Math.floor(index / 2)]}%`,
  size: "200% auto",
});

export const scienceTownArtwork = (index: number) => ({
  url: "./science-town-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const codeEnergySpatialArtwork = (index: number) => ({
  url: "./code-energy-spatial-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const iceFleetNumberArtwork = (index: number) => ({
  url: "./ice-fleet-number-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const flowRailFunctionArtwork = (index: number) => ({
  url: "./flow-rail-function-codec-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const foldTreeLightArtwork = (index: number) => ({
  url: "./fold-tree-light-wave-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});

export const sequenceSymmetryArtwork = (index: number) => ({
  url: "./sequence-symmetry-probability-art.webp",
  position: `${(index % 2) * 100}% ${index < 2 ? 12 : 88}%`,
  size: "200% auto",
});
