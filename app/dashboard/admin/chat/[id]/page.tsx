import type { Metadata } from 'next';
import { SupportThreadView } from '@/app/components/admin/support-thread-view';
export const metadata: Metadata = {
    title: 'Percakapan | Panel Admin ReBites',
    description: 'Satu percakapan admin dengan pengguna ReBites.',
};
export default function AdminChatThreadPage({ params }: {
    params: {
        id: string;
    };
}) {
    return <SupportThreadView id={params.id}/>;
}
