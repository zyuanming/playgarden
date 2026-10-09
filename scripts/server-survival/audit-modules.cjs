// SPDX-License-Identifier: GPL-3.0-only
// Parse only; never import or execute the game being audited.
const fs=require('node:fs'),path=require('node:path');
const ts=require('typescript'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'../..'),runtime=path.join(root,'public/server-survival-full');
const denied=new Set(['fetch','XMLHttpRequest','WebSocket','EventSource','sendBeacon','Audio']);
const files=fs.readdirSync(runtime,{recursive:true}).filter(f=>f.endsWith('.js')&&f!=='three-local.js');
let checked=0;
for(const file of files){
 const filename=path.join(runtime,file),source=ts.createSourceFile(filename,fs.readFileSync(filename,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 function visit(n){
  if(ts.isCallExpression(n)||ts.isNewExpression(n)){
   const e=n.expression,name=ts.isIdentifier(e)?e.text:ts.isPropertyAccessExpression(e)?e.name.text:null;
   if(denied.has(name))throw Error(`Unexpected runtime network/audio call in ${file}: ${name}`);
  }
  ts.forEachChild(n,visit);
 }
 visit(source);checked++;
}
const result=esbuild.buildSync({entryPoints:[path.join(runtime,'pg-bridge.js')],bundle:true,write:false,platform:'browser',format:'esm',metafile:true,logLevel:'warning'});
console.log(`PASS: ${checked} game/adapter JS files parsed without executing; no network/audio call expressions; ${Object.keys(result.metafile.inputs).length} local modules resolve.`);
