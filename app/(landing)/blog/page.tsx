import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PublicShell } from '@/app/components/landing/public-shell';
import { BlogListView } from '@/app/components/landing/blog/blog-list-view';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Kabar, tips, dan cerita dari tim ReBites seputar makanan surplus dan gaya hidup tanpa food waste.',
};

export default function BlogPage() {
  return (
    <PublicShell>
      <Suspense fallback={<div className="min-h-[60vh]" />}>
        <BlogListView />
      </Suspense>
    </PublicShell>
  );
}
