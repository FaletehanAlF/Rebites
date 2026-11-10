'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Database, Info, LayoutGrid, RefreshCw, RotateCcw, Save, Server, ShieldCheck, Table2, Trash2, UserCircle, } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/current-user';
import { useAdminPreferences } from '@/hooks/use-admin-preferences';
import { useAdminMe } from '@/hooks/use-admin-me';
import { DEFAULT_ADMIN_PREFERENCES, clearAdminLocalData, clearAdminNotificationReadState, getAdminLocalStorageInfo, markAllAdminNotificationsRead, writeAdminPreferences, type AdminPreferences, } from '@/lib/admin-preferences';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER } from '@/app/components/admin/admin-page-header';
import { AdminCapabilityList } from '@/app/components/admin/admin-capability-list';
import { cn } from '@/lib/utils';
function statusAkunLabel(status: string | null): string {
    if (status === 'suspended')
        return 'Ditangguhkan';
    if (status === 'banned')
        return 'Diblokir';
    return 'Aktif';
}
function formatBytes(bytes: number): string {
    if (bytes <= 0)
        return '0 B';
    if (bytes < 1024)
        return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}
function SettingsSection({ icon, title, description, scope, children, footer, className, }: {
    icon: React.ReactNode;
    title: string;
    description: string;
    scope?: 'server' | 'device';
    children: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
}) {
    return (<Card className={className}>

      <CardContent className="px-5 py-5">

        <div className="flex items-start gap-4">

          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">

            {icon}

          </span>

          <div className="min-w-0 flex-1">

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">

              <h2 className="font-display text-base font-semibold text-charcoal-900">{title}</h2>

              {scope && (<Badge variant={scope === 'server' ? 'secondary' : 'outline'}>

                  {scope === 'server' ? 'Data server' : 'Perangkat ini'}

                </Badge>)}

            </div>

            <p className="mt-1 text-sm leading-relaxed text-sage-500">{description}</p>

          </div>

        </div>

        <div className="mt-4 border-t border-border pt-4">{children}</div>

        {footer && <div className="mt-4 border-t border-border pt-4">{footer}</div>}

      </CardContent>

    </Card>);
}
function ToggleSwitch({ id, checked, onChange, label, describedById, }: {
    id: string;
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
    describedById?: string;
}) {
    return (<button type="button" id={id} role="switch" aria-checked={checked} aria-label={label} aria-describedby={describedById} onClick={() => onChange(!checked)} className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', checked ? 'border-primary bg-primary' : 'border-border bg-sage-100/70')}>

      <span aria-hidden className={cn('block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-[1.4rem]' : 'translate-x-1')}/>

    </button>);
}
function ToggleRow({ id, label, description, checked, onChange, }: {
    id: string;
    label: string;
    description: string;
    checked: boolean;
    onChange: (next: boolean) => void;
}) {
    return (<div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">

      <div className="min-w-0">

        <span id={`${id}-label`} className="text-sm font-semibold text-charcoal-900">

          {label}

        </span>

        <p id={`${id}-desc`} className="mt-1 text-sm leading-relaxed text-sage-500">

          {description}

        </p>

      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">

        <ToggleSwitch id={id} checked={checked} onChange={onChange} label={label} describedById={`${id}-desc`}/>

        

        <span aria-hidden className={cn('text-[11px] font-bold uppercase tracking-[0.06em]', checked ? 'text-primary' : 'text-sage-500')}>

          {checked ? 'Aktif' : 'Nonaktif'}

        </span>

      </div>

    </div>);
}
export default function AdminSettingsPage() {
    const { user, userId, loading } = useCurrentUser();
    const preferences = useAdminPreferences();
    const adminMe = useAdminMe();
    const [accountStatus, setAccountStatus] = useState<string | null>(null);
    const [accountStatusState, setAccountStatusState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [draft, setDraft] = useState<AdminPreferences>(preferences);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [saveError, setSaveError] = useState('');
    const [notifState, setNotifState] = useState<'idle' | 'saved' | 'error'>('idle');
    const [notifMessage, setNotifMessage] = useState('');
    const [storageState, setStorageState] = useState<'idle' | 'saved' | 'error'>('idle');
    const [storageMessage, setStorageMessage] = useState('');
    const [confirmClearData, setConfirmClearData] = useState(false);
    const [storageInfo, setStorageInfo] = useState({ present: 0, bytes: 0 });
    const [accessRetrying, setAccessRetrying] = useState(false);
    const accessRetryGuard = useRef(false);
    useEffect(() => {
        if (!adminMe.loading) {
            accessRetryGuard.current = false;
            setAccessRetrying(false);
        }
    }, [adminMe.loading]);
    const handleRetryAdminMe = () => {
        if (accessRetryGuard.current || adminMe.loading)
            return;
        accessRetryGuard.current = true;
        setAccessRetrying(true);
        adminMe.retry();
    };
    useEffect(() => {
        let mounted = true;
        if (loading)
            return;
        if (!userId) {
            setAccountStatusState('error');
            return;
        }
        setAccountStatusState('loading');
        supabase
            .from('profiles')
            .select('account_status, role')
            .eq('id', userId)
            .maybeSingle()
            .then(({ data, error }) => {
            if (!mounted)
                return;
            if (error || !data) {
                setAccountStatusState('error');
                return;
            }
            setAccountStatus((data as {
                account_status?: string | null;
            }).account_status ?? 'active');
            setAccountStatusState('ready');
        });
        return () => {
            mounted = false;
        };
    }, [userId, loading]);
    useEffect(() => {
        setDraft(preferences);
    }, [preferences]);
    useEffect(() => {
        setStorageInfo(getAdminLocalStorageInfo());
    }, [notifState, storageState]);
    const isDirty = useMemo(() => draft.showNotificationBell !== preferences.showNotificationBell ||
        draft.realtimeActivity !== preferences.realtimeActivity ||
        draft.compactTable !== preferences.compactTable ||
        draft.tableRowHover !== preferences.tableRowHover, [draft, preferences]);
    const setDraftValue = <K extends keyof AdminPreferences>(key: K, value: AdminPreferences[K]) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
        setSaveState('idle');
        setSaveError('');
    };
    const handleSave = useCallback(() => {
        setSaveState('saving');
        setSaveError('');
        try {
            writeAdminPreferences(draft);
            setSaveState('saved');
        }
        catch (err) {
            setSaveError(err instanceof Error
                ? err.message
                : 'Pengaturan gagal disimpan di perangkat ini.');
            setSaveState('error');
        }
    }, [draft]);
    const handleReset = () => {
        setDraft(DEFAULT_ADMIN_PREFERENCES);
        setSaveState('idle');
        setSaveError('');
    };
    const handleMarkAllRead = () => {
        try {
            markAllAdminNotificationsRead();
            setNotifState('saved');
            setNotifMessage('Semua notifikasi ditandai sudah dibaca di perangkat ini.');
        }
        catch {
            setNotifState('error');
            setNotifMessage('Gagal memperbarui status notifikasi di perangkat ini.');
        }
    };
    const handleClearReadState = () => {
        try {
            clearAdminNotificationReadState();
            setNotifState('saved');
            setNotifMessage('Status baca notifikasi di perangkat ini telah diatur ulang.');
        }
        catch {
            setNotifState('error');
            setNotifMessage('Gagal mengatur ulang status notifikasi di perangkat ini.');
        }
    };
    const handleClearLocalData = () => {
        if (!confirmClearData) {
            setConfirmClearData(true);
            setStorageState('idle');
            setStorageMessage('');
            return;
        }
        setConfirmClearData(false);
        try {
            clearAdminLocalData();
            setStorageState('saved');
            setStorageMessage('Seluruh data lokal panel admin di perangkat ini sudah dihapus.');
        }
        catch {
            setStorageState('error');
            setStorageMessage('Gagal menghapus data lokal di perangkat ini.');
        }
    };
    const roleLabel = adminMe.loading
        ? 'Memuat…'
        : adminMe.status === 'error'
            ?
                'Tidak dapat diperiksa'
            : adminMe.me?.isSuperAdmin
                ? 'Super Admin'
                : adminMe.me
                    ? 'Admin'
                    : 'Tidak terverifikasi';
    const accountStatusLabel = accountStatusState === 'loading'
        ? 'Memuat…'
        : accountStatusState === 'error'
            ? 'Tidak terverifikasi'
            : statusAkunLabel(accountStatus);
    const statusAktif = accountStatusState === 'ready' &&
        (accountStatus === 'active' || accountStatus === null);
    return (<div className={ADMIN_PAGE_WRAPPER}>

      <AdminPageHeader title="Pengaturan" description="Atur preferensi panel admin. Perubahan disimpan ke akunmu, sehingga pilihan yang sama tetap terpakai saat kamu masuk dari perangkat lain."/>



      

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">

        

        <SettingsSection icon={<UserCircle className="h-5 w-5"/>} scope="server" title="Informasi akun admin" description="Data akun yang sedang aktif. Perubahan nama atau kata sandi dilakukan melalui halaman profil dan pemulihan akun." footer={<Link href="/dashboard/admin/profile" className="inline-flex items-center gap-1.5 rounded-[var(--radius)] text-sm font-semibold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">

              Buka Profil Saya

            </Link>}>

          <dl className="space-y-3 text-sm">

            {[
            { label: 'Nama', value: loading ? 'Memuat…' : user?.fullName || '-' },
            { label: 'Email', value: loading ? 'Memuat…' : user?.email || '-' },
            { label: 'Peran', value: roleLabel },
            { label: 'Status akun', value: accountStatusLabel },
        ].map((row) => (<div key={row.label} className="flex items-start justify-between gap-4">

                <dt className="shrink-0 text-sage-500">{row.label}</dt>

                <dd className="min-w-0 truncate text-right font-medium text-charcoal-900">

                  {row.value}

                </dd>

              </div>))}

          </dl>

          

          {(adminMe.status === 'error' || (accessRetrying && adminMe.loading)) && (<div role="alert" className="mt-3 flex flex-wrap items-center gap-4 rounded-[var(--radius)] border border-warning/25 bg-warning/5 px-4 py-3 text-[13px] font-medium text-charcoal-700">

              <span className="min-w-0 flex-1">

                {accessRetrying && adminMe.loading
                ? 'Memeriksa ulang status Super Admin…'
                : `${adminMe.errorMessage ?? 'Tidak dapat memeriksa status admin.'} Status Super Admin belum dapat dipastikan.`}

              </span>

              <Button type="button" variant="outline" size="sm" onClick={handleRetryAdminMe} disabled={adminMe.loading} aria-busy={adminMe.loading}>

                <RefreshCw aria-hidden className="h-3.5 w-3.5"/>

                {adminMe.loading ? 'Memeriksa…' : 'Coba lagi'}

              </Button>

            </div>)}

          <div className="mt-3">

            {accountStatusState === 'loading' ? (<Badge variant="secondary">Memuat status akun…</Badge>) : accountStatusState === 'error' ? (<Badge variant="warning">Status akun tidak terverifikasi</Badge>) : (<Badge variant={statusAktif ? 'success' : 'warning'}>

                {statusAktif ? 'Akun aktif' : statusAkunLabel(accountStatus)}

              </Badge>)}

          </div>

        </SettingsSection>



        

        <SettingsSection icon={<Server className="h-5 w-5"/>} scope="server" title="Sistem & integrasi" description="Layanan yang dipakai ReBites. Pemeriksaan langsung dan batasannya ditampilkan di halaman Kesehatan Sistem." footer={<Link href="/dashboard/admin/system" className="inline-flex items-center gap-1.5 rounded-[var(--radius)] text-sm font-semibold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">

              Lihat Kesehatan Sistem

            </Link>}>

          <ul className="space-y-2.5 text-sm">

            {[
            { name: 'Database & autentikasi', detail: 'Supabase' },
            { name: 'Penyimpanan aset', detail: 'Supabase Storage' },
            { name: 'Pembayaran', detail: 'Xendit' },
            { name: 'Pengiriman', detail: 'Biteship' },
        ].map((row) => (<li key={row.name} className="flex items-center justify-between gap-4">

                <span className="text-charcoal-900">{row.name}</span>

                <Badge variant="secondary">{row.detail}</Badge>

              </li>))}

          </ul>

        </SettingsSection>



        

        <SettingsSection icon={<Table2 className="h-5 w-5"/>} scope="device" title="Tampilan tabel" description="Kepadatan baris dan sorot hover berlaku untuk seluruh tabel admin (pengguna, UMKM, produk, pesanan, laporan, artikel, dan lainnya).">

          <div className="divide-y divide-border">

            <ToggleRow id="pref-compact-table" label="Baris tabel rapat" description="Menghemat tinggi baris sehingga lebih banyak data terlihat tanpa menggulir. Cocok untuk laptop dengan layar kecil." checked={draft.compactTable} onChange={(next) => setDraftValue('compactTable', next)}/>

            <ToggleRow id="pref-table-hover" label="Sorot baris saat kursor di atasnya" description="Memberi penanda pada baris tabel yang sedang ditunjuk agar mudah dibaca saat membandingkan data." checked={draft.tableRowHover} onChange={(next) => setDraftValue('tableRowHover', next)}/>

          </div>

        </SettingsSection>



        

        <SettingsSection icon={<Bell className="h-5 w-5"/>} scope="device" title="Notifikasi & aktivitas langsung" description="Menentukan informasi apa yang muncul di header admin dan seberapa cepat halaman Monitoring Aktivitas diperbarui.">

          <div className="divide-y divide-border">

            <ToggleRow id="pref-notif-bell" label="Lonceng notifikasi di header" description="Menampilkan lonceng notifikasi aktivitas di bagian kanan header admin. Bila dimatikan, notifikasi tetap dapat dibuka dari halaman Monitoring Aktivitas." checked={draft.showNotificationBell} onChange={(next) => setDraftValue('showNotificationBell', next)}/>

            <ToggleRow id="pref-realtime" label="Deteksi aktivitas langsung" description="Saat aktif, halaman Monitoring Aktivitas menampilkan penanda “Langsung” dan tombol muat ulang otomatis ketika ada aktivitas baru." checked={draft.realtimeActivity} onChange={(next) => setDraftValue('realtimeActivity', next)}/>

          </div>

        </SettingsSection>



        

        <SettingsSection icon={<LayoutGrid className="h-5 w-5"/>} scope="server" title="Status notifikasi" description="Status baca notifikasi disimpan ke akun dan di-cache di perangkat ini, sehingga lonceng di perangkat lain ikut tenang setelah kamu menandainya sudah dibaca.">

          <div className="flex flex-wrap items-center gap-2">

            <Button type="button" variant="outline" size="sm" onClick={handleMarkAllRead}>

              <CheckCheck aria-hidden className="h-3.5 w-3.5"/>

              Tandai semua sudah dibaca

            </Button>

            <Button type="button" variant="outline" size="sm" onClick={handleClearReadState}>

              <RotateCcw aria-hidden className="h-3.5 w-3.5"/>

              Atur ulang status baca

            </Button>

          </div>

          <p className="mt-3 min-h-[20px] text-sm" role="status" aria-live="polite">

            {notifState === 'saved' && <span className="text-success">{notifMessage}</span>}

            {notifState === 'error' && <span className="text-destructive">{notifMessage}</span>}

          </p>

        </SettingsSection>



        

        <SettingsSection icon={<Database className="h-5 w-5"/>} scope="server" title="Penyimpanan & data lokal" description="Preferensi ini disimpan di akunmu (tabel user_preferences) dan di-cache di perangkat ini agar halaman terbuka tanpa menunggu jaringan.">

          <dl className="space-y-2.5 text-sm">

            <div className="flex items-center justify-between gap-4">

              <dt className="text-sage-500">Kunci data admin tersimpan</dt>

              <dd className="font-medium tabular-nums text-charcoal-900">

                {storageInfo.present}

              </dd>

            </div>

            <div className="flex items-center justify-between gap-4">

              <dt className="text-sage-500">Perkiraan ukuran</dt>

              <dd className="font-medium tabular-nums text-charcoal-900">

                {formatBytes(storageInfo.bytes)}

              </dd>

            </div>

          </dl>

          {confirmClearData && (<p role="alert" className="mt-4 rounded-[var(--radius)] border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">

              Preferensi di perangkat ini akan dihapus dan pengaturan akun dikembalikan ke

              bawaan, sehingga perangkat lain juga ikut berubah. Tindakan ini tidak dapat

              dikembalikan.

            </p>)}

          <div className="mt-4 flex flex-wrap gap-2">

            <Button type="button" variant="outline" size="sm" onClick={handleClearLocalData} className="text-destructive hover:border-destructive/40 hover:text-destructive">

              <Trash2 aria-hidden className="h-3.5 w-3.5"/>

              {confirmClearData
            ? 'Ya, hapus data lokal permanen'
            : 'Hapus data lokal panel admin'}

            </Button>

            {confirmClearData && (<Button type="button" variant="outline" size="sm" onClick={() => setConfirmClearData(false)}>

                Batal

              </Button>)}

          </div>

          <p className="mt-3 min-h-[20px] text-sm" role="status" aria-live="polite">

            {storageState === 'saved' && <span className="text-success">{storageMessage}</span>}

            {storageState === 'error' && <span className="text-destructive">{storageMessage}</span>}

          </p>

        </SettingsSection>



        

        <SettingsSection icon={<ShieldCheck className="h-5 w-5"/>} scope="server" title="Kewenangan akun" description="Apa yang dapat dan tidak dapat dilakukan akun ini. Daftarnya diturunkan dari aturan yang sama dengan penegakan di server, bukan salinan bebas." className="lg:col-span-2">

          <AdminCapabilityList isSuperAdmin={adminMe.me?.isSuperAdmin === true} superAdminConfigured={adminMe.me?.superAdminConfigured === true} accessState={adminMe.status}/>

        </SettingsSection>



        

        <SettingsSection icon={<Info className="h-5 w-5"/>} title="Catatan & batasan" description="Agar tidak ada tombol yang terlihat berfungsi padahal tidak, berikut hal yang sengaja belum disediakan." className="lg:col-span-2">

          <ul className="grid gap-2.5 text-sm leading-relaxed text-charcoal-700 sm:grid-cols-2">

            {[
            'Preferensi disimpan di akun (tabel user_preferences) dan di-cache di perangkat ini, sehingga pilihan yang sama tetap terpakai saat kamu masuk dari perangkat lain.',
            '“Hapus data lokal panel admin” mengembalikan pengaturan akun ke bawaan juga, bukan hanya di perangkat ini — perangkat lain ikut terdampak.',
            'Lebar sidebar (ringkas atau penuh) sengaja hanya berlaku di perangkat ini: besar layar berbeda-beda dan tidak perlu dipaksakan sama.',
            'Pemeriksaan kesehatan tersedia untuk database, autentikasi, dan penyimpanan. Pembayaran, pengiriman, dan webhook tetap ditandai “Belum diperiksa” sampai ada probe read-only yang aman.',
        ].map((item) => (<li key={item} className="flex items-start gap-2">

                <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-sage-500"/>

                <span>{item}</span>

              </li>))}

          </ul>

        </SettingsSection>

      </div>



      

      {isDirty && (<div className="sticky bottom-4 z-30 mt-4">

          <div className="flex flex-col gap-4 rounded-[var(--radius)] border border-primary/30 bg-white/95 px-4 py-3 shadow-[0_12px_32px_-16px_rgba(30,43,32,0.5)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">

            <p className="min-w-0 text-sm font-medium text-charcoal-900">

              Ada perubahan yang belum disimpan.

            </p>

            <div className="flex shrink-0 items-center gap-2">

              <Button type="button" variant="outline" size="sm" onClick={handleReset} disabled={saveState === 'saving'}>

                <RotateCcw aria-hidden className="h-3.5 w-3.5"/>

                Kembalikan Bawaan

              </Button>

              <Button type="button" size="sm" onClick={handleSave} disabled={saveState === 'saving'}>

                <Save aria-hidden className="h-3.5 w-3.5"/>

                {saveState === 'saving' ? 'Menyimpan…' : 'Simpan Perubahan'}

              </Button>

            </div>

          </div>

        </div>)}



      <p className="mt-4 min-h-[20px] text-sm" role="status" aria-live="polite">

        {saveState === 'saved' && !isDirty && (<span className="flex items-center gap-1.5 font-medium text-success">

            <CheckCheck aria-hidden className="h-4 w-4"/>

            Perubahan tersimpan di perangkat ini.

          </span>)}

        {saveState === 'error' && <span className="text-destructive">{saveError}</span>}

      </p>

    </div>);
}
