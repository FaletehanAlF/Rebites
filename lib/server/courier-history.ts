/**
 * Pembinaan konteks riwayat untuk Kurir AI.
 *
 * MURNI — tanpa jaringan/database — supaya dapat diuji dengan `node --test`.
 * Route yang memverifikasi partisipan dan memuat baris dari DATABASE
 * (bukan dari client); modul ini hanya menormalkan dan membatasi.
 *
 * ATURAN
 * - Yang dikirim HANYA percakapan pesanan ini (filter order_id dilakukan
 *   oleh pemanggil); tidak ada data dari pesanan lain.
 * - Jenis pengirim dipetakan: user → user; ai_courier & demo_courier → model.
 *   Baris yang tidak dikenal diperlakukan sebagai user (aman: tidak
 *   menyamar sebagai asisten).
 * - Dibatasi: maksimal N pesan terakhir, per pesan & total karakter —
 *   agar biaya dan latensi tetap terkendali.
 * - Giliran bersebelahan dengan peran sama DIGABUNG; konteks output selalu
 *   berformat user/model alternatif sebagaimana diharapkan Gemini, dan TIDAK
 *   pernah diawali giliran 'model' tanpa giliran 'user' sebelumnya.
 * - Jika pemotongan diperlukan, selalu buang yang PALING LAMA; pesan
 *   pembeli terakhir tidak pernah dibuang.
 */

import type { CourierAiContent } from './gemini.ts';

export const HISTORY_MAX_MESSAGES = 10;
export const HISTORY_MAX_MESSAGE_CHARS = 300;
export const HISTORY_MAX_TOTAL_CHARS = 1800;

export interface CourierHistoryRow {
  senderKind: string;
  body: string;
}

export interface BuildHistoryOptions {
  maxMessages?: number;
  maxMessageChars?: number;
  maxTotalChars?: number;
}

export function buildHistoryContents(
  rows: CourierHistoryRow[],
  options: BuildHistoryOptions = {}
): CourierAiContent[] {
  const maxMessages = options.maxMessages ?? HISTORY_MAX_MESSAGES;
  const maxMessageChars = options.maxMessageChars ?? HISTORY_MAX_MESSAGE_CHARS;
  const maxTotalChars = options.maxTotalChars ?? HISTORY_MAX_TOTAL_CHARS;

  // 1. Petakan & bersihkan tiap baris.
  const cleaned: CourierAiContent[] = [];
  for (const row of rows) {
    const role = row.senderKind === 'ai_courier' || row.senderKind === 'demo_courier'
      ? 'model'
      : 'user';
    const text = (row.body ?? '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    cleaned.push({
      role,
      parts: [{ text: text.slice(0, maxMessageChars) }],
    });
  }

  // 2. Ambil N pesan terakhir saja (rows sudah kronologis dari pemanggil).
  const recent = cleaned.slice(-maxMessages);

  // 3. Batasi total karakter; buang terlama, pertahankan yang terbaru.
  let total = 0;
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const len = recent[i].parts[0].text.length;
    total += len;
    if (total > maxTotalChars) {
      recent.splice(0, i + 1);
      break;
    }
  }

  // 4. Gabungkan giliran bersebelahan dengan peran yang sama.
  const merged: CourierAiContent[] = [];
  for (const item of recent) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === item.role) {
      prev.parts = [{ text: `${prev.parts[0].text}\n${item.parts[0].text}` }];
    } else {
      merged.push({ role: item.role, parts: [{ ...item.parts[0] }] });
    }
  }

  // 5. Konteks Gemini tidak boleh diawali giliran 'model' tanpa giliran
  //    'user' sebelumnya — sebagian varian model menolak bentuk itu. Buang
  //    giliran 'model' di awal; bila tidak ada pesan user sama sekali,
  //    kembalikan kosong (pemanggil memilih fallback Kurir Demo).
  const firstUserIdx = merged.findIndex((item) => item.role === 'user');
  if (firstUserIdx === -1) return [];
  return merged.slice(firstUserIdx);
}

/** true bila riwayat memuat minimal satu pesan pengguna. */
export function hasBuyerMessage(contents: CourierAiContent[]): boolean {
  return contents.some((c) => c.role === 'user');
}
