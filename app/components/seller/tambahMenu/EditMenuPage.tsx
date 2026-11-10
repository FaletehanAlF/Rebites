'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { SellerShell } from '@/app/components/seller/dashboard-penjual/SellerShell';
import { Skeleton } from '@/app/components/ui/skeleton';
import { EditProductForm } from './EditProductForm';
import { getSellerProductById, type SellerProduct } from '@/lib/product-storage';
import { sellerStorePath } from '@/lib/seller-store-path';
import { useStoreRouteId } from '@/hooks/use-store-route-id';

export function EditMenuPage() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const productId = typeof params?.id === 'string' ? params.id : '';
  const routeStoreId = useStoreRouteId();
  const backHref = sellerStorePath(routeStoreId, 'menu');

  const [product, setProduct] = useState<SellerProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [fokusBerat, setFokusBerat] = useState(false);

  useEffect(() => {
    setFokusBerat(new URLSearchParams(window.location.search).get('fokus') === 'berat');
  }, []);

  useEffect(() => {
    let aktif = true;
    (async () => {
      const found = productId ? await getSellerProductById(productId) : undefined;
      if (!aktif) return;
      setProduct(found ?? null);
      setLoading(false);
    })();
    return () => {
      aktif = false;
    };
  }, [productId]);

  const kembali = () => router.push(backHref);

  return (
    <SellerShell>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Menu Saya
      </Link>

      <h1 className="mt-4 font-display text-[clamp(1.8rem,4vw,2.6rem)] font-medium leading-tight tracking-[-0.02em] text-primary">
        Ubah Menu
      </h1>

      {loading ? (
        <div role="status" aria-label="Memuat menu" className="mt-6 space-y-4">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : !product ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-border bg-white p-8 text-center">
          <p className="text-sm font-bold text-foreground">Menu tidak ditemukan</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Menu ini mungkin sudah dihapus.
          </p>
          <Link
            href={backHref}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Menu Saya
          </Link>
        </div>
      ) : (
        <div className="mt-4 max-w-2xl rounded-2xl border border-border bg-white p-4 sm:p-5">
          <EditProductForm
            product={product}
            onDone={kembali}
            onCancel={kembali}
            initialShowAdvanced={fokusBerat}
          />
        </div>
      )}
    </SellerShell>
  );
}
