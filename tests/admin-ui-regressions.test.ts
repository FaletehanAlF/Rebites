import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8')
        .replace(/\r\n/g, '\n');
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
    const views = [
        'app/components/admin/users-management-view.tsx',
        'app/components/admin/sanctions-view.tsx',
        'app/components/admin/warnings-view.tsx',
    ];
    const guardRe = /if \(requestId !== requestIdRef\.current\)[\s\S]{0,30}return 'stale';/;
    for (const file of views) {
        const source = readProjectFile(file);
        assert.match(source, /const requestIdRef = useRef\(0\)/, `${file} tanpa penjaga respons basi`);
        const guardCount = (source.match(/if \(requestId !== requestIdRef\.current\)[\s\S]{0,30}return 'stale';/g) ?? []).length;
        assert.ok(guardCount >= 2, `${file}: penjaga harus ada di jalur sukses dan gagal`);
        const guardIdx = source.search(guardRe);
        const readyIdx = source.indexOf("setStatus('ready')");
        assert.ok(guardIdx >= 0 && readyIdx > guardIdx, `${file}: penjaga harus sebelum setStatus('ready')`);
        assert.match(source, /import \{[^}]*useRef[^}]*\}/);
    }
});
test('topbar admin menempel penuh sampai dasar halaman dengan latar putih pekat', () => {
    const source = readProjectFile('app/components/admin/admin-topbar.tsx');
    assert.match(source, /'fixed left-0 right-0 top-0 z-30 border-b bg-white lg:left-\[var\(--admin-rail-w\)\]'/);
    assert.doesNotMatch(source, /sticky top-0 z-30/);
    assert.doesNotMatch(source, /bg-white\/9[05]/);
    assert.doesNotMatch(source, /backdrop-blur/);
    assert.match(source, /<div aria-hidden className="h-16 shrink-0"\/>/);
});
test('kanvas panel admin putih murni di kedua definisi token', () => {
    const css = readProjectFile('app/globals.css');
    const matches = css.match(/--admin-canvas: 0 0% 100%;/g) ?? [];
    assert.ok(matches.length >= 2, 'kedua definisi --admin-canvas harus putih');
    assert.doesNotMatch(css, /--admin-canvas: 150 25% 97%/);
});
test('monitoring aktivitas: pencarian tampil lebih dulu, berlabel, dan tidak jatuh sendiri', () => {
    const source = readProjectFile('app/components/admin/activity-logs-view.tsx');
    const searchIdx = source.indexOf('<AdminSearchInput');
    const firstSelectIdx = source.indexOf('<AdminSelect');
    assert.ok(searchIdx >= 0 && firstSelectIdx >= 0, 'toolbar harus berisi pencarian dan filter');
    assert.ok(searchIdx < firstSelectIdx, 'pencarian harus mendahului filter');
    assert.match(source, /<AdminSearchInput[\s\S]{0,200}labelVisible/);
});
test('permintaan role: fitur yang belum aktif tampil sebagai empty state, bukan error', () => {
    const route = readProjectFile('app/api/admin/role-requests/route.ts');
    const client = readProjectFile('lib/role-requests.ts');
    const view = readProjectFile('app/components/admin/role-requests-view.tsx');
    assert.match(route, /code === '42P01' \|\| code === 'PGRST205'/);
    assert.match(route, /not_provisioned: true/);
    assert.match(client, /notProvisioned: json\.not_provisioned === true/);
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
    assert.match(source, /<DropdownMenuTrigger asChild>\s*<button/);
    assert.match(source, /aria-label="Monitoring"/);
    assert.match(source, /<DropdownMenuContent side="right"/);
});
test('sidebar ringkas: dropdown Monitoring memuat 6 tujuan termasuk ringkasan', () => {
    const source = readProjectFile('app/components/admin/admin-sidebar.tsx');
    assert.match(source, /label: 'Ringkasan Monitoring', icon: Activity, href: '\/dashboard\/admin\/monitoring', exact: true/);
    for (const route of [
        '/dashboard/admin/monitoring/aktivitas',
        '/dashboard/admin/monitoring/laporan',
        '/dashboard/admin/monitoring/peringatan',
        '/dashboard/admin/monitoring/sanksi',
        '/dashboard/admin/monitoring/audit',
    ]) {
        assert.ok(source.includes(`href: '${route}'`), `route hilang: ${route}`);
    }
    assert.match(source, /const MONITORING_MENU: NavItem\[\] = \[\s*\{[^}]*exact: true[^}]*\},\s*\.\.\.MONITORING_CHILDREN,/);
});
test('sidebar ringkas: tooltip disembunyikan selama dropdown terbuka', () => {
    const source = readProjectFile('app/components/admin/admin-sidebar.tsx');
    assert.match(source, /\{collapsed && tip && !monitoringMenuOpen && \(/);
    assert.match(source, /if \(next\)\s+hideTip\(\)/);
});
test('sidebar expanded dan drawer mobile tetap memakai submenu inline', () => {
    const source = readProjectFile('app/components/admin/admin-sidebar.tsx');
    assert.match(source, /\{!compact && monitoringOpen && \(/);
    assert.match(source, /\{!compact && \(\s*<button/);
    assert.match(source, /\{content\(true, false\)\}/);
    assert.match(source, /\{content\(false, collapsed\)\}/);
});
test('permintaan role: badge melayani Super Admin DAN admin pengaju', () => {
    const sidebar = readProjectFile('app/components/admin/admin-sidebar.tsx');
    const hook = readProjectFile('hooks/use-role-request-badge.ts');
    assert.match(sidebar, /useRoleRequestBadge\(\s*me !== null,\s*me\?\.isSuperAdmin === true\s*\)/);
    assert.match(sidebar, /badgeCount: roleBadgeCount/);
    assert.match(sidebar, /badgeKind: roleBadgeKind/);
    assert.match(hook, /status: 'pending'/);
    assert.match(hook, /mine: true/);
    assert.match(hook, /readSeenRoleDecisionIds\(\)/);
    assert.match(hook, /item\.status === 'approved' \|\| item\.status === 'rejected'/);
    assert.match(sidebar, /item\.badgeCount != null && item\.badgeCount > 0/);
    assert.match(sidebar, /badgeCount > 99 \? '99\+'/);
    assert.match(sidebar, /rounded-full bg-destructive font-bold text-white/);
});
test('permintaan role: keputusan ditandai sudah dilihat saat halaman dibuka pengaju', () => {
    const view = readProjectFile('app/components/admin/role-requests-view.tsx');
    const prefs = readProjectFile('lib/admin-preferences.ts');
    assert.match(view, /markRoleDecisionsSeen\(ids\)/);
    assert.match(view, /requested_by_me === true/);
    assert.match(view, /if \(viewerIsSuperAdmin \|\| items\.length === 0\)[\s\S]{0,20}return;/);
    assert.match(prefs, /ADMIN_ROLE_DECISIONS_SEEN_KEY/);
    assert.match(prefs, /ADMIN_ROLE_DECISIONS_EVENT/);
    assert.match(prefs, /export function markRoleDecisionsSeen/);
    assert.match(prefs, /export function readSeenRoleDecisionIds/);
    const keysBlock = prefs.match(/ADMIN_LOCAL_STORAGE_KEYS = \[([\s\S]*?)\] as const/);
    assert.ok(keysBlock, 'ADMIN_LOCAL_STORAGE_KEYS tidak ditemukan di admin-preferences.ts');
    assert.match(keysBlock[1], /ADMIN_ROLE_DECISIONS_SEEN_KEY/);
});
test('permintaan role: halaman menampilkan semua status secara default dan auto-refresh', () => {
    const view = readProjectFile('app/components/admin/role-requests-view.tsx');
    assert.match(view, /useState<'' \| RoleRequestStatus>\(''\)/);
    assert.match(view, /\{ value: '', label: 'Semua status' \}/);
    assert.match(view, /window\.setInterval\(refresh, 20000\)/);
    assert.match(view, /document\.addEventListener\('visibilitychange', onVisible\)/);
    assert.match(view, /if \(deciding\)\s+return;/);
});
test('permintaan role: pengajuan dicatat ke audit log agar muncul di notifikasi', () => {
    const route = readProjectFile('app/api/admin/role-requests/route.ts');
    assert.match(route, /action: 'request_role_change'/);
    assert.match(route, /from\('admin_audit_logs'\)/);
    assert.match(route, /audit log gagal/);
    assert.match(route, /return NextResponse\.json\(\{ request: inserted \}, \{ status: 201 \}\)/);
});
test('filter tanggal admin memakai satu unit rentang, bukan dua input terpisah', () => {
    const controls = readProjectFile('app/components/admin/admin-controls.tsx');
    assert.match(controls, /export function AdminDateRange\(/);
    assert.match(controls, /fromLabel = 'Dari tanggal'/);
    assert.match(controls, /toLabel = 'Sampai tanggal'/);
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
        assert.doesNotMatch(source, /<AdminDateInput[\s\S]{0,200}<AdminDateInput/, `${view} tidak boleh memasang dua AdminDateInput terpisah`);
    }
});
test('halaman Aktivitas: lima filter muat satu baris, tanggal tetap berdampingan', () => {
    const view = readProjectFile('app/components/admin/activity-logs-view.tsx');
    assert.match(view, /lg:w-52/);
    assert.match(view, /lg:shrink/);
    assert.match(view, /lg:min-w-\[7rem\]/);
    assert.doesNotMatch(view, /lg:flex-none/);
    assert.match(view, /AdminDateRange/);
    assert.doesNotMatch(view, /<AdminDateInput[\s\S]{0,200}<AdminDateInput/);
});
test('input tanggal cukup lebar sehingga ikon kalender tidak menimpa teks', () => {
    const controls = readProjectFile('app/components/admin/admin-controls.tsx');
    assert.match(controls, /widthVar\('--admin-date-w', '13ch'\)/);
    assert.doesNotMatch(controls, /widthVar\('--admin-date-w', '12ch'\)/);
});
test('detail UMKM: tombol verifikasi sejajar nama toko di header', () => {
    const view = readProjectFile('app/components/admin/umkm-detail-view.tsx');
    assert.match(view, /actions=\{[\s\S]{0,600}Verifikasi UMKM/);
    assert.match(view, /actions=\{[\s\S]{0,600}Batalkan Verifikasi/);
});
test('detail UMKM: deskripsi panjang tampil sekali di kartu lebar penuh', () => {
    const view = readProjectFile('app/components/admin/umkm-detail-view.tsx');
    assert.match(view, /split\(\/\\n\{2,\}\/\)/);
    assert.match(view, /max-w-prose/);
    assert.doesNotMatch(view, /AdminDetailField label="Deskripsi toko"[\s\S]{0,200}\{umkm\.description\}/);
});
test('daftar UMKM: nama toko tampil sebelum badge di kartu mobile', () => {
    const view = readProjectFile('app/components/admin/umkm-management-view.tsx');
    const kartu = view.slice(view.indexOf('md:hidden'));
    const posisiNama = kartu.indexOf('{item.business_name}');
    const posisiBadge = kartu.indexOf("item.is_verified ? 'success' : 'warning'");
    assert.ok(posisiNama > -1 && posisiBadge > -1, 'nama dan badge harus ada di kartu mobile');
    assert.ok(posisiNama < posisiBadge, 'nama toko harus dirender sebelum badge status');
});
test('halaman Laporan: satu pencarian tunggal dan status berupa dropdown', () => {
    const view = readProjectFile('app/components/admin/reports-view.tsx');
    const searchInputs = view.match(/<AdminSearchInput/g) ?? [];
    assert.equal(searchInputs.length, 1, 'halaman Laporan hanya boleh punya satu input pencarian');
    assert.doesNotMatch(view, /categoryInput/);
    assert.doesNotMatch(view, /<AdminFilterChip/);
    assert.match(view, /label="Status"[\s\S]{0,200}STATUS_FILTERS/);
    assert.match(view, /\{ value: '', label: 'Semua' \}/);
    assert.doesNotMatch(view, /rounded-\[var\(--radius\)\] border border-border bg-white p-5/);
    assert.doesNotMatch(view, /showFilters/);
    assert.doesNotMatch(view, /Filter lanjutan/);
});
test('halaman Laporan: Atur ulang dipisah dari baris filter', () => {
    const view = readProjectFile('app/components/admin/reports-view.tsx');
    const toolbarStart = view.indexOf('<AdminToolbar>');
    const toolbarEnd = view.indexOf('</AdminToolbar>');
    assert.ok(toolbarStart > -1 && toolbarEnd > toolbarStart);
    const insideToolbar = view.slice(toolbarStart, toolbarEnd);
    assert.doesNotMatch(insideToolbar, /Atur ulang/, 'tombol reset harus di luar AdminToolbar');
    const afterToolbar = view.slice(toolbarEnd);
    assert.match(afterToolbar, /flex justify-end[\s\S]{0,600}Atur ulang filter/);
});
test('halaman Laporan: pencarian otomatis tanpa tombol Cari', () => {
    const view = readProjectFile('app/components/admin/reports-view.tsx');
    assert.doesNotMatch(view, /type="submit"/);
    assert.match(view, /SEARCH_DEBOUNCE_MS = 400/);
    assert.match(view, /setTimeout\(\(\) => \{[\s\S]{0,80}setQApplied\(q\.trim\(\)\)/);
    const debounceUses = view.match(/setQApplied\(q\.trim\(\)\)/g) ?? [];
    assert.equal(debounceUses.length, 1, 'debounce pencarian harus tunggal');
});
test('halaman Sanksi: jenis sanksi berupa dropdown dan pencarian di awal baris', () => {
    const view = readProjectFile('app/components/admin/sanctions-view.tsx');
    assert.doesNotMatch(view, /<AdminFilterChip/);
    assert.match(view, /label="Jenis sanksi"[\s\S]{0,200}TYPE_FILTERS/);
    assert.match(view, /\{ value: '', label: 'Semua jenis sanksi' \}/);
    const toolbarStart = view.indexOf('<AdminToolbar>');
    const searchPos = view.indexOf('<AdminSearchInput', toolbarStart);
    const selectPos = view.indexOf('label="Jenis sanksi"', toolbarStart);
    assert.ok(toolbarStart > -1 && searchPos > -1 && selectPos > -1);
    assert.ok(searchPos < selectPos, 'input pencarian harus dirender sebelum dropdown jenis sanksi');
});
test('kartu admin punya tepi tipis karena kanvasnya putih murni', () => {
    const card = readProjectFile('app/components/ui/card.tsx');
    const table = readProjectFile('app/components/admin/admin-table.tsx');
    assert.match(card, /rounded-xl border border-admin-line\/80 bg-card text-card-foreground shadow-admin-card/);
    assert.match(table, /overflow-hidden rounded-xl border border-admin-line\/80 bg-admin-panel shadow-admin-card/);
    assert.doesNotMatch(card, /ring-1 ring-admin-line/);
});
test('angka KPI dashboard tampil sebagai isi utama kartu', () => {
    const kpi = readProjectFile('app/components/admin/dashboard/dashboard-kpi-grid.tsx');
    assert.match(kpi, /text-\[28px\] font-semibold leading-none tabular-nums/);
    assert.doesNotMatch(kpi, /hover:opacity-90/);
    assert.match(kpi, /toLocaleString\('id-ID'\)/);
});
test('judul kolom tabel tidak bersaing dengan isinya', () => {
    const table = readProjectFile('app/components/admin/admin-table.tsx');
    assert.match(table, /text-\[11px\] font-semibold uppercase leading-4 tracking-\[0\.08em\] text-charcoal-700/);
    assert.doesNotMatch(table, /text-\[13px\] font-bold uppercase/);
});
test('halaman menu dimulai oleh judulnya, tanpa label kategori di atasnya', () => {
    const header = readProjectFile('app/components/admin/admin-page-header.tsx');
    assert.doesNotMatch(header, /eyebrow/i);
    assert.match(header, /text-balance/);
    assert.match(header, /max-w-prose/);
    const offenders: string[] = [];
    for (const dir of ['app/components/admin', 'app/components/admin/dashboard']) {
        for (const name of readdirSync(fileURLToPath(new URL(`../${dir}`, import.meta.url)))) {
            if (!name.endsWith('.tsx'))
                continue;
            const source = readFileSync(new URL(`../${dir}/${name}`, import.meta.url), 'utf8');
            if (source.includes('eyebrow'))
                offenders.push(`${dir}/${name}`);
        }
    }
    for (const file of [
        'app/dashboard/admin/page.tsx',
        'app/dashboard/admin/monitoring/page.tsx',
        'app/dashboard/admin/pengaturan/page.tsx',
        'app/dashboard/admin/profile/page.tsx',
    ]) {
        if (readProjectFile(file).includes('eyebrow'))
            offenders.push(file);
    }
    assert.deepEqual(offenders, []);
});
