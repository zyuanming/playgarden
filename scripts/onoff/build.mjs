// SPDX-License-Identifier: GPL-3.0-only
// Build audited source with the existing, locked host esbuild. No upstream install/scripts.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const installed=path.join(root,'node_modules/esbuild');
const lock=JSON.parse(readFileSync(path.join(root,'package-lock.json'),'utf8'));
const version=JSON.parse(readFileSync(path.join(installed,'package.json'),'utf8')).version;
if(version!==lock.packages['node_modules/esbuild'].version)throw Error('Use the host lockfile esbuild version.');
execFileSync('python3',['scripts/onoff/verify-sources.py'],{cwd:root,stdio:'inherit'});
const {build}=await import(pathToFileURL(path.join(installed,'lib/main.js')).href);
const dest=path.join(root,'public/games/onoff');mkdirSync(dest,{recursive:true});
for(const name of ['index.html','original.css','embed.css','card.svg'])copyFileSync(path.join(root,'third_party/onoff/adapted',name),path.join(dest,name));
for(const name of ['LICENSE-MIT.txt','TinyMusic-MIT.txt','PLAYGARDEN-COPYING.txt'])copyFileSync(path.join(root,'third_party/onoff/licenses',name),path.join(dest,name));
await build({absWorkingDir:root,entryPoints:['third_party/onoff/adapted/runtime.js'],bundle:true,outfile:'public/games/onoff/runtime.js',format:'iife',platform:'browser',target:'es2022',minify:false,sourcemap:true,sourcesContent:true,legalComments:'inline',banner:{js:'/*! ONOFF © 2018 Daniel Marino & Brad Dunbar, MIT; TinyMusic © 2014 Kevin Ennis, MIT. Playgarden adapter GPL-3.0-only. Full notices and corresponding source are alongside this file. */'}});
const files={};for(const name of ['index.html','original.css','embed.css','card.svg','runtime.js','runtime.js.map','LICENSE-MIT.txt','TinyMusic-MIT.txt','PLAYGARDEN-COPYING.txt'])files[name]=createHash('sha256').update(readFileSync(path.join(dest,name))).digest('hex');
writeFileSync(path.join(dest,'files.json'),JSON.stringify({upstream:'starzonmyarmz/js13k-2018',commit:'cb1e2e4615af6195aeb0dade06c08738511dd3b6',levels:25,files},null,2)+'\n');
execFileSync('python3',['scripts/onoff/package-source.py'],{cwd:root,stdio:'inherit'});
execFileSync('python3',['scripts/onoff/verify-sources.py','--runtime','--archive'],{cwd:root,stdio:'inherit'});
