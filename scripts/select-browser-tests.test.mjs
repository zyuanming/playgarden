import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { browserPlan, dependencyGraph, parseDiff, sourcesAt } from './select-browser-tests.mjs';
const sources = sourcesAt(new URL('..', import.meta.url).pathname);
const plan = (paths, extras = {}) => browserPlan({ sources, changes: paths.map(path => ({ status: 'M', path })), ...extras });

test('Memory Routes CSS and component select both viewport journeys plus fresh-save smoke', () => {
  for (const path of ['src/games/memoryRoutes.css', 'src/games/MemoryRoutes.tsx']) {
    const selected = plan([path]);
    assert.equal(selected.mode, 'focused');
    assert.deepEqual(selected.files, ['e2e/current-save-smoke.spec.ts', 'e2e/sequence-symmetry-probability.spec.ts']);
  }
});
test('independent certificates still map runtime arithmetic consumers', () => {
  assert.ok(plan(['src/games/ArithmeticConstraintBoard.tsx']).files.includes('e2e/arithmetic-constraints.spec.ts'));
});
test('different changed features are combined', () => {
  const result = plan(['src/games/memoryRoutes.css', 'src/games/lightsOutLogic.ts']);
  assert.equal(result.mode, 'focused');
  assert.ok(result.files.includes('e2e/sequence-symmetry-probability.spec.ts'));
  assert.ok(result.files.includes('e2e/lights-out-campaign.spec.ts'));
});
test('every current game source has a browser witness, including all CSS and shared game components', () => {
  assert.equal(dependencyGraph(sources).unresolved.size, 0);
  for (const path of Object.keys(sources).filter(p => p.startsWith('src/games/'))) {
    const selected = plan([path]);
    assert.equal(selected.mode, 'focused', path);
    assert.ok(selected.files.some(p => p !== 'e2e/current-save-smoke.spec.ts'), path);
  }
});
test('shared shell, catalog, global styles, tooling and test helpers run full', () => {
  for (const path of ['src/components/GameShell.tsx', 'src/lib/registry.ts', 'src/styles.css', '.github/workflows/ci.yml', 'scripts/select-browser-tests.mjs', 'e2e/helpers.ts', 'tests/ui.test.tsx', 'package-lock.json']) assert.equal(plan([path]).mode, 'full', path);
});
test('unknown, newly unmapped, removed and renamed paths fail safe', () => {
  assert.equal(plan(['src/games/newGame.ts']).mode, 'full');
  const extra = { ...sources, 'src/games/newGame.ts': 'export const x = 1;' };
  assert.equal(browserPlan({ sources: extra, changes: [{ status: 'A', path: 'src/games/newGame.ts' }] }).mode, 'full');
  for (const status of ['D', 'R100', 'T']) assert.equal(browserPlan({ sources, changes: [{ status, path: 'src/games/memoryRoutes.css' }] }).mode, 'full');
});
test('manual and missing changes keep full eight-shard regression', () => {
  for (const selected of [plan([], { full: true }), plan([])]) { assert.equal(selected.mode, 'full'); assert.equal(selected.shards.length, 8); }
});
test('docs-only still exercise current save and shared shell without all game journeys', () => {
  assert.deepEqual(plan(['README.md']).files, ['e2e/current-save-smoke.spec.ts']);
});
test('changed browser specs are selected directly', () => {
  assert.deepEqual(plan(['e2e/sequence-symmetry-probability.spec.ts']).files, ['e2e/current-save-smoke.spec.ts', 'e2e/sequence-symmetry-probability.spec.ts']);
});
test('unresolved relative imports and unrecognized registry layouts fail safe', () => {
  for (const edit of [{ 'src/games/MemoryRoutes.tsx': 'import x from "./missing";' }, { 'src/lib/registry.ts': '' }, { 'src/games/MemoryRoutes.tsx': 'import(fileName);' }, { 'src/games/MemoryRoutes.tsx': 'import "/src/games/shared.ts";' }, { 'src/games/MemoryRoutes.tsx': 'import x from "@games/shared";' }]) {
    assert.equal(browserPlan({ sources: { ...sources, ...edit }, changes: [{ status: 'M', path: 'src/games/memoryRoutes.css' }] }).mode, 'full');
  }
});
test('a shared game dependency includes every consuming game journey', () => {
  const fixture = {
    'src/lib/registry.ts': '{ id: "a", title: "A", component: lazy(() => import("../games/A")) }, { id: "b", title: "B", component: lazy(() => import("../games/B")) }',
    'src/games/A.tsx': 'import "./shared";',
    'src/games/B.tsx': 'import "./shared";',
    'src/games/shared.ts': 'export const x = 1;',
    'e2e/a.spec.ts': 'openGame(page, "A");',
    'e2e/b.spec.ts': 'openGame(page, "B");',
    'e2e/current-save-smoke.spec.ts': '',
  };
  assert.deepEqual(browserPlan({ sources: fixture, changes: [{ status: 'M', path: 'src/games/shared.ts' }] }).files, ['e2e/a.spec.ts', 'e2e/b.spec.ts', 'e2e/current-save-smoke.spec.ts']);
  fixture['e2e/extra.test.tsx'] = 'openGame(page, "A");';
  assert.ok(browserPlan({ sources: fixture, changes: [{ status: 'M', path: 'src/games/A.tsx' }] }).files.includes('e2e/extra.test.tsx'));
  for (const syntax of ['import /* comment */ \"./shared\";', 'export {x} from /* comment */ \"./shared\";', 'import.meta.glob(\"./shared.ts\");']) {
    assert.equal(browserPlan({ sources: {...fixture, 'src/games/B.tsx': syntax}, changes: [{status:'M', path:'src/games/shared.ts'}] }).mode, 'full', syntax);
  }
  delete fixture['e2e/b.spec.ts'];
  for (const path of ['src/games/B.tsx', 'src/games/shared.ts']) {
    assert.equal(browserPlan({ sources: fixture, changes: [{ status: 'M', path }] }).mode, 'full', path);
  }
});
test('NUL-delimited diff handles spaces and rejects truncated renames', () => {
  assert.deepEqual(parseDiff('M\0some name.ts\0D\0gone.ts\0'), [{status:'M',path:'some name.ts'}, {status:'D',path:'gone.ts'}]);
  assert.throws(() => parseDiff('R100\0old.ts\0'));
});
test('workflow keeps read-only permissions, manual full trigger, validation, and safe JSON runner', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  for (const required of ['workflow_dispatch:', 'contents: read', 'persist-credentials: false', 'fetch-depth: 0', 'node --test scripts/select-browser-tests.test.mjs', 'npm run typecheck', 'npm test', 'npm run build', 'node scripts/run-browser-tests.mjs']) assert.ok(workflow.includes(required), required);
  assert.ok(!workflow.includes('pull_request_target'));
});

