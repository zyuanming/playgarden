/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Adaptation: Playgarden contributors, 2026.
 * Derived rules and original map/story data: Drunken Viking, Cong, 2014.
 * https://github.com/cxong/DrunkenViking/tree/356d8e19f27060e3330de73fa1e0c68accfc5c79
 * Original portions remain available under this MIT notice:
 *
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Cong
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { VIKING_LEVELS, type VikingLevel } from './vikingLevelData';

export type Direction = 'up' | 'down' | 'left' | 'right';
export type VikingPhase = 'playing' | 'score' | 'replay' | 'replayDone' | 'complete';
export interface VikingPoint { readonly x: number; readonly y: number }
export interface VikingScore {
  readonly pickups: number;
  readonly totalPickups: number;
  readonly objects: number;
  readonly totalObjects: number;
  readonly pickupPercent: number;
  readonly objectPercent: number;
}
export interface VikingAction {
  readonly kind: 'move' | 'bump' | 'exit' | 'replay';
  readonly direction: Direction;
  readonly from: VikingPoint;
  readonly to: VikingPoint;
  readonly target: VikingPoint;
  readonly moved: boolean;
  readonly blockedBy: 'wall' | 'object' | null;
  readonly changedIndex: number | null;
  readonly change: 'repair' | 'pickup' | 'break' | 'drop' | null;
}
export interface VikingSnapshot {
  readonly levelIndex: number;
  readonly level: VikingLevel;
  readonly phase: VikingPhase;
  readonly player: VikingPoint;
  readonly clothed: boolean;
  /** Every Broken-layer cell hidden at this instant. Includes pickups and objects. */
  readonly cleared: readonly number[];
  readonly repaired: readonly number[];
  readonly pickedUp: readonly number[];
  /** Frozen completion score during score/replay/replayDone; live score during play. */
  readonly score: VikingScore;
  /** Counts for the current visible board, including playback changes. */
  readonly liveScore: VikingScore;
  readonly actionCount: number;
  readonly replayCursor: number;
  readonly replayTotal: number;
  readonly replayDirections: readonly Direction[];
  readonly canUndo: boolean;
  readonly lastAction: VikingAction | null;
}
export interface VikingSave {
  readonly version: 1;
  readonly levelIndex: number;
  readonly inputs: readonly Direction[];
  readonly exitDirection: Direction | null;
  readonly phase: VikingPhase;
  readonly replayCursor: number;
}

export const VIKING_DIRECTIONS: readonly Direction[] = Object.freeze(['up', 'down', 'left', 'right']);
const DELTA: Readonly<Record<Direction, VikingPoint>> = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }), down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }), right: Object.freeze({ x: 1, y: 0 }),
});
const OPPOSITE: Readonly<Record<Direction, Direction>> = Object.freeze({ up: 'down', down: 'up', left: 'right', right: 'left' });
const MAX_SAVED_ACTIONS = 100_000;

export function isVikingDirection(value: unknown): value is Direction {
  return value === 'up' || value === 'down' || value === 'left' || value === 'right';
}
export function vikingCellIndex(point: VikingPoint, level: VikingLevel): number | null {
  if (!Number.isInteger(point.x) || !Number.isInteger(point.y) || point.x < 0 || point.y < 0 || point.x >= level.width || point.y >= level.height) return null;
  return point.y * level.width + point.x;
}
export function isVikingRealWall(level: VikingLevel, point: VikingPoint): boolean {
  const index = vikingCellIndex(point, level);
  return index !== null && level.layers.Walls[index] > 0;
}
export function isVikingBlocked(snapshot: VikingSnapshot, point: VikingPoint): boolean {
  const index = vikingCellIndex(point, snapshot.level);
  return index !== null && (snapshot.level.layers.Walls[index] > 0 || snapshot.repaired.includes(index));
}
function frozenPoint(point: VikingPoint): VikingPoint { return Object.freeze({ x: point.x, y: point.y }); }
function frozenAction(action: VikingAction): VikingAction {
  return Object.freeze({ ...action, from: frozenPoint(action.from), to: frozenPoint(action.to), target: frozenPoint(action.target) });
}
function nextPoint(point: VikingPoint, direction: Direction): VikingPoint {
  return { x: point.x + DELTA[direction].x, y: point.y + DELTA[direction].y };
}
function assertLevelIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= VIKING_LEVELS.length) throw new RangeError('Viking levelIndex must be an integer from 0 through 6.');
}
interface HistoryAction {
  input: Direction;
  replayDirection: Direction;
  from: VikingPoint;
  clothedBefore: boolean;
  changedIndex: number | null;
  event: VikingAction;
}

