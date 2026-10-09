#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Static provenance/data/asset checks only. Does not execute or solve a game."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
vendor = ROOT / "vendor/parity-original"
manifest = json.loads((vendor / "source-manifest.json").read_text())
tree = json.loads((vendor / "upstream-tree.json").read_text())
blobs = {entry["path"]: entry["sha"] for entry in tree["tree"] if entry["type"] == "blob"}
assert tree["sha"] == "f96ab16590e74ece650284f009be2096c6eb8b64"
total = 0
for entry in manifest["preservedFiles"]:
    data = (vendor / "upstream" / entry["path"]).read_bytes()
    blob = hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
    assert blob == entry["git_blob_sha1"] == blobs[entry["path"]], entry["path"]
    assert hashlib.sha256(data).hexdigest() == entry["sha256"], entry["path"]
    assert len(data) == entry["bytes"]
    total += len(data)
assert len(manifest["preservedFiles"]) == 19
assert len(manifest["excludedFiles"]) == 6
assert (ROOT / "public/parity-LICENSE.txt").read_bytes() == (vendor / "upstream/LICENSE.txt").read_bytes()
story = json.loads((vendor / "upstream/story.json").read_text())
levels = [item for item in story if item["type"] == "level"]
runtime = json.loads((ROOT / "src/games/parityLevelsData.json").read_text())
assert runtime == levels, "Runtime changed original data"
assert len(levels) == 100 and [item["number"] for item in levels] == list(range(1, 101))
assert [item["mode"] for item in levels] == ["vanilla"] * 50 + ["b&w"] * 50
assert len([item for item in story if item["type"] == "instruction"]) == 8
for item in levels:
    assert len(item["contents"]) == 9 and all(type(n) is int for n in item["contents"])
    assert item["initialSelected"]["x"] in range(3) and item["initialSelected"]["y"] in range(3)
    if item["mode"] == "b&w":
        assert len(item["colors"]) == 9 and set(item["colors"]) <= {"w", "b"}
    if "solution" in item:
        assert set(item["solution"]) <= {"u", "d", "l", "r"}
assert sum("solution" in item for item in levels) == 80
runtime_paths = [ROOT / "src/vendor/parityCore.ts", *sorted((ROOT / "src/games").glob("parity*")), ROOT / "src/games/ParityGame.tsx", ROOT / "public/parity-art.svg"]
for path in runtime_paths:
    source = path.read_text()
    assert not re.search(r"facebook|google-analytics|googletagmanager|fonts\.google|touchSwipe|jQuery", source, re.I), path
    # The standard SVG namespace identifies XML; it is not a fetched resource.
    resource_source = source.replace('xmlns="http://www.w3.org/2000/svg"', '')
    assert not re.search(r"\bfetch\s*\(|XMLHttpRequest|sendBeacon|<script|@import|https?://", resource_source), path
    assert not re.search(r"\b(?:eval|new\s+Function)\s*\(", source), path
assert not list((ROOT / "public").glob("parity*.js"))
print(json.dumps({
    "upstreamCommit": manifest["commit"],
    "preservedExactFirstPartyFiles": len(manifest["preservedFiles"]),
    "preservedExactFirstPartyBytes": total,
    "excludedUnusedThirdPartyOrMixedBundles": len(manifest["excludedFiles"]),
    "originalLevels": len(levels), "ordinaryLevels": 50, "blackWhiteLevels": 50,
    "originalInstructionRecordsPreservedInSource": 8,
    "originalSolutionMetadataPreserved": 80,
    "runtimeLevelDataEqualsOriginalRecords": True,
    "publicMITMatchesUpstream": True,
    "runtimeNetworkOrThirdPartyScripts": 0,
    "gameplayOrSolversExecutedByThisCheck": False,
}, ensure_ascii=False, indent=2))
