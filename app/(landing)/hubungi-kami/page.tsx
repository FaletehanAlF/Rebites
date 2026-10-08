import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight, Mail, MapPin } from 'lucide-react';
import { PublicShell } from '@/app/components/landing/public-shell';
import { PublicPageHero } from '@/app/components/landing/PublicPageHero';
import { Reveal } from '@/app/components/shared/reveal';
import { ContactForm } from './contact-form';

export const metadata: Metadata = {
  title: 'Hubungi Kami - ReBites',
  description:
    'Punya pertanyaan tentang ReBites? Kirim pesan lewat formulir atau email langsung ke halo@rebites.id.',
};

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const CHANNELS = [
  {
    icon: Mail,
    label: 'Email',
    value: 'halo@rebites.id',
    description:
      'Untuk pertanyaan umum, kendala pesanan, atau kerja sama. Sertakan detail pesanan bila ada agar bisa kami cek lebih cepat.',
    href: 'mailto:halo@rebites.id',
    external: false,
  },
  {
    icon: MapPin,
    label: 'Area layanan',
    value: 'Kota Depok, Jawa Barat',
    description:
      'ReBites beroperasi khusus di Kota Depok untuk saat ini. Wilayah lain menyusul setelah ekosistem di sini matang.',
    href: null,
    external: false,
  },
];

export default function HubungiKamiPage() {
  return (
    <PublicShell>
      <PublicPageHero
        eyebrow="Hubungi Kami"
        title={
          <>
            Ada yang bisa <span className="font-light italic">kami bantu?</span>
          </>
        }
        lead="Tanya soal cara membeli, pendaftaran sebagai UMKM, atau hal lainnya. Tulis pesanmu, dan kami balas ke email yang kamu cantumkan."
      />

      <section aria-labelledby="contact-heading" className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <Reveal>
              <div>
                <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  Cara menghubungi
                </p>
                <h2
                  id="contact-heading"
                  className="mt-4 text-balance font-display text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-primary"
                >
                  Pilih yang paling{' '}
                  <span className="font-light italic">memudahkanmu.</span>
                </h2>

                <ul className="mt-8 space-y-4">
                  {CHANNELS.map((channel) => {
                    const Icon = channel.icon;
                    const body = (
                      <>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-accent text-primary">
                          <Icon className="h-[18px] w-[18px]" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-secondary text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {channel.label}
                          </span>
                          <span className="mt-1 flex items-center gap-1.5 font-display text-base font-semibold tracking-tight text-primary">
                            {channel.value}
                            {channel.href && (
                              <ArrowUpRight
                                className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                                aria-hidden
                              />
                            )}
                          </span>
                          <span className="mt-2 block text-sm leading-[1.75] text-muted-foreground">
                            {channel.description}
                          </span>
                        </span>
                      </>
                    );

                    return (
                      <li
                        key={channel.label}
                        className="rounded-2xl border border-border bg-secondary p-5 sm:p-6"
                      >
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

                <div className="mt-6 rounded-2xl border border-border p-5 text-sm leading-[1.75] text-muted-foreground sm:p-6">
                  Pertanyaan yang sering muncul mungkin sudah terjawab di{' '}
                  <Link
                    href="/#faq"
                    className={`font-medium text-primary underline underline-offset-4 hover:text-primary-dark ${FOCUS_RING}`}
                  >
                    halaman FAQ
                  </Link>
                  .
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <ContactForm />
            </Reveal>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
