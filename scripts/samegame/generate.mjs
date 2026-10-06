#!/usr/bin/env node
/** Original campaign, fixed PRNG + full game-DAG classification, with deterministic caps. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { analyze, canonical, toBoard } from './core.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const SEED = 0x53414d45;
let seed = SEED;
function random() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }
const chapters = [
  { id: 0, title: '认识花簇', objective: '相邻要共用一条边；先找同伴，再想一想剩下的色块。', description: '小棋盘也有顺序选择。先练习识别花簇和落单风险。' },
  { id: 1, title: '借一步下落', objective: '消除下方花簇，让上方同色块落到一起。', description: '每关证书都有下落合簇，并至少经历三个有输赢分支的选择点。' },
  { id: 2, title: '给花列让路', objective: '整列消失后，右侧花列会向左靠拢；留意新邻居。', description: '每关证书都有整列消失后形成的同色新接触。' },
  { id: 3, title: '留住花伴', objective: '别只消最大的花簇，给分开的色块留下再次相聚的机会。', description: '每关开局都有陷阱；至少一半关卡连最大的开局花簇也会导致失败。' },
  { id: 4, title: '规划整座花园', objective: '一起考虑下落、并列和同伴，分几步规划清空顺序。', description: '证书至少经历八个有输赢分支的选择点，至少四处只有一个安全选择。' },
];

function dimensions(chapter, ordinal) {
  if (chapter === 1) return [4, 3, 3];
  if (chapter === 2) return [ordinal < 10 ? 4 : 5, 4, 3];
  if (chapter === 3) return [5, 5, 4];
  if (chapter === 4) return [6, 5, 4];
  return [6, ordinal < 17 ? 6 : 7, 4];
}
function accept(m, chapter, ordinal) {
  if (m.openingGroups < 2 || m.certificateMoves < 3 || m.certificateMixedChoices < 1 || m.reachableStates < 10) return false;
  if (chapter === 1) return m.certificateMoves <= 6 && (ordinal < 5 ? m.winningOpeningGroups >= 2 : m.losingOpeningGroups >= 1);
  const minimum = {
    2: { mixed: 3, forced: 1, states: 40, peak: 5, delayed: 1 },
    3: { mixed: 4, forced: 2, states: 180, peak: 20, delayed: 1 },
    4: { mixed: 6, forced: 3, states: 600, peak: 60, delayed: 2 },
    5: { mixed: 8, forced: 4, states: 2500, peak: 160, delayed: 2 },
  }[chapter];
  if (m.certificateMixedChoices < minimum.mixed || m.certificateForcedSafeChoices < minimum.forced || m.reachableStates < minimum.states || m.peakFrontier < minimum.peak || m.openingDelayedTraps < minimum.delayed) return false;
  if (!m.certificateGravityMergeMoves || (chapter >= 3 && !m.certificateColumnMergeMoves)) return false;
  // Fixed quotas for strict counterexamples, not merely unfortunate tie-breaking.
  if (ordinal < (chapter < 4 ? 5 : 10) && !m.allLargestOpeningGroupsLose) return false;
  return !m.greedyLargestClears;
}
const seen = new Set(), levels = [], proofs = [], generation = [];
for (const chapter of chapters) {
  for (let ordinal = 0; ordinal < 20; ordinal++) {
    const [width, height, colors] = dimensions(chapter.id + 1, ordinal);
    let accepted = false;
    for (let attempt = 1; attempt <= 10000; attempt++) {
      const columns = Array.from({ length: width }, () => Array.from({ length: height }, () => Math.floor(random() * colors)).join(''));
      const key = canonical(columns);
      if (seen.has(key)) continue;
      if (Array.from({ length: colors }, (_, color) => columns.join('').split(String(color)).length - 1).some(n => n < 2)) continue;
      let evidence;
      try { evidence = analyze(columns, width, height, 50000); } catch (error) { if (error.message === 'budget') continue; throw error; }
      if (!evidence || !accept(evidence.metrics, chapter.id + 1, ordinal)) continue;
      const number = levels.length + 1;
      const id = `samegame-${String(number).padStart(3, '0')}`;
      const level = { id, title: `${chapter.title} ${ordinal + 1}`, chapter: chapter.id, width, height, colors, board: toBoard(columns, width, height), objective: chapter.objective };
      seen.add(key);
      levels.push(level);
      proofs.push({ ...level, canonicalKey: key, solution: evidence.solution, trace: evidence.trace, metrics: evidence.metrics, openingOutcomes: evidence.openingOutcomes });
      generation.push({ id, attempts: attempt });
      accepted = true;
      console.log(`${id} ${width}x${height} states=${evidence.metrics.reachableStates} mixed=${evidence.metrics.certificateMixedChoices} forced=${evidence.metrics.certificateForcedSafeChoices} largestTrap=${evidence.metrics.allLargestOpeningGroupsLose} attempts=${attempt}`);
      break;
    }
    if (!accepted) throw new Error(`Candidate budget exhausted for chapter ${chapter.id} ordinal ${ordinal}`);
  }
}
function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { min: sorted[0], median: (sorted[9] + sorted[10]) / 2, max: sorted.at(-1) };
}
const chapterMetrics = chapters.map(chapter => {
  const items = proofs.filter(l => l.chapter === chapter.id);
  return { chapter: chapter.id, title: chapter.title, count: items.length,
    ...Object.fromEntries(['reachableStates', 'peakFrontier', 'certificateMoves', 'certificateMixedChoices', 'certificateForcedSafeChoices', 'openingDelayedTraps', 'certificateGravityMergeMoves', 'certificateColumnMergeMoves'].map(k => [k, stats(items.map(l => l.metrics[k]))])),
    strictLargestOpeningCounterexamples: items.filter(l => l.metrics.allLargestOpeningGroupsLose).length,
    deterministicLargestGreedyFailures: items.filter(l => !l.metrics.greedyLargestClears).length,
  };
});
const certificate = {
  version: 1, rules: 'orthogonal groups >=2; gravity down; empty columns pack LEFT; clear every tile; unlimited moves and undo before completion',
  provenance: 'Original generator and original board selection for Playgarden. No copied code, artwork, level pack, or external assets.',
  generator: { seed: SEED, prng: 'xorshift32', nodeCapPerCandidate: 50000, maximumAttemptsPerLevel: 10000, symmetry: 'color relabeling + reflection of occupied columns, followed by LEFT repacking; no rotation or vertical reflection' },
  metricsSemantics: {
    exhaustive: 'All reachable states and edges explored without singleton pruning; only candidates whose complete symmetry-reduced DAG fits the cap are accepted. Counts are symmetry-reduced, not raw gameplay histories.',
    reachableStates: 'Distinct reachable states modulo color relabeling and repacked horizontal reflection, including winning and losing terminals.',
    remainingTileFrontier: 'Histogram of distinct reachable states by the number of remaining tiles; peakFrontier is its maximum bin, not BFS depth or search queue size.',
    winningOpeningGroups: 'Legal opening groups with at least one all-clear continuation. Losing groups have been exhaustively proven unable to clear.',
    openingDelayedTraps: 'Losing opening groups whose resulting position still permits at least one further legal move.',
    certificateMixedChoices: 'Positions on this chosen certificate with at least one safe move and one losing move. Not all possible solution paths or a lower bound on player difficulty.',
    certificateForcedSafeChoices: 'Positions on this chosen certificate with exactly one safe group and at least one losing group.',
    certificateGravityMergeMoves: 'Certificate moves creating a same-color adjacency between previously separate components after gravity, before horizontal packing.',
    certificateColumnMergeMoves: 'Certificate moves creating a same-color contact across originally nonadjacent columns after packing.',
    allLargestOpeningGroupsLose: 'Every maximum-size opening group is proven losing, regardless of tie-breaking; some smaller opening group clears.',
    greedyLargestClears: 'Simulation repeatedly removes a largest group, breaking ties by smallest top-down row-major representative index.',
    certificateMoves: 'Length of one legal all-clear certificate, selected by smallest safe group then smallest representative. No shortest-path or score-optimality claim.',
  },
  chapters, chapterMetrics, generation, levels: proofs,
};
const outputs = new Map([
  ['src/games/samegameLevels.ts', `// Generated by scripts/samegame/generate.mjs. Original boards; certificates remain in docs.\nimport type { SameGameLevel } from './samegameLogic';\n\nexport const samegameChapters = ${JSON.stringify(chapters, null, 2)};\n\nexport const samegameLevels: SameGameLevel[] = ${JSON.stringify(levels, null, 2)};\n`],
  ['docs/samegame/campaign.json', JSON.stringify(certificate, null, 2) + '\n'],
]);
for (const [path, contents] of outputs) {
  const target = resolve(root, path);
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== contents) throw new Error(`Generated file differs: ${path}`);
  } else { mkdirSync(resolve(target, '..'), { recursive: true }); writeFileSync(target, contents); }
}
console.log(JSON.stringify(chapterMetrics, null, 2));
console.log(process.argv.includes('--check') ? 'Reproducibility verified.' : 'Generated 100 certified levels.');
