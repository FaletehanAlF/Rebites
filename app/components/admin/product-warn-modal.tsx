'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { warnAdminProduct } from '@/lib/admin-product-moderation';
import { AdminInlineError } from './admin-state';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string | null;
  productName: string;
  onSuccess?: () => void;
}

export function ProductWarnModal({ open, onOpenChange, productId, productName, onSuccess }: Props) {
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setLevel(1);
    setCategory('');
    setReason('');
    setError('');
    setSubmitting(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async () => {
    setError('');
    if (!productId) {
      setError('Produk tidak tersedia.');
      return;
    }
    if (!category.trim()) {
      setError('Kategori wajib diisi.');
      return;
    }
    if (!reason.trim()) {
      setError('Alasan wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      await warnAdminProduct(productId, {
        level,
        category: category.trim(),
        reason: reason.trim(),
      });
      handleOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menerbitkan peringatan.');
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Beri peringatan produk</DialogTitle>
          <DialogDescription>
            Peringatan untuk UMKM pemilik &ldquo;{productName}&rdquo;. Notifikasi muncul di
            dashboard penjual; riwayat tercatat dan tidak bisa diubah UMKM.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-sage-500">Tingkat</label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {([1, 2, 3] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  className={`rounded-[var(--radius)] border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    level === l
                      ? 'border-primary bg-primary text-primary-foreground-strong'
                      : 'border-border bg-white text-charcoal-700 hover:bg-sage-100/40'
                  }`}
                >
                  Tingkat {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-sage-500">Kategori</label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Contoh: foto tidak sesuai, deskripsi menyesatkan"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-sage-500">
              Alasan + permintaan perbaikan
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan pelanggaran dan apa yang harus diperbaiki UMKM."
              className="mt-1"
              rows={3}
            />
          </div>
          <AdminInlineError message={error} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Batal
          </Button>
          <Button type="button" disabled={submitting} onClick={submit}>
            {submitting ? 'Menyimpan…' : 'Kirim Peringatan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
