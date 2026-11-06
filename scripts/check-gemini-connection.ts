/**
 * Health-check Gemini - tidak mencetak API key, tidak menyimpan state.
 *
 * Menjawab pertanyaan "apakah GEMINI_API_KEY saya benar-benar tersambung?"
 * dengan cara paling aman: GET /v1beta/models/{model} (tanpa generateContent).
 * Hasil hanya berupa status + alasan; key tidak pernah ditampilkan.
 *
 * CARA MENJALANKAN (dari root proyek):
 *   npm run test:gemini-connection
 *
 * SUMBER ENV
 * Skrip membaca GEMINI_API_KEY & GEMINI_MODEL dari environment proses. Bila
 * key belum ada, skrip memuat .env.local (lalu .env) dari direktori kerja
 * SENDIRI - kompatibel untuk semua versi Node yang bisa menjalankan berkas
 * .ts ini (tidak bergantung pada flag --env-file yang menuntut versi Node
 * tertentu dan gagal keras bila file belum ada). Isi file env hanya dipakai
 * untuk mengisi process.env dan tidak pernah dicetak.
 *
 * KEMUNGKINAN HASIL
 *   OK - model <nama> tersambung (<n> ms).
 *   BELUM SIAP - not_configured | invalid_key | quota_exceeded |
 *                model_unavailable | timeout | network | invalid_response
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { checkGeminiConnection } from '../lib/server/gemini.ts';

type ProcessWithLoadEnvFile = NodeJS.Process & {
  loadEnvFile?: (path?: string) => void;
};

/**
 * Muat .env.local (lalu .env) bila ada, TANPA menimpa variabel yang sudah
 * ada di environment proses. Utamakan process.loadEnvFile (Node >= 20.12,
 * parser resmi Node); parser minimal di bawah hanya cadangan.
 */
function tryLoadProjectEnv(): void {
  for (const rel of ['.env.local', '.env']) {
    const fullPath = path.resolve(process.cwd(), rel);
    if (!existsSync(fullPath)) continue;

    const loadEnvFile = (process as ProcessWithLoadEnvFile).loadEnvFile;
    if (typeof loadEnvFile === 'function') {
      try {
        loadEnvFile.call(process, fullPath);
      } catch {
        // File tidak dapat di-parse; health-check tetap berjalan dan akan
        // melaporkan not_configured bila key tetap tidak ada.
      }
      continue;
    }

    // Cadangan: parser minimal KEY=VALUE (komentar baris penuh & akhir baris,
    // prefiks "export", pasangan tanda kutip). Nilai kosong tidak mengisi env.
    try {
      const raw = readFileSync(fullPath, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, '');
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
        let value = trimmed.slice(eq + 1).trim();
        const hashIdx = value.indexOf(' #');
        if (hashIdx >= 0 && value[0] !== '"' && value[0] !== "'") {
          value = value.slice(0, hashIdx).trim();
        }
        if (
          (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
          (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
        ) {
          value = value.slice(1, -1);
        }
        if (value && process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    } catch {
      // Gagal membaca file; biarkan health-check memutuskan sendiri.
    }
  }
}

async function main(): Promise<void> {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    tryLoadProjectEnv();
  }

  const result = await checkGeminiConnection();

  if (result.ok) {
    console.log(`OK - model ${result.model} tersambung (${result.latencyMs} ms).`);
    process.exit(0);
    return;
  }

  console.log(`BELUM SIAP - ${result.reason}${result.model ? ` (model: ${result.model})` : ''}`);
  process.exit(1);
}

void main();
