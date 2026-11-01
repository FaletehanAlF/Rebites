'use client';

import { ArrowRight, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent } from '@/app/components/ui/dialog';
import { formatRupiah } from '@/lib/data';
import { useCheckout } from './checkout-context';

/**
 * Tahap 1 (konsistensi harga): konfirmasi bila total yang dihitung server
 * berbeda dari total yang tampil di halaman checkout (harga katalog, ongkir,
 * atau koin berubah antara load dan submit). User harus menyetujui nominal
 * server sebelum diarahkan ke halaman pembayaran Xendit — tidak ada redirect
 * diam-diam dengan nominal yang berbeda dari yang terlihat.
 *
 * Tombol "Kembali & Perbarui Tampilan" memuat ulang halaman agar seluruh
 * ringkasan (harga, ongkir, koin) dihitung ulang dari data terbaru. Invoice
 * yang sudah dibuat tidak dipakai bila user memilih kembali; invoice tersebut
 * kedaluwarsa sendiri mengikuti masa berlaku Xendit.
 */
export function CheckoutPriceReviewDialog() {
  const { pendingInvoiceReview, continueToInvoice } = useCheckout();

  return (
    <Dialog open={Boolean(pendingInvoiceReview)} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md gap-0 rounded-3xl border-sage-100 bg-white p-6 sm:p-7 [&>button]:hidden"
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        {pendingInvoiceReview && (
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <RefreshCw className="h-8 w-8" />
            </span>
            <h2 className="mt-4 font-display text-xl font-semibold tracking-tight text-charcoal-900">
              Total Pesanan Diperbarui
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-charcoal-500">
              Harga atau total berubah sejak halaman ini dibuka. Sistem selalu
              menghitung ulang dari data terbaru saat pesanan dibuat — nominal
              berikut yang akan dibayar di Xendit.
            </p>

            <div className="mt-5 w-full space-y-2.5 rounded-2xl border border-sage-100 bg-cream-50 p-4 text-sm">
              <div className="flex items-center justify-between gap-3 text-charcoal-500">
                <span>Total sebelumnya</span>
                <span className="tabular-nums line-through">
                  {formatRupiah(pendingInvoiceReview.displayTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-sage-100 pt-2.5 font-medium text-charcoal-900">
                <span>Total terbaru</span>
                <span className="font-display text-base font-semibold tabular-nums text-primary">
                  {formatRupiah(pendingInvoiceReview.serverTotal)}
                </span>
              </div>
            </div>

            <div className="mt-5 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-primary px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-caramel hover:text-white"
              >
                Kembali & Perbarui Tampilan
              </button>
              <button
                type="button"
                onClick={continueToInvoice}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-caramel"
              >
                Lanjutkan ke Pembayaran
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