test('full runner uses unfiltered discovery while focused runner passes validated file arguments', () => {
  const root = mkdtempSync(join(tmpdir(), 'playgarden-ci-test-'));
  try {
    mkdirSync(join(root, 'node_modules/@playwright/test'), {recursive:true});
    mkdirSync(join(root, 'e2e'));
    writeFileSync(join(root, 'node_modules/@playwright/test/cli.js'), 'console.log(JSON.stringify(process.argv.slice(2)));');
    writeFileSync(join(root, 'e2e/new-game.test.ts'), '');
    writeFileSync(join(root, 'e2e/example.spec.ts'), '');
    for (const mode of ['full', 'focused']) for (const list of [false, true]) {
      const result = spawnSync(process.execPath, [fileURLToPath(new URL('./run-browser-tests.mjs', import.meta.url)), ...(list ? ['--list'] : [])], {
        cwd: root, encoding: 'utf8', env: {...process.env, BROWSER_MODE:mode, BROWSER_FILES:JSON.stringify(['e2e/example.spec.ts']), BROWSER_SHARD:'1', BROWSER_TOTAL:mode==='full'?'8':'1'},
      });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), [...(mode==='full'?['test','--shard=1/8']:['test','e2e/example.spec.ts','--shard=1/1']), ...(list ? ['--list'] : [])]);
    }
  } finally { rmSync(root, {recursive:true, force:true}); }
});


test('literal JSON fixture imports are tracked while dynamic imports remain conservative', () => {
  const fixture = {'tests/fixture.ts':'import records from "./puzzles.json";', 'tests/puzzles.json':'[{"lesson":"import(fileName) is only text"}]'};
  const graph = dependencyGraph(fixture);
  assert.equal(graph.unresolved.size, 0);
  assert.ok(graph.graph.get('tests/fixture.ts').has('tests/puzzles.json'));
  assert.equal(dependencyGraph({...fixture, 'tests/fixture.ts':'import(fileName)'}).unresolved.size, 1);
  assert.equal(dependencyGraph({'tests/fixture.ts':'import records from "./missing.json";'}).unresolved.size, 1);
});

test('Shikaku expanded campaign keeps every desktop/mobile journey and uses four focused shards', () => {
  for (const path of ['src/games/ShikakuGarden.tsx', 'src/games/shikakuLevels.ts', 'src/games/shikakuExpansion.ts', 'e2e/shikaku-campaign.spec.ts']) {
    const selected = plan([path]);
    assert.equal(selected.mode, 'focused', path);
    assert.ok(selected.files.includes('e2e/shikaku-campaign.spec.ts'));
    assert.ok(selected.files.includes('e2e/current-save-smoke.spec.ts'));
    assert.deepEqual(selected.shards, [1, 2, 3, 4]);
    assert.equal(selected.total, 4);
  }
  assert.ok(plan(['src/games/regionCamping.css']).files.includes('e2e/region-number.spec.ts'));
});
