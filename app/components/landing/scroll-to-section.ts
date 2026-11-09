// Lenis mengambil alih scroll; fallback ke `scrollIntoView` bila Lenis mati
// (reduced motion) atau bundle klien belum ter-hydrate.
export function scrollToSection(id: string, offset = -96): void {
  if (typeof document === 'undefined') return;

  const el = document.getElementById(id);
  if (!el) return;

  const lenis = window.__lenis;
  if (lenis) {
    lenis.scrollTo(el, { offset, duration: 1 });
    return;
  }

  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function handleSectionLinkClick(
  event: React.MouseEvent<HTMLAnchorElement>,
  id: string,
): void {
  if (typeof document === 'undefined') return;
  if (!document.getElementById(id)) return;

  event.preventDefault();
  scrollToSection(id);
}
