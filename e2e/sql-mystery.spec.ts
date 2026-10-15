// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { openGame } from './helpers';
test.use({ trace: 'off' });
const KEY = 'playgarden.sql-mystery.v1';
const LONG = 'WITH RECURSIVE t(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM t) SELECT sum(x) FROM t;';
test('original SQL investigation reaches both actual answer triggers and handles interruption', async ({ page, baseURL }, info) => {
  test.setTimeout(150000);
  if (!baseURL) throw Error('Missing configured baseURL');
  const origin = new URL(baseURL).origin, errors: string[] = [], outside: string[] = [], inputs: object[] = [], workers: object[] = [];
  const mobile = info.project.name === 'mobile';
  const activate = async (n: Locator) => { if (mobile) await n.tap(); else await n.click(); };
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== origin) outside.push(r.url()); });
  page.on('worker', w => { workers.push({ event: 'start', url: w.url() }); w.on('close', () => workers.push({ event: 'close', url: w.url() })); });
  const ready = () => expect(page.locator('[data-sql-ready]')).toHaveAttribute('data-sql-ready', 'true', { timeout: 20000 });
  const reopen = async () => { await activate(page.getByRole('button', { name: '重新打开', exact: true })); await ready(); };
  const run = async (sql: string, expected: string) => {
    await page.getByTestId('sql-editor').fill(sql); await activate(page.getByRole('button', { name: '运行SQL', exact: true }));
    await expect(page.getByTestId('sql-status')).toContainText('查询完成', { timeout: 10000 });
    await expect(page.getByTestId('sql-results')).toContainText(expected);
    inputs.push({ sql, visible: await page.getByTestId('sql-results').innerText() });
  };
  try {
    await openGame(page, 'SQL迷案'); await ready();
    await expect(page.locator('.sql-mystery header strong')).toHaveText('调查行凶者');
    for (const sql of ["INSERT INTO solution VALUES (0,'brains behind the murder');", "UPDATE solution SET value='brains behind the murder';", 'DROP TRIGGER check_solution;', 'PRAGMA writable_schema=ON;']) {
      await page.getByTestId('sql-editor').fill(sql); await activate(page.getByRole('button', { name: '运行SQL', exact: true }));
      await expect(page.getByTestId('sql-status')).toContainText('查询未完成'); await expect(page.locator('.sql-ending')).toHaveCount(0); await reopen();
    }
    await run("INSERT INTO solution VALUES (1, 'Miranda Priestly'); SELECT value FROM solution;", 'brains behind the murder');
    await expect(page.locator('.sql-ending')).toContainText('案件告破');
    inputs.push({ directFinalOriginalRule: true, observed: await page.locator('.sql-ending').innerText() });
    await activate(page.getByRole('button', { name: '重来', exact: true })); await ready();
    await expect(page.locator('.sql-ending')).toHaveCount(0);
    await run("INSERT INTO solution VALUES (1, 'Not A Suspect'); SELECT value FROM solution;", "That's not the right person");
    await expect(page.locator('.sql-ending')).toHaveCount(0);
    await run("SELECT '<img src=x onerror=alert(1)>' AS '<script>';", '<img src=x onerror=alert(1)>');
    await expect(page.getByTestId('sql-results').locator('img,script')).toHaveCount(0);
    await page.getByTestId('sql-editor').fill("SELECT load_extension('https://example.com/never-sql-extension');");
    await activate(page.getByRole('button', { name: '运行SQL', exact: true })); await expect(page.getByTestId('sql-status')).toContainText('查询未完成'); await reopen();
    await page.getByTestId('sql-editor').fill(LONG); await activate(page.getByRole('button', { name: '运行SQL', exact: true }));
    await expect(page.getByTestId('sql-status')).toContainText(/查询未完成|时间限制/, { timeout: 10000 }); await expect.poll(() => page.workers().length).toBe(0); await reopen();
    await page.getByTestId('sql-editor').fill(LONG); await activate(page.getByRole('button', { name: '运行SQL', exact: true }));
    await activate(page.getByRole('button', { name: '暂停', exact: true })); await expect.poll(() => page.workers().length).toBe(0);
    await page.getByRole('button', { name: '继续游戏', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('sql-paused-viewport.png'), fullPage: false });
    await activate(page.getByRole('button', { name: '继续游戏', exact: true })); await ready();
    await run("SELECT description FROM crime_scene_report WHERE date=20180115 AND type='murder' AND city='SQL City';", 'Northwestern Dr');
    await page.screenshot({ path: info.outputPath('sql-original-crime-report.png'), fullPage: true });
    await run("SELECT id,name,address_number FROM person WHERE address_street_name='Northwestern Dr' ORDER BY address_number DESC LIMIT 1; SELECT id,name FROM person WHERE name LIKE 'Annabel%' AND address_street_name='Franklin Ave';", 'Annabel Miller');
    await run('SELECT person_id,transcript FROM interview WHERE person_id IN (14887,16371);', '48Z');
    await run("SELECT m.name,m.person_id FROM get_fit_now_member m JOIN get_fit_now_check_in c ON m.id=c.membership_id JOIN person p ON p.id=m.person_id JOIN drivers_license d ON d.id=p.license_id WHERE m.id LIKE '48Z%' AND m.membership_status='gold' AND c.check_in_date=20180109 AND d.plate_number LIKE '%H42W%';", 'Jeremy Bowers');
    await run("INSERT INTO solution VALUES (1,'Jeremy Bowers'); SELECT value FROM solution;", 'found the murderer');
    await expect(page.locator('.sql-mystery header strong')).toHaveText('追查幕后委托者');
    await page.screenshot({ path: info.outputPath('sql-original-first-stage.png'), fullPage: true });
    await run('SELECT transcript FROM interview WHERE person_id=67318;', 'Tesla');
    await run("SELECT p.name,COUNT(*) AS visits FROM person p JOIN drivers_license d ON d.id=p.license_id JOIN facebook_event_checkin f ON f.person_id=p.id WHERE d.gender='female' AND d.height BETWEEN 65 AND 67 AND d.hair_color='red' AND d.car_make='Tesla' AND d.car_model='Model S' AND f.event_name='SQL Symphony Concert' AND f.date BETWEEN 20171201 AND 20171231 GROUP BY p.id HAVING COUNT(*)=3;", 'Miranda Priestly');
    await run("INSERT INTO solution VALUES (1,'Miranda Priestly'); SELECT value FROM solution;", 'brains behind the murder');
    await expect(page.locator('.sql-ending')).toContainText('案件告破');
    await page.locator('.sql-ending').scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('sql-complete-case-viewport.png'), fullPage: false });
    await page.screenshot({ path: info.outputPath('sql-complete-case-full.png'), fullPage: true });
    const note = '核对了两位证人、金卡会员、车牌和音乐会签到。'; await page.getByLabel('调查笔记', { exact: true }).fill(note);
    const edited = 'SELECT name FROM person LIMIT 3;'; await page.getByTestId('sql-editor').fill(edited);
    await activate(page.getByRole('button', { name: '返回游戏大厅', exact: true })); await expect.poll(() => page.workers().length).toBe(0);
    await page.getByRole('textbox', { name: '搜索游戏' }).fill('SQL迷案'); await activate(page.getByRole('button', { name: '开始玩SQL迷案', exact: true })); await ready();
    await expect(page.getByTestId('sql-editor')).toHaveValue(edited); await expect(page.getByLabel('调查笔记', { exact: true })).toHaveValue(note);
    await page.reload(); await page.getByRole('textbox', { name: '搜索游戏' }).fill('SQL迷案'); await activate(page.getByRole('button', { name: '开始玩SQL迷案', exact: true })); await ready();
    await expect(page.getByTestId('sql-editor')).toHaveValue(edited); await expect(page.locator('.sql-mystery header strong')).toHaveText('全案侦破');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await activate(page.getByRole('button', { name: '重来', exact: true })); await ready();
    await expect(page.locator('.sql-mystery header strong')).toHaveText('调查行凶者'); await expect(page.getByLabel('调查笔记', { exact: true })).toHaveValue('');
    await run('SELECT COUNT(*) AS people FROM person;', '10011');
    await activate(page.getByRole('button', { name: '返回游戏大厅', exact: true })); await expect.poll(() => page.workers().length).toBe(0);
    expect(errors).toEqual([]); expect(outside).toEqual([]);
  } finally {
    writeFileSync(info.outputPath('sql-real-inputs.json'), JSON.stringify({ inputs, errors, outside, workers }, null, 2));
    writeFileSync(info.outputPath('sql-notebook.json'), JSON.stringify(await page.evaluate(key => localStorage.getItem(key), KEY).catch(() => null)));
    await page.screenshot({ path: info.outputPath('sql-last-viewport.png'), fullPage: false }).catch(() => {});
  }
});
test('SQL worker closes during real StrictMode repeated mounts', async ({ page }, info) => {
  test.setTimeout(45000);
  const port = 4340 + info.workerIndex, base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'], { stdio: ['ignore','pipe','pipe'] });
  let output = ''; server.stdout.on('data', b => output += String(b)); server.stderr.on('data', b => output += String(b));
  try {
    await expect.poll(async () => { try { return (await fetch(base)).ok; } catch { return false; } }, { timeout: 15000 }).toBe(true);
    await page.goto(base);
    for (let i = 0; i < 2; i++) {
      await page.getByRole('textbox', { name: '搜索游戏' }).fill('SQL迷案'); await page.getByRole('button', { name: '开始玩SQL迷案', exact: true }).click();
      await expect(page.locator('[data-sql-ready]')).toHaveAttribute('data-sql-ready', 'true'); await expect.poll(() => page.workers().length).toBe(1);
      await page.getByTestId('sql-editor').fill(`SELECT ${i};`);
      await page.getByRole('button', { name: '返回游戏大厅', exact: true }).click(); await expect.poll(() => page.workers().length).toBe(0);
      expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}').sql, KEY)).toBe(`SELECT ${i};`);
    }
  } finally { server.kill('SIGTERM'); writeFileSync(info.outputPath('sql-strictmode-dev.json'), JSON.stringify({ output, mode: 'real Vite development React StrictMode' })); }
});
