import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSiteUrl, requestOriginFrom } from '../lib/server/site-url.ts';
const DEV = false;
test('dev: port env yang berbeda dari server diganti origin request', () => {
    const result = resolveSiteUrl({
        configuredUrl: 'http://localhost:3001',
        requestOrigin: 'http://localhost:3000',
        isProduction: DEV,
    });
    assert.equal(result.url, 'http://localhost:3000');
    assert.equal(result.replacedConfiguredPort, true);
});
test('dev: port yang sama dibiarkan apa adanya (tidak ada peringatan palsu)', () => {
    const result = resolveSiteUrl({
        configuredUrl: 'http://localhost:3000',
        requestOrigin: 'http://localhost:3000',
        isProduction: DEV,
    });
    assert.equal(result.url, 'http://localhost:3000');
    assert.equal(result.replacedConfiguredPort, false);
});
test('dev: trailing slash pada env tidak menghasilkan URL berakhiran "/"', () => {
    const result = resolveSiteUrl({
        configuredUrl: 'http://localhost:3000/',
        requestOrigin: 'http://localhost:3000',
        isProduction: DEV,
    });
    assert.equal(result.url, 'http://localhost:3000');
});
test('dev: 127.0.0.1 dan localhost dianggap sama-sama lokal', () => {
    const result = resolveSiteUrl({
        configuredUrl: 'http://localhost:3001',
        requestOrigin: 'http://127.0.0.1:3000',
        isProduction: DEV,
    });
    assert.equal(result.url, 'http://127.0.0.1:3000');
    assert.equal(result.replacedConfiguredPort, true);
});
test('dev: URL non-lokal (tunnel) TIDAK ditimpa origin request', () => {
    const result = resolveSiteUrl({
        configuredUrl: 'https://rebites.ngrok.app',
        requestOrigin: 'http://localhost:3000',
        isProduction: DEV,
    });
    assert.equal(result.url, 'https://rebites.ngrok.app');
    assert.equal(result.replacedConfiguredPort, false);
});
test('dev: env kosong memakai origin request (bukan localhost:3000 hardcoded)', () => {
    const result = resolveSiteUrl({
        configuredUrl: '',
        requestOrigin: 'http://localhost:4321',
        isProduction: DEV,
    });
    assert.equal(result.url, 'http://localhost:4321');
});
test('dev: tanpa env dan tanpa request, jatuh ke localhost:3000', () => {
    const result = resolveSiteUrl({
        configuredUrl: null,
        requestOrigin: null,
        isProduction: DEV,
    });
    assert.equal(result.url, 'http://localhost:3000');
});
test('production: origin request TIDAK PERNAH dipakai walau port env berbeda', () => {
    const result = resolveSiteUrl({
        configuredUrl: 'https://rebites.vercel.app',
        requestOrigin: 'http://localhost:3001',
        isProduction: true,
    });
    assert.equal(result.url, 'https://rebites.vercel.app');
    assert.equal(result.replacedConfiguredPort, false);
});
test('production: env lokal yang keliru TETAP dipakai + ditandai (bukan ditimpa senyap)', () => {
    const result = resolveSiteUrl({
        configuredUrl: 'http://localhost:3001',
        requestOrigin: 'https://rebites.vercel.app',
        isProduction: true,
    });
    assert.equal(result.url, 'http://localhost:3001');
    assert.equal(result.replacedConfiguredPort, false);
});
test('production: env kosong ditandai missingInProduction', () => {
    const result = resolveSiteUrl({
        configuredUrl: '   ',
        requestOrigin: 'https://rebites.vercel.app',
        isProduction: true,
    });
    assert.equal(result.missingInProduction, true);
});
test('requestOriginFrom: memakai Host header dan protokol request', () => {
    const req = new Request('http://localhost:3000/api/x', {
        headers: { host: 'localhost:3000' },
    });
    assert.equal(requestOriginFrom(req), 'http://localhost:3000');
});
test('requestOriginFrom: Host header berbeda (proxy) diikuti', () => {
    const req = new Request('http://internal:3000/api/x', {
        headers: { host: 'rebites.test:8080' },
    });
    assert.equal(requestOriginFrom(req), 'http://rebites.test:8080');
});
