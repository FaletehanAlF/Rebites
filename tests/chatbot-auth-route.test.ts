import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readProjectFile(relative: string): string {
    return readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
}

const AUTH_GUARD = /if \(pathname\?\.startsWith\('\/auth'\)\)\s*return null;/;

function widgetMountedOn(source: string, pathname: string): boolean {
    if (!AUTH_GUARD.test(source))
        return true;
    return !pathname.startsWith('/auth');
}

test('widget chatbot tidak dipasang di halaman auth', () => {
    const source = readProjectFile('app/components/chatbot/chatbot-mount.tsx');
    assert.equal(widgetMountedOn(source, '/auth/login'), false);
    assert.equal(widgetMountedOn(source, '/auth/register'), false);
    assert.equal(widgetMountedOn(source, '/auth/register/penjual'), false);
    assert.equal(widgetMountedOn(source, '/auth/forgotPassword'), false);
});

test('widget chatbot tetap dipasang di halaman biasa', () => {
    const source = readProjectFile('app/components/chatbot/chatbot-mount.tsx');
    assert.equal(widgetMountedOn(source, '/home'), true);
    assert.equal(widgetMountedOn(source, '/detail/toko'), true);
    assert.equal(widgetMountedOn(source, '/riwayatPesanan'), true);
});

test('komponen memakai usePathname dan mengembalikan null untuk jalur /auth', () => {
    const source = readProjectFile('app/components/chatbot/chatbot-mount.tsx');
    assert.match(source, /import \{ usePathname \} from 'next\/navigation';/);
    assert.match(source, AUTH_GUARD);
    assert.match(source, /const pathname = usePathname\(\);/);
    assert.match(source, /return <ChatbotWidget \/>;/);
    assert.match(source, /ssr: false/);
});

test('penjaga bisa gagal: tanpa penjaga /auth, widget ikut dipasang di halaman login', () => {
    const source = readProjectFile('app/components/chatbot/chatbot-mount.tsx');
    const tanpaPenjaga = source.replace(AUTH_GUARD, '');
    assert.notEqual(tanpaPenjaga, source);
    assert.equal(widgetMountedOn(source, '/auth/login'), false);
    assert.equal(widgetMountedOn(tanpaPenjaga, '/auth/login'), true);
});
