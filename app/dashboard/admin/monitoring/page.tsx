'use client';

import { MonitoringOverview } from '@/app/components/admin/monitoring-overview';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER } from '@/app/components/admin/admin-page-header';

export default function AdminMonitoringPage() {
  return (
    <div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader
        eyebrow="Admin · Monitoring"
        title="Monitoring"
        description="Pusat kontrol aktivitas, laporan, peringatan, sanksi, dan audit ReBites."
      />
      <MonitoringOverview />
    </div>
  );
}