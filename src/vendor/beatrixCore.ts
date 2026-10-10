/**
 * Beatrix《鼓点迷径》: deterministic, DOM-free TypeScript adaptation.
 * New adaptation: GPL-3.0-only. Original rules and puzzle data:
 * Copyright (c) 2014 Cong, MIT, https://github.com/cxong/Beatrix
 * Fixed upstream commit 059b74a3e9d9ec2bffee0a72ba8a53be107fe8b3.
 *
 * Tick order is significant: existing beats move, emitters pulse, then drums
 * collide in original row-major order. A drum hits once per tick; its first
 * colliding beat alone gets the absolute bounce direction, as upstream's
 * collision loop breaks. Distinct same-instrument drums retain multiplicity.
 * Failed cycles retain all beats and emitter countdowns. Editing is live.
 *
 * Documented fixes: the upstream boundary typo omitted x >= 32; escaped beats
 * are now actually removed (Phaser.kill left them in the iterated group).
 * Reset clears every playback counter and hit, avoiding level/reset timer
 * carryover. Integer/bounds checks extend original occupancy checks to touch
 * input. No renderer, Phaser, upstream images, audio, or random samples here.
 */
import { BEATRIX_SOURCE_LEVELS } from './beatrixLevelData';

export const BEATRIX_GRID_SIZE = 32 as const;
export const BEATRIX_SOURCE_COMMIT = '059b74a3e9d9ec2bffee0a72ba8a53be107fe8b3';

export type BeatrixInstrument =
  | 'BD' | 'BHI' | 'BLO' | 'BME' | 'CLA' | 'COW' | 'GUI'
  | 'HH' | 'HO' | 'ME' | 'RIM' | 'SD' | 'TAM';
export type BeatrixDirection = 'up' | 'right' | 'down' | 'left';

export interface BeatrixSymbol {
  readonly instrument: BeatrixInstrument;
  readonly direction?: BeatrixDirection;
  readonly emitterDirections?: readonly BeatrixDirection[];
  readonly period?: number;
}

