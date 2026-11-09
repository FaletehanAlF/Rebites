import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const source = readFileSync(join(ROOT, 'app/components/seller/subscription/subscription-success-client.tsx'), 'utf8');

function between(startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    assert.notEqual(start, -1, `${startMarker} tidak ditemukan`);
    const end = source.indexOf(endMarker, start);
    assert.ok(end > start, `${endMarker} tidak ditemukan setelah ${startMarker}`);
    return source.slice(start, end);
}

test('status menunggu pembayaran punya jalan pulang manual ke beranda', () => {
    const pending = between("if (status === 'pending')", "if (status === 'failed')");
    assert.ok(pending.includes('href="/home"'), 'tanpa jalan pulang, pengguna terjebak saat verifikasi tidak pernah selesai');
    assert.ok(pending.includes('Kembali ke ReBites'));
});

test('status menunggu tetap menawarkan cek langganan', () => {
    const pending = between("if (status === 'pending')", "if (status === 'failed')");
    assert.ok(pending.includes('Cek Langganan'));
});

test('status gagal dan aktif tetap punya tombol keluar', () => {
    assert.ok(source.includes('Kembali ke Langganan'));
    assert.ok(source.includes('resolvePostPaymentHref({ hasStore, storeId })'));
});
