// SPDX-License-Identifier: GPL-3.0-only
// SQL is interpreted by SQLite inside this disposable worker. It is never JS.
// Official supported config: this case needs no persistent filesystem or child workers.
self.sqlite3ApiConfig = { disable: { vfs: { kvvfs: true, opfs: true, 'opfs-vfs': true, 'opfs-wl': true, 'opfs-sahpool': true } } };
importScripts('./sqlite3.js');
const VERSION = 'sql-city-a7aa227-sqlite3540000-v1';
const MAX_SQL = 32000, MAX_ROWS = 200, MAX_BYTES = 700000, MAX_DB = 8 * 1024 * 1024;
let sqlite, db, session = '', busy = false, earnedStage = 0;
const send = (type, data = {}) => postMessage({ version: VERSION, session, type, ...data });
const message = error => String(error?.message || error).slice(0, 800);
function stage() {
  try {
    const feedback = String(db.selectValue('SELECT value FROM solution LIMIT 1') || '');
    return { stage: earnedStage, feedback }; 
  } catch { return { stage: earnedStage, feedback: '' }; }
}
function snapshot() {
  const bytes = sqlite.capi.sqlite3_js_db_export(db.pointer);
  if (bytes.byteLength > MAX_DB) throw Error('数据库超过本地实验大小，请重置案件。');
  return bytes;
}
function runSql(sql) {
  const { capi: c, wasm: w } = sqlite;
  const end = performance.now() + 1500, results = [];
  let rowCount = 0, textBytes = 0, truncated = false;
  c.sqlite3_progress_handler(db.pointer, 1000, () => performance.now() > end ? 1 : 0, 0);
  w.scopedAllocPush();
  let stmt = 0;
  try {
    const bytes = new TextEncoder().encode(sql), start = w.scopedAlloc(bytes.length + 1);
    w.heap8u().set(bytes, start); w.poke8(start + bytes.length, 0);
    const pp = w.scopedAlloc(4), tail = w.scopedAlloc(4);
    let cursor = start, statements = 0;
    while (cursor < start + bytes.length && w.peek8(cursor)) {
      if (++statements > 40 || performance.now() > end) throw Error('查询已停止：请分成更小的语句。');
      w.pokePtr(pp, 0); w.pokePtr(tail, 0);
      db.checkRc(c.sqlite3_prepare_v3(db.pointer, cursor, start + bytes.length - cursor, 0, pp, tail));
      stmt = w.peekPtr(pp);
      const next = w.peekPtr(tail); if (next <= cursor) throw Error('无法继续解析SQL。'); cursor = next;
      if (!stmt) continue;
      // Inspect SQLite's parsed single statement before executing any write.
      // Arbitrary SQL cannot write a success phrase or replace the original trigger.
      const writes = !c.sqlite3_stmt_readonly(stmt);
      if (writes && !/^\s*INSERT\s+INTO\s+solution\s+VALUES\s*\(\s*1\s*,\s*'(?:[^']|'')*'\s*\)\s*;?\s*$/i.test(c.sqlite3_sql(stmt))) {
        throw Error("证据表只读。核验请使用 INSERT INTO solution VALUES (1, '姓名');");
      }
      const columns = [], rows = [], n = c.sqlite3_column_count(stmt);
      if (n > 40) throw Error('请只选择需要的列，每次最多40列。');
      for (let i = 0; i < n; i++) columns.push(c.sqlite3_column_name(stmt, i).slice(0, 120));
      let rc;
      while ((rc = c.sqlite3_step(stmt)) === c.SQLITE_ROW) {
        if (rowCount >= MAX_ROWS || textBytes >= MAX_BYTES) { truncated = true; break; }
        const row = [];
        for (let i = 0; i < n; i++) {
          const kind = c.sqlite3_column_type(stmt, i);
          const value = kind === c.SQLITE_NULL ? null : kind === c.SQLITE_BLOB ? '[二进制数据]' : String(c.sqlite3_column_text(stmt, i));
          const shown = value === null ? null : value.length > 2500 ? value.slice(0, 2500) + '…' : value;
          textBytes += shown?.length || 0; row.push(shown);
        }
        rows.push(row); rowCount++;
      }
      if (!truncated && rc !== c.SQLITE_DONE) db.checkRc(rc);
      c.sqlite3_finalize(stmt); stmt = 0;
      if (writes && rc === c.SQLITE_DONE) {
        const feedback = stage().feedback;
        if (feedback.includes('found the murderer')) earnedStage = Math.max(earnedStage, 1);
        else if (feedback.includes('brains behind the murder')) earnedStage = 2;
      }
      if (n) results.push({ columns, rows });
      if (truncated) break;
    }
    return { results, truncated, rowCount };
  } finally {
    if (stmt) c.sqlite3_finalize(stmt);
    c.sqlite3_progress_handler(db.pointer, 0, 0, 0);
    w.scopedAllocPop();
  }
}
onmessage = async event => {
  const d = event.data;
  if (!d || d.version !== VERSION || typeof d.session !== 'string' || d.session.length > 100) return;
  if (d.type === 'init' && !session) {
    session = d.session; earnedStage = [0, 1, 2].includes(d.earnedStage) ? d.earnedStage : 0;
    try {
      // Bounds the WASM heap only, not total browser/JS memory.
      const memory = new WebAssembly.Memory({ initial: 128, maximum: 1024 });
      sqlite = await sqlite3InitModule({ wasmMemory: memory, locateFile: name => new URL(name, self.location.href).href, print: () => {}, printErr: () => {} });
      if (sqlite.capi.sqlite3_libversion() !== '3.54.0') throw Error('数据库引擎版本不匹配。');
      let bytes;
      if (d.snapshot instanceof Uint8Array && d.snapshot.byteLength >= 512 && d.snapshot.byteLength <= MAX_DB) bytes = d.snapshot;
      else { const r = await fetch('./case.db'); if (!r.ok) throw Error('案件资源读取失败。'); bytes = new Uint8Array(await r.arrayBuffer()); }
      db = new sqlite.oo1.DB(':memory:', 'c');
      const p = sqlite.wasm.allocFromTypedArray(bytes);
      const c = sqlite.capi;
      const rc = c.sqlite3_deserialize(db.pointer, 'main', p, BigInt(bytes.byteLength), BigInt(bytes.byteLength), c.SQLITE_DESERIALIZE_FREEONCLOSE | c.SQLITE_DESERIALIZE_RESIZEABLE);
      if (rc) { sqlite.wasm.dealloc(p); db.checkRc(rc); }
      // The unchanged 2018 answer trigger uses double-quoted string literals.
      // Restore the original SQLite interpretation; modern WASM defaults DQS off.
      db.checkRc(c.sqlite3_db_config(db.pointer, c.SQLITE_DBCONFIG_DQS_DML, 1, 0));
      db.checkRc(c.sqlite3_db_config(db.pointer, c.SQLITE_DBCONFIG_DQS_DDL, 1, 0));
      for (const [kind, limit] of [[c.SQLITE_LIMIT_LENGTH, 1000000], [c.SQLITE_LIMIT_SQL_LENGTH, MAX_SQL], [c.SQLITE_LIMIT_COLUMN, 40], [c.SQLITE_LIMIT_EXPR_DEPTH, 100], [c.SQLITE_LIMIT_COMPOUND_SELECT, 40], [c.SQLITE_LIMIT_ATTACHED, 0]]) c.sqlite3_limit(db.pointer, kind, limit);
      // Evidence/DDL are read-only. Only the original answer INSERT and its
      // unchanged trigger may write, and runSql validates the parsed INSERT.
      c.sqlite3_set_authorizer(db.pointer, (_p, action, arg1, arg2, _database, source) => {
        const name = v => typeof v === 'number' ? sqlite.wasm.cstrToJs(v) : v;
        if (action === c.SQLITE_READ || action === c.SQLITE_SELECT || action === c.SQLITE_RECURSIVE) return c.SQLITE_OK;
        if (action === c.SQLITE_FUNCTION) return String(name(arg2)).toLowerCase() === 'load_extension' ? c.SQLITE_DENY : c.SQLITE_OK;
        if (name(arg1) === 'solution' && action === c.SQLITE_INSERT && (!source || name(source) === 'check_solution')) return c.SQLITE_OK;
        if (name(arg1) === 'solution' && action === c.SQLITE_DELETE && name(source) === 'check_solution') return c.SQLITE_OK;
        return c.SQLITE_DENY;
      }, 0);
      const schema = db.selectObjects("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
      send('ready', { schema, snapshot: snapshot(), ...stage() });
    } catch (error) { send('error', { message: message(error), fatal: true }); }
    return;
  }
  if (d.session !== session || !db || busy || d.type !== 'query' || !Number.isSafeInteger(d.id) || d.id < 1 || typeof d.sql !== 'string' || d.sql.length > MAX_SQL) return;
  busy = true;
  try { send('result', { id: d.id, ...runSql(d.sql), ...stage(), snapshot: snapshot() }); }
  catch (error) { send('error', { id: d.id, message: message(error), fatal: false }); }
  finally { busy = false; }
};
