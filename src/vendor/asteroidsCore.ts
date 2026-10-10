/*
 * Canvas Asteroids gameplay adaptation.
 * Original: https://github.com/dmcinnes/HTML5-Asteroids
 * Pinned source: 930301cbda83ed3b120f64b801d937d077ee2da0, game.js
 * Copyright (c) 2010 Doug McInnes
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Adaptation and new modifications: GPL-3.0-only.
 * The original MIT permission and attribution above remain applicable to the
 * original portions. The adaptation removes browser/global dependencies,
 * replaces stale linked-grid collision state, makes destruction single-use,
 * and resets all lifecycle state on restart. No upstream font, audio, jQuery,
 * typeface renderer, or requestAnimationFrame shim is included here.
 */

export const ASTEROIDS_WIDTH = 780;
export const ASTEROIDS_HEIGHT = 540;

/** Flat x,y pairs, in original local coordinates; positive rotation is clockwise. */
export const SHIP_POINTS: readonly number[] = Object.freeze([-5, 4, 0, -12, 5, 4]);
export const EXHAUST_POINTS: readonly number[] = Object.freeze([-3, 6, 0, 11, 3, 6]);
export const ASTEROID_POINTS: readonly number[] = Object.freeze([
  -10, 0, -5, 7, -3, 4, 1, 10, 5, 4, 10, 0, 5, -6, 2, -10, -4, -10, -4, -5,
]);
export const UFO_POINTS: readonly number[] = Object.freeze([
  -20, 0, -12, -4, 12, -4, 20, 0, 12, 4, -12, 4, -20, 0, 20, 0,
]);
export const UFO_TOP_POINTS: readonly number[] = Object.freeze([-8, -4, -6, -6, 6, -6, 8, -4]);
export const UFO_BOTTOM_POINTS: readonly number[] = Object.freeze([8, 4, 6, 6, -6, 6, -8, 4]);

export type AsteroidsInput = Readonly<{
  left: boolean;
  right: boolean;
  thrust: boolean;
  fire: boolean;
}>;
export type AsteroidsPhase = 'waiting' | 'playing' | 'respawning' | 'between-waves' | 'gameover';
export type AsteroidsSnapshot = Readonly<{
  phase: AsteroidsPhase;
  elapsedMs: number;
  wave: number;
  score: number;
  /** Total remaining ships, including the active ship (the original has two reserves). */
  lives: number;
  ship: Readonly<{
    x: number; y: number; rotation: number; visible: boolean; thrusting: boolean;
    vx: number; vy: number;
  }>;
  asteroids: readonly Readonly<{
    id: number; x: number; y: number; rotation: number; scale: number; points: readonly number[];
    vx: number; vy: number;
  }>[];
  bullets: readonly Readonly<{ x: number; y: number }>[];
  alien: Readonly<{ x: number; y: number; visible: boolean; vx: number; vy: number }>;
  alienBullets: readonly Readonly<{ x: number; y: number; vx: number; vy: number }>[];
  /** Each line is [x1,y1,x2,y2] in local coordinates, to be multiplied by scale. */
  explosions: readonly Readonly<{ x: number; y: number; scale: number; lines: readonly (readonly number[])[] }>[];
  metrics: Readonly<{ shots: number; hits: number; splitEvents: number; deaths: number; wraps: number }>;
}>;
export type AsteroidsEngine = Readonly<{
  start(): void;
  step(milliseconds: number, input: AsteroidsInput): void;
  snapshot(): AsteroidsSnapshot;
}>;

type Position = { x: number; y: number };
type Motion = Position & { vx: number; vy: number; rotation: number; rotationVelocity: number };
type Ship = Motion & { visible: boolean; thrusting: boolean; cooldown: number };
type Asteroid = Motion & { id: number; scale: number; points: number[]; alive: boolean };
type Bullet = Position & { vx: number; vy: number; age: number; visible: boolean };
type Alien = Position & { vx: number; vy: number; visible: boolean; entered: boolean; cooldown: number };
type Explosion = Position & { scale: number; lines: number[][] };

