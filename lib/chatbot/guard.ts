export type GuardCategory = 'instruksi-sistem' | 'menulis-kode' | 'role-play' | 'dokumen-asing' | 'tugas-asing' | 'akses-admin' | 'data-pribadi';
export interface GuardBlock {
    allowed: false;
    category: GuardCategory;
    reason: string;
}
export interface GuardAllow {
    allowed: true;
}
export type GuardVerdict = GuardAllow | GuardBlock;
interface Rule {
    category: GuardCategory;
    reason: string;
    patterns: RegExp[];
}
const RULES: Rule[] = [
    {
        category: 'instruksi-sistem',
        reason: 'Permintaan mengubah atau membocorkan instruksi sistem.',
        patterns: [
            /\b(abaikan|lewati|lupakan)\s+(semua\s+)?(instruksi|aturan|perintah)\b/i,
            /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)\b/i,
            /\bsystem\s*prompt\b/i,
            /\b(prompt|instruksi)\s+(sistem|awal|dasar)\s*(mu|kamu|anda)?\b/i,
            /\btampilkan\s+(prompt|instruksi)\b/i,
            /\b(reveal|show|print|repeat)\s+(your\s+)?(system\s+)?(prompt|instructions?)\b/i,
            /\b(jailbreak|dan\s*mode|developer\s*mode)\b/i,
            /\bkami\s+dari\s+(tim\s+)?(pengembang|developer)\b.*\b(akses|buka|tampilkan)\b/i,
        ],
    },
    {
        category: 'menulis-kode',
        reason: 'Permintaan menulis atau memperbaiki kode program.',
        patterns: [
            /\b(buat|buatkan|buatin|tulis|tuliskan|tulisin|bikin|bikinin|hasilkan|generate)(?:in|kan)?\s+(kode|code|program|script|skrip|fungsi|function|kelas|class|komponen|component|query|api)\b/i,
            /\b(write|generate|create|produce)\s+(me\s+)?(a\s+)?(code|program|script|function|class|component|query)\b/i,
            /\b(kode|code)\s+(python|javascript|typescript|java|php|html|css|sql|c\+\+|golang|rust|react|next\.?js)\b/i,
            /\b(perbaiki|debug|refactor|refactoring)\s+(kode|code|program|fungsi|function)\b/i,
            /\bfix\s+(my|this|the)\s+(code|bug|script)\b/i,
            /```/,
            /\b(contoh|sample)\s+(kode|code)\b/i,
        ],
    },
    {
        category: 'role-play',
        reason: 'Permintaan bermain peran atau berpura-pura menjadi entitas lain.',
        patterns: [
            /\b(role\s*-?\s*play|roleplay|bermain\s+peran|main\s+peran)\b/i,
            /\b(berpura|pura)\s*-?\s*pura\b/i,
            /\bkamu\s+(sekarang|mulai\s+sekarang)\s+(adalah|jadi|menjadi)\b/i,
            /\b(anggap|anggap\s+lah|bayangkan)\s+(kamu|dirimu|anda)\s+(adalah|sebagai)\b/i,
            /\b(pretend|act\s+as|you\s+are\s+now)\b/i,
            /\b(jadilah|jadikan\s+kamu)\s+(seorang|sebuah|tokoh|karakter)\b/i,
            /\bbahasa\s+(karakter|tokoh|peran)\b/i,
        ],
    },
    {
        category: 'dokumen-asing',
        reason: 'Permintaan menerjemahkan atau merangkum dokumen milik pengguna.',
        patterns: [
            /\b(terjemahkan|translate)\s+(dokumen|teks|artikel|file|pdf|ini)\b/i,
            /\b(ringkas|rangkum|summarize)\s+(dokumen|file|pdf|lampiran|teks\s+berikut)\b/i,
        ],
    },
    {
        category: 'tugas-asing',
        reason: 'Permintaan mengerjakan tugas yang tidak berhubungan dengan ReBites.',
        patterns: [
            /\b(kerjakan|jawab|selesaikan)\s+(tugas|pr|pekerjaan\s+rumah|soal|ujian)\b/i,
            /\b(buatkan|tulis)\s+(esai|makalah|puisi|pantun|cerpen|novel|lirik|lagu)\b/i,
            /\b(hitung|selesaikan)\s+(integral|persamaan|soal\s+matematika)\b/i,
            /\b(soal|rumus)\s+(matematika|fisika|kimia)\b/i,
            /\b(write|compose)\s+(an?\s+)?(essay|poem|song|story)\b/i,
        ],
    },
];
const SECRET_PATTERNS: RegExp[] = [
    /\b(api\s*key|apikey|service[_\s-]?role|secret\s*key|access\s*token|refresh\s*token|bearer\s*token)\b/i,
    /\b(kunci|key)\s+(rahasia|server|env|environment)\b/i,
    /\.env\b/i,
    /\b(isenv|env\s+file|file\s+env|environment\s+file)\b/i,
    /\b(kata\s*sandi|password|sandi|otp|kode\s+verifikasi)\b[^.!?]{0,20}\b(orang\s+lain|user\s+lain|pengguna\s+lain|akun\s+lain|pihak\s+lain)\b/i,
    /\b(bocorkan|bobol|retas|curi)\b/i,
];
const PERSONAL_DATA_PATTERNS: RegExp[] = [
    /\b(email|nomor\s+(telepon|hp)|no\.?\s*hp|whatsapp|alamat)\b[^.!?]{0,25}\b(orang\s+lain|user\s+lain|pengguna\s+lain|pembeli\s+lain|penjual\s+lain|toko\s+lain|akun\s+lain|pihak\s+lain|(pembeli|penjual|user|pengguna|akun)\s+(itu|tersebut|lainnya))\b/i,
    /\b(data|biodata|identitas|profil|akun|isi\s+(pesan|chat)|percakapan)\b[^.!?]{0,20}\b(orang\s+lain|user\s+lain|pengguna\s+lain|pembeli\s+lain|penjual\s+lain|pihak\s+lain)\b/i,
    /\b(tampilkan|sebutkan|kasih|beri|lihatkan|minta|kirim|daftar|dump|ekspor|export)\b[^.!?]{0,25}\b(semua|seluruh|para)\b[^.!?]{0,20}\b(pengguna|user|akun|email|nomor|alamat|data\s+pribadi)\b/i,
    /\b(email|nomor\s+(telepon|hp)|no\.?\s*hp|alamat|kontak|data\s+pribadi)\b[^.!?]{0,20}\b(semua|seluruh|para)\b[^.!?]{0,20}\b(pengguna|user|akun|pembeli|penjual|orang)\b/i,
    /\b(pesanan|riwayat|chat|percakapan)\s+(orang\s+lain|user\s+lain|pengguna\s+lain|pembeli\s+lain|penjual\s+lain)\b/i,
];
export const GUARD_MAX_INPUT_CHARS = 2000;
export const GUARD_MAX_OUTPUT_CHARS = 4000;
const ADMIN_ONLY_PATTERNS: RegExp[] = [
    /\/dashboard\/admin\b/i,
    /\b(panel|dashboard|halaman|menu|fitur)\s+(khusus\s+)?admin\b/i,
    /\badmin\s+(panel|dashboard)\b/i,
    /\b(menu|halaman|fitur)\s+(moderasi|monitoring|audit(\s+admin)?|permintaan\s+role)\b/i,
];
export function classifyInput(text: string, profile: 'publik' | 'anggota' | 'admin' = 'publik'): GuardVerdict {
    const value = (text ?? '').trim();
    if (!value) {
        return { allowed: false, category: 'tugas-asing', reason: 'Pesan kosong.' };
    }
    if (value.length > GUARD_MAX_INPUT_CHARS) {
        return {
            allowed: false,
            category: 'tugas-asing',
            reason: `Pesan melebihi ${GUARD_MAX_INPUT_CHARS} karakter.`,
        };
    }
    if (profile !== 'admin') {
        for (const pattern of ADMIN_ONLY_PATTERNS) {
            if (pattern.test(value)) {
                return {
                    allowed: false,
                    category: 'akses-admin',
                    reason: 'Permintaan seputar panel admin dari profil non-admin.',
                };
            }
        }
    }
    for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(value)) {
            return {
                allowed: false,
                category: 'data-pribadi',
                reason: 'Permintaan memperoleh kredensial atau rahasia sistem.',
            };
        }
    }
    if (profile !== 'admin') {
        for (const pattern of PERSONAL_DATA_PATTERNS) {
            if (pattern.test(value)) {
                return {
                    allowed: false,
                    category: 'data-pribadi',
                    reason: 'Permintaan data pribadi milik pengguna lain dari profil non-admin.',
                };
            }
        }
    }
    for (const rule of RULES) {
        for (const pattern of rule.patterns) {
            if (pattern.test(value)) {
                return { allowed: false, category: rule.category, reason: rule.reason };
            }
        }
    }
    return { allowed: true };
}
export function refusalMessage(category: GuardCategory): string {
    const base = 'Maaf, saya hanya bisa membantu seputar ReBites.';
    switch (category) {
        case 'menulis-kode':
            return `${base} Saya tidak bisa menuliskan atau memperbaiki kode program. Kalau perlu bantuan memakai fitur ReBites — misalnya cara mengunggah produk atau membaca laporan penjualan — silakan tanya.`;
        case 'role-play':
            return `${base} Saya tidak bisa bermain peran atau berpura-pura menjadi pihak lain. Saya di sini untuk membantu Anda mengenal dan memakai ReBites.`;
        case 'instruksi-sistem':
            return `${base} Saya tidak bisa menampilkan atau mengubah aturan kerja saya. Silakan tanyakan hal lain tentang cara memakai ReBites.`;
        case 'dokumen-asing':
            return `${base} Saya tidak bisa menerjemahkan atau merangkum dokumen Anda. Untuk pertanyaan tentang ReBites, saya siap membantu.`;
        case 'akses-admin':
            return `${base} Panel pengelola situs hanya dibuka untuk akun admin, dan saya menentukan itu dari akun yang sedang dipakai — bukan dari pernyataan di percakapan. Kalau Anda perlu sesuatu dari pengelola, silakan hubungi admin ReBites. Untuk memakai ReBites sebagai pembeli atau penjual, saya siap membantu.`;
        case 'data-pribadi':
            return `${base} Saya tidak bisa memberikan kata sandi, kode verifikasi, kunci sistem, atau data pribadi milik pengguna lain — itu bukan informasi yang boleh keluar lewat percakapan. Untuk keperluan akun Anda sendiri, gunakan menu Profil atau Pengaturan; bila menyangkut pengguna lain, hubungi admin ReBites.`;
        case 'tugas-asing':
        default:
            return `${base} Pertanyaan itu di luar topik yang bisa saya bantu. Saya bisa menjelaskan cara memesan, cara berjualan, letak menu, atau paket langganan.`;
    }
}
const INTERNAL_SECTION_HEADINGS = [
    'IDENTITAS DIRI (WAJIB)',
    'TIM PENGEMBANG REBITES',
    'ATURAN MENJAWAB SOAL PEMBUAT',
    'ATURAN MENJAWAB',
    'BATAS TOPIK (WAJIB)',
    'BATAS AKSES PROFIL INI (WAJIB)',
    'PERAN SAAT INI',
    'GAYA BICARA',
    'BEDAKAN DUA HAL INI',
    'DATA NYATA LEWAT TOOLS',
    'PRIVASI DATA',
    'AKSI MODERASI',
];
function isListOrTableLine(line: string): boolean {
    return /^\s*(?:[-*•+]|\d+[.)]|\|)/.test(line);
}
function stripInternalSections(text: string): string {
    const lines = text.split('\n');
    const kept: string[] = [];
    let skipping = false;
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const trimmed = line.trim();
        if (!trimmed) {
            if (!skipping) {
                kept.push(line);
                continue;
            }
            const next = lines.slice(index + 1).find((candidate) => candidate.trim());
            if (next !== undefined && isListOrTableLine(next))
                continue;
            skipping = false;
            kept.push(line);
            continue;
        }
        const isHeading = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
        if (isHeading) {
            skipping = INTERNAL_SECTION_HEADINGS.includes(trimmed);
            if (skipping)
                continue;
        }
        if (!skipping)
            kept.push(line);
    }
    return kept.join('\n');
}
export function sanitizeOutput(text: string): string {
    let value = (text ?? '').trim();
    if (!value)
        return '';
    if (value.includes('```')) {
        value = value.replace(/```[\s\S]*?```/g, '(blok kode dihapus)');
        value = value.replace(/```[\s\S]*$/g, '(blok kode dihapus)');
    }
    value = stripInternalSections(value);
    const markers = [
        /ATURAN MENJAWAB/gi,
        /BATAS TOPIK\s*\(WAJIB\)/gi,
        /PROFIL\s*:/gi,
        /SYSTEM PROMPT/gi,
        /IDENTITAS DIRI\s*\(WAJIB\)/gi,
        /TIM PENGEMBANG REBITES/gi,
        /PERAN SAAT INI/gi,
        /GAYA BICARA/gi,
        /BATAS AKSES PROFIL INI/gi,
        /PRIVASI DATA/gi,
        /DATA NYATA LEWAT TOOLS/gi,
        /AKSI MODERASI/gi,
        /^\s*(Kamu adalah|Nama kamu:)\s+(Asisten ReBites|ReBitess-Asisten).*$/gim,
    ];
    for (const marker of markers)
        value = value.replace(marker, '');
    value = value.replace(/\n{3,}/g, '\n\n').trim();
    if (value.length > GUARD_MAX_OUTPUT_CHARS) {
        value = `${value.slice(0, GUARD_MAX_OUTPUT_CHARS).trimEnd()}…`;
    }
    return value;
}
export function leaksInternalPrompt(text: string): boolean {
    return /ATURAN MENJAWAB|BATAS TOPIK|SYSTEM PROMPT|IDENTITAS DIRI|TIM PENGEMBANG REBITES|BATAS AKSES PROFIL INI|DATA NYATA LEWAT TOOLS|PERAN SAAT INI/i.test(text ?? '');
}