export interface DrumPosition {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface BeatrixDrum extends DrumPosition {
  readonly instrument: BeatrixInstrument;
  /** Absolute outgoing direction for a reflector; null for other drums. */
  readonly direction: BeatrixDirection | null;
  /** Exactly the original emitters are fixed. */
  readonly fixed: boolean;
  readonly emitterDirections: readonly BeatrixDirection[];
  readonly period: number | null;
  readonly beatsLeft: number;
  readonly hit: boolean;
}

export interface BeatrixBeat {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly direction: BeatrixDirection;
}

export interface BeatrixLevel {
  readonly id: string;
  readonly title: string;
  readonly chapter: string;
  readonly bpm: number;
  readonly sourcePath: string;
  readonly cells: readonly string[];
  readonly symbols: Readonly<Record<string, BeatrixSymbol>>;
  readonly targetRows: readonly string[];
  /** Sorted instrument multiset at each original, fixed-phase target column. */
  readonly target: readonly (readonly BeatrixInstrument[])[];
  readonly drums: readonly BeatrixDrum[];
}

export interface BeatrixCycleResult {
  /** One-based completed cycle. */
  readonly cycle: number;
  readonly correct: boolean;
  readonly checks: readonly boolean[];
  readonly actualColumns: readonly (readonly BeatrixInstrument[])[];
}

export interface BeatrixSnapshot {
  readonly levelId: string;
  readonly bpm: number;
  readonly gridSize: 32;
  readonly drums: readonly BeatrixDrum[];
  readonly beats: readonly BeatrixBeat[];
  readonly target: readonly (readonly BeatrixInstrument[])[];
  /** Next target column, 0 until the first tick. Wraps after every full cycle. */
  readonly beatIndex: number;
  readonly lastBeatIndex: number | null;
  /** Current/just-completed cycle; cleared only as the next cycle starts. */
  readonly checks: readonly boolean[];
  readonly actualColumns: readonly (readonly BeatrixInstrument[])[];
  /** Number of fully completed comparison cycles. */
  readonly cycle: number;
  readonly cycleCorrect: boolean;
  readonly lastCycle: BeatrixCycleResult | null;
  readonly won: boolean;
  readonly ticks: number;
  /** Last tick's audible hits, once per drum, in original drum order. */
  readonly events: readonly BeatrixInstrument[];
  readonly hitDrumIds: readonly string[];
}

export type BeatrixMoveFailure =
  | 'won' | 'unknown-drum' | 'fixed-drum' | 'out-of-bounds' | 'occupied';
export type BeatrixMoveCheck =
  | Readonly<{ allowed: true }>
  | Readonly<{ allowed: false; reason: BeatrixMoveFailure }>;

export interface BeatrixEngine {
  readonly level: BeatrixLevel;
  snapshot(): BeatrixSnapshot;
  /** One sixteenth-note step: 60000 / BPM / 4 milliseconds. */
  advanceBeat(): BeatrixSnapshot;
  canMoveDrum(id: string, x: number, y: number): BeatrixMoveCheck;
  /** True for a legal placement, including the selected drum's current cell. */
  moveDrum(id: string, x: number, y: number): boolean;
  /** Keep arrangement; restart pulses, comparison, win state, and counters. */
  resetPlayback(): BeatrixSnapshot;
  /** Restore exact original arrangement and reset playback. */
  resetLevel(): BeatrixSnapshot;
  /** Full movable-drum arrangement only. Atomic validation; resets playback. */
  setArrangement(positions: readonly DrumPosition[]): boolean;
  arrangement(): readonly DrumPosition[];
}

const EMPTY_DIRECTIONS: readonly BeatrixDirection[] = Object.freeze([]);

function freezeDrums(drums: readonly BeatrixDrum[]): readonly BeatrixDrum[] {
  return Object.freeze(drums.map((drum) => Object.freeze({
    ...drum,
    emitterDirections: Object.freeze([...drum.emitterDirections]),
  })));
}

function freezeColumns(
  columns: readonly (readonly BeatrixInstrument[])[],
): readonly (readonly BeatrixInstrument[])[] {
  return Object.freeze(columns.map((column) => Object.freeze([...column])));
}

function makeLevel(raw: {
  readonly id: string;
  readonly title: string;
  readonly chapter: string;
  readonly bpm: number;
  readonly sourcePath: string;
  readonly cells: readonly string[];
  readonly symbols: Readonly<Record<string, BeatrixSymbol>>;
  readonly targetRows: readonly string[];
}): BeatrixLevel {
  const symbols: Record<string, BeatrixSymbol> = {};
  for (const [key, value] of Object.entries(raw.symbols)) {
    symbols[key] = Object.freeze({
      ...value,
      ...(value.emitterDirections
        ? { emitterDirections: Object.freeze([...value.emitterDirections]) }
        : {}),
    });
  }
  const drums: BeatrixDrum[] = [];
  for (let y = 0; y < BEATRIX_GRID_SIZE; y += 1) {
    const row = raw.cells[y];
    if (row === undefined || row.length !== BEATRIX_GRID_SIZE) {
      throw new Error(`Invalid original level row: ${raw.id}:${y}`);
    }
    for (let x = 0; x < BEATRIX_GRID_SIZE; x += 1) {
      const ch = row.charAt(x);
      if (ch === ' ') continue;
      const symbol = symbols[ch];
      if (!symbol) throw new Error(`Unknown original symbol: ${raw.id}:${ch}`);
      drums.push({
        id: `${raw.id}:${x},${y}`,
        x, y,
        instrument: symbol.instrument,
        direction: symbol.direction ?? null,
        fixed: symbol.emitterDirections !== undefined,
        emitterDirections: symbol.emitterDirections ?? EMPTY_DIRECTIONS,
        period: symbol.period ?? null,
        beatsLeft: 0,
        hit: false,
      });
    }
  }
  const length = raw.targetRows[0]?.length ?? 0;
  if (!length || raw.cells.length !== BEATRIX_GRID_SIZE) {
    throw new Error(`Invalid original level dimensions: ${raw.id}`);
  }
  const target: BeatrixInstrument[][] = Array.from({ length }, () => []);
  for (const row of raw.targetRows) {
    if (row.length !== length) throw new Error(`Uneven target: ${raw.id}`);
    for (let x = 0; x < length; x += 1) {
      const ch = row.charAt(x);
      if (ch === ' ') continue;
      const symbol = symbols[ch];
      const column = target[x];
      if (!symbol || !column) throw new Error(`Invalid target: ${raw.id}:${x}`);
      column.push(symbol.instrument);
    }
  }
  for (const column of target) column.sort();
  return Object.freeze({
    id: raw.id,
    title: raw.title,
    chapter: raw.chapter,
    bpm: raw.bpm,
    sourcePath: raw.sourcePath,
    cells: Object.freeze([...raw.cells]),
    symbols: Object.freeze(symbols),
    targetRows: Object.freeze([...raw.targetRows]),
    target: freezeColumns(target),
    drums: freezeDrums(drums),
  });
}

/** The complete 12-puzzle campaign in original order, without interstitials. */
export const BEATRIX_LEVELS: readonly BeatrixLevel[] = Object.freeze(
  BEATRIX_SOURCE_LEVELS.map((raw) => makeLevel(raw)),
);
export const ORIGINAL_LEVELS = BEATRIX_LEVELS;

export function getBeatrixLevel(id: string): BeatrixLevel {
  const level = BEATRIX_LEVELS.find((candidate) => candidate.id === id);
  if (!level) throw new Error(`Unknown Beatrix level: ${id}`);
  return level;
}

export function millisecondsPerBeatrixBeat(level: BeatrixLevel): number {
  return 60_000 / level.bpm / 4;
}

function inside(x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y)
    && x >= 0 && y >= 0 && x < BEATRIX_GRID_SIZE && y < BEATRIX_GRID_SIZE;
}

