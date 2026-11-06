'use client';

import { useEffect, useState } from 'react';
import { fetchCurrentUserRole } from '@/lib/current-user';

/**
 * Apakah akun yang sedang login punya `profiles.role = 'admin'`.
 *
 * Dipakai HANYA untuk menampilkan tautan "Panel Admin" di sidebar penjual.
 * Sebelumnya sidebar memanggil `GET /api/admin/me` untuk semua penjual:
 * non-admin selalu menerima 403 sehingga terminal penuh `GET /api/admin/me
 * 403` setiap kali dashboard dibuka, padahal itu jawaban yang benar dan bukan
 * kegagalan. Membaca role sendiri (RLS `profiles_select_own`) tidak
 * menghasilkan 403 dan tetap tidak memberi akses apa pun.
 *
 * Ini BUKAN penegak otorisasi: setiap route admin tetap memverifikasi token +
 * role di server (fail-closed). Bila query gagal, tautan disembunyikan.
 */
export function useIsAdminAccount(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCurrentUserRole()
      .then((role) => {
        if (active) setIsAdmin(role === 'admin');
      })
      .catch(() => {
        if (active) setIsAdmin(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return isAdmin;
}
