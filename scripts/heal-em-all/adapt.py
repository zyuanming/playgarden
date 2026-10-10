#!/usr/bin/env python3
"""Reproduce the small, reviewed changes to the frozen JavaScript. No compiler/install."""
# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'vendor/heal-em-all-original/upstream/app/scripts'
OUT = ROOT / 'public/heal-em-all'

def emit(path, content):
    if '--check' in sys.argv:
        assert path.read_text() == content, 'Generated runtime drift: ' + str(path)
    else:
        path.write_text(content)

def replace(text, before, after):
    assert before in text, 'Frozen-source seam changed: ' + before[:100]
    return text.replace(before, after)

game = (SRC / 'game.js').read_text()
start = game.index('      this.Q = Q = Quintus(')
end = game.index('      this.SPRITE_NONE', start)
game = game[:start] + '''      this.Q = Q = Quintus({development: false, sound: false, imagePath: "./images/", dataPath: "./data/"});
      Q.include("Sprites, Scenes, Input, UI, 2D, Anim");
      HealBridge.setup(Q);
      Game.storageKeys = {availableLevel: "playgarden.heal-em-all.v1.available", levelProgress: "playgarden.heal-em-all.v1.stars"};
      Game.availableLevel = HealBridge.storage.getItem(Game.storageKeys.availableLevel) || 1;
''' + game[end:]
game = replace(game, '      this.initStats();\n      this.initUnloadEvent();\n', '')
start = game.index('      this.audio = {')
end = game.index('      assetsAsArray = [];', start)
game = game[:start] + '      this.audio = {};\n      Game.isMuted = true;\n' + game[end:]
game = replace(game, '      this.objValueToArray(this.audio, audioAsArray);', '')
start = game.index('    initStats: function() {')
end = game.index('    stageLevel:', start)
game = game[:start] + game[end:]
start = game.index('    trackEvent: function(')
end = game.index('\n  };', start)
game = game[:start] + '    trackEvent: function() {}' + game[end:]
# Remove analytics call sites as well as the analytics transport.
game = '\n'.join(line for line in game.split('\n') if 'Game.trackEvent(' not in line)
start = game.index('  Q.AudioManager = {')
end = game.index('\n\n}).call(this);', start)
game = game[:start] + '''  Q.AudioManager = {add: function(){}, remove: function(){}, stopAll: function(){}, clear: function(){}, mute: function(){}, unmute: function(){}};''' + game[end:]
game = replace(game, '    return Game.stageStartScreen();', '    if (!Q.disposed) return HealBridge.ready(Game);')
start = game.index('    progressCallback: function(loaded, total) {')
end = game.index('\n  });', start)
game = game[:start] + '''    progressCallback: function(loaded, total) { HealBridge.progress(loaded, total); },
    errorCallback: function(asset) { HealBridge.error("资源加载失败：" + asset); }
''' + game[end:]
game = game.replace('localStorage.', 'HealBridge.storage.')
game = replace(game, '          this.p.noOfBullets -= 1;', '          this.p.noOfBullets = Math.max(0, this.p.noOfBullets - 1);')
game = replace(game, 'I need to kill myself', '跳出地图，恢复人类形态')
game = game.replace('Boogaloo', 'sans-serif').replace('Jolly Lodger', 'sans-serif')
game = replace(game, 'created by @krzysu and @pawelmadeja, follow us for updates', 'Krzysztof Urbas · Paweł Madeja · 2013')
game = replace(game, 'You did it!\\nIf you like the game, follow us on twitter.\\nAlso please give us some feedback.\\nThanks for your time!', '六关旅程完成！\\n感谢你的救援。\\n可以回到关卡，再试着救下更多人。')
game = replace(game, '  window.Game = {', '  Game = {')
emit(OUT / 'game.js', '// SPDX-License-Identifier: GPL-3.0-only\n// Playgarden adaptation, 2026-10-10. See NOTICE.txt and source.zip.\n(function(HealBridge) { var Game;\n' + game + '\n})(window.HealBridge);\n')

engine = (SRC / 'lib/quintus-all.js').read_text()
engine = replace(engine, '      Q.stats.begin()\n', '')
engine = replace(engine, '      Q.stats.end()\n', '')
engine = replace(engine, '    window.requestAnimationFrame(Q.gameLoopCallbackWrapper);', '    Q.loop = window.requestAnimationFrame(Q.gameLoopCallbackWrapper);')
engine = replace(engine, '    Q.gameLoopCallbackWrapper = function() {', '    Q.gameLoopCallbackWrapper = function() {\n      if (Q.disposed || Q.hostPaused) { Q.loop = null; return; }')
engine = replace(engine, '    if(!Q.loop) {\n      Q.lastGameLoopFrame', '    if(!Q.loop && !Q.disposed && !Q.hostPaused && Q.gameLoopCallbackWrapper) {\n      Q.lastGameLoopFrame')
engine = replace(engine, '  Q.gameLoop = function(callback) {', '  Q.gameLoop = function(callback) {\n    if (Q.disposed) return Q;')
emit(OUT / 'quintus.js', '// Playgarden lifecycle/stats adaptation, 2026-10-10; original MIT notices follow.\n' + engine)
print('Verified generated Heal’em All runtime.' if '--check' in sys.argv else 'Reproduced game.js and quintus.js from frozen source.')
