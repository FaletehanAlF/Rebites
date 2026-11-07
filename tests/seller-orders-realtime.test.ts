import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
function stripComments(source: string): string {
    return source
        .split('\n')
        .map((line) => {
        const tanpaBlok = line.replace(/\/\*[\s\S]*?\*\//g, '');
        return tanpaBlok.replace(/\/\/.*$/, '');
    })
        .join('\n');
}
const REALTIME = stripComments(readProjectFile('lib/orders-realtime.ts'));
const SELLER_HOOK = stripComments(readProjectFile('hooks/use-seller-orders.ts'));
test('ada langganan postgres_changes pada tabel orders', () => {
    assert.ok(REALTIME.includes("'postgres_changes'"), 'langganan harus memakai postgres_changes');
    assert.match(REALTIME, /table = 'orders'/, 'tabel langganan default harus orders');
    assert.match(REALTIME, /\{\s*event: '\*',\s*schema: 'public',\s*table\s*\}/, 'payload langganan harus memakai tabel yang dipilih');
});
test('langganan TIDAK memakai filter kolom', () => {
    assert.ok(!REALTIME.includes('filter:'), 'langganan orders tidak boleh memakai filter kolom');
});
test('perubahan di-debounce, bukan langsung memicu fetch', () => {
    assert.ok(REALTIME.includes('setTimeout'), 'harus ada penundaan debounce');
    assert.ok(REALTIME.includes('clearTimeout'), 'timer debounce harus dibersihkan');
    assert.ok(REALTIME.includes('debounceMs'), 'interval debounce harus bisa diatur');
});
test('kanal selalu dilepas saat pembongkaran', () => {
    assert.ok(REALTIME.includes('removeChannel'), 'kanal Realtime wajib dilepas');
});
test('hook penjual memakai langganan realtime', () => {
    assert.ok(SELLER_HOOK.includes('subscribeOrdersRealtime'), 'hook penjual harus memakai langganan realtime');
});
test('hook penjual melepas langganan saat subscriber terakhir pergi', () => {
    assert.ok(SELLER_HOOK.includes('unsubscribeRealtime'), 'hook penjual harus menyimpan pembongkar langganan');
    const cleanup = SELLER_HOOK.slice(SELLER_HOOK.indexOf('listeners.length === 0'));
    assert.ok(cleanup.includes('unsubscribeRealtime()'), 'langganan harus dilepas saat subscriber terakhir pergi');
});
test('polling tetap ada sebagai fallback', () => {
    assert.ok(SELLER_HOOK.includes('POLL_INTERVAL_MS'), 'polling fallback harus dipertahankan');
    assert.ok(SELLER_HOOK.includes('setInterval'), 'polling fallback harus benar-benar dipasang');
});
test('tidak memakai kanal broadcast publik', () => {
    assert.ok(!REALTIME.includes('broadcast'), 'tidak boleh memakai kanal broadcast publik');
});
