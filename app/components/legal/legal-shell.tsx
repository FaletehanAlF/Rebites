import Link from 'next/link';
import type { ReactNode } from 'react';
import { LandingNavbar } from '@/app/components/landing/LandingNavbar';
import { LandingFooter } from '@/app/components/landing/LandingFooter';

interface LegalShellProps {
  title: string;
  summary: string;
  updatedAt: string;
  children: ReactNode;
}

/**
 * Kerangka halaman legal publik (Privacy Policy, Terms of Use).
 *
 * Sengaja TANPA penjaga sesi: kedua halaman harus dapat dibuka tanpa login,
 * termasuk oleh pengunjung yang belum punya akun dan oleh peninjau pihak
 * ketiga (mis. verifikasi OAuth Google, yang mensyaratkan tautan Privacy
 * Policy dan Terms of Service pada aplikasi produksi).
 *
 * Memakai navbar/footer landing agar identitas visualnya sama dengan halaman
 * publik lain, dan `pt-28` menyediakan ruang untuk navbar `fixed`.
 */
export function LegalShell({
  title,
  summary,
  updatedAt,
  children,
}: LegalShellProps) {
  return (
    <>
      <LandingNavbar />
      <main className="bg-background pb-20 pt-28 sm:pt-32">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Legal
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 font-sans text-[15px] leading-relaxed text-muted-foreground">
            {summary}
          </p>
          <p className="mt-2 font-sans text-xs text-muted-foreground">
            Terakhir diperbarui: {updatedAt}
          </p>

          <div className="mt-10 flex flex-col gap-8 font-sans text-[15px] leading-[1.75] text-foreground">
            {children}
          </div>

          <div className="mt-12 rounded-xl border border-border bg-secondary p-5">
            <p className="font-sans text-sm leading-relaxed text-foreground">
              Ada pertanyaan tentang halaman ini? Hubungi{' '}
              <a
                href="mailto:halo@rebites.id"
                className="font-semibold text-primary underline underline-offset-2"
              >
                halo@rebites.id
              </a>
              .
            </p>
            <p className="mt-3 font-sans text-sm leading-relaxed text-muted-foreground">
              Lihat juga{' '}
              <Link
                href="/privacy"
                className="font-semibold text-primary underline underline-offset-2"
              >
                Kebijakan Privasi
              </Link>{' '}
              dan{' '}
              <Link
                href="/terms"
                className="font-semibold text-primary underline underline-offset-2"
              >
                Syarat Penggunaan
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}

/** Satu bagian bernomor pada halaman legal. */
export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="font-display text-xl font-semibold tracking-tight text-primary">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** Daftar berbutir dengan jarak konsisten. */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-muted-foreground">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
