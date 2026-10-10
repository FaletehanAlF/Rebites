
export type NavItem = {
  label: string;
  href: string;
  sectionId?: string;
};

export const PRIMARY_NAV: NavItem[] = [{ label: 'Beranda', href: '/', sectionId: 'top' }, { label: 'Tentang Kami', href: '/tentang-kami' }, { label: 'Fitur Unggulan', href: '/fitur' }, { label: 'Dampak', href: '/dampak' }, { label: 'Hubungi Kami', href: '/hubungi-kami' },];

export function isCurrentPath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

