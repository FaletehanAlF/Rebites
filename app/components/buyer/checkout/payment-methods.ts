
import { Banknote, QrCode, Wallet } from 'lucide-react';
import type { PaymentMethod } from '@/lib/types';

export const paymentMethods: PaymentMethod[] = [
  {
    id: 'qris',
    name: 'QRIS',
    description: 'Scan sekali langsung bayar',
    icon: QrCode,
  },
  {
    id: 'gopay',
    name: 'GoPay',
    description: 'Bayar cepat dari e-wallet',
    icon: Wallet,
  },
  {
    id: 'ovo',
    name: 'OVO',
    description: 'Bayar dari saldo OVO kamu',
    icon: Wallet,
  },
  {
    id: 'dana',
    name: 'DANA',
    description: 'Dompet digital DANA',
    icon: Wallet,
  },
  {
    id: 'shopeepay',
    name: 'ShopeePay',
    description: 'Bayar dari saldo ShopeePay',
    icon: Wallet,
  },
  {
    id: 'transfer-bank',
    name: 'Transfer Bank',
    description: 'Virtual account semua bank',
    icon: Banknote,
  },
];
