/**
 * Preferensi panel admin.
 *
 * Semua preferensi di sini disimpan di `localStorage` (per perangkat/browser),
 * bukan di database. Backend ReBites belum menyediakan endpoint pengaturan
 * admin, jadi halaman Pengaturan hanya boleh menegosiasikan hal-hal yang
 * benar-benar bisa disimpan dan benar-benar dipakai komponen lain.
 *
 * Pola ini sama dengan yang sudah dipakai `admin-notification-bell.tsx`
 * untuk status notifikasi: nilai nyata, satu kunci, satu event sinkron.
 */

export const ADMIN_PREFERENCES_KEY = 'rebites-admin-preferences';
export const ADMIN_PREFERENCES_EVENT = 'rebites-admin-preferences-updated';

/** Kunci status baca notifikasi. Dipakai bersama oleh lonceng dan halaman Pengaturan. */
export const ADMIN_NOTIF_LAST_SEEN_KEY = 'rebites-admin-notif-last-seen';
export const ADMIN_NOTIF_READ_IDS_KEY = 'rebites-admin-notif-read-ids';
export const ADMIN_NOTIF_EVENT = 'rebites-admin-notifications-updated';

/**
 * Kunci status "sudah dilihat" untuk KEPUTUSAN permintaan role.
 *
 * Badge di menu "Permintaan Role" punya dua arti berbeda:
 * - Super Admin  : berapa permintaan yang MENUNGGU keputusannya.
 * - Admin pengaju: berapa permintaannya sendiri yang SUDAH DIPUTUSKAN
 *   (disetujui/ditolak) tapi belum dilihatnya.
 *
 * Tanpa kunci ini, admin pengaju tidak pernah tahu permintaannya ditolak —
 * itulah bug yang diperbaiki. Disimpan per perangkat karena backend belum
 * punya kolom "read" untuk permintaan role.
 */
export const ADMIN_ROLE_DECISIONS_SEEN_KEY = 'rebites-admin-role-decisions-seen';
export const ADMIN_ROLE_DECISIONS_EVENT = 'rebites-admin-role-decisions-updated';
/** Batas ID yang disimpan; cukup untuk riwayat normal tanpa membengkak. */
export const MAX_SEEN_ROLE_DECISIONS = 100;

/**
 * Preferensi lebar sidebar admin (mode ikon-saja). Disimpan di kunci
 * terpisah dengan sengaja: halaman Pengaturan menyalin `preferences` ke
 * `draft` setiap kali nilainya berubah, sehingga satu klik "ciutkan
 * sidebar" akan membuang isian yang belum disimpan di halaman itu.
 * Kunci ini tetap terdaftar di `ADMIN_LOCAL_STORAGE_KEYS` supaya ikut
 * terhitung dan ikut dibersihkan dari halaman Pengaturan.
 */
export const ADMIN_SIDEBAR_COLLAPSED_KEY = 'rebites-admin-sidebar-collapsed';

export interface AdminPreferences {
  /** Tampilkan lonceng notifikasi di header admin. */
  showNotificationBell: boolean;
  /** Aktifkan deteksi aktivitas langsung di halaman Monitoring Aktivitas. */
  realtimeActivity: boolean;
  /** Densitas tabel: padat (lebih banyak baris terlihat) atau nyaman. */
  compactTable: boolean;
  /** Sorot baris tabel saat kursor di atasnya. */
  tableRowHover: boolean;
}

export const DEFAULT_ADMIN_PREFERENCES: AdminPreferences = {
  showNotificationBell: true,
  realtimeActivity: true,
  compactTable: false,
  tableRowHover: true,
};

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/** Baca preferensi dari localStorage; nilai tak valid jatuh ke bawaan. */
export function readAdminPreferences(): AdminPreferences {
  if (!isBrowser()) return DEFAULT_ADMIN_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(ADMIN_PREFERENCES_KEY);
    if (!raw) return DEFAULT_ADMIN_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<AdminPreferences> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_ADMIN_PREFERENCES;
    return {
      showNotificationBell:
        typeof parsed.showNotificationBell === 'boolean'
          ? parsed.showNotificationBell
          : DEFAULT_ADMIN_PREFERENCES.showNotificationBell,
      realtimeActivity:
        typeof parsed.realtimeActivity === 'boolean'
          ? parsed.realtimeActivity
          : DEFAULT_ADMIN_PREFERENCES.realtimeActivity,
      compactTable:
        typeof parsed.compactTable === 'boolean'
          ? parsed.compactTable
          : DEFAULT_ADMIN_PREFERENCES.compactTable,
      tableRowHover:
        typeof parsed.tableRowHover === 'boolean'
          ? parsed.tableRowHover
          : DEFAULT_ADMIN_PREFERENCES.tableRowHover,
    };
  } catch {
    return DEFAULT_ADMIN_PREFERENCES;
  }
}

