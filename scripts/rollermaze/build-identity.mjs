// SPDX-License-Identifier: GPL-3.0-only
// After the host build, records deployable bytes without executing game code.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root='dist/games/rollermaze';
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
// Bind the actual HTML entry and its lazy import/preload references, rather than
// accepting a similarly named orphan left in dist/assets by an earlier build.
const html=readFileSync('dist/index.html','utf8');
const entries=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match=>match[1].match(/^(?:\.\/|\/(?:[a-zA-Z0-9_-]+\/)*)?(assets\/index-[a-zA-Z0-9_-]+\.js)$/)?.[1]).filter(Boolean);
if(entries.length!==1)throw Error('Missing unique Rollermaze application entry');
const entry=entries[0],entryText=readFileSync('dist/'+entry,'utf8');
const scripts=[...new Set([...entryText.matchAll(/\bimport\("\.\/(RollermazeGame-[a-zA-Z0-9_-]+\.js)"\)/g)].map(match=>'assets/'+match[1]))];
const styles=[...new Set([...entryText.matchAll(/"(assets\/RollermazeGame-[a-zA-Z0-9_-]+\.css)"/g)].map(match=>match[1]))];
if(scripts.length!==1||styles.length!==1)throw Error('Missing unique Rollermaze lazy runtime/style reference');
const host={script:scripts[0],style:styles[0]};
const resources=[...walk(root).map(file=>file.slice(5)),entry,host.script,host.style];
const safeGamePath=value=>/^games\/rollermaze\/(?:[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(value)&&!value.includes('..');
if(resources.some(file=>![entry,host.script,host.style].includes(file)&&!safeGamePath(file)))throw Error('Unsafe Rollermaze build resource path');
const files=[...new Set(resources)].sort().map(file=>{const data=readFileSync('dist/'+file);return {path:file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};});
if(!files.some(f=>f.path==='games/rollermaze/runtime.js')||!files.some(f=>f.path==='games/rollermaze/source.tar.gz'))throw Error('Incomplete built Rollermaze output');
writeFileSync('rollermaze-build-identity.json',JSON.stringify({commit:process.env.GITHUB_SHA??null,entry,host,files},null,2)+'\n');
console.log('Recorded exact built Rollermaze public resources:',files.length);
