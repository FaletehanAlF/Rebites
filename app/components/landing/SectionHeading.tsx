import { Reveal } from '@/app/components/shared/reveal';

interface SectionHeadingProps {
  id: string;
  heading: string;
  description: string;
}

export function SectionHeading({
  id,
  heading,
  description,
}: SectionHeadingProps) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <h2
        id={id}
        className="text-balance font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-primary"
      >
        {heading}
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.8] text-muted-foreground">
        {description}
      </p>
    </Reveal>
  );
}
