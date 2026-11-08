'use client';
import type { ReactNode } from 'react';
import { parseInline, splitBlocks } from '@/lib/chatbot/markdown-parse';
export function ChatMarkdown({ text }: {
    text: string;
}) {
    const blocks = splitBlocks(text);
    const rendered: ReactNode[] = [];
    let bulletBuffer: string[] = [];
    let bulletStart = 0;
    const flushBullets = () => {
        if (bulletBuffer.length === 0)
            return;
        const items = bulletBuffer;
        rendered.push(<ul key={`ul-${bulletStart}`} className="ml-4 list-disc space-y-0.5">
        {items.map((item, index) => (<li key={`li-${bulletStart}-${index}`}>
            {renderInline(item, `li-${bulletStart}-${index}`)}
          </li>))}
      </ul>);
        bulletBuffer = [];
    };
    blocks.forEach((block, index) => {
        if (block.kind === 'bullet') {
            if (bulletBuffer.length === 0)
                bulletStart = index;
            bulletBuffer.push(block.text);
            return;
        }
        flushBullets();
        if (block.kind === 'spacer') {
            rendered.push(<div key={`sp-${index}`} className="h-1.5" aria-hidden/>);
            return;
        }
        rendered.push(<p key={`p-${index}`}>{renderInline(block.text, `p-${index}`)}</p>);
    });
    flushBullets();
    return <div className="space-y-1 break-words">{rendered}</div>;
}
function renderInline(line: string, keyPrefix: string): ReactNode[] {
    return parseInline(line).map((segment, index) => {
        const key = `${keyPrefix}-${index}`;
        if (segment.kind === 'code') {
            return (<code key={key} className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-[12px] text-foreground">
          {segment.text}
        </code>);
        }
        if (segment.kind === 'bold') {
            return (<strong key={key} className="font-semibold">
          {segment.text}
        </strong>);
        }
        return <span key={key}>{segment.text}</span>;
    });
}
export default ChatMarkdown;
