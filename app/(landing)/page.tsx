import { PublicShell } from '@/app/components/landing/public-shell';
import { HeroSection } from '@/app/components/landing/HeroSection';
import { HowItWorksSection } from '@/app/components/landing/HowItWorksSection';
import { WhyReBitesSection } from '@/app/components/landing/WhyReBitesSection';
import { FoodDiscoverySection } from '@/app/components/landing/FoodDiscoverySection';
import { TestimonialsSection } from '@/app/components/landing/TestimonialsSection';
import { MembershipSection } from '@/app/components/landing/MembershipSection';
import { FAQSection } from '@/app/components/landing/FAQSection';
import { ContactCTASection } from '@/app/components/landing/ContactCTASection';
import { HeroStack } from '../components/landing/HeroStack';

import {
  HorizontalSections,
  HorizontalPanel,
} from '@/app/components/landing/HorizontalSections';

export default function Home() {
  return (
    <PublicShell intro>
      {/* Hero tetap di-pin dengan efek stack */}
      <HeroStack mode="stack">
        <HeroSection />
      </HeroStack>
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