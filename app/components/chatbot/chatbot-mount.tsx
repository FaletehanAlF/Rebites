'use client';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
const ChatbotWidget = dynamic(() => import('./chatbot-widget'), {
    ssr: false,
    loading: () => null,
});
export function ChatbotMount() {
    const pathname = usePathname();
    if (pathname?.startsWith('/auth'))
        return null;
    return <ChatbotWidget />;
}
