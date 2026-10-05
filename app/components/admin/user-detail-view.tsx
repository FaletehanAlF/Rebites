'use client';

import Link from 'next/link';
import { ArrowLeft, ShieldAlert, Store, User } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { UserRoleEditor } from '@/app/components/admin/user-role-editor';
import type { AdminUserDetail } from '@/lib/admin-users';

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function roleBadgeVariant(role: string | null): 'default' | 'secondary' | 'success' {
  if (role === 'admin') return 'default';
  if (role === 'umkm') return 'success';
  return 'secondary';
}

function roleLabel(role: string | null): string {
  if (role === 'admin') return 'Admin';
  if (role === 'umkm') return 'UMKM';
  if (role === 'buyer') return 'Buyer';
  return role ?? '-';
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-cream-50 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sage-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-charcoal-900">{value}</p>
    </div>
  );
}

function sellerStatusBadgeVariant(
  status: AdminUserDetail['seller_status']
): 'success' | 'warning' | 'secondary' {
  if (status === 'active') return 'success';
  if (status === 'no_subscription') return 'warning';
  return 'secondary';
}

function sellerStatusLabel(status: AdminUserDetail['seller_status']): string {
  if (status === 'active') return 'Aktif';
  if (status === 'no_subscription') return 'Langganan tidak aktif';
  return 'Belum punya toko';
}

function SellerStatusCard({ user }: { user: AdminUserDetail }) {
  const sub = user.seller?.subscription ?? null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Store className="h-4 w-4 text-primary" />
          Status Seller
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={sellerStatusBadgeVariant(user.seller_status)}>
            {sellerStatusLabel(user.seller_status)}
          </Badge>
        </div>
        {user.seller ? (
          <>
            <Field label="Nama toko" value={user.seller.business_name ?? '-'} />
            <Field
              label="Status verifikasi toko"
              value={user.seller.is_verified ? 'Terverifikasi' : 'Belum terverifikasi'}
            />
            <Field label="Paket" value={sub?.plan_name ?? '-'} />
            <Field label="Status subscription" value={sub?.status ?? '-'} />
            <Field
              label="Periode subscription"
              value={
                sub?.current_period_start || sub?.current_period_end
                  ? `${formatDateTime(sub.current_period_start)} – ${formatDateTime(sub.current_period_end)}`
                  : '-'
              }
            />
            <Field label="Tanggal berakhir" value={formatDateTime(sub?.current_period_end)} />
          </>
        ) : (
          <p className="rounded-xl bg-cream-50 px-4 py-3 text-sm text-sage-500">
            Pengguna ini belum memiliki toko.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function UserDetailView({
  user,
  onRoleChanged,
}: {
  user: AdminUserDetail;
  onRoleChanged: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/admin/pengguna"
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-semibold text-charcoal-500 transition-colors hover:bg-white hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Daftar Pengguna
      </Link>

      <div className="mt-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-caramel">
          Admin · Detail Pengguna
        </p>
        <h1 className="mt-1 break-words font-display text-[clamp(1.6rem,3.5vw,2.4rem)] font-semibold tracking-tight text-primary">
          {user.full_name?.trim() || user.email || 'Pengguna'}
        </h1>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" />
              Data Akun
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={roleBadgeVariant(user.role)}>{roleLabel(user.role)}</Badge>
              <Badge variant={user.is_verified ? 'success' : 'secondary'}>
                {user.is_verified ? 'Terverifikasi' : 'Belum terverifikasi'}
              </Badge>
            </div>
            <Field label="Email" value={user.email ?? '-'} />
            <Field label="Nama" value={user.full_name?.trim() || '-'} />
            <Field label="Telepon" value={user.phone?.trim() || '-'} />
            <Field label="Terdaftar" value={formatDateTime(user.created_at)} />
          </CardContent>
        </Card>

        <SellerStatusCard user={user} />

        <UserRoleEditor userId={user.id} currentRole={user.role} onChanged={onRoleChanged} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4 text-primary" />
              Status UMKM
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {user.has_umkm && user.umkm ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={user.umkm.is_verified ? 'success' : 'secondary'}>
                    {user.umkm.is_verified ? 'Toko terverifikasi' : 'Toko belum terverifikasi'}
                  </Badge>
                </div>
                <Field label="Nama toko" value={user.umkm.business_name ?? '-'} />
                <Field label="Slug" value={user.umkm.slug ?? '-'} />
                <Field label="Alamat" value={user.umkm.address?.trim() || '-'} />
                <Field label="Kota" value={user.umkm.city?.trim() || '-'} />
                <Field label="Kode pos" value={user.umkm.postal_code?.trim() || '-'} />
                <Field label="Telepon toko" value={user.umkm.phone?.trim() || '-'} />
              </>
            ) : (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <ShieldAlert className="h-8 w-8 text-sage-500" />
                <p className="mt-3 text-sm font-semibold text-charcoal-900">
                  Tidak memiliki toko
                </p>
                <p className="mt-1 max-w-sm text-xs text-sage-500">
                  Pengguna ini belum terdaftar sebagai pemilik UMKM di umkm_profiles.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
