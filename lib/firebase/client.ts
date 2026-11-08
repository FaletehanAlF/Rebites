'use client';

/**
 * Inisialisasi Firebase Web SDK — singleton, lazy, dan aman saat env kosong.
 *
 * Tahap ini HANYA menyiapkan konfigurasi. Belum ada pemanggilan
 * `signInWithPopup`/`GoogleAuthProvider` dan belum ada jembatan sesi Firebase
 * → Supabase. Login/Register Google yang berjalan sekarang tetap memakai
 * Supabase OAuth (`lib/auth-oauth.ts`).
 *
 * Mengapa lazy:
 * - `initializeApp` tidak dijalankan saat modul diimpor, sehingga build/SSR
 *   dengan env kosong tidak gagal.
 * - `firebase/auth` diimpor dinamis, jadi bundle server tidak ikut menariknya.
 * - `getApps()` mencegah "Firebase App named '[DEFAULT]' already exists" saat
 *   hot reload maupun saat modul dievaluasi ulang.
 */

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';

import { firebaseConfig, isFirebaseConfigured } from './config';

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

function hasBrowserRuntime(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Ambil instance Firebase App (satu per halaman). Mengembalikan `null` bila
 * konfigurasi belum lengkap atau dipanggil di server — bukan melempar error,
 * agar halaman auth tetap berfungsi tanpa Firebase.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (!hasBrowserRuntime() || !isFirebaseConfigured()) return null;
  if (cachedApp) return cachedApp;

  const existingApps = getApps();
  cachedApp = existingApps.length > 0 ? existingApps[0] : initializeApp(firebaseConfig);
  return cachedApp;
}

/**
 * Ambil Firebase Auth untuk instance di atas. `null` bila Firebase belum
 * dikonfigurasi. Belum dipakai di UI mana pun pada tahap ini.
 */
export async function getFirebaseAuth(): Promise<Auth | null> {
  if (cachedAuth) return cachedAuth;

  const app = getFirebaseApp();
  if (!app) return null;

  const { getAuth } = await import('firebase/auth');
  cachedAuth = getAuth(app);
  return cachedAuth;
}
