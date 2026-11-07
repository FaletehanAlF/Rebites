'use client';
import dynamic from 'next/dynamic';
const ChatbotWidget = dynamic(() => import('./chatbot-widget'), {
    ssr: false,
    loading: () => null,
});
export function ChatbotMount() {
    return <ChatbotWidget />;
}
