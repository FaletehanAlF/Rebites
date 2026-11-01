#!/usr/bin/env node
// ============================================================================
// Harness balapan rilis stok ReBites — TC-03 & TC-04 W4 (Supabase V1 LOKAL).
//
// Mode:
//   --mode tc03 : wrapper release_order_stock × wrapper (dua sesi)
//   --mode tc04 : statement webhook × statement verify (TC-04 W4)
//
// Protokol gate (revisi final, hanya untuk tc03/tc04):
//   G0 (sebelum B dijadwalkan): sesi A aktif;
//     wait_event_type='Lock'/wait_event='advisory' (menunggu izin commit);
//     backend_xid NOT NULL; advisory (778001,1) GRANTED oleh A (sinyal
//     "wrapper A selesai", di-set SETELAH panggilan); advisory (778001,7)
//     UNGRANTED oleh A; corroboration: stok produk = S0 dan marker
//     stock_released_at order = NULL (reserved NOT NULL).
//   G1 (setelah B start): B wait_event='transactionid'; pg_locks B memuat
//     UNGRANTED transactionid = X; X = backend_xid A; A memegang GRANTED
//     transactionid X; query B memuat penanda statement yang diharapkan;
//     corroboration: pg_blocking_pids(B) ∋ A (soft, tidak menentukan).
//   Pelepasan izin: harness mematikan sesi permit-holder (pg_terminate_backend
//   pada pid sesi BERPENANDA MILIK HARNESS saja) → A commit → B requalifikasi.
//   Katalog membuktikan "B menunggu transaksi A (XID)"; atribusi bahwa lock
//   tersebut adalah ROW order O adalah inferensi dari kode+naskah (tuple lock
//   tidak terekspos katalog) — dicatat sebagai keterbatasan.
//
// Klasifikasi hasil:
//   PASS        : 10/10 (default) iterasi dengan gate teramati + matriks
//                 konsisten (tc03: A=true,B=false,ΔS=+q satu kali,marker
//                 terisi; tc04: tepat satu rowcount=1,ΔS=+q satu kali).
//   ANOMALY     : hasil tak sesuai matriks saat gate teramati → FAIL keras,
//                 loop dihentikan, bukti dicetak (jangan retry siklus sama).
//   INCONCLUSIVE: gate tidak teramati / timeout / output tak lengkap /
//                 statement tak selesai — BUKAN bukti apa pun.
//   INVALID*    : prasyarat tidak terpenuhi (nonlokal, bukan READ COMMITTED,
//                 fixture tak tervalidasi, sesi tak memenuhi isolasi).
//   L4: nilai `true`/rowcount/marker saja tidak pernah dianggap bukti —
//   evaluasi selalu memakai Δstok kuantitatif + kombinasi gate.
//   Cleanup: status TERPISAH dari hasil race (field `cleanup` per iterasi).
//   Teardown gagal / dilewati (identitas run tak valid) / verifikasi sisa
//   (orders, products, users, activity_logs) atau marker keberadaan fixture
//   tidak lengkap → cleanup.ok=false. Sesi ber-tag run WAJIB terverifikasi
//   hilang (polling terbatas); nilai boolean pg_terminate_backend hanya
//   diagnostik. Status race per-iterasi TIDAK diubah, tetapi keseluruhan
//   TIDAK pernah PASS (diturunkan ke INCONCLUSIVE). Verifikasi akhir
//   (sesi/lock yang dapat diatribusikan ke tag run ini) ikut menggerbangi
//   status; sesi/lock asing hanya peringatan.
//   Data: nilai boolean PostgreSQL dinormalisasi sebelum dibandingkan
//   (hasil cast ::text = 'true'/'false'; hasil \gset = 't'/'f'); nilai tak
//   dikenal menghasilkan pesan diagnostik — bukan PASS.
//
// Pengaman (wajib):
//   - Menolak koneksi ke host selain 127.0.0.1 / localhost / ::1.
//   - dbname wajib 'postgres' (override eksplisit: RB_RACE_ALLOW_CUSTOM_DB=1).
//   - Membutuhkan READ COMMITTED sebagai default_transaction_isolation
//     (spesifikasi TC-03: di bawah REPEATABLE READ panggilan kedua error
//     serialisasi; sesi juga mem-pin READ COMMITTED secara eksplisit).
//   - Semua skrip SQL di sql/ menolak dijalankan di luar harness (blok guard
//     GUC `rebitess.race.harness`; harness menyuntikkan via PGOPTIONS).
//   - Cleanup (teardown.sql) HANYA menghapus baris fixture dengan identitas
//     run ini: kode/slug persis + pola bertag run (code_prefix/slug_prefix
//     adalah prefix MODE, bukan identitas run — tag run ada di dalam
//     kode/slug); activity_logs dihapus hanya lewat target EKSAK (id order /
//     id produk) + metadata EKSAK yang terbukti ditulis trigger (order_code /
//     umkm_id), bukan lewat user_id dan bukan LIKE. Marker keberadaan fixture
//     wajib terbaca dan konsisten dengan jumlah DELETE — teardown_products=0
//     tidak otomatis berarti produk sudah dibersihkan. Menolak jalan bila
//     parameter identitas kosong/invalid.
//   - Sesi yang dimatikan HANYA ber-application_name `rr-<tag>-…` milik run
//     ini; pola global `rr-%` TIDAK PERNAH dipakai. Setelah terminate, sesi
//     run ini diverifikasi hilang lewat polling terbatas (bukan boolean
//     pg_terminate_backend). Preflight tidak mematikan sesi apa pun: sisa
//     lock/sesi lain → INVALID + instruksi pemeriksaan manual. Cleanup akhir
//     membedakan atribusi: sesi/advisory lock milik `rr-<tag>-…` → kegagalan
//     status; sesi/lock asing (termasuk kelas lock sama) → peringatan saja,
//     tidak dibunuh dan tidak menggagalkan run.
//   - Dry-run DEFAULT: tanpa --execute tidak ada koneksi DB sama sekali
//     (termasuk jalur FATAL/catch).
//
// Pemakaian:
//   node scripts/stock-release-race/run-race.mjs --mode tc03 [--iterations 10]
//   node scripts/stock-release-race/run-race.mjs --mode tc04 --iterations 10 --execute
//   PSQL='C:\...\psql.exe' PGPASSWORD=postgres node ... (Supabase lokal default)
//
// Env: PGHOST/PGPORT/PGUSER/PGDATABASE/PGPASSWORD (baku libpq; TIDAK membaca
// .env), PSQL (path biner psql; default 'psql' dari PATH), PSQL dipanggil -w
// (tidak pernah prompt), PGSERVICE/PGHOSTADDR dihapus dari env anak.
// Timeout: RB_RACE_GATE_TIMEOUT_MS (default 30000), RB_RACE_SESSION_TIMEOUT_MS
// (default 120000), RB_RACE_TERMINATE_TIMEOUT_MS (default 5000; polling
// verifikasi sesi run-scoped hilang setelah pg_terminate_backend).
//
// Exit code: 0 PASS, 1 FAIL, 2 INCONCLUSIVE, 3 INVALID.
//
// STATUS: BELUM DIJALANKAN. Jangan jalankan terhadap database hosted/produksi;
// jangan menjalankan dua instans bersamaan.
// ============================================================================

import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SQL_DIR = path.join(HERE, 'sql');
const SEP = '\u001f';

