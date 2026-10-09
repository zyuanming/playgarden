#!/usr/bin/env python3
"""Static source/data provenance check. Never executes PureScript or solves levels."""
import argparse
import ast
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "vendor/cube-composer-original"

def wall(expression):
    if expression.startswith("map toAStack "):
        return [["Brown" if n & bit else "Orange" for bit in (1, 2, 4)]
                for n in ast.literal_eval(expression.removeprefix("map toAStack "))]
    return ast.literal_eval(re.sub(r"\b(Cyan|Brown|Red|Orange|Yellow)\b", r'"\1"', expression))

def extract():
    chapters = []
    for chapter in range(6):
        source = (SOURCE / f"upstream/src/Levels/Chapter{chapter}.purs").read_text()
        transformer_source = source.split("transformers: fromArray [", 1)[1].split("levels: fromArray [", 1)[0]
        transformers = [{"id": m[0], "name": m[1]} for m in re.findall(r'"([^"]+)"\s*:>\s*\{\s*name:\s*"([^"]+)"', transformer_source)]
        levels = []
        for level_id, block in re.findall(r'"(\d+\.\d+)"\s*:->\s*\{(.*?)\n        \}', source, re.S):
            name = re.search(r'name:\s*"([^"]+)"', block)[1]
            difficulty = re.search(r'difficulty:\s*(\w+)', block)[1]
            help_source = re.search(r'help:\s*(.*?),\s*\n\s*difficulty:', block, re.S)[1]
            if help_source == "Nothing":
                help_text = None
            elif help_source.startswith('Just """'):
                help_text = help_source[len('Just """'):-3]
            else:
                help_text = json.loads(help_source.removeprefix("Just "))
            initial = re.search(r'initial:\s*([^\n]+),\s*\n', block)[1].strip()
            target = re.search(r'target:\s*([^\n]+)', block)[1].strip()
            levels.append({"id": level_id, "name": name, "difficulty": difficulty, "help": help_text,
                           "initial": wall(initial), "initial_source_expression": initial,
                           "target": wall(target), "target_source_expression": target})
        chapters.append({"chapter": chapter, "transformers": transformers, "level_count": len(levels), "levels": levels})
    return chapters

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check exact original data; this script never writes it")
    parser.parse_args()
    chapters = extract()
    original = json.loads((SOURCE / "level-inventory.json").read_text())
    runtime = json.loads((ROOT / "src/games/cubeComposerLevelsData.json").read_text())
    assert chapters == original["chapters"], "Static extraction differs from original inventory"
    assert runtime == original, "Runtime data differs from original inventory"
    assert [chapter["level_count"] for chapter in chapters] == [4, 4, 5, 3, 5, 4]
    assert sum(chapter["level_count"] for chapter in chapters) == runtime["finite_levels"] == 25
    assert len({level["id"] for chapter in chapters for level in chapter["levels"]}) == 25
    print("PASS: 25 exact original levels; 6 chapters; all names/help/difficulties/walls/function sets/source expressions match.")
