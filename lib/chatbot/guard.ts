/**
 * Penjaga deterministik untuk chatbot ReBites.
 *
 * Modul MURNI (tanpa impor runtime) supaya aturannya dapat diuji langsung
 * dengan `node --test`.
 *
 * Kenapa lapisan ini ada padahal ada system prompt: prompt hanyalah imbauan.
 * Model bisa terbujuk oleh kalimat yang menyamar sebagai instruksi sistem,
 * dan setiap kali itu terjadi biayanya sudah terlanjur keluar. Penyaringan
 * di sini berjalan SEBELUM provider dipanggil, sehingga permintaan yang jelas
 * di luar konteks ditolak tanpa memakai kuota dan tanpa kesempatan bagi model
 * untuk menyimpang.
 *
 * Prinsip penyusunan pola: berjangkar pada FRASA PERINTAH yang eksplisit,
 * bukan pada topik. Daftar kata topik akan salah dua arah — "bagaimana cara
 * upload produk?" dan "cara mengubah kata sandi" adalah pertanyaan sah yang
 * memakai kata kerja teknis, sedangkan "abaikan instruksi sebelumnya" harus
 * selalu ditolak. Karena itu setiap pola menyebut kombinasi yang memang hanya
 * muncul pada permintaan keluar-konteks.
 */

export type GuardCategory =
  | 'instruksi-sistem'
  | 'menulis-kode'
  | 'role-play'
  | 'dokumen-asing'
  | 'tugas-asing';

export interface GuardBlock {
  allowed: false;
  category: GuardCategory;
  /** Alasan untuk log server; tidak ditampilkan apa adanya ke pengguna. */
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

/**
 * Pola ditulis dengan batas kata agar tidak menangkap potongan kata di dalam
 * kata lain. Semua diuji case-insensitive.
 */
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
      // Bentuk informal berimbuhan ("bikinin", "buatin", "bikinin dong") lazim
      // dipakai dan tetap harus tertangkap; akhiran `in`/`kan` opsional.
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

/** Batas panjang masukan; pesan sangat panjang bukan pola pertanyaan sah. */
export const GUARD_MAX_INPUT_CHARS = 2_000;

/** Batas panjang keluaran yang dikembalikan ke klien. */
export const GUARD_MAX_OUTPUT_CHARS = 4_000;

/**
 * Klasifikasi satu pesan pengguna.
 *
 * Urutan aturan tidak memengaruhi hasil akhir karena verdict pertama yang
 * cocok langsung dikembalikan — tetapi urutannya disusun dari yang paling
 * berbahaya (mengubah instruksi sistem) ke yang paling ringan.
 */
export function classifyInput(text: string): GuardVerdict {
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

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(value)) {
        return { allowed: false, category: rule.category, reason: rule.reason };
      }
    }
  }
  return { allowed: true };
}

/**
 * Balasan penolakan per kategori. Nada tetap ramah dan selalu menawarkan
 * kembali bantuan seputar ReBites, sehingga penolakan tidak terasa seperti
 * dinding yang mematikan percakapan.
 */
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
    case 'tugas-asing':
    default:
      return `${base} Pertanyaan itu di luar topik yang bisa saya bantu. Saya bisa menjelaskan cara memesan, cara berjualan, letak menu, atau paket langganan.`;
  }
}

/**
 * Bersihkan keluaran model sebelum dikirim ke klien.
 *
 * Dua masalah nyata yang dicegah:
 *   1. Model membocorkan penanda promptnya sendiri (bagian berhuruf kapital
 *      seperti "ATURAN MENJAWAB" atau "BATAS TOPIK") sehingga pengguna melihat
 *      isi instruksi internal.
 *   2. Model tetap menyisipkan blok kode panjang walaupun sudah diminta tidak,
 *      karena percakapan sebelumnya berisi contoh.
 *
 * Panjang keluaran juga dipotong: jawaban asisten yang terlalu panjang
 * merusak panel chat dan menandakan model melantur.
 */
export function sanitizeOutput(text: string): string {
  let value = (text ?? '').trim();
  if (!value) return '';

  // Buang blok kode berpagar utuh, ganti dengan penanda singkat.
  if (value.includes('```')) {
    value = value.replace(/```[\s\S]*?```/g, '(blok kode dihapus)');
    value = value.replace(/```[\s\S]*$/g, '(blok kode dihapus)');
  }

  // Buang kemunculan penanda internal prompt.
  const markers = [
    /ATURAN MENJAWAB/gi,
    /BATAS TOPIK\s*\(WAJIB\)/gi,
    /PROFIL\s*:/gi,
    /SYSTEM PROMPT/gi,
    /^\s*Kamu adalah Asisten ReBites.*$/gim,
  ];
  for (const marker of markers) value = value.replace(marker, '');

  value = value.replace(/\n{3,}/g, '\n\n').trim();

  if (value.length > GUARD_MAX_OUTPUT_CHARS) {
    value = `${value.slice(0, GUARD_MAX_OUTPUT_CHARS).trimEnd()}…`;
  }
  return value;
}

/** true bila keluaran tampak membocorkan aturan internal (dipakai tes). */
export function leaksInternalPrompt(text: string): boolean {
  return /ATURAN MENJAWAB|BATAS TOPIK|SYSTEM PROMPT/i.test(text ?? '');
}
