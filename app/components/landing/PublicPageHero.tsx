import type { ReactNode } from 'react';
import { Reveal } from '@/app/components/shared/reveal';

/**
 * Pembuka setiap halaman pendukung situs publik (`/tentang-kami`,
 * `/fitur`, `/dampak`, `/hubungi-kami`).
 *
 * Satu komponen untuk empat halaman supaya tinggi padding, ukuran judul, dan
 * jarak ke konten selalu identik — navbar tetap menutupi bagian atas,
 * karena itu ada padding atas yang besar.
 */
export function PublicPageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="grain-overlay border-b border-border bg-secondary">
      <div className="mx-auto w-full max-w-7xl px-4 pb-14 pt-28 sm:px-6 sm:pb-16 sm:pt-32 lg:px-8 lg:pb-20 lg:pt-36">
        <Reveal>
          <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-3xl text-balance font-display text-[clamp(2rem,4.4vw,3.25rem)] font-semibold leading-[1.07] tracking-[-0.035em] text-primary">
            {title}
          </h1>
          {lead && (
            <p className="mt-5 max-w-2xl text-base leading-[1.75] text-muted-foreground sm:text-[1.0625rem]">
              {lead}
            </p>
          )}
          {children && <div className="mt-8">{children}</div>}
        </Reveal>
      </div>
    </section>
  );
}
