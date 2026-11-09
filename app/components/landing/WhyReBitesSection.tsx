
'use client';

import Image from 'next/image';
import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { SectionHeading } from '@/app/components/landing/SectionHeading';

gsap.registerPlugin(ScrollTrigger);

const DIFFERENTIATORS = [
  {
    num: '01',
    title: 'Surplus, bukan sekadar diskon',
    description:
      'Menu diambil dari kelebihan produksi atau yang belum terjual hari itu — masih layak konsumsi, bukan makanan yang kedaluwarsa.',
  },
  {
    num: '02',
    title: 'Menghubungkan dua sisi',
    description:
      'UMKM yang punya makanan bertemu pembeli yang mencari makanan terjangkau. ReBites berdiri di tengah, mempertemukan keduanya.',
  },
  {
    num: '03',
    title: 'Lebih hemat, tetap bernilai',
    description:
      'Pembeli membayar lebih sedikit untuk makanan yang sama. Penjual mendapat pendapatan tambahan dari menu yang tadinya tersisa.',
  },
  {
    num: '04',
    title: 'Dampak dari transaksi sederhana',
    description:
      'Setiap pesanan berarti satu porsi lebih banyak berakhir di piring — bukan di tempat sampah.',
  },
];

// Empat keunggulan utama. Angka statistik tidak ditampilkan karena data dampak belum dapat diverifikasi.
export function WhyReBitesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const heading = headingRef.current;
    const image = imageRef.current;
    const list = listRef.current;

    if (!section || !heading || !image || !list) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const items = list.querySelectorAll('[data-differentiator]');

      gsap.fromTo(
        heading,
        {
          y: 24,
          autoAlpha: 0,
        },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.75,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: heading,
            start: 'top 88%',
            once: true,
          },
        },
      );

      gsap.fromTo(
        image,
        {
          x: -28,
          autoAlpha: 0,
        },
        {
          x: 0,
          autoAlpha: 1,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: image,
            start: 'top 85%',
            once: true,
          },
        },
      );

      gsap.fromTo(
        items,
        {
          y: 20,
          autoAlpha: 0,
        },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.65,
          stagger: 0.12,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: list,
            start: 'top 85%',
            once: true,
          },
        },
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="kenapa"
      aria-labelledby="why-heading"
      className="relative z-10 border-t border-border bg-white"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div ref={headingRef}>
          <SectionHeading
            id="why-heading"
            heading="Pilihan Hemat, Manfaat Lebih Besar."
            description="Manfaatkan makanan yang masih layak konsumsi sambil membantu mengurangi makanan terbuang dan mendukung UMKM lokal."
          />
        </div>

        <div className="mt-10 grid gap-10 sm:mt-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div
            ref={imageRef}
            className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.5rem] border border-border/70 bg-muted sm:aspect-[3/2]"
          >
            <Image
              src="/terselamatkan.jpg"
              alt="Aneka hidangan dari dapur UMKM yang siap dinikmati pembeli"
              fill
              sizes="(min-width: 1024px) 24rem, calc(100vw - 2rem)"
              className="object-cover"
            />
          </div>

          <ol ref={listRef} className="border-t border-border">
            {DIFFERENTIATORS.map((item) => (
              <li
                key={item.num}
                data-differentiator
                className="flex items-start gap-4 border-b border-border py-6 sm:gap-6"
              >
                <span className="mt-1 font-display text-xs font-semibold tabular-nums tracking-[0.16em] text-primary">
                  {item.num}
                </span>

                <div>
                  <h3 className="font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                    {item.title}
                  </h3>

                  <p className="mt-2 max-w-xl text-sm leading-[1.75] text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
