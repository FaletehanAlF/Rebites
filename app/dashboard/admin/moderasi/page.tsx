'use client';

import { useRequireAdmin } from '@/hooks/use-require-admin';
import { ProductModerationView } from '@/app/components/admin/product-moderation-view';

export default function AdminModerationPage() {
  const { loading, isAdmin } = useRequireAdmin();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    // Redirect ditangani hook (ke /auth/login atau /).
    return null;
  }

  return (
    <div className="min-h-screen bg-cream-50 font-sans text-charcoal-900">
      <ProductModerationView />
    </div>
  );
}
