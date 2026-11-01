'use client';

import { RequireAuth } from '@/app/components/auth/require-auth';
import { BuyerShell } from '@/app/components/shared/buyer-shell';
import { CoinHistoryView } from '@/app/components/shared/coin-history-view';

/**
 * Halaman ReBites Coin untuk pembeli.
 *
 * Ada di sini, bukan sebagai anchor di profil, karena profil sudah menjadi
 * tempat yang padat; dan karena "Pengaturan" sudah menjanjikan tautan
 * "ReBites Coin" — tautan itu harus menuju halaman yang benar-benar ada.
 */
export default function CoinPage() {
  return (
    <RequireAuth>
      <BuyerShell>
        <CoinHistoryView />
      </BuyerShell>
    </RequireAuth>
  );
}
