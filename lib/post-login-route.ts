/**
 * Aturan tujuan setelah autentikasi berhasil — modul MURNI.
 *
 * Tanpa jaringan, tanpa Supabase, tanpa DOM, supaya urutan aturannya bisa
 * diuji `node --test` tanpa browser (lihat tests/post-login-route.test.ts).
 *
 * KENAPA ADA KOREKSI "PUNYA TOKO"
 * `profiles.role` ditulis trigger `handle_new_user` saat pendaftaran dan
 * TIDAK ikut berubah ketika akun membuka toko lewat alur pendaftaran penjual:
 * alur itu menambah baris `umkm_profiles`, bukan mengubah peran. Akibatnya
 * penjual yang login kembali tetap terbaca sebagai 'buyer' dan mendarat di
 * beranda pembeli, padahal seluruh aplikasi lain (useSellerStatus, guard
 * dashboard penjual, seller_status admin) sudah menganggapnya penjual.
 *
 * Karena itu kepemilikan toko dipakai sebagai penentu tambahan: akun yang
 * PUNYA TOKO tidak pernah diarahkan ke beranda pembeli. Peran `admin` tetap
 * dihormati — tujuannya memang bukan beranda pembeli.
 *
 * Yang tidak berubah: `redirect` eksplisit dan onboarding `?plan=` tetap
 * menang atas aturan ini, sehingga tautan dalam (mis. detail produk) yang
 * disertakan saat login tidak pernah dibelokkan oleh aturan ini.
 */

export interface PostLoginRouteInput {
  /** `?redirect=` yang sudah lolos validasi path internal, atau null. */
  safeRedirect: string | null;
  /** Tujuan onboarding penjual dari `?plan=` (langganan), atau null. */
  sellerOnboardingTarget: string | null;
  /** Beranda sesuai `profiles.role` — termasuk `fallback` bila role null. */
  roleHome: string;
  /** Beranda pembeli; satu-satunya tujuan yang boleh dinaikkan ke penjual. */
  buyerHome: string;
  /** Dashboard penjual. */
  sellerHome: string;
  /** Akun punya baris `umkm_profiles` (punya toko). */
  hasStore: boolean;
}

export function resolvePostLoginRoute(input: PostLoginRouteInput): string {
  if (input.safeRedirect) return input.safeRedirect;
  if (input.sellerOnboardingTarget) return input.sellerOnboardingTarget;

  if (input.hasStore && input.roleHome === input.buyerHome) {
    return input.sellerHome;
  }

  return input.roleHome;
}
