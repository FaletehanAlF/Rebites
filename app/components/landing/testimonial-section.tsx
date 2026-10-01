'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Star, Quote } from 'lucide-react';
import { Reveal, RevealWords } from '@/app/components/shared/reveal';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/app/components/ui/carousel';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from '@/app/components/ui/avatar';

type Testimonial = {
  name: string;
  role: string;
  quote: string;
  rating: number;
  initials: string;
  photo: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Rina Astuti',
    role: 'Pemilik Dapur Ibu Sri',
    quote:
      'Awalnya mencoba paket Trial karena penasaran, dan hasilnya melebihi ekspektasi. Makanan yang biasanya tersisa kini lebih cepat habis, serta laporan penjualannya mudah dipahami.',
    rating: 5,
    initials: 'RA',
    photo:
      'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
  },
  {
    name: 'Arga Zanuar',
    role: 'Pembeli setia',
    quote:
      'Sekarang pada jam makan siang saya selalu mengecek ReBites lebih dulu. Harganya lebih hemat, tetapi kualitas makanannya tetap terjaga. Sangat membantu untuk kebutuhan harian.',
    rating: 5,
    initials: 'BS',
    photo:
      'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
  },
  {
    name: 'Dewi Lestari',
    role: 'Kue Mbok Darmi',
    quote:
      'Sejak menggunakan paket Standar, produk saya semakin sering dilihat pembeli. Beberapa pelanggan baru bahkan mengenal usaha kami melalui ReBites dan turut memperluas jangkauan bisnis.',
    rating: 5,
    initials: 'DL',
    photo:
      'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
  },
  {
    name: 'Abdurrahman Kaysan',
    role: 'Pelanggan rutin',
    quote:
      'Saya kerap memesan ketika tidak sempat keluar rumah. Soto Mie Bogornya lezat dengan harga yang wajar. Sudah beberapa kali membeli dan selalu merasa puas.',
    rating: 4,
    initials: 'AF',
    photo:
      'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
  },
  {
    name: 'Mang Teten',
    role: 'Warung Mang Teten',
    quote:
      'Dulu makanan yang tidak habis sering menjadi kebingungan. Kini saya dapat menawarkannya melalui ReBites sehingga makanan tidak terbuang sia-sia sekaligus menambah pemasukan.',
    rating: 5,
    initials: 'SW',
    photo:
      'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
  },
  {
    name: 'Falen Darmawan',
    role: 'Mahasiswa',
    quote:
      'Sebagai perantau, ReBites sangat membantu. Saya bisa mendapatkan makanan berkualitas dengan harga yang lebih hemat dan selalu mengeceknya sebelum membeli.',
    rating: 5,
    initials: 'RP',
    photo:
      'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
  },
];

const AUTOPLAY_INTERVAL_MS = 7000;

/**
 * Section testimoni dipisah dari `app/page.tsx` karena:
 * - dot aktif berubah tiap 7 detik; di halaman induk itu berarti seluruh
 *   landing page (hero, katalog, FAQ, footer) ikut re-render tiap 7 detik.
 * - autoplay sekarang berhenti saat section keluar viewport, tab disembunyikan,
 *   atau pengguna meminta reduced-motion.
 */
