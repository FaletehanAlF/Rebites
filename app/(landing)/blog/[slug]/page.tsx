import type { Metadata } from 'next';
import { PublicShell } from '@/app/components/landing/public-shell';
import { BlogDetailView } from '@/app/components/landing/blog/blog-detail-view';

export const metadata: Metadata = {
  title: 'Artikel',
};

export default function BlogDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  return (
    <PublicShell>
      <BlogDetailView slug={params.slug} />
    </PublicShell>
  );
}
