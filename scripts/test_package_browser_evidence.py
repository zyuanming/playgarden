import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location('packer', Path(__file__).with_name('package-browser-evidence.py'))
packer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packer)


class EvidencePacking(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'input'
        self.source.mkdir()

    def write(self, name, data):
        path = self.source / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def verify(self, output, expected):
        index = json.loads((output / 'index.json').read_text())
        self.assertEqual((output / 'index.sha256').read_text().split()[0], hashlib.sha256((output / 'index.json').read_bytes()).hexdigest())
        found = {}
        for part in index['parts']:
            path = output / part['path']
            self.assertEqual(path.stat().st_size, part['bytes'])
            self.assertLessEqual(part['bytes'], index['maxPartBytes'])
            self.assertEqual(packer.digest(path), part['sha256'])
            with zipfile.ZipFile(path) as z:
                manifest = json.loads(z.read(packer.MANIFEST))
                self.assertEqual(manifest['commit'], 'a' * 40)
                for item in manifest['files']:
                    data = z.read(item['path'])
                    self.assertNotIn(item['path'], found)
                    self.assertEqual(len(data), item['bytes'])
                    self.assertEqual(hashlib.sha256(data).hexdigest(), item['sha256'])
                    found[item['path']] = data
        self.assertEqual(found, expected)
        self.assertEqual(index['originalCount'], len(expected))
        self.assertEqual(index['originalBytes'], sum(map(len, expected.values())))
        self.assertEqual(sorted(item['path'] for item in index['files']), sorted(expected))
        return index

    def test_complete_lossless_deterministic_parts(self):
        expected = {f'desktop/example-{i}/gomoku-{i}.png': bytes([i]) * 450 for i in range(7)}
        expected['mobile/棋盘/error-context.md'] = '保留原样'.encode()
        for name, data in expected.items(): self.write(name, data)
        self.write('trace.zip', b'unchanged elsewhere')
        self.write('video.webm', b'unchanged elsewhere')
        a, b = self.root / 'a', self.root / 'b'
        packer.pack_evidence(self.source, a, 1700, 8, 'a' * 40)
        packer.pack_evidence(self.source, b, 1700, 8, 'a' * 40)
        index = self.verify(a, expected)
        self.assertGreater(len(index['parts']), 1)
        self.assertEqual({p.name:p.read_bytes() for p in a.iterdir()}, {p.name:p.read_bytes() for p in b.iterdir()})

    def test_exact_boundary(self):
        self.write('x.png', b'x' * 100)
        item = packer.inventory(self.source)
        limit = packer.zip_size(item, 1, 'a' * 40)
        self.assertGreaterEqual(limit, 512)
        packer.pack_evidence(self.source, self.root / 'exact', limit, 1, 'a' * 40)
        self.verify(self.root / 'exact', {'x.png': b'x' * 100})
        with self.assertRaises(ValueError): packer.pack_evidence(self.source, self.root / 'small', limit - 1, 1, 'a' * 40)
        self.assertFalse((self.root / 'small').exists())

    def test_too_many_parts_never_omits_or_publishes_partial(self):
        for i in range(3): self.write(f'{i}.png', b'a' * 700)
        with self.assertRaises(ValueError): packer.pack_evidence(self.source, self.root / 'out', 1500, 1)
        self.assertFalse((self.root / 'out').exists())
        self.assertEqual(list(self.root.glob('out.staging-*')), [])

    def test_single_oversize_rejected(self):
        self.write('x.png', b'x' * 2000)
        with self.assertRaises(ValueError): packer.pack_evidence(self.source, self.root / 'out', 1500)
        self.assertFalse((self.root / 'out').exists())

    def test_symlinks_and_case_collisions(self):
        self.write('x.png', b'a')
        (self.source / 'link.png').symlink_to(self.source / 'x.png')
        with self.assertRaises(ValueError): packer.pack_evidence(self.source, self.root / 'out')
        (self.source / 'link.png').unlink()
        self.write('X.png', b'b')
        with self.assertRaises(ValueError): packer.pack_evidence(self.source, self.root / 'out')

    def test_empty_missing_and_overlap(self):
        for name, source in [('empty', self.source), ('missing', self.root / 'missing-input')]:
            result = packer.pack_evidence(source, self.root / name, commit='a' * 40)
            self.assertEqual(result['parts'], [])
            self.verify(self.root / name, {})
        with self.assertRaises(ValueError): packer.pack_evidence(self.source, self.source / 'inside')
        with self.assertRaises(ValueError): packer.pack_evidence(self.source, self.root)

    def test_existing_output_and_invalid_limits_are_untouched(self):
        out = self.root / 'kept';out.mkdir();(out / 'keep.txt').write_text('safe')
        with self.assertRaises(ValueError): packer.pack_evidence(self.source, out)
        self.assertEqual((out / 'keep.txt').read_text(), 'safe')
        for size, parts in [(0,8), (True,8), (packer.MAX_BYTES+1,8), (1000,0), (1000,True)]:
            with self.assertRaises(ValueError): packer.pack_evidence(self.source, self.root / 'bad', size, parts)

    def test_walk_permission_errors_cannot_silently_drop_files(self):
        self.write('locked/lost.png', b'keep')
        original = packer.os.scandir
        def denied(path):
            if Path(path) == self.source / 'locked': raise PermissionError('unreadable evidence directory')
            return original(path)
        with patch.object(packer.os, 'scandir', side_effect=denied):
            with self.assertRaises(PermissionError): packer.pack_evidence(self.source, self.root / 'out')
        self.assertFalse((self.root / 'out').exists())

    def test_nonportable_paths_and_file_directory_collisions(self):
        cases = [ ['a/b.png', 'a\\b.png'], ['foo.png', 'FOO.PNG/inside.png'], ['..\\escape.png'], ['a:b.png'], ['Foo/a.png', 'foo/b.png'] ]
        for number, names in enumerate(cases):
            source = self.root / f'input-{number}'
            for name in names:
                p = source / name;p.parent.mkdir(parents=True, exist_ok=True);p.write_bytes(b'original')
            with self.assertRaises(ValueError, msg=names): packer.pack_evidence(source, self.root / f'out-{number}')
            self.assertFalse((self.root / f'out-{number}').exists())


if __name__ == '__main__': unittest.main()
