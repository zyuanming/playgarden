// SPDX-License-Identifier: GPL-3.0-only
// Reviewed source only. No upstream dependencies, installs, scripts or network.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
execFileSync('python3',['scripts/rollermaze/verify-sources.py'],{cwd:root,stdio:'inherit'});
const source=['bridge-src/prelude.js','adapted-src/levels.js','adapted-src/models.js','adapted-src/timeline.js','adapted-src/w.js','adapted-src/inputs.js','adapted-src/main.js','bridge-src/bridge.js'];
const result='/*! Rollermaze: Copyright (c) 2024 Jasper Renow-Clarke, MIT. MicroW: xem, public domain. Playgarden integration: GPL-3.0-only. See accompanying notices. */\n(()=>{\n'+source.map(name=>'\n// Source: third_party/rollermaze/'+name+'\n'+readFileSync(root+'third_party/rollermaze/'+name,'utf8')).join('\n')+'\n})();\n';
writeFileSync(root+'public/games/rollermaze/runtime.js',result);
execFileSync(process.execPath,['--check','public/games/rollermaze/runtime.js'],{cwd:root,stdio:'inherit'});
execFileSync('python3',['scripts/rollermaze/package-source.py'],{cwd:root,stdio:'inherit'});
console.log('Rollermaze offline runtime and corresponding sources built.');