export function TestimonialSection() {
  const [api, setApi] = useState<CarouselApi>();
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false); // pointer sedang di atas carousel
  const inViewRef = useRef(false);
  const hiddenRef = useRef(false);

  // Satu effect untuk semua sinyal "jangan autoplay".
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReducedMotion(motionQuery.matches);
    syncMotion();
    motionQuery.addEventListener('change', syncMotion);

    const syncVisibility = () => {
      hiddenRef.current = document.hidden;
    };
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);

    let observer: IntersectionObserver | undefined;
    const element = wrapperRef.current;
    if (element && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        ([entry]) => {
          inViewRef.current = entry.isIntersecting;
        },
        { threshold: 0.25 },
      );
      observer.observe(element);
    } else {
      inViewRef.current = true;
    }

    return () => {
      motionQuery.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', syncVisibility);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!api) return;

    const onSelect = () => setActiveTestimonial(api.selectedScrollSnap());

    onSelect();
    api.on('select', onSelect);
    api.on('reInit', onSelect);

    return () => {
      api.off('select', onSelect);
      api.off('reInit', onSelect);
    };
  }, [api]);

  // Auto-play carousel testimoni, pause saat hover / di luar viewport /
  // tab tersembunyi / reduced-motion.
  useEffect(() => {
    if (!api || reducedMotion || !api.canScrollNext()) return;

    const interval = window.setInterval(() => {
      if (pausedRef.current || !inViewRef.current || hiddenRef.current) return;
      api.scrollNext();
    }, AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [api, reducedMotion]);

  return (
    <section
      id="testimoni"
      data-nav="green"
      className="grain-overlay relative scroll-mt-28 overflow-hidden bg-primary pt-24 pb-16 lg:scroll-mt-32 lg:pt-28 lg:pb-20"
    >
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary-foreground/[0.06] blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
            <Reveal delay={0.1}>
              <h2 className="mt-6 font-display text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[1.02] tracking-[-0.02em] text-primary-foreground">
                <RevealWords text="Apa kata mereka setelah" />{' '}
                <span>menggunakan</span> ReBites.
              </h2>
            </Reveal>

            <Reveal delay={0.15}>
              <p className="mx-auto mt-5 max-w-md font-sans text-sm leading-relaxed text-primary-foreground/70 lg:mx-0">
                Simak pengalaman pelaku UMKM dan pembeli dalam menjual serta
                menikmati makanan berkualitas dengan lebih hemat.
              </p>
            </Reveal>
          </div>
        </div>

        <Reveal delay={0.1}>
          <div
            ref={wrapperRef}
            className="relative mt-12 lg:mt-16"
            onMouseEnter={() => {
              pausedRef.current = true;
            }}
            onMouseLeave={() => {
              pausedRef.current = false;
            }}
          >
            <button
              type="button"
              onClick={() => api?.scrollPrev()}
              aria-label="Testimoni sebelumnya"
              className="absolute -left-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-primary shadow-[0_10px_30px_-24px_rgba(27,77,50,0.3)] transition-all duration-300 hover:-translate-y-1/2 hover:border-caramel hover:bg-caramel hover:text-white sm:flex"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
            </button>

            <button
              type="button"
              onClick={() => api?.scrollNext()}
              aria-label="Testimoni berikutnya"
              className="absolute -right-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-primary shadow-[0_10px_30px_-24px_rgba(27,77,50,0.3)] transition-all duration-300 hover:-translate-y-1/2 hover:border-caramel hover:bg-caramel hover:text-white sm:flex"
            >
              <ArrowRight className="h-4 w-4" />
            </button>

            <Carousel opts={{ align: 'start', loop: true }} setApi={setApi}>
              <CarouselContent className="-ml-4 lg:-ml-5">
                {TESTIMONIALS.map((t) => (
                  <CarouselItem
                    key={t.name}
                    className="basis-full pl-4 sm:basis-1/2 sm:pl-4 lg:basis-1/3 lg:pl-5"
                  >
                    <div className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-white p-8 shadow-[0_10px_30px_-24px_rgba(27,77,50,0.3)] transition-all duration-300 hover:-translate-y-1 hover:border-caramel/40 hover:shadow-[0_30px_60px_-28px_rgba(27,77,50,0.35)] lg:p-9">
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -top-3 right-4 select-none font-display text-[6rem] font-extralight leading-none text-caramel/[0.08] transition-colors duration-300 group-hover:text-caramel/15"
                      >
                        &ldquo;
                      </span>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: t.rating }).map((_, s) => (
                          <Star
                            key={s}
                            className="h-4 w-4 fill-caramel text-caramel"
                          />
                        ))}
                      </div>

                      <Quote className="mt-5 h-5 w-5 text-caramel/40" />

                      <blockquote className="mt-3 flex-1 font-sans text-sm leading-relaxed text-foreground/80">
                        &ldquo;{t.quote}&rdquo;
                      </blockquote>

                      <div className="relative mt-7 flex items-center gap-3 pt-6">
                        <span
                          aria-hidden
                          className="absolute inset-x-0 top-0 h-px"
                          style={{
                            background:
                              'repeating-linear-gradient(90deg, currentColor 0 5px, transparent 5px 10px)',
                            opacity: 0.35,
                          }}
                        />

                        <Avatar className="h-11 w-11 border border-caramel/30">
                          <AvatarImage
                            src={t.photo}
                            alt={t.name}
                            loading="lazy"
                            decoding="async"
                            className="object-cover"
                          />

                          <AvatarFallback className="bg-caramel font-display text-sm font-medium text-white">
                            {t.initials}
                          </AvatarFallback>
                        </Avatar>

                        <div>
                          <p className="font-display text-base font-medium text-primary">
                            {t.name}
                          </p>

                          <p className="mt-0.5 font-sans text-xs text-muted-foreground">
                            {t.role}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-9 flex justify-center gap-2">
            {TESTIMONIALS.map((t, i) => (
              <button
                key={t.name}
                type="button"
                aria-label={`Ke testimoni ${i + 1}`}
                onClick={() => api?.scrollTo(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeTestimonial === i
                    ? 'w-8 bg-primary-foreground'
                    : 'w-1.5 bg-primary-foreground/25 hover:bg-primary-foreground/50'
                }`}
              />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
