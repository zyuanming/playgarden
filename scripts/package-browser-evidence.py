"""Lossless, deterministic browser-evidence parts for bounded artifact downloads.

Original CI artifacts remain unchanged. Each added ZIP is <=23 MiB, leaving
room for the upload service's outer ZIP below the 32 MiB download limit.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import tempfile
import unicodedata
import zipfile

MAX_BYTES = 23 * 1024 * 1024
MANIFEST = '_evidence/part-manifest.json'


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode('utf-8')


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for data in iter(lambda: f.read(1024 * 1024), b''):
            h.update(data)
    return h.hexdigest()


def inventory(root):
    records, canonical_paths = [], {}
    if not root.exists():
        return records
    if not root.is_dir():
        raise ValueError('Evidence input must be a directory')
    def fail_walk(error):
        raise error
    for directory, dirs, files in os.walk(root, followlinks=False, onerror=fail_walk):
        for name in dirs:
            if (Path(directory) / name).is_symlink():
                raise ValueError('Symlink evidence directories are not accepted')
        for name in files:
            p = Path(directory) / name
            if p.is_symlink():
                raise ValueError('Symlink evidence files are not accepted')
            if p.suffix != '.png' and p.name != 'error-context.md':
                continue
            if not stat.S_ISREG(p.stat().st_mode):
                raise ValueError('Evidence must be a regular file')
            relative = p.relative_to(root).as_posix()
            components = relative.split('/')
            if '\\' in relative or ':' in relative or relative.startswith('/') or any(
                    part in ('', '.', '..') or part != part.rstrip(' .') for part in components):
                raise ValueError('Unsafe or nonportable evidence path')
            for length in range(1, len(components) + 1):
                original = '/'.join(components[:length])
                key = unicodedata.normalize('NFC', original).casefold()
                kind = 'file' if length == len(components) else 'directory'
                prior = canonical_paths.get(key)
                if prior is not None and prior != (original, kind):
                    raise ValueError('Ambiguous or colliding evidence path')
                canonical_paths[key] = (original, kind)
            records.append({'path': relative, 'bytes': p.stat().st_size, 'sha256': digest(p)})
    return sorted(records, key=lambda item: item['path'])


def part_manifest(records, number, commit):
    return encoded({'schema': 1, 'commit': commit, 'part': number, 'files': records})


def zip_size(records, number, commit):
    # ZIP_STORED, seekable output, no ZIP64/comments/extras: local + central
    # headers use 76 bytes plus the UTF-8 filename twice. EOCD is 22 bytes.
    payload = part_manifest(records, number, commit)
    return 22 + len(payload) + 76 + 2 * len(MANIFEST.encode()) + sum(
        item['bytes'] + 76 + 2 * len(item['path'].encode('utf-8')) for item in records)


def info(name):
    entry = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
    entry.compress_type = zipfile.ZIP_STORED
    entry.create_system = 3
    entry.external_attr = 0o100644 << 16
    return entry


def pack_evidence(source, destination, max_bytes=MAX_BYTES, max_parts=8, commit='local'):
    source, destination = Path(source), Path(destination)
    if source.is_symlink() or destination.is_symlink():
        raise ValueError('Symlink roots are not accepted')
    root, out = source.resolve(), destination.resolve()
    if root == out or root in out.parents or out in root.parents:
        raise ValueError('Input and output may not overlap')
    if isinstance(max_bytes, bool) or not isinstance(max_bytes, int) or not 512 <= max_bytes <= MAX_BYTES:
        raise ValueError('Part byte budget must be 512..23 MiB')
    if isinstance(max_parts, bool) or not isinstance(max_parts, int) or not 1 <= max_parts <= 99:
        raise ValueError('Part count must be 1..99')
    if out.exists() and (not out.is_dir() or any(out.iterdir())):
        raise ValueError('Output must be absent or an empty directory')
    records = inventory(root)
    groups, current = [], []
    for item in records:
        trial = current + [item]
        if zip_size(trial, len(groups) + 1, commit) > max_bytes:
            if not current:
                raise ValueError('A single original file cannot fit the requested part budget')
            groups.append(current)
            current = [item]
            if zip_size(current, len(groups) + 1, commit) > max_bytes:
                raise ValueError('A single original file cannot fit the requested part budget')
        else:
            current = trial
    if current:
        groups.append(current)
    if len(groups) > max_parts:
        raise ValueError(f'Evidence needs {len(groups)} parts, exceeding {max_parts}; nothing was omitted')
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=out.name + '.staging-', dir=out.parent) as temporary:
        stage = Path(temporary)
        parts, index_files = [], []
        for number, group in enumerate(groups, 1):
            name = f'part-{number:02}.zip'
            path = stage / name
            with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_STORED, allowZip64=False) as archive:
                for item in group:
                    data = (root / item['path']).read_bytes()
                    if len(data) != item['bytes'] or hashlib.sha256(data).hexdigest() != item['sha256']:
                        raise ValueError('Evidence changed during packaging')
                    archive.writestr(info(item['path']), data)
                    index_files.append({**item, 'part': name})
                archive.writestr(info(MANIFEST), part_manifest(group, number, commit))
            if path.stat().st_size != zip_size(group, number, commit) or path.stat().st_size > max_bytes:
                raise ValueError('ZIP size accounting mismatch; no oversized artifact emitted')
            with zipfile.ZipFile(path) as archive:
                if archive.testzip() is not None:
                    raise ValueError('ZIP CRC check failed')
            parts.append({'path': name, 'bytes': path.stat().st_size, 'sha256': digest(path), 'fileCount': len(group)})
        index = {'schema': 1, 'commit': commit, 'originalCount': len(records),
                 'originalBytes': sum(item['bytes'] for item in records), 'maxPartBytes': max_bytes,
                 'parts': parts, 'files': index_files}
        data = encoded(index)
        if len(data) + 128 > MAX_BYTES:
            raise ValueError('Aggregate manifest exceeds the bounded download budget')
        (stage / 'index.json').write_bytes(data)
        (stage / 'index.sha256').write_text(hashlib.sha256(data).hexdigest() + '  index.json\n')
        os.replace(stage, out)
    return index


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source')
    parser.add_argument('destination')
    parser.add_argument('--max-bytes', type=int, default=MAX_BYTES)
    parser.add_argument('--max-parts', type=int, default=8)
    args = parser.parse_args()
    result = pack_evidence(args.source, args.destination, args.max_bytes, args.max_parts, os.environ.get('GITHUB_SHA', 'local'))
    print(json.dumps({'files': result['originalCount'], 'originalBytes': result['originalBytes'], 'parts': result['parts']}, indent=2))


if __name__ == '__main__':
    main()
