import type { Metadata } from 'next';
import { UserProfile } from '@/app/components/shared/user-profile';
import { RequireAuth } from '@/app/components/auth/require-auth';
export const metadata: Metadata = {
    title: 'Profil - ReBites',
    description: 'Kelola profil, alamat pengiriman, langganan, dan riwayat pesanan Anda di ReBites.',
};
export default function ProfilePage() {
    return (<RequireAuth>
      <UserProfile />
    </RequireAuth>);
}
