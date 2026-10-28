'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Gerbang muat halaman utama — bukan animasi.
 *
 * Sebelumnya komponen ini adalah preloader bermerek: lingkaran 200vmax, teks
 * masuk dari bawah, progress bar 1 detik, lalu keluar dengan `scale 0.5` +
 * `y: -160vh` selama 0.9 s. Akibatnya di sisi pengguna:
 *
 * - Seluruh halaman terkunci (body overflow hidden) sampai animasi selesai.
 * - Satu lapisan raksasa 200vmax di-scale setiap frame; inilah sumber
 *   "patah-patah" saat pertama membuka landing page di perangkat lemah.
 * - Ada tunda tetap meski halaman sudah siap.
 *
 * Sekarang tugasnya hanya menahan scroll sampai font siap. Tidak ada animasi
 * transform, tidak ada progress palsu, tidak ada tunda buatan — lapisan polos
 * dengan nama produk, hilang segera setelah font siap (atau paling lambat
 * 900 ms).
 */
export function Preloader({ onDone }: { onDone?: () => void }) {
  const [ready, setReady] = useState(false);
  const finishedRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setReady(true);
    onDoneRef.current?.();
  }, []);

  useEffect(() => {
    // Hormati preferensi sistem: tidak perlu menahan apa pun.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }

    // Batas atas: tanpa ini, font yang gagal dimuat akan mengunci halaman
    // selamanya karena `document.fonts.ready` tidak pernah selesai.
    const safety = window.setTimeout(finish, 900);

    if (typeof document !== 'undefined' && document.fonts) {
      void document.fonts.ready.then(finish).catch(finish);
    } else {
      finish();
    }

    return () => {
      window.clearTimeout(safety);
    };
  }, [finish]);

  if (ready) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[200] flex items-center justify-center bg-primary"
    >
      <span className="font-display text-2xl font-semibold tracking-tight text-cream/90">
        ReBites
      </span>
    </div>
  );
}
