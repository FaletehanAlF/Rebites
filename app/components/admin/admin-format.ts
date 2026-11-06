/**
 * Pembantu format dan label yang dipakai bersama oleh seluruh halaman admin.
 * Tujuannya agar tanggal, nominal, dan istilah status tampil sama persis
 * di semua tabel, drawer, dan notifikasi.
 */

/**
 * Zona waktu tampilan admin.
 *
 * Semua waktu yang ditampilkan berasal dari kolom `timestamptz` database
 * (created_at / reviewed_at / ...) yang sudah berupa ISO-8601 dengan offset.
 * Tanpa `timeZone` eksplisit, Intl memakai zona waktu browser, sehingga dua
 * admin di laptop berbeda bisa melihat jam yang berbeda untuk satu baris yang
 * sama. Pin ke WIB supaya panel admin selalu konsisten dengan pasarannya.
 */
export const ZONA_WAKTU_ADMIN = 'Asia/Jakarta';

const TANGGAL_PENDEK = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: ZONA_WAKTU_ADMIN,
});

const TANGGAL_JAM = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: ZONA_WAKTU_ADMIN,
});

const RUPIAH = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
});

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `12 Agu 2026` — dipakai pada kolom tanggal tanpa jam. */
export function formatTanggal(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? TANGGAL_PENDEK.format(date) : '-';
}

/** `12 Agu 2026, 14.05` — dipakai pada log, audit, dan detail. */
export function formatTanggalWaktu(
  value: string | number | Date | null | undefined
): string {
  const date = toDate(value);
  return date ? TANGGAL_JAM.format(date) : '-';
}

/** `Rp1.234.000` — selalu tanpa desimal dan tanpa spasi, sama di semua tabel. */
export function formatRupiah(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const angka = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(angka)) return '-';
  return `Rp${RUPIAH.format(angka)}`;
}

const DETIK = 1000;
const MENIT = 60 * DETIK;
const JAM = 60 * MENIT;
const HARI = 24 * JAM;

/** `3 jam lalu` — untuk umpan notifikasi dan daftar aktivitas. */
export function waktuLalu(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '-';
  const selisih = Date.now() - date.getTime();
  if (selisih < 45 * DETIK) return 'baru saja';
  if (selisih < JAM) return `${Math.round(selisih / MENIT)} menit lalu`;
  if (selisih < HARI) return `${Math.round(selisih / JAM)} jam lalu`;
  if (selisih < 30 * HARI) return `${Math.round(selisih / HARI)} hari lalu`;
  return formatTanggal(date);
}

/** Ubah `product_created` menjadi `Product created` sebagai cadangan. */
export function prettifyKode(raw: string | null | undefined): string {
  if (!raw) return '-';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Samarkan email agar tidak bocor di dropdown notifikasi. */
export function samarkanEmail(text: string): string {
  return text.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '••••');
}

export const LABEL_AKTIVITAS: Record<string, string> = {
  login: 'Masuk',
  register: 'Pendaftaran',
  product_created: 'Produk dibuat',
  product_updated: 'Produk diubah',
  product_deleted: 'Produk dihapus',
  order_created: 'Pesanan dibuat',
  order_cancelled: 'Pesanan dibatalkan',
  store_updated: 'Toko diubah',
  subscription_changed: 'Langganan berubah',
  report_received: 'Laporan masuk',
  warning_received: 'Peringatan diterima',
};

export const LABEL_AUDIT: Record<string, string> = {
  issue_warning: 'Peringatan diberikan',
  issue_sanction: 'Sanksi diberikan',
  suspend_user: 'Pengguna ditangguhkan',
  ban_user: 'Pengguna diblokir',
  activate_user: 'Pengguna diaktifkan',
  resolve_report: 'Laporan diselesaikan',
  dismiss_report: 'Laporan ditolak',
  approve_role_request: 'Permintaan role disetujui',
  reject_role_request: 'Permintaan role ditolak',
  request_role_change: 'Permintaan perubahan role diajukan',
};

export const LABEL_TIPE_TARGET: Record<string, string> = {
  user: 'Pengguna',
  users: 'Pengguna',
  product: 'Produk',
  products: 'Produk',
  order: 'Pesanan',
  orders: 'Pesanan',
  report: 'Laporan',
  reports: 'Laporan',
  store: 'UMKM',
  stores: 'UMKM',
  umkm: 'UMKM',
  subscription: 'Langganan',
  article: 'Artikel',
};

/**
 * Label status moderasi produk dalam era auto-approve.
 *
 * PENTING: tidak ada status baru yang ditambahkan. `verification_status`
 * tetap tiga nilai yang sudah ada di CHECK constraint
 * ('pending' | 'approved' | 'rejected') supaya kompatibel dengan database
 * dan alur pembeli. Yang berubah hanya ARTINYA di sisi admin:
 *   - approved = live, tampil normal di katalog
 *   - rejected = ditunda/dinonaktifkan admin (takedown), TIDAK bisa dibeli
 *   - pending  = sisa antrean lama sebelum auto-approve, bukan alur normal
 */
