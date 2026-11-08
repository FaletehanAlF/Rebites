import type { Metadata } from 'next';
import { SupportInboxView } from '@/app/components/admin/support-inbox-view';
export const metadata: Metadata = {
    title: 'Chat | Panel Admin ReBites',
    description: 'Percakapan admin dengan pembeli dan UMKM, termasuk banding akun terblokir.',
};
export default function AdminChatPage() {
    return <SupportInboxView />;
}
