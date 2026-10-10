// SPDX-License-Identifier: GPL-3.0-or-later
// The Pond — Copyright 2013 Zolmeister.
// TypeScript/instance-lifecycle adaptation Copyright 2026 Playgarden contributors.
// Adapted from Zolmeister/pond @ 68fa8b542bff6c405cce83a6bd433e16e7b4e7f6.
// This file is licensed under GPL version 3 or (at your option) any later version.
// Distributed WITHOUT ANY WARRANTY; see the accompanying GPL COPYING and LICENSE.

/** Original procedural fish, raster-derived particles, and infinite pond rules.
 * The host supplies elapsed milliseconds and input; this module owns no timers,
 * event listeners, storage, network requests, external assets, or global state.
 */
export const POND_WIDTH = 780;
export const POND_HEIGHT = 540;
export const POND_TICK_MS = 32;
export const POND_SOURCE_COMMIT = '68fa8b542bff6c405cce83a6bd433e16e7b4e7f6';

export type PondPhase = 'waiting' | 'playing' | 'dying' | 'gameover';
export interface PondPoint { readonly x: number; readonly y: number }
export interface PondInput {
  /** A pointer/joystick vector relative to the centered player. Null releases it. */
  readonly direction?: PondPoint | null;
  /** Most recently pressed first, as in the original bindings. */
  readonly keys?: readonly string[];
}
export interface PondColorSnapshot {
  readonly col: string;
  readonly thick: number;
  readonly loaded: number;
}
export interface PondFishSnapshot {
  readonly id: number;
  readonly AI: boolean;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly dir: number;
  readonly targetDir: number;
  readonly velocity: readonly [number, number];
  readonly colors: readonly PondColorSnapshot[];
  readonly dying: boolean;
  readonly dead: boolean;
  readonly particles: number;
  readonly circles: readonly Readonly<{ x: number; y: number; r: number }>[];
}
export interface PondMetrics {
  readonly playerKills: number;
  readonly aiKills: number;
  readonly deaths: number;
  readonly absorbedColors: number;
  readonly absorbedParticles: number;
  readonly colorTransfers: number;
  readonly barTransfers: number;
  readonly orbs: number;
  readonly celebrations: number;
  readonly spawnedFish: number;
  readonly visitedZones: number;
}
export interface PondSnapshot {
  readonly phase: PondPhase;
  readonly disposed: boolean;
  readonly width: number;
  readonly height: number;
  readonly frame: number;
  /** Simulated time in milliseconds, at the original fixed 32 ms cadence. */
  readonly time: number;
  readonly gameoverIn: number | null;
  readonly player: PondFishSnapshot;
  readonly fish: readonly PondFishSnapshot[];
  readonly metrics: PondMetrics;
  readonly input: Readonly<{ x: number; y: number; active: boolean; keys: readonly string[] }>;
  readonly progress: Readonly<{
    barColors: number;
    barLoaded: number;
    barWidth: number;
    barTargetWidth: number;
    orbs: number;
    orbsLoaded: number;
    playerColors: number;
    loadedPlayerColors: number;
    pendingBarTransfers: number;
    pendingOrbTransfers: number;
  }>;
  readonly particles: Readonly<{ fish: number; colors: number; orbs: number; celebration: number }>;
  readonly zones: readonly PondPoint[];
  readonly currentZone: PondPoint;
}
export interface PondEngine {
  /** Start or restart a complete run. The returned snapshot is read-only. */
  start(): PondSnapshot;
  /** Advance the existing run; does not start a waiting/gameover run. */
  step(dtMs: number, input?: PondInput): PondSnapshot;
  snapshot(): PondSnapshot;
  render(): void;
  dispose(): void;
}

