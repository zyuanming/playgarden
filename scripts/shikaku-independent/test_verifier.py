"""Original negative tests for the independent reviewer itself."""
import copy
import unittest
from verify import canonical_keys, coordinate_domains, count_solutions, logical_analysis, point, review, validate


class IndependentVerifierTests(unittest.TestCase):
    def setUp(self):
        self.level={'size':3,'clues':[{'index':x,'area':3} for x in range(3)],
                    'solution':[[0,x,2,x] for x in range(3)]}

    def test_certificate_covers_every_cell_once(self):
        self.assertEqual(validate(self.level),[])
        broken=copy.deepcopy(self.level)
        broken['solution'][2]=broken['solution'][1]
        errors=validate(broken)
        self.assertIn('certificate does not cover every cell',errors)
        self.assertIn('certificate rectangles overlap',errors)

    def test_incorrect_clue_area(self):
        broken=copy.deepcopy(self.level)
        broken['clues'][0]['area']=2
        self.assertTrue(validate(broken))

    def test_duplicate_clue(self):
        broken=copy.deepcopy(self.level)
        broken['clues'][0]['index']=1
        self.assertIn('clue positions repeat',validate(broken))

    def test_invalid_bounds_and_boolean(self):
        for rectangle in ([-1,0,2,0],[0,0,3,0],[2,0,0,0],[False,0,2,0],[0,0,2]):
            broken=copy.deepcopy(self.level)
            broken['solution'][0]=rectangle
            self.assertTrue(validate(broken))

    def test_multiple_clues_in_certificate_rectangle(self):
        broken=copy.deepcopy(self.level)
        broken['solution'][0]=[0,0,0,2]
        self.assertTrue(any('contains 3 clues' in e for e in validate(broken)))

    def test_exhaustive_unique(self):
        result=count_solutions(self.level,coordinate_domains(self.level))
        self.assertEqual(result['status'],'unique')
        self.assertTrue(result['certificateMatches'])

    def test_stop_at_second_solution(self):
        ambiguous=copy.deepcopy(self.level)
        for c,index in zip(ambiguous['clues'],[0,4,8]):
            c['index']=index
        result=count_solutions(ambiguous,coordinate_domains(ambiguous))
        self.assertEqual(result['status'],'multiple')
        self.assertEqual(result['solutionsFound'],2)

    def test_no_solution_has_explicit_status(self):
        impossible={'size':3,'clues':[{'index':0,'area':5},{'index':4,'area':2},{'index':8,'area':2}],
                    'solution':[]}
        self.assertEqual(count_solutions(impossible,coordinate_domains(impossible))['status'],'no_solution')

    def test_budget_and_timeout_are_not_proofs(self):
        domains=coordinate_domains(self.level)
        self.assertEqual(count_solutions(self.level,domains,budget=1)['status'],'budget')
        self.assertEqual(count_solutions(self.level,domains,timeout=-1)['status'],'timeout')
        result=review([self.level],[],1,10)
        self.assertFalse(result['summary']['allCertified'])
        self.assertFalse(result['summary']['allGatesPassed'])

    def test_all_d4_transforms_and_ordering(self):
        for transform in range(8):
            n=self.level['size']
            transformed=copy.deepcopy(self.level)
            for clue in transformed['clues']:
                y,x=point(n,clue['index']//n,clue['index']%n,transform)
                clue['index']=y*n+x
            rectangles=[]
            for a,b,c,d in self.level['solution']:
                corners=[point(n,y,x,transform) for y,x in [(a,b),(a,d),(c,b),(c,d)]]
                rectangles.append([min(y for y,x in corners),min(x for y,x in corners),
                                   max(y for y,x in corners),max(x for y,x in corners)])
            transformed['solution']=list(reversed(rectangles))
            transformed['clues'].reverse()
            self.assertEqual(canonical_keys(self.level),canonical_keys(transformed))

    def test_same_partition_with_moved_clues_rejected(self):
        moved=copy.deepcopy(self.level)
        for clue in moved['clues']:
            clue['index']+=3
        result=review([self.level,moved],[],200000,10)['summary']
        self.assertEqual(result['clueD4Duplicates'],[])
        self.assertEqual(result['partitionD4Duplicates'],[[1,2]])
        self.assertFalse(result['allGatesPassed'])

    def test_prefix_changes_rejected(self):
        changed=copy.deepcopy(self.level)
        changed['title']='new title'
        summary=review([changed],[self.level],200000,10)['summary']
        self.assertFalse(summary['legacyPrefixPreserved'])
        self.assertFalse(summary['allGatesPassed'])

    def test_required_count_rejected(self):
        summary=review([self.level],[],200000,10,200)['summary']
        self.assertFalse(summary['requiredCountMatches'])
        self.assertFalse(summary['allGatesPassed'])

    def test_logical_solver_does_not_resolve_ambiguity(self):
        ambiguous=copy.deepcopy(self.level)
        for c,index in zip(ambiguous['clues'],[0,4,8]):
            c['index']=index
        for mode in ('singles','coverage','shared_cells','exclusion'):
            self.assertEqual(logical_analysis(ambiguous,coordinate_domains(ambiguous),mode)['status'],'stalled')


if __name__=='__main__':
    unittest.main()
