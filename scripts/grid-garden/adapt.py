#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Reproduce narrow lifecycle/security seams; never execute upstream JavaScript."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'vendor/grid-garden-original/upstream'
PUBLIC = ROOT / 'public/grid-garden'
CHECK = '--check' in sys.argv

def output(path, data):
    target = PUBLIC / path
    if CHECK:
        assert target.read_bytes() == data, str(path)
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

def replace(text, old, new):
    assert text.count(old) == 1, old[:100]
    return text.replace(old, new)

game = (SOURCE / 'js/game.js').read_text()
game = replace(game, 'var game = {', '// Original Grid Garden by Thomas Park, MIT. Lifecycle seams: vendor CHANGES.md.\nvar game = {')
for old, new in [
    ("language: window.location.hash.substring(1) || 'en',", "language: 'zh-cn',"),
    ("level: parseInt(localStorage.level, 10) || 0,", 'level: 0,'),
    ("answers: (localStorage.answers && JSON.parse(localStorage.answers)) || {},", 'answers: {},'),
    ("solved: (localStorage.solved && JSON.parse(localStorage.solved)) || [],", 'solved: [],'),
    ("  user: localStorage.user || '',\n", ''),
]:
    game = replace(game, old, new)
start = game.index('    // navigator.language')
end = game.index('    game.translate();', start)
game = game[:start] + game[end:]
start = game.index('    if (!localStorage.user)')
end = game.index('    this.setHandlers();', start)
game = game[:start] + game[end:]
start = game.index('  setHandlers: function() {')
end = game.index('  loadMenu: function()', start)
game = game[:start] + '''  setHandlers: function() { game.bridge.setHandlers(); },

  prev: function() { game.bridge.navigate(game.level - 1); },

  next: function() { game.bridge.navigate(game.level + 1); },

''' + game[end:]
game = replace(game, "var levelMarker = $('<span/>').addClass('level-marker')", "var levelMarker = $('<button type=\"button\"/>').addClass('level-marker')")
game = replace(game, "game.level = parseInt(level, 10);\n      game.loadLevel(levels[level]);", "game.bridge.navigate(parseInt(level, 10));")
game = replace(game, "  loadLevel: function(level) {\n", "  loadLevel: function(level) {\n    game.bridge.beforeLevel(level);\n")
game = replace(game, "$('#code').val(answer).focus();", "$('#code').val(answer || '');")
game = replace(game, "    game.check();\n  },\n\n  loadDocs", "    game.check();\n    game.bridge.afterLevel();\n  },\n\n  loadDocs")
start = game.index('  loadDocs: function() {')
end = game.index('  applyStyles: function()', start)
game = game[:start] + '  loadDocs: function() { game.bridge.loadDocs(); },\n\n' + game[end:]
game = replace(game, "  applyStyles: function() {\n", "  applyStyles: function() {\n    if (game.bridge.ending()) return;\n")
game = replace(game, "var code = $('#code').val();", "var code = game.bridge.safeCSS($('#code').val());")
game = replace(game, "  check: function() {    \n    game.applyStyles();", "  check: function() { return game.bridge.check(); },\n\n  compare: function() {")
game = replace(game, '    var plants = {};\n', '')
# Preserve browser-computed rectangle/size/color comparison. Count matches so
# overlapping same-color items cannot satisfy multiple original objectives.
game = replace(game, '      treatments[key] = val;', '      key += ":" + val;\n      treatments[key] = (treatments[key] || 0) + 1;')
game = replace(game, '      if (!(key in treatments) || treatments[key] !== val) {\n        correct = false;\n      }', '      key += ":" + val;\n      if (!treatments[key]) correct = false;\n      else treatments[key]--;')
game = replace(game, '    if (correct) {\n      ga(', '    if (Object.values(treatments).some(function(count) { return count !== 0; })) correct = false;\n\n    if (correct) {\n      ga(')
game, count = re.subn(r"      ga\('send', \{[\s\S]*?      \}\);", '', game)
assert count == 2
game = replace(game, "    } else {\n\n    }\n  },\n\n  saveAnswer", "    } else {\n      $('#next').removeClass('animated animation').addClass('disabled');\n    }\n    return correct;\n  },\n\n  saveAnswer")
game = replace(game, '  saveAnswer: function() {\n', '  saveAnswer: function() {\n    if (game.bridge.ending()) return;\n')
game = replace(game, "    game.answers[level.name] = $('#code').val();", "    game.answers[level.name] = $('#code').val();\n    game.bridge.save();")
start = game.index('  debounce: function(')
game = game[:start] + '''  debounce: function(func, wait) { return game.bridge.debounce(func, wait); }
};

// Validated host handshake starts the retained original engine.
'''
output('js/game.js', game.encode())
for name in ['js/levels.js', 'js/docs.js', 'js/messages.js', 'css/style.css', 'LICENSE', 'README.md']:
    output(name, (SOURCE / name).read_bytes())
for folder in ['images', 'licenses', 'third-party']:
    for path in sorted((SOURCE / folder).rglob('*')):
        if path.is_file():
            output(path.relative_to(SOURCE), path.read_bytes())
print('Grid Garden runtime matches exact source and explicit seams.' if CHECK else 'Grid Garden runtime prepared.')