const GRID_SIZE = 60;
const GRID_COLUMNS = ASTEROIDS_WIDTH / GRID_SIZE;
const GRID_ROWS = ASTEROIDS_HEIGHT / GRID_SIZE;
const DEGREES_TO_RADIANS = Math.PI / 180;
const NEUTRAL_INPUT: AsteroidsInput = Object.freeze({ left: false, right: false, thrust: false, fire: false });

function modulo(value: number, period: number): number {
  return ((value % period) + period) % period;
}

function gridCell(position: Position): readonly [number, number] {
  return [
    modulo(Math.floor(position.x / GRID_SIZE), GRID_COLUMNS),
    modulo(Math.floor(position.y / GRID_SIZE), GRID_ROWS),
  ];
}

function isNeighborCell(a: Position, b: Position): boolean {
  const [ax, ay] = gridCell(a);
  const [bx, by] = gridCell(b);
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.min(dx, GRID_COLUMNS - dx) <= 1 && Math.min(dy, GRID_ROWS - dy) <= 1;
}

function transformedPoints(points: readonly number[], rotation: number, scale: number): number[] {
  const angle = rotation * DEGREES_TO_RADIANS;
  const cos = Math.cos(angle) * scale;
  const sin = Math.sin(angle) * scale;
  const result: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    result.push(cos * points[i] - sin * points[i + 1], sin * points[i] + cos * points[i + 1]);
  }
  return result;
}

function pointOnSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number): boolean {
  const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
  return Math.abs(cross) < 1e-8 &&
    x >= Math.min(ax, bx) - 1e-8 && x <= Math.max(ax, bx) + 1e-8 &&
    y >= Math.min(ay, by) - 1e-8 && y <= Math.max(ay, by) + 1e-8;
}

function pointInPolygon(x: number, y: number, polygon: readonly number[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 2; i < polygon.length; j = i, i += 2) {
    const ax = polygon[i];
    const ay = polygon[i + 1];
    const bx = polygon[j];
    const by = polygon[j + 1];
    if (pointOnSegment(x, y, ax, ay, bx, by)) return true;
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

function segmentsCross(ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number): boolean {
  const abC = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const abD = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  const cdA = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const cdB = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) &&
      ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) return true;
  return (Math.abs(abC) < 1e-8 && pointOnSegment(cx, cy, ax, ay, bx, by)) ||
    (Math.abs(abD) < 1e-8 && pointOnSegment(dx, dy, ax, ay, bx, by)) ||
    (Math.abs(cdA) < 1e-8 && pointOnSegment(ax, ay, cx, cy, dx, dy)) ||
    (Math.abs(cdB) < 1e-8 && pointOnSegment(bx, by, cx, cy, dx, dy));
}

/** Local polygons are compared across the nearest torus image, including corner seams. */
function polygonsTouch(a: Position, aPoints: readonly number[], b: Position,
  bPoints: readonly number[], wrapHorizontal = true): boolean {
  const dx = wrapHorizontal
    ? modulo(b.x - a.x + ASTEROIDS_WIDTH / 2, ASTEROIDS_WIDTH) - ASTEROIDS_WIDTH / 2
    : b.x - a.x;
  const dy = modulo(b.y - a.y + ASTEROIDS_HEIGHT / 2, ASTEROIDS_HEIGHT) - ASTEROIDS_HEIGHT / 2;
  let aRadius = 0;
  let bRadius = 0;
  for (let i = 0; i < aPoints.length; i += 2) aRadius = Math.max(aRadius, Math.hypot(aPoints[i], aPoints[i + 1]));
  for (let i = 0; i < bPoints.length; i += 2) bRadius = Math.max(bRadius, Math.hypot(bPoints[i], bPoints[i + 1]));
  if (Math.hypot(dx, dy) > aRadius + bRadius) return false;
  const translated = bPoints.map((value, i) => value + (i % 2 === 0 ? dx : dy));
  if (bPoints.length === 2) return pointInPolygon(translated[0], translated[1], aPoints);
  for (let i = 0; i < translated.length; i += 2) {
    if (pointInPolygon(translated[i], translated[i + 1], aPoints)) return true;
  }
  for (let i = 0; i < aPoints.length; i += 2) {
    if (pointInPolygon(aPoints[i], aPoints[i + 1], translated)) return true;
    const ai = (i + 2) % aPoints.length;
    for (let j = 0; j < translated.length; j += 2) {
      const bj = (j + 2) % translated.length;
      if (segmentsCross(aPoints[i], aPoints[i + 1], aPoints[ai], aPoints[ai + 1],
        translated[j], translated[j + 1], translated[bj], translated[bj + 1])) return true;
    }
  }
  return false;
}

