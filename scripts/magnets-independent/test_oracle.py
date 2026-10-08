# SPDX-License-Identifier: GPL-3.0-only
import unittest,os
from fixtures import fixtures
from oracle import brute,solve_integer,direct
from verify import canonical

class OracleTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("MAGNETS_MILP")=="1", "Optional SciPy proof: set MAGNETS_MILP=1")
    def test_milp_matches_full_enumeration(self):
        # All 114 deterministic fixtures, both satisfiable and inconsistent.
        for p in fixtures():
            with self.subTest(p=p['id']):
                expect=brute(p)
                actual,exhausted,_=solve_integer(p,len(expect)+1)
                self.assertTrue(exhausted)
                self.assertEqual(sorted(actual),sorted(expect))
    def test_neutral_unknown_adjacency(self):
        p=fixtures()[0]
        self.assertEqual(len(brute(p)),7)
        self.assertTrue(direct(p,[0,0])['won'])
        self.assertFalse(direct(p,[-1,0])['won'])
        self.assertTrue(direct(p,[1,2])['won'])
        self.assertFalse(direct(p,[1,1])['won'])
        self.assertFalse(direct(p,[2,2])['won'])
    def test_distinguishes_omitted_and_zero_quota(self):
        p=fixtures()[0];q={**p,'rowPlus':[0,-1]}
        self.assertNotEqual(canonical(p),canonical(q))
        self.assertGreater(len(brute(p)),len(brute(q)))
    def test_rectangle_transpose_and_reflection(self):
        p=fixtures()[10];w=p['width'];h=p['height']
        p={**p,'solution':brute(p)[-1]}
        q={**p,'width':h,'height':w,
           'dominoes':[[i%w*h+i//w for i in pair] for pair in p['dominoes']],
           'rowPlus':p['colPlus'],'rowMinus':p['colMinus'],
           'colPlus':p['rowPlus'],'colMinus':p['rowMinus']}
        r={**p,'dominoes':[[i//w*w+(w-1-i%w) for i in pair] for pair in p['dominoes']],
           'colPlus':p['colPlus'][::-1],'colMinus':p['colMinus'][::-1]}
        for include_solution in (False,True):
            self.assertEqual(canonical(p,True,include_solution),canonical(q,True,include_solution))
            self.assertEqual(canonical(p,True,include_solution),canonical(r,True,include_solution))
    def test_polarity_and_order_invariance(self):
        p=fixtures()[1]
        q={**p,'dominoes':[list(reversed(x)) for x in reversed(p['dominoes'])],
           'rowPlus':p['rowMinus'],'rowMinus':p['rowPlus'],'colPlus':p['colMinus'],'colMinus':p['colPlus']}
        self.assertEqual(canonical(p),canonical(q))

if __name__=='__main__':unittest.main()
