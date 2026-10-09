// SPDX-License-Identifier: GPL-3.0-only
// Static TypeScript parser only. No game is evaluated or imported.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
function walk(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]); }
const files=walk('public/crisp-original').filter(p=>p.endsWith('.js'));
for (const file of files) {
 const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
 if (ast.parseDiagnostics.length) throw Error(file+': '+ast.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('; '));
}
console.log(`Parsed ${files.length} runtime JavaScript files without executing them.`);
