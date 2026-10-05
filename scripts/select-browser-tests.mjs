// Conservative browser selection; uncertain dependencies retain full regression.
import { readFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function sourcesAt(root) {
  const sources = {};
  function walk(dir) {
    if (!existsSync(resolve(root, dir))) return;
    for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
      const path = posix.join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(?:[cm]?[jt]sx?|css)$/.test(path)) sources[path] = readFileSync(resolve(root, path), 'utf8');
    }
  }
  for (const dir of ['src', 'e2e', 'tests']) walk(dir);
  return sources;
}

export function dependencyGraph(sources) {
  const graph = new Map();
  const packages = new Set(['react', 'react-dom', 'lucide-react', 'three', '@playwright/test', '@testing-library/react', '@testing-library/user-event', 'vitest']);
  const unresolved = new Set();
  for (const [path, text] of Object.entries(sources)) {
    const deps = new Set();
    // Import/export-from, side-effect imports, and literal dynamic imports.
    const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["']([^"']+)["']/g;
    for (const match of text.matchAll(pattern)) {
      const specifier = match[1];
      if (!specifier.startsWith('.')) {
        const root = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
        if (!specifier.startsWith('node:') && !packages.has(root)) unresolved.add(path);
        continue;
      }
      const stem = posix.normalize(posix.join(posix.dirname(path), specifier));
      const dep = [stem, ...['.ts', '.tsx', '.css', '/index.ts', '/index.tsx'].map(ext => stem + ext)].find(p => p in sources);
      if (dep) deps.add(dep);
      else unresolved.add(path);
    }
    // Nonliteral imports/require need a real parser or full coverage, never guesses.
    if (/\b(?:import|from)\s*\/[/*]/.test(text) || /\bimport\s*\.\s*meta\b/.test(text) || /\bimport\s*\(\s*(?!["'])\S/.test(text) || /\brequire\s*\(/.test(text) || /@import\b/.test(text)) unresolved.add(path);
    graph.set(path, deps);
  }
  return { graph, unresolved };
}

function closure(graph, start, allow = () => true) {
  const found = new Set();
  function visit(path) {
    if (found.has(path) || !allow(path)) return;
    found.add(path);
    for (const dep of graph.get(path) ?? []) visit(dep);
  }
  visit(start);
  return found;
}

export function browserPlan({ sources, changes, full = false }) {
  const all = Object.keys(sources).filter(p => /^e2e\/.*\.(?:spec|test)\.[cm]?[jt]sx?$/.test(p)).sort();
  const fullPlan = reason => ({ mode: 'full', reason, files: all, shards: [1,2,3,4,5,6,7,8], total: 8 });
  if (full) return fullPlan('manual full regression');
  if (!changes?.length) return fullPlan('no trustworthy change set');
  const { graph, unresolved } = dependencyGraph(sources);
  if (unresolved.size) return fullPlan('unresolved or dynamic local dependency');
  // Specs often import registry metadata, which intentionally references every game.
  // Only explicit game/fixture imports establish a feature witness; shared edits always run full.
  const witnesses = new Map(all.map(spec => [spec, closure(graph, spec, p => p === spec || p.startsWith('src/games/') || p.startsWith('tests/'))]));
  const registry = sources['src/lib/registry.ts'] ?? '';
  const entries = [...registry.matchAll(/\{\s+id:\s*['"]([^'"]+)['"],[\s\S]*?title:\s*['"]([^'"]+)['"],[\s\S]*?component:\s*lazy\(\(\)\s*=>\s*import\(['"](\.\.\/games\/[^'"]+)['"]\)\)/g)];
  if (!entries.length || entries.length !== [...registry.matchAll(/component:\s*lazy\(/g)].length) return fullPlan('unrecognized registry layout');
  const rootWitnesses = new Map();
  for (const [, , title, module] of entries) {
    const component = posix.normalize(posix.join('src/lib', module)) + '.tsx';
    if (!(component in sources)) return fullPlan('missing registered component');
    if (!rootWitnesses.has(component)) rootWitnesses.set(component, new Set());
    // Literal titles also cover table-driven journeys whose certificates are independent of runtime logic.
    for (const spec of all) {
      if ([`"${title}"`, `'${title}'`].some(literal => sources[spec].includes(literal))) {
        rootWitnesses.get(component).add(spec);
      }
    }
  }
  const components = [...rootWitnesses.keys()];
  const dependencies = new Map(components.map(p => [p, closure(graph, p)]));
  const selected = new Set(['e2e/current-save-smoke.spec.ts']);
  for (const change of changes) {
    const { path, status } = change;
    if (!['A', 'M'].includes(status)) return fullPlan('deleted, renamed, or unknown change');
    if (/^(?:docs\/.*\.md|README\.md|THIRD_PARTY_NOTICES\.md|LICENSE)$/.test(path)) continue;
    if (/^e2e\/.*\.(?:spec|test)\.[cm]?[jt]sx?$/.test(path) && path in sources) { selected.add(path); continue; }
    if (!/^src\/games\/.*\.(tsx?|css)$/.test(path) || !(path in sources)) return fullPlan('shared, tooling, or unknown path');
    const consumers = [...dependencies].filter(([, deps]) => deps.has(path));
    const direct = [...witnesses].filter(([, deps]) => deps.has(path)).map(([spec]) => spec);
    for (const spec of direct) selected.add(spec);
    if (!consumers.length && !direct.length) return fullPlan('feature has no browser witness');
    for (const [component] of consumers) {
      // Shared dependencies do not certify another game's journey. Each affected
      // registered root must have its own explicit title-based browser witness.
      const specs = [...rootWitnesses.get(component)];
      if (!specs.length) return fullPlan('consumer has no browser witness');
      for (const spec of specs) selected.add(spec);
    }
  }
  if (!all.includes('e2e/current-save-smoke.spec.ts')) return fullPlan('missing shared smoke');
  return { mode: 'focused', reason: 'changed features plus current-save/shell smoke', files: [...selected].sort(), shards: [1], total: 1 };
}

export function parseDiff(text) {
  const tokens = text.split('\0');
  if (tokens.at(-1) === '') tokens.pop();
  const changes = [];
  for (let i = 0; i < tokens.length;) {
    const status = tokens[i++];
    const path = tokens[i++];
    if (!path || !/^[AMDTRCU][0-9]*$/.test(status)) throw new Error('Invalid git diff');
    changes.push({ status, path });
    if (/^[RC]/.test(status)) { if (!tokens[i++]) throw new Error('Invalid rename'); }
  }
  return changes;
}

function main() {
  const sources = sourcesAt(process.cwd());
  let changes = [];
  let full = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
  try {
    const base = process.env.BASE_SHA, head = process.env.HEAD_SHA;
    if (!/^[a-f0-9]{40}$/.test(base ?? '') || !/^[a-f0-9]{40}$/.test(head ?? '')) full = true;
    else changes = parseDiff(execFileSync('git', ['diff', '--name-status', '-z', '--no-renames', `${base}...${head}`, '--'], { encoding: 'utf8' }));
  } catch { full = true; }
  const plan = browserPlan({ sources, changes, full });
  console.log(JSON.stringify(plan, null, 2));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `mode=${plan.mode}\nmatrix=${JSON.stringify({ shard: plan.shards })}\ntotal=${plan.total}\nfiles=${JSON.stringify(plan.files)}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
