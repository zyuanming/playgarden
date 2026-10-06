// Playwright discovers tests in Node: JSON imports must work without Vite transforms.
// Use native loading throughout, with no resolution hook or JSON interception.
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('Tents expansion loads all 188 additions through native JSON import attributes', async () => {
  const { tentsExpansion } = await import('../../src/games/tentsExpansion.ts');
  assert.equal(tentsExpansion.length, 188);
  assert.equal(tentsExpansion[0].id, 'tents-counts-001');
  assert.equal(tentsExpansion[187].id, 'tents-challenge-060');
});

test('the import regression does not mask missing JSON attributes', async () => {
  await assert.rejects(import('../../src/games/tentsExpansionData.json'), {
    code: 'ERR_IMPORT_ATTRIBUTE_MISSING',
  });
});
