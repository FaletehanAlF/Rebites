'use client';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Gavel, ShieldCheck } from 'lucide-react';
import { BuyerShell } from '@/app/components/shared/buyer-shell';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';
import { useCurrentUser } from '@/lib/current-user';
import { supabase } from '@/lib/supabase';
function formatWaktu(iso: string | null): string {
    if (!iso)
        return '-';
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime()))
        return '-';
    try {
        return parsed.toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    catch {
        return '-';
    }
}
type AccountStatus = 'active' | 'suspended' | 'banned';
const STATUS_META: Record<AccountStatus, {
    label: string;
    hint: string;
    variant: 'success' | 'warning' | 'destructive';
}> = {
    active: {
        label: 'Aktif',
        hint: 'Akun Anda dapat digunakan seperti biasa.',
        variant: 'success',
    },
    suspended: {
        label: 'Ditangguhkan',
        hint: 'Akun Anda sedang ditangguhkan. Hubungi admin bila menurut Anda ini keliru.',
        variant: 'warning',
    },
    banned: {
        label: 'Diblokir',
        hint: 'Akun Anda diblokir. Hubungi admin bila menurut Anda ini keliru.',
        variant: 'destructive',
    },
};
interface SanctionRow {
    id: string;
    sanctionType: string;
    reason: string;
    startAt: string | null;
    endAt: string | null;
}
interface WarningRow {
    id: string;
    level: number;
    category: string;
    reason: string;
    createdAt: string;
}
function sanctionLabel(type: string): string {
    switch (type) {
        case 'suspend':
            return 'Penangguhan';
        case 'ban':
            return 'Pemblokiran';
        case 'delete':
            return 'Catatan sanksi';
        default:
            return type;
    }
}
function isSanctionActive(row: SanctionRow): boolean {
    if (row.sanctionType === 'delete')
        return false;
    if (!row.endAt)
        return true;
    const end = new Date(row.endAt).getTime();
    return Number.isFinite(end) ? end > Date.now() : true;
}
export function AccountSanctionsView() {
    const { userId, loading: userLoading } = useCurrentUser();
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [accountStatus, setAccountStatus] = useState<AccountStatus>('active');
    const [sanctions, setSanctions] = useState<SanctionRow[]>([]);
    const [warnings, setWarnings] = useState<WarningRow[]>([]);
    const load = useCallback(async () => {
        if (!userId)
            return;
        setStatus('loading');
        try {
            const [profileRes, sanctionsRes, warningsRes] = await Promise.all([
                supabase.from('profiles').select('account_status').eq('id', userId).maybeSingle(),
                supabase
                    .from('sanctions')
                    .select('id, sanction_type, reason, start_at, end_at')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(50),
                supabase
                    .from('warnings')
                    .select('id, warning_level, category, reason, created_at')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(50),
            ]);
            const failed = [profileRes, sanctionsRes, warningsRes].find((res) => res.error);
            if (failed?.error) {
                console.error('[akun/sanksi] gagal memuat data:', failed.error.message);
                setStatus('error');
                return;
            }
            const rawStatus = (profileRes.data as {
                account_status?: string | null;
            } | null)?.account_status;
            setAccountStatus(rawStatus === 'suspended' || rawStatus === 'banned' ? rawStatus : 'active');
            setSanctions(((sanctionsRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
                id: String(row.id ?? ''),
                sanctionType: String(row.sanction_type ?? ''),
                reason: String(row.reason ?? ''),
                startAt: typeof row.start_at === 'string' ? row.start_at : null,
                endAt: typeof row.end_at === 'string' ? row.end_at : null,
            })));
            setWarnings(((warningsRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
                id: String(row.id ?? ''),
                level: Number(row.warning_level ?? 0),
                category: String(row.category ?? ''),
                reason: String(row.reason ?? ''),
                createdAt: String(row.created_at ?? ''),
            })));
            setStatus('ready');
        }
        catch (err) {
            console.error('[akun/sanksi] unexpected', err);
            setStatus('error');
        }
    }, [userId]);
    useEffect(() => {
        if (userLoading)
            return;
        if (!userId)
            return;
        void load();
    }, [userLoading, userId, load]);
    const meta = STATUS_META[accountStatus];
    const activeSanctions = sanctions.filter(isSanctionActive);
    return (<BuyerShell>
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-10">
        <header>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-primary">
            Status &amp; Sanksi Akun
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Peringatan dan sanksi yang pernah dikenakan pada akun Anda.
          </p>
        </header>

        {status === 'loading' && (<div role="status" className="space-y-3">
            {[1, 2].map((i) => (<Skeleton key={i} className="h-24 rounded-2xl"/>))}
            <span className="sr-only">Memuat status akun</span>
          </div>)}

        {status === 'error' && (<Card>
            <CardContent className="flex flex-col items-start gap-3 p-5">
              <p role="alert" className="text-sm text-charcoal-900">
                Gagal memuat status akun. Periksa koneksi lalu coba lagi.
              </p>
              <button type="button" onClick={() => void load()} className="inline-flex min-h-[44px] items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                Coba lagi
              </button>
            </CardContent>
          </Card>)}

        {status === 'ready' && (<>
            <Card>
              <CardContent className="flex items-start gap-3 p-5">
                <span className={accountStatus === 'active'
                ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'
                : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive'}>
                  {accountStatus === 'active' ? (<ShieldCheck aria-hidden className="h-5 w-5"/>) : (<AlertTriangle aria-hidden className="h-5 w-5"/>)}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Status akun
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-semibold text-charcoal-900">
                      {meta.label}
                    </span>
                    <Badge variant={meta.variant}>{accountStatus}</Badge>
                    {activeSanctions.length > 0 && (<Badge variant="destructive">
                        {activeSanctions.length} sanksi berlaku
                      </Badge>)}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-charcoal-700">{meta.hint}</p>
                </div>
              </CardContent>
            </Card>

            <section aria-labelledby="judul-sanksi" className="space-y-3">
              <h2 id="judul-sanksi" className="font-display text-base font-semibold text-charcoal-900">
                Sanksi
              </h2>
              {sanctions.length === 0 ? (<Card>
                  <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
                    <Gavel aria-hidden className="h-5 w-5 shrink-0 text-primary"/>
                    Tidak ada sanksi pada akun Anda.
                  </CardContent>
                </Card>) : (<ul className="space-y-2.5">
                  {sanctions.map((row) => {
                    const aktif = isSanctionActive(row);
                    return (<li key={row.id}>
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-charcoal-900">
                                {sanctionLabel(row.sanctionType)}
                              </span>
                              <Badge variant={aktif ? 'destructive' : 'secondary'}>
                                {aktif ? 'Masih berlaku' : 'Sudah berakhir'}
                              </Badge>
                            </div>
                            <p className="mt-1.5 break-words text-sm leading-relaxed text-charcoal-700">
                              {row.reason || '-'}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Mulai {formatWaktu(row.startAt)} ·{' '}
                              {row.endAt
                            ? `Berakhir ${formatWaktu(row.endAt)}`
                            : 'Sampai dicabut admin'}
                            </p>
                          </CardContent>
                        </Card>
                      </li>);
                })}
                </ul>)}
            </section>

            <section aria-labelledby="judul-peringatan" className="space-y-3">
              <h2 id="judul-peringatan" className="font-display text-base font-semibold text-charcoal-900">
                Peringatan
              </h2>
              {warnings.length === 0 ? (<Card>
                  <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
                    <ShieldCheck aria-hidden className="h-5 w-5 shrink-0 text-primary"/>
                    Tidak ada peringatan pada akun Anda.
                  </CardContent>
                </Card>) : (<ul className="space-y-2.5">
                  {warnings.map((row) => (<li key={row.id}>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-charcoal-900">
                              Peringatan ke-{row.level}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatWaktu(row.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1.5 break-words text-sm leading-relaxed text-charcoal-700">
                            {row.reason || '-'}
                          </p>
                          {row.category && (<p className="mt-1 text-xs text-muted-foreground">
                              Kategori: {row.category}
                            </p>)}
                        </CardContent>
                      </Card>
                    </li>))}
                </ul>)}
            </section>
          </>)}
      </div>
    </BuyerShell>);
}
