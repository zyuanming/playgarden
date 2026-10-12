// SPDX-License-Identifier: GPL-3.0-only
// Uses only the repository's already-locked official TypeScript installation.
import {execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const compiler = path.join(root, 'node_modules/typescript/bin/tsc');
if (!existsSync(compiler)) throw new Error('Install the repository locked dependencies through its normal npm ci workflow before building Ghosted.');
const run = args => execFileSync(process.execPath, [compiler, ...args], {cwd: root, stdio: 'inherit'});
run(['-p', 'third_party/ghosted/tsconfig.engine.json']);
run(['-p', 'third_party/ghosted/tsconfig.bridge.json']);
const temporary = path.join(root, 'third_party/ghosted/.build');
mkdirSync(temporary, {recursive: true});
try {
  writeFileSync(path.join(temporary, 'contract.ts'), `import {startGame as actual} from '../../../public/games/ghosted/js/adapted-src/main.js';\nimport {startGame as expected} from '../bridge-src/engine.js';\nconst checked: typeof expected = actual;\nvoid checked;\n`);
  run(['--strict', '--noEmit', '--target', 'ES2022', '--module', 'ES2020', '--moduleResolution', 'Bundler', '--lib', 'ES2022,DOM', 'third_party/ghosted/.build/contract.ts']);
} finally { rmSync(temporary, {recursive: true, force: true}); }
copyFileSync(path.join(root, 'third_party/ghosted/bridge-src/engine.js'), path.join(root, 'public/games/ghosted/js/engine.js'));
execFileSync('python3', ['scripts/ghosted/package-source.py'], {cwd: root, stdio: 'inherit'});
execFileSync('python3', ['scripts/ghosted/verify-sources.py', '--runtime'], {cwd: root, stdio: 'inherit'});
