#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Reproduce the small lifecycle/security edits without executing upstream JS."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'vendor/flexbox-froggy-original/upstream'
PUBLIC = ROOT / 'public/flexbox-froggy'
check = '--check' in sys.argv

def output(path, data):
    target = PUBLIC / path
    if check:
        assert target.read_bytes() == data, str(path)
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

def replace(text, old, new):
    assert text.count(old) == 1, old[:100]
    return text.replace(old, new)

game = (SOURCE / 'js/game.js').read_text()
game = replace(game, "var game = {", "// Thomas Park, MIT. Playgarden lifecycle seams: see CHANGES.md.\nvar clickedCode = null;\nvar game = {")
game = replace(game, "colorblind: (localStorage.colorblind && JSON.parse(localStorage.colorblind)) || 'false',", "colorblind: 'false',")
game = replace(game, "language: window.location.hash.substring(1) || 'en',", "language: 'zh-cn',")
game = replace(game, "level: parseInt(localStorage.level, 10) || 0,", "level: 0,")
game = replace(game, "answers: (localStorage.answers && JSON.parse(localStorage.answers)) || {},", "answers: {},")
game = replace(game, "solved: (localStorage.solved && JSON.parse(localStorage.solved)) || [],", "solved: [],")
start = game.index('    // navigator.language')
end = game.index('    game.translate();', start)
game = game[:start] + game[end:]
start = game.index('  setHandlers: function() {')
end = game.index('  loadMenu: function()', start)
game = game[:start] + '''  setHandlers: function() { game.bridge.setHandlers(); },

  prev: function() { game.bridge.navigate(game.level - 1); },

  next: function() {
    game.bridge.navigate(game.difficulty === 'hard'
      ? Math.floor(Math.random() * levels.length) : game.level + 1);
  },

''' + game[end:]
game = replace(game, "var levelMarker = $('<span/>').addClass('level-marker')", "var levelMarker = $('<button type=\"button\"/>').addClass('level-marker')")
game = replace(game, "game.level = parseInt(level, 10);\n      game.loadLevel(levels[level]);", "game.bridge.navigate(parseInt(level, 10));")
game = replace(game, "  loadLevel: function(level) {\n", "  loadLevel: function(level) {\n    game.bridge.beforeLevel(level);\n")
game = replace(game, "$('#code').val(answer).focus();", "$('#code').val(answer || '');")
game = replace(game, "    game.check();\n  },\n\n  loadDocs", "    game.check();\n    game.bridge.afterLevel();\n  },\n\n  loadDocs")
game = replace(game, "var code = $('#code').val();\n    var selector = level.selector || '';\n    $('#pond ' +  selector).attr('style', code);", "if (game.bridge.ending()) return;\n    var code = game.bridge.safeCSS($('#code').val());\n    var selector = level.selector || '';\n    $('#pond ' + selector).attr('style', code);")
start = game.index('  check: async function() {')
end = game.index('  compare: function()', start)
game = game[:start] + '  check: function() { return game.bridge.check(); },\n\n' + game[end:]
# Keep the original DOM-position/color checker, with a one-to-one multiset so
# overlapping same-color frogs cannot accidentally satisfy more than one pad.
game = replace(game, '    var lilypads = {};\n    var frogs = {};', '    var frogs = {};')
game = replace(game, '      frogs[key] = val;', '      key += ":" + val;\n      frogs[key] = (frogs[key] || 0) + 1;')
game = replace(game, '      if (!(key in frogs) || frogs[key] !== val) {\n        correct = false;\n      }', '      key += ":" + val;\n      if (!frogs[key]) correct = false;\n      else frogs[key]--;')
game = replace(game, '    if (correct) {\n      if ($.inArray', '    if (Object.values(frogs).some(function(count) { return count !== 0; })) correct = false;\n\n    if (correct) {\n      if ($.inArray')
game = replace(game, "      $('#next').removeClass('animated animation').addClass('disabled');\n    }\n  },\n\n  saveAnswer", "      $('#next').removeClass('animated animation').addClass('disabled');\n    }\n    return correct;\n  },\n\n  saveAnswer")
game = replace(game, "  saveAnswer: function() {\n    var level", "  saveAnswer: function() {\n    if (game.bridge.ending()) return;\n    var level")
game = replace(game, "    game.answers[level.name] = $('#code').val();", "    game.answers[level.name] = $('#code').val();\n    game.bridge.save();")
start = game.index('  debounce: function(')
end = game.index('  writeCSS: function', start)
game = game[:start] + '  debounce: function(func, wait) { return game.bridge.debounce(func, wait); },\n\n' + game[end:]
game = replace(game, "$(document).ready(function() {\n  game.start();\n});", '// The sandbox bridge starts the original game after validated host state arrives.')
output('js/game.js', game.encode())

for path in ['js/levels.js', 'js/docs.js', 'js/messages.js', 'css/style.css', 'LICENSE', 'README.md']:
    output(path, (SOURCE / path).read_bytes())
for folder in ['images', 'licenses', 'third-party']:
    for path in sorted((SOURCE / folder).rglob('*')):
        if path.is_file():
            output(path.relative_to(SOURCE), path.read_bytes())
print('Flexbox Froggy runtime matches the frozen source and explicit lifecycle patch.' if check else 'Flexbox Froggy runtime prepared.')
