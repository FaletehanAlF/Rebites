'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useRequireSeller } from '@/hooks/use-require-seller';
import { SellerShellSkeleton } from '@/app/components/dashboard-penjual/SellerShellSkeleton';
import { sellerStorePath, type SellerSubPage, } from '@/lib/seller-store-path';
interface SellerStoreRedirectProps {
    sub?: SellerSubPage;
}
export function SellerStoreRedirect({ sub }: SellerStoreRedirectProps) {
    const router = useRouter();
    const { umkm, status, errorMessage, retry } = useRequireSeller();
    useEffect(() => {
        if (!umkm)
            return;
        router.replace(sellerStorePath(umkm.id, sub ?? null));
    }, [umkm, router, sub]);
    if (status === 'error') {
        return (<div className="flex min-h-screen items-center justify-center bg-secondary p-6">
        <div className="w-full max-w-md rounded-[var(--radius)] border border-border bg-white p-6 text-center shadow-admin-card">
          <WifiOff aria-hidden className="mx-auto h-10 w-10 text-destructive"/>
          <h1 className="mt-3 font-display text-lg font-semibold text-charcoal-900">
            Gagal memeriksa akses penjual
          </h1>
          <p className="mt-1.5 text-sm text-sage-500">
            {errorMessage ?? 'Tidak dapat memuat data toko. Coba lagi.'}
          </p>
          <button type="button" onClick={retry} className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <RefreshCw aria-hidden className="h-4 w-4"/>
            Coba lagi
          </button>
        </div>
      </div>);
    }
    return <SellerShellSkeleton />;
}
