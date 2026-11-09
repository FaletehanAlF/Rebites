'use client';
import { ShieldAlert, Store, User } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { UserRoleEditor } from '@/app/components/admin/user-role-editor';
import { SoftDeletePanel } from './soft-delete-panel';
import { HardDeletePanel } from './hard-delete-panel';
import { AccountBlockPanel } from './account-block-panel';
import { AdminPageHeader } from './admin-page-header';
import { AdminAvatar } from './admin-avatar';
import { formatTanggalWaktu, labelPeran, labelStatusAkun, labelStatusPenjual, varianPeran, varianStatusAkun, varianStatusPenjual, } from './admin-format';
import type { AdminUserDetail } from '@/lib/admin-users';
import { setAdminUserDeletion } from '@/lib/admin-users';
function Field({ label, value }: {
    label: string;
    value: string;
}) {
    return (<div className="rounded-[var(--radius)] bg-cream-50 px-4 py-3">

      <p className="text-xs font-bold uppercase tracking-[0.14em] text-sage-500">

        {label}

      </p>

      <p className="mt-1 break-words text-sm font-semibold text-charcoal-900">{value}</p>

    </div>);
}
function SellerStatusCard({ user }: {
    user: AdminUserDetail;
}) {
    const sub = user.seller?.subscription ?? null;
    return (<Card>

      <CardHeader>

        <CardTitle className="flex items-center gap-2 text-base">

          <Store aria-hidden className="h-4 w-4 text-primary"/>

          Toko & Langganan

        </CardTitle>

      </CardHeader>

      <CardContent className="grid gap-4">

        <div className="flex flex-wrap items-center gap-2">

          <Badge variant={varianStatusPenjual(user.seller_status)}>

            {labelStatusPenjual(user.seller_status)}

          </Badge>

        </div>

        {user.seller ? (<>

            <Field label="Nama toko" value={user.seller.business_name ?? '-'}/>

            <Field label="Status verifikasi toko" value={user.seller.is_verified ? 'Terverifikasi' : 'Belum terverifikasi'}/>

            <Field label="Paket" value={sub?.plan_name ?? '-'}/>

            <Field label="Status subscription" value={sub?.status ?? '-'}/>

            <Field label="Periode subscription" value={sub?.current_period_start || sub?.current_period_end
                ? `${formatTanggalWaktu(sub.current_period_start)} – ${formatTanggalWaktu(sub.current_period_end)}`
                : '-'}/>

            <Field label="Tanggal berakhir" value={formatTanggalWaktu(sub?.current_period_end)}/>

          </>) : (<p className="rounded-[var(--radius)] bg-cream-50 px-4 py-3 text-sm text-sage-500">

            Pengguna ini belum memiliki toko.

          </p>)}

      </CardContent>

    </Card>);
}
export function UserDetailView({ user, onRoleChanged, onDeleted, }: {
    user: AdminUserDetail;
    onRoleChanged: () => void;
    onDeleted: () => void;
}) {
    return (<>

      <AdminPageHeader title={user.full_name?.trim() || user.email || 'Pengguna'} description="Rincian akun, status seller, dan UMKM milik pengguna ini."/>



      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">

        <Card>

          <CardHeader>

            <CardTitle className="flex items-center gap-2 text-base">

              <User aria-hidden className="h-4 w-4 text-primary"/>

              Identitas Pengguna

            </CardTitle>

          </CardHeader>

          <CardContent className="grid gap-4">

            

            <div className="flex items-center gap-4">

              <AdminAvatar src={user.avatar_url} name={user.full_name} email={user.email} size="lg"/>

              <div className="min-w-0">

                <p className="truncate font-display text-base font-semibold text-charcoal-900">

                  {user.full_name?.trim() || user.email || 'Pengguna'}

                </p>

                <p className="truncate text-sm text-sage-500">{user.email ?? '-'}</p>

              </div>

            </div>

            <div className="flex flex-wrap items-center gap-2">

              <Badge variant={varianPeran(user.role)}>{labelPeran(user.role)}</Badge>

              {user.is_super_admin === true && (<Badge variant="warning" className="font-bold">

                  Super Admin

                </Badge>)}

              {user.deleted_at && (<Badge variant="destructive" className="font-bold">

                  Akun dihapus

                </Badge>)}

              

              {labelStatusAkun(user.account_status) && (<Badge variant={varianStatusAkun(user.account_status)} className="font-bold">

                  {labelStatusAkun(user.account_status)}

                </Badge>)}

              <Badge variant={user.is_verified ? 'success' : 'secondary'}>

                {user.is_verified ? 'Terverifikasi' : 'Belum terverifikasi'}

              </Badge>

            </div>

            {user.id && <Field label="ID pengguna" value={user.id}/>}

            <Field label="Nama" value={user.full_name?.trim() || '-'}/>

            <Field label="Email" value={user.email ?? '-'}/>

            <Field label="Telepon" value={user.phone?.trim() || '-'}/>

            <Field label="Terdaftar" value={formatTanggalWaktu(user.created_at)}/>

          </CardContent>

        </Card>



        <SellerStatusCard user={user}/>



        <UserRoleEditor userId={user.id} currentRole={user.role} targetIsSuperAdmin={user.is_super_admin === true} onChanged={onRoleChanged}/>



        

        <AccountBlockPanel userId={user.id} name={user.full_name?.trim() || user.email || 'pengguna ini'} accountStatus={user.account_status} targetRole={user.role} targetProtected={user.is_super_admin === true} onChanged={onRoleChanged}/>



        

        <SoftDeletePanel kind="user" targetId={user.id} name={user.full_name?.trim() || user.email || 'pengguna ini'} deletedAt={user.deleted_at} deletionReason={user.deletion_reason} targetProtected={user.is_super_admin === true} onDelete={async (reason) => {
            if (!user.id)
                throw new Error('ID pengguna tidak tersedia.');
            await setAdminUserDeletion(user.id, true, reason);
        }} onRestore={async () => {
            if (!user.id)
                throw new Error('ID pengguna tidak tersedia.');
            await setAdminUserDeletion(user.id, false);
        }} onChanged={onRoleChanged}/>



        

        <HardDeletePanel userId={user.id} name={user.full_name?.trim() || user.email || 'pengguna ini'} targetProtected={user.is_super_admin === true} onDeleted={onDeleted}/>

      </div>

    </>);
}
