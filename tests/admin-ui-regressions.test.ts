/**
 * Regresi integrasi UI admin yang ditemukan saat audit 22 route.
 * Source-guard lokal; tidak menjalankan browser atau database.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function readProjectFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}

test('riwayat moderasi menautkan laporan terkait ke halaman detailnya', () => {
  const source = readProjectFile('app/components/admin/moderation-history.tsx');
  assert.match(source, /href=\{`\$\{LAPORAN_HREF\}\/\$\{reportId\}`\}/);
  assert.doesNotMatch(source, /href=\{LAPORAN_HREF\}/);
});

test('pagination sanksi tetap tersedia saat pencarian atau hasil kosong', () => {
  const source = readProjectFile('app/components/admin/sanctions-view.tsx');
  assert.match(source, /status === 'ready' && total > 0/);
  assert.match(source, /onPageChange=\{\(next\) => load\(\(next - 1\) \* PAGE_LIMIT\)\}/);
  assert.doesNotMatch(source, /busy=\{searching\}/);
});

test('tombol kembali ke atas tidak menjadi fokus keyboard saat tak terlihat', () => {
  const source = readProjectFile('app/components/admin/admin-shell.tsx');
  assert.match(source, /tabIndex=\{visible \? 0 : -1\}/);
  assert.match(source, /aria-hidden=\{!visible\}/);
});

test('retry detail produk menampilkan loading dan error, bukan menelan kegagalan', () => {
  const source = readProjectFile('app/components/admin/product-detail-drawer.tsx');
  assert.match(source, /const reload = async \(\) => \{[\s\S]{0,260}setStatus\('loading'\)/);
  assert.match(source, /Gagal memuat detail produk/);
  assert.doesNotMatch(source, /Biarkan data lama bila reload gagal/);
});

test('pembukaan isi artikel memberi status loading dan mencegah klik ganda', () => {
  const source = readProjectFile('app/components/admin/articles-management-view.tsx');
  assert.match(source, /detailLoadingRef/);
  assert.match(source, /Memuat isi artikel…/);
  assert.match(source, /role="status"/);
});

test('daftar pengguna, sanksi, dan peringatan mengabaikan respons lama', () => {
  // Ketiga halaman ini memicu beberapa request sekaligus (pencarian ber-debounce,
  // filter, pagination, muat ulang). Tanpa penjaga urutan, respons yang lebih
  // lambat menimpa hasil yang sudah tampil — admin melihat data filter lama
  // padahal filter barunya sudah aktif.
  const views = [
    'app/components/admin/users-management-view.tsx',
    'app/components/admin/sanctions-view.tsx',
    'app/components/admin/warnings-view.tsx',
  ];
  const guard = "if (requestId !== requestIdRef.current) return 'stale';";

  for (const file of views) {
    const source = readProjectFile(file);
    assert.match(source, /const requestIdRef = useRef\(0\)/, `${file} tanpa penjaga respons basi`);

    // Dijaga di dua jalur: respons sukses DAN kegagalan request lama.
    const guardCount = source.split(guard).length - 1;
    assert.ok(guardCount >= 2, `${file}: penjaga harus ada di jalur sukses dan gagal`);

    // Penjaga harus muncul sebelum state "siap" ditulis.
    const guardIdx = source.indexOf(guard);
    const readyIdx = source.indexOf("setStatus('ready')");
    assert.ok(guardIdx >= 0 && readyIdx > guardIdx, `${file}: penjaga harus sebelum setStatus('ready')`);

    // `useRef` diimpor — bukan hook yang tidak ada di file ini.
    assert.match(source, /import \{[^}]*useRef[^}]*\}/);
  }
});

test('topbar admin menempel penuh sampai dasar halaman dengan latar putih pekat', () => {
  const source = readProjectFile('app/components/admin/admin-topbar.tsx');

  // Regresi: `sticky` terlepas begitu kolom konten habis, sehingga navbar
  // tidak "stay" di dasar halaman. `fixed` menempel pada viewport.
  // `left` kini mengikuti `--admin-rail-w` (lebar sidebar yang bisa
  // diciutkan), bukan 264px tetap — lihat admin-shell.tsx.
  assert.match(source, /'fixed left-0 right-0 top-0 z-30 border-b bg-white lg:left-\[var\(--admin-rail-w\)\]'/);
  assert.doesNotMatch(source, /sticky top-0 z-30/);
  // Latar opak: tanpa opacity/backdrop-blur supaya konten tidak tembus.
  assert.doesNotMatch(source, /bg-white\/9[05]/);
  assert.doesNotMatch(source, /backdrop-blur/);
  // Ruang pengganti setinggi topbar (h-16) agar konten tidak tertutup.
  assert.match(source, /<div aria-hidden className="h-16 shrink-0" \/>/);
});

test('kanvas panel admin putih murni di kedua definisi token', () => {
  const css = readProjectFile('app/globals.css');
  const matches = css.match(/--admin-canvas: 0 0% 100%;/g) ?? [];
  // Satu di `:root` (portal dialog/drawer) dan satu di `.admin-root`.
  assert.ok(matches.length >= 2, 'kedua definisi --admin-canvas harus putih');
  assert.doesNotMatch(css, /--admin-canvas: 150 25% 97%/);
});

test('monitoring aktivitas: pencarian tampil lebih dulu, berlabel, dan tidak jatuh sendiri', () => {
  const source = readProjectFile('app/components/admin/activity-logs-view.tsx');

  const searchIdx = source.indexOf('<AdminSearchInput');
  const firstSelectIdx = source.indexOf('<AdminSelect');
  assert.ok(searchIdx >= 0 && firstSelectIdx >= 0, 'toolbar harus berisi pencarian dan filter');
  assert.ok(searchIdx < firstSelectIdx, 'pencarian harus mendahului filter');
  // Label terlihat (bukan hanya aria-label) supaya konsisten dengan halaman lain.
  assert.match(source, /<AdminSearchInput[\s\S]{0,200}labelVisible/);
});

test('permintaan role: fitur yang belum aktif tampil sebagai empty state, bukan error', () => {
  const route = readProjectFile('app/api/admin/role-requests/route.ts');
  const client = readProjectFile('lib/role-requests.ts');
  const view = readProjectFile('app/components/admin/role-requests-view.tsx');

  // Route: relasi/fungsi belum ada → 200 dengan daftar kosong + penanda.
  assert.match(route, /code === '42P01' \|\| code === 'PGRST205'/);
  assert.match(route, /not_provisioned: true/);
  // Klien meneruskan penanda itu apa adanya.
  assert.match(client, /notProvisioned: json\.not_provisioned === true/);
  // View memakai penanda untuk memilih judul empty state.
  assert.match(view, /notProvisioned[\s\S]{0,120}'Belum ada permintaan role'/);
  assert.match(view, /setNotProvisioned\(result\.notProvisioned\)/);
});

test('ubah role: RPC yang belum tersedia dijawab dengan pesan yang dapat ditindaklanjuti', () => {
  const route = readProjectFile('app/api/admin/users/[id]/role/route.ts');
  assert.match(route, /PGRST202' \|\| rpcCode === '42883'/);
  assert.match(route, /ROLE_FEATURE_NOT_PROVISIONED/);
  assert.match(route, /status: 503/);
});

test('sidebar ringkas: ikon Monitoring membuka dropdown, bukan langsung berpindah', () => {
  const source = readProjectFile('app/components/admin/admin-sidebar.tsx');

  // Trigger berupa `button` (klik pertama membuka daftar). Kalau ini kembali
  // menjadi <Link>, kelima halaman turunan hilang dari sidebar saat ringkas
  // dan hanya bisa dicapai lewat halaman ringkasan.
  assert.match(source, /<DropdownMenuTrigger asChild>\s*<button/);
  assert.match(source, /aria-label="Monitoring"/);

  // Menu dirender lewat portal + `side="right"` supaya tidak terpotong
  // `overflow-hidden` wrapper sidebar maupun `overflow-y-auto` pada <nav>.
  assert.match(source, /<DropdownMenuContent side="right"/);
});

test('sidebar ringkas: dropdown Monitoring memuat 6 tujuan termasuk ringkasan', () => {
  const source = readProjectFile('app/components/admin/admin-sidebar.tsx');

  // Ringkasan harus ada: tanpanya, mengganti tautan menjadi tombol membuat
  // /dashboard/admin/monitoring tidak lagi terjangkau dari sidebar.
  assert.match(
    source,
    /label: 'Ringkasan Monitoring', icon: Activity, href: '\/dashboard\/admin\/monitoring', exact: true/
  );

  // Lima anak tetap sama persis seperti submenu inline.
  for (const route of [
    '/dashboard/admin/monitoring/aktivitas',
    '/dashboard/admin/monitoring/laporan',
    '/dashboard/admin/monitoring/peringatan',
    '/dashboard/admin/monitoring/sanksi',
    '/dashboard/admin/monitoring/audit',
  ]) {
    assert.ok(source.includes(`href: '${route}'`), `route hilang: ${route}`);
  }

  // `exact` pada ringkasan mencegah /monitoring/aktivitas ikut menandainya aktif.
  assert.match(source, /const MONITORING_MENU: NavItem\[\] = \[\s*\{[^}]*exact: true[^}]*\},\s*\.\.\.MONITORING_CHILDREN,/);
});

test('sidebar ringkas: tooltip disembunyikan selama dropdown terbuka', () => {
  const source = readProjectFile('app/components/admin/admin-sidebar.tsx');

  // Tooltip dan DropdownMenuContent sama-sama z-50; kalau keduanya tampil,
  // tooltip menutupi item menu teratas.
  assert.match(source, /\{collapsed && tip && !monitoringMenuOpen && \(/);
  assert.match(source, /if \(next\) hideTip\(\)/);
});

test('sidebar expanded dan drawer mobile tetap memakai submenu inline', () => {
  const source = readProjectFile('app/components/admin/admin-sidebar.tsx');

  // Chevron + daftar anak hanya dirender saat tidak ringkas.
  assert.match(source, /\{!compact && monitoringOpen && \(/);
  assert.match(source, /\{!compact && \(\s*<button/);

  // Drawer mobile selalu `compact=false`; kalau berubah, submenu inline
  // hilang dan drawer tidak punya dropdown.
  assert.match(source, /\{content\(true, false\)\}/);
  assert.match(source, /\{content\(false, collapsed\)\}/);
});

test('permintaan role: badge melayani Super Admin DAN admin pengaju', () => {
  const sidebar = readProjectFile('app/components/admin/admin-sidebar.tsx');
  const hook = readProjectFile('hooks/use-role-request-badge.ts');

  // Hook dipanggil untuk SEMUA admin (me !== null), bukan hanya Super Admin.
  // Dulu hanya `me?.isSuperAdmin === true`, sehingga admin pengaju tidak
  // pernah mendapat tanda saat permintaannya diputuskan.
  assert.match(sidebar, /useRoleRequestBadge\(\s*me !== null,\s*me\?\.isSuperAdmin === true\s*\)/);
  assert.match(sidebar, /badgeCount: roleBadgeCount/);
  assert.match(sidebar, /badgeKind: roleBadgeKind/);

  // Super Admin: hitung yang menunggu. Admin pengaju: hitung keputusan
  // atas permintaan sendiri yang belum dilihat.
  assert.match(hook, /status: 'pending'/);
  assert.match(hook, /mine: true/);
  assert.match(hook, /readSeenRoleDecisionIds\(\)/);
  assert.match(hook, /item\.status === 'approved' \|\| item\.status === 'rejected'/);

  // Badge tidak dirender untuk nilai 0/null — jangan tampilkan "0".
  assert.match(sidebar, /item\.badgeCount != null && item\.badgeCount > 0/);
  // Angka besar dipangkas agar tidak merusak lebar sidebar.
  assert.match(sidebar, /badgeCount > 99 \? '99\+'/);
  // Warna badge memakai token destructive (merah), bukan primary.
  assert.match(sidebar, /rounded-full bg-destructive font-bold text-white/);
});

test('permintaan role: keputusan ditandai sudah dilihat saat halaman dibuka pengaju', () => {
  const view = readProjectFile('app/components/admin/role-requests-view.tsx');
  const prefs = readProjectFile('lib/admin-preferences.ts');

  // Halaman menandai keputusan atas permintaan SENDIRI sebagai sudah dilihat,
  // sehingga badge hilang setelah admin membuka hasilnya.
  assert.match(view, /markRoleDecisionsSeen\(ids\)/);
  assert.match(view, /requested_by_me === true/);
  assert.match(view, /if \(viewerIsSuperAdmin \|\| items\.length === 0\) return;/);

  // Status "sudah dilihat" disimpan per perangkat dan memberi sinyal ke
  // komponen lain di tab yang sama.
  assert.match(prefs, /ADMIN_ROLE_DECISIONS_SEEN_KEY/);
  assert.match(prefs, /ADMIN_ROLE_DECISIONS_EVENT/);
  assert.match(prefs, /export function markRoleDecisionsSeen/);
  assert.match(prefs, /export function readSeenRoleDecisionIds/);
  // Kunci ikut terdaftar agar dibersihkan dari halaman Pengaturan.
  assert.match(prefs, /ADMIN_ROLE_DECISIONS_SEEN_KEY,\n\] as const/);
});

test('permintaan role: halaman menampilkan semua status secara default dan auto-refresh', () => {
  const view = readProjectFile('app/components/admin/role-requests-view.tsx');

  // Default 'Semua status'. Sebelumnya 'pending', sehingga permintaan yang
  // sudah disetujui/ditolak tidak pernah terlihat tanpa mengubah filter.
  assert.match(view, /useState<'' \| RoleRequestStatus>\(''\)/);
  assert.match(view, /\{ value: '', label: 'Semua status' \}/);

  // Auto-update tanpa refresh manual.
  assert.match(view, /window\.setInterval\(refresh, 20_000\)/);
  assert.match(view, /document\.addEventListener\('visibilitychange', onVisible\)/);
  // Jangan menimpa dialog keputusan yang sedang terbuka.
  assert.match(view, /if \(deciding\) return;/);
});

test('permintaan role: pengajuan dicatat ke audit log agar muncul di notifikasi', () => {
  const route = readProjectFile('app/api/admin/role-requests/route.ts');

  // Tanpa entri audit, lonceng admin tidak punya sinyal bahwa ada pengajuan
  // baru (bell menggabungkan activity_logs + admin_audit_logs).
  assert.match(route, /action: 'request_role_change'/);
  assert.match(route, /from\('admin_audit_logs'\)/);
  // Best-effort: gagal mencatat audit tidak boleh menggagalkan permintaan
  // yang sudah tersimpan.
  assert.match(route, /audit log gagal/);
  assert.match(route, /return NextResponse\.json\(\{ request: inserted \}, \{ status: 201 \}\)/);
});


test('filter tanggal admin memakai satu unit rentang, bukan dua input terpisah', () => {
  const controls = readProjectFile('app/components/admin/admin-controls.tsx');

  // AdminDateRange membungkus kedua input dalam SATU item flex, sehingga
  // "Dari tanggal" dan "Sampai tanggal" tidak pernah terpisah ke baris
  // berbeda. Sebelumnya pada halaman Aktivitas (5 kontrol) "Sampai tanggal"
  // jatuh sendirian di baris bawah.
  assert.match(controls, /export function AdminDateRange\(/);
  assert.match(controls, /fromLabel = 'Dari tanggal'/);
  assert.match(controls, /toLabel = 'Sampai tanggal'/);

  // Jarak horizontal toolbar lebih lebar dari vertikal: label filter
  // (huruf kapital) berdempet ke kotak pencarian bila jaraknya sama.
  assert.match(controls, /sm:gap-x-4/);
});

test('setiap view admin memakai AdminDateRange, tidak memasang dua AdminDateInput sendiri', () => {
  const views = [
    'app/components/admin/activity-logs-view.tsx',
    'app/components/admin/audit-logs-view.tsx',
    'app/components/admin/reports-view.tsx',
    'app/components/admin/sanctions-view.tsx',
  ];

  for (const view of views) {
    const source = readProjectFile(view);
    assert.match(source, /AdminDateRange/, `${view} harus memakai AdminDateRange`);
    // Pemasangan dua input terpisah adalah persis pola yang menyebabkan
    // filter tanggal terpisah baris; jangan kembali ke sana.
    assert.doesNotMatch(
      source,
      /<AdminDateInput[\s\S]{0,200}<AdminDateInput/,
      `${view} tidak boleh memasang dua AdminDateInput terpisah`
    );
  }
});

test('halaman Aktivitas: lima filter muat satu baris, tanggal tetap berdampingan', () => {
  const view = readProjectFile('app/components/admin/activity-logs-view.tsx');

  // Pencarian dipatok lebarnya di layar besar. Dengan basis 18rem + flex-grow
  // (perilaku lama) total lima kontrol melebihi baris sehingga dua filter
  // tanggal terdorong ke bawah — persis yang dikeluhkan.
  assert.match(view, /lg:w-52 lg:flex-none/);
  assert.match(view, /AdminDateRange/);
  // Dua input tanggal terpisah adalah pola yang menyebabkan pemisahan baris.
  assert.doesNotMatch(view, /<AdminDateInput[\s\S]{0,200}<AdminDateInput/);
});

test('input tanggal cukup lebar sehingga ikon kalender tidak menimpa teks', () => {
  const controls = readProjectFile('app/components/admin/admin-controls.tsx');

  // 12ch menyisakan ruang kurang untuk "dd/mm/yyyy" + ikon kalender bawaan;
  // ikon menimpa dua digit terakhir.
  assert.match(controls, /widthVar\('--admin-date-w', '13ch'\)/);
  assert.doesNotMatch(controls, /widthVar\('--admin-date-w', '12ch'\)/);
});

test('detail UMKM: tombol verifikasi sejajar nama toko di header', () => {
  const view = readProjectFile('app/components/admin/umkm-detail-view.tsx');

  // Tombol aksi ada di `actions` AdminPageHeader, bukan di dalam kartu
  // identitas, sehingga sejajar judul di pojok kanan.
  assert.match(view, /actions=\{[\s\S]{0,600}Verifikasi UMKM/);
  assert.match(view, /actions=\{[\s\S]{0,600}Batalkan Verifikasi/);
});

test('detail UMKM: deskripsi panjang tampil sekali di kartu lebar penuh', () => {
  const view = readProjectFile('app/components/admin/umkm-detail-view.tsx');

  // Deskripsi dipecah per paragraf agar bisa dipindai.
  // Regex literal sumbernya: split(/\n{2,}/)
  assert.match(view, /split\(\/\\n\{2,\}\/\)/);
  // Panjang baris dibatasi supaya mata tidak kehilangan tempat.
  assert.match(view, /max-w-prose/);
  // Tidak boleh dirender ulang di dalam grid dua kolom (kolom sempit):
  // teks panjang di sana terlipat jadi belasan baris pendek.
  assert.doesNotMatch(
    view,
    /AdminDetailField label="Deskripsi toko"[\s\S]{0,200}\{umkm\.description\}/
  );
});

test('daftar UMKM: nama toko tampil sebelum badge di kartu mobile', () => {
  const view = readProjectFile('app/components/admin/umkm-management-view.tsx');

  // Hierarki sama dengan tabel desktop: identitas dulu, status menyusul.
  const kartu = view.slice(view.indexOf('md:hidden'));
  const posisiNama = kartu.indexOf('{item.business_name}');
  const posisiBadge = kartu.indexOf("item.is_verified ? 'success' : 'warning'");
  assert.ok(posisiNama > -1 && posisiBadge > -1, 'nama dan badge harus ada di kartu mobile');
  assert.ok(
    posisiNama < posisiBadge,
    'nama toko harus dirender sebelum badge status'
  );
});

test('halaman Laporan: satu pencarian tunggal dan status berupa dropdown', () => {
  const view = readProjectFile('app/components/admin/reports-view.tsx');

  // Hanya SATU input pencarian. Server mencari `q` pada deskripsi DAN
  // kategori sekaligus, jadi input "Kategori" kedua hanya menduplikasi
  // fungsi yang sama.
  const searchInputs = view.match(/<AdminSearchInput/g) ?? [];
  assert.equal(searchInputs.length, 1, 'halaman Laporan hanya boleh punya satu input pencarian');
  assert.doesNotMatch(view, /categoryInput/);

  // Status memakai dropdown, bukan lima chip yang memenuhi satu baris.
  assert.doesNotMatch(view, /<AdminFilterChip/);
  assert.match(view, /label="Status"[\s\S]{0,200}STATUS_FILTERS/);
  // Opsi "Semua" dipendekkan: label di atas dropdown sudah menjelaskan
  // konteksnya, dan kata tambahan melebarkan kontrol sehingga pasangan
  // tanggal terdorong ke baris bawah saat sidebar terbuka.
  assert.match(view, /\{ value: '', label: 'Semua' \}/);

  // Blok berbingkai `rounded border bg-white p-5` adalah pola lama yang
  // membuat filter terlihat sebagai kartu terpisah.
  assert.doesNotMatch(view, /rounded-\[var\(--radius\)\] border border-border bg-white p-5/);
  // Tombol filter lanjutan mobile dihapus; filter selalu terlihat.
  assert.doesNotMatch(view, /showFilters/);
  assert.doesNotMatch(view, /Filter lanjutan/);
});

test('halaman Laporan: Atur ulang dipisah dari baris filter', () => {
  const view = readProjectFile('app/components/admin/reports-view.tsx');

  // Tombol "Atur ulang" adalah AKSI, bukan filter. Saat ikut berbaris ia
  // mendorong pasangan tanggal ke baris bawah ketika sidebar terbuka
  // (264px), jadi ditempatkan di barisnya sendiri, rata kanan.
  const toolbarStart = view.indexOf('<AdminToolbar>');
  const toolbarEnd = view.indexOf('</AdminToolbar>');
  assert.ok(toolbarStart > -1 && toolbarEnd > toolbarStart);

  // Tidak boleh ada tombol reset DI DALAM toolbar.
  const insideToolbar = view.slice(toolbarStart, toolbarEnd);
  assert.doesNotMatch(insideToolbar, /Atur ulang/, 'tombol reset harus di luar AdminToolbar');

  // Dan harus ada setelahnya, di dalam baris rata kanan.
  const afterToolbar = view.slice(toolbarEnd);
  assert.match(afterToolbar, /flex justify-end[\s\S]{0,600}Atur ulang filter/);
});

test('halaman Laporan: pencarian otomatis tanpa tombol Cari', () => {
  const view = readProjectFile('app/components/admin/reports-view.tsx');

  // Tombol submit dihapus; pencarian menerapkan filter sendiri.
  assert.doesNotMatch(view, /type="submit"/);
  // Debounce 400 ms dengan pola yang sama seperti halaman admin lain.
  assert.match(view, /SEARCH_DEBOUNCE_MS = 400/);
  assert.match(view, /setTimeout\(\(\) => \{[\s\S]{0,80}setQApplied\(q\.trim\(\)\)/);
  // Hanya SATU effect debounce. Dua effect identik membuat setiap ketikan
  // menjadwalkan dua request.
  const debounceUses = view.match(/setQApplied\(q\.trim\(\)\)/g) ?? [];
  assert.equal(debounceUses.length, 1, 'debounce pencarian harus tunggal');
});

test('halaman Sanksi: jenis sanksi berupa dropdown dan pencarian di awal baris', () => {
  const view = readProjectFile('app/components/admin/sanctions-view.tsx');

  // Chip diganti dropdown.
  assert.doesNotMatch(view, /<AdminFilterChip/);
  assert.match(view, /label="Jenis sanksi"[\s\S]{0,200}TYPE_FILTERS/);
  assert.match(view, /\{ value: '', label: 'Semua jenis sanksi' \}/);

  // Pencarian adalah kontrol PERTAMA di toolbar (pojok kiri).
  const toolbarStart = view.indexOf('<AdminToolbar>');
  const searchPos = view.indexOf('<AdminSearchInput', toolbarStart);
  const selectPos = view.indexOf('label="Jenis sanksi"', toolbarStart);
  assert.ok(toolbarStart > -1 && searchPos > -1 && selectPos > -1);
  assert.ok(searchPos < selectPos, 'input pencarian harus dirender sebelum dropdown jenis sanksi');
});
