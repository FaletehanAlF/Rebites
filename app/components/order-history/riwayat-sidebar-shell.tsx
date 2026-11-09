'use client';
import { BuyerShell } from '@/app/components/shared/buyer-shell';
export function RiwayatSidebarShell({ children, title = 'Pesanan Saya', description = 'Lihat status dan detail setiap pesanan, termasuk perjalanan pengantaran dan rincian biayanya.', }: {
    children: React.ReactNode;
    title?: string;
    description?: string;
}) {
    return (<BuyerShell>

      <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-12 lg:pt-8">

        <header>

          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-primary">

            {title}

          </h1>

          <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">

            {description}

          </p>

        </header>

        <div className="mt-4 lg:mt-6">{children}</div>

      </main>

    </BuyerShell>);
}
