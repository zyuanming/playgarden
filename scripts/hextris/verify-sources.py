#!/usr/bin/env python3
"""Static source/provenance/privacy validation; never runs the game or a browser."""
from pathlib import Path
import hashlib, json, re, subprocess, sys
ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / 'vendor/hextris-original'
records = json.loads((VENDOR / 'retrieval-verification.json').read_text())
verified = []
for entry in records:
    path = VENDOR / 'upstream' / entry['path']
    data = path.read_bytes()
    blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    assert len(data) == entry['bytes'], path
    assert hashlib.sha256(data).hexdigest() == entry['sha256'], path
    assert blob == entry['expected_git_blob_sha1'], path
    verified.append(entry['path'])
assert len(verified) == 24
assert (ROOT / 'public/hextris-original/LICENSE.txt').read_bytes() == (VENDOR / 'upstream/LICENSE.md').read_bytes()
assert 'either version 3 of the License, or' in (VENDOR / 'upstream/README.md').read_text()
public = ROOT / 'public/hextris-original'
runtime = (public / 'hextris.js').read_text()
for forbidden in [r'\beval\s*\(', r'\bnew\s+Function\b', r'\bFunction\s*\(', r'\bJSONfn\b',
                  r'\bfetch\s*\(', r'\bXMLHttpRequest\b', r'\bWebSocket\b', r'\bEventSource\b',
                  r'\bsendBeacon\b', r'\bimportScripts\b', r'\bimport\s*\(',
                  r'createElement\s*\(\s*[\'"]script', r'\bwindow\.history\s*=',
                  r'\binnerHTML\s*=', r'\bdocument\.write\s*\(', r'https?://', r'54\.183\.184\.126',
                  r'google-analytics', r'googlesyndication', r'hextris\.io']:
    assert not re.search(forbidden, runtime), forbidden
html = (public / 'index.html').read_text()
assert "connect-src 'none'" in html and "font-src 'none'" in html
for resource in re.findall(r'(?:src|href)=[\'"]([^\'"]+)', html):
    assert resource in ['./style.css', './hextris.js'], resource
    assert (public / resource.removeprefix('./')).is_file()
assert not re.search(r'\son\w+\s*=', html), 'inline event handler'
assert not re.search(r'@import|url\s*\(', (public / 'style.css').read_text()), 'CSS external resource'
assert 'localStorage.setItem("saveState"' not in runtime
assert "localStorage.setItem('highscores'" not in runtime
for name in ['randomGeneration','doubleGeneration','crosswiseGeneration','spiralGeneration','circleGeneration','halfCircleGeneration']:
    assert 'this.' + name + ' = function()' in runtime
for original in ['math.js', 'wavegen.js', 'update.js', 'Text.js', 'comboTimer.js']:
    assert (VENDOR / 'upstream/js' / original).read_text() in runtime, original
assert 'onComplete(' not in (ROOT / 'src/games/HextrisOriginal.tsx').read_text()
subprocess.run([sys.executable, str(ROOT / 'scripts/hextris/prepare-adaptation.py'), '--check'], check=True)
subprocess.run(['node', '--check', str(public / 'hextris.js')], check=True)
print(json.dumps({'status':'passed','scope':'static only; no browser/gameplay execution','verifiedUpstreamFiles':len(verified),'verifiedFirstPartyJS':14,'runtimeExternalRequests':0,'runtimeDynamicCodeSinks':0,'originalWaves':6,'finiteLevels':0,'license':'GPL-3.0-or-later'}, ensure_ascii=False))