type RGB = readonly [number, number, number];
type Point = { x: number; y: number };
type Circle = Point & { r: number };
type Stripe = { col: RGB; thick: number; loaded: number };
type BarColor = { col: RGB; loaded: number };
type Surface = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
type Fish = Point & Surface & {
  id: number; AI: boolean; size: number; dir: number; targetDir: number;
  frame: number; oscillation: number; curv: number; AIDir: number;
  circles: Circle[]; circleMap: [number, number][]; colors: Stripe[];
  dying: boolean; dead: boolean; deathParticles: Particle[]; bodyColor: RGB;
  velocity: [number, number]; accel: [number, number]; isInput: boolean;
};
type Particle = Point & {
  col: RGB; target: Point; dir: number; r: number; speed: number;
  arcSpeed: number; targetFish?: Fish;
};
type Bar = Point & Surface & { colors: BarColor[]; targetX: number };
type Orb = Point & { colors: RGB[]; size: number; targetSize: number };
type Orbs = Point & Surface & { balls: Orb[] };
type ColorFlight = { particles: Particle[]; credited: boolean };
type OrbFlight = ColorFlight & { colors: RGB[] };
type MutableMetrics = { -readonly [K in keyof PondMetrics]: PondMetrics[K] };

const PALETTE: readonly RGB[] = [[105, 210, 231], [167, 219, 216], [224, 228, 204], [243, 134, 48], [250, 105, 0]];
const CIRCLE_RATIOS = [11 / 14, 12 / 15, 10 / 15, 7 / 15, 4 / 14, 3 / 15];
const ZONE_DIRECTIONS = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
const KEY_NAMES: Readonly<Record<string, string>> = {
  ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left',
  w: 'up', W: 'up', KeyW: 'up', d: 'right', D: 'right', KeyD: 'right',
  s: 'down', S: 'down', KeyS: 'down', a: 'left', A: 'left', KeyA: 'left',
  up: 'up', right: 'right', down: 'down', left: 'left',
};
const KEY_ANGLES: Readonly<Record<string, number>> = {
  up: -Math.PI / 2, 'right up': -Math.PI / 4, right: 0,
  'down right': Math.PI / 4, down: Math.PI / 2, 'down left': Math.PI * 3 / 4,
  left: Math.PI, 'left up': -Math.PI * 3 / 4,
};
const rgb = (col: RGB): string => `rgb(${col[0]},${col[1]},${col[2]})`;
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const towards = (a: Point, b: Point): number => Math.atan2(a.y - b.y, a.x - b.x);
const rotate = (x: number, y: number, dir: number): [number, number] =>
  [Math.cos(dir) * x - Math.sin(dir) * y, Math.sin(dir) * x + Math.cos(dir) * y];

/** Keep the original shortest-turn implementation and its angular speed. */
function turn(dir: number, targetDir: number, arcSpeed: number): number {
  const moveDir = Math.abs(dir - targetDir) > Math.PI ? -1 : 1;
  if (dir > targetDir) dir -= moveDir * Math.min(arcSpeed, Math.abs(dir - targetDir));
  else if (dir < targetDir) dir += moveDir * Math.min(arcSpeed, Math.abs(dir - targetDir));
  if (dir > Math.PI) dir -= Math.PI * 2;
  if (dir < -Math.PI) dir += Math.PI * 2;
  return dir;
}

