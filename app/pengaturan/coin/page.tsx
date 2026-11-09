'use client';
import { RequireAuth } from '@/app/components/auth/require-auth';
import { BuyerShell } from '@/app/components/shared/buyer-shell';
import { CoinHistoryView } from '@/app/components/shared/coin-history-view';
export default function CoinPage() {
    return (<RequireAuth>

      <BuyerShell>

        <CoinHistoryView />

      </BuyerShell>

    </RequireAuth>);
}
