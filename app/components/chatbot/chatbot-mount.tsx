'use client';

import dynamic from 'next/dynamic';

/**
 * Titik pemasangan widget asisten, dipakai sekali di `app/layout.tsx`.
 *
 * Dimuat dengan `ssr: false` karena widget membaca `sessionStorage` saat mount.
 * Merendernya di server akan menghasilkan markup awal yang berbeda dari klien
 * (hydration mismatch) — galat yang sulit dilacak dan tidak terlihat di build.
 *
 * `loading` sengaja kosong: widget bersifat tambahan, jadi tidak boleh ada
 * kerangka atau placeholder yang berkedip di setiap halaman.
 */
const ChatbotWidget = dynamic(() => import('./chatbot-widget'), {
  ssr: false,
  loading: () => null,
});

export function ChatbotMount() {
  return <ChatbotWidget />;
}
