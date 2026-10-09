#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Extract the original 100 records; never modify, generate or solve a level."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
story = json.loads((ROOT / "vendor/parity-original/upstream/story.json").read_text())
levels = [item for item in story if item["type"] == "level"]
assert len(levels) == 100
assert [item["number"] for item in levels] == list(range(1, 101))
assert [item["mode"] for item in levels] == ["vanilla"] * 50 + ["b&w"] * 50
output = json.dumps(levels, ensure_ascii=False, indent=2) + "\n"
target = ROOT / "src/games/parityLevelsData.json"
if args.check:
    assert target.read_text() == output, "Original level extraction is stale."
else:
    target.write_text(output)
print("All 100 original level records preserved exactly as data (50 ordinary + 50 black/white).")
