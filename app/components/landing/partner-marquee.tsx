'use client';

import { useEffect, useState } from 'react';
import { Marquee } from '@/app/components/shared/marquee';

const FALLBACK_STORES = [
  'Dapur Ibu Sri',
  'Kue Mbok Darmi',
  'Warung Mang Teten',
  'Soto Mie Bogor',
  'Kopi Nusantara',
  'Bakso Pak Joko',
  'Ayam Geprek Sambal',
  'Es Teh Segar',
];

/**
 * Strip nama mitra di bawah hero.
 *
 * Dipisah dari `app/page.tsx` agar dua hal:
 * 1. `setPartners` hanya me-render ulang strip ini, bukan seluruh landing page.
 * 2. `@/lib/catalog` (dan supabase-js ± 240 kB) dimuat lewat dynamic import,
 *    jadi tidak masuk ke jalur kritis load halaman. Strip ini tetap menampilkan
 *    daftar statis sampai data tiba, persis seperti perilaku lamanya.
 */
export function PartnerMarquee() {
  const [partners, setPartners] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    import('@/lib/catalog')
      .then(({ fetchVendors }) => fetchVendors())
      .then((vendors) => {
        if (!active) return;
        setPartners(vendors.map((v) => v.name).filter(Boolean));
      })
      .catch((error) => {
        // Daftar statis tetap dipakai; gagal memuat nama mitra bukan fatal.
        console.error('[landing] gagal memuat nama mitra:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  const stores = partners.length > 0 ? partners : FALLBACK_STORES;

  return (
    <section
      data-nav="cream"
      aria-label="Mitra ReBites"
      className="border-y border-hairline bg-cream py-5 lg:py-6"
    >
      <div className="[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <Marquee pauseOnHover>
          {stores.map((p, i) => (
            <span
              key={i}
              className="mx-6 flex items-center font-display text-lg font-light tracking-tight text-primary/45 lg:text-xl"
            >
              {p}
              <span
                aria-hidden
                className="ml-6 h-1 w-1 rounded-full bg-caramel/70"
              />
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