function emptySnapshot(level: BeatrixLevel, drums: readonly BeatrixDrum[]): BeatrixSnapshot {
  return Object.freeze({
    levelId: level.id,
    bpm: level.bpm,
    gridSize: BEATRIX_GRID_SIZE,
    drums: freezeDrums(drums.map((drum) => ({ ...drum, hit: false, beatsLeft: 0 }))),
    beats: Object.freeze([]),
    target: level.target,
    beatIndex: 0,
    lastBeatIndex: null,
    checks: Object.freeze([]),
    actualColumns: Object.freeze([]),
    cycle: 0,
    cycleCorrect: true,
    lastCycle: null,
    won: false,
    ticks: 0,
    events: Object.freeze([]),
    hitDrumIds: Object.freeze([]),
  });
}

function checkMove(snapshot: BeatrixSnapshot, id: string, x: number, y: number): BeatrixMoveCheck {
  if (snapshot.won) return Object.freeze({ allowed: false, reason: 'won' });
  const drum = snapshot.drums.find((candidate) => candidate.id === id);
  if (!drum) return Object.freeze({ allowed: false, reason: 'unknown-drum' });
  if (drum.fixed) return Object.freeze({ allowed: false, reason: 'fixed-drum' });
  if (!inside(x, y)) return Object.freeze({ allowed: false, reason: 'out-of-bounds' });
  if (snapshot.drums.some((other) => other.id !== id && other.x === x && other.y === y)) {
    return Object.freeze({ allowed: false, reason: 'occupied' });
  }
  return Object.freeze({ allowed: true });
}

const DIRECTION_STEP: Readonly<Record<BeatrixDirection, readonly [number, number]>> = Object.freeze({
  up: Object.freeze([0, -1] as const),
  right: Object.freeze([1, 0] as const),
  down: Object.freeze([0, 1] as const),
  left: Object.freeze([-1, 0] as const),
});

