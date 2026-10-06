// SPDX-License-Identifier: GPL-3.0-only
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const read=p=>readFileSync(p,'utf8');
test('GPL text is exactly the official fixed SPDX blob and ships verbatim',()=>{
 const bytes=readFileSync('LICENSE');assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex'),'f6cdd22a6c1fbc887e08a215cb4beb3c47048041');assert.equal(read('public/playgarden-COPYING.txt'),read('LICENSE'));
 assert.equal(JSON.parse(read('package.json')).license,'GPL-3.0-only');assert.equal(JSON.parse(read('package-lock.json')).packages[''].license,'GPL-3.0-only');
});
test('earlier MIT grant is explicitly historical and upstream grants survive',()=>{
 assert.match(read('docs/licensing-history/MIT-through-0e46980.txt'),/^MIT License\n/);assert.match(read('docs/licensing.md'),/not retroactively withdrawn/);assert.match(read('docs/licensing.md'),/not an offer to dual-license/);
 for(const [upstream,publicPath] of [['vendor/open-gomoku/LICENSE','public/gomoku-LICENSE.txt'],['vendor/sgtatham-slant/LICENCE','public/slant-LICENCE.txt'],['docs/upstream/xiangqi.js/LICENSE','public/xiangqi-LICENSE.txt'],['vendor/cloudrunner/LICENSE','public/cloudrunner-LICENSE.txt']])assert.equal(read(upstream).trim(),read(publicPath).trim());
 assert.match(read('src/games/gomokuLogic.ts'),/open-gomoku Contributors. MIT/);assert.match(read('src/vendor/xiangqi/xiangqiCore.js'),/Released under the BSD-2-Clause license/);
});
test('complete runtime notices are reproducible and correspond to installed locked packages',()=>{
 execFileSync(process.execPath,['scripts/sync-license-notices.mjs','--check']);
 for(const name of ['react','react-dom','scheduler','three','lucide-react'])assert.ok(read('public/THIRD_PARTY_NOTICES.txt').includes(read(`node_modules/${name}/LICENSE`).trim()),name);
});
test('license scope keeps version-only, commercial-use and asset boundaries explicit',()=>{
 const scope=read('docs/licensing.md');assert.match(scope,/GPL-3.0-only/);assert.match(scope,/GPL permits commercial use/);assert.match(scope,/Third-party components are not relabeled/);assert.match(scope,/No Night Patrol noncommercial assets/);assert.match(read('public/SOURCE.txt'),/playgarden-commit/);assert.match(read('src/lib/license.ts'),/playgarden-commit/);
});
