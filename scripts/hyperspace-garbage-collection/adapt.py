# SPDX-License-Identifier: GPL-3.0-only
"""Reproducible, exact-anchor lifecycle seams on the cleared upstream subset."""
from pathlib import Path
import json, sys
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'vendor/hyperspace-garbage-collection-original/cleared'
OUT=ROOT/'public/hyperspace-garbage-collection'
CHECK='--check' in sys.argv

def emit(path, text):
    dest=OUT/path
    data = text.encode('utf-8') if isinstance(text, str) else text
    if CHECK:
        assert dest.read_bytes()==data, 'Derived output differs: '+str(path)
    else:
        dest.parent.mkdir(parents=True, exist_ok=True); dest.write_bytes(data)

def replace(text, old, new):
    assert text.count(old)==1, old[:120]
    return text.replace(old,new)

for file in SRC.rglob('*'):
    if not file.is_file(): continue
    rel=file.relative_to(SRC)
    # Preserve cleared source separately; runtime has no unused views/templates,
    # legacy main, XHR text loader, duplicate engine build or legacy stylesheet.
    if str(rel).startswith(('templates/','stylesheets/','corresponding-source/','js/views/')): continue
    if str(rel) in ['index.html','js/main.js','js/require.js','js/text.js','js/Box2dWeb/Box2dWeb-2.1.a.3.min.js']: continue
    text=file.read_text()
    if str(rel).startswith('js/levels/level-0'):
        n=int(file.stem[-2:])
        text=replace(text,f"'text!../../json/level-0{n}.json'",f"'maps/level-0{n}'")
        nextfn=f'level0{n+1}' if n<4 else 'levelEnd'
        text=replace(text,f'{nextfn}( game );',f'game.stageCleared( {n-1}, {nextfn} );')
        if n in (1,2):
            text=replace(text,"  var Utils = require( 'utils' );","  var Clock = require( 'playgarden-clock' );\n  var Utils = require( 'utils' );")
            text=text.replace('setInterval(', 'Clock.setInterval(').replace('clearInterval(', 'Clock.clearInterval(')
        if n==1: text=text.replace("'WASD   ←↑→↓   touch'", "'WASD · 方向键 · 触摸拖动'")
        if n==2:
            text=replace(text,'game.material = Material.ANTIMATTER;', 'game.player.material = Material.ANTIMATTER;')
            text=text.replace("'Press button or spacebar to change matter type.'", "'空格 / 按钮：切换物质'")
    if str(rel) in ['js/entities/emitter.js','js/entities/door.js']:
        text=replace(text,"define([\n", "define([\n  'playgarden-clock',\n")
        text=replace(text,'], function( PhysicsEntity', '], function( Clock, PhysicsEntity')
        text=text.replace('setTimeout(', 'Clock.setTimeout(')
    if str(rel)=='js/entities/trigger.js':
        text=replace(text,'if ( this.object && !this.active ) {', '''if ( this.object && !this.active && this.object.game === this.game &&
         this.game.removed.indexOf( this.object ) === -1 &&
         !( this.object.time > this.object.lifeTime ) ) {''')
    if str(rel)=='js/game.js':
        text=replace(text,"  var Box2D = require( 'box2d' );", "  var Clock = require( 'playgarden-clock' );\n  var Box2D = require( 'box2d' );")
        text=text.replace('setTimeout(', 'Clock.setTimeout(').replace('clearTimeout(', 'Clock.clearTimeout(')
        start=text.index('  Game.prototype.update = function() {')
        end=text.index('    this.input.update( dt );', start)
        text=text[:start]+'  Game.prototype.update = function( dt ) {\n'+text[end:]
        text=replace(text,"    this.removed.forEach(function( removed ) {\n      this.remove( removed );", "    this.removed.forEach(function( removed ) {\n      if ( removed.game !== this ) return;\n      this.remove( removed );")
        start=text.index('  Game.prototype.tick = function() {')
        end=text.index('  Game.prototype.add = function(', start)
        text=text[:start]+'''  // The embedding adapter owns the sole requestAnimationFrame loop.
  Game.prototype.tick = function() {};

'''+text[end:]
        text=replace(text,'    this.entities.push( entity );','    entity.observationId = ++this.observationSequence;\n    this.entities.push( entity );')
        text=replace(text,'    this.entities = [];\n    this.player = null;','    this.entities = [];\n    this.observationSequence = 0;\n    this.player = null;')
        text=replace(text,'  Game.prototype.clear = function() {\n    this.entities = [];', '''  Game.prototype.clear = function() {
    Clock.reset();
    this.entities.forEach(function( entity ) { entity.game = null; });
    this.entities = [];
    this.removed = [];
    this.text = '';
    this.shake = new Shake();
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.va = 0;
    this.player.angle = 0;
    this.player.emotion = Player.Emotion.NORMAL;
    this.player.emotionTimeout = null;
    this.player.material = Material.ANTIMATTER;
    this.input.clear();
    Settings.high();''')
        text=replace(text,'    while ( body ) {\n      if', '    while ( body ) {\n      var nextBody = body.GetNext();\n      if')
        text=replace(text,'      body = body.GetNext();','      body = nextBody;')
    if str(rel)=='js/input.js':
        start=text.index('      var x = event.pageX,')
        end=text.index('      return {',start)
        text=text[:start]+'''      var rect = this.game.canvas.getBoundingClientRect();
      var x = (event.clientX - rect.left) * this.game.canvas.width / rect.width;
      var y = (event.clientY - rect.top) * this.game.canvas.height / rect.height;

'''+text[end:]
        text=replace(text,'  Input.prototype = {', '''  Input.prototype = {
    clear: function() {
      this.keys = [];
      this.touches = [];
      this.initialTouch = null;
      this.touch = null;
      Object.keys(this.controls).forEach(function(key) { this.controls[key] = false; }.bind(this));
    },''')
    if text != file.read_text():
        text = '// Playgarden lifecycle changes GPL-3.0-only; original portions retain their MIT grant.\n' + text
        emit(rel,text)
    else:
        emit(rel,file.read_bytes())
# Avoid opaque-origin XHR and all dynamic text evaluation: exact authored map
# strings are packaged as local AMD modules; no map import is exposed.
for n in range(1,5):
    raw=(SRC/f'json/level-0{n}.json').read_text()
    emit(Path(f'js/maps/level-0{n}.js'), '// SPDX-License-Identifier: MIT AND GPL-3.0-only\n// Copyright (c) 2013 razh. Authored JSON unchanged.\ndefine(function() { return '+json.dumps(raw,ensure_ascii=False)+'; });\n')
loader=(SRC/'corresponding-source/requirejs-2.1.9.js').read_text()
loader=replace(loader, '        return eval(text);', "        throw new Error('Dynamic source execution is disabled in Playgarden.');")
emit(Path('js/require.js'), '// Playgarden dynamic-evaluation removal GPL-3.0-only; original RequireJS MIT.\n' + loader)
print('Cleared original engine, four maps and ending reproduced; lifecycle seams checked.' if CHECK else 'Adapted runtime generated.')
