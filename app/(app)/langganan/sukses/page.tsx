import type { Metadata } from 'next';
import { SubscriptionSuccessClient } from '@/app/components/seller/subscription/subscription-success-client';
import { RequireAuth } from '@/app/components/auth/require-auth';

export const metadata: Metadata = {
  title: 'Langganan Aktif | ReBites',
  description: 'Langganan paket penjual ReBites berhasil diaktifkan.',
};

interface SuccessPageProps {
  searchParams?: { plan?: string; billing?: string; external_id?: string };
}

export default function SubscriptionSuccessPage({ searchParams }: SuccessPageProps) {
  return (
    <RequireAuth>
      <SubscriptionSuccessClient
        planSlug={searchParams?.plan}
        billingParam={searchParams?.billing}
        externalId={searchParams?.external_id}
      />
    </RequireAuth>
  );
}
