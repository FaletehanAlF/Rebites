import { PublicShell } from '@/app/components/landing/public-shell';
import { HeroSection } from '@/app/components/landing/HeroSection';
import { HowItWorksSection } from '@/app/components/landing/HowItWorksSection';
import { WhyReBitesSection } from '@/app/components/landing/WhyReBitesSection';
import { FoodDiscoverySection } from '@/app/components/landing/FoodDiscoverySection';
import { TestimonialsSection } from '@/app/components/landing/TestimonialsSection';
import { MembershipSection } from '@/app/components/landing/MembershipSection';
import { FAQSection } from '@/app/components/landing/FAQSection';
import { ContactCTASection } from '@/app/components/landing/ContactCTASection';

/**
 * Halaman landing publik (`/`).
 *
 * Tetap Server Component: tiap section di bawah dirender ke HTML statis di
 * server, sehingga hanya bagian yang benar-benar butuh browser — navbar,
 * pengambilan katalog, akordeon, tab, footer, dan intro — yang dikirim
 * sebagai JavaScript klien. Batas klien untuk Lenis dan `MotionConfig` ada di
 * `LandingShell` (layout route group), preloader di `PublicShell`.
 *
 * Alur ceritanya: apa ini → cara kerja → kenapa ReBites → buktikan produknya
 * → kata pengguna → membership → pertanyaan → ajakan menghubungi.
 *
 * Id section adalah kontrak tautan dalam: `/home`, footer aplikasi, halaman
 * sukses langganan, dan preview produk publik semuanya deep-link ke
 * `#cara-kerja`, `#rekomendasi`, `#langganan`, dan `#faq`. Id `umkm` dan
 * `pembeli` pindah ke halaman `/fitur`.
 */
export default function Home() {
  return (
    <PublicShell intro>
      <HeroSection />
      <HowItWorksSection />
      <WhyReBitesSection />
      <FoodDiscoverySection />
      <TestimonialsSection />
      <MembershipSection />
      <FAQSection />
      <ContactCTASection />
    </PublicShell>
  );
}
