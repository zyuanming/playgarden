#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Static source/license/hash checks only; no JavaScript, browser or solver runs."""
from pathlib import Path
import hashlib
from html.parser import HTMLParser
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / 'vendor/css-diner-original'
PUBLIC = ROOT / 'public/css-diner'
manifest = json.loads((VENDOR / 'publication-manifest.json').read_text())
assert manifest['upstreamCommit'] == '566aaa01314caddc7a9034d793250cf2b8f12a4e'
assert manifest['includeOnlyListedFiles'] is True and len(manifest['files']) == 10
expected_inputs = {item['path'] for item in manifest['files']}
assert {str(path.relative_to(VENDOR / 'cleared')) for path in (VENDOR / 'cleared').rglob('*') if path.is_file()} == expected_inputs
for item in manifest['files']:
    data = (VENDOR / 'cleared' / item['path']).read_bytes()
    assert len(data) == item['bytes'] and hashlib.sha256(data).hexdigest() == item['sha256'], item['path']
    assert hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest() == item['gitBlobSha1'], item['path']
for name in ['js/levels.js', 'js/jquery.js', 'css/style.css', 'LICENSE', 'README.md', 'licenses/jquery-MIT.txt', 'licenses/sizzle-MIT.txt']:
    assert (PUBLIC / name).read_bytes() == (VENDOR / 'cleared' / name).read_bytes(), name
levels = (PUBLIC / 'js/levels.js').read_text()
# Counting literal authored fields is source inspection, never evaluated JS.
assert len(re.findall(r'\bboardMarkup\s*:', levels)) == 32
assert len(re.findall(r'\bdoThis\s*:', levels)) == 32
assert len(re.findall(r'\bselector\s*:', levels)) == 32
translation = (PUBLIC / 'zh.js').read_text()
assert len(re.findall(r'^  \[', translation, re.M)) == 32
original = (VENDOR / 'cleared/js/restaurant.js').read_text()
runtime = (PUBLIC / 'js/restaurant.js').read_text()
def section(source, start, end):
    return source[source.index(start):source.index(end, source.index(start))]
assert section(runtime, 'function checkResults(', '// Returns all formatted markup') == section(original, 'function checkResults(', '// Returns all formatted markup')
# The action/progress branch differs, but the complete original matcher block is exact.
assert section(runtime, '  // prevent cheating', '  // Retain the original matching') == section(original, '  // prevent cheating', '  if(win){\n    ruleSelected.removeClass')
assert 'Sean Nessworthy <sean@nessworthy.me>' in runtime
assert 'setTimeout(' not in runtime and 'localStorage.' not in runtime
assert 'dinerBridge.schedule' in runtime and 'dinerBridge.navigate' in runtime
for excluded in ['PopupCenter', 'mCustomScrollbar', 'ga(', 'GoogleAnalyticsObject']:
    assert excluded not in runtime
host = (ROOT / 'src/games/CssDiner.tsx').read_text()
bridge = (PUBLIC / 'adapter.js').read_text()
assert 'playgarden.css-diner.v1.state' in host
assert 'sandbox="allow-scripts"' in host and 'allow-same-origin' not in host
assert "event.origin !== 'null'" in host and 'event.source !== target' in host and 'data.session !== session' in host
assert 'epoch.current === currentEpoch' in host and 'queueMicrotask' in host
assert 'event.origin !== parentOrigin' in bridge and 'event.source !== parent' in bridge
assert 'css-diner-566aaa0-playgarden-2' in host and 'css-diner-566aaa0-playgarden-2' in bridge
assert 'fromLevel: currentLevel' in bridge and 'data.fromLevel === latest.current.level' in host
assert 'task.remaining - (performance.now() - task.at)' in bridge
assert 'cancelWork();' in bridge and 'disposed = true' in bridge
assert not re.search(r'\b(?:eval|Function|fetch|XMLHttpRequest|WebSocket)\s*\(', bridge)
assert 'localStorage' not in bridge

class LocalPage(HTMLParser):
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        assert not any(key.lower().startswith('on') for key in attrs), attrs
        if tag in ['script', 'link', 'img', 'iframe']:
            name = attrs.get('src') or attrs.get('href')
            assert name and not re.match(r'^(?:[a-z]+:|//)', name), name
            assert '..' not in Path(name).parts and (PUBLIC / name).is_file(), name
page = (PUBLIC / 'index.html').read_text()
LocalPage().feed(page)
for directive in ["default-src 'none'", "connect-src 'none'", "form-action 'none'", "base-uri 'none'"]:
    assert directive in page
assert not re.search(r'url\s*\(', (PUBLIC / 'css/style.css').read_text() + (PUBLIC / 'adapter.css').read_text(), re.I)
notice = (PUBLIC / 'NOTICE.txt').read_text()
for text in ['MPL-2.0', 'jQuery', 'Sizzle', 'GPL-3.0-only', '@flukeout', manifest['upstreamCommit'], 'Sean Nessworthy']:
    assert text in notice, text
for name in ['LICENSE', 'licenses/jquery-MIT.txt', 'licenses/sizzle-MIT.txt', 'licenses/Playgarden-GPL-3.0.txt', 'README.md']:
    assert (PUBLIC / name).read_text() in notice, name
source_map = json.loads((ROOT / 'docs/css-diner-source-map.json').read_text())
for item in source_map['files']:
    assert hashlib.sha256((ROOT / item['path']).read_bytes()).hexdigest() == item['sha256'], item['path']
distribution = json.loads((VENDOR / 'distribution-manifest.json').read_text())
for item in distribution['files']:
    data = (ROOT / item['path']).read_bytes()
    assert len(data) == item['bytes'] and hashlib.sha256(data).hexdigest() == item['sha256'], item['path']
with zipfile.ZipFile(ROOT / distribution['archive']) as archive:
    expected = {item['path'] for item in distribution['files'] if item['path'] != distribution['archive']}
    assert set(archive.namelist()) == expected
    for name in archive.namelist():
        assert not any(part in name for part in ['private-audit', '.git/', '__pycache__', 'node_modules', 'NOTES.md'])
        assert archive.getinfo(name).date_time == (2026, 10, 10, 0, 0, 0)
        assert archive.read(name) == (ROOT / name).read_bytes(), name
print('CSS Diner static verification passed: 10 allowlisted frozen files; 32 original authored boards; original matcher; MPL/MIT/GPL notices; isolated lifecycle source; deterministic source identities.')