export const LABEL_VERIFIKASI_PRODUK: Record<string, string> = {
  approved: 'Aktif',
  rejected: 'Ditunda Admin',
  pending: 'Antrean Lama',
};

export function labelVerifikasiProduk(value: string | null | undefined): string {
  if (!value) return '-';
  return LABEL_VERIFIKASI_PRODUK[value] ?? prettifyKode(value);
}

export function varianVerifikasiProduk(
  value: string | null | undefined
): 'success' | 'destructive' | 'warning' | 'secondary' {
  if (value === 'approved') return 'success';
  if (value === 'rejected') return 'destructive';
  if (value === 'pending') return 'warning';
  return 'secondary';
}

/** Label status operasional produk (bukan status moderasi). */
export function labelStatusOperasional(value: string | null | undefined): string {
  if (value === 'available') return 'Tersedia';
  if (value === 'sold_out') return 'Stok Habis';
  if (value === 'hidden') return 'Disembunyikan';
  return value ?? '-';
}

/** Label Indonesian untuk activity type, dengan fallback yang tetap terbaca. */
export function labelAktivitas(value: string | null | undefined): string {
  if (!value) return '-';
  return LABEL_AKTIVITAS[value] ?? prettifyKode(value);
}

/** Label Indonesian untuk aksi audit, dengan fallback yang tetap terbaca. */
export function labelAudit(value: string | null | undefined): string {
  if (!value) return '-';
  return LABEL_AUDIT[value] ?? prettifyKode(value);
}

/** Label Indonesian untuk target type (user, product, report, ...). */
export function labelTarget(value: string | null | undefined): string {
  if (!value) return '-';
  return LABEL_TIPE_TARGET[value] ?? prettifyKode(value);
}

/** Peran pengguna. Dipakai bersama oleh daftar pengguna dan detail pengguna. */
export function labelPeran(role: string | null | undefined): string {
  if (role === 'admin') return 'Admin';
  if (role === 'umkm') return 'UMKM';
  if (role === 'buyer') return 'Pembeli';
  return role ?? '-';
}

export function varianPeran(
  role: string | null | undefined
): 'default' | 'secondary' | 'success' {
  if (role === 'admin') return 'default';
  if (role === 'umkm') return 'success';
  return 'secondary';
}

export function labelStatusPenjual(status: string | null | undefined): string {
  if (status === 'active') return 'Aktif';
  if (status === 'no_subscription') return 'Langganan tidak aktif';
  if (status === 'no_store') return 'Belum punya toko';
  return status ?? '-';
}

export function varianStatusPenjual(
  status: string | null | undefined
): 'success' | 'warning' | 'secondary' {
  if (status === 'active') return 'success';
  if (status === 'no_subscription') return 'warning';
  return 'secondary';
}

/** Status permintaan perubahan role (role_change_requests.status). */
export function labelStatusPermintaan(status: string | null | undefined): string {
  if (status === 'pending') return 'Menunggu';
  if (status === 'approved') return 'Disetujui';
  if (status === 'rejected') return 'Ditolak';
  return status ?? '-';
}

export function varianStatusPermintaan(
  status: string | null | undefined
): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'pending') return 'warning';
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'destructive';
  return 'secondary';
}

/* ------------------------------------------------------------------------- *
 * Activity Log / Audit Trail admin.
 *
 * Semua nilai diturunkan dari baris `admin_audit_logs` yang benar-benar ada
 * (action + target + reason + metadata). Tidak ada data karangan: bila kunci
 * metadata tidak tersedia, ringkasan/hasil dikembalikan apa adanya atau null.
 * ------------------------------------------------------------------------- */

export type AuditOutcomeTone =
  | 'default'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'outline';

export interface AuditOutcome {
  label: string;
  tone: AuditOutcomeTone;
}

/** Bentuk minimum yang dibutuhkan dari sebuah baris audit. */
export interface AuditRowLike {
  adminName: string;
  adminEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
}

function auditText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

const STATUS_AUDIT_LABEL: Record<string, string> = {
  open: 'Terbuka',
  reviewing: 'Ditinjau',
  resolved: 'Selesai',
  dismissed: 'Ditolak',
  active: 'Aktif',
  suspended: 'Ditangguhkan',
  banned: 'Diblokir',
  pending: 'Menunggu',
};

function statusAuditText(value: string): string {
  return STATUS_AUDIT_LABEL[value] ?? prettifyKode(value);
}

const SANCTION_AUDIT_LABEL: Record<string, string> = {
  warning: 'Peringatan',
  suspend: 'Penangguhan',
  ban: 'Pemblokiran',
  suspension: 'Penangguhan',
  permanent_ban: 'Pemblokiran permanen',
};

function sanctionAuditText(value: string): string {
  return SANCTION_AUDIT_LABEL[value] ?? prettifyKode(value);
}

