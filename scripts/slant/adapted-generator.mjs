/* Playgarden modifications: Copyright (c) 2026 YuanMing.
 * Modified 2026-10-06; project contributions are GPL-3.0-only.
 * Upstream portions keep the original license and copyrights below.
 */
/* Adapted from Simon Tatham's slant.c: slant_generate and new_game_desc.
 * Snapshot a7c7826bce5cbb9b9c337c11b9b7f8b278e76fba, lines 1001–1232.
 * Copyright (c) 2004–2024 Simon Tatham and contributors. MIT; full notice in
 * vendor/sgtatham-slant/LICENCE. See docs/slant-migration.md for precise changes.
 * The C program is retained for inspection and is never compiled or executed.
 */
import { solveSlant } from '../../src/games/slantLogic.ts';
// Playgarden deterministic PRNG, not upstream random.c; seeds are not C-compatible.
export function randomFor(seed) {
  let s = 2166136261;
  for (const c of seed) { s ^= c.charCodeAt(0); s = Math.imul(s, 16777619); }
  return n => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return Math.floor(((t ^ t >>> 14) >>> 0) / 4294967296 * n); };
}
function shuffle(a, random) { for (let i = a.length - 1; i > 0; i--) { const j = random(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Direct structural port: shuffled cells, two diagonal connectedness tests,
// forced orientation if either closes a loop, then union the selected endpoints.
export function generateFilled(w, h, random) {
  const W = w + 1, soln = Array(w * h).fill(0), parent = Array.from({ length: W * (h + 1) }, (_, i) => i);
  const find = n => { while (n !== parent[n]) { parent[n] = parent[parent[n]]; n = parent[n]; } return n; };
  for (const i of shuffle(Array.from({ length: w * h }, (_, i) => i), random)) {
    const y = Math.floor(i / w), x = i % w;
    const fs = find(y * W + x) === find((y + 1) * W + x + 1);
    const bs = find((y + 1) * W + x) === find(y * W + x + 1);
    if (fs && bs) throw new Error('Upstream non-crossing invariant failed');
    const v = fs ? 1 : bs ? -1 : 2 * random(2) - 1;
    soln[i] = v;
    const a = y * W + x + (v === 1 ? 1 : 0), b = (y + 1) * W + x + (v === -1 ? 1 : 0);
    parent[find(a)] = find(b);
  }
  return soln;
}
// Port of the four adjacent-cell checks in new_game_desc, including missing edges.
export function fullClues(w, h, soln) {
  const clues = [];
  for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) {
    let v = 0;
    if (x > 0 && y > 0 && soln[(y - 1) * w + x - 1] === -1) v++;
    if (x > 0 && y < h && soln[y * w + x - 1] === 1) v++;
    if (x < w && y > 0 && soln[(y - 1) * w + x] === 1) v++;
    if (x < w && y < h && soln[y * w + x] === -1) v++;
    clues.push(v);
  }
  return clues;
}
// Port of upstream a..z run-length puzzle description format.
export function encodeDescription(clues) {
  let out = '', run = 0;
  for (const n of [...clues, -2]) { if (n === -1) { run++; continue; } while (run > 0) { const chunk = Math.min(26, run); out += String.fromCharCode(96 + chunk); run -= chunk; } if (n >= 0) out += n; }
  return out;
}
export function generatePuzzle(width, height, seed, advanced = false) {
  const random = randomFor(seed), solution = generateFilled(width, height, random), clues = fullClues(width, height, solution);
  const order = shuffle(Array.from({ length: clues.length }, (_, i) => i), random);
  // Upstream two-pass priority, but our bounded solver replaces slant_solve.
  // We do not claim upstream Easy/Hard classification or bitwise equivalence.
  for (let pass = 0; pass < 2; pass++) for (const i of order) {
    const x = i % (width + 1), y = Math.floor(i / (width + 1)), v = clues[i];
    const xb = x === 0 || x === width, yb = y === 0 || y === height;
    const priority = !advanced || v === 4 || v === 0 || (v === 2 && (xb || yb)) || (v === 1 && xb && yb) ? 0 : 1;
    if (pass !== priority) continue;
    clues[i] = -1;
    const result = solveSlant({ width, height, clues }, undefined, advanced ? 5000 : 1);
    if (result.status !== 'unique') clues[i] = v;
  }
  return { width, height, clues, solution, rawDescription: encodeDescription(clues) };
}
