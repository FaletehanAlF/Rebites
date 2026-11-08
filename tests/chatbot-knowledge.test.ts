import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ADMIN_ROUTES, ASSISTANT_MODEL_IDENTITY, ASSISTANT_NAME, ASSISTANT_PROVIDER, ASSISTANT_PROVIDER_LABEL, BUYER_ROUTES, PUBLIC_ROUTES, REBITES_DEVELOPER, REBITES_TEAM, SELLER_ROUTES, SUBSCRIPTION_FACTS_SEED, buildSystemPrompt, modelIdentityAnswer, ownerAnswer, providerAnswer, subscriptionFacts, subscriptionProductLimits, type RouteDoc, } from '../lib/chatbot/knowledge.ts';
import { SUBSCRIPTION_PLANS } from '../lib/subscription-plans.ts';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(HERE, '..', 'app');
const ALL_ROUTE_GROUPS: Array<{
    name: string;
    routes: RouteDoc[];
}> = [
    { name: 'PUBLIC_ROUTES', routes: PUBLIC_ROUTES },
    { name: 'BUYER_ROUTES', routes: BUYER_ROUTES },
    { name: 'SELLER_ROUTES', routes: SELLER_ROUTES },
    { name: 'ADMIN_ROUTES', routes: ADMIN_ROUTES },
];
test('setiap entri route menunjuk page.tsx yang benar-benar ada', () => {
    for (const group of ALL_ROUTE_GROUPS) {
        assert.ok(group.routes.length > 0, `${group.name} tidak boleh kosong`);
        for (const route of group.routes) {
            const file = path.join(APP_DIR, route.page);
            assert.ok(existsSync(file), `${group.name}: "${route.path}" menunjuk ${route.page} yang TIDAK ADA (${file})`);
        }
    }
});
test('setiap entri route punya label, detail, dan grup yang terisi', () => {
    for (const group of ALL_ROUTE_GROUPS) {
        for (const route of group.routes) {
            assert.ok(route.path.startsWith('/'), `${group.name}: path harus absolut: ${route.path}`);
            assert.ok(route.label.trim().length > 2, `${route.path}: label terlalu pendek`);
            assert.ok(route.detail.trim().length > 20, `${route.path}: detail terlalu pendek`);
            assert.ok(route.group.trim().length > 2, `${route.path}: grup menu kosong`);
        }
    }
});
test('harga dan fitur paket identik dengan SUBSCRIPTION_PLANS', () => {
    assert.equal(SUBSCRIPTION_FACTS_SEED.length, SUBSCRIPTION_PLANS.length, 'jumlah paket di seed harus sama dengan aplikasi');
    for (const plan of SUBSCRIPTION_PLANS) {
        const seed = SUBSCRIPTION_FACTS_SEED.find((item) => item.slug === plan.slug);
        assert.ok(seed, `paket "${plan.slug}" ada di aplikasi tetapi tidak di seed pengetahuan`);
        assert.equal(seed.name, plan.name, `nama paket ${plan.slug} berbeda`);
        assert.equal(seed.monthly, plan.monthly, `harga bulanan ${plan.slug} berbeda`);
        assert.equal(seed.yearly, plan.yearly, `harga tahunan ${plan.slug} berbeda`);
        assert.equal(seed.tagline, plan.tagline, `tagline ${plan.slug} berbeda`);
        assert.deepEqual(seed.features, plan.features, `fitur ${plan.slug} berbeda`);
    }
    for (const seed of SUBSCRIPTION_FACTS_SEED) {
        assert.ok(SUBSCRIPTION_PLANS.some((plan) => plan.slug === seed.slug), `seed memuat paket "${seed.slug}" yang tidak ada di aplikasi`);
    }
});
test('batas produk diturunkan dari fitur, bukan diketik ulang', () => {
    const limits = subscriptionProductLimits();
    const bySlug = new Map(limits.map((item) => [item.slug, item.limit]));
    assert.equal(bySlug.get('basic'), 3);
    assert.equal(bySlug.get('standar'), 5);
    assert.equal(bySlug.get('premium'), 15);
});
test('subscriptionFacts menyebut rupiah dan nama paket', () => {
    const facts = subscriptionFacts();
    assert.equal(facts.length, SUBSCRIPTION_PLANS.length);
    for (const line of facts) {
        assert.match(line, /Rp/, 'setiap baris harus memuat harga rupiah');
        assert.match(line, /per bulan/, 'setiap baris harus menyebut siklus bulanan');
        assert.match(line, /per tahun/, 'setiap baris harus menyebut siklus tahunan');
    }
});
test('prompt publik memuat cara pesan tetapi TIDAK menyebut tools', () => {
    const prompt = buildSystemPrompt('publik');
    assert.match(prompt, /ReBites/);
    assert.match(prompt, /\/auth\/login/, 'harus menyebut cara masuk');
    assert.match(prompt, /\/auth\/register\/penjual/, 'harus menyebut cara daftar penjual');
    assert.match(prompt, /\/makanan/, 'harus menyebut katalog makanan');
    assert.ok(!/tools?\b/i.test(prompt), 'prompt publik tidak boleh menjanjikan tools yang tidak dimiliki profil ini');
    assert.ok(!/MODE ADMIN/i.test(prompt), 'prompt publik tidak boleh memuat bagian mode admin');
});
test('prompt anggota memuat menu pembeli dan penjual', () => {
    const prompt = buildSystemPrompt('anggota');
    assert.match(prompt, /\/riwayatPesanan/, 'harus menyebut riwayat pesanan');
    assert.match(prompt, /\/dashboard\/penjual\/menu/, 'harus menyebut menu penjual');
    assert.match(prompt, /Flash Sale/, 'harus menyebut menu flash sale');
    assert.ok(!/MODE ADMIN/i.test(prompt));
});
test('prompt admin memuat tools DAN kewajiban konfirmasi', () => {
    const prompt = buildSystemPrompt('admin');
    assert.match(prompt, /MODE ADMIN/);
    assert.match(prompt, /tools/i, 'harus menjelaskan adanya tools data');
    assert.match(prompt, /konfirmasi|Setujui/i, 'harus menjelaskan aksi perlu konfirmasi admin');
    assert.match(prompt, /TIDAK BOLEH memberi sanksi|tidak boleh memberi sanksi/i, 'harus menyatakan sanksi di luar wewenang bot');
    assert.match(prompt, /\/dashboard\/admin\/monitoring\/sanksi/);
});
test('semua profil memuat aturan bahasa Indonesia dan batas topik', () => {
    for (const profile of ['publik', 'anggota', 'admin'] as const) {
        const prompt = buildSystemPrompt(profile);
        assert.match(prompt, /bahasa Indonesia/i, `${profile}: harus mengatur bahasa jawaban`);
        assert.match(prompt, /BATAS TOPIK/, `${profile}: harus memuat batas topik`);
        assert.match(prompt, /role play/i, `${profile}: harus melarang role play`);
        assert.match(prompt, /kode program/i, `${profile}: harus melarang menulis kode`);
    }
});
test('tidak ada path duplikat di dalam satu grup kecuali anchor pada halaman sama', () => {
    for (const group of ALL_ROUTE_GROUPS) {
        const seen = new Set<string>();
        for (const route of group.routes) {
            assert.ok(!seen.has(route.path), `${group.name}: path duplikat ${route.path}`);
            seen.add(route.path);
        }
    }
});
test('identitas asisten dan tim pengembang terdefinisi lengkap', () => {
    assert.equal(ASSISTANT_NAME, 'ReBitess-Asisten');
    assert.equal(ASSISTANT_MODEL_IDENTITY, 'GPT 6 Luna');
    assert.match(REBITES_DEVELOPER, /Tony Stark Inc/);
    assert.equal(REBITES_TEAM.length, 3, 'tim pengembang berjumlah tiga orang');
    const expected = [
        { name: 'Faletehan Al Farabi', role: 'Backend Developer' },
        { name: 'Aburahman Kayysan', role: 'Fullstack Developer' },
        { name: 'Jona Alfaros', role: 'Frontend Developer' },
    ];
    for (const person of expected) {
        const found = REBITES_TEAM.find((member) => member.name === person.name);
        assert.ok(found, `anggota tim "${person.name}" hilang atau ejaannya berubah`);
        assert.equal(found.role, person.role, `peran ${person.name} berbeda`);
        assert.ok(found.duty.trim().length > 20, `tugas ${person.name} terlalu pendek`);
    }
});
test('identitas masuk ke KETIGA profil, bukan hanya satu', () => {
    for (const profile of ['publik', 'anggota', 'admin'] as const) {
        const prompt = buildSystemPrompt(profile);
        assert.match(prompt, /IDENTITAS DIRI/, `${profile}: blok identitas tidak ada`);
        assert.ok(prompt.includes(ASSISTANT_NAME), `${profile}: nama asisten tidak disebut`);
        assert.ok(prompt.includes(ASSISTANT_MODEL_IDENTITY), `${profile}: identitas model tidak disebut`);
        assert.ok(prompt.includes('Tony Stark'), `${profile}: organisasi pembuat tidak disebut`);
        for (const member of REBITES_TEAM) {
            assert.ok(prompt.includes(member.name), `${profile}: "${member.name}" tidak disebut`);
        }
    }
});
test('tidak ada titik ganda pada nama organisasi berakhiran titik', () => {
    const samples = [ownerAnswer(), modelIdentityAnswer(), buildSystemPrompt('publik')];
    for (const text of samples) {
        assert.ok(!/Inc\.\./.test(text), 'nama organisasi menghasilkan titik ganda');
    }
    assert.match(REBITES_DEVELOPER, /Inc\.$/, 'nama organisasi harus tetap berakhiran "Inc."');
});
test('kalimat standar owner tidak mengklaim pemilik tunggal', () => {
    const answer = ownerAnswer();
    assert.match(answer, /Tony Stark/);
    for (const member of REBITES_TEAM) {
        assert.ok(answer.includes(member.name), `jawaban owner harus menyebut ${member.name}`);
    }
    assert.ok(!/\b(ceo|founder|pemilik tunggal|owner tunggal)\b/i.test(answer), 'peran developer bukan status kepemilikan; jangan klaim pemilik tunggal');
});
test('prompt melarang mengarang identitas yang tidak diberikan', () => {
    const prompt = buildSystemPrompt('publik');
    assert.match(prompt, /JANGAN mengubah ejaan nama/i);
    assert.match(prompt, /pemilik tunggal|CEO|founder/i);
    assert.match(prompt, /belum tersedia/i, 'harus mengatur jawaban bila info tidak ada');
});
test('identitas penyedia AI terdefinisi dan berbeda dari pembuat aplikasi', () => {
    assert.match(ASSISTANT_PROVIDER, /vibecodeagent\.my\.id/);
    assert.ok(ASSISTANT_PROVIDER_LABEL.trim().length > 3);
    assert.notEqual(ASSISTANT_PROVIDER_LABEL, REBITES_DEVELOPER.replace(/\.$/, ''), 'penyedia AI tidak boleh sama dengan pembuat aplikasi');
});
test('penyedia AI disebut di KETIGA profil', () => {
    for (const profile of ['publik', 'anggota', 'admin'] as const) {
        const prompt = buildSystemPrompt(profile);
        assert.ok(prompt.includes(ASSISTANT_PROVIDER), `${profile}: domain penyedia tidak disebut`);
        assert.ok(prompt.includes(ASSISTANT_PROVIDER_LABEL), `${profile}: nama penyedia tidak disebut`);
        assert.match(prompt, /PENYEDIA MODEL AI/, `${profile}: harus ada pembeda peran penyedia`);
    }
});
test('prompt menegaskan pembuat aplikasi BUKAN penyedia AI', () => {
    const prompt = buildSystemPrompt('publik');
    assert.match(prompt, /BEDAKAN DUA HAL INI/);
    assert.match(prompt, /jangan menyebut .* sebagai pembuat ReBites/i);
    assert.match(prompt, /PEMBUAT APLIKASI/i);
});
test('kalimat penyedia menyebut keduanya tanpa mengacak peran', () => {
    const answer = providerAnswer();
    assert.ok(answer.includes(ASSISTANT_PROVIDER), 'harus menyebut domain penyedia');
    assert.ok(answer.includes(ASSISTANT_PROVIDER_LABEL), 'harus menyebut nama penyedia');
    assert.match(answer, /Tony Stark/, 'harus tetap menyebut pembuat aplikasi');
    assert.ok(!/Inc\.\./.test(answer), 'tidak boleh ada titik ganda');
});
test('kalimat identitas model kini menyebut penyedia', () => {
    const answer = modelIdentityAnswer();
    assert.ok(answer.includes(ASSISTANT_NAME));
    assert.ok(answer.includes(ASSISTANT_MODEL_IDENTITY));
    assert.ok(answer.includes(ASSISTANT_PROVIDER), 'pertanyaan "kamu AI apa" harus menyebut asal');
});
test('prompt admin memuat aturan privasi data', () => {
    const prompt = buildSystemPrompt('admin');
    assert.match(prompt, /PRIVASI DATA/);
    assert.match(prompt, /tersamarkan/i, 'harus menjelaskan email disamarkan');
    assert.match(prompt, /nomor telepon/i, 'harus melarang menampilkan nomor telepon');
    assert.match(prompt, /alamat pengantaran disamarkan/i, 'harus menjelaskan alamat disamarkan');
});
test('prompt anggota melarang membuka kredensial dan data pribadi pihak lain', () => {
    const prompt = buildSystemPrompt('anggota');
    assert.match(prompt, /kata sandi|kode OTP/i, 'harus menyatakan tidak tahu kredensial');
    assert.match(prompt, /data pribadi/i, 'harus melarang membahas data pribadi pihak lain');
});
