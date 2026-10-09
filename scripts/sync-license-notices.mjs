// SPDX-License-Identifier: GPL-3.0-only
// Preserve exact upstream runtime notices in the distributable website.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const check=process.argv.includes('--check');
const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
const packages=['react','react-dom','scheduler','three','lucide-react'];
const lockedRuntime=Object.entries(lock.packages).filter(([name,value])=>name && !value.dev).map(([name])=>name.replace(/^node_modules\//,'')).sort();
if(JSON.stringify(lockedRuntime)!==JSON.stringify([...packages].sort()))throw new Error('Runtime dependencies changed; update the complete notices and corresponding-source map.');
let text=readFileSync('THIRD_PARTY_NOTICES.md','utf8').trimEnd()+'\n\n';
text+='## Complete bundled runtime dependency notices\n\n';
for(const name of packages){
 const pkg=JSON.parse(readFileSync(resolve('node_modules',name,'package.json'),'utf8'));
 if(pkg.version!==lock.packages['node_modules/'+name]?.version)throw new Error('Installed dependency differs from lockfile: '+name);
 text+=`### ${name} ${pkg.version} (${pkg.license})\n\n`+readFileSync(resolve('node_modules',name,'LICENSE'),'utf8').trimEnd()+'\n\n';
}
// Vite's module-preload helper is build-tool code included in production output.
const vite=JSON.parse(readFileSync('node_modules/vite/package.json','utf8'));
if(vite.version!==lock.packages['node_modules/vite'].version)throw new Error('Installed Vite differs from the locked preload-helper source.');
text+=`### Vite ${vite.version}: bundled preload helper and Vite notices\n\n`+readFileSync('node_modules/vite/LICENSE.md','utf8').trimEnd()+'\n';
text+='\n## Exact editable corresponding sources for bundled libraries\n\n';
const sources=JSON.parse(readFileSync('docs/runtime-source-manifest.json','utf8'));
for(const component of sources.components){
 for(const [name,version] of Object.entries(component.packages)){
  if(lock.packages['node_modules/'+name]?.version!==version)throw new Error('Source map differs from lockfile: '+name);
  text+=name+' '+version+'\n';
 }
 text+=component.source+'\nPreferred editable source: '+component.preferredSource.join(', ')+'\nBuild sources: '+component.buildSources.join(', ')+'\n\n';
}
for(const component of sources.vendoredComponents ?? []){
 text+=component.name+' '+component.version+' ('+component.license+')\n'+component.source+'\nPreferred editable source: '+component.preferredSource.join(', ')+'\nBuild sources: '+component.buildSources.join(', ')+'\n'+component.scope+'\n\n';
}
const output='public/THIRD_PARTY_NOTICES.txt';
if(check){if(readFileSync(output,'utf8')!==text)throw new Error('Public third-party notices are stale; run node scripts/sync-license-notices.mjs');}
else writeFileSync(output,text);
if(readFileSync('LICENSE','utf8')!==readFileSync('public/playgarden-COPYING.txt','utf8'))throw new Error('Distributable GPL text differs from root LICENSE');
console.log('Public GPL and complete runtime dependency notices verified.');