/**
 * Ringkasan tindakan yang dapat dibaca manusia, diturunkan dari action dan
 * metadata. Fallback ke `labelAudit(action)` bila metadata tidak menyediakan
 * konteks tambahan (tidak mengarang detail).
 */
export function describeAuditAction(input: AuditRowLike): string {
  const m = input.metadata ?? {};
  switch (input.action) {
    case 'resolve_report': {
      const from = auditText(m.from_status);
      const to = auditText(m.to_status);
      return from && to
        ? `Laporan diselesaikan (${statusAuditText(from)} → ${statusAuditText(to)})`
        : 'Laporan diselesaikan';
    }
    case 'dismiss_report': {
      const from = auditText(m.from_status);
      const to = auditText(m.to_status);
      return from && to
        ? `Laporan ditolak (${statusAuditText(from)} → ${statusAuditText(to)})`
        : 'Laporan ditolak';
    }
    case 'issue_warning': {
      const level = auditText(m.warning_level);
      return level ? `Peringatan tingkat ${level}/3 diterbitkan` : 'Peringatan diterbitkan';
    }
    case 'issue_sanction': {
      const type = auditText(m.sanction_type);
      return type ? `Sanksi ${sanctionAuditText(type)} diterbitkan` : 'Sanksi diterbitkan';
    }
    case 'suspend_user':
    case 'ban_user':
    case 'activate_user': {
      const from = auditText(m.old_status);
      const to = auditText(m.new_status);
      return from && to
        ? `Status akun diubah (${statusAuditText(from)} → ${statusAuditText(to)})`
        : 'Status akun diubah';
    }
    case 'approve_role_request': {
      const from = auditText(m.old_role);
      const to = auditText(m.new_role);
      return from && to
        ? `Permintaan perubahan role disetujui (${labelPeran(from)} → ${labelPeran(to)})`
        : 'Permintaan perubahan role disetujui';
    }
    case 'reject_role_request': {
      const from = auditText(m.old_role);
      const to = auditText(m.requested_role);
      return from && to
        ? `Permintaan perubahan role ditolak (${labelPeran(from)} → ${labelPeran(to)} tidak diterapkan)`
        : 'Permintaan perubahan role ditolak';
    }
    default:
      return labelAudit(input.action);
  }
}

/**
 * Status/hasil tindakan bila datanya tersedia.
 * - resolve/dismiss -> status tujuan laporan.
 * - suspend/ban/activate -> status akun baru.
 * - issue_warning -> tingkat peringatan.
 * - issue_sanction -> jenis sanksi.
 * Mengembalikan null bila tidak ada bukti yang dapat ditampilkan.
 */
export function auditOutcome(input: AuditRowLike): AuditOutcome | null {
  const m = input.metadata ?? {};

  const toStatus = auditText(m.to_status);
  if (toStatus) {
    const tone: AuditOutcomeTone =
      toStatus === 'resolved'
        ? 'success'
        : toStatus === 'dismissed'
          ? 'secondary'
          : 'default';
    return { label: statusAuditText(toStatus), tone };
  }

  const newStatus = auditText(m.new_status);
  if (newStatus) {
    const tone: AuditOutcomeTone =
      newStatus === 'active'
        ? 'success'
        : newStatus === 'suspended'
          ? 'warning'
          : newStatus === 'banned'
            ? 'destructive'
            : 'secondary';
    return { label: statusAuditText(newStatus), tone };
  }

  const level = auditText(m.warning_level);
  if (level) {
    return { label: `Peringatan ${level}/3`, tone: 'warning' };
  }

  const sanctionType = auditText(m.sanction_type);
  if (sanctionType) {
    return { label: sanctionAuditText(sanctionType), tone: 'destructive' };
  }

  // Keputusan permintaan role: hasil = role baru (disetujui) / ditolak.
  if (input.action === 'approve_role_request' || input.action === 'reject_role_request') {
    if (input.action === 'reject_role_request') {
      return { label: 'Ditolak', tone: 'secondary' };
    }
    const newRole = auditText(m.new_role);
    if (newRole) {
      return { label: labelPeran(newRole), tone: 'success' };
    }
  }

  return null;
}

/** Objek terdampak yang ringkas: label tipe + ID pendek bila ada. */
export function describeAuditTarget(input: AuditRowLike): string {
  const label = labelTarget(input.targetType);
  if (!input.targetId) return label;
  return `${label} · ${input.targetId.slice(0, 8)}…`;
}

/**
 * Pencarian sisi klien atas seluruh field yang tampil (admin, tindakan,
 * target, ringkasan, hasil, alasan). Hanya menyaring baris yang sudah ada;
 * tidak melakukan query baru maupun mengarang hasil.
 */
export function matchesAuditQuery(input: AuditRowLike, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const outcome = auditOutcome(input);
  const haystack = [
    input.adminName,
    input.adminEmail ?? '',
    input.action,
    labelAudit(input.action),
    input.targetType,
    labelTarget(input.targetType),
    input.targetId ?? '',
    input.reason ?? '',
    describeAuditAction(input),
    outcome?.label ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}