const EXIT = { PASS: 0, FAIL: 1, INCONCLUSIVE: 2, INVALID: 3 };
const ADV_CLASS = 778001; // (778001,1)=sinyal A selesai; (778001,7)=izin commit
const HOST_ALLOWLIST = new Set(['127.0.0.1', 'localhost', '::1']);

const MODES = {
  tc03: {
    label: 'TC-03 wrapper x wrapper',
    setupFile: 'setup-tc03.sql',
    aFile: 'tc03-a.sql',
    bFile: 'tc03-b.sql',
    codePrefix: 'RB-TC03-',
    slugPrefix: 'rb-tc03-',
    qty: 3,
    s0Stock: 25,
    s0Sold: 5,
    bQueryNeedle: 'release_order_stock',
  },
  tc04: {
    label: 'TC-04 W4 webhook statement x verify statement',
    setupFile: 'setup-tc04.sql',
    aFile: 'tc04-webhook-a.sql',
    bFile: 'tc04-verify-b.sql',
    codePrefix: 'RB-TC04-',
    slugPrefix: 'rb-tc04-',
    qty: 3,
    s0Stock: 25,
    s0Sold: 5,
    bQueryNeedle: 'payment_status',
  },
};

const cfg = {
  host: process.env.PGHOST ?? '127.0.0.1',
  port: process.env.PGPORT ?? '54322',
  user: process.env.PGUSER ?? 'postgres',
  db: process.env.PGDATABASE ?? 'postgres',
  psql: process.env.PSQL ?? 'psql',
  gateTimeoutMs: Number(process.env.RB_RACE_GATE_TIMEOUT_MS ?? 30000),
  sessionTimeoutMs: Number(process.env.RB_RACE_SESSION_TIMEOUT_MS ?? 120000),
  terminateTimeoutMs: Number(process.env.RB_RACE_TERMINATE_TIMEOUT_MS ?? 5000),
  allowCustomDb: process.env.RB_RACE_ALLOW_CUSTOM_DB === '1',
};

const runTag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const taggedPattern = `rr-${runTag}-%`;
const appName = (suffix) => `rr-${runTag}-${suffix}`;
let dbTouched = false; // true setelah gate --execute lolos; dibaca main().catch (L1)

// ---------------------------------------------------------------------------
// Util & pengaman konfigurasi
// ---------------------------------------------------------------------------
function refuse(msg) {
  console.error(`[REFUSE] ${msg}`);
  process.exit(EXIT.INVALID);
}

function validateConfig() {
  if (!HOST_ALLOWLIST.has(cfg.host)) {
    refuse(
      `PGHOST='${cfg.host}' bukan host lokal. Harness ini HANYA boleh menyentuh ` +
        `PostgreSQL lokal (127.0.0.1/localhost/::1) — mis. Supabase V1 lokal. ` +
        `Koneksi ke database hosted/produksi ditolak.`,
    );
  }
  if (!/^\d{1,5}$/.test(cfg.port) || Number(cfg.port) < 1 || Number(cfg.port) > 65535) {
    refuse(`PGPORT='${cfg.port}' tidak valid.`);
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(cfg.user)) refuse(`PGUSER='${cfg.user}' tidak valid.`);
  if (!/^[A-Za-z0-9_.-]+$/.test(cfg.db)) refuse(`PGDATABASE='${cfg.db}' tidak valid.`);
  if (cfg.db !== 'postgres' && !cfg.allowCustomDb) {
    refuse(
      `PGDATABASE='${cfg.db}' bukan 'postgres'. Defaultlokal Supabase adalah 'postgres'. ` +
        `Set RB_RACE_ALLOW_CUSTOM_DB=1 bila memang disengaja (tetap wajib host lokal).`,
    );
  }
  if (!Number.isFinite(cfg.gateTimeoutMs) || cfg.gateTimeoutMs < 1000 || cfg.gateTimeoutMs > 300000) {
    refuse(`RB_RACE_GATE_TIMEOUT_MS='${process.env.RB_RACE_GATE_TIMEOUT_MS}' tidak wajar.`);
  }
  if (!Number.isFinite(cfg.sessionTimeoutMs) || cfg.sessionTimeoutMs < 5000 || cfg.sessionTimeoutMs > 600000) {
    refuse(`RB_RACE_SESSION_TIMEOUT_MS='${process.env.RB_RACE_SESSION_TIMEOUT_MS}' tidak wajar.`);
  }
  if (!Number.isFinite(cfg.terminateTimeoutMs) || cfg.terminateTimeoutMs < 500 || cfg.terminateTimeoutMs > 60000) {
    refuse(`RB_RACE_TERMINATE_TIMEOUT_MS='${process.env.RB_RACE_TERMINATE_TIMEOUT_MS}' tidak wajar (500..60000).`);
  }
  if (typeof cfg.psql !== 'string' || cfg.psql.trim() === '') refuse('PSQL kosong.');
}

function childEnv() {
  const env = { ...process.env, PGOPTIONS: '-c rebitess.race.harness=on', PGCONNECT_TIMEOUT: '10' };
  delete env.PGSERVICE;
  delete env.PGHOSTADDR;
  return env;
}

function conninfo(app) {
  return `host=${cfg.host} port=${cfg.port} user=${cfg.user} dbname=${cfg.db} application_name=${app}`;
}

// ---------------------------------------------------------------------------
// Eksekusi psql
// ---------------------------------------------------------------------------
class PsqlError extends Error {}

