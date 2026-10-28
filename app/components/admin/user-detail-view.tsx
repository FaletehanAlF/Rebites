'use client';

import { ShieldAlert, Store, User } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { UserRoleEditor } from '@/app/components/admin/user-role-editor';
import { AdminPageHeader } from './admin-page-header';
import {
  formatTanggalWaktu,
  labelPeran,
  labelStatusPenjual,
  varianPeran,
  varianStatusPenjual,
} from './admin-format';
import type { AdminUserDetail } from '@/lib/admin-users';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius)] bg-cream-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-sage-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-charcoal-900">{value}</p>
    </div>
  );
}

function SellerStatusCard({ user }: { user: AdminUserDetail }) {
  const sub = user.seller?.subscription ?? null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Store aria-hidden className="h-4 w-4 text-primary" />
          Toko & Langganan
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={varianStatusPenjual(user.seller_status)}>
            {labelStatusPenjual(user.seller_status)}
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
                  ? `${formatTanggalWaktu(sub.current_period_start)} – ${formatTanggalWaktu(sub.current_period_end)}`
                  : '-'
              }
            />
            <Field
              label="Tanggal berakhir"
              value={formatTanggalWaktu(sub?.current_period_end)}
            />
          </>
        ) : (
          <p className="rounded-[var(--radius)] bg-cream-50 px-4 py-3 text-sm text-sage-500">
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
  // Catatan: komponen ini TIDAK membuka ADMIN_PAGE_WRAPPER sendiri.
  // Halaman pemanggil (`pengguna/[id]/page.tsx`) yang menyediakan satu
  // wrapper halaman, sehingga padding horizontal tidak dobel dan kartu
  // riwayat di bawahnya sejajar.
  return (
    <>
      <AdminPageHeader
        eyebrow="Admin · Detail Pengguna"
        title={user.full_name?.trim() || user.email || 'Pengguna'}
        description="Rincian akun, status seller, dan UMKM milik pengguna ini."
        backHref="/dashboard/admin"
        backLabel="Dashboard Admin"
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User aria-hidden className="h-4 w-4 text-primary" />
              Identitas Pengguna
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={varianPeran(user.role)}>{labelPeran(user.role)}</Badge>
              {user.is_super_admin === true && (
                <Badge variant="warning" className="font-bold">
                  Super Admin
                </Badge>
              )}
              <Badge variant={user.is_verified ? 'success' : 'secondary'}>
                {user.is_verified ? 'Terverifikasi' : 'Belum terverifikasi'}
              </Badge>
            </div>
            {user.id && <Field label="ID pengguna" value={user.id} />}
            <Field label="Nama" value={user.full_name?.trim() || '-'} />
            <Field label="Email" value={user.email ?? '-'} />
            <Field label="Telepon" value={user.phone?.trim() || '-'} />
            <Field label="Terdaftar" value={formatTanggalWaktu(user.created_at)} />
          </CardContent>
        </Card>

        <SellerStatusCard user={user} />

        <UserRoleEditor
          userId={user.id}
          currentRole={user.role}
          targetIsSuperAdmin={user.is_super_admin === true}
          onChanged={onRoleChanged}
        />
      </div>
    </>
  );
}