export function createPondEngine(
  target: HTMLCanvasElement | CanvasRenderingContext2D,
  width = POND_WIDTH,
  height = POND_HEIGHT,
): PondEngine {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('Pond requires a positive finite logical canvas size.');
  }
  width = Math.floor(width);
  height = Math.floor(height);
  const output = 'getContext' in target ? target.getContext('2d') : target;
  if (!output) throw new Error('Pond requires a Canvas 2D context.');
  const doc = output.canvas.ownerDocument;
  output.canvas.width = width;
  output.canvas.height = height;
  let phase: PondPhase = 'waiting';
  let disposed = false;
  let frame = 0;
  let lag = 0;
  let nextFishId = 1;
  let lastColor: RGB | undefined;
  let deathWait: number | null = null;
  let effectiveInput = { x: 0, y: 0, active: false, keys: [] as string[] };
  let metrics = emptyMetrics();
  let player = makeFish(false, 0, 0, 20, 0, 0);
  let fishes: Fish[] = [player];
  let currentZone: Point = { x: 0, y: 0 };
  let zones: Point[] = [currentZone];
  let bar = makeBar();
  let orbs = makeOrbs();
  let colorFlights: ColorFlight[] = [];
  let orbFlights: OrbFlight[] = [];
  let endParticles: Particle[] = [];

  function emptyMetrics(): MutableMetrics {
    return { playerKills: 0, aiKills: 0, deaths: 0, absorbedColors: 0,
      absorbedParticles: 0, colorTransfers: 0, barTransfers: 0, orbs: 0,
      celebrations: 0, spawnedFish: 0, visitedZones: 0 };
  }
  function surface(w: number, h: number): Surface {
    const canvas = doc.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(w));
    canvas.height = Math.max(1, Math.floor(h));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Pond requires a Canvas 2D raster surface.');
    return { canvas, ctx };
  }
  function randomColor(): RGB {
    let color: RGB;
    do { color = PALETTE[Math.floor(Math.random() * PALETTE.length)]; }
    while (color === lastColor);
    lastColor = color;
    return color;
  }
  function makeFish(AI: boolean, x: number, y: number, size: number, dir: number, fishFrame: number): Fish {
    const bodyColor = randomColor();
    const fish: Fish = {
      ...surface(size * 4.4, Math.floor(size) * 2.3), id: nextFishId++, AI,
      x, y, size, dir, targetDir: dir, frame: fishFrame, oscillation: Math.sin(fishFrame / 5),
      curv: 0, AIDir: 1, circles: CIRCLE_RATIOS.map(() => ({ x, y, r: 1 })),
      circleMap: [], colors: [{ col: randomColor(), thick: 4, loaded: 1 }],
      dying: false, dead: false, deathParticles: [], bodyColor,
      velocity: [0, 0], accel: [0, 0], isInput: AI,
    };
    setSize(fish, size);
    updateCircles(fish);
    return fish;
  }
  function setSize(fish: Fish, size: number): void {
    fish.size = size;
    // Original DOM canvas integer dimensions, including floor(size) before height.
    fish.canvas.width = Math.max(1, Math.floor(size * 4.4));
    fish.canvas.height = Math.max(1, Math.floor(Math.floor(size) * 2.3));
    fish.ctx.translate(fish.canvas.width / 2 + size, fish.canvas.height / 2);
    for (let i = 0; i < fish.circles.length; i++) fish.circles[i].r = size * CIRCLE_RATIOS[i];
    fish.circleMap = [[size / 5, size / 40], [-size / 3, size / 30],
      [-size, size / 20], [-size * 1.6, size / 15], [-size * 2.2, size / 12], [-size * 2.8, -size / 30]];
  }
  function updateCircles(fish: Fish): void {
    for (let i = 0; i < fish.circles.length; i++) {
      const pos = rotate(fish.circleMap[i][0], fish.circleMap[i][1] * fish.oscillation, fish.dir);
      fish.circles[i].x = fish.x + pos[0];
      fish.circles[i].y = fish.y + pos[1];
    }
  }
  function drawFishBody(fish: Fish): void {
    const { ctx, size, curv } = fish;
    const o = fish.oscillation;
    ctx.strokeStyle = rgb(fish.bodyColor);
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = -1; i < 2; i += 2) {
      ctx.moveTo(size, 0);
      ctx.bezierCurveTo(size * (14 / 15), i * size + size / 30 * o + curv / 3,
        -size / 2, i * size + size / 30 * o + curv / 2,
        -size * 2, i * size / 3 + size / 15 * o + curv);
      ctx.bezierCurveTo(-size * 2.5, i * size / 6 + size / 10 * o + curv,
        -size * 3, i * size / 4 - size / 15 * o + curv / 2,
        -size * 3, -size / 15 * o + curv / 3);
    }
    ctx.stroke();
  }
  function drawFishColors(fish: Fish): void {
    const { ctx, size, curv, colors } = fish;
    const o = fish.oscillation;
    ctx.lineWidth = 2;
    let colorSize = size - size / 4;
    const thicknessSum = colors.reduce((sum, color) => sum + color.thick * color.loaded, 0);
    if (thicknessSum <= 0) return;
    const widths = colors.map(color => color.thick / thicknessSum * colorSize);
    for (let c = 0; c < colors.length && colorSize >= 0; c++) {
      ctx.beginPath();
      for (let i = -1; i < 2; i += 2) {
        ctx.moveTo(colorSize, 0);
        ctx.bezierCurveTo(colorSize * (14 / 15), i * colorSize + size / 30 * o + curv / 3,
          -colorSize / 2, i * colorSize + size / 30 * o + curv / 2,
          -colorSize * 2.75, size / 15 * o * colors[c].loaded + curv);
      }
      ctx.strokeStyle = rgb(colors[c].col);
      ctx.stroke();
      colorSize -= widths[c];
    }
  }
  function rasterFish(fish: Fish): void {
    fish.ctx.clearRect(-fish.canvas.width, -fish.canvas.height, fish.canvas.width * 2, fish.canvas.height * 2);
    drawFishBody(fish);
    drawFishColors(fish);
  }
  function makeParticle(x: number, y: number, col: RGB, targetPoint: Point, dir: number,
    radius = 2, speed = 8, arcSpeed = 0.4, targetFish?: Fish): Particle {
    return { x, y, col, target: targetPoint, dir, r: radius, speed, arcSpeed, targetFish };
  }
  function fishParticles(fish: Fish, targetPoint: Point, targetFish?: Fish): Particle[] {
    // Never sample a blank sprite just resized by an absorbed particle, or a stale
    // prior render: physics must not depend on how often the host paints the canvas.
    rasterFish(fish);
    const particles: Particle[] = [];
    const pixels = fish.ctx.getImageData(0, 0, fish.canvas.width, fish.canvas.height).data;
    // Desktop upstream density. No Cocoon mobile sixfold sampling/growth modifier.
    const stride = 36 * Math.ceil(fish.size / 20);
    for (let i = 0; i < pixels.length; i += stride) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      if (!r && !g && !b) continue;
      let x = (i / 4) % fish.canvas.width - fish.canvas.width / 2 - fish.size;
      let y = Math.floor(i / 4 / fish.canvas.width) - fish.canvas.height / 2;
      [x, y] = rotate(x, y, fish.dir);
      particles.push(makeParticle(fish.x + x, fish.y + y, [r, g, b], targetPoint,
        Math.PI * Math.random() * 2 - Math.PI, fish.size / 20, 8, 0.4, targetFish));
    }
    return particles;
  }
  function panelParticles(panel: Surface, targetPoint: Point, yOffset: number,
    speed: number, arcSpeed: number): Particle[] {
    const particles: Particle[] = [];
    const pixels = panel.ctx.getImageData(0, 0, panel.canvas.width, panel.canvas.height).data;
    for (let i = 0; i < pixels.length; i += 36 * 10) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      if (!r && !g && !b) continue;
      const x = (i / 4) % panel.canvas.width;
      const y = Math.floor(i / 4 / panel.canvas.width) + Math.random() * 2 + 2;
      particles.push(makeParticle(x, yOffset + y, [r, g, b], targetPoint,
        towards(targetPoint, { x, y }), 2, speed, arcSpeed));
    }
    return particles;
  }
  function particlePhysics(particle: Particle): number {
    particle.dir = turn(particle.dir, towards(particle.target, particle), particle.arcSpeed);
    const dist = distance(particle.target, particle);
    const cosine = Math.cos(particle.dir), sine = Math.sin(particle.dir);
    particle.x += cosine * particle.speed + (Math.random() * 2 - 1) + cosine / (dist + 1);
    particle.y += sine * particle.speed + (Math.random() * 2 - 1) + sine / (dist + 1);
    particle.r = Math.max(0, Math.log(dist) / 4);
    return dist;
  }
  function drawParticle(particle: Particle, ctx: CanvasRenderingContext2D): void {
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgb(particle.col);
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  function makeBar(): Bar {
    const result: Bar = { ...surface(width, 6), colors: [], x: 0, y: 0, targetX: 0 };
    result.ctx.lineWidth = 2;
    result.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    result.ctx.shadowBlur = 10;
    result.ctx.shadowOffsetY = -5;
    result.ctx.shadowOffsetX = -5;
    return result;
  }
  function drawBar(): void {
    if (!bar.colors.length) return;
    const sum = bar.colors.reduce((value, color) => value + color.loaded, 0);
    if (sum <= 0) return;
    let x = 0;
    for (const color of bar.colors) {
      const partWidth = color.loaded / sum * bar.x;
      bar.ctx.strokeStyle = rgb(color.col);
      bar.ctx.strokeRect(x, 0, partWidth, 6);
      x += partWidth;
    }
  }
  function addBarColor(): void {
    bar.colors.push({ col: randomColor(), loaded: 0 });
    bar.targetX = width * (bar.colors.length / 10);
    metrics.barTransfers++;
  }
  function makeOrbs(): Orbs {
    const result = { ...surface(width, 32), x: 28, y: height - 36, balls: [] as Orb[] };
    result.ctx.lineWidth = 2;
    return result;
  }
  function drawOrbs(): void {
    orbs.ctx.clearRect(0, 0, width, 32);
    for (const ball of orbs.balls) {
      for (let i = ball.colors.length - 1; i >= 0; i--) {
        orbs.ctx.strokeStyle = rgb(ball.colors[i]);
        orbs.ctx.beginPath();
        orbs.ctx.arc(ball.x, ball.y, ball.size / 2 * (i + 1), 0, Math.PI * 2);
        orbs.ctx.stroke();
      }
    }
  }
  function addOrb(colors: RGB[]): void {
    const x = 28 + orbs.balls.length * (width / 13 + 14);
    orbs.balls.push({ x, y: 16, colors, size: 1, targetSize: 14 });
    metrics.orbs++;
  }
  function progressionPhysics(): void {
    // Resolve the current objects on every fixed tick. The original draw closure
    // retained replaced bars/orbs across catch-up ticks and could repeat awards.
    if (bar.x < bar.targetX) bar.x += 1;
    for (const color of bar.colors) if (color.loaded < 1) color.loaded += 0.012;
    if (bar.colors.length >= 10 && bar.colors.reduce((sum, color) => sum + color.loaded, 0) >= 10) {
      drawBar();
      const particles = panelParticles(bar, orbs, 0, 20, 1.2);
      orbFlights.push({ particles, credited: false, colors: bar.colors.slice(0, 2).map(color => color.col) });
      bar = makeBar();
    }
    for (let flightIndex = colorFlights.length - 1; flightIndex >= 0; flightIndex--) {
      const flight = colorFlights[flightIndex];
      for (let i = flight.particles.length - 1; i >= 0; i--) {
        if (particlePhysics(flight.particles[i]) < 10) {
          flight.particles.splice(i, 1);
          // Each genuine four-color flight is credited once, even if flights overlap.
          if (!flight.credited && bar.colors.length < 10) { addBarColor(); flight.credited = true; }
        }
      }
      // If ten segments are animating, preserve the completed flight until reset.
      if (!flight.particles.length && !flight.credited && bar.colors.length < 10) {
        addBarColor(); flight.credited = true;
      }
      if (!flight.particles.length && flight.credited) colorFlights.splice(flightIndex, 1);
    }
    let grownOrbs = 0;
    for (const ball of orbs.balls) {
      if (ball.size < ball.targetSize) ball.size += 0.2;
      if (ball.size >= ball.targetSize) grownOrbs++;
    }
    if (grownOrbs === 10) {
      drawOrbs();
      endParticles = panelParticles(orbs, player, orbs.y, 8, 0.16);
      for (const particle of endParticles) { particle.x += player.x - width / 2; particle.y += player.y - height / 2; }
      metrics.celebrations++;
      orbs = makeOrbs();
    }
    for (let flightIndex = orbFlights.length - 1; flightIndex >= 0; flightIndex--) {
      const flight = orbFlights[flightIndex];
      for (let i = flight.particles.length - 1; i >= 0; i--) {
        if (particlePhysics(flight.particles[i]) < 10) {
          flight.particles.splice(i, 1);
          if (!flight.credited && orbs.balls.length < 10) { addOrb(flight.colors); flight.credited = true; }
        }
      }
      if (!flight.particles.length && !flight.credited && orbs.balls.length < 10) {
        addOrb(flight.colors); flight.credited = true;
      }
      if (!flight.particles.length && flight.credited) {
        orbs.x = 28 + orbs.balls.length * (width / 13 + 14);
        orbFlights.splice(flightIndex, 1);
      }
    }
    // The original celebration is an ongoing orbiting swarm, replaced by the next.
    for (const particle of endParticles) particlePhysics(particle);
  }
  function fishPhysics(fish: Fish): void {
    fish.oscillation = Math.sin(fish.frame / 3);
    const moveDir = Math.abs(fish.dir - fish.targetDir) > Math.PI ? -1 : 1;
    const diff = fish.dir > fish.targetDir ? fish.dir - fish.targetDir * moveDir
      : fish.dir < fish.targetDir ? fish.targetDir - fish.dir * moveDir : 0;
    fish.curv = fish.size / 15 * diff || 0;
    for (const color of fish.colors) if (color.loaded < 1) color.loaded += 0.01;
    if (fish.dying) {
      for (let i = fish.deathParticles.length - 1; i >= 0; i--) {
        const particle = fish.deathParticles[i];
        const recipient = particle.targetFish;
        if (!recipient) continue;
        if (particlePhysics(particle) < recipient.size / 8 + 10) {
          fish.deathParticles.splice(i, 1);
          setSize(recipient, recipient.size + 0.001);
          if (recipient === player) metrics.absorbedParticles++;
          // The original transfers every stripe on the first absorbed raster pixel.
          while (fish.colors.length) {
            const color = fish.colors.pop()!;
            color.loaded = 0;
            recipient.colors.push(color);
            if (recipient === player) metrics.absorbedColors++;
          }
        }
      }
      if (!fish.deathParticles.length) fish.dead = true;
    } else {
      // Preserve original collision/movement order (circles precede this tick's move).
      updateCircles(fish);
      if (fish.AI) {
        if (Math.random() < 0.01) fish.AIDir *= -1;
        fish.targetDir = (fish.targetDir + Math.random() / 100 * fish.AIDir) % Math.PI;
      }
      fish.dir = turn(fish.dir, fish.targetDir, 0.14);
      fish.accel[0] = fish.isInput ? Math.cos(fish.dir) : 0;
      fish.accel[1] = fish.isInput ? Math.sin(fish.dir) : 0;
      const maxSpeed = fish.AI ? 2 : 6;
      for (let axis = 0; axis < 2; axis++) {
        fish.velocity[axis] += fish.accel[axis];
        fish.velocity[axis] = Math.max(-maxSpeed, Math.min(maxSpeed, fish.velocity[axis]));
        if (fish.velocity[axis] > 0) fish.velocity[axis] -= Math.min(0.1, fish.velocity[axis]);
        if (fish.velocity[axis] < 0) fish.velocity[axis] -= Math.max(-0.1, fish.velocity[axis]);
      }
      fish.x += fish.velocity[0] * Math.abs(Math.cos(fish.dir));
      fish.y += fish.velocity[1] * Math.abs(Math.sin(fish.dir));
    }
    fish.frame++;
  }
  function collide(a: Fish, b: Fish): boolean {
    if (a.dying || b.dying || a.dead || b.dead || distance(a, b) > a.size * 5 + b.size * 5) return false;
    for (const c1 of a.circles) for (const c2 of b.circles) if (distance(c1, c2) <= c1.r + c2.r) return true;
    return false;
  }
  function killFish(victim: Fish, winner: Fish): void {
    victim.dying = true;
    victim.deathParticles = fishParticles(victim, winner, winner);
    if (winner === player) metrics.playerKills++;
    else if (victim.AI) metrics.aiKills++;
    if (victim === player) { phase = 'dying'; metrics.deaths++; player.isInput = false; }
  }
  function inPhysicsRange(fish: Fish): boolean {
    return Math.abs(fish.x - player.x) < width && Math.abs(fish.y - player.y) < height;
  }
  function allFishPhysics(): void {
    for (let i = fishes.length - 1; i >= 0; i--) {
      const fish = fishes[i];
      if (fish.dead) {
        if (fish === player && deathWait === null) deathWait = 4000;
        fishes.splice(i, 1);
        continue;
      }
      if (inPhysicsRange(fish)) {
        fishPhysics(fish);
        for (let j = i - 1; j >= 0; j--) {
          const other = fishes[j];
          if (inPhysicsRange(other) && collide(fish, other)) {
            if (fish.size >= other.size) killFish(other, fish);
            else killFish(fish, other);
          }
        }
      }
      if (distance(fish, player) > Math.max(width, height) * 1.5) fish.dead = true;
    }
  }
  function adjacentZones(): Point[] {
    return ZONE_DIRECTIONS.map(([x, y]) => ({ x: x * width + currentZone.x, y: y * height + currentZone.y }));
  }
  function spawn(zone: Point): void {
    const count = (Math.floor(Math.random() * 3) + 1) * width * height / (500 * 500);
    for (let i = 0; i < count; i++) {
      const x = zone.x + Math.floor(width * Math.random()) - width / 2;
      const y = zone.y + Math.floor(height * Math.random()) - height / 2;
      const size = Math.random() > 0.5 ? player.size + Math.floor(Math.random() * 10)
        : player.size - Math.floor(Math.random() * 10);
      fishes.push(makeFish(true, x, y, size, Math.random() * Math.PI * 2 - Math.PI, Math.random() * Math.PI));
      metrics.spawnedFish++;
    }
  }
  function spawnerPhysics(): void {
    for (let i = zones.length - 1; i >= 0; i--) {
      const zone = zones[i];
      if (zone === currentZone) continue;
      if (Math.abs(player.x - zone.x) < width / 2 && Math.abs(player.y - zone.y) < height / 2) {
        currentZone = zone;
        metrics.visitedZones++;
        const fresh = adjacentZones().filter(next => !zones.some(old => old.x === next.x && old.y === next.y));
        for (const next of fresh) spawn(next);
        zones.push(...fresh);
      }
      if (distance(zone, player) > Math.max(width, height) * 2) zones.splice(i, 1);
    }
  }
  function playerScore(): void {
    if (player.dying || player.dead || player.colors.length <= 4 || player.colors.some(color => color.loaded < 1)) return;
    const particles = fishParticles(player, bar);
    for (const particle of particles) { particle.x += -player.x + width / 2; particle.y += -player.y + height / 2; }
    colorFlights.push({ particles, credited: false });
    player.colors.splice(0, 4);
    metrics.colorTransfers++;
  }
  function updateInput(input: PondInput): void {
    const keys = (input.keys ?? []).map(key => KEY_NAMES[key]).filter((key): key is string => !!key);
    let x = 0, y = 0, active = false;
    if ('direction' in input) {
      const vector = input.direction;
      if (vector && Number.isFinite(vector.x) && Number.isFinite(vector.y)) {
        x = vector.x; y = vector.y; active = x !== 0 || y !== 0;
      }
    } else {
      const selected = [...new Set(keys)].slice(0, 2).sort().join(' ');
      const angle = KEY_ANGLES[selected];
      // The upstream referenced an undefined `valid` here; invalid combinations coast.
      if (angle !== undefined) { x = Math.cos(angle); y = Math.sin(angle); active = true; }
    }
    effectiveInput = { x, y, active, keys };
    player.isInput = phase === 'playing' && active;
    player.targetDir = player.isInput ? Math.atan2(y, x) : player.dir;
  }
  function physics(): void {
    progressionPhysics();
    spawnerPhysics();
    allFishPhysics();
    playerScore();
    frame++;
    if (deathWait !== null) {
      deathWait -= POND_TICK_MS;
      if (deathWait <= 0) { deathWait = 0; phase = 'gameover'; }
    }
  }
  function frozenFish(fish: Fish): PondFishSnapshot {
    return Object.freeze({
      id: fish.id, AI: fish.AI, x: fish.x, y: fish.y, size: fish.size,
      dir: fish.dir, targetDir: fish.targetDir,
      velocity: Object.freeze([fish.velocity[0], fish.velocity[1]]) as readonly [number, number],
      colors: Object.freeze(fish.colors.map(color => Object.freeze({ col: rgb(color.col), thick: color.thick, loaded: color.loaded }))),
      dying: fish.dying, dead: fish.dead, particles: fish.deathParticles.length,
      circles: Object.freeze(fish.circles.map(circle => Object.freeze({ ...circle }))),
    });
  }
  function snapshot(): PondSnapshot {
    return Object.freeze({
      phase, disposed, width, height, frame, time: frame * POND_TICK_MS, gameoverIn: deathWait,
      player: frozenFish(player), fish: Object.freeze(fishes.map(frozenFish)),
      metrics: Object.freeze({ ...metrics }),
      input: Object.freeze({ ...effectiveInput, keys: Object.freeze([...effectiveInput.keys]) }),
      progress: Object.freeze({
        barColors: bar.colors.length, barLoaded: bar.colors.reduce((sum, color) => sum + Math.min(1, color.loaded), 0),
        barWidth: bar.x, barTargetWidth: bar.targetX, orbs: orbs.balls.length,
        orbsLoaded: orbs.balls.filter(ball => ball.size >= ball.targetSize).length,
        playerColors: player.colors.length, loadedPlayerColors: player.colors.filter(color => color.loaded >= 1).length,
        pendingBarTransfers: colorFlights.filter(flight => !flight.credited).length,
        pendingOrbTransfers: orbFlights.filter(flight => !flight.credited).length,
      }),
      particles: Object.freeze({
        fish: fishes.reduce((sum, fish) => sum + fish.deathParticles.length, 0),
        colors: colorFlights.reduce((sum, flight) => sum + flight.particles.length, 0),
        orbs: orbFlights.reduce((sum, flight) => sum + flight.particles.length, 0), celebration: endParticles.length,
      }),
      zones: Object.freeze(zones.map(zone => Object.freeze({ ...zone }))),
      currentZone: Object.freeze({ ...currentZone }),
    });
  }
  function render(): void {
    if (disposed) return;
    const ctx = output!;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);
    drawBar();
    ctx.drawImage(bar.canvas, 0, 0);
    for (const flight of colorFlights) for (const particle of flight.particles) drawParticle(particle, ctx);
    for (const flight of orbFlights) for (const particle of flight.particles) drawParticle(particle, ctx);
    drawOrbs();
    ctx.drawImage(orbs.canvas, 0, orbs.y);
    ctx.translate(-player.x + width / 2, -player.y + height / 2);
    for (const particle of endParticles) drawParticle(particle, ctx);
    for (const fish of fishes) {
      if (Math.abs(fish.x - player.x) >= width / 2 + 100 || Math.abs(fish.y - player.y) >= height / 2 + 100) continue;
      if (fish.dying) { for (const particle of fish.deathParticles) drawParticle(particle, ctx); continue; }
      rasterFish(fish);
      ctx.save();
      ctx.translate(fish.x, fish.y);
      ctx.rotate(fish.dir);
      ctx.drawImage(fish.canvas, -fish.canvas.width / 2 - fish.size, -fish.canvas.height / 2);
      ctx.restore();
    }
    ctx.restore();
  }
  function start(): PondSnapshot {
    if (disposed) return snapshot();
    phase = 'playing'; frame = 0; lag = 0; nextFishId = 1; lastColor = undefined; deathWait = null;
    metrics = emptyMetrics();
    player = makeFish(false, 0, 0, 20, 0, 0);
    fishes = [player];
    currentZone = { x: 0, y: 0 };
    zones = adjacentZones();
    for (const zone of zones) spawn(zone);
    zones.push(currentZone);
    metrics.visitedZones = 1;
    bar = makeBar(); orbs = makeOrbs(); colorFlights = []; orbFlights = []; endParticles = [];
    updateInput({});
    render();
    return snapshot();
  }
  function step(dtMs: number, input: PondInput = {}): PondSnapshot {
    if (disposed || phase === 'waiting' || phase === 'gameover') return snapshot();
    updateInput(input);
    if (!Number.isFinite(dtMs) || dtMs < 0) return snapshot();
    lag += dtMs;
    let cycles = 17;
    while (lag >= POND_TICK_MS && cycles > 0 && isRunning()) {
      physics(); lag -= POND_TICK_MS; cycles--;
    }
    // Original bounded catch-up: discarded lag does not synthesize play or rewards.
    if (lag / POND_TICK_MS > 75) lag = 0;
    return snapshot();
  }
  function isRunning(): boolean { return phase === 'playing' || phase === 'dying'; }
  function dispose(): void {
    disposed = true;
    fishes = []; zones = []; colorFlights = []; orbFlights = []; endParticles = [];
  }
  render();
  return Object.freeze({ start, step, snapshot, render, dispose });
}
