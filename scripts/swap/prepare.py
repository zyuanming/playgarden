# SPDX-License-Identifier: GPL-3.0-only
"""Static source assembly only; never evaluates or runs upstream JavaScript."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'vendor/swap-original/upstream'
header='''// Swap by Noah Moroze and Michael Yang, CC-BY-SA-4.0.
// Fixed source: nmoroze/swap@a3cfb7d2d59d37dd3778d5de685a206cca4f1206.
// Adapted 2026-10-10 for Playgarden; adapter contributions GPL-3.0-only.
// Original license/attribution remain applicable. See vendor/swap-original/NOTICE.md.
'''
levels=(SRC/'js/levels.js').read_text().replace('var levels = [','export const swapMaps = [',1)
(ROOT/'src/vendor/swapMaps.ts').write_text(header+levels+';\n')
chunks=[]
def add(name, transform=lambda s:s):
    text=(SRC/'js'/name).read_text()
    chunks.append('// BEGIN upstream/js/'+name+' (changes recorded in source-map.json)\n'+transform(text)+'\n// END upstream/js/'+name+'\n')
def tile(s):
    return s.replace('t = new SwitchedTile(x, y)','var t = new SwitchedTile(x, y)')
def ai(s):
    # Retain constructors and return paths, attach stable identity at the factory seam.
    s=s.replace('var getAI = function(x, y, id) {','var originalGetAI = function(x, y, id) {')
    return s+'\nvar actorSequence = 0;\nvar getAI = function(x,y,id) { var actor=originalGetAI(x,y,id); actor.type=id; actor.id=actorSequence++; return actor; };\n'
def player(s):
    return s.replace('getVelocity: getVelocity,','getVelocity: getVelocity,\n        saveMotion: function() { return {vx:vx,vy:vy,trail:this.trail.map(p=>p.slice())}; },\n        restoreMotion: function(m) { vx=m.vx;vy=m.vy;this.trail=m.trail.map(p=>p.slice()); },')
def draw(s):
    s=s.replace('canvas = document.getElementById(canvasId);','canvas = canvasId;')
    s=s.replace('tipDisplay = document.getElementById(tipId);','tipDisplay = tipId;')
    s=s.replace('hud = document.getElementById(hudId);','hud = hudId;')
    start=s.index('\tvar renderText = function(');end=s.index('\n\tvar draw = function(',start)
    s=s[:start]+'\tvar renderText = function() {}; // Host renders escaped, accessible text.\n'+s[end:]
    start=s.index('\tvar showDialogue = function(');end=s.index('\n\tvar clearShadows = function(',start)
    s=s[:start]+'\tvar showDialogue = function() {}; // Accessible host controls replace canvas dialogues.\n'+s[end:]
    return s.replace('ctx.shadowColor = 0;', 'ctx.shadowColor = "transparent";')
def world(s):
    s=s.replace('\tvar intervalId;','\t// Scheduling belongs to the host; each mount owns one independent instance.\n\tvar ticks = 0;')
    s=s.replace('\t\tcreateDialogue("Welcome to Swap");','\t\tcreateDialogue("ready");')
    s=s.replace('\t\tif(intervalId)\n\t\t\tclearInterval(intervalId); //makes sure we don\'t run dual loops','\t\tticks = 0; actorSequence = 0; switchedTiles = new Array(10); anyDown = [];')
    s=s.replace('\t\tintervalId = setInterval(run, 1000 / fps);\n\t\trun();','\t\trenderer.draw(aiEntities, floor);')
    s=s.replace('\t\t\tcurLevel++;','\t\t\t// Selected level stays fixed; the host owns explicit level selection.')
    s=s.replace('\t\tclearInterval(intervalId);','\t\t// Host stops ticking at terminal state.')
    s=s.replace('\t\tif (!dialogue)\tupdate();','\t\tif (!dialogue && !hasDied && !hasWon) { ticks++; update(); }')
    # Stop after the first actual collision-produced result, avoiding later same-tick overwrite.
    s=s.replace('\t\t\ttouchingTiles[i].onCollide(player);','\t\t\ttouchingTiles[i].onCollide(player);\n            if (hasDied || hasWon) return;')
    s=s.replace('\t\t\t\ttouchingTiles[j].onCollide(aiEntities[i])','\t\t\t\ttouchingTiles[j].onCollide(aiEntities[i]);\n                if (hasDied || hasWon) return;')
    # Preserve original four-corner hitbox; guard a malformed/outside coordinate with a wall.
    s=s.replace('floor[coordToGrid(x, y).y][coordToGrid(x, y).x]', 'tileAt(x, y)')
    s=s.replace('floor[coordToGrid(x+gridSize-10, y).y][coordToGrid(x+gridSize-10, y).x]', 'tileAt(x+gridSize-10, y)')
    s=s.replace('floor[coordToGrid(x, y+gridSize-10).y][coordToGrid(x, y+gridSize-10).x]', 'tileAt(x, y+gridSize-10)')
    s=s.replace('floor[coordToGrid(x+gridSize-10, y+gridSize-10).y][coordToGrid(x+gridSize-10, y+gridSize-10).x]', 'tileAt(x+gridSize-10, y+gridSize-10)')
    pos=s.index('\n\tvar coordToGrid')
    s=s[:pos]+'''\n    var tileAt = function(x,y) {
        var p=coordToGrid(x,y);
        return floor[p.y]?.[p.x] || new WallTile(p.x*gridSize,p.y*gridSize);
    };
'''+s[pos:]
    pos=s.index('\n\treturn {\n\t\tinit: init')
    s=s[:pos]+'''\n    // Host-only lifecycle/state seam. Physics above is retained from the original.
    var capture = function() {
        const ordered=[player.currentAI,...aiEntities];
        const actors=ordered.map(a=>{
            const o={id:a.id,type:a.type,x:a===player.currentAI?player.x:a.x,y:a===player.currentAI?player.y:a.y,vx:a.vx,vy:a.vy,hitWall:!!a.hitWall};
            for(const k of ['prevX','prevY','vxo','vyo']) if(Number.isFinite(a[k])) o[k]=a[k];
            return o;
        });
        return {version:1,source:'a3cfb7d2',level:curLevel,ticks,deaths,
            result:hasWon?'won':hasDied?'lost':'playing',actors,motion:player.saveMotion(),
            gates:floor.flatMap((row,y)=>row.flatMap((t,x)=>levels[curLevel].tiles[y][x]>=20?[{x,y,open:!t.blocksMovement,touching:!!t.touchingAI,just:!!t.justTouching}]:[])),
            plates:floor.flatMap((row,y)=>row.flatMap((t,x)=>levels[curLevel].tiles[y][x]>=10&&levels[curLevel].tiles[y][x]<20?[{x,y,down:!!t.down}]:[])),anyDown:Array.from({length:10},(_,i)=>!!anyDown[i])};
    };
    var restore = function(s) {
        const actors=[player.currentAI,...aiEntities];
        const byId=new Map(actors.map(a=>[a.id,a]));
        for(const a of s.actors) {
            const original=byId.get(a.id);
            for(const k of ['x','y','vx','vy','prevX','prevY','vxo','vyo','hitWall']) {
                if(k in a) original[k]=a[k]; else if(Object.prototype.hasOwnProperty.call(original,k)) delete original[k];
            }
        }
        player.setAI(byId.get(s.actors[0].id)); player.restoreMotion(s.motion);
        aiEntities=s.actors.slice(1).map(a=>byId.get(a.id));
        for(const t of s.gates) {const original=floor[t.y][t.x];original.blocksMovement=!t.open;original.touchingAI=t.touching;original.justTouching=t.just;original.color=t.open?'rgb(235, 235, 235)':'rgb(253, 198, 137)';}
        for(const t of s.plates) floor[t.y][t.x].down=t.down;
        anyDown=s.anyDown.slice();ticks=s.ticks;deaths=s.deaths;hasWon=s.result==='won';hasDied=s.result==='lost';
        dialogue=s.result==='playing'?'ready':s.result;input.reset();renderer.draw(aiEntities,floor);
    };
'''+s[pos:]
    s=s.replace('init: init,','init: init,\n        step: run, capture: capture, restore: restore,\n        start: function(){if(!hasWon&&!hasDied)dialogue="";},\n        paint: function(){renderer.draw(aiEntities,floor);},\n        getGrid: function(){return gridSize;},\n        retry: function(){initLevel(curLevel);dialogue="ready";},',1)
    return s
add('tile.js',tile);add('ai.js',ai);add('player.js',player);add('draw.js',draw);add('world.js',world)
preamble=header+'''// @ts-nocheck
// Original dynamic prototype code is intentionally retained, isolated per game mount.
import {swapMaps as levels} from './swapMaps';
import {validSwapSave,type SwapSave,type SwapSnapshot,type SwapDirection,type SwapRuntime} from './swapState';
export function createSwapRuntime(canvas:HTMLCanvasElement,level:number):SwapRuntime {
    canvas.width=640;canvas.height=640;
    var input={up:false,down:false,left:false,right:false,reset:function(){this.up=this.down=this.left=this.right=false;},gameMode:function(){},dialogueMode:function(){this.reset();}};
'''
post='''
    let disposed=false,started=false;
    world.init(level,canvas,null,null);
    function snapshot():SwapSnapshot {
        const s=world.capture();
        return {...s,gridSize:world.getGrid(),width:levels[level].sizeX,height:levels[level].sizeY,started,
            held:['up','down','left','right'].filter(k=>input[k]),credits:level===24};
    }
    return {
        snapshot,
        start(){if(disposed)return;started=true;input.reset();world.start();},
        step(){if(disposed||!started)return;world.step();},
        hold(direction:SwapDirection,down:boolean){if(!disposed)input[direction]=down;},
        cancel(){input.reset();},
        swap(){if(disposed||!started||world.capture().result!=='playing')return;input.reset();world.cyclePlayer();world.paint();},
        retry(){if(disposed)return;started=false;input.reset();world.retry();},
        save():SwapSave{return world.capture();},
        restore(value:unknown){if(disposed||!validSwapSave(value,world.capture()))return false;world.restore(value);started=false;return true;},
        dispose(){disposed=true;started=false;input.reset();}
    };
}
'''
(ROOT/'src/vendor/swapRuntime.ts').write_text(preamble+'\n'.join(chunks)+post)
mapdata={'upstream':'nmoroze/swap','commit':'a3cfb7d2d59d37dd3778d5de685a206cca4f1206','upstreamLicense':'CC-BY-SA-4.0','adapterLicense':'GPL-3.0-only','changed':'2026-10-10','files':[]}
for name in ['tile.js','ai.js','player.js','draw.js','world.js']:
    mapdata['files'].append({'upstream':'js/'+name,'adapted':'src/vendor/swapRuntime.ts','marker':'BEGIN upstream/js/'+name})
mapdata['files'].append({'upstream':'js/levels.js','adapted':'src/vendor/swapMaps.ts','changes':'var levels renamed to exported swapMaps; every active and commented map, tip, coordinate preserved'})
mapdata['changes']=['Instance closure replaces global singletons; reset switch arrays; declare factory local.', 'Host owns a 30Hz interval, pause, start/retry, terminal stopping, disposal, direct level choice.', 'Original canvas geometry remains 640 logical pixels; CSS only scales display.', 'Original physics, per-corner collision, six AI behaviors, queue and pressure-switch scan order retained.', 'Identity fields and strictly validated serialized snapshots added; readonly detached observer.', 'DOM lookup/innerHTML/dialogue overlay replaced with scoped canvas and host accessible text.', 'Guard out-of-range tile lookups with a wall; stop tick immediately after first actual terminal collision.', 'No Keypress, Font Awesome, Open Sans, AddThis, music, external assets, skip completion or cheat.']
(ROOT/'vendor/swap-original/source-map.json').write_text(json.dumps(mapdata,indent=2)+'\n')
