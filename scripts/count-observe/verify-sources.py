# SPDX-License-Identifier: GPL-3.0-only
"""Verify vendored source bytes and full notice without executing game code."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[2]
vendor = root / "vendor/crisp-original"
manifest = json.loads((vendor / "count-observe-source-manifest.json").read_text())
for row in manifest["files"]:
    data = (vendor / row["dest"]).read_bytes()
    assert len(data) == row["expected_bytes"], row["path"]
    assert hashlib.sha256(data).hexdigest() == row["sha256"], row["path"]
    assert hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest() == row["git_blob_sha1"], row["path"]
runtime = (root / "public/crisp-original/count-observe/main.js").read_bytes()
assert runtime == (vendor / "upstream/games/docs/count/main.js").read_bytes()
assert runtime.count(b"\r\n") == runtime.count(b"\n") == 218
assert (vendor / "count-observe-LICENSE.txt").read_text().strip() in (root / "public/crisp-original/LICENSES.txt").read_text()
print("COUNT: exact original bytes, CRLF and full MIT notice verified; zero finite levels.")
