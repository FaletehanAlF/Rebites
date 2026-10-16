'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CoinTransaction, CoinTransactionType } from '@/lib/types';

const COINS_UPDATED_EVENT = 'rebites-coins-updated';

export interface CoinsSnapshot {
  balance: number;
  totalEarned: number;
  transactions: CoinTransaction[];
}

const EMPTY_SNAPSHOT: CoinsSnapshot = {
  balance: 0,
  totalEarned: 0,
  transactions: [],
};

function dispatchUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(COINS_UPDATED_EVENT));
}

type CoinRow = Record<string, any>;

function rowToTransaction(row: CoinRow): CoinTransaction {
  return {
    id: row.id,
    orderId: row.order_code ?? undefined,
    type: row.type as CoinTransactionType,
    amount: Number(row.amount),
    createdAt: row.created_at,
    description: row.description ?? '',
  };
}

function deriveSnapshot(transactions: CoinTransaction[]): CoinsSnapshot {
  let earned = 0;
  let spent = 0;
  for (const tx of transactions) {
    if (tx.type === 'earned') earned += tx.amount;
    else spent += tx.amount;
  }
  return {
    balance: Math.max(0, earned - spent),
    totalEarned: earned,
    transactions,
  };
}

async function fetchTransactions(userId: string): Promise<CoinTransaction[]> {
  const { data, error } = await supabase
    .from('coin_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('[use-rebites-coins] gagal memuat transaksi:', error.message);
    return [];
  }
  return (data ?? []).map(rowToTransaction);
}

export async function settleOrderCoins(
  orderId: string,
  { spent, earned }: { spent: number; earned: number }
): Promise<boolean> {
  if (!orderId) return false;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return false;

  const { data: existing } = await supabase
    .from('coin_transactions')
    .select('order_code, type')
    .eq('user_id', userId)
    .eq('order_code', orderId);
  const existingTypes = new Set((existing ?? []).map((row) => row.type));

  const pending: Record<string, unknown>[] = [];
  if (Number.isFinite(spent) && spent > 0 && !existingTypes.has('spent')) {
    pending.push({
      user_id: userId,
      order_code: orderId,
      type: 'spent',
      amount: Math.round(spent),
      description: 'Potongan pesanan',
    });
  }
  if (Number.isFinite(earned) && earned > 0 && !existingTypes.has('earned')) {
    pending.push({
      user_id: userId,
      order_code: orderId,
      type: 'earned',
      amount: Math.round(earned),
      description: 'Reward pembelian',
    });
  }

  if (pending.length === 0) return false;
  const { error } = await supabase.from('coin_transactions').insert(pending);
  if (error) {
    console.error('[use-rebites-coins] gagal mencatat koin:', error.message);
    return false;
  }
  dispatchUpdated();
  return true;
}

export function useRebitesCoins(): CoinsSnapshot {
  const [snapshot, setSnapshot] = useState<CoinsSnapshot>(EMPTY_SNAPSHOT);

  const channelIdRef = useRef(
    `rebites-coin-transactions-${Math.random().toString(36).slice(2)}`
  );

  const refresh = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) {
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }
    setSnapshot(deriveSnapshot(await fetchTransactions(userId)));
  }, []);

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel(channelIdRef.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coin_transactions' },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return snapshot;
}
