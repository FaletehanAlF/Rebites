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
export default function Home() {
    return (<LandingShell>
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
    </LandingShell>);
}
