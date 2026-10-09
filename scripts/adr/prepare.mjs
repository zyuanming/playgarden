// SPDX-License-Identifier: GPL-3.0-only
// Static source transformation; never evaluates the upstream game.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root = process.cwd(), vendor = path.join(root, 'vendor/adr-original');
const out = path.join(root, 'public/adr-original');
const banner = '// SPDX-License-Identifier: MPL-2.0\n// A Dark Room, Michael Townsend and contributors, fixed d6d1c1b (2020-08-16).\n// Playgarden modifications (2026): isolated storage, safe property access, local resources and accessible layout.\n';
function write(name, text) { const p=path.join(out,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text); }
function source(name) { return fs.readFileSync(path.join(vendor,'upstream',name),'utf8'); }
function patchObject(text, predicate, replacements, nested) {
  const ast=ts.createSourceFile('input.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS), edits=[];
  function visit(n) {
    if(ts.isObjectLiteralExpression(n) && predicate(n)) {
      for(const prop of n.properties) {
        if(!ts.isPropertyAssignment(prop)) continue;
        const key=prop.name.getText(ast).replace(/^['"]|['"]$/g,'');
        if(Object.hasOwn(replacements,key)) edits.push([prop.initializer.getStart(ast),prop.initializer.end,replacements[key]]);
        else if(nested?.[key]) nested[key](prop.initializer,ast,edits);
      }
    }
    ts.forEachChild(n,visit);
  }
  visit(ast);
  for(const [a,b,s] of edits.sort((a,b)=>b[0]-a[0])) text=text.slice(0,a)+s+text.slice(b);
  return text;
}
const has = key => n => n.properties.some(p=>p.name?.getText().replace(/^['"]|['"]$/g,'')===key);
let engine=source('script/engine.js');
engine=patchObject(engine,has('browserValid'),{
  SITE_URL: "''",
  browserValid:'function() { return true; }',
  isMobile:'function() { return false; }',
  getApp:'function() {}', share:'function() {}', event:'function() {}',
  disableSelection:'function() {}', enableSelection:'function() {}',
  import64:`function(string64) { return ADRSave.import64(string64); }`,
  switchLanguage:`function(dom) { var lang=$(dom).data('language'); if(lang==='en'||lang==='zh_cn'){ADRStorage.lang=lang;Engine.saveGame();location.reload();} }`,
  saveLanguage:'function() { ADRStorage.lang = ADRLanguage; }',
}, {
  init(fn,ast,edits) {
    for(const s of fn.body.statements) {
      const t=s.getText(ast);
      if(/Engine\.(?:browserValid|isMobile|getApp|share|Dropbox)|window\.open\(/.test(t)) edits.push([s.getStart(ast),s.end,'']);
    }
  }
});
engine=engine.replaceAll('localStorage','ADRStorage')
  .replace('JSON.parse(ADRStorage.gameState)','ADRSave.parse(ADRStorage.gameState)')
  .replace('ADRStorage.clear();',"ADRStorage.removeItem('gameState');")
  .replace("_('if the code is invalid, all data will be lost.')","'无效存档不会替换现有进度。'")
  .replace("_('this is irreversible.')","'导入前可以先导出当前进度作为备份。'")
  .replace('$(function() {\n\tEngine.init();\n});','// Initialization belongs to the local bridge after every module is loaded.');
write('script/engine.js',banner+engine);
let manager=source('script/state_manager.js');
manager=patchObject(manager,has('MAX_STORE'),{
  createState:`function(stateName,value){ return ADRSave.assign(State,stateName,value); }`,
  set:`function(stateName,value,noEvent){
    if(typeof value==='number' && value>$SM.MAX_STORE)value=$SM.MAX_STORE;
    $SM.createState(stateName,value);
    if(stateName.indexOf('stores')===0 && $SM.get(stateName,true)<0){$SM.createState(stateName,0);Engine.log('Negative store clamped to zero.');}
    if(!noEvent){Engine.saveGame();$SM.fireUpdate(stateName);}
  }`,
  get:`function(stateName,requestZero){var value=ADRSave.lookup(State,stateName);return !value&&requestZero?0:value;}`,
  setget:`function(stateName,value,noEvent){$SM.set(stateName,value,noEvent);return $SM.get(stateName);}`,
  remove:`function(stateName,noEvent){ADRSave.remove(State,stateName);if(!noEvent){Engine.saveGame();$SM.fireUpdate(stateName);}}`,
});
if(/\beval\s*\(/.test(manager))throw Error('State evaluation survived');
write('script/state_manager.js',banner+manager);
let space=source('script/space.js');
// Remove only the optional commercial ending promotion; retain score, prestige,
// original escape animation, restart and all physics/ending conditions.
const promotionStart=space.indexOf("\t\t\t\t\t\t\t\t$('<span>')",space.indexOf(".click(Engine.confirmDelete)"));
const promotionEnd=space.indexOf('\t\t\t\t\t\t\t\tEngine.options = {};',promotionStart);
if(promotionStart<0||promotionEnd<0)throw Error('Ending promotion boundary changed');
space=space.slice(0,promotionStart)+space.slice(promotionEnd);
// Record the already-earned ending only after its original score and prestige save.
space=space.replace('Prestige.save();','Prestige.save();\n                                ADRBridge.recordEnding(Score.calculateScore(), Prestige.get().score);');
write('script/space.js',banner+space);
const scripts=['Button','header','notifications','events','room','outside','world','path','ship','prestige','scoring','events/global','events/room','events/outside','events/encounters','events/setpieces'];
for(const name of scripts)write('script/'+name+'.js',source('script/'+name+'.js'));
for(const name of ['main','room','outside','path','world','ship','space','dark'])write('css/'+name+'.css',source('css/'+name+'.css'));
write('css/zh_cn.css',source('lang/zh_cn/main.css'));
write('lib/jquery.js',fs.readFileSync(path.join(vendor,'jquery-3.7.1/jquery.min.js'),'utf8'));
write('lib/jquery.color.js',fs.readFileSync(path.join(vendor,'jquery-color-2.1.2/jquery.color.js'),'utf8'));
const dictionary=JSON.parse(fs.readFileSync(path.join(vendor,'zh-cn-original-dictionary.json'),'utf8'));
write('dictionary.js',banner+'window.ADRDictionary = '+JSON.stringify(dictionary)+';\n');
const licenses='A Dark Room (2020-08-16), Michael Townsend and contributors. Full original campaign.\nFirst-party original and modified game files: MPL-2.0. Original notices retained.\nThese portions are additionally available under GPL-3.0-only under MPL section 3.3 when combined with Playgarden.\nSource and modifications: https://github.com/zyuanming/playgarden/tree/main/public/adr-original\nOriginal reference: https://github.com/doublespeakgames/adarkroom/tree/d6d1c1b9875bb4764cdb950e8cf65ba51847f0e9\n\n'+source('LICENSE.md')+'\n\njQuery 3.7.1, OpenJS Foundation and contributors (MIT)\n'+fs.readFileSync(path.join(vendor,'jquery-3.7.1/LICENSE.txt'),'utf8')+'\n\njQuery Color 2.1.2 (MIT)\n'+fs.readFileSync(path.join(vendor,'licenses/jquery-color-2.1.2-MIT.txt'),'utf8');
write('LICENSES.txt',licenses);
console.log('Prepared complete original campaign; 19 gameplay modules, local jQuery 3.7.1 and Color, original dictionary and full licenses.');
