#!/usr/bin/env python3
"""Check frozen upstream bytes and source/license completeness; no gameplay execution."""
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "vendor/cube-composer-original"
manifest = json.loads((SOURCE / "source-manifest.json").read_text())
assert len(manifest["files"]) == 46
total = 0
for item in manifest["files"]:
    data = (SOURCE / item["dest"]).read_bytes()
    assert item["commit"] == "a891ffe5de79b072819da04718820d0452b9a201"
    assert len(data) == item["expected_bytes"], item["path"]
    assert hashlib.sha256(data).hexdigest() == item["sha256"], item["path"]
    blob = b"blob " + str(len(data)).encode() + b"\0" + data
    assert hashlib.sha1(blob).hexdigest() == item["git_blob_sha1"], item["path"]
    total += len(data)
assert (ROOT / "public/cube-composer-LICENSE.txt").read_bytes() == (SOURCE / "upstream/LICENSE").read_bytes()
data = json.loads((ROOT / "src/games/cubeComposerLevelsData.json").read_text())
ids = {item["id"] for chapter in data["chapters"] for item in chapter["transformers"]}
core = (ROOT / "src/vendor/cubeComposerCore.ts").read_text()
labels = (ROOT / "src/games/cubeComposerLevels.ts").read_text()
for transformer in ids:
    assert re.search(r"^  " + re.escape(transformer) + r"[:,]", core, re.M), transformer
    assert re.search(r"^  " + re.escape(transformer) + r":", labels, re.M), transformer
for path in [*ROOT.glob("src/games/*cubeComposer*"), ROOT / "src/games/CubeComposerGame.tsx", ROOT / "src/vendor/cubeComposerCore.ts"]:
    if path.suffix == ".json":
        continue  # Original help text contains an inert upstream repository URL.
    code = path.read_text()
    assert not re.search(r"fetch\s*\(|XMLHttpRequest|https?://|@import|iframe|dangerouslySetInnerHTML", code), str(path)
ET.parse(ROOT / "public/cube-composer-art.svg")
print(f"PASS: {len(manifest['files'])} source files, {total} bytes, Git blobs/SHA256/lengths; full MIT notice; all {len(ids)} function IDs implemented and labeled; SVG XML; no runtime network/HTML injection.")
