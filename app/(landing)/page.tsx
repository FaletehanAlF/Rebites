import { PublicShell } from '@/app/components/landing/public-shell';
import { HeroSection } from '@/app/components/landing/HeroSection';
import { HowItWorksSection } from '@/app/components/landing/HowItWorksSection';
import { WhyReBitesSection } from '@/app/components/landing/WhyReBitesSection';
import { FoodDiscoverySection } from '@/app/components/landing/FoodDiscoverySection';
import { TestimonialsSection } from '@/app/components/landing/TestimonialsSection';
import { MembershipSection } from '@/app/components/landing/MembershipSection';
import { FAQSection } from '@/app/components/landing/FAQSection';
import { ContactCTASection } from '@/app/components/landing/ContactCTASection';

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