/**
 * Simpan preferensi lalu beri sinyal ke komponen lain di tab yang sama.
 * Melempar error bila localStorage tidak tersedia (mis. mode privat),
 * supaya halaman Pengaturan bisa menampilkan kegagalan dengan jujur.
 */
export function writeAdminPreferences(preferences: AdminPreferences): void {
  if (!isBrowser()) throw new Error('Penyimpanan hanya tersedia di browser.');
  window.localStorage.setItem(ADMIN_PREFERENCES_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new Event(ADMIN_PREFERENCES_EVENT));
}

/** Tandai seluruh notifikasi aktivitas sebagai sudah dibaca di perangkat ini. */
export function markAllAdminNotificationsRead(): void {
  if (!isBrowser()) return;
  const now = new Date().toISOString();
  window.localStorage.setItem(ADMIN_NOTIF_LAST_SEEN_KEY, now);
  window.localStorage.removeItem(ADMIN_NOTIF_READ_IDS_KEY);
  window.dispatchEvent(new Event(ADMIN_NOTIF_EVENT));
}

/** Kosongkan kembali status baca notifikasi di perangkat ini. */
export function clearAdminNotificationReadState(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ADMIN_NOTIF_LAST_SEEN_KEY);
  window.localStorage.removeItem(ADMIN_NOTIF_READ_IDS_KEY);
  window.dispatchEvent(new Event(ADMIN_NOTIF_EVENT));
}

/**
 * ID permintaan role yang keputusannya sudah dilihat admin pengaju.
 * Gagal membaca localStorage (mode privat) menghasilkan himpunan kosong —
 * badge lalu menampilkan semua keputusan, yang lebih baik daripada diam.
 */
export function readSeenRoleDecisionIds(): Set<string> {
  if (!isBrowser()) return new Set();
  try {
    const raw = window.localStorage.getItem(ADMIN_ROLE_DECISIONS_SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

/**
 * Tandai keputusan permintaan role sebagai sudah dilihat.
 * Memberi sinyal ke komponen lain di tab yang sama agar badge langsung hilang.
 */
export function markRoleDecisionsSeen(ids: readonly string[]): void {
  if (!isBrowser() || ids.length === 0) return;
  try {
    const merged = readSeenRoleDecisionIds();
    for (const id of ids) merged.add(id);
    // Simpan hanya yang terbaru agar kunci tidak tumbuh tanpa batas.
    const trimmed = Array.from(merged).slice(-MAX_SEEN_ROLE_DECISIONS);
    window.localStorage.setItem(ADMIN_ROLE_DECISIONS_SEEN_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new Event(ADMIN_ROLE_DECISIONS_EVENT));
  } catch {
    /* storage diblokir: badge tetap tampil, tidak ada yang rusak */
  }
}

/**
 * Semua kunci localStorage yang dipakai panel admin.
 * Dipakai halaman Pengaturan untuk menampilkan ringkasan data lokal dan
 * untuk membersihkannya sekaligus (dengan konsekuensi yang jelas).
 */
export const ADMIN_LOCAL_STORAGE_KEYS = [
  ADMIN_PREFERENCES_KEY,
  ADMIN_NOTIF_LAST_SEEN_KEY,
  ADMIN_NOTIF_READ_IDS_KEY,
  ADMIN_SIDEBAR_COLLAPSED_KEY,
  ADMIN_ROLE_DECISIONS_SEEN_KEY,
] as const;

export interface AdminLocalStorageInfo {
  /** Jumlah kunci admin yang benar-benar ada di perangkat ini. */
  present: number;
  /** Perkiraan ukuran data admin dalam byte. */
  bytes: number;
  /** Ringkasan per kunci: nama → ukuran byte. */
  entries: { key: string; bytes: number }[];
}

/** Hitung ringkasan data lokal admin (hanya kunci milik panel admin). */
export function getAdminLocalStorageInfo(): AdminLocalStorageInfo {
  if (!isBrowser()) return { present: 0, bytes: 0, entries: [] };
  const entries: { key: string; bytes: number }[] = [];
  let bytes = 0;
  for (const key of ADMIN_LOCAL_STORAGE_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value === null) continue;
    const size = key.length + value.length;
    bytes += size;
    entries.push({ key, bytes: size });
  }
  return { present: entries.length, bytes, entries };
}

/**
 * Hapus seluruh data lokal panel admin dan kembalikan ke bawaan.
 * Melempar error bila localStorage tidak tersedia supaya halaman
 * Pengaturan bisa menampilkan kegagalan dengan jujur.
 */
export function clearAdminLocalData(): void {
  if (!isBrowser()) throw new Error('Penyimpanan hanya tersedia di browser.');
  for (const key of ADMIN_LOCAL_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
  // Beri sinyal ke komponen lain di tab yang sama supaya tampilan
  // (mis. lonceng notifikasi) langsung kembali ke kondisi awal.
  window.dispatchEvent(new Event(ADMIN_PREFERENCES_EVENT));
  window.dispatchEvent(new Event(ADMIN_NOTIF_EVENT));
}
