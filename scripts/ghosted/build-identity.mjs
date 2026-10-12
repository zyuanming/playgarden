// SPDX-License-Identifier: GPL-3.0-only
// Hash built public bytes without executing game modules.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root='dist/games/ghosted';
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=walk(root).sort().map(file=>{const b=readFileSync(file);return {path:file.slice(5),bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};});
if(!files.some(f=>f.path==='games/ghosted/js/bridge.js')||!files.some(f=>f.path==='games/ghosted/source.tar.gz'))throw Error('Incomplete built Ghosted output');
writeFileSync('ghosted-build-identity.json',JSON.stringify({commit:process.env.GITHUB_SHA??null,files},null,2)+'\n');
console.log('Recorded exact built Ghosted public resources:',files.length);
