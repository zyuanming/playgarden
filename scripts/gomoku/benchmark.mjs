import {chooseMove} from '../../src/games/gomokuAi.ts';
import {replayMoves, pointName} from '../../src/games/gomokuLogic.ts';
import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const draw = Array.from({ length: 225 }, (_, i) => (i % 15 + 2 * Math.floor(i / 15)) % 4 < 2 ? 1 : 2);
const black = [], white = [], crowded = [];
for (let i = 0; i < 225; i++) (draw[i] === 1 ? black : white).push(i);
for (let i = 0; i < white.length; i++) crowded.push(black[i], white[i]);
const fixtures = [
  { name: 'empty', moves: [] },
  { name: 'opening', moves: [112, 113, 97, 127, 96, 111] },
  { name: 'midgame', moves: [112, 113, 97, 127, 96, 111, 128, 82, 98, 114, 143, 158, 81, 65, 99, 100] },
  { name: 'unique-block', moves: [0, 112, 1, 114, 2, 146, 3] },
  { name: 'win-before-defense', moves: [0, 30, 1, 31, 2, 32, 3, 33] },
  { name: 'crowded-180', moves: crowded.slice(0, 180) },
  { name: 'crowded-224', moves: crowded },
];
const rows = [];
for (const { name, moves } of fixtures) {
  const position = replayMoves(moves);
  if (!position) throw new Error(`Invalid benchmark fixture: ${name}`);
  for (const difficulty of ['gentle', 'steady']) {
    const samples = [];
    let result;
    const before = JSON.stringify(position);
    // One untimed warmup; five measured calls at the production default budget.
    chooseMove(position, difficulty);
    for (let run = 0; run < 5; run++) {
      const start = performance.now();
      result = chooseMove(position, difficulty);
      samples.push(performance.now() - start);
      if (result.move === null || position.board[result.move] !== 0) throw new Error(`Illegal move: ${name}`);
      if (JSON.stringify(position) !== before) throw new Error(`Mutation: ${name}`);
      if (result.nodes > (difficulty === 'gentle' ? 1_000 : 12_000)) throw new Error(`Node overrun: ${name}`);
    }
    samples.sort((a, b) => a - b);
    rows.push({ fixture: name, difficulty, move: pointName(result.move), nodes: result.nodes,
      completedDepth: result.depth, budgetHit: result.budgetHit,
      medianMs: Number(samples[2].toFixed(2)), maxMs: Number(samples[4].toFixed(2)) });
  }
}
const report = { generatedAt: new Date().toISOString(), node: process.version,
  note: 'Local CPU smoke benchmark, not an Elo/strength estimate or browser/mobile latency guarantee. Time checks are cooperative between finite tactical scans; callers may terminate a Worker.', rows };
const output = resolve(process.argv[2] ?? '/tmp/gomoku-benchmark.json');
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.table(rows);
console.log(`Report: ${output}`);