function advanceSnapshot(snapshot: BeatrixSnapshot): BeatrixSnapshot {
  // 1. Move only the previously existing beats; expired beats do not collide.
  const beats: BeatrixBeat[] = [];
  for (const beat of snapshot.beats) {
    const [dx, dy] = DIRECTION_STEP[beat.direction];
    const x = beat.x + dx;
    const y = beat.y + dy;
    if (inside(x, y)) beats.push({ ...beat, x, y });
  }
  // 2. Emit at the source cell. The first emission is on tick/column zero.
  const drums = snapshot.drums.map((drum): BeatrixDrum => {
    let beatsLeft = drum.beatsLeft;
    let hit = false;
    if (drum.fixed) {
      if (beatsLeft === 0) {
        hit = true;
        for (let n = 0; n < drum.emitterDirections.length; n += 1) {
          const direction = drum.emitterDirections[n];
          if (direction === undefined) continue;
          beats.push({
            id: `${drum.id}@${snapshot.ticks}:${n}`,
            x: drum.x, y: drum.y, direction,
          });
        }
        beatsLeft = drum.period ?? 1;
      }
      beatsLeft -= 1;
    }
    return { ...drum, beatsLeft, hit };
  });
  // 3. Preserve original drum and beat order, boolean hit, and first-hit break.
  for (let i = 0; i < drums.length; i += 1) {
    const drum = drums[i];
    if (!drum) continue;
    for (let j = 0; j < beats.length; j += 1) {
      const beat = beats[j];
      if (!beat || drum.x !== beat.x || drum.y !== beat.y) continue;
      drums[i] = { ...drum, hit: true };
      if (drum.direction !== null) beats[j] = { ...beat, direction: drum.direction };
      break;
    }
  }
  const hits = drums.filter((drum) => drum.hit);
  const events = Object.freeze(hits.map((drum) => drum.instrument));
  const actual = Object.freeze([...events].sort());
  let beatIndex = snapshot.beatIndex;
  let lastBeatIndex = snapshot.lastBeatIndex;
  let checks = snapshot.checks;
  let actualColumns = snapshot.actualColumns;
  let cycle = snapshot.cycle;
  let cycleCorrect = snapshot.cycleCorrect;
  let lastCycle = snapshot.lastCycle;
  let won = snapshot.won;
  // After winning, keep music moving but lock the successful comparison strip.
  if (!won) {
    if (beatIndex === 0) {
      checks = [];
      actualColumns = [];
      cycleCorrect = true;
    }
    const expected = snapshot.target[beatIndex];
    if (expected === undefined) throw new Error('Invalid Beatrix comparison phase');
    const correct = actual.length === expected.length
      && actual.every((instrument, index) => instrument === expected[index]);
    checks = Object.freeze([...checks, correct]);
    actualColumns = Object.freeze([...actualColumns, actual]);
    cycleCorrect = cycleCorrect && correct;
    lastBeatIndex = beatIndex;
    beatIndex += 1;
    if (beatIndex === snapshot.target.length) {
      cycle += 1;
      lastCycle = Object.freeze({ cycle, correct: cycleCorrect, checks, actualColumns });
      won = cycleCorrect;
      beatIndex = 0;
    }
  }
  return Object.freeze({
    ...snapshot,
    drums: freezeDrums(drums),
    beats: Object.freeze(beats.map((beat) => Object.freeze(beat))),
    beatIndex, lastBeatIndex, checks, actualColumns, cycle, cycleCorrect, lastCycle, won,
    ticks: snapshot.ticks + 1,
    events,
    hitDrumIds: Object.freeze(hits.map((drum) => drum.id)),
  });
}

