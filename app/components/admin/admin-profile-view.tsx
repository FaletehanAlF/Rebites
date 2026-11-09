'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Check, KeyRound, Loader2, LogOut, Trash2 } from 'lucide-react';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER } from './admin-page-header';
import { AdminAvatar } from './admin-avatar';
import { AdminCapabilityList } from './admin-capability-list';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { removeAvatar, uploadAvatar } from '@/hooks/use-profile';
import { AVATAR_HELP_TEXT, avatarFileError } from '@/lib/admin-avatar';
import { formatTanggal, labelPeran, labelStatusAkun, varianPeran, varianStatusAkun, } from './admin-format';
import { cn } from '@/lib/utils';
const NAMA_MAKS = 80;
export interface AdminProfileViewProps {
    state: 'loading' | 'error' | 'ready';
    errorMessage?: string | null;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    phone: string | null;
    role: string | null;
    accountStatus: string | null;
    joinedAt: string | null;
    isSuperAdmin: boolean;
    superAdminConfigured: boolean;
    accessState: 'loading' | 'verified' | 'unverified' | 'error';
    onAvatarChanged: () => void;
    onLogout: () => void;
    onSaveProfile: (input: {
        fullName: string;
        phone: string;
    }) => Promise<{
        error: string | null;
    }>;
}
function BarisInfo({ label, value }: {
    label: string;
    value: React.ReactNode;
}) {
    return (<div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-sm text-charcoal-700">{label}</dt>
      
      <dd className="min-w-0 break-words text-right text-sm font-medium text-charcoal-900">
        {value}
      </dd>
    </div>);
}
export function AdminProfileView({ state, errorMessage, fullName, email, avatarUrl, phone, role, accountStatus, joinedAt, isSuperAdmin, superAdminConfigured, accessState, onAvatarChanged, onLogout, onSaveProfile, }: AdminProfileViewProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [avatarBusy, setAvatarBusy] = useState(false);
    const [avatarNotice, setAvatarNotice] = useState<{
        tone: 'sukses' | 'galat';
        pesan: string;
    } | null>(null);
    const [confirmHapus, setConfirmHapus] = useState(false);
    const [draftName, setDraftName] = useState(fullName);
    const [draftPhone, setDraftPhone] = useState(phone ?? '');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [savedAt, setSavedAt] = useState(false);
    useEffect(() => {
        setDraftName(fullName);
    }, [fullName]);
    useEffect(() => {
        setDraftPhone(phone ?? '');
    }, [phone]);
    const namaBersih = draftName.trim();
    const teleponBersih = draftPhone.trim();
    const namaBerubah = namaBersih !== fullName.trim();
    const teleponBerubah = teleponBersih !== (phone ?? '').trim();
    const adaPerubahan = namaBerubah || teleponBerubah;
    const namaError = draftName.length > 0 && namaBersih.length === 0 ? 'Nama tidak boleh hanya spasi.' : null;
    const namaTerlaluPanjang = namaBersih.length > NAMA_MAKS;
    const bisaSimpan = state === 'ready' && adaPerubahan && !namaError && !namaTerlaluPanjang && !saving;
    const pilihFoto = () => {
        setAvatarNotice(null);
        fileInputRef.current?.click();
    };
    const tanganiBerkas = async (file: File | undefined) => {
        if (!file)
            return;
        const masalah = avatarFileError(file);
        if (masalah) {
            setAvatarNotice({ tone: 'galat', pesan: masalah });
            return;
        }
        setAvatarBusy(true);
        setAvatarNotice(null);
        const { error } = await uploadAvatar(file);
        setAvatarBusy(false);
        if (error) {
            setAvatarNotice({ tone: 'galat', pesan: error });
            return;
        }
        setAvatarNotice({ tone: 'sukses', pesan: 'Foto profil tersimpan di akunmu.' });
        onAvatarChanged();
    };
    const hapusFoto = async () => {
        setConfirmHapus(false);
        setAvatarBusy(true);
        setAvatarNotice(null);
        const { error } = await removeAvatar();
        setAvatarBusy(false);
        if (error) {
            setAvatarNotice({ tone: 'galat', pesan: error });
            return;
        }
        setAvatarNotice({ tone: 'sukses', pesan: 'Foto profil dihapus. Inisial dipakai kembali.' });
        onAvatarChanged();
    };
    const simpanProfil = async () => {
        if (!bisaSimpan)
            return;
        setSaving(true);
        setSaveError(null);
        setSavedAt(false);
        const kirim: {
            fullName?: string;
            phone?: string;
        } = {};
        if (namaBerubah)
            kirim.fullName = namaBersih;
        if (teleponBerubah)
            kirim.phone = teleponBersih;
        const { error } = await onSaveProfile({ fullName: namaBersih, phone: teleponBersih });
        setSaving(false);
        if (error) {
            setSaveError(error);
            return;
        }
        setSavedAt(true);
    };
    const peranLabel = state === 'loading' ? 'Memuat…' : labelPeran(role);
    const badgeStatus = labelStatusAkun(accountStatus);
    const namaTampil = state === 'loading' ? 'Memuat…' : fullName.trim() || email || 'Admin';
    return (<div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader title="Profil Saya" description="Identitas akun admin, foto profil, dan batas kewenanganmu di panel ini."/>

      {state === 'error' && (<p role="alert" className="mb-4 rounded-[var(--radius)] border border-warning/25 bg-warning/5 px-4 py-3 text-sm font-medium text-charcoal-700">
          {errorMessage ?? 'Profil belum dapat dimuat dari server.'} Coba muat ulang halaman ini
          sebelum mengubah data.
        </p>)}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="px-5 py-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
              <div className="flex shrink-0 flex-col items-center gap-4">
                <div className="relative">
                  <AdminAvatar src={avatarUrl} name={fullName} email={email} size="xl" className={cn('transition-opacity duration-200 motion-reduce:transition-none', avatarBusy && 'opacity-60')}/>
                  {avatarBusy && (<span role="status" aria-label="Menyimpan foto profil" className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
                      <Loader2 aria-hidden className="h-6 w-6 animate-spin text-primary motion-reduce:animate-none"/>
                    </span>)}
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  <Button type="button" size="sm" onClick={pilihFoto} disabled={avatarBusy || state !== 'ready'}>
                    <Camera aria-hidden className="h-3.5 w-3.5"/>
                    {avatarUrl ? 'Ganti foto' : 'Unggah foto'}
                  </Button>
                  {avatarUrl &&
            (confirmHapus ? (<Button type="button" size="sm" variant="outline" onClick={hapusFoto} disabled={avatarBusy} className="border-destructive/40 text-destructive hover:border-destructive hover:bg-destructive hover:text-white">
                        <Trash2 aria-hidden className="h-3.5 w-3.5"/>
                        Ya, hapus
                      </Button>) : (<Button type="button" size="sm" variant="outline" onClick={() => setConfirmHapus(true)} disabled={avatarBusy}>
                        <Trash2 aria-hidden className="h-3.5 w-3.5"/>
                        Hapus foto
                      </Button>))}
                </div>

                {confirmHapus && (<p className="max-w-[16rem] text-center text-xs leading-relaxed text-charcoal-700">
                    Foto akan dihapus dari akun dan diganti inisial. Tindakan ini tidak dapat
                    dibatalkan.{' '}
                    <button type="button" onClick={() => setConfirmHapus(false)} className="rounded font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                      Batal
                    </button>
                  </p>)}

                <p className="text-center text-xs leading-relaxed text-charcoal-700">
                  {AVATAR_HELP_TEXT}
                </p>

                <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="sr-only" aria-label="Pilih berkas foto profil" onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            void tanganiBerkas(file);
        }}/>

                {avatarNotice && (<p role="status" aria-live="polite" className={cn('max-w-[18rem] text-center text-xs font-medium leading-relaxed', avatarNotice.tone === 'sukses' ? 'text-success' : 'text-destructive')}>
                    {avatarNotice.pesan}
                  </p>)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-display text-xl font-semibold leading-tight tracking-tight text-charcoal-900 text-balance">
                  {namaTampil}
                </p>
                <p className="mt-1 truncate text-sm text-charcoal-700">{email || '-'}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {isSuperAdmin ? (<Badge variant="success">Super Admin</Badge>) : (<Badge variant={state === 'ready' ? varianPeran(role) : 'secondary'}>
                      {peranLabel}
                    </Badge>)}
                  {badgeStatus && <Badge variant={varianStatusAkun(accountStatus)}>{badgeStatus}</Badge>}
                  {state === 'ready' && !badgeStatus && <Badge variant="success">Akun aktif</Badge>}
                </div>

                <dl className="mt-4 divide-y divide-border border-t border-border">
                  <BarisInfo label="Nomor telepon" value={phone?.trim() || 'Belum diisi'}/>
                  <BarisInfo label="Bergabung" value={formatTanggal(joinedAt)}/>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-5 py-5">
            <h2 className="font-display text-base font-semibold text-charcoal-900">
              Keamanan &amp; sesi
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-charcoal-700">
              Kata sandi dikelola lewat email pemulihan. Panel ini tidak menyimpan kata sandi
              dan tidak bisa membacanya.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/auth/forgotPassword">
                  <KeyRound aria-hidden className="h-3.5 w-3.5"/>
                  Ubah kata sandi lewat email
                </Link>
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onLogout} className="text-destructive hover:border-destructive/40 hover:text-destructive">
                <LogOut aria-hidden className="h-3.5 w-3.5"/>
                Keluar dari akun
              </Button>
            </div>

            <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-charcoal-700">
              Keluar hanya berlaku di peramban ini. Sesi di perangkat lain tidak ikut berakhir.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardContent className="px-5 py-5">
            <h2 className="font-display text-base font-semibold text-charcoal-900">Data profil</h2>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-charcoal-700">
              Nama ini yang tampil di panel admin dan pada tindakan yang tercatat di log audit.
              Email dan peran hanya dapat diubah Super Admin.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="profil-nama" className="block text-sm font-semibold text-charcoal-900">
                  Nama lengkap
                </label>
                <Input id="profil-nama" value={draftName} onChange={(event) => {
            setDraftName(event.target.value);
            setSaveError(null);
            setSavedAt(false);
        }} onBlur={() => {
            if (namaError)
                setSaveError(namaError);
        }} autoComplete="name" maxLength={NAMA_MAKS + 20} disabled={state !== 'ready' || saving} aria-invalid={Boolean(namaError) || namaTerlaluPanjang} aria-describedby="profil-nama-bantuan" className="mt-1.5 h-11"/>
                <p id="profil-nama-bantuan" className={cn('mt-1.5 text-xs leading-relaxed', namaError || namaTerlaluPanjang ? 'text-destructive' : 'text-charcoal-700')}>
                  {namaError
            ? namaError
            : namaTerlaluPanjang
                ? `Nama maksimal ${NAMA_MAKS} karakter.`
                : `Maksimal ${NAMA_MAKS} karakter.`}
                </p>
              </div>

              <div>
                <label htmlFor="profil-telepon" className="block text-sm font-semibold text-charcoal-900">
                  Nomor telepon <span className="font-normal text-charcoal-700">(opsional)</span>
                </label>
                <Input id="profil-telepon" value={draftPhone} onChange={(event) => {
            setDraftPhone(event.target.value);
            setSaveError(null);
            setSavedAt(false);
        }} type="tel" inputMode="tel" autoComplete="tel" placeholder="0812…" disabled={state !== 'ready' || saving} aria-describedby="profil-telepon-bantuan" className="mt-1.5 h-11"/>
                <p id="profil-telepon-bantuan" className="mt-1.5 text-xs leading-relaxed text-charcoal-700">
                  Dipakai admin lain untuk menghubungimu bila diperlukan.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-border pt-4">
              <Button type="button" onClick={simpanProfil} disabled={!bisaSimpan} className="min-h-[44px]">
                {saving ? (<Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none"/>) : (<Check aria-hidden className="h-4 w-4"/>)}
                {saving ? 'Menyimpan…' : 'Simpan perubahan'}
              </Button>

              {adaPerubahan && !saving && (<Button type="button" variant="ghost" onClick={() => {
                setDraftName(fullName);
                setDraftPhone(phone ?? '');
                setSaveError(null);
                setSavedAt(false);
            }}>
                  Batalkan
                </Button>)}

              <p className="min-h-[20px] text-sm" role="status" aria-live="polite">
                {saveError && <span className="font-medium text-destructive">{saveError}</span>}
                {!saveError && savedAt && !adaPerubahan && (<span className="font-medium text-success">Perubahan tersimpan di akun.</span>)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardContent className="px-5 py-5">
            <h2 className="font-display text-base font-semibold text-charcoal-900">
              Kewenangan akun
            </h2>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-charcoal-700">
              Apa yang dapat dan tidak dapat dilakukan akun ini di panel admin.
            </p>
            <AdminCapabilityList className="mt-4" isSuperAdmin={isSuperAdmin} superAdminConfigured={superAdminConfigured} accessState={accessState}/>
          </CardContent>
        </Card>
      </div>
    </div>);
}
