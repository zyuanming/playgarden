import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const mode = process.env.BROWSER_MODE;
if (!['full', 'focused'].includes(mode)) throw new Error('Invalid browser mode');
// Full means unfiltered discovery, including future .test.ts/.spec.tsx files.
const files = mode === 'full' ? [] : JSON.parse(process.env.BROWSER_FILES ?? '[]');
const shard = process.env.BROWSER_SHARD, total = process.env.BROWSER_TOTAL;
if (!Array.isArray(files) || (mode === 'focused' && !files.length) || files.some(p => typeof p !== 'string' || !/^e2e\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:spec|test)\.[cm]?[jt]sx?$/.test(p) || !existsSync(p))) throw new Error('Invalid browser test list');
if (!/^[1-8]$/.test(shard ?? '') || !/^[1-8]$/.test(total ?? '') || Number(shard) > Number(total)) throw new Error('Invalid browser shard');
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...files, `--shard=${shard}/${total}`], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