function validateArrangement(
  level: BeatrixLevel,
  positions: readonly DrumPosition[],
): readonly BeatrixDrum[] | null {
  const movable = level.drums.filter((drum) => !drum.fixed);
  if (positions.length !== movable.length) return null;
  const byId = new Map<string, DrumPosition>();
  const occupied = new Set(level.drums.filter((drum) => drum.fixed).map((drum) => `${drum.x},${drum.y}`));
  for (const position of positions) {
    if (!position || !inside(position.x, position.y) || byId.has(position.id)) return null;
    if (!movable.some((drum) => drum.id === position.id)) return null;
    const cell = `${position.x},${position.y}`;
    if (occupied.has(cell)) return null;
    occupied.add(cell);
    byId.set(position.id, position);
  }
  return level.drums.map((drum) => {
    const position = byId.get(drum.id);
    return position ? { ...drum, x: position.x, y: position.y } : drum;
  });
}

/** Engines only accept the preserved campaign, including when given a record. */
export function createBeatrixEngine(
  levelOrId: BeatrixLevel | string = BEATRIX_LEVELS[0]?.id ?? 'level1_1',
  positions?: readonly DrumPosition[],
): BeatrixEngine {
  const level = getBeatrixLevel(typeof levelOrId === 'string' ? levelOrId : levelOrId.id);
  const initial = positions === undefined ? level.drums : validateArrangement(level, positions);
  if (!initial) throw new Error(`Invalid Beatrix arrangement for ${level.id}`);
  let current = emptySnapshot(level, initial);
  const engine: BeatrixEngine = {
    level,
    snapshot: () => current,
    advanceBeat: () => { current = advanceSnapshot(current); return current; },
    canMoveDrum: (id, x, y) => checkMove(current, id, x, y),
    moveDrum: (id, x, y) => {
      if (!checkMove(current, id, x, y).allowed) return false;
      current = Object.freeze({
        ...current,
        drums: freezeDrums(current.drums.map((drum) => drum.id === id ? { ...drum, x, y } : drum)),
      });
      return true;
    },
    resetPlayback: () => { current = emptySnapshot(level, current.drums); return current; },
    resetLevel: () => { current = emptySnapshot(level, level.drums); return current; },
    setArrangement: (next) => {
      const drums = validateArrangement(level, next);
      if (!drums) return false;
      current = emptySnapshot(level, drums);
      return true;
    },
    arrangement: () => Object.freeze(current.drums.filter((drum) => !drum.fixed)
      .map((drum) => Object.freeze({ id: drum.id, x: drum.x, y: drum.y }))),
  };
  return Object.freeze(engine);
}

export interface BeatrixTargetPreview {
  readonly levelId: string;
  readonly bpm: number;
  readonly target: readonly (readonly BeatrixInstrument[])[];
  /** Next target column; target.length means the preview has finished. */
  readonly beatIndex: number;
  readonly lastBeatIndex: number | null;
  readonly events: readonly BeatrixInstrument[];
  readonly finished: boolean;
}

/** Optional immutable target audition, entirely separate from the game engine. */
export function createTargetPreview(levelOrId: BeatrixLevel | string): BeatrixTargetPreview {
  const level = getBeatrixLevel(typeof levelOrId === 'string' ? levelOrId : levelOrId.id);
  return Object.freeze({
    levelId: level.id, bpm: level.bpm, target: level.target,
    beatIndex: 0, lastBeatIndex: null, events: Object.freeze([]), finished: false,
  });
}

export function advanceTargetPreview(preview: BeatrixTargetPreview): BeatrixTargetPreview {
  if (preview.finished) return Object.freeze({ ...preview, events: Object.freeze([]) });
  const events = preview.target[preview.beatIndex];
  if (!events) throw new Error('Invalid Beatrix target preview phase');
  return Object.freeze({
    ...preview,
    lastBeatIndex: preview.beatIndex,
    beatIndex: preview.beatIndex + 1,
    events,
    finished: preview.beatIndex + 1 === preview.target.length,
  });
}
