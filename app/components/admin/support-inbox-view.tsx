'use client';
import { MessageSquare } from 'lucide-react';
import { SupportConversationList } from './support-conversation-list';
import { useAdminSupportBadge } from '@/hooks/use-support-badge';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER } from './admin-page-header';
export function SupportInboxView() {
    const { count: unreadCount } = useAdminSupportBadge(true);
    return (<div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader title="Chat" description="Kotak masuk pesan pengguna."/>

      <div className="flex flex-col gap-4 lg:h-[clamp(30rem,calc(100dvh-15rem),46rem)] lg:flex-row lg:items-stretch">
        <SupportConversationList className="w-full lg:w-[320px] lg:shrink-0"/>

        <section aria-label="Ringkasan kotak pesan" className="hidden min-w-0 flex-1 flex-col justify-center rounded-xl border border-admin-line bg-admin-panel px-8 py-10 shadow-admin-card lg:flex">
          <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/[0.08]">
              <MessageSquare aria-hidden className="h-7 w-7 text-primary"/>
            </span>
            
            <h2 className="mt-4 font-display text-lg font-bold tracking-tight text-charcoal-900">
              {unreadCount === null
            ? 'Kotak pesan admin'
            : unreadCount > 0
                ? `${unreadCount} percakapan menunggu dibaca`
                : 'Tidak ada pesan baru'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-sage-500">
              Pilih salah satu percakapan di sebelah kiri untuk membaca isi
              pesan, membalas, atau memutuskan banding akun terblokir.
            </p>
            <p className="mt-4 rounded-full bg-admin-surface px-4 py-1.5 text-xs font-semibold text-charcoal-700">
              Badge merah hilang saat percakapannya dibuka, bukan saat daftar ini dilihat.
            </p>
          </div>
        </section>
      </div>
    </div>);
}
