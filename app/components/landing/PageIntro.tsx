import type { ReactNode } from 'react';

// Header halaman konten publik.
export function PageIntro({
  title,
  lead,
}: {
  title: string;
  lead?: ReactNode;
}) {
  return (
    <section className="bg-white">
      <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-28 text-center sm:px-6 sm:pb-12 sm:pt-32 lg:px-8 lg:pt-36">
        <h1 className="text-balance font-display text-[clamp(2rem,4.4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground">
          {title}
        </h1>
        {lead && (
          <p className="mx-auto mt-5 max-w-2xl text-base leading-[1.75] text-muted-foreground sm:text-[1.0625rem]">
            {lead}
          </p>
        )}
      </div>
    </section>
  );
}
