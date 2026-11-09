import type { ReactNode } from 'react';
import { AdminShell } from '@/app/components/admin/admin-shell';
export default function AdminLayout({ children }: {
    children: ReactNode;
}) {
    return (<div className="admin-root">

      <AdminShell>{children}</AdminShell>

    </div>);
}
