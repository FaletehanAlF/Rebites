import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight, Mail, MapPin } from 'lucide-react';
import { PublicShell } from '@/app/components/landing/public-shell';
import { PageIntro } from '@/app/components/landing/PageIntro';
import { Reveal } from '@/app/components/shared/reveal';
import { ContactForm } from './contact-form';

export const metadata: Metadata = {
  title: 'Hubungi Kami - ReBites',
  description:
    'Hubungi tim ReBites untuk pertanyaan, kerja sama, atau dukungan seputar marketplace makanan surplus UMKM.',
};

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const CHANNELS = [
  {
    icon: Mail,
    label: 'Email',
    value: 'halo@rebites.id',
    href: 'mailto:halo@rebites.id',
  },
  {
    icon: MapPin,
    label: 'Area layanan',
    value: 'Kota Depok, Jawa Barat',
    href: null,
  },
] as const;

// /hubungi-kami: dua kanal kontak + formulir Formspree. Tujuan CTA "Hubungi Kami" di situs publik.
export default function HubungiKamiPage() {
  return (
    <PublicShell>
      <PageIntro
        title="Mari terhubung dengan kami."
        lead="Ceritakan kebutuhan Anda — cara membeli, pendaftaran sebagai UMKM, atau kendala pesanan. Tim kami siap membantu dan merespons setiap pesan yang masuk."
      />

      <section aria-labelledby="contact-heading" className="border-t border-border bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <h2 id="contact-heading" className="sr-only">
            Kanal kontak dan formulir
          </h2>

          <div className="grid items-start gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
            <Reveal>
              <div>
                <ul className="border-t border-border">
                  {CHANNELS.map((channel) => {
                    const Icon = channel.icon;
                    const body = (
                      <>
                        <span
                          aria-hidden
                          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"
                        >
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-secondary text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {channel.label}
                          </span>
                          <span className="mt-1 flex items-center gap-1.5 font-display text-base font-semibold tracking-tight text-primary">
                            {channel.value}
                            {channel.href && (
                              <ArrowUpRight
                                className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none"
                                aria-hidden
                              />
                            )}
                          </span>
                        </span>
                      </>
                    );

                    return (
                      <li key={channel.label} className="border-b border-border py-5">
                        {channel.href ? (
                          <a
                            href={channel.href}
                            className={`group flex items-start gap-4 ${FOCUS_RING}`}
                          >
                            {body}
                          </a>
                        ) : (
                          <div className="flex items-start gap-4">{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <p className="mt-6 text-sm leading-[1.75] text-muted-foreground">
                  Pertanyaan yang sering muncul mungkin sudah terjawab di{' '}
                  <Link
                    href="/#faq"
                    className={`font-medium text-primary underline underline-offset-4 hover:text-primary-dark ${FOCUS_RING}`}
                  >
                    halaman FAQ
                  </Link>
                  .
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <ContactForm />
            </Reveal>
          </div>

          <Reveal delay={0.05}>
            <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-[1.75] text-muted-foreground">
                Ingin langsung melihat makanan yang sedang ditawarkan?
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <Link
                  href="/"
                  className={`inline-flex min-h-[40px] items-center font-secondary text-sm font-semibold text-primary ${FOCUS_RING}`}
                >
                  Kembali ke beranda
                </Link>
                <Link
                  href="/home"
                  className={`group inline-flex min-h-[40px] items-center gap-1.5 font-secondary text-sm font-semibold text-primary ${FOCUS_RING}`}
                >
                  Jelajahi makanan
                  <ArrowUpRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none"
                    aria-hidden
                  />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </PublicShell>
  );
}
