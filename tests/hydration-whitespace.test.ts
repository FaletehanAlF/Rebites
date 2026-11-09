import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const bodyStart = source.indexOf('<body');
const bodyOpenEnd = source.indexOf('>', bodyStart);
const bodyEnd = source.indexOf('</body>', bodyOpenEnd);
const inner = source.slice(bodyOpenEnd + 1, bodyEnd);

function hasWhitespaceTextNode(markup: string): boolean {
    return /\}\s+</.test(markup) || />\s+</.test(markup);
}

test('layout: <body> memuat children dan komponen global', () => {
    assert.notEqual(bodyStart, -1, '<body> tidak ditemukan di app/layout.tsx');
    assert.ok(bodyEnd > bodyOpenEnd, '</body> tidak ditemukan di app/layout.tsx');
    for (const marker of ['{children}', '<VisitorTracker />', '<ChatbotMount />', '<Toaster />']) {
        assert.ok(inner.includes(marker), `${marker} tidak ada di dalam <body>`);
    }
});

test('layout: tidak ada text-node whitespace di dalam <body>', () => {
    assert.equal(hasWhitespaceTextNode(inner), false, 'spasi atau baris baru antar elemen menghasilkan penanda <!-- --> di HTML server');
});

test('layout: pemeriksa menangkap markup ber-spasi sebagai pembanding', () => {
    assert.equal(hasWhitespaceTextNode('{children}\n      <VisitorTracker />'), true);
    assert.equal(hasWhitespaceTextNode('<VisitorTracker />\n      <ChatbotMount />'), true);
    assert.equal(hasWhitespaceTextNode('{children}<VisitorTracker /><ChatbotMount />'), false);
});

test('layout: tidak memakai suppressHydrationWarning sebagai penutup', () => {
    assert.equal(source.includes('suppressHydrationWarning'), false);
});
