#!/usr/bin/env python3
"""Static provenance/fidelity check, not a unit test or runtime execution."""
from pathlib import Path
import hashlib, json, re

root = Path(__file__).resolve().parents[2]
vendor = root / 'vendor/coil-original'
manifest = json.loads((vendor / 'source-manifest.json').read_text())
count = size = 0
for item in manifest['files']:
    if not item.get('snapshotIncluded'):
        continue
    data = (vendor / 'upstream' / item['path']).read_bytes()
    assert len(data) == item['bytes'], item['path']
    assert hashlib.sha256(data).hexdigest() == item['sha256'], item['path']
    assert hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == item['gitBlob'], item['path']
    count += 1
    size += len(data)
assert (count, size) == (10, 147210)
original = (vendor / 'upstream/js/coil.js').read_text()
runtime = (root / 'public/coil-original/coil.js').read_text()
def function(text, name):
    begin = text.index('\tfunction ' + name + '(')
    end = text.index('\n\t}', begin) + len('\n\t}')
    return text[begin:end]
unchanged = ['createSprites', 'createEffects', 'emitParticles', 'emitEffect', 'notify', 'invalidate', 'adjustScore', 'clear', 'debug', 'findIntersections', 'solveIntersections', 'updatePlayer', 'updateEnemies', 'updateParticles', 'renderPlayer', 'renderEnemies', 'renderParticles', 'renderNotifications', 'handleBombDeath', 'findLineIntersection']
for name in unchanged:
    assert function(runtime, name) == function(original, name), name
for name, inserted in {
    'handleEnemyDeath': "\n        expired++;\n        lastEvent = 'blue-expired';",
    'handleEnemyInClosure': "\n        captures++;\n        lastEvent = 'blue-captured';",
    'handleBombInClosure': "\n        bombsCaught++;\n        lastEvent = 'bomb-captured';"
}.items():
    assert function(runtime, name).replace(inserted, '') == function(original, name), name
assert runtime[runtime.index('function Entity('):] == original[original.index('function Entity('):]
geometry = (root / 'public/coil-original/geometry.js').read_text()
assert geometry.strip() in (vendor / 'upstream/js/util.js').read_text()
assert (root / 'public/coil-original/LICENSE.txt').read_bytes() == (vendor / 'upstream/LICENSE').read_bytes()
for forbidden in ['images/background.jpg', 'images/texture.png', 'favicon.ico', 'jquery-1.6.2.min.js']:
    assert not any(p.name == Path(forbidden).name for p in (root / 'public').rglob('*')), forbidden
runtime_paths = [p for p in (root / 'public/coil-original').rglob('*') if p.is_file()]
for path in runtime_paths:
    content = path.read_text()
    assert not re.search(r'(?:src|href)\s*=\s*[\'\"](?:https?:)?//', content), path
    assert not re.search(r'url\(\s*[\'\"]?(?:https?:)?//', content), path
    assert not re.search(r'\b(?:fetch|XMLHttpRequest|WebSocket|importScripts)\s*\(', content), path
assert 'requestAnimFrame(' not in runtime
assert 'WebGLUtil.' not in runtime
assert '$(' not in runtime
report = {
    'upstream': manifest['repository'], 'commit': manifest['commit'],
    'exactTextFiles': count, 'exactTextBytes': size,
    'unchangedCoreFunctions': unchanged,
    'instrumentedUnchangedHandlers': ['handleEnemyDeath', 'handleEnemyInClosure', 'handleBombInClosure'],
    'entityAndMultiplierDefinitions': 'exact upstream match',
    'geometry': 'exact Point/Region excerpt',
    'excludedUpstreamBinaryAssets': ['images/background.jpg', 'images/texture.png', 'favicon.ico'],
    'remoteRuntimeDependencies': 0,
    'browserExecuted': False,
    'meaning': 'Static source/fidelity verification only; no browser or gameplay pass is claimed.'
}
print(json.dumps(report, ensure_ascii=False, indent=2))
