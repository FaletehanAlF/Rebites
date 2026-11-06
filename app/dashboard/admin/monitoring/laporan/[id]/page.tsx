'use client';

import { ReportDetailView } from '@/app/components/admin/report-detail-view';

export default function AdminMonitoringLaporanDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <ReportDetailView reportId={params.id} />;
}
