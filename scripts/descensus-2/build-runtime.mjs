// SPDX-License-Identifier: GPL-3.0-only
// Trusted Node 24 TypeScript transform; no upstream package installation/build scripts.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
const root=path.resolve(import.meta.dirname,'../..');
const input=path.join(root,'vendor/descensus2-original/adapted');
const files=[];function visit(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())visit(p);else if(p.endsWith('.ts'))files.push(p);}}visit(input);
const modules=[];
for(const file of files.sort()){
 const id=path.relative(input,file).replaceAll(path.sep,'/').replace(/\.ts$/,'');
 let source=readFileSync(file,'utf8').replace(/^\uFEFF/,'');
 if(/^interface\s/m.test(source)&&!/^\s*(function|class|const|let|var|enum)\s/m.test(source))continue;
 source=source.replace(/^import type .*?;\s*$/gm,'');
 source=source.replace(/^import (\w+) from '([^']+)';?$/gm,(_,name,dep)=>{
  const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(id),dep));
  if(!files.some(f=>path.relative(input,f).replaceAll(path.sep,'/')===resolved+'.ts'))throw Error('Missing import '+id+': '+dep);
  return `const ${name}=require(${JSON.stringify(resolved)}).default;`;
 });
 const js=stripTypeScriptTypes(source,{mode:'transform',sourceMap:false}).replaceAll('export default ','exports.default = ');
 if(/\b(?:import|export)\s/.test(js))throw Error('Unsupported module syntax '+id);
 modules.push(JSON.stringify(id)+':function(require,exports){\n'+js+'\n}');
}
const bundle='// Descensus 2, MIT Tom W Hall; documented Playgarden changes GPL-3.0-only.\n(function(){"use strict";const modules={\n'+modules.join(',\n')+'\n};const cache=Object.create(null);function require(id){if(cache[id])return cache[id];if(!modules[id])throw Error("Missing module "+id);const exports=cache[id]={};modules[id](require,exports);return exports;}require("index");})();\n';
const target=path.join(root,'public/descensus-2/game.js');
if(process.argv.includes('--check')){if(readFileSync(target,'utf8')!==bundle)throw Error('Compiled original modules differ; rebuild runtime.');}
else writeFileSync(target,bundle);
console.log('Compiled '+modules.length+' original/adapted modules without executing the game.');
