/**
 * Konfigurasi Firebase Web SDK (modular) — HANYA untuk Google Authentication.
 *
 * Supabase tetap menjadi database dan sistem authentication utama ReBites
 * (email/password, OTP, reset password, Google OAuth Supabase). Modul ini
 * sengaja tidak menyentuh sesi, role, maupun alur auth yang sudah berjalan.
 *
 * Catatan keamanan:
 * - Semua nilai di sini bersifat PUBLIK untuk Web App (dipakai browser) dan
 *   memang harus berawalan NEXT_PUBLIC_. Kunci ini tidak memberi akses admin
 *   ke project Firebase.
 * - Jangan pernah menambahkan service account, private key, atau client secret
 *   ke file ini maupun ke variabel NEXT_PUBLIC_* mana pun.
 */

/**
 * Daftar kunci yang WAJIB terisi agar Firebase dapat diinisialisasi.
 * `measurementId`/Analytics tidak dipakai, jadi tidak diminta.
 */
export const FIREBASE_REQUIRED_ENV_KEYS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const;

export type FirebaseEnvKey = (typeof FIREBASE_REQUIRED_ENV_KEYS)[number];

/**
 * Dibaca dengan akses statis `process.env.NEXT_PUBLIC_*` agar Next.js dapat
 * meng-inline nilainya ke bundle browser saat build.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
} as const;

/** Kunci yang masih kosong (untuk pesan konfigurasi, tanpa membocorkan nilai). */
export function getMissingFirebaseEnvKeys(): FirebaseEnvKey[] {
  return FIREBASE_REQUIRED_ENV_KEYS.filter((key) => {
    switch (key) {
      case 'NEXT_PUBLIC_FIREBASE_API_KEY':
        return !firebaseConfig.apiKey;
      case 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN':
        return !firebaseConfig.authDomain;
      case 'NEXT_PUBLIC_FIREBASE_PROJECT_ID':
        return !firebaseConfig.projectId;
      case 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET':
        return !firebaseConfig.storageBucket;
      case 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID':
        return !firebaseConfig.messagingSenderId;
      case 'NEXT_PUBLIC_FIREBASE_APP_ID':
        return !firebaseConfig.appId;
      default:
        return true;
    }
  });
}

/**
 * true hanya bila keenam variabel terisi. Saat false, aplikasi HARUS tetap
 * berjalan normal (Supabase tidak terpengaruh) dan Firebase tidak diinisialisasi.
 */
export function isFirebaseConfigured(): boolean {
  return getMissingFirebaseEnvKeys().length === 0;
}
