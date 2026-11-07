import type { Metadata } from 'next';
import { RequireAuth } from '@/app/components/auth/require-auth';
import { AccountSanctionsView } from '@/app/components/profile/account-sanctions-view';
export const metadata: Metadata = {
    title: 'Status & Sanksi Akun | ReBites',
    description: 'Lihat status akun, peringatan, dan sanksi yang dikenakan pada akun Anda.',
};
export default function AccountSanctionsPage() {
    return (<RequireAuth>
      <AccountSanctionsView />
    </RequireAuth>);
}
