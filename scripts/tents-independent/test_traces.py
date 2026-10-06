import copy
import json
from pathlib import Path
import unittest

from audit_traces import (audit_trace, initialize, logical_closure, supported_changes,
                          line_supports)
from verify import read_levels

ROOT=Path(__file__).resolve().parents[2]


class TraceAuditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.levels=read_levels(ROOT/'src/games/tentsExpansionData.json')
        cls.entries=json.loads((ROOT/'docs/tents/authoring-report.json').read_text())['levels']

    def test_trace_can_be_proved_without_certificate_or_generator(self):
        for chapter in range(1,5):
            index=next(i for i,q in enumerate(self.levels) if q['chapter']==chapter)
            q=copy.deepcopy(self.levels[index]);q['solution']=['not a solution'];q['authoringNodes']=-99
            audit=audit_trace(q,self.entries[index]['metrics'])
            self.assertTrue(audit['ok'],audit['errors'])
            self.assertGreater(audit['oppositeValueChecks'],0)

    def test_correct_answer_with_invented_premise_is_rejected(self):
        metrics=copy.deepcopy(self.entries[0]['metrics'])
        # Keep a correct answer change but replace its actual line-count evidence.
        first=metrics['trace'][0]
        first['rule']='spacing';first['tent']=self.levels[0]['solution'][0]
        result=audit_trace(self.levels[0],metrics)
        self.assertFalse(result['ok'])
        self.assertTrue(any('not an established tent' in e for e in result['errors']))

    def test_forged_line_target_and_repeated_change_are_rejected(self):
        metrics=copy.deepcopy(self.entries[0]['metrics'])
        metrics['trace'][0]['target']+=1
        result=audit_trace(self.levels[0],metrics)
        self.assertTrue(any('target differs' in e for e in result['errors']))
        metrics=copy.deepcopy(self.entries[0]['metrics'])
        metrics['trace'][0]['changes'].append(metrics['trace'][0]['changes'][0])
        result=audit_trace(self.levels[0],metrics)
        self.assertTrue(any('repeats' in e for e in result['errors']))

    def test_omitted_line_pattern_is_rejected(self):
        index=next(i for i,e in enumerate(self.entries) if e['metrics']['rules'].get('line-pattern'))
        metrics=copy.deepcopy(self.entries[index]['metrics'])
        step=next(s for s in metrics['trace'] if s['rule']=='line-pattern')
        step['patterns'].pop()
        result=audit_trace(self.levels[index],metrics)
        self.assertTrue(any('omit or invent' in e for e in result['errors']),result)

    def test_omitted_tree_candidate_is_rejected(self):
        index=next(i for i,e in enumerate(self.entries) if e['metrics']['rules'].get('tree-space'))
        metrics=copy.deepcopy(self.entries[index]['metrics'])
        step=next(s for s in metrics['trace'] if s['rule']=='tree-space')
        step['domain'].pop()
        result=audit_trace(self.levels[index],metrics)
        self.assertTrue(any('tree domain differs' in e for e in result['errors']),result)

    def test_unknown_rule_and_incomplete_trace_are_rejected(self):
        metrics=copy.deepcopy(self.entries[0]['metrics'])
        metrics['trace'][0]['rule']='authoring-certificate'
        self.assertFalse(audit_trace(self.levels[0],metrics)['ok'])
        metrics=copy.deepcopy(self.entries[0]['metrics'])
        metrics['trace']=metrics['trace'][:1]
        result=audit_trace(self.levels[0],metrics)
        self.assertTrue(any('does not finish' in e for e in result['errors']),result)

    def test_weaker_rules_really_stall_at_chapter_boundaries(self):
        for chapter in range(1,5):
            q=next(q for q in self.levels if q['chapter']==chapter)
            self.assertEqual(logical_closure(q,'basic')['status'],'solved' if chapter==1 else 'stalled')
            self.assertEqual(logical_closure(q,'patterns')['status'],'solved' if chapter<=2 else 'stalled')
            self.assertEqual(logical_closure(q,'tree-space')['status'],'solved')

    def test_tree_space_never_discards_its_own_potential_tent(self):
        q=self.levels[-1];state=initialize(q);n=q['size']
        for tree in q['trees']:
            domain=[p for p in range(n*n) if abs(p//n-tree//n)+abs(p%n-tree%n)==1 and state[p]!=0]
            changes=supported_changes(q,state,{'rule':'tree-space','tree':tree,'domain':domain})
            self.assertTrue(set(changes).isdisjoint(domain))


if __name__=='__main__':
    unittest.main()
