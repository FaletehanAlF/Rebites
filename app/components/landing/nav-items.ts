/**
 * Sumber tunggal untuk navigasi situs publik ReBites.
 *
 * Setiap item menunjuk ke halaman nyata, bukan `#anchor` — navbar, menu
 * mobile, dan footer semuanya mengimpor daftar ini sehingga label dan tujuan
 * tidak pernah berbeda antar komponen.
 */
export type NavItem = { href: string; label: string };

export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Beranda' },
  { href: '/tentang-kami', label: 'Tentang Kami' },
  { href: '/fitur', label: 'Fitur Unggulan' },
  { href: '/dampak', label: 'Dampak' },
  { href: '/hubungi-kami', label: 'Hubungi Kami' },
];

/** `aria-current="page"` hanya untuk rute yang sama persis. */
export function isCurrentPath(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href;
}
