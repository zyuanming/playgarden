// SPDX-License-Identifier: GPL-3.0-only
// Compile the exact current source for each run: never rely on a saved reviewer bundle.
import {build} from 'esbuild';
import {mkdtempSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const dir=mkdtempSync(join(tmpdir(),'playgarden-breakout-oracle-'));
try{
 for(const [source,name] of [['src/vendor/breakout/geometry.ts','geometry'],['src/games/breakoutLogic.ts','logic']])await build({entryPoints:[source],bundle:true,format:'esm',platform:'node',outfile:join(dir,name+'.mjs')});
 for(const file of ['geometry-review.mjs','edge-cases.mjs']){copyFileSync('scripts/breakout-independent/'+file,join(dir,file));execFileSync(process.execPath,[join(dir,file)],{stdio:'inherit',timeout:60000});}
}finally{rmSync(dir,{recursive:true,force:true});}
