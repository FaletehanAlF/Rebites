/**
 * Harness lokal untuk logika tampilan Activity Log / Audit Trail admin.
 *
 * Membuktikan tanpa database:
 * - Ringkasan tindakan diturunkan dari action + metadata nyata (tidak mengarang).
 * - Status/hasil hanya muncul bila datanya tersedia.
 * - Pencarian mencakup admin, tindakan, target, ringkasan, hasil, dan alasan.
 *
 * Jalankan: node --test tests/admin-audit-summary.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  auditOutcome,
  describeAuditAction,
  describeAuditTarget,
  matchesAuditQuery,
  type AuditRowLike,
} from '../app/components/admin/admin-format.ts';

function row(partial: Partial<AuditRowLike>): AuditRowLike {
  return {
    adminName: 'Admin Satu',
    adminEmail: 'admin@rebites.id',
    action: 'resolve_report',
    targetType: 'report',
    targetId: '12345678-aaaa-bbbb-cccc-1234567890ab',
    reason: null,
    metadata: {},
    ...partial,
  };
}

test('describeAuditAction: resolusi/dismiss memakai from/to status', () => {
  assert.equal(
    describeAuditAction(
      row({ action: 'resolve_report', metadata: { from_status: 'reviewing', to_status: 'resolved' } })
    ),
    'Laporan diselesaikan (Ditinjau → Selesai)'
  );
  assert.equal(
    describeAuditAction(
      row({ action: 'dismiss_report', metadata: { from_status: 'open', to_status: 'dismissed' } })
    ),
    'Laporan ditolak (Terbuka → Ditolak)'
  );
  // Tanpa metadata -> tanpa detail karangan.
  assert.equal(describeAuditAction(row({ action: 'resolve_report', metadata: {} })), 'Laporan diselesaikan');
});

test('describeAuditAction: peringatan, sanksi, dan status akun', () => {
  assert.equal(
    describeAuditAction(row({ action: 'issue_warning', metadata: { warning_level: 2 } })),
    'Peringatan tingkat 2/3 diterbitkan'
  );
  assert.equal(
    describeAuditAction(row({ action: 'issue_sanction', metadata: { sanction_type: 'suspend' } })),
    'Sanksi Penangguhan diterbitkan'
  );
  assert.equal(
    describeAuditAction(
      row({ action: 'ban_user', metadata: { old_status: 'active', new_status: 'banned' } })
    ),
    'Status akun diubah (Aktif → Diblokir)'
  );
  // Action tak dikenal -> fallback labelAudit, bukan kosong.
  assert.equal(describeAuditAction(row({ action: 'custom_action' })), 'Custom Action');
});

test('auditOutcome: hanya dari data yang tersedia', () => {
  assert.deepEqual(
    auditOutcome(row({ metadata: { to_status: 'resolved' } })),
    { label: 'Selesai', tone: 'success' }
  );
  assert.deepEqual(
    auditOutcome(row({ metadata: { to_status: 'dismissed' } })),
    { label: 'Ditolak', tone: 'secondary' }
  );
  assert.deepEqual(
    auditOutcome(row({ action: 'ban_user', metadata: { new_status: 'banned' } })),
    { label: 'Diblokir', tone: 'destructive' }
  );
  assert.deepEqual(
    auditOutcome(row({ action: 'issue_warning', metadata: { warning_level: 3 } })),
    { label: 'Peringatan 3/3', tone: 'warning' }
  );
  assert.deepEqual(
    auditOutcome(row({ action: 'issue_sanction', metadata: { sanction_type: 'ban' } })),
    { label: 'Pemblokiran', tone: 'destructive' }
  );
  // Tidak ada bukti hasil -> null (jangan menampilkan status palsu).
  assert.equal(auditOutcome(row({ action: 'resolve_report', metadata: {} })), null);
});

test('describeAuditTarget: label tipe + ID pendek', () => {
  assert.equal(
    describeAuditTarget(row({ targetType: 'report', targetId: 'abcdefgh-1234' })),
    'Laporan · abcdefgh…'
  );
  assert.equal(describeAuditTarget(row({ targetType: 'user', targetId: null })), 'Pengguna');
});

test('matchesAuditQuery: mencari lintas field yang tampil', () => {
  const item = row({
    adminName: 'Budi Admin',
    adminEmail: 'budi@rebites.id',
    action: 'issue_warning',
    targetType: 'user',
    targetId: '99999999-dead-beef-0000-000000000000',
    reason: 'Spam berulang',
    metadata: { warning_level: 3 },
  });
  assert.equal(matchesAuditQuery(item, ''), true);
  assert.equal(matchesAuditQuery(item, 'budi'), true);
  assert.equal(matchesAuditQuery(item, 'budi@rebites.id'), true);
  assert.equal(matchesAuditQuery(item, 'peringatan'), true);
  assert.equal(matchesAuditQuery(item, 'spam'), true);
  assert.equal(matchesAuditQuery(item, '99999999'), true);
  assert.equal(matchesAuditQuery(item, 'pengguna'), true);
  assert.equal(matchesAuditQuery(item, 'tidak-ada'), false);
});
