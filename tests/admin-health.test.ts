import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HEALTH_SERVICE_KEYS, buildConfigurationService, buildHealthReport, buildHealthServiceReport, countCheckedServices, healthSourceLabel, healthStatusLabel, isAdminHealthReport, overallHealthLabel, overallHealthStatus, runHealthCheckPlan, withDeadline, type HealthProbeOutcome, type HealthServiceReport, } from '../lib/health-status.ts';
const NOW = new Date('2026-10-27T10:00:00.000Z');
const NOW_ISO = NOW.toISOString();
const fixedNow = () => NOW;
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}
function outcome(status: 'ok' | 'degraded', code: HealthProbeOutcome['code'] = null, latencyMs = 5, message = 'hasil probe'): HealthProbeOutcome {
    return { status, code, latencyMs, message };
}
function okService(key: (typeof HEALTH_SERVICE_KEYS)[number]): HealthServiceReport {
    return buildHealthServiceReport(key, outcome('ok'), NOW_ISO);
}
test('overallHealthStatus: degraded menang, lalu unknown, ok hanya jika semua ok', () => {
    assert.equal(overallHealthStatus([]), 'unknown');
    assert.equal(overallHealthStatus([okService('database')]), 'ok');
    assert.equal(overallHealthStatus([okService('database'), buildConfigurationService('payment', true, 'no_safe_probe')]), 'unknown');
    assert.equal(overallHealthStatus([
        okService('database'),
        buildConfigurationService('payment', false, 'no_safe_probe'),
        buildConfigurationService('shipping', true, 'no_safe_probe'),
    ]), 'degraded');
});
test('buildConfigurationService: konfigurasi ada tidak pernah menjadi ok', () => {
    const configured = buildConfigurationService('payment', true, 'no_safe_probe');
    assert.equal(configured.status, 'unknown');
    assert.equal(configured.code, 'no_safe_probe');
    assert.equal(configured.checkedAt, null);
    assert.equal(configured.latencyMs, null);
    const webhook = buildConfigurationService('webhook', true, 'no_inbound_test');
    assert.equal(webhook.status, 'unknown');
    assert.equal(webhook.code, 'no_inbound_test');
    const missing = buildConfigurationService('shipping', false, 'no_safe_probe');
    assert.equal(missing.status, 'degraded');
    assert.equal(missing.code, 'not_configured');
    assert.equal(missing.checkedAt, null);
});
test('label status tidak menyamakan unknown dengan sehat', () => {
    assert.equal(healthStatusLabel('ok'), 'Normal');
    assert.equal(healthStatusLabel('unknown'), 'Belum diperiksa');
    assert.equal(healthStatusLabel('degraded', 'not_configured'), 'Belum dikonfigurasi');
    assert.equal(healthStatusLabel('degraded', 'timeout'), 'Perlu perhatian');
    assert.equal(overallHealthLabel('unknown'), 'Sebagian belum diperiksa');
    assert.equal(overallHealthLabel('degraded'), 'Perlu perhatian');
    assert.equal(overallHealthLabel('ok'), 'Normal');
    assert.equal(healthSourceLabel(buildConfigurationService('payment', true, 'no_safe_probe')), 'Belum diperiksa');
    assert.equal(healthSourceLabel(buildConfigurationService('payment', false, 'no_safe_probe')), 'Konfigurasi server');
    assert.equal(healthSourceLabel(okService('database')), 'Pemeriksaan langsung');
});
test('countCheckedServices hanya menghitung pemeriksaan langsung', () => {
    const services = [
        okService('database'),
        okService('auth'),
        okService('storage'),
        buildConfigurationService('payment', true, 'no_safe_probe'),
        buildConfigurationService('shipping', true, 'no_safe_probe'),
        buildConfigurationService('webhook', true, 'no_inbound_test'),
    ];
    assert.equal(countCheckedServices(services), 3);
});
test('buildHealthReport menyusun status keseluruhan konservatif', () => {
    const report = buildHealthReport([
        okService('database'),
        okService('auth'),
        okService('storage'),
        buildConfigurationService('payment', true, 'no_safe_probe'),
        buildConfigurationService('shipping', true, 'no_safe_probe'),
        buildConfigurationService('webhook', true, 'no_inbound_test'),
    ], NOW_ISO);
    assert.equal(report.status, 'unknown');
    assert.equal(report.generatedAt, NOW_ISO);
    assert.equal(report.services.length, HEALTH_SERVICE_KEYS.length);
});
test('withDeadline: operasi selesai tepat waktu', async () => {
    const result = await withDeadline(Promise.resolve('selesai'), 100);
    assert.deepEqual(result, { status: 'completed', value: 'selesai' });
});
test('withDeadline: operasi lambat menghasilkan timeout', async () => {
    const late = new Promise<string>((resolve) => setTimeout(() => resolve('terlambat'), 50));
    const result = await withDeadline(late, 5);
    assert.deepEqual(result, { status: 'timeout' });
});
test('withDeadline: rejection diteruskan dan tidak menjadi unhandled', async () => {
    await assert.rejects(() => withDeadline(Promise.reject(new Error('probe gagal')), 100), /probe gagal/);
});
test('runner: probe langsung ok + provider terkonfigurasi menghasilkan unknown', async () => {
    const report = await runHealthCheckPlan({ authLatencyMs: 42 }, {
        probeDatabase: async () => outcome('ok', null, 8),
        probeStorage: async () => outcome('ok', null, 9),
        readConfiguration: () => ({ payment: true, shipping: true, webhook: true }),
        now: fixedNow,
    });
    assert.equal(report.status, 'unknown');
    assert.equal(report.generatedAt, NOW_ISO);
    assert.equal(report.services.length, 6);
    assert.equal(countCheckedServices(report.services), 3);
    const byKey = new Map(report.services.map((service) => [service.key, service]));
    assert.equal(byKey.get('database')?.status, 'ok');
    assert.equal(byKey.get('auth')?.status, 'ok');
    assert.equal(byKey.get('auth')?.latencyMs, 42);
    assert.equal(byKey.get('storage')?.status, 'ok');
    assert.equal(byKey.get('payment')?.status, 'unknown');
    assert.equal(byKey.get('shipping')?.status, 'unknown');
    assert.equal(byKey.get('webhook')?.status, 'unknown');
});
test('runner: kegagalan database tidak menggagalkan storage', async () => {
    const report = await runHealthCheckPlan({ authLatencyMs: 10 }, {
        probeDatabase: async () => outcome('degraded', 'timeout', 3000, 'Database timeout.'),
        probeStorage: async () => outcome('ok', null, 7),
        readConfiguration: () => ({ payment: true, shipping: true, webhook: true }),
        now: fixedNow,
    });
    assert.equal(report.status, 'degraded');
    const byKey = new Map(report.services.map((service) => [service.key, service]));
    assert.equal(byKey.get('database')?.status, 'degraded');
    assert.equal(byKey.get('database')?.code, 'timeout');
    assert.equal(byKey.get('storage')?.status, 'ok');
    assert.equal(byKey.get('auth')?.status, 'ok');
});
test('runner: konfigurasi provider hilang menghasilkan degraded', async () => {
    const report = await runHealthCheckPlan({ authLatencyMs: 10 }, {
        probeDatabase: async () => outcome('ok'),
        probeStorage: async () => outcome('ok'),
        readConfiguration: () => ({ payment: false, shipping: false, webhook: false }),
        now: fixedNow,
    });
    assert.equal(report.status, 'degraded');
    for (const key of ['payment', 'shipping', 'webhook'] as const) {
        const service = report.services.find((item) => item.key === key);
        assert.equal(service?.status, 'degraded');
        assert.equal(service?.code, 'not_configured');
    }
});
test('runner: exception tak terduga diubah menjadi degraded, bukan 500', async () => {
    let reportedKey = '';
    const report = await runHealthCheckPlan({ authLatencyMs: 10 }, {
        probeDatabase: async () => {
            throw new Error('detail internal tidak boleh bocor');
        },
        probeStorage: async () => outcome('ok'),
        readConfiguration: () => ({ payment: true, shipping: true, webhook: true }),
        now: fixedNow,
        onUnexpectedError: (key) => {
            reportedKey = key;
        },
    });
    assert.equal(reportedKey, 'database');
    assert.equal(report.status, 'degraded');
    const database = report.services.find((service) => service.key === 'database');
    assert.equal(database?.status, 'degraded');
    assert.equal(database?.code, 'query_failed');
    assert.doesNotMatch(database?.message ?? '', /detail internal/);
});
test('isAdminHealthReport menerima kontrak lengkap dan menolak yang cacat', async () => {
    const report = await runHealthCheckPlan({ authLatencyMs: 10 }, {
        probeDatabase: async () => outcome('ok'),
        probeStorage: async () => outcome('ok'),
        readConfiguration: () => ({ payment: true, shipping: true, webhook: true }),
        now: fixedNow,
    });
    assert.equal(isAdminHealthReport(report), true);
    assert.equal(isAdminHealthReport({ ...report, services: report.services.slice(1) }), false);
    assert.equal(isAdminHealthReport({
        ...report,
        services: [...report.services.slice(0, 5), report.services[0]],
    }), false);
    assert.equal(isAdminHealthReport({ ...report, status: 'sehat' }), false);
    assert.equal(isAdminHealthReport({
        ...report,
        services: report.services.map((service, index) => index === 0 ? { ...service, latencyMs: -1 } : service),
    }), false);
});
test('route health memakai gate admin, no-store, dan tidak memanggil provider', () => {
    const route = readProjectFile('app/api/admin/health/route.ts');
    assert.match(route, /getAdminUser\(authHeader\)/);
    assert.match(route, /getUserFromBearer\(authHeader\)/);
    assert.match(route, /status: user \? 403 : 401/);
    assert.match(route, /runHealthChecks\(/);
    assert.match(route, /runtime = 'nodejs'/);
    assert.match(route, /dynamic = 'force-dynamic'/);
    assert.match(route, /Cache-Control': 'no-store'/);
    assert.doesNotMatch(route, /err\.message/);
    assert.doesNotMatch(route, /createXenditInvoice|createBiteshipShipment|getBiteshipRates|\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});
test('probe hanya membaca database/storage dan tidak memanggil provider', () => {
    const probes = readProjectFile('lib/server/health-probes.ts');
    assert.match(probes, /\.select\('id', \{ count: 'exact', head: true \}\)/);
    assert.match(probes, /\.list\('', \{ limit: 1 \}\)/);
    assert.match(probes, /readHealthConfiguration/);
    assert.doesNotMatch(probes, /createXenditInvoice|createBiteshipShipment|getBiteshipRates|storage\.upload|storage\.remove|\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});
test('UI memiliki loading, error, forbidden, retry, dan refresh manual', () => {
    const view = readProjectFile('app/components/admin/system-health-view.tsx');
    assert.match(view, /fetchAdminHealth\(/);
    assert.match(view, /AdminLoadingState/);
    assert.match(view, /AdminErrorState/);
    assert.match(view, /AdminForbiddenState/);
    assert.match(view, /Periksa ulang/);
    assert.match(view, /Tidak ada invoice, shipment, atau event uji/);
    assert.match(view, /service\.code \?\? '—'/);
    assert.doesNotMatch(view, /service\.code \?\? 'ok'/);
    const page = readProjectFile('app/dashboard/admin/system/page.tsx');
    assert.match(page, /SystemHealthView/);
    assert.doesNotMatch(page, /const SERVICES/);
    assert.doesNotMatch(page, /Belum diperiksa/);
});
test('client health memakai no-store dan memvalidasi respons', () => {
    const client = readProjectFile('lib/admin-health.ts');
    assert.match(client, /cache: 'no-store'/);
    assert.match(client, /isAdminHealthReport\(json\)/);
    assert.doesNotMatch(client, /stack|stackTrace/);
});
