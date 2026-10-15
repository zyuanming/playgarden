// SPDX-License-Identifier: GPL-3.0-only
// After the host build, records deployable bytes without executing game code.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root='dist/games/black-hole-square';
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=walk(root).sort().map(file=>{const data=readFileSync(file);return {path:file.slice(5),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};});
if(!files.some(f=>f.path==='games/black-hole-square/js/runtime.js')||!files.some(f=>f.path==='games/black-hole-square/source.tar.gz'))throw Error('Incomplete built Black Hole Square output');
writeFileSync('black-hole-square-build-identity.json',JSON.stringify({commit:process.env.GITHUB_SHA??null,files},null,2)+'\n');
console.log('Recorded exact built Black Hole Square public resources:',files.length);
