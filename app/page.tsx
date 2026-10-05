import { LandingShell } from '@/app/components/landing/landing-shell';
import { LandingNavbar } from '@/app/components/landing/LandingNavbar';
import { HeroSection } from '@/app/components/landing/HeroSection';
import { TrustSection } from '@/app/components/landing/TrustSection';
import { HowItWorksSection } from '@/app/components/landing/HowItWorksSection';
import { FoodDiscoverySection } from '@/app/components/landing/FoodDiscoverySection';
import { SellerSection } from '@/app/components/landing/SellerSection';
import { BuyerSection } from '@/app/components/landing/BuyerSection';
import { FeaturesSection } from '@/app/components/landing/FeaturesSection';
import { BenefitsSection } from '@/app/components/landing/BenefitsSection';
import { FAQSection } from '@/app/components/landing/FAQSection';
import { FinalCTASection } from '@/app/components/landing/FinalCTASection';
import { LandingFooter } from '@/app/components/landing/LandingFooter';

/**
 * The public landing page.
 *
 * It stays a Server Component: every section below renders to static HTML on
 * the server, so only the parts that genuinely need the browser — navbar,
 * catalog fetch, accordion, footer controls — ship as client JavaScript. The
 * client boundary for Lenis, `MotionConfig` and the intro overlay lives in
 * `LandingShell`.
 *
 * Section ids are part of the public contract: `/home`, the shared footers and
 * the flash-sale grid all deep-link to `#cara-kerja`, `#umkm`, `#pembeli`,
 * `#langganan` and `#rekomendasi`.
 */
export default function Home() {
  return (
    <LandingShell>
      <LandingNavbar />

      <main>
        <HeroSection />
        <TrustSection />
        <HowItWorksSection />
        <FoodDiscoverySection />
        <SellerSection />
        <BuyerSection />
        <FeaturesSection />
        <BenefitsSection />
        <FAQSection />
        <FinalCTASection />
      </main>

      <LandingFooter />
    </LandingShell>
  );
}
