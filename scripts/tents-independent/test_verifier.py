import copy
import json
import hashlib
from pathlib import Path
import random
import tempfile
import unittest
from itertools import combinations

from verify import (PUBLIC_FIELDS, adjacent, canonical_keys, has_bijection, read_levels,
                    solve_public, touches, normalized_tent_key, transform_index, transform_public,
                    validate_placement, validate_public, verify_corpus)

ROOT=Path(__file__).resolve().parents[2]


def puzzle(n,trees,tents):
    return {'size':n,'trees':trees,'rowCounts':[sum(p//n==r for p in tents) for r in range(n)],
            'columnCounts':[sum(p%n==c for p in tents) for c in range(n)]}


UNIQUE=puzzle(4,[1,2,4],[0,3,8])
TWO=puzzle(4,[1,9],[0,10])
MATCHING_CYCLE=puzzle(4,[1,4,6,9],[0,2,8,10])


def brute_cell_sets(level):
    """Tiny test-only oracle, neither row enumeration nor tree assignment."""
    n=level['size'];trees=level['trees'];answers=[]
    candidates=[p for p in range(n*n) if p not in trees and any(adjacent(n,t,p) for t in trees)]
    for tents in combinations(candidates,len(trees)):
        if not validate_placement(level,tents):
            answers.append(list(tents))
    return answers


class OracleTests(unittest.TestCase):
    def test_zero_unique_and_two_solutions(self):
        impossible=puzzle(4,[0],[0])
        self.assertEqual(solve_public(impossible)['status'],'no_solution')
        result=solve_public(UNIQUE)
        self.assertEqual(result['status'],'unique')
        self.assertEqual(result['solutions'],[[0,3,8]])
        result=solve_public(TWO)
        self.assertEqual(result['status'],'multiple')
        self.assertEqual(result['solutions'],[[0,10],[2,8]])
        self.assertEqual(solve_public(TWO,limit=10000)['status'],'multiple')

    def test_matching_multiplicity_is_not_puzzle_multiplicity(self):
        result=solve_public(MATCHING_CYCLE)
        self.assertEqual(result['status'],'unique')
        self.assertEqual(result['solutions'],[[0,2,8,10]])
        self.assertEqual(result['assignments'],2)

    def test_extra_tree_adjacency_is_valid(self):
        self.assertTrue(has_bijection(MATCHING_CYCLE,[0,2,8,10]))
        self.assertEqual(validate_placement(MATCHING_CYCLE,[0,2,8,10]),[])

    def test_hall_trap_with_every_vertex_adjacent(self):
        q=puzzle(5,[1,5,9],[0,4,14]);tents=[0,4,14]
        self.assertTrue(all(any(adjacent(5,t,p) for p in tents) for t in q['trees']))
        self.assertTrue(all(any(adjacent(5,t,p) for t in q['trees']) for p in tents))
        self.assertFalse(has_bijection(q,tents))
        self.assertIn('no tree/tent bijection exists',validate_placement(q,tents))
        self.assertEqual(solve_public(q,force_tents=tents)['status'],'no_solution')

    def test_diagonal_and_orthogonal_contact_rejected(self):
        self.assertTrue(touches(4,0,5))
        self.assertTrue(touches(4,0,1))
        self.assertFalse(touches(4,3,4))
        self.assertFalse(touches(4,0,2))

    def test_budget_timeout_limit_never_claim_uniqueness(self):
        self.assertEqual(solve_public(UNIQUE,budget=200001)['status'],'invalid')
        self.assertEqual(solve_public(UNIQUE,budget=0)['status'],'budget')
        self.assertEqual(solve_public(UNIQUE,budget=1)['status'],'budget')
        self.assertEqual(solve_public(UNIQUE,timeout=0)['status'],'timeout')
        self.assertEqual(solve_public(UNIQUE,limit=1)['status'],'limit')
        # Interrupt after the first placement of an actually ambiguous puzzle.
        found=False
        for budget in range(1,20):
            result=solve_public(TWO,budget=budget)
            if result['status']=='budget' and len(result['solutions'])==1:
                found=True
                self.assertNotEqual(result['status'],'unique')
        self.assertTrue(found)

    def test_certificate_and_authoring_metadata_cannot_change_search(self):
        damaged={**UNIQUE,'solution':[15],'authoringNodes':0,'authoringCandidates':0}
        a=solve_public(UNIQUE);b=solve_public(damaged)
        for key in ('status','nodes','solutions','assignments'):
            self.assertEqual(a[key],b[key])

    def test_invalid_data_and_conditioning(self):
        for field,value in [('size',True),('size',8),('trees',[1,1]),('trees',[-1]),
                            ('rowCounts',[3,0,0,0]),('columnCounts',[True,0,1,1])]:
            q={**UNIQUE,field:value}
            self.assertTrue(validate_public(q))
            self.assertEqual(solve_public(q)['status'],'invalid')
        self.assertEqual(solve_public(UNIQUE,force_tents=[0])['status'],'unique')
        self.assertEqual(solve_public(UNIQUE,force_grass=[0])['status'],'no_solution')
        self.assertEqual(solve_public(UNIQUE,force_tents=[0],force_grass=[0])['status'],'no_solution')
        self.assertEqual(solve_public(UNIQUE,force_tents=[1])['status'],'no_solution')

    def test_all_d4_transforms_preserve_clues_and_solutions(self):
        key=canonical_keys(UNIQUE,[0,3,8])
        for symmetry in range(8):
            transformed=transform_public(UNIQUE,symmetry)
            tents=sorted(transform_index(4,p,symmetry) for p in [0,3,8])
            self.assertEqual(validate_placement(transformed,tents),[])
            self.assertEqual(canonical_keys(transformed,tents),key)
            self.assertEqual(solve_public(transformed)['solutions'],[tents])
        # Rotation really swaps/reverses clue axes, independent of answer contents.
        rotated=transform_public(UNIQUE,1)
        self.assertEqual(rotated['rowCounts'],UNIQUE['columnCounts'])
        self.assertEqual(rotated['columnCounts'],list(reversed(UNIQUE['rowCounts'])))

    def test_translation_normalization_ignores_board_size_but_preserves_geometry(self):
        base=normalized_tent_key(4,[0,3,8])
        self.assertEqual(normalized_tent_key(6,[7,10,19]),base)
        self.assertEqual(normalized_tent_key(4,[2,12,14]),base)
        for symmetry in range(8):
            transformed=[transform_index(6,p,symmetry) for p in [7,10,19]]
            self.assertEqual(normalized_tent_key(6,transformed),base)
        self.assertNotEqual(normalized_tent_key(4,[0,2,8]),base)

    def test_public_key_excludes_certificate_and_includes_counts(self):
        key=canonical_keys(UNIQUE,[0,3,8])[0]
        self.assertEqual(canonical_keys({**UNIQUE,'solution':[15]},[0,3,8])[0],key)
        q={**UNIQUE,'rowCounts':[1,1,1,0]}
        self.assertNotEqual(canonical_keys(q,[0,3,8])[0],key)

    def test_seeded_small_boards_against_direct_cell_subset_enumeration(self):
        rng=random.Random(527)
        for _ in range(45):
            trees=sorted(rng.sample(range(16),rng.choice([2,3,4])))
            tents=sorted(rng.sample([p for p in range(16) if p not in trees],len(trees)))
            q=puzzle(4,trees,tents)
            if validate_public(q):
                continue
            expected=brute_cell_sets(q)
            result=solve_public(q,limit=10000)
            self.assertEqual(result['solutions'],expected,q)
            self.assertEqual(result['status'],'unique' if len(expected)==1 else 'no_solution' if not expected else 'multiple',q)


class CorpusTests(unittest.TestCase):
    def test_legacy_fixture_is_valid_and_exhaustively_unique(self):
        legacy=read_levels(ROOT/'tests/fixtures/tentsLegacy.json')
        digest=hashlib.sha256(json.dumps(legacy,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
        self.assertEqual(digest,'ad30bf03ad024de926b6cca87ea5053b2180fffc424d4c9675f22a2dd04e631a')
        result=verify_corpus(legacy,legacy,12)
        self.assertTrue(result['ok'],result['failures'])

    def test_changed_legacy_and_broken_certificates_are_detected(self):
        legacy=read_levels(ROOT/'tests/fixtures/tentsLegacy.json')
        changed=copy.deepcopy(legacy)
        changed[0]['title']='changed'
        changed[1]['solution']=[0]
        result=verify_corpus(changed,legacy)
        self.assertFalse(result['ok'])
        self.assertIn('Legacy level 1 changed',result['failures'])
        self.assertTrue(any('certificate differs' in f for f in result['failures']))

    def test_d4_duplicates_are_detected_separately(self):
        legacy=read_levels(ROOT/'tests/fixtures/tentsLegacy.json')
        duplicate=transform_public(legacy[0],1)
        duplicate['solution']=sorted(transform_index(4,p,1) for p in legacy[0]['solution'])
        result=verify_corpus(legacy+[duplicate],legacy)
        self.assertEqual(result['publicD4Duplicates'],[[1,13]])
        self.assertEqual(result['tentLayoutD4Duplicates'],[[1,13]])

    def test_same_layout_with_different_public_trees_is_still_rejected(self):
        legacy=read_levels(ROOT/'tests/fixtures/tentsLegacy.json')
        changed_tree_puzzle={**legacy[0],'trees':[1,2,12]}
        result=verify_corpus(legacy+[changed_tree_puzzle],legacy)
        self.assertEqual(result['publicD4Duplicates'],[])
        self.assertEqual(result['tentLayoutD4Duplicates'],[[1,13]])

    def test_only_preserved_legacy_normalized_shape_repetitions_are_exempt(self):
        legacy=read_levels(ROOT/'tests/fixtures/tentsLegacy.json')
        result=verify_corpus(legacy,legacy)
        self.assertEqual(result['legacyTranslationD4Duplicates'],[[1,2]])
        self.assertEqual(result['newTranslationD4Duplicates'],[])
        moved={**legacy[0],**puzzle(6,[8,9,13],[7,10,19]),'solution':[7,10,19]}
        result=verify_corpus(legacy+[moved],legacy)
        self.assertEqual(result['publicD4Duplicates'],[])
        self.assertEqual(result['tentLayoutD4Duplicates'],[])
        self.assertEqual(result['newTranslationD4Duplicates'],[[1,13]])
        self.assertTrue(any('Translation-normalized' in error for error in result['failures']))

    def test_json_and_literal_loader_is_inert(self):
        with tempfile.TemporaryDirectory() as root:
            root=Path(root)
            path=root/'data.json';path.write_text(json.dumps({'levels':[UNIQUE]}))
            self.assertEqual(read_levels(path),[UNIQUE])
            path=root/'tentsLevels.ts';path.write_text('export const tentsLevels = '+json.dumps([UNIQUE])+';\n')
            self.assertEqual(read_levels(path),[UNIQUE])
            path.write_text('export const tentsLevels = '+json.dumps([UNIQUE])+';\nexport const tentsChapters = [0, 1];')
            self.assertEqual(read_levels(path),[UNIQUE])
            path.write_text('export const tentsLevels = (() => [])();')
            with self.assertRaises(ValueError):
                read_levels(path)

    def test_expansion_adapter_accepts_exact_node_json_import_attribute(self):
        with tempfile.TemporaryDirectory() as root:
            root=Path(root)
            path=root/'tentsLevels.ts'
            path.write_text('export const tentsLevels: TentsLevel[] = [...tentsExpansion];\n')
            (root/'tentsExpansionData.json').write_text(json.dumps([UNIQUE]))
            wrapper=root/'tentsExpansion.ts'
            for statement in (
                'import data from "./tentsExpansionData.json" with { type: "json" };',
                "import data from './tentsExpansionData.json' with {\n type: 'json',\n};",
            ):
                with self.subTest(statement=statement):
                    wrapper.write_text(statement+'\nexport const tentsExpansion: TentsLevel[] = data;\n')
                    self.assertEqual(read_levels(path),[UNIQUE])

    def test_expansion_adapter_rejects_missing_wrong_or_extra_attributes(self):
        with tempfile.TemporaryDirectory() as root:
            root=Path(root)
            path=root/'tentsLevels.ts'
            path.write_text('export const tentsLevels: TentsLevel[] = [...tentsExpansion];\n')
            (root/'tentsExpansionData.json').write_text(json.dumps([UNIQUE]))
            wrapper=root/'tentsExpansion.ts'
            for suffix in (
                ';',
                'with { type: "javascript" };',
                'with { mode: "json" };',
                'with { type: "json", mode: "other" };',
                'assert { type: "json" };',
                'with { type: "json\' };',
            ):
                with self.subTest(suffix=suffix):
                    wrapper.write_text('import data from "./tentsExpansionData.json" '+suffix+'\nexport const tentsExpansion: TentsLevel[] = data;\n')
                    with self.assertRaisesRegex(ValueError,'Expansion wrapper'):
                        read_levels(path)

    def test_expansion_adapter_rejects_wrong_path_or_computed_export(self):
        with tempfile.TemporaryDirectory() as root:
            root=Path(root)
            path=root/'tentsLevels.ts'
            path.write_text('export const tentsLevels: TentsLevel[] = [...tentsExpansion];\n')
            (root/'tentsExpansionData.json').write_text(json.dumps([UNIQUE]))
            wrapper=root/'tentsExpansion.ts'
            good='import data from "./tentsExpansionData.json" with { type: "json" };\nexport const tentsExpansion: TentsLevel[] = data;\n'
            for bad in (
                good.replace('./tentsExpansionData.json','./otherData.json'),
                good.replace('./tentsExpansionData.json','../tentsExpansionData.json'),
                good.replace('= data;','= data.slice(0, 1);'),
                good.replace('= data;','= [];'),
            ):
                with self.subTest(wrapper=bad):
                    wrapper.write_text(bad)
                    with self.assertRaisesRegex(ValueError,'Expansion wrapper'):
                        read_levels(path)


if __name__=='__main__':
    unittest.main()