/**
 * Deterministic, timer-free port of original movement and forward-time playback.
 * Normal play reconstructs the previous night in reverse. Playback follows the
 * original command algorithm, including its same-direction blocked-bump quirk;
 * it deliberately does not substitute exact history undo for forward playback.
 * The embedding shell controls narration, animation, unlocks and next-day UI.
 */
export class VikingEngine {
  #levelIndex: number;
  #phase: VikingPhase = 'playing';
  #player: VikingPoint;
  #clothed = false;
  #cleared = new Set<number>();
  #history: HistoryAction[] = [];
  #exitDirection: Direction | null = null;
  #completionScore: VikingScore | null = null;
  #replayCursor = 0;
  #lastAction: VikingAction | null = null;
  #cachedSnapshot: VikingSnapshot | null = null;

  constructor(levelIndex = 0) {
    assertLevelIndex(levelIndex);
    this.#levelIndex = levelIndex;
    this.#player = { ...VIKING_LEVELS[levelIndex].bed };
  }

  get snapshot(): VikingSnapshot {
    if (this.#cachedSnapshot) return this.#cachedSnapshot;
    const level = VIKING_LEVELS[this.#levelIndex];
    const cleared = Object.freeze([...this.#cleared].sort((a, b) => a - b));
    const repaired = Object.freeze(cleared.filter(index => level.layers.Good[index] > 0));
    const pickedUp = Object.freeze(cleared.filter(index => level.layers.Good[index] === 0));
    const liveScore = this.#calculateScore();
    this.#cachedSnapshot = Object.freeze({
      levelIndex: this.#levelIndex, level, phase: this.#phase,
      player: frozenPoint(this.#player), clothed: this.#clothed,
      cleared, repaired, pickedUp, liveScore, score: this.#completionScore ?? liveScore,
      actionCount: this.#history.length, replayCursor: this.#replayCursor,
      replayTotal: this.#history.length,
      // In playback order, so the first entry is the first forward-time command.
      replayDirections: Object.freeze(this.#history.map(action => action.replayDirection).reverse()),
      canUndo: (this.#phase === 'playing' && this.#history.length > 0) || this.#phase === 'score',
      lastAction: this.#lastAction,
    });
    return this.#cachedSnapshot;
  }

  move(direction: Direction): VikingSnapshot {
    if (!isVikingDirection(direction)) throw new TypeError('Invalid Viking direction.');
    // Original player input during instant replay skips to its end.
    if (this.#phase === 'replay') return this.skipReplay();
    if (this.#phase !== 'playing') return this.snapshot;
    this.#applyMove(direction);
    return this.#changed();
  }

  /** Restart this map from its bed, also safely cancelling score/replay/ending. */
  reset(): VikingSnapshot {
    this.#phase = 'playing';
    this.#player = { ...VIKING_LEVELS[this.#levelIndex].bed };
    this.#clothed = false;
    this.#cleared.clear();
    this.#history = [];
    this.#exitDirection = null;
    this.#completionScore = null;
    this.#replayCursor = 0;
    this.#lastAction = null;
    return this.#changed();
  }

  /** Adaptation convenience: exact undo during play; undo at score cancels exit. */
  undo(): VikingSnapshot {
    if (this.#phase === 'score') {
      this.#phase = 'playing';
      this.#exitDirection = null;
      this.#completionScore = null;
      this.#lastAction = this.#history.at(-1)?.event ?? null;
      return this.#changed();
    }
    if (this.#phase !== 'playing' || this.#history.length === 0) return this.snapshot;
    const action = this.#history.pop()!;
    this.#player = { ...action.from };
    this.#clothed = action.clothedBefore;
    if (action.changedIndex !== null) this.#cleared.delete(action.changedIndex);
    this.#lastAction = this.#history.at(-1)?.event ?? null;
    return this.#changed();
  }

  /** Begin or repeat forward playback from the legally completed route. */
  beginReplay(): VikingSnapshot {
    if (this.#phase !== 'score' && this.#phase !== 'replayDone') return this.snapshot;
    this.#restoreExitState();
    this.#replayCursor = 0;
    this.#phase = this.#history.length ? 'replay' : 'replayDone';
    return this.#changed();
  }

  /** Apply one original replay command. Repaired objects never block playback. */
  stepReplay(): VikingSnapshot {
    if (this.#phase !== 'replay') return this.snapshot;
    this.#applyReplayStep();
    return this.#changed();
  }

  /** End playback without leaving this map; the shell owns next-day navigation. */
  skipReplay(): VikingSnapshot {
    if (this.#phase !== 'score' && this.#phase !== 'replay') return this.snapshot;
    this.#phase = 'replayDone';
    return this.#changed();
  }

  /** Cancel playback and return to the completed route's score and board. */
  abortReplay(): VikingSnapshot {
    if (this.#phase !== 'replay' && this.#phase !== 'replayDone') return this.snapshot;
    this.#restoreExitState();
    this.#phase = 'score';
    this.#replayCursor = 0;
    return this.#changed();
  }

  /** Optional campaign driver. The seventh completed playback reaches the ending. */
  advanceLevel(): VikingSnapshot {
    if (this.#phase !== 'replayDone') return this.snapshot;
    if (this.#levelIndex === VIKING_LEVELS.length - 1) {
      this.#phase = 'complete';
      return this.#changed();
    }
    this.#levelIndex++;
    return this.reset();
  }

  /** No mutable coordinates, masks, scores, or unlock/award flags enter this save. */
  exportSave(): VikingSave {
    return Object.freeze({
      version: 1, levelIndex: this.#levelIndex,
      inputs: Object.freeze(this.#history.map(action => action.input)),
      exitDirection: this.#exitDirection,
      phase: this.#phase, replayCursor: this.#replayCursor,
    });
  }

  /**
   * Reject malformed/forged completion states. The saved route must reach a real
   * board edge using the current original map and rules before score is allowed.
   * Invalid input throws TypeError. UI may catch it and start a fresh map.
   */
  static fromSave(value: unknown): VikingEngine {
    const invalid = (): never => { throw new TypeError('Invalid Viking save data.'); };
    if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
    const saved = value as Record<string, unknown>;
    if (saved.version !== 1 || typeof saved.levelIndex !== 'number' || !Number.isInteger(saved.levelIndex) || saved.levelIndex < 0 || saved.levelIndex >= VIKING_LEVELS.length) return invalid();
    if (!Array.isArray(saved.inputs) || saved.inputs.length > MAX_SAVED_ACTIONS || !saved.inputs.every(isVikingDirection)) return invalid();
    if (saved.exitDirection !== null && !isVikingDirection(saved.exitDirection)) return invalid();
    if (saved.phase !== 'playing' && saved.phase !== 'score' && saved.phase !== 'replay' && saved.phase !== 'replayDone' && saved.phase !== 'complete') return invalid();
    if (typeof saved.replayCursor !== 'number' || !Number.isInteger(saved.replayCursor) || saved.replayCursor < 0 || saved.replayCursor > saved.inputs.length) return invalid();
    const engine = new VikingEngine(saved.levelIndex);
    for (const direction of saved.inputs) {
      engine.#applyMove(direction);
      // Exiting is only represented by the separate exitDirection at the end.
      if (engine.#phase !== 'playing') return invalid();
    }
    if (saved.phase === 'playing') {
      if (saved.exitDirection !== null || saved.replayCursor !== 0) return invalid();
      return engine;
    }
    if (saved.exitDirection === null) return invalid();
    engine.#applyMove(saved.exitDirection);
    if (engine.#phase !== 'score') return invalid();
    if (saved.phase === 'score') {
      if (saved.replayCursor !== 0) return invalid();
      return engine;
    }
    engine.#phase = 'replay';
    for (let index = 0; index < saved.replayCursor; index++) engine.#applyReplayStep();
    if (saved.phase === 'replay') {
      if (saved.replayCursor >= saved.inputs.length) return invalid();
      engine.#phase = 'replay';
    } else {
      if (saved.phase === 'complete' && saved.levelIndex !== VIKING_LEVELS.length - 1) return invalid();
      // A replay may legitimately have been skipped at any cursor, even zero.
      engine.#phase = saved.phase;
    }
    return engine;
  }

  #changed(): VikingSnapshot {
    this.#cachedSnapshot = null;
    return this.snapshot;
  }

  #calculateScore(): VikingScore {
    const level = VIKING_LEVELS[this.#levelIndex];
    let pickups = 0;
    let objects = 0;
    for (const index of this.#cleared) {
      if (level.layers.Good[index] > 0) objects++;
      else pickups++;
    }
    return Object.freeze({ pickups, totalPickups: level.pickupCount, objects, totalObjects: level.objectCount,
      pickupPercent: Math.round(pickups * 100 / level.pickupCount),
      objectPercent: Math.round(objects * 100 / level.objectCount) });
  }

  #applyMove(direction: Direction): void {
    const level = VIKING_LEVELS[this.#levelIndex];
    const from = { ...this.#player };
    const target = nextPoint(from, direction);
    const index = vikingCellIndex(target, level);
    if (index === null) {
      // Just as upstream, the exiting action neither moves the player off-board
      // nor enters the replay instruction list. No completion percentage gate.
      this.#exitDirection = direction;
      this.#phase = 'score';
      this.#completionScore = this.#calculateScore();
      this.#lastAction = frozenAction({ kind: 'exit', direction, from, to: from, target,
        moved: false, blockedBy: null, changedIndex: null, change: null });
      return;
    }
    const clothedBefore = this.#clothed;
    const blockedBy = level.layers.Walls[index] > 0 ? 'wall'
      : level.layers.Good[index] > 0 && this.#cleared.has(index) ? 'object' : null;
    if (blockedBy === null) this.#player = target;
    let changedIndex: number | null = null;
    let change: VikingAction['change'] = null;
    // The attempted target is processed even when movement bumped a wall.
    if (level.layers.Broken[index] > 0 && !this.#cleared.has(index) && (blockedBy === null || direction === 'up')) {
      this.#cleared.add(index);
      changedIndex = index;
      change = level.layers.Good[index] > 0 ? 'repair' : 'pickup';
      if (change === 'pickup' && level.layers.Broken[index] !== 135) this.#clothed = true;
    }
    const event = frozenAction({ kind: blockedBy === null ? 'move' : 'bump', direction,
      from, to: this.#player, target, moved: blockedBy === null, blockedBy, changedIndex, change });
    this.#history.push({ input: direction, replayDirection: blockedBy === null ? OPPOSITE[direction] : direction,
      from, clothedBefore, changedIndex, event });
    this.#lastAction = event;
  }

  #applyReplayStep(): void {
    const action = this.#history[this.#history.length - 1 - this.#replayCursor];
    if (!action) { this.#phase = 'replayDone'; return; }
    const level = VIKING_LEVELS[this.#levelIndex];
    const direction = action.replayDirection;
    const from = { ...this.#player };
    const target = nextPoint(from, direction);
    const index = vikingCellIndex(target, level);
    const blocked = isVikingRealWall(level, target);
    if (!blocked) this.#player = target;
    let changedIndex: number | null = null;
    let change: VikingAction['change'] = null;
    // Upstream permits playback coordinates outside the board after command
    // divergence. They contain no tiles, so safe lookup must not wrap indices.
    if (index !== null && level.layers.Broken[index] > 0 && this.#cleared.has(index) && (!blocked || direction === 'up')) {
      this.#cleared.delete(index);
      changedIndex = index;
      change = level.layers.Good[index] > 0 ? 'break' : 'drop';
      if (change === 'drop' && level.layers.Broken[index] !== 135) this.#clothed = false;
    }
    this.#lastAction = frozenAction({ kind: 'replay', direction, from, to: this.#player, target,
      moved: !blocked, blockedBy: blocked ? 'wall' : null, changedIndex, change });
    this.#replayCursor++;
    if (this.#replayCursor >= this.#history.length) this.#phase = 'replayDone';
  }

  #restoreExitState(): void {
    const inputs = this.#history.map(action => action.input);
    const exitDirection = this.#exitDirection;
    this.#player = { ...VIKING_LEVELS[this.#levelIndex].bed };
    this.#clothed = false;
    this.#cleared.clear();
    this.#history = [];
    this.#phase = 'playing';
    this.#completionScore = null;
    this.#lastAction = null;
    for (const direction of inputs) this.#applyMove(direction);
    if (exitDirection !== null) this.#applyMove(exitDirection);
  }
}
