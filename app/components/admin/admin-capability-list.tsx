'use client';
import { ShieldCheck, UserCog } from 'lucide-react';
import { adminCapabilities, superAdminCapabilities, type AdminCapability, } from '@/lib/admin-capabilities';
import { cn } from '@/lib/utils';
function CapabilityRow({ item }: {
    item: AdminCapability;
}) {
    return (<li className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
      <span aria-hidden className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full', item.requires === 'super-admin'
            ? 'bg-primary/10 text-primary'
            : 'bg-sage-100 text-charcoal-700')}>
        {item.requires === 'super-admin' ? (<ShieldCheck className="h-3.5 w-3.5"/>) : (<UserCog className="h-3.5 w-3.5"/>)}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-charcoal-900">{item.label}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-charcoal-700">{item.description}</p>
      </div>
    </li>);
}
function CapabilityGroup({ title, hint, items, }: {
    title: string;
    hint: string;
    items: AdminCapability[];
}) {
    return (<section>
      <h3 className="text-sm font-semibold text-charcoal-900">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-charcoal-700">{hint}</p>
      <ul className="mt-3 divide-y divide-border">
        {items.map((item) => (<CapabilityRow key={item.action} item={item}/>))}
      </ul>
    </section>);
}
export function AdminCapabilityList({ isSuperAdmin, superAdminConfigured, accessState, className, }: {
    isSuperAdmin: boolean;
    superAdminConfigured: boolean;
    accessState: 'loading' | 'verified' | 'unverified' | 'error';
    className?: string;
}) {
    return (<div className={cn('space-y-6', className)}>
      {accessState === 'loading' && (<p role="status" className="text-sm text-charcoal-700">
          Memeriksa kewenangan akun…
        </p>)}

      {accessState === 'error' && (<p role="alert" className="rounded-[var(--radius)] border border-warning/25 bg-warning/5 px-4 py-3 text-sm font-medium text-charcoal-700">
          Kewenangan akun belum dapat dipastikan karena pemeriksaan ke server gagal. Selama
          belum terverifikasi, hak Super Admin tidak diberikan.
        </p>)}

      {accessState === 'verified' && (<p className={cn('rounded-[var(--radius)] border px-4 py-3 text-sm font-medium', isSuperAdmin
                ? 'border-primary/25 bg-primary/5 text-charcoal-900'
                : 'border-border bg-sage-100/40 text-charcoal-700')}>
          {isSuperAdmin
                ? 'Akun ini adalah Super Admin: seluruh kewenangan di bawah tersedia.'
                : 'Akun ini admin tim: kewenangan operasional tersedia, sedangkan tindakan yang mengubah hak akses orang lain hanya dapat dilakukan Super Admin.'}
        </p>)}

      {accessState === 'verified' && isSuperAdmin && !superAdminConfigured && (<p role="status" className="rounded-[var(--radius)] border border-warning/25 bg-warning/5 px-4 py-3 text-sm text-charcoal-700">
          Penunjukan Super Admin belum aktif di server, sehingga kewenangan khusus belum
          dapat dijalankan oleh siapa pun. Isi <code>SUPER_ADMIN_USER_ID</code> di server
          untuk mengaktifkannya.
        </p>)}

      <CapabilityGroup title="Berlaku untuk semua admin" hint="Operasional harian: moderasi, peringatan, dan sanksi untuk pembeli maupun UMKM." items={adminCapabilities()}/>

      <CapabilityGroup title="Hanya Super Admin" hint="Tindakan yang mengubah hak akses, menghapus data, atau menarik dagangan orang lain." items={superAdminCapabilities()}/>
    </div>);
}
