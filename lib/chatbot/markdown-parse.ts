export type InlineKind = 'text' | 'bold' | 'code';
export interface InlineSegment {
    kind: InlineKind;
    text: string;
}
export type BlockKind = 'paragraph' | 'bullet' | 'spacer';
export interface Block {
    kind: BlockKind;
    text: string;
}
export function parseInline(line: string): InlineSegment[] {
    const segments: InlineSegment[] = [];
    const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ kind: 'text', text: line.slice(lastIndex, match.index) });
        }
        const token = match[0];
        if (token.startsWith('`')) {
            segments.push({ kind: 'code', text: token.slice(1, -1) });
        }
        else {
            segments.push({ kind: 'bold', text: token.slice(2, -2) });
        }
        lastIndex = match.index + token.length;
    }
    if (lastIndex < line.length) {
        segments.push({ kind: 'text', text: line.slice(lastIndex) });
    }
    return segments;
}
export function splitBlocks(text: string): Block[] {
    const blocks: Block[] = [];
    if (!text || !text.trim())
        return blocks;
    for (const rawLine of text.split('\n')) {
        const line = rawLine.replace(/\s+$/, '');
        const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
        if (bullet) {
            blocks.push({ kind: 'bullet', text: bullet[1] });
            continue;
        }
        if (!line.trim()) {
            blocks.push({ kind: 'spacer', text: '' });
            continue;
        }
        blocks.push({ kind: 'paragraph', text: line });
    }
    return blocks;
}
export function hasMarkdown(text: string): boolean {
    return /\*\*[^*]+\*\*|`[^`]+`/i.test(text ?? '');
}
export function stripDanglingMarkers(text: string): string {
    return (text ?? '').replace(/\*\*/g, '').replace(/(^|\s)`(\s|$)/g, '$1$2');
}