function execPsqlArgs(extraArgs, timeoutMs) {
  const r = spawnSync(cfg.psql, extraArgs, {
    env: childEnv(),
    encoding: 'utf8',
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.error) {
    throw new PsqlError(`psql tidak dapat dijalankan ('${cfg.psql}'): ${r.error.message}. Set PSQL ke path psql.exe.`);
  }
  if (r.status !== 0) {
    throw new PsqlError(`psql exit=${r.status}\n${(r.stderr || '').trim()}`);
  }
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function query(sql, vars = {}, app = 'probe') {
  const args = [conninfo(appName(app)), '-X', '-q', '-w', '-v', 'ON_ERROR_STOP=1', '-tA', '-F', SEP];
  for (const [k, v] of Object.entries(vars)) args.push('-v', `${k}=${v}`);
  args.push('-c', sql);
  const { stdout } = execPsqlArgs(args, 60000);
  return stdout
    .split(/\r?\n/)
    .filter((l) => l !== '')
    .map((l) => l.split(SEP));
}

function queryOne(sql, vars = {}, app = 'probe') {
  const rows = query(sql, vars, app);
  if (rows.length > 1) throw new PsqlError(`query mengembalikan ${rows.length} baris, diharapkan <=1`);
  return rows.length === 1 ? rows[0] : null;
}

function runSqlFile(file, vars = {}, app = 'ctl') {
  const args = [conninfo(appName(app)), '-X', '-q', '-w', '-v', 'ON_ERROR_STOP=1'];
  for (const [k, v] of Object.entries(vars)) args.push('-v', `${k}=${v}`);
  args.push('-f', path.join(SQL_DIR, file));
  return execPsqlArgs(args, 120000);
}

function parseEcho(text) {
  const map = {};
  for (const m of text.matchAll(/([a-z0-9_]+)=([^\s]+)/g)) map[m[1]] = m[2];
  return map;
}

// Boolean PostgreSQL: hasil cast ::text = 'true'/'false', hasil \gset =
// 't'/'f'. Normalisasi menerima keduanya; nilai tak dikenal dilempar dengan
// label diagnostik (dipakai fixture, gate, evaluasi, dan probe preflight).
const PG_BOOL_TRUE = new Set(['t', 'true']);
const PG_BOOL_FALSE = new Set(['f', 'false']);

function normalizePgBool(raw, label) {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (PG_BOOL_TRUE.has(v)) return true;
  if (PG_BOOL_FALSE.has(v)) return false;
  throw new Error(
    `nilai boolean PostgreSQL tak dikenal untuk ${label}: '${String(raw)}' (harapan: t/f/true/false)`,
  );
}

function isPgTrue(raw) {
  return typeof raw === 'string' && PG_BOOL_TRUE.has(raw.trim().toLowerCase());
}

function isPgBoolKnown(raw) {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return PG_BOOL_TRUE.has(v) || PG_BOOL_FALSE.has(v);
}

function clipText(s, max = 240) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}...` : t;
}

function sessionErr(session) {
  if (!session) return '';
  try {
    return clipText(session.err(), 240);
  } catch {
    return '';
  }
}

// Identitas run untuk teardown (L4): prefix adalah MODE; tag run harus
// muncul di kode/slug. Penolakan cepat di sisi klien — teardown.sql juga
// menolak sendiri (M2).
function runIdentityError(m, code, slug) {
  const tagUpper = runTag.toUpperCase();
  if (typeof code !== 'string' || !code.startsWith(`${m.codePrefix}${tagUpper}-`)) {
    return `order_code '${code}' tidak diawali '${m.codePrefix}${tagUpper}-'`;
  }
  if (typeof slug !== 'string' || !slug.startsWith(`${m.slugPrefix}${runTag}-`)) {
    return `slug '${slug}' tidak diawali '${m.slugPrefix}${runTag}-'`;
  }
  if (code.slice(-3) !== slug.slice(-3)) {
    return `sufiks iterasi tidak sama (order_code '${code.slice(-3)}' vs slug '${slug.slice(-3)}')`;
  }
  return null;
}

function startSession(file, vars, suffix) {
  const args = [conninfo(appName(suffix)), '-X', '-q', '-w', '-v', 'ON_ERROR_STOP=1'];
  for (const [k, v] of Object.entries(vars)) args.push('-v', `${k}=${v}`);
  args.push('-f', path.join(SQL_DIR, file));
  const child = spawn(cfg.psql, args, { env: childEnv(), windowsHide: true });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (d) => (stdout += d));
  child.stderr.on('data', (d) => (stderr += d));
  const done = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal })));
  return { app: appName(suffix), child, done, out: () => stdout, err: () => stderr };
}

function withTimeout(promise, ms, fallback) {
  return Promise.race([promise, delay(ms).then(() => fallback)]);
}

// ---------------------------------------------------------------------------
// Kueri gate & katalog
// ---------------------------------------------------------------------------
function qG0(vars) {
  return queryOne(
    `SELECT a.pid::text,
            COALESCE(a.state, ''),
            COALESCE(a.wait_event_type, ''),
            COALESCE(a.wait_event, ''),
            COALESCE(a.backend_xid::text, ''),
            (SELECT count(*)::text FROM pg_locks l WHERE l.pid = a.pid
               AND l.locktype = 'advisory' AND l.classid = ${ADV_CLASS} AND l.objid = 1
               AND l.objsubid = 2 AND l.granted),
            (SELECT count(*)::text FROM pg_locks l WHERE l.pid = a.pid
               AND l.locktype = 'advisory' AND l.classid = ${ADV_CLASS} AND l.objid = 7
               AND l.objsubid = 2 AND NOT l.granted),
            COALESCE((SELECT p.stock::text FROM public.products p WHERE p.slug = :'slug'), ''),
            COALESCE((SELECT (o.stock_reserved_at IS NOT NULL AND o.stock_released_at IS NULL)::text
                        FROM public.orders o WHERE o.order_code = :'order_code'), ''),
            COALESCE(array_to_string(pg_blocking_pids(a.pid), ','), '')
       FROM pg_stat_activity a
      WHERE a.application_name = :'app_a'`,
    vars,
  );
}

function qG1(vars) {
  return queryOne(
    `SELECT b.pid::text,
            COALESCE(b.wait_event_type, ''),
            COALESCE(b.wait_event, ''),
            COALESCE(b.query, ''),
            COALESCE((SELECT wl.transactionid::text FROM pg_locks wl
                       WHERE wl.pid = b.pid AND wl.locktype = 'transactionid' AND NOT wl.granted
                       LIMIT 1), ''),
            COALESCE((SELECT al.pid::text FROM pg_locks al
                       WHERE al.locktype = 'transactionid' AND al.granted
                         AND al.transactionid = (SELECT wl2.transactionid FROM pg_locks wl2
                                                  WHERE wl2.pid = b.pid AND wl2.locktype = 'transactionid'
                                                    AND NOT wl2.granted LIMIT 1)
                       LIMIT 1), ''),
            COALESCE((SELECT a2.backend_xid::text FROM pg_stat_activity a2
                       WHERE a2.application_name = :'app_a'), ''),
            COALESCE(array_to_string(pg_blocking_pids(b.pid), ','), '')
       FROM pg_stat_activity b
      WHERE b.application_name = :'app_b'`,
    vars,
  );
}

function qPermitHolderPid() {
  const row = queryOne(
    `SELECT l.pid::text FROM pg_locks l JOIN pg_stat_activity a USING (pid)
      WHERE l.locktype = 'advisory' AND l.classid = ${ADV_CLASS} AND l.objid = 7
        AND l.objsubid = 2 AND l.granted AND a.application_name = :'app_permit'`,
    { app_permit: appName('permit') },
  );
  return row ? row[0] : null;
}

function terminatePermitHolder() {
  return queryOne(
    `SELECT COALESCE(string_agg(pg_terminate_backend(l.pid)::text, ','), '') AS terminated
       FROM pg_locks l JOIN pg_stat_activity a USING (pid)
      WHERE l.locktype = 'advisory' AND l.classid = ${ADV_CLASS} AND l.objid = 7
        AND l.objsubid = 2 AND l.granted AND a.application_name = :'app_permit'`,
    { app_permit: appName('permit') },
  );
}

// PENTING: pola HARUS run-scoped (`rr-<tag>-%`). Jangan pernah memakai pola
// global 'rr-%' — sesi run lain / sisa milik tag lain TIDAK boleh dihentikan
// (temuan audit M1); preflight menolaknya sebagai INVALID + instruksi manual.
function terminateTagged(pattern) {
  const row = queryOne(
    `SELECT COALESCE(string_agg(pg_terminate_backend(pid)::text, ','), '') AS terminated
       FROM pg_stat_activity
      WHERE application_name LIKE :'pattern' AND pid <> pg_backend_pid()`,
    { pattern },
  );
  return row ? row[0] : '';
}

// F7: nilai boolean pg_terminate_backend BUKAN sumber kebenaran cleanup sesi
// (false sering berarti pid sudah hilang lebih dulu). Sumber kebenaran adalah
// keberadaan sesi ber-tag run ini di pg_stat_activity. `pid <> pg_backend_pid()`
// mengecualikan koneksi probe yang menjalankan query ini sendiri; probe lain
// tidak pernah berjalan paralel (semua pemanggilan sekuensial).
const SESSION_COUNT_SQL = `SELECT count(*)::text FROM pg_stat_activity
 WHERE application_name LIKE :'pattern' AND pid <> pg_backend_pid()`;

function countTaggedSessions(pattern) {
  const row = queryOne(SESSION_COUNT_SQL, { pattern });
  return row ? row[0] : '';
}

// Polling terbatas: '0' = terverifikasi hilang. Nilai '' (tak terbaca) atau
// >0 setelah tenggat bukan keberhasilan.
async function verifyTaggedSessionsGone(pattern, timeoutMs) {
  const res = await waitFor(() => countTaggedSessions(pattern), (v) => v === '0', timeoutMs);
  return { ok: res.ok, remaining: typeof res.last === 'string' ? res.last : '' };
}

function qFixture(code) {
  const row = queryOne(
    `SELECT o.order_status, o.payment_status, o.quantity::text,
            (o.stock_reserved_at IS NOT NULL)::text,
            (o.stock_released_at IS NOT NULL)::text,
            p.stock::text, p.sold_count::text, p.status
       FROM public.orders o JOIN public.products p ON p.slug = o.product_slug
      WHERE o.order_code = :'order_code'`,
    { order_code: code },
  );
  if (!row) return null;
  const [ord, pay, qty, reserved, released, stock, sold, pstatus] = row;
  return { ord, pay, qty, reserved, released, stock, sold, pstatus };
}

async function waitFor(fn, ok, timeoutMs, intervalMs = 150) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = fn();
    if (last && ok(last)) return { ok: true, last };
    await delay(intervalMs);
  }
  return { ok: false, last };
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------
function preflight() {
  return preflightAsync();
}

async function preflightAsync() {
  const ver = spawnSync(cfg.psql, ['--version'], { env: childEnv(), encoding: 'utf8', windowsHide: true });
  if (ver.error) {
    console.error(`[INVALID] psql tidak ditemukan ('${cfg.psql}'): ${ver.error.message}`);
    return EXIT.INVALID;
  }
  const probe = queryOne(
    `SELECT current_database(),
            current_setting('default_transaction_isolation'),
            current_setting('server_version_num'),
            (to_regclass('public.orders') IS NOT NULL
              AND to_regprocedure('public.release_order_stock(text)') IS NOT NULL)::text`,
  );
  if (!probe) {
    console.error('[INVALID] probe prasyarat mengembalikan 0 baris.');
    return EXIT.INVALID;
  }
  const [db, iso, sv, ready] = probe;
  console.log(
    `[preflight] host=${cfg.host}:${cfg.port} db=${db} server=${sv} ` +
      `default_transaction_isolation='${iso}' psql='${cfg.psql}' (${(ver.stdout || '').trim()})`,
  );
  if (db !== cfg.db) {
    console.error(`[INVALID] current_database()='${db}' tidak sama dengan PGDATABASE='${cfg.db}'.`);
    return EXIT.INVALID;
  }
  if (iso !== 'read committed') {
    console.error(
      `[INVALID] default_transaction_isolation='${iso}' — jalankan pada klaster READ COMMITTED ` +
        '(spesifikasi TC-03). Di bawah REPEATABLE READ, panggilan kedua error serialisasi 40001.',
    );
    return EXIT.INVALID;
  }
  let readyOk;
  try {
    readyOk = normalizePgBool(ready, 'probe kesiapan skema (orders/release_order_stock)') === true;
  } catch (e) {
    console.error(`[INVALID] ${e.message}`);
    return EXIT.INVALID;
  }
  if (!readyOk) {
    console.error('[INVALID] public.orders / public.release_order_stock(text) tidak ditemukan — migration belum lengkap?');
    return EXIT.INVALID;
  }
  const leftovers = queryOne(
    `SELECT COALESCE(string_agg(DISTINCT a.application_name || ':' || a.pid::text, ', '), '')
       FROM pg_locks l JOIN pg_stat_activity a USING (pid)
      WHERE l.locktype = 'advisory' AND l.classid = ${ADV_CLASS} AND l.objsubid = 2`,
  );
  const leftStr = leftovers ? leftovers[0] : '';
  if (leftStr !== '') {
    const holders = leftStr.split(',').map((s) => s.trim()).filter(Boolean);
    const foreign = holders.filter((h) => !h.split(':')[0].startsWith('rr-'));
    console.error(
      `[INVALID] advisory lock (${ADV_CLASS},*) masih dipegang: ${holders.join(', ')}. ` +
        (foreign.length > 0
          ? `Sesi BUKAN milik harness: ${foreign.join(', ')}.`
          : 'Semua ber-prefix rr- (sesi harness), tetapi kepemilikan run-nya TIDAK dapat dipastikan dari katalog.'),
    );
    console.error(
      '[INVALID] Preflight tidak pernah mematikan sesi. Periksa manual lalu hentikan HANYA bila yakin itu sisa run yang sudah mati: ' +
        `SELECT a.pid, a.application_name, a.state, a.query_start FROM pg_locks l JOIN pg_stat_activity a USING (pid) ` +
        `WHERE l.locktype = 'advisory' AND l.classid = ${ADV_CLASS} AND l.objsubid = 2; ` +
        'Jika aman: SELECT pg_terminate_backend(<pid>); lalu jalankan ulang harness.',
    );
    return EXIT.INVALID;
  }
  console.log(`[preflight] runTag=${runTag}; tag sesi=${taggedPattern}; OK.`);
  return null;
}

// ---------------------------------------------------------------------------
// Evaluasi satu iterasi (L1–L4)
// ---------------------------------------------------------------------------
function evaluate(modeKey, m, ctx) {
  const { g0, g1, s0, s1, aRes, bRes, aKv, bKv } = ctx;
  if (!g0.ok || !g1.ok) {
    return { status: 'INCONCLUSIVE', note: `gate tidak teramati (G0=${g0.ok ? 'ok' : 'miss'}, G1=${g1.ok ? 'ok' : 'miss'})` };
  }
  if (aRes === null || bRes === null) {
    return { status: 'INCONCLUSIVE', note: 'sesi tidak selesai dalam tenggat (statement timeout/koneksi putus = L4)' };
  }
  if (aRes.code !== 0 || bRes.code !== 0) {
    return { status: 'INCONCLUSIVE', note: `psql exit A=${aRes.code} B=${bRes.code} (lihat stderr)` };
  }
  if (!s1) return { status: 'INCONCLUSIVE', note: 're-read pasca-balapan tidak menemukan baris order' };
  if (aKv.a_iso !== 'read_committed' || bKv.b_iso !== 'read_committed') {
    return { status: 'INVALID_CONFIG', note: `isolasi sesi bukan READ COMMITTED (A='${aKv.a_iso}', B='${bKv.b_iso}')` };
  }
  const keysOk = modeKey === 'tc03'
    ? aKv.a_released !== undefined && bKv.b_released !== undefined
    : aKv.a_rowcount !== undefined && bKv.b_rowcount !== undefined;
  if (!keysOk) {
    return { status: 'INCONCLUSIVE', note: 'output sesi tidak lengkap (nilai balik/rowcount tidak terbaca — L1 tak dapat diverifikasi)' };
  }
  const expectStock = Number(s0.stock) + m.qty;
  const expectSold = Math.max(0, Number(s0.sold) - m.qty);
  const stockOk = Number(s1.stock) === expectStock;
  const soldOk = Number(s1.sold) === expectSold;
  let markerOk;
  try {
    // s1.released berasal dari cast ::text → 'true'/'false' (dinormalisasi).
    markerOk = normalizePgBool(s1.released, 's1.stock_released_at (re-read)') === true;
  } catch (e) {
    return { status: 'INCONCLUSIVE', note: `format boolean tak dikenal pada hasil akhir: ${e.message}` };
  }
  const delta = `stok ${s0.stock}->${s1.stock} (harap ${expectStock}), sold ${s0.sold}->${s1.sold} (harap ${expectSold}), marker=${s1.released}`;

  if (modeKey === 'tc03') {
    if (aKv.a_committed !== 't' || bKv.b_committed !== 't') {
      return { status: 'INCONCLUSIVE', note: `transaksi sesi tidak selesai bersih (A=${aKv.a_committed}, B=${bKv.b_committed})` };
    }
    let aReleased;
    let bReleased;
    try {
      // Nilai balik wrapper via \gset (bukan ::text) → format 't'/'f'.
      aReleased = normalizePgBool(aKv.a_released, 'a_released (nilai balik wrapper A)');
      bReleased = normalizePgBool(bKv.b_released, 'b_released (nilai balik wrapper B)');
    } catch (e) {
      return { status: 'INCONCLUSIVE', note: `format nilai balik sesi tak dikenal: ${e.message}` };
    }
    if (aReleased === true && bReleased === false && stockOk && soldOk && markerOk) {
      return { status: 'PASS', note: `A=true B=false ΔS=+${m.qty} sekali (L3 ok)` };
    }
    return {
      status: 'ANOMALY',
      note: `matriks tak terduga: a_released=${aKv.a_released} b_released=${bKv.b_released} ${delta}`,
    };
  }

  // tc04
  if (aKv.a_committed !== 't' || bKv.b_committed !== 't') {
    return { status: 'INCONCLUSIVE', note: `transaksi sesi tidak selesai bersih (A=${aKv.a_committed}, B=${bKv.b_committed})` };
  }
  const rcA = aKv.a_rowcount;
  const rcB = bKv.b_rowcount;
  if (rcA === '1' && rcB === '0' && stockOk && soldOk && markerOk) {
    return { status: 'PASS', note: `pemenang=webhook (rc 1 vs 0), ΔS=+${m.qty} sekali (L3 ok)` };
  }
  return {
    status: 'ANOMALY',
    note: `matriks tak terduga: a_rowcount=${rcA} b_rowcount=${rcB} ${delta} (harap tepat satu pemenang, ΔS=+${m.qty})`,
  };
}

// ---------------------------------------------------------------------------
// Satu iterasi
// ---------------------------------------------------------------------------
async function runIteration(modeKey, m, i) {
  const iter = String(i).padStart(2, '0');
  const user_id = randomUUID();
  const code = `${m.codePrefix}${runTag.toUpperCase()}-${iter}`;
  const slug = `${m.slugPrefix}${runTag}-${iter}`;
  const vars = {
    user_id,
    email: `race-${runTag}-${iter}@example.test`,
    business: `Race ${modeKey.toUpperCase()} ${runTag} ${iter}`,
    slug,
    order_code: code,
    qty: String(m.qty),
  };
  const twinVars = { ...vars, invoice_id: `race-inv-${runTag}-${iter}` };
  const result = { iter: i, status: 'INCONCLUSIVE', note: '', g0ev: null, g1ev: null };
  const sessions = {};
  let s0 = null;
  // F5: true hanya bila fixture sudah tervalidasi (order+produk ter-commit).
  // Dipakai saat teardown untuk membedakan "fixture memang tidak ada" dari
  // "fixture hilang sebelum teardown" (klaim clean tidak boleh vacuous).
  let fixtureValidated = false;

  try {
    try {
      runSqlFile(m.setupFile, vars, 'setup');
    } catch (e) {
      throw new Error(`SETUP GAGAL: ${e.message}`);
    }
    s0 = qFixture(code, 'setupcheck');
    if (!s0) throw new Error(`validasi fixture GAGAL: order ${code} tidak ditemukan setelah setup`);
    let s0Reserved;
    let s0Released;
    try {
      // qFixture memakai cast ::text → 'true'/'false' (dinormalisasi; B1).
      s0Reserved = normalizePgBool(s0.reserved, 's0.stock_reserved_at terisi');
      s0Released = normalizePgBool(s0.released, 's0.stock_released_at terisi');
    } catch (e) {
      throw new Error(`validasi fixture GAGAL: ${e.message}`);
    }
    const baseOk =
      s0Reserved === true && s0Released === false && s0.ord === (modeKey === 'tc03' ? 'cancelled' : 'pending') &&
      s0.pay === 'unpaid' && Number(s0.stock) === m.s0Stock && Number(s0.sold) === m.s0Sold;
    if (!baseOk) throw new Error(`validasi fixture GAGAL: ${JSON.stringify(s0)} (harap stok=${m.s0Stock}, sold=${m.s0Sold})`);
    fixtureValidated = true;

    sessions.permit = startSession('permit-holder.sql', {}, 'permit');
    const permitWait = await waitFor(
      () => qPermitHolderPid(),
      (pid) => typeof pid === 'string' && pid !== '',
      cfg.gateTimeoutMs,
    );
    if (!permitWait.ok) throw new Error('permit-holder tidak memegang advisory lock (778001,7) dalam tenggat');

    sessions.a = startSession(m.aFile, twinVars, 'a');
    const g0 = await waitFor(
      () => qG0({ slug, order_code: code, app_a: appName('a') }),
      (r) =>
        r[1] === 'active' && r[2] === 'Lock' && r[3] === 'advisory' && r[4] !== '' &&
        r[5] === '1' && r[6] === '1' && r[7] === String(m.s0Stock) && isPgTrue(r[8]),
      cfg.gateTimeoutMs,
    );
    result.g0ev = g0.last
      ? `state=${g0.last[1]} wait=${g0.last[2]}/${g0.last[3]} xid=${g0.last[4]} sig1=${g0.last[5]} permitWait=${g0.last[6]} stock=${g0.last[7]} markerUnreleased=${g0.last[8]} blockers=[${g0.last[9]}]`
      : 'miss';
    if (!g0.ok) {
      const rawMarker = g0.last ? g0.last[8] : '';
      const markerHint =
        rawMarker !== '' && !isPgBoolKnown(rawMarker)
          ? ` — nilai marker tak dikenal dari PostgreSQL: '${rawMarker}'`
          : '';
      throw new Error(`gate G0 tidak teramati dalam ${cfg.gateTimeoutMs} ms${markerHint}`);
    }

    sessions.b = startSession(m.bFile, twinVars, 'b');
    const g1 = await waitFor(
      () => qG1({ app_a: appName('a'), app_b: appName('b') }),
      (r) =>
        String(r[0]) !== '' &&
        r[1] === 'Lock' &&
        r[2] === 'transactionid' &&
        r[3].includes(m.bQueryNeedle) &&
        r[4] !== '' &&
        r[4] === r[6] &&
        r[5] !== '' &&
        r[5] === g0.last[0],
      cfg.gateTimeoutMs,
    );
    result.g1ev = g1.last
      ? `b=${g1.last[0]} wait=${g1.last[1]}/${g1.last[2]} xid=${g1.last[4]} holder=${g1.last[5]} a_xid=${g1.last[6]} blockers=[${g1.last[7]}] query="…${String(g1.last[3]).replace(/\s+/g, ' ').slice(0, 80)}…"`
      : 'miss';
    if (!g1.ok) throw new Error(`gate G1 tidak teramati dalam ${cfg.gateTimeoutMs} ms`);

    terminatePermitHolder();
    const holderGone = await waitFor(
      () => queryOne(`SELECT count(*)::text FROM pg_stat_activity WHERE application_name = :'x'`, { x: appName('permit') }),
      (r) => r[0] === '0',
      cfg.gateTimeoutMs,
    );
    if (!holderGone.ok) throw new Error('permit-holder tidak berhenti setelah pg_terminate_backend (izin macet)');

    const aRes = await withTimeout(sessions.a.done, cfg.sessionTimeoutMs, null);
    const bRes = await withTimeout(sessions.b.done, cfg.sessionTimeoutMs, null);
    const aKv = aRes ? parseEcho(sessions.a.out()) : {};
    const bKv = bRes ? parseEcho(sessions.b.out()) : {};
    const aStderr = sessionErr(sessions.a);
    const bStderr = sessionErr(sessions.b);

    const s1 = qFixture(code, 'finalread');
    const verdict = evaluate(modeKey, m, { g0, g1, s0, s1, aRes, bRes, aKv, bKv });
    result.status = verdict.status;
    result.note = verdict.note;
    if (verdict.status !== 'PASS') {
      if (aStderr) result.note += ` | stderrA: ${aStderr}`;
      if (bStderr) result.note += ` | stderrB: ${bStderr}`;
    }
    result.s0 = s0;
    result.s1 = s1;
    result.aKv = aKv;
    result.bKv = bKv;
  } catch (e) {
    // INVALID bila setup/fixture gagal (prasyarat tak terpenuhi); selain itu
    // INCONCLUSIVE (L4: hasil tak-pasti).
    const msg = String(e.message);
    if (msg.startsWith('validasi fixture GAGAL') || msg.startsWith('SETUP GAGAL')) {
      result.status = 'INVALID';
    } else {
      result.status = 'INCONCLUSIVE';
    }
    result.note = msg;
    // L2: sertakan stderr sesi A/B yang relevan (bila ada), dibatasi 240 char.
    const aErr = sessionErr(sessions.a);
    const bErr = sessionErr(sessions.b);
    if (aErr) result.note += ` | stderrA: ${aErr}`;
    if (bErr) result.note += ` | stderrB: ${bErr}`;
  } finally {
    // Cleanup TERPISAH dari hasil race: kegagalan di sini TIDAK mengubah
    // result.status (bukti race tidak ditutupi), tetapi membuat cleanup.ok
    // false sehingga keseluruhan tidak boleh dilaporkan PASS.
    result.cleanup = { ok: true, reason: '' };
    const cleanupFail = (reason) => {
      result.cleanup.ok = false;
      result.cleanup.reason = result.cleanup.reason ? `${result.cleanup.reason}; ${reason}` : reason;
    };
    // F7: terminate best-effort; hasil boolean hanya untuk diagnostik.
    // Sumber kebenaran = verifikasi keberadaan sesi ber-tag run ini (polling
    // terbatas). Sesi yang sudah hilang tetap dianggap terverifikasi meskipun
    // pg_terminate_backend mengembalikan 'f'.
    let terminateRaw = '';
    let terminateErr = null;
    try {
      terminateRaw = terminateTagged(taggedPattern);
    } catch (e) {
      terminateErr = e;
    }
    const terminateInfo = terminateErr
      ? `terminate error: ${clipText(terminateErr.message, 160)}`
      : `terminate=${terminateRaw || 'tidak ada sesi'}`;
    try {
      const gone = await verifyTaggedSessionsGone(taggedPattern, cfg.terminateTimeoutMs);
      const remaining = gone.remaining === '' ? 'tak terbaca' : gone.remaining;
      result.sessionCleanup = { verifiedGone: gone.ok, remaining: gone.ok ? '0' : remaining, terminate: terminateInfo };
      if (!gone.ok) {
        cleanupFail(`sesi harness masih aktif setelah terminate (sisa=${remaining}; ${terminateInfo})`);
        result.note = `${result.note} | PERINGATAN: sesi harness belum terverifikasi hilang (sisa=${remaining})`.trim();
      } else if (terminateErr) {
        console.error(
          `[cleanup] iter ${iter}: PERINGATAN ${terminateInfo} — sesi diverifikasi hilang, cleanup sesi tetap OK.`,
        );
      } else if (terminateRaw.split(',').includes('f')) {
        console.log(
          `[cleanup] iter ${iter}: pg_terminate_backend=false untuk sesi yang sudah/telah hilang — verifikasi keberadaan '0' yang menentukan.`,
        );
      }
    } catch (e) {
      result.sessionCleanup = { verifiedGone: false, remaining: 'tak terbaca', terminate: terminateInfo, error: clipText(e.message, 160) };
      cleanupFail(`verifikasi sesi gagal dijalankan/tak terbaca: ${e.message}`);
      result.note = `${result.note} | PERINGATAN: verifikasi sesi tidak lengkap: ${e.message}`.trim();
    }
    try {
      // L4/M2: tolak teardown bila identitas tidak jelas milik run ini —
      // jangan pernah menghapus fixture run lain (teardown.sql juga menolak).
      const identErr = runIdentityError(m, code, slug);
      if (identErr) {
        cleanupFail(`teardown DILEWATI (identitas run tidak valid): ${identErr}`);
        result.note = `${result.note} | teardown DILEWATI (identitas run tidak valid): ${identErr}`.trim();
      } else {
        const td = runSqlFile(
          'teardown.sql',
          { order_code: code, slug, run_tag: runTag, code_prefix: m.codePrefix, slug_prefix: m.slugPrefix },
          'teardown',
        );
        const kv = parseEcho(td.stdout);
        result.teardown = {
          presentOrder: kv.teardown_present_order,
          presentProduct: kv.teardown_present_product,
          presentUmkm: kv.teardown_present_umkm,
          presentBuyer: kv.teardown_present_buyer,
          presentOwner: kv.teardown_present_owner,
          orders: kv.teardown_orders,
          products: kv.teardown_products,
          users: kv.teardown_users,
          activityLogs: kv.teardown_activity_logs,
          leftover: kv.teardown_leftover_orders,
          leftoverProducts: kv.teardown_leftover_products,
          leftoverUsers: kv.teardown_leftover_users,
          leftoverLogs: kv.teardown_leftover_logs,
          committed: kv.teardown_committed,
        };
        if (kv.teardown_committed !== 't') {
          cleanupFail('teardown tidak selesai COMMIT (teardown_committed bukan t)');
        }
        // F5: marker keberadaan fixture ('1'/'0'; selalu dicetak teardown).
        // Nilai yang tak terbaca = verifikasi tak lengkap, BUKAN bersih.
        const presenceKeys = ['order', 'product', 'umkm', 'buyer', 'owner'];
        const presenceBad = presenceKeys.filter(
          (k) => kv[`teardown_present_${k}`] !== '0' && kv[`teardown_present_${k}`] !== '1',
        );
        if (presenceBad.length > 0) {
          cleanupFail(
            `marker keberadaan fixture tak terbaca: ${presenceBad.map((k) => `teardown_present_${k}`).join(', ')}`,
          );
        } else {
          // Fixture yang tervalidasi saat setup WAJIB masih ada sebelum
          // teardown (hanya teardown ini yang menghapus order/produk fixture).
          // Hilang lebih dulu = intervensi luar → residu log tak dapat
          // dipastikan; teardown_products=0 TIDAK dianggap bukti bersih.
          if (fixtureValidated && kv.teardown_present_order !== '1') {
            cleanupFail('fixture order hilang sebelum teardown — cleanup tidak dapat diverifikasi penuh');
            result.note = `${result.note} | PERINGATAN: order fixture hilang sebelum teardown`.trim();
          }
          if (fixtureValidated && kv.teardown_present_product !== '1') {
            cleanupFail(
              'fixture produk hilang sebelum teardown — teardown_products=0 bukan bukti bersih (log produk tak dapat dipastikan)',
            );
            result.note = `${result.note} | PERINGATAN: produk fixture hilang sebelum teardown — cleanup tidak diklaim bersih`.trim();
          }
          // Konsistensi keberadaan → jumlah DELETE: baris yang ada di konteks
          // harus benar-benar terhapus oleh teardown (bukan 0).
          if (kv.teardown_present_order === '1' && kv.teardown_orders !== '1') {
            cleanupFail(`baris order ada di konteks tetapi teardown_orders=${kv.teardown_orders ?? 'tak terbaca'} (harus 1)`);
          }
          if (kv.teardown_present_product === '1' && kv.teardown_products !== '1') {
            cleanupFail(`baris produk ada di konteks tetapi teardown_products=${kv.teardown_products ?? 'tak terbaca'} (harus 1)`);
          }
        }
        // Echo yang tidak terbaca (undefined) = verifikasi tak lengkap,
        // BUKAN bersih: hanya nilai persis '0' yang dianggap lolos.
        const leftoverBad = [
          ['orders', kv.teardown_leftover_orders],
          ['products', kv.teardown_leftover_products],
          ['users', kv.teardown_leftover_users],
          ['activity_logs', kv.teardown_leftover_logs],
        ].filter(([, v]) => v !== '0');
        if (leftoverBad.length > 0) {
          const detail = leftoverBad.map(([k, v]) => `${k}=${v ?? 'tak terbaca'}`).join(', ');
          cleanupFail(`sisa fixture run ini belum nol/terverifikasi: ${detail}`);
          result.note = `${result.note} | PERINGATAN: cleanup belum bersih — ${detail} (tag ${runTag})`.trim();
        }
      }
    } catch (e) {
      cleanupFail(`teardown gagal: ${e.message}`);
      result.note = `${result.note} | teardown gagal: ${e.message}`.trim();
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Argumen & mode
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = { mode: null, iterations: 10, execute: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode') opts.mode = argv[++i];
    else if (a === '--iterations') opts.iterations = Number(argv[++i]);
    else if (a === '--execute') opts.execute = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else refuse(`argumen tidak dikenal: ${a}`);
  }
  return opts;
}

function printHelp() {
  console.log(
    [
      'Harness balapan rilis stok (TC-03 / TC-04 W4) — Supabase V1 lokal.',
      '',
      'Pemakaian:',
      '  node scripts/stock-release-race/run-race.mjs --mode tc03 [--iterations 10] [--execute]',
      '  node scripts/stock-release-race/run-race.mjs --mode tc04 [--iterations 10] [--execute]',
      '',
      'Tanpa --execute = DRY-RUN (tidak ada koneksi DB).',
      'Host hanya 127.0.0.1/localhost/::1; dbname default postgres; port default 54322.',
      'Timeout opsional: RB_RACE_GATE_TIMEOUT_MS, RB_RACE_SESSION_TIMEOUT_MS,',
      'RB_RACE_TERMINATE_TIMEOUT_MS (verifikasi sesi hilang setelah terminate).',
    ].join('\n'),
  );
}

function printDryRun(opts, m) {
  console.log('[DRY-RUN] Tidak ada koneksi DB yang dilakukan (tambahkan --execute untuk menjalankan).');
  console.log(`  mode            : ${opts.mode} (${m.label})`);
  console.log(`  target          : host=${cfg.host}:${cfg.port} db=${cfg.db} user=${cfg.user} psql='${cfg.psql}'`);
  console.log(`  iterasi         : ${opts.iterations} (maks 50; gate timeout ${cfg.gateTimeoutMs} ms; verifikasi sesi ${cfg.terminateTimeoutMs} ms)`);
  console.log(`  fixture         : kode '${m.codePrefix}<TAG>-NN', slug '${m.slugPrefix}<tag>-NN' (prefix=MODE; run ini tag '${runTag}')`);
  console.log(`  alur per iterasi: setup (COMMIT) → permit-holder → A → gate G0 → B → gate G1 → lepas izin → tunggu commit → re-read → teardown`);
  console.log('  pengaman        : tolak host nonlokal; cleanup hanya baris fixture bertag run (kode/slug eksak; activity_logs via target id + metadata eksak) dan sesi rr-<tag>-*; sesi diverifikasi hilang dengan polling terbatas; preflight tidak mematikan sesi (INVALID + instruksi manual bila ada sisa); keseluruhan tidak pernah PASS bila cleanup/sesi gagal atau tak terverifikasi; sesi/lock asing tidak digagalkan');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return EXIT.PASS;
  }
  if (!opts.mode) {
    printHelp();
    console.error('[REFUSE] --mode wajib diisi (tc03|tc04).');
    return EXIT.INVALID;
  }
  const m = MODES[opts.mode];
  if (!m) refuse(`mode tidak dikenal: ${opts.mode}`);
  if (!Number.isInteger(opts.iterations) || opts.iterations < 1 || opts.iterations > 50) {
    refuse(`--iterations harus bilangan bulat 1..50 (diberikan ${opts.iterations}).`);
  }
  validateConfig();
  if (!opts.execute) {
    printDryRun(opts, m);
    return EXIT.PASS;
  }
  dbTouched = true; // L1: sejak titik ini jalur FATAL boleh membersihkan sesi run ini saja
  const pre = await preflight();
  if (pre !== null) return pre;

  const results = [];
  let aborted = false;
  // F6: hasil verifikasi cleanup akhir (run-scoped). Kegagalan yang dapat
  // diatribusikan ke tag run ini menurunkan overall; sesi/lock asing TIDAK.
  const finalCleanup = { ok: true, reason: '' };
  const finalCleanupFail = (reason) => {
    finalCleanup.ok = false;
    finalCleanup.reason = finalCleanup.reason ? `${finalCleanup.reason}; ${reason}` : reason;
    console.error(`[cleanup] FINAL GAGAL: ${reason}`);
  };
  try {
    for (let i = 1; i <= opts.iterations; i++) {
      const r = await runIteration(opts.mode, m, i);
      results.push(r);
      console.log(`[iter ${String(i).padStart(2, '0')}] ${r.status} — ${r.note}`);
      if (r.g0ev) console.log(`           G0: ${r.g0ev}`);
      if (r.g1ev) console.log(`           G1: ${r.g1ev}`);
      if (r.teardown) console.log(`           teardown: ${JSON.stringify(r.teardown)}`);
      if (r.cleanup) console.log(`           cleanup : ${r.cleanup.ok ? 'OK' : `GAGAL — ${r.cleanup.reason}`}`);
      if (r.status === 'ANOMALY') {
        console.error('[STOP] anomali keras — loop dihentikan (spec: jangan retry pada siklus sama; catat bukti).');
        aborted = true;
        break;
      }
      if (r.status === 'INVALID' || r.status === 'INVALID_CONFIG') {
        console.error('[STOP] iterasi tidak memenuhi prasyarat (fixture/isolasi) — batalkan.');
        aborted = true;
        break;
      }
    }
  } finally {
    // F6: sweep akhir + verifikasi run-scoped. Hanya kegagalan yang dapat
    // diatribusikan ke tag run ini yang menurunkan status akhir; sesi atau
    // advisory lock asing TIDAK dibunuh dan TIDAK menggagalkan run (kelas
    // lock yang sama bisa dipakai proses lain secara sah).
    let terminateRaw = '';
    let terminateErr = null;
    try {
      terminateRaw = terminateTagged(taggedPattern); // hanya sesi bertag run ini; pola global 'rr-%' tidak pernah dipakai
    } catch (e) {
      terminateErr = e;
    }
    const terminateInfo = terminateErr
      ? `terminate error: ${clipText(terminateErr.message, 160)}`
      : `terminate=${terminateRaw || 'tidak ada sesi'}`;
    if (terminateRaw !== '') console.log(`[cleanup] sesi harness dihentikan: ${terminateRaw}`);
    if (terminateErr) console.error(`[cleanup] PERINGATAN ${terminateInfo} — verifikasi sesi terpisah tetap dijalankan.`);
    try {
      const gone = await verifyTaggedSessionsGone(taggedPattern, cfg.terminateTimeoutMs);
      if (!gone.ok) {
        const remaining = gone.remaining === '' ? 'tak terbaca' : gone.remaining;
        finalCleanupFail(`sesi bertag run masih aktif setelah sweep akhir (sisa=${remaining}; ${terminateInfo})`);
      }
    } catch (e) {
      finalCleanupFail(`verifikasi sesi akhir gagal dijalankan/tak terbaca: ${e.message}`);
    }
    try {
      const holders = queryOne(
        `SELECT COALESCE(string_agg(a.application_name || ':' || a.pid::text, ','), '')
           FROM pg_locks l JOIN pg_stat_activity a USING (pid)
          WHERE l.locktype = 'advisory' AND l.classid = ${ADV_CLASS} AND l.objsubid = 2`,
      );
      const list = holders && holders[0] ? holders[0].split(',').map((s) => s.trim()).filter(Boolean) : [];
      const ownPrefix = `rr-${runTag}-`;
      const own = list.filter((h) => h.split(':')[0].startsWith(ownPrefix));
      const foreign = list.filter((h) => !h.split(':')[0].startsWith(ownPrefix));
      if (own.length > 0) {
        finalCleanupFail(`advisory lock (${ADV_CLASS},*) masih dipegang sesi run ini: ${own.join(', ')}`);
      }
      if (foreign.length > 0) {
        console.error(
          `[cleanup] PERINGATAN: advisory lock (${ADV_CLASS},*) dipegang sesi asing: ${foreign.join(', ')} — ` +
            'bukan milik run ini; tidak dihentikan dan tidak menggagalkan status. Periksa manual bila perlu.',
        );
      }
    } catch (e) {
      finalCleanupFail(`pemeriksaan advisory akhir gagal dijalankan/tak terbaca: ${e.message}`);
    }
  }

  const anyAnomaly = results.some((r) => r.status === 'ANOMALY');
  const anyInvalid = results.some((r) => r.status === 'INVALID' || r.status === 'INVALID_CONFIG');
  const anyInconclusive = results.some((r) => r.status === 'INCONCLUSIVE');
  // Cleanup TERPISAH dari status race per-iterasi: kegagalan teardown /
  // verifikasi sisa yang tak lengkap TIDAK mengubah status race, tetapi
  // keseluruhan TIDAK boleh dilaporkan PASS.
  const cleanupFail = results.filter((r) => !r.cleanup || r.cleanup.ok !== true);
  let overall = 'PASS';
  if (anyAnomaly) overall = 'FAIL';
  else if (anyInvalid) overall = 'INVALID';
  else if (anyInconclusive || aborted || results.length < opts.iterations) overall = 'INCONCLUSIVE';
  else if (cleanupFail.length > 0 || !finalCleanup.ok) overall = 'INCONCLUSIVE';
  if (cleanupFail.length > 0) {
    console.error(
      `[cleanup] ${cleanupFail.length}/${results.length} iterasi cleanup gagal/tak lengkap — fixture TIDAK diklaim bersih ` +
        '(status race per-iterasi tidak diubah; keseluruhan tidak pernah PASS).',
    );
    for (const r of cleanupFail) {
      console.error(
        `[cleanup]   iter ${String(r.iter).padStart(2, '0')}: ${r.cleanup ? r.cleanup.reason : 'status cleanup tak tercatat'}`,
      );
    }
  }

  if (!finalCleanup.ok) {
    console.error(
      `[cleanup] verifikasi akhir run ini GAGAL: ${finalCleanup.reason} — PASS tidak boleh diberikan untuk run ini.`,
    );
  }

  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(`SUMMARY mode=${opts.mode} diminta=${opts.iterations} dijalankan=${results.length} ` +
    `pass=${count('PASS')} anomaly=${count('ANOMALY')} inconclusive=${count('INCONCLUSIVE')} ` +
    `invalid=${count('INVALID') + count('INVALID_CONFIG')} cleanup_fail=${cleanupFail.length} ` +
    `final_cleanup=${finalCleanup.ok ? 'OK' : 'GAGAL'} status=${overall}`);
  // Bukti JSON: struktur per-iterasi dipertahankan (iter/status/cleanup/
  // sessionCleanup/note/teardown) + satu entri verifikasi akhir run-scoped.
  // Kegagalan akhir selalu tampil sebagai cleanup.ok=false pada iter 'final'.
  const evidence = results.map((r) => ({
    iter: r.iter,
    status: r.status,
    cleanup: r.cleanup,
    sessionCleanup: r.sessionCleanup,
    note: r.note,
    teardown: r.teardown,
  }));
  evidence.push({
    iter: 'final',
    phase: 'final_cleanup',
    cleanup: finalCleanup,
    note: finalCleanup.ok
      ? `sesi bertag run terverifikasi hilang; advisory lock run ini: 0 (timeout ${cfg.terminateTimeoutMs} ms)`
      : finalCleanup.reason,
  });
  console.log(JSON.stringify(evidence, null, 2));
  if (overall === 'PASS') {
    console.log(
      `Catatan: PASS menuntut ${opts.iterations}/${opts.iterations} iterasi dengan gate teramati + matriks konsisten, ` +
        'DAN seluruh iterasi cleanup-nya terverifikasi bersih (termasuk verifikasi sesi/lock bertag run setelah sweep akhir). ' +
        'Ini bukti kuat pada klaster lokal saat dijalankan, bukan pembuktian formal untuk seluruh lingkungan.',
    );
  } else if (overall === 'INCONCLUSIVE') {
    console.log('Catatan: hasil TIDAK dapat diklaim (gate/timeout/kondisi tak-pasti). Jangan menarik kesimpulan keamanan.');
    if (cleanupFail.length > 0) {
      console.log('Catatan: ada iterasi dengan cleanup gagal/tak lengkap — fixture TIDAK diklaim bersih (lihat baris [cleanup]).');
    }
    if (!finalCleanup.ok) {
      console.log('Catatan: verifikasi cleanup akhir run ini gagal/tak lengkap — sesi/lock tidak diklaim bersih (lihat [cleanup] FINAL).');
    }
  }
  return EXIT[overall];
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`[FATAL] ${e.stack || e.message}`);
    // L1: hanya sentuh DB bila mode execute benar-benar sudah membuka koneksi;
    // dry-run/argumen invalid tidak pernah menghentikan backend siapa pun.
    if (dbTouched) {
      try {
        terminateTagged(taggedPattern); // hanya sesi bertag run ini
      } catch {
        /* best effort */
      }
    } else {
      console.error('[cleanup] dilewati: belum ada koneksi DB yang dibuka (dry-run/argumen).');
    }
    process.exit(EXIT.INVALID);
  });
