'use client';

import { useParams } from 'next/navigation';
import { UmkmDetailView } from '@/app/components/admin/umkm-detail-view';

export default function AdminUmkmDetailPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';

  return (
    <>
      {id ? <UmkmDetailView id={id} /> : null}
    </>
  );
}
