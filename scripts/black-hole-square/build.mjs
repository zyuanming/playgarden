// SPDX-License-Identifier: GPL-3.0-only
// Run only after independent source review. No legacy upstream package scripts.
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const installed=path.join(root,'node_modules/esbuild');
if(!existsSync(path.join(installed,'lib/main.js')))throw Error('Use the host repository locked npm ci workflow first; do not install upstream webpack.');
const lock=JSON.parse(readFileSync(path.join(root,'package-lock.json'),'utf8'));
const locked=lock.packages?.['node_modules/esbuild']?.version;
const actual=JSON.parse(readFileSync(path.join(installed,'package.json'),'utf8')).version;
if(!locked||locked!==actual)throw Error('The installed official esbuild must match the host lockfile.');
execFileSync('python3',['scripts/black-hole-square/verify-sources.py'],{cwd:root,stdio:'inherit'});
const {build}=await import(pathToFileURL(path.join(installed,'lib/main.js')).href);
mkdirSync(path.join(root,'public/games/black-hole-square/js'),{recursive:true});
await build({absWorkingDir:root,entryPoints:['third_party/black-hole-square/bridge-src/bridge.js'],bundle:true,
  outfile:'public/games/black-hole-square/js/runtime.js',format:'iife',platform:'browser',target:'es2022',
  minify:false,sourcemap:true,sourcesContent:true,legalComments:'inline',
  banner:{js:'/*! Black Hole Square: Copyright (c) 2021 Quinten Clause, MIT; see ../LICENSE-MIT.txt. Playgarden integration: GPL-3.0-only; see ../PLAYGARDEN-COPYING.txt. */'}});
execFileSync('python3',['scripts/black-hole-square/package-source.py'],{cwd:root,stdio:'inherit'});
execFileSync('python3',['scripts/black-hole-square/verify-sources.py','--runtime','--archive'],{cwd:root,stdio:'inherit'});
