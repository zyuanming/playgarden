// SPDX-License-Identifier: GPL-3.0-only
// Static AST comparison only: never imports or executes the library under review.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
const root=path.resolve(process.argv[2]??path.join(import.meta.dirname,'../..'));
const output=path.resolve(process.argv[3]??path.join(root,'docs/crisp-mml-correspondence.json'));
const original=path.join(root,'vendor/crisp-original/upstream/audio/build/index.js');
const sourceRoot=path.join(root,'vendor/crisp-original/third-party/mml-iterator/src');
const bytes=fs.readFileSync(original), code=bytes.toString();
const first=code.indexOf('  var Syntax$2 = {'), last=code.indexOf('  var jsfx = {};');
assert(first>0 && last>first);
assert(code.slice(0,first).endsWith('  "use strict";\n'),'Embedded modules inherit original strict-mode factory');
const embedded=code.slice(first,last);
const shippedAudio=fs.readFileSync(path.join(root,'public/crisp-original/audio.js'),'utf8');
const shippedFirst=shippedAudio.indexOf('  var Syntax$2 = {'),shippedLast=shippedAudio.indexOf('  var jsfx = {};');
assert.equal(shippedAudio.slice(shippedFirst,shippedLast),embedded,'Shipped embedded mml block remains byte-identical to original audio');
const parse=(name,text)=>{
 const ast=ts.createSourceFile(name,text,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
 assert.equal(ast.parseDiagnostics.length,0,name);
 return ast;
};
const ast=parse('embedded-mml.js',embedded);
const source=new Map(['Syntax','DefaultParams','Scanner','MMLParser','MMLIterator','index'].map(name=>[name,parse(name+'.js',fs.readFileSync(path.join(sourceRoot,name+'.js'),'utf8'))]));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const sourceManifest=JSON.parse(fs.readFileSync(path.join(root,'vendor/crisp-original/source-manifest.json'),'utf8'));
const audioRecord=sourceManifest.files.find(f=>f.dest==='upstream/audio/build/index.js');
assert.equal(bytes.length,audioRecord.expected_bytes);
assert.equal(sha(bytes),audioRecord.sha256);
const sourceRecords=JSON.parse(fs.readFileSync(path.join(root,'docs/crisp-mml-source-addendum.json'),'utf8')).files;
for(const name of source.keys()) {
 const record=sourceRecords.find(r=>r.path.endsWith('/src/'+name+'.js'));
 assert(record,name+' provenance record');
 const b=fs.readFileSync(path.join(sourceRoot,name+'.js'));
 assert.equal(b.length,record.bytes);assert.equal(sha(b),record.sha256);
 const blob=crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
 assert.equal(blob,record.git_blob_sha1);
}
const at=(node,sf)=>{
 const start=sf.getLineAndCharacterOfPosition(node.getStart(sf));
 const end=sf.getLineAndCharacterOfPosition(node.getEnd());
 const base=sf===ast?code.slice(0,first).split('\n').length-1:0;
 return {startLine:start.line+1+base,endLine:end.line+1+base};
};
const aliases={
 'Syntax$2':'Syntax','Syntax$1':'Syntax','DefaultParams$1':'DefaultParams',
 'Scanner$1':'Scanner','Scanner2':'Scanner','Scanner_1':'Scanner',
 'MMLParser$1':'MMLParser','MMLParser2':'MMLParser','MMLParser_1':'MMLParser',
 'MMLIterator2':'MMLIterator','MMLIterator_1':'MMLIterator',
 '_classCallCheck$2':'_classCallCheck','_classCallCheck$1':'_classCallCheck',
 '_createClass$2':'_createClass','_createClass$1':'_createClass',
 'quantize2':'quantize','value2':'value',
};
const thisAlias=/^_this\d*$/;
const canonicalName=name=>aliases[name]??name;
const emptyDefault=n=>ts.isDefaultClause(n)&&n.statements.length===0;
const aliasDeclaration=n=>ts.isVariableStatement(n)&&n.declarationList.declarations.length===1&&thisAlias.test(n.declarationList.declarations[0].name.getText())&&n.declarationList.declarations[0].initializer?.kind===ts.SyntaxKind.ThisKeyword;
const classCheck=n=>ts.isExpressionStatement(n)&&ts.isCallExpression(n.expression)&&/^_classCallCheck/.test(n.expression.expression.getText());
const records=[];
// These normalized syntax changes are deliberately finite and documented. There is
// no partial source matching, fuzzy comparison, game execution, or numerical sampling.
function c(n) {
 if(!n)return null;
 if(ts.isParenthesizedExpression(n))return c(n.expression);
 if(ts.isIdentifier(n))return thisAlias.test(n.text)?['this']:['id',canonicalName(n.text)];
 if(n.kind===ts.SyntaxKind.ThisKeyword)return ['this'];
 if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))return ['str',n.text];
 if(ts.isNumericLiteral(n))return ['num',Number(n.text)];
 if(ts.isPrefixUnaryExpression(n)&&n.operator===ts.SyntaxKind.PlusToken&&ts.isNumericLiteral(n.operand))return c(n.operand);
 if(ts.isVariableStatement(n))return ['var',n.declarationList.declarations.map(c)];
 if(ts.isVariableDeclarationList(n))return ['decls',n.declarations.map(c)];
 if(ts.isVariableDeclaration(n))return ['decl',c(n.name),c(n.initializer)];
 if(ts.isParameter(n))return ['param',c(n.name),c(n.initializer)];
 if(ts.isBlock(n))return ['block',n.statements.filter(s=>!aliasDeclaration(s)&&!classCheck(s)).map(c)];
 if(ts.isArrowFunction(n)||ts.isFunctionExpression(n)||ts.isMethodDeclaration(n)||ts.isConstructorDeclaration(n)) {
   const body=ts.isBlock(n.body)?c(n.body):['block',[['ReturnStatement',c(n.body)]]];
   return ['fn',n.parameters.map(c),body];
 }
 if(ts.isFunctionDeclaration(n))return ['function',c(n.name),n.parameters.map(c),c(n.body)];
 if(ts.isPropertyAccessExpression(n))return ['get',c(n.expression),n.name.text];
 if(ts.isElementAccessExpression(n))return ['index',c(n.expression),c(n.argumentExpression)];
 if(ts.isShorthandPropertyAssignment(n))return ['prop',n.name.text,['id',canonicalName(n.name.text)]];
 if(ts.isPropertyAssignment(n))return ['prop',propName(n.name),c(n.initializer)];
 if(ts.isObjectLiteralExpression(n))return ['object',n.properties.map(p=>ts.isMethodDeclaration(p)?['prop',propName(p.name),c(p)]:c(p))];
 if(ts.isCaseBlock(n))return ['CaseBlock',...n.clauses.filter(s=>!emptyDefault(s)).map(c)];
 if(ts.isTemplateExpression(n)) {
   let out=['str',n.head.text];
   for(const span of n.templateSpans) {
     out=['binary',ts.SyntaxKind.PlusToken,out,c(span.expression)];
     if(span.literal.text)out=['binary',ts.SyntaxKind.PlusToken,out,['str',span.literal.text]];
   }
   return out;
 }
 if(ts.isBinaryExpression(n))return ['binary',n.operatorToken.kind,c(n.left),c(n.right)];
 if(ts.isPrefixUnaryExpression(n)||ts.isPostfixUnaryExpression(n))return [ts.SyntaxKind[n.kind],n.operator,c(n.operand)];
 if(ts.isToken(n))return [ts.SyntaxKind[n.kind],n.kind===ts.SyntaxKind.RegularExpressionLiteral?n.text:undefined];
 const children=[];ts.forEachChild(n,x=>{children.push(c(x));});
 return [ts.SyntaxKind[n.kind],...children];
}
function propName(n) {
 if(ts.isComputedPropertyName(n))return c(n.expression);
 if(ts.isIdentifier(n)||ts.isStringLiteral(n))return n.text;
 throw Error('Unsupported property name '+n.getText());
}
const varStatement=name=>ast.statements.find(s=>ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>d.name.getText()===name));
const decl=name=>varStatement(name)?.declarationList.declarations.find(d=>d.name.getText()===name);
const functionStatement=(sf,name)=>sf.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name.text===name);
function equivalent(label,left,right,leftFile,rightFile=ast) {
 const a=c(left),b=c(right);
 try {assert.deepEqual(a,b,label);}catch(error){
   fs.writeFileSync(output.replace(/\.json$/,'.mismatch.json'),JSON.stringify({label,source:a,bundle:b},null,2));throw error;
 }
 records.push({label,sourceFile:path.basename(leftFile.fileName),source:at(left,leftFile),bundle:at(right,rightFile),canonicalSha256:sha(JSON.stringify(a))});
}
const coveredBundle=new Set();
const cover=name=>{const s=varStatement(name)??functionStatement(ast,name);assert(s,name);coveredBundle.add(s);return s;};
for(const [name,bundleName]of [['Syntax','Syntax$2'],['DefaultParams','DefaultParams$1']]) {
 const sf=source.get(name);assert.equal(sf.statements.length,1);
 const assignment=sf.statements[0].expression;
 assert.equal(assignment.left.getText(),'module.exports');
 equivalent(name+' exported constants',assignment.right,decl(bundleName).initializer,sf);
 cover(bundleName);
}
// Exact bundle import/export wiring. Every alias is checked, not merely ignored.
const wiring={Scanner_1:'Scanner$1','Syntax$1':'Syntax$2',Scanner:'Scanner_1',MMLParser_1:'MMLParser$1',Syntax:'Syntax$2',DefaultParams:'DefaultParams$1',MMLParser:'MMLParser_1',MMLIterator_1:'MMLIterator',lib:'MMLIterator_1'};
for(const[name,value]of Object.entries(wiring)){assert.equal(decl(name).initializer.getText(),value);cover(name);}
const expectedRequires={Scanner:{},MMLParser:{Syntax:'./Syntax',Scanner:'./Scanner'},MMLIterator:{Syntax:'./Syntax',DefaultParams:'./DefaultParams',MMLParser:'./MMLParser'}};
const classBindings={Scanner:'Scanner$1',MMLParser:'MMLParser$1',MMLIterator:'MMLIterator'};
for(const[name,binding]of Object.entries(classBindings)) {
 const sf=source.get(name),clazz=sf.statements.find(ts.isClassDeclaration);
 assert(clazz&&clazz.name.text===name);
 assert(clazz.members.every(m=>ts.isConstructorDeclaration(m)||ts.isMethodDeclaration(m)),'No ignored class members');
 assert.equal(clazz.members.filter(ts.isConstructorDeclaration).length,1);
 assert(!clazz.heritageClauses?.length&&!clazz.modifiers?.length,'No ignored class inheritance or modifiers');
 const init=decl(binding).initializer;
 assert(ts.isCallExpression(init)&&ts.isFunctionExpression(init.expression));
 assert.equal(init.arguments.length,0);
 const stmts=init.expression.body.statements;assert.equal(stmts.length,3);
 const ctor=stmts[0],call=stmts[1].expression,last=stmts[2];
 assert(ts.isFunctionDeclaration(ctor));assert(ts.isReturnStatement(last));assert.equal(last.expression.getText(),ctor.name.text);
 assert(ts.isCallExpression(call)&&/^_createClass/.test(call.expression.getText()));assert.equal(call.arguments.length,2);assert.equal(call.arguments[0].getText(),ctor.name.text);
 assert(ts.isArrayLiteralExpression(call.arguments[1]));
 const check=ctor.body.statements[0];assert(classCheck(check));assert.equal(check.expression.arguments.length,2);assert.equal(check.expression.arguments[0].kind,ts.SyntaxKind.ThisKeyword);assert.equal(check.expression.arguments[1].getText(),ctor.name.text);
 const originalCtor=clazz.members.find(ts.isConstructorDeclaration);
 assert.equal(originalCtor.parameters.length,1);assert.equal(ctor.parameters.length,1);
 equivalent(name+'.constructor params',originalCtor.parameters[0],ctor.parameters[0],sf);
 equivalent(name+'.constructor body',originalCtor.body,ctor.body,sf);
 const methods=clazz.members.filter(ts.isMethodDeclaration), descriptors=call.arguments[1].elements;
 assert(methods.every(m=>!m.modifiers?.length),'No ignored method modifiers');
 assert.equal(methods.length,descriptors.length,name+' complete method count');
 for(let i=0;i<methods.length;i++) {
   const props=descriptors[i].properties;assert.equal(props.length,2);
   const key=props.find(p=>p.name.text==='key')?.initializer, fn=props.find(p=>p.name.text==='value')?.initializer;
   assert(key&&fn&&ts.isFunctionExpression(fn));
   const expectedKey=ts.isComputedPropertyName(methods[i].name)?c(methods[i].name.expression):['str',methods[i].name.text];
   assert.deepEqual(expectedKey,c(key),name+' method key '+i);
   equivalent(name+'.'+methods[i].name.getText(),methods[i],fn,sf);
 }
 cover(binding);
 // Account for all source top-level statements, rejecting extra executable code.
 for(const s of sf.statements) {
   if(s===clazz)continue;
   if(ts.isExpressionStatement(s)&&ts.isStringLiteral(s.expression)&&s.expression.text==='use strict')continue;
   if(ts.isExpressionStatement(s)&&ts.isBinaryExpression(s.expression)&&s.expression.left.getText()==='module.exports') { assert.equal(s.expression.right.getText(),name); continue; }
   if(ts.isVariableStatement(s)&&s.declarationList.declarations.length===1) {
     const d=s.declarationList.declarations[0],n=d.name.text;
     if(n in expectedRequires[name]) {assert.equal(d.initializer.expression?.getText(),'require');assert.equal(d.initializer.arguments?.length,1);assert.equal(d.initializer.arguments[0].text,expectedRequires[name][n]);continue;}
     assert(['NOTE_INDEXES','ITERATOR'].includes(n),n);
     equivalent(name+' local constant '+n,d.initializer,decl(n).initializer,sf);cover(n);continue;
   }
   if(ts.isFunctionDeclaration(s)&&['arrayToIterator','isNoteEvent'].includes(s.name.text)) {
     equivalent(name+' helper '+s.name.text,s,functionStatement(ast,s.name.text),sf);cover(s.name.text);continue;
   }
   throw Error('Unaccounted source statement '+s.getText());
 }
}
// The only index source is this exact re-export; the bundle alias chain above ends at lib.
assert.equal(source.get('index').statements.length,1);
assert.equal(source.get('index').statements[0].getText(),'module.exports = require("./MMLIterator");');
// Babel class scaffolding is checked against explicit reviewed editable templates.
const helperSource=parse('reviewed-class-scaffolding.js',fs.readFileSync(path.join(import.meta.dirname,'class-scaffolding.js'),'utf8'));
const helperVar=helperSource.statements.find(ts.isVariableStatement).declarationList.declarations[0].initializer;
const helperCheck=functionStatement(helperSource,'_classCallCheck');
for(const suffix of ['$2','$1','']) {
 equivalent('class descriptor helper '+suffix,helperVar,decl('_createClass'+suffix).initializer,helperSource);cover('_createClass'+suffix);
 equivalent('class constructor guard '+suffix,helperCheck,functionStatement(ast,'_classCallCheck'+suffix),helperSource);cover('_classCallCheck'+suffix);
}
assert.equal(coveredBundle.size,ast.statements.length,'Every embedded top-level statement must be accounted for');
// Safety guards for permitted local alias normalization: declaration proof and identifiers.
const encounteredThis=new Set(),declaredThis=new Set();
let guardCalls=0;
function walk(n) {
 if(ts.isIdentifier(n)&&thisAlias.test(n.text))encounteredThis.add(n.text);
 if(ts.isVariableDeclaration(n)&&thisAlias.test(n.name.getText())){assert.equal(n.initializer.kind,ts.SyntaxKind.ThisKeyword);declaredThis.add(n.name.text);}
 if(classCheck(n))guardCalls++;
 ts.forEachChild(n,walk);
}walk(ast);
assert.deepEqual([...encounteredThis].sort(),[...declaredThis].sort());
assert.equal(guardCalls,3,'Only the three validated constructor guards may be normalized away');
// Each lexical-this reference must resolve to a declaration in an enclosing function,
// not a global alias or a declaration in a sibling function.
function checkThisScope(n,stack=[]) {
 let next=stack;
 if(ts.isFunctionLike(n)&&n.body) {
   const local=new Set();
   const collect=x=>{if(x!==n.body&&ts.isFunctionLike(x))return;if(aliasDeclaration(x))local.add(x.declarationList.declarations[0].name.text);ts.forEachChild(x,collect);};
   collect(n.body);next=[...stack,local];
 }
 if(ts.isIdentifier(n)&&thisAlias.test(n.text))assert(next.some(scope=>scope.has(n.text)),'Unbound this alias '+n.text);
 ts.forEachChild(n,x=>checkThisScope(x,next));
}checkThisScope(ast);
const report={status:'PASS_FULL_STATIC_CORRESPONDENCE',runtimeChanged:false,gameExecuted:false,
 proofScriptSha256:sha(fs.readFileSync(import.meta.filename)),
 originalAudioSha256:sha(bytes),shippedAudioSha256:sha(shippedAudio),shippedEmbeddedBlockByteIdentical:true,embeddedBlockSha256:sha(embedded),embeddedBlock:{startLine:code.slice(0,first).split('\n').length,endLine:code.slice(0,last).split('\n').length-1},
 preferredSource:{repository:'https://github.com/mohayonao/mml-iterator',commit:'7e76ab2734521eeb59a7ac4f94c2634502be1475',version:'1.1.0'},
 completeModules:[...source.keys()].map(name=>({file:name+'.js',sha256:sha(fs.readFileSync(path.join(sourceRoot,name+'.js')))})),
 moduleMapping:[
   ['Syntax',['Syntax$2']],['DefaultParams',['DefaultParams$1']],
   ['Scanner',['_createClass$2','_classCallCheck$2','Scanner$1','Scanner_1']],
   ['MMLParser',['_createClass$1','_classCallCheck$1','Syntax$1','Scanner','NOTE_INDEXES','MMLParser$1','MMLParser_1']],
   ['MMLIterator',['_createClass','_classCallCheck','Syntax','DefaultParams','MMLParser','ITERATOR','MMLIterator','arrayToIterator','isNoteEvent','MMLIterator_1']],
   ['index',['lib']],
 ].map(([name,names])=>({sourceFile:name+'.js',bundleBindings:names.map(binding=>({binding,...at(varStatement(binding)??functionStatement(ast,binding),ast)}))})),
 checkedRecords:records,checkedBundleTopLevelStatements:coveredBundle.size,totalBundleTopLevelStatements:ast.statements.length,
 wiring,compilerScaffolding:{source:'scripts/crisp/class-scaffolding.js',sha256:sha(fs.readFileSync(path.join(import.meta.dirname,'class-scaffolding.js'))),copies:3},
 normalization:['whitespace/comments and grouping parentheses','const/let lowered to var without changing declaration/reference order','Babel class constructors, descriptor arrays and non-enumerable prototype helper','arrow functions lowered to functions and declared lexical-this aliases','object shorthand and concise object methods','single Scanner template literal lowered to string concatenation','numeric unary + on literals','empty default branch removed','known Rollup/Babel local alpha-renames'],
 conclusion:'Every source module, class constructor, method, local constant, free helper and embedded top-level statement is accounted for. Bodies compare exactly under the documented finite AST normalization, and import/export wiring and generated class helpers are independently checked. This establishes exact preferred editable-source correspondence; it does not assert unavailable historical npm lockfile resolution.'};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,modules:report.completeModules.length,bodyComparisons:records.length,bundleStatements:coveredBundle.size,runtimeChanged:false},null,2));
