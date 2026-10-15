// SPDX-License-Identifier: GPL-3.0-only
// Typed boundary for the original compiler settings. The build checks this
// declaration against the emitted upstream-derived declaration before packaging.
export interface GhostedSnapshot {
  paused: boolean; disposed: boolean; initialized: boolean; assetsLoaded: boolean; frames: number;
  audio: {state: string; hostMuted: boolean; enabled: boolean; activeSamples: number; effectiveGain: number};
  scene: string; progress: boolean[]; saved: boolean;
  title: {phase: number; ready: boolean}; menu: {selected: number; ready: boolean};
  game: null | {level: number; width: number; height: number; bottom: number[]; top: number[];
    turnsLeft: number; undoDepth: number; moving: boolean; cleared: boolean; ready: boolean;
    player: {x: number; y: number; ghost: boolean}};
}
export declare function startGame(selectedLevel: number, direct: boolean,
  carried?: {progress: boolean[]; audioEnabled: boolean; saved: boolean}): {
  program: {setPaused(value: boolean): void; setMuted(value: boolean): void;
    clearInput(): void; dispose(): void; input(code: string, key: string, down: boolean): void};
  snapshot(): GhostedSnapshot;
};