/**
 * A self-contained simulation. Identical random streams and step/input sequences
 * produce identical snapshots. Stopping step() also stops every gameplay clock.
 */
export function createAsteroidsEngine(random: () => number = Math.random): AsteroidsEngine {
  let phase: AsteroidsPhase = 'waiting';
  let elapsedMs = 0;
  let phaseStartedMs = 0;
  let respawnReadyMs = 0;
  let nextAlienMs = Number.POSITIVE_INFINITY;
  let wave = 0;
  let score = 0;
  let lives = 0;
  let nextAsteroidId = 1;
  let pendingAsteroids = 0;
  let ship: Ship;
  let alien: Alien;
  let asteroids: Asteroid[] = [];
  let bullets: Bullet[] = [];
  let alienBullets: Bullet[] = [];
  let explosions: Explosion[] = [];
  let metrics = { shots: 0, hits: 0, splitEvents: 0, deaths: 0, wraps: 0 };

  // The public RNG contract is [0,1). Guard a malformed provider without a loop.
  function sample(): number {
    const value = random();
    return Number.isFinite(value) ? Math.max(0, Math.min(1 - Number.EPSILON, value)) : 0.5;
  }

  function makeBullet(): Bullet {
    return { x: 0, y: 0, vx: 0, vy: 0, age: 0, visible: false };
  }

  function newAlienPosition(): void {
    if (sample() < 0.5) {
      alien.x = -20;
      alien.vx = 1.5;
    } else {
      alien.x = ASTEROIDS_WIDTH + 20;
      alien.vx = -1.5;
    }
    alien.y = sample() * ASTEROIDS_HEIGHT;
    alien.entered = false;
    // As upstream, a later arrival keeps its previous vertical velocity/cooldown.
  }

  function resetEntities(): void {
    ship = {
      x: ASTEROIDS_WIDTH / 2, y: ASTEROIDS_HEIGHT / 2, vx: 0, vy: 0,
      rotation: 0, rotationVelocity: 0, visible: false, thrusting: false, cooldown: 0,
    };
    alien = { x: 0, y: 0, vx: 0, vy: 0, visible: false, entered: false, cooldown: 0 };
    bullets = Array.from({ length: 10 }, makeBullet);
    alienBullets = Array.from({ length: 3 }, makeBullet);
    asteroids = [];
    explosions = [];
    nextAsteroidId = 1;
    pendingAsteroids = 0;
    newAlienPosition();
  }

  function wrap(position: Position, horizontal = true): void {
    let wrapped = false;
    if (horizontal && (position.x > ASTEROIDS_WIDTH || position.x < 0)) {
      position.x = modulo(position.x, ASTEROIDS_WIDTH);
      wrapped = true;
    }
    if (position.y > ASTEROIDS_HEIGHT || position.y < 0) {
      position.y = modulo(position.y, ASTEROIDS_HEIGHT);
      wrapped = true;
    }
    if (wrapped) metrics.wraps++;
  }

  function moveAsteroid(asteroid: Asteroid, delta: number): void {
    asteroid.x += asteroid.vx * delta;
    asteroid.y += asteroid.vy * delta;
    asteroid.rotation = modulo(asteroid.rotation + asteroid.rotationVelocity * delta, 360);
    wrap(asteroid);
  }

  function asteroidSpawnIsClear(position: Position): boolean {
    return !(ship.visible && isNeighborCell(position, ship)) &&
      !(alien.visible && isNeighborCell(position, alien)) &&
      !bullets.some(b => b.visible && isNeighborCell(position, b)) &&
      !alienBullets.some(b => b.visible && isNeighborCell(position, b));
  }

  function spawnAsteroids(count: number): void {
    for (let i = 0; i < count; i++) {
      let position = { x: sample() * ASTEROIDS_WIDTH, y: sample() * ASTEROIDS_HEIGHT };
      let attempts = 0;
      while (!asteroidSpawnIsClear(position) && attempts++ < 64) {
        position = { x: sample() * ASTEROIDS_WIDTH, y: sample() * ASTEROIDS_HEIGHT };
      }
      if (!asteroidSpawnIsClear(position)) {
        // Preserve clearance even with an injected constant RNG; never hang in
        // the upstream rejection loop. Other asteroids do not block placement.
        let bestPosition = position;
        let found = false;
        for (let cell = 0; cell < GRID_COLUMNS * GRID_ROWS; cell++) {
          const candidate = { x: (cell % GRID_COLUMNS + 0.5) * GRID_SIZE,
            y: (Math.floor(cell / GRID_COLUMNS) + 0.5) * GRID_SIZE };
          if (asteroidSpawnIsClear(candidate)) {
            bestPosition = candidate;
            found = true;
            break;
          }
        }
        if (!found) {
          // A fully occupied board is possible with all thirteen projectiles.
          // Defer the remaining rocks until a safe cell opens, never relaxing
          // clearance or blocking the caller in an endless rejection loop.
          pendingAsteroids += count - i;
          return;
        }
        position = bestPosition;
      }
      const points = [...ASTEROID_POINTS];
      const vx = sample() * 4 - 2;
      const vy = sample() * 4 - 2;
      if (sample() > 0.5) points.reverse(); // Original reverses the flat coordinate array.
      asteroids.push({ ...position, id: nextAsteroidId++, vx, vy, rotation: 0,
        rotationVelocity: sample() * 2 - 1, scale: 6, points, alive: true });
    }
  }

  function explosionAt(position: Position): void {
    const lines: number[][] = [];
    for (let i = 0; i < 5; i++) {
      const angle = 2 * Math.PI * sample();
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      lines.push([x, y, x * 2, y * 2]);
    }
    explosions.push({ x: position.x, y: position.y, scale: 1, lines });
  }

  function destroyAsteroid(asteroid: Asteroid, impact: Position, byPlayer: boolean): void {
    if (!asteroid.alive) return;
    asteroid.alive = false; // Invalidate immediately, before a second collision can find it.
    if (byPlayer) {
      score += Math.round(120 / asteroid.scale);
      metrics.hits++;
    }
    const childScale = asteroid.scale / 3;
    if (childScale > 0.5) {
      metrics.splitEvents++;
      for (let i = 0; i < 3; i++) {
        const points = [...asteroid.points];
        const vx = sample() * 6 - 3;
        const vy = sample() * 6 - 3;
        if (sample() > 0.5) points.reverse();
        const child: Asteroid = { ...asteroid, id: nextAsteroidId++, alive: true,
          scale: childScale, points, vx, vy, rotationVelocity: sample() * 2 - 1 };
        moveAsteroid(child, childScale * 3);
        asteroids.push(child);
      }
    }
    explosionAt(impact);
  }

  function destroyAlien(impact: Position, byPlayer: boolean): void {
    if (!alien.visible) return;
    alien.visible = false;
    if (byPlayer) {
      score += 200;
      metrics.hits++;
    }
    explosionAt(impact);
    newAlienPosition();
  }

  function destroyShip(impact: Position): void {
    if (!ship.visible) return;
    ship.visible = false;
    ship.thrusting = false;
    metrics.deaths++;
    lives--;
    explosionAt(impact);
    phase = lives > 0 ? 'respawning' : 'gameover';
    phaseStartedMs = elapsedMs;
    respawnReadyMs = elapsedMs + 1000;
  }

  function tryRespawn(): void {
    ship.x = ASTEROIDS_WIDTH / 2;
    ship.y = ASTEROIDS_HEIGHT / 2;
    if (asteroids.some(a => a.alive && isNeighborCell(ship, a)) ||
        (alien.visible && isNeighborCell(ship, alien)) ||
        alienBullets.some(b => b.visible && isNeighborCell(ship, b))) return;
    ship.rotation = 0;
    ship.rotationVelocity = 0;
    ship.vx = 0;
    ship.vy = 0;
    ship.thrusting = false;
    ship.visible = true;
    phase = 'playing';
    phaseStartedMs = elapsedMs;
  }

  function moveShip(delta: number, input: AsteroidsInput): void {
    if (!ship.visible) return;
    ship.rotationVelocity = input.left ? -6 : input.right ? 6 : 0;
    const angle = (ship.rotation - 90) * DEGREES_TO_RADIANS;
    const vectorX = Math.cos(angle);
    const vectorY = Math.sin(angle);
    ship.thrusting = input.thrust && sample() > 0.1;
    if (ship.cooldown > 0) ship.cooldown -= delta;
    if (input.fire && ship.cooldown <= 0) {
      ship.cooldown = 10;
      const bullet = bullets.find(b => !b.visible);
      if (bullet) {
        bullet.x = ship.x + vectorX * 4;
        bullet.y = ship.y + vectorY * 4;
        bullet.vx = vectorX * 6 + ship.vx;
        bullet.vy = vectorY * 6 + ship.vy;
        bullet.age = 0;
        bullet.visible = true;
        metrics.shots++;
      }
    }
    // Original soft limiter: damping precedes thrust; it is not a hard clamp.
    if (Math.hypot(ship.vx, ship.vy) > 8) {
      ship.vx *= 0.95;
      ship.vy *= 0.95;
    }
    if (input.thrust) {
      ship.vx += vectorX * 0.5 * delta;
      ship.vy += vectorY * 0.5 * delta;
    }
    ship.x += ship.vx * delta;
    ship.y += ship.vy * delta;
    ship.rotation = modulo(ship.rotation + ship.rotationVelocity * delta, 360);
    wrap(ship);
  }

  function occupiedCells(): Set<number> {
    const cells = new Set<number>();
    const add = (position: Position) => {
      const [x, y] = gridCell(position);
      cells.add(y * GRID_COLUMNS + x);
    };
    if (ship.visible) add(ship);
    if (alien.visible) add(alien);
    asteroids.forEach(a => { if (a.alive) add(a); });
    bullets.forEach(b => { if (b.visible) add(b); });
    alienBullets.forEach(b => { if (b.visible) add(b); });
    explosions.forEach(add);
    return cells;
  }

  function moveAlien(delta: number): void {
    if (!alien.visible) return;
    if (alien.entered) {
      const occupied = occupiedCells();
      const [x, y] = gridCell(alien);
      let topCount = 0;
      let bottomCount = 0;
      for (let offset = -1; offset <= 1; offset++) {
        const column = modulo(x + offset, GRID_COLUMNS);
        if (occupied.has(modulo(y - 1, GRID_ROWS) * GRID_COLUMNS + column)) topCount++;
        if (occupied.has(modulo(y + 1, GRID_ROWS) * GRID_COLUMNS + column)) bottomCount++;
      }
      if (topCount > bottomCount) alien.vy = 1;
      else if (topCount < bottomCount) alien.vy = -1;
      else if (sample() < 0.01) alien.vy = -alien.vy;
      alien.cooldown -= delta;
      if (alien.cooldown <= 0) {
        alien.cooldown = 22;
        const bullet = alienBullets.find(b => !b.visible);
        if (bullet) {
          const angle = 2 * Math.PI * sample();
          bullet.x = alien.x;
          bullet.y = alien.y;
          bullet.vx = Math.cos(angle) * 6;
          bullet.vy = Math.sin(angle) * 6;
          bullet.age = 0;
          bullet.visible = true;
        }
      }
    }
    alien.x += alien.vx * delta;
    alien.y += alien.vy * delta;
    wrap(alien, false);
    alien.entered = true;
    if ((alien.vx > 0 && alien.x > ASTEROIDS_WIDTH + 20) || (alien.vx < 0 && alien.x < -20)) {
      alien.visible = false;
      newAlienPosition();
    }
  }

  function moveBullets(pool: Bullet[], delta: number): void {
    for (const bullet of pool) {
      if (!bullet.visible) continue;
      bullet.age += delta;
      if (bullet.age > 50) {
        bullet.visible = false;
        bullet.age = 0;
        continue;
      }
      bullet.x += bullet.vx * delta;
      bullet.y += bullet.vy * delta;
      wrap(bullet);
    }
  }

  function collide(): void {
    // A stable candidate list prevents newly split children being destroyed by
    // the same impact. Geometry is current; no stale linked-grid/cache survives.
    const candidates = asteroids.filter(a => a.alive);
    const geometry = new Map(candidates.map(a => [a.id, transformedPoints(a.points, a.rotation, a.scale)]));
    const shipGeometry = transformedPoints(SHIP_POINTS, ship.rotation, 1);
    const point = [0, 0];

    // Ship hazards are resolved first, retaining the upstream ship-first order.
    for (const asteroid of candidates) {
      if (!ship.visible) break;
      if (asteroid.alive && polygonsTouch(asteroid, geometry.get(asteroid.id)!, ship, shipGeometry)) {
        destroyAsteroid(asteroid, ship, false);
        destroyShip(asteroid);
      }
    }
    if (ship.visible && alien.visible && polygonsTouch(ship, shipGeometry, alien, UFO_POINTS)) {
      const impact = { x: alien.x, y: alien.y };
      destroyAlien(ship, false);
      destroyShip(impact);
    }
    for (const bullet of alienBullets) {
      if (ship.visible && bullet.visible && polygonsTouch(ship, shipGeometry, bullet, point)) {
        bullet.visible = false;
        bullet.age = 0;
        destroyShip(bullet);
      }
    }

    for (const bullet of bullets) {
      if (!bullet.visible) continue;
      // The UFO precedes asteroids in the original sprite collection.
      // Neither UFO nor point projectile has a horizontal drawing bridge.
      // A shot at the opposite edge must actually wrap before hitting the UFO.
      if (alien.visible && polygonsTouch(alien, UFO_POINTS, bullet, point, false)) {
        bullet.visible = false;
        bullet.age = 0;
        destroyAlien(bullet, true);
        continue;
      }
      for (const asteroid of candidates) {
        if (asteroid.alive && polygonsTouch(asteroid, geometry.get(asteroid.id)!, bullet, point)) {
          bullet.visible = false;
          bullet.age = 0;
          destroyAsteroid(asteroid, bullet, true);
          break;
        }
      }
    }

    for (const asteroid of candidates) {
      if (!asteroid.alive) continue;
      if (alien.visible && polygonsTouch(asteroid, geometry.get(asteroid.id)!, alien, UFO_POINTS)) {
        const impact = { x: alien.x, y: alien.y };
        destroyAsteroid(asteroid, impact, false);
        destroyAlien(asteroid, false);
        continue;
      }
      for (const bullet of alienBullets) {
        if (bullet.visible && polygonsTouch(asteroid, geometry.get(asteroid.id)!, bullet, point)) {
          bullet.visible = false;
          bullet.age = 0;
          destroyAsteroid(asteroid, bullet, false);
          break;
        }
      }
    }
    asteroids = asteroids.filter(a => a.alive);
  }

  function advancePhase(): void {
    if (phase === 'respawning' && elapsedMs > respawnReadyMs) tryRespawn();
    if (phase === 'gameover' && elapsedMs - phaseStartedMs > 5000) {
      phase = 'waiting';
      phaseStartedMs = elapsedMs;
    }
    if (phase === 'between-waves' && elapsedMs - phaseStartedMs > 1000) {
      wave++;
      spawnAsteroids(Math.min(12, wave + 1));
      phase = 'playing';
      phaseStartedMs = elapsedMs;
    }
    if (phase === 'playing' && !alien.visible && elapsedMs > nextAlienMs) {
      alien.visible = true;
      alien.entered = false;
      // This deadline starts at arrival, not departure. Long visits can be
      // followed immediately by another UFO, exactly as in the original game.
      nextAlienMs = elapsedMs + 30000 * sample();
    }
  }

  function tick(milliseconds: number, input: AsteroidsInput): void {
    elapsedMs += milliseconds;
    const delta = milliseconds / 30;
    if (pendingAsteroids > 0) {
      const pending = pendingAsteroids;
      pendingAsteroids = 0;
      spawnAsteroids(pending);
    }
    advancePhase();
    const controls = phase === 'playing' || phase === 'between-waves' ? input : NEUTRAL_INPUT;
    moveShip(delta, controls);
    moveBullets(bullets, delta);
    // Original alien bullets occur before the UFO: newly fired UFO shots move
    // on the following tick, whereas ship shots move immediately.
    moveBullets(alienBullets, delta);
    moveAlien(delta);
    for (const asteroid of asteroids) moveAsteroid(asteroid, delta);
    for (const explosion of explosions) explosion.scale += delta;
    explosions = explosions.filter(explosion => explosion.scale <= 8);
    collide();
    if (phase === 'playing' && asteroids.length === 0 && pendingAsteroids === 0) {
      phase = 'between-waves';
      phaseStartedMs = elapsedMs;
    }
  }

  function start(): void {
    elapsedMs = 0;
    phaseStartedMs = 0;
    respawnReadyMs = 0;
    wave = 1;
    score = 0;
    lives = 3;
    metrics = { shots: 0, hits: 0, splitEvents: 0, deaths: 0, wraps: 0 };
    resetEntities();
    spawnAsteroids(2);
    nextAlienMs = 30000 + 30000 * sample();
    phase = 'respawning';
    tryRespawn();
  }

  function step(milliseconds: number, input: AsteroidsInput): void {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
    // Bound large RAF jumps; discrete point collisions still retain the
    // original possibility of tunneling at high relative projectile speeds.
    // Ordinary <=30 ms frames retain the original elapsed/30 movement units.
    let remaining = Math.min(milliseconds, 250);
    while (remaining > 0) {
      const frame = Math.min(remaining, 30);
      tick(frame, input);
      remaining -= frame;
    }
  }

  function snapshot(): AsteroidsSnapshot {
    return Object.freeze({
      phase, elapsedMs, wave, score, lives,
      ship: Object.freeze({ x: ship.x, y: ship.y, rotation: ship.rotation, visible: ship.visible,
        thrusting: ship.thrusting, vx: ship.vx, vy: ship.vy }),
      asteroids: Object.freeze(asteroids.map(a => Object.freeze({ id: a.id, x: a.x, y: a.y,
        rotation: a.rotation, scale: a.scale, vx: a.vx, vy: a.vy, points: Object.freeze([...a.points]) }))),
      bullets: Object.freeze(bullets.filter(b => b.visible).map(b => Object.freeze({ x: b.x, y: b.y }))),
      alien: Object.freeze({ x: alien.x, y: alien.y, visible: alien.visible, vx: alien.vx, vy: alien.vy }),
      alienBullets: Object.freeze(alienBullets.filter(b => b.visible).map(b => Object.freeze({
        x: b.x, y: b.y, vx: b.vx, vy: b.vy,
      }))),
      explosions: Object.freeze(explosions.map(e => Object.freeze({ x: e.x, y: e.y, scale: e.scale,
        lines: Object.freeze(e.lines.map(line => Object.freeze([...line]))) }))),
      metrics: Object.freeze({ ...metrics }),
    });
  }

  resetEntities();
  spawnAsteroids(5); // Original waiting-screen attract field.
  return Object.freeze({ start, step, snapshot });
}